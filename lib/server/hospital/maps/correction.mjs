import {createHash,randomUUID} from 'node:crypto';
import {assertHospital,assertIdentifier,classifyMealTiming} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const labelId=mealId=>'dist_'+digest(mealId).slice(0,26);
const explanation=value=>{
 assertHospital(typeof value==='string'&&value.trim().length>=5&&value.trim().length<=500,'INVALID','Informe o motivo da correção (5 a 500 caracteres)');
 return value.trim();
};
const observation=value=>{
 assertHospital(typeof value==='string'&&value.trim().length<=180&&!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value),'INVALID','Observação inválida (até 180 caracteres)');
 return value.trim();
};
const pendingStates=new Set(['REQUESTED','PREPARING','READY','DISPATCHED','RECEIVED_BY_UNIT','SUSPENDED','SAFETY_BLOCKED']);
const deliveredStates=new Set(['DISPATCHED','RECEIVED_BY_UNIT']);
const sameMap=async(db,scope,mapId,permission)=>{
 assertIdentifier(mapId);const map=await db.get(scope.organizationId,'map',mapId);
 assertHospital(map,'NOT_FOUND','Mapa não encontrado');
 requireHospitalPermission(scope,permission,map.unitId);
 return map;
};
async function checkDiet(db,scope,meal,newDietCode){
 assertIdentifier(newDietCode);
 const diet=await db.get(scope.organizationId,'catalog_diet',newDietCode);
 assertHospital(diet&&diet.active&&diet.unitId==='hospital_catalog','PRECONDITION','Dieta corrigida inexistente ou desativada');
 if(meal.recipientType==='COMPANION')assertHospital(diet.type==='ORAL'&&diet.route==='ORAL','PRECONDITION','Acompanhante exige dieta oral');
 return diet;
}
async function appendVersion(db,scope,map,reason){
 if(map.status==='DRAFT')return null;
 const version=(await db.listMapVersions(scope.organizationId,map.id)).length+1;
 const meals=(await db.list(scope.organizationId,'meal',map.unitId)).filter(x=>x.mapId===map.id);
 await db.saveMapVersion(scope.organizationId,map.id,version,'AMENDMENT',{map,meals},reason,scope.uid);
 await db.appendEvent(scope.organizationId,'map',map.id,'map.amended',scope.uid,{version,reason,origin:'DIET_CORRECTION'});
 return version;
}

/** Draft edits are local to the map; not an acknowledgement of submitted corrections. */
export async function editDraftMeal(store,scope,entry={}){
 const {mapId,mealId,expectedMapRevision,expectedMealRevision,newDietCode,idempotencyKey}=entry;
 for(const id of [mapId,mealId,newDietCode,idempotencyKey])assertIdentifier(id);
 const initial=await sameMap(store,scope,mapId,'map:write');
 requireHospitalPermission(scope,'meal:write',initial.unitId);
 const note=observation(entry.observation??'');
 return store.transaction(async db=>db.idempotent(scope.organizationId,'hospital.map.draft.edit',idempotencyKey,digest(entry),async()=>{
  const map=await sameMap(db,scope,mapId,'map:write');
  assertHospital(map.status==='DRAFT','PRECONDITION','Mapa enviado: solicite correção com ciência da Cozinha');
  assertHospital(map.revision===expectedMapRevision,'CONFLICT','Mapa alterado; recarregue');
  const meal=await db.get(scope.organizationId,'meal',mealId);
  assertHospital(meal?.mapId===mapId&&meal.unitId===map.unitId,'NOT_FOUND','Refeição fora do mapa');
  assertHospital(meal.revision===expectedMealRevision&&['REQUESTED','SAFETY_BLOCKED'].includes(meal.status),'CONFLICT','Refeição alterada; recarregue');
  const diet=await checkDiet(db,scope,meal,newDietCode);
  const adm=await db.get(scope.organizationId,'admission',meal.admissionId);
  const codes=[...(diet.restrictionCodes??[])];
  const blocked=meal.recipientType!=='COMPANION'&&(!!adm.fasting||(adm.allergyCodes??[]).some(x=>codes.includes(x)));
  const changed=await db.put(scope.organizationId,'meal',map.unitId,{...meal,dietCode:diet.id,catalogRevision:diet.revision,
    dietRestrictionCodes:codes,observation:note,status:blocked?'SAFETY_BLOCKED':'REQUESTED',
    dietRevisionAuthorized:true,correctedAt:db.now(),updatedAt:db.now(),requiresRecheck:blocked,
    suspensionReason:blocked?'CLINICAL_SAFETY_BLOCK':null},meal.revision);
  await db.appendEvent(scope.organizationId,'meal',meal.id,'meal.draftEdited',scope.uid,{before:meal.dietCode,after:diet.id});
  const next=await db.put(scope.organizationId,'map',map.unitId,{...map,updatedAt:db.now()},map.revision);
  return {map:next,meal:changed};
 }));
}

/** Unit requests correction and immediately holds an incorrect diet before kitchen acknowledgement. */
export async function requestCorrection(store,scope,entry={}){
 const {mapId,mealId,expectedMapRevision,expectedMealRevision,newDietCode,idempotencyKey}=entry;
 for(const id of [mapId,mealId,newDietCode,idempotencyKey])assertIdentifier(id);
 const original=await sameMap(store,scope,mapId,'map:write');
 requireHospitalPermission(scope,'meal:write',original.unitId);
 const reason=explanation(entry.reason);
 return store.transaction(async db=>db.idempotent(scope.organizationId,'hospital.meal.correction.request',idempotencyKey,digest(entry),async()=>{
  const map=await sameMap(db,scope,mapId,'map:write');
  assertHospital(map.revision===expectedMapRevision,'CONFLICT','Mapa desatualizado');
  assertHospital(['SUBMITTED','CLOSED'].includes(map.status),'PRECONDITION','Mapa ainda não enviado; edite o rascunho diretamente');
  const meal=await db.get(scope.organizationId,'meal',mealId);
  assertHospital(meal?.mapId===mapId&&meal.unitId===map.unitId,'NOT_FOUND','Refeição fora do mapa');
  assertHospital(meal.revision===expectedMealRevision,'CONFLICT','Refeição alterada; atualize');
  assertHospital(pendingStates.has(meal.status)&&meal.status!=='SUSPENDED','PRECONDITION','Refeição não está apta a receber nova correção');
  assertHospital(meal.dietCode!==newDietCode,'INVALID','Selecione uma dieta diferente da enviada');
  const diet=await checkDiet(db,scope,meal,newDietCode);
  const already=(await db.list(scope.organizationId,'incident',map.unitId)).some(x=>x.type==='DIET_CORRECTION'&&x.mealId===mealId&&x.status==='OPEN');
  assertHospital(!already,'CONFLICT','Já existe correção pendente para esta refeição');
  const id='incident_'+randomUUID().replaceAll('-','');
  const timing=classifyMealTiming({cycleId:map.cycleId,localDate:map.localDate,at:db.now(),mealType:meal.mealType});
  const issue=await db.put(scope.organizationId,'incident',map.unitId,{
   id,organizationId:scope.organizationId,unitId:map.unitId,mapId,mealId,admissionId:meal.admissionId,
   type:'DIET_CORRECTION',status:'OPEN',note:reason,previousDietCode:meal.dietCode,proposedDietCode:diet.id,
   previousStatus:meal.status,timingStage:timing.stage,createdAt:db.now(),createdByUid:scope.uid,
   routeRecallRequired:deliveredStates.has(meal.status)
  });
  const changed=await db.put(scope.organizationId,'meal',map.unitId,{...meal,status:'SUSPENDED',
    suspensionReason:'CORRECTION_REQUESTED',requiresRecheck:true,correctionPendingId:id,updatedAt:db.now()},meal.revision);
  await db.appendEvent(scope.organizationId,'meal',meal.id,'meal.correction.requested',scope.uid,{correctionId:id,fromDietCode:meal.dietCode,toDietCode:diet.id,previousStatus:meal.status});
  await db.appendEvent(scope.organizationId,'incident',id,'meal.correction.opened',scope.uid,{mapId,mealId,reason});
  const changedMap=await db.put(scope.organizationId,'map',map.unitId,{...map,updatedAt:db.now()},map.revision);
  await appendVersion(db,scope,changedMap,reason);
  return {incident:issue,map:changedMap,meal:changed,awaitsKitchenAcknowledgement:true};
 }));
}
export async function listCorrections(store,scope,{unitId,mapId=null,status='OPEN'}={}){
 requireHospitalPermission(scope,'meal:production',unitId);
 assertHospital(['OPEN','ACKNOWLEDGED','ALL'].includes(status),'INVALID','Filtro inválido');
 if(mapId){const m=await sameMap(store,scope,mapId,'meal:production');assertHospital(m.unitId===unitId,'FORBIDDEN','Mapa fora da unidade');}
 return (await store.list(scope.organizationId,'incident',unitId))
  .filter(x=>x.type==='DIET_CORRECTION'&&(!mapId||x.mapId===mapId)&&(status==='ALL'||x.status===status))
  .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
/** Kitchen acknowledgement is the only action that queues the corrected item for production. */
export async function acknowledgeCorrection(store,scope,entry={}){
 const {unitId,issueId,expectedRevision,idempotencyKey}=entry;
 for(const id of [unitId,issueId,idempotencyKey])assertIdentifier(id);
 requireHospitalPermission(scope,'meal:production',unitId);
 return store.transaction(async db=>db.idempotent(scope.organizationId,'hospital.meal.correction.ack',idempotencyKey,digest(entry),async()=>{
  const issue=await db.get(scope.organizationId,'incident',issueId);
  assertHospital(issue?.unitId===unitId&&issue.type==='DIET_CORRECTION','NOT_FOUND','Correção fora da unidade');
  assertHospital(issue.status==='OPEN'&&issue.revision===expectedRevision,'CONFLICT','Correção já tratada ou alterada');
  const map=await sameMap(db,scope,issue.mapId,'meal:production');
  const meal=await db.get(scope.organizationId,'meal',issue.mealId);
  assertHospital(meal?.unitId===unitId&&meal.mapId===map.id&&meal.correctionPendingId===issueId&&meal.status==='SUSPENDED','PRECONDITION','Pedido alterado durante a correção');
  const diet=await checkDiet(db,scope,meal,issue.proposedDietCode);
  if(issue.routeRecallRequired){
   const timing=classifyMealTiming({cycleId:map.cycleId,localDate:map.localDate,at:db.now(),mealType:meal.mealType});
   assertHospital(timing.stage!=='AFTER_TOLERANCE','PRECONDITION','Correção em rota fora da tolerância: tratar presencialmente e registrar contingência, sem retorno automático');
   assertHospital(entry.physicalRecallConfirmed===true,'PRECONDITION','Confirme que a refeição antiga foi fisicamente recolhida antes de reabrir produção');
  }
  const org=scope.organizationId,now=db.now();
  // Explicitly detach the obsolete meal from production batches; never leave its old
  // preparation reserved as if it were the new diet.
  for(const batch of (await db.list(org,'production_batch',unitId)).filter(b=>b.status!=='CANCELLED'&&b.mealIds.includes(meal.id))){
   const remaining=batch.mealIds.filter(id=>id!==meal.id);
   await db.releaseBatchMeal(org,meal.id,batch.id);
   const updated=await db.put(org,'production_batch',unitId,{...batch,mealIds:remaining,
     quantity:remaining.length,status:remaining.length?'NEEDS_REVIEW':'CANCELLED',
     cancelReason:remaining.length?batch.cancelReason:'Correção de dieta pela Cozinha',
     excludedMealIds:[...(batch.excludedMealIds??[]),meal.id]},batch.revision);
   await db.appendEvent(org,'production_batch',batch.id,'meal.production.batch.correctionRemoved',scope.uid,{mealId:meal.id,correctionId:issueId,beforeStatus:batch.status,afterStatus:updated.status});
  }
  const job=await db.get(org,'label',labelId(meal.id));
  if(job&&job.state!=='DELIVERED'){
   await db.put(org,'label',unitId,{...job,state:'REVOKED_CORRECTION',updatedAt:now,revokedAt:now,revocationReason:issue.note},job.revision);
   await db.appendEvent(org,'meal',meal.id,'meal.distribution.revokedForCorrection',scope.uid,{previousState:job.state,correctionId:issueId});
  }
  const admission=await db.get(org,'admission',meal.admissionId);
  const codes=meal.recipientType==='COMPANION'?diet.restrictionCodes??[]:[...(diet.restrictionCodes??[]),...(meal.restrictionCodes??[])];
  const blocked=meal.recipientType!=='COMPANION'&&(!!admission?.fasting||(admission?.allergyCodes??[]).some(c=>codes.includes(c)));
  const corrected=await db.put(org,'meal',unitId,{...meal,dietCode:diet.id,catalogRevision:diet.revision,dietRestrictionCodes:codes,
   status:blocked?'SAFETY_BLOCKED':'REQUESTED',requiresRecheck:blocked,suspensionReason:blocked?'CLINICAL_SAFETY_BLOCK':null,
   correctionPendingId:null,correctionAcknowledgedAt:now,correctionAcknowledgedByUid:scope.uid,
   correctedAt:now,dietRevisionAuthorized:true,correctionId:issue.id,updatedAt:now},meal.revision);
  const approved=await db.put(org,'incident',unitId,{...issue,status:'ACKNOWLEDGED',acknowledgedAt:now,acknowledgedByUid:scope.uid,physicalRecallConfirmed:!!entry.physicalRecallConfirmed},issue.revision);
  await db.appendEvent(org,'meal',meal.id,'meal.correction.acknowledged',scope.uid,{from:issue.previousDietCode,to:issue.proposedDietCode,previousStatus:issue.previousStatus,correctionId:issueId});
  await db.appendEvent(org,'incident',issueId,'meal.correction.closed',scope.uid,{mealId:meal.id,corrected:!blocked});
  const updatedMap=await db.put(org,'map',unitId,{...map,updatedAt:now},map.revision);
  await appendVersion(db,scope,updatedMap,issue.note);
  return {incident:approved,meal:corrected,map:updatedMap,returnedToProduction:!blocked};
 }));
}
