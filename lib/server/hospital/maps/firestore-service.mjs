import {createHash,randomUUID} from 'node:crypto';
import {assertHospital,assertDate,assertIdentifier,classifyMealTiming,localClock,CYCLES} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';

const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const oid=(prefix,source)=>`${prefix}_${createHash('sha256').update(source).digest('hex').slice(0,24)}`;
function reasonText(value){
 assertHospital(typeof value==='string'&&value.trim().length>=5&&value.trim().length<=1000,'INVALID','Justificativa objetiva obrigatória (5 a 1000 caracteres)');
 return value.trim();
}
async function mapVisible(db,scope,mapId,permission='map:read'){
 assertIdentifier(mapId,'mapId');
 const map=await db.get(scope.organizationId,'map',mapId);
 assertHospital(!!map,'NOT_FOUND','Mapa não encontrado');
 requireHospitalPermission(scope,permission,map.unitId);
 return map;
}
async function mealRows(db,scope,map){
 return (await db.list(scope.organizationId,'meal',map.unitId)).filter(x=>x.mapId===map.id);
}
async function versionSnapshot(db,scope,map,reason,kind='AMENDMENT'){
 const version=(await db.listMapVersions(scope.organizationId,map.id)).length+1;
 const snapshot=await db.saveMapVersion(scope.organizationId,map.id,version,kind,{map,meals:await mealRows(db,scope,map)},reason,scope.uid);
 await db.appendEvent(scope.organizationId,'map',map.id,kind==='AMENDMENT'?'map.amended':kind==='CLOSE'?'map.closed':'map.submitted',scope.uid,{version,kind,reason});
 return snapshot;
}
async function mapVersion(db,scope,map,reason){
 if(map.status==='DRAFT')return null;
 return await versionSnapshot(db,scope,map,reason,'AMENDMENT');
}
async function incrementMap(db,scope,map){
 return await db.put(scope.organizationId,'map',map.unitId,{...map,updatedAt:db.now()},map.revision);
}
function checkMapRevision(map,expected){
 assertHospital(Number.isInteger(expected)&&map.revision===expected,'CONFLICT','Mapa alterado por outra sessão; recarregue antes de salvar');
}
function timingFor(db,map,type='PRIMARY'){
 return classifyMealTiming({cycleId:map.cycleId,localDate:map.localDate,at:db.now(),mealType:type});
}
function summary(meals){
 const grouped={};
 for(const meal of meals.filter(m=>m.status!=='CANCELLED')){
  const key=`${meal.dietCode}|${meal.mealType}`;
  if(!grouped[key])grouped[key]={dietCode:meal.dietCode,mealType:meal.mealType,count:0,blocked:0};
  grouped[key].count++;
  if(['SAFETY_BLOCKED','SUSPENDED'].includes(meal.status))grouped[key].blocked++;
 }
 return Object.values(grouped).sort((a,b)=>a.dietCode.localeCompare(b.dietCode)||a.mealType.localeCompare(b.mealType));
}
export class HospitalMapsService{
 constructor(store){assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Storage hospitalar indisponível');this.store=store}
 /** W4: only submitted maps with current, safe and explicitly unheld meals may enter production. */
 async listKitchenQueue(scope,{unitId,localDate,cycleId}={}){
  requireHospitalPermission(scope,'meal:production',unitId);
  if(localDate!==undefined)assertDate(localDate);
  if(cycleId!==undefined)assertHospital(!!CYCLES[cycleId],'INVALID','Ciclo inválido');
  const maps=(await this.store.list(scope.organizationId,'map',unitId)).filter(m=>['SUBMITTED','CLOSED'].includes(m.status)
   &&!m.needsKitchenReview&&(!localDate||m.localDate===localDate)&&(!cycleId||m.cycleId===cycleId));
  const result=[];
  for(const map of maps)for(const meal of await mealRows(this.store,scope,map)){
   if(meal.status!=='REQUESTED'||meal.requiresRecheck||meal.advisory==='KITCHEN_REVIEW')continue;
   const adm=await this.store.get(scope.organizationId,'admission',meal.admissionId);
   const diet=await this.store.get(scope.organizationId,'catalog_diet',meal.dietCode);
   if(!adm||adm.status!=='ACTIVE'||adm.unitId!==unitId||adm.fasting||adm.medicalReferenceId!==meal.medicalReferenceId)continue;
   if(!diet||!diet.active||(adm.allergyCodes??[]).some(code=>(meal.dietRestrictionCodes??[]).includes(code)))continue;
   result.push({mealId:meal.id,mapId:map.id,unitId,localDate:map.localDate,cycleId:map.cycleId,
    mealType:meal.mealType,dietCode:meal.dietCode,medicalReferenceId:meal.medicalReferenceId,
    admissionId:meal.admissionId,mealRevision:meal.revision,version:(await this.store.listMapVersions(scope.organizationId,map.id)).length});
  }
  return result;
 }
  async listAdmissions(scope,{unitId}){
  requireHospitalPermission(scope,'admission:read',unitId);
  const result=[];
  for(const admission of await this.store.list(scope.organizationId,'admission',unitId)){
    if(admission.status!=='ACTIVE')continue;
    const p=await this.store.get(scope.organizationId,'patient',admission.patientId);
    result.push({admissionId:admission.id,patientId:admission.patientId,patientCode:p?.referenceCode??admission.patientId,
      bedId:admission.bedId,medicalReferenceId:admission.medicalReferenceId,fasting:admission.fasting,allergyCodes:admission.allergyCodes??[]});
  }
  return result.sort((a,b)=>(a.bedId??'').localeCompare(b.bedId??''));
 }
  async createDraft(scope,{unitId,localDate,cycleId}){
  requireHospitalPermission(scope,'map:write',unitId);
  assertDate(localDate);assertHospital(!!CYCLES[cycleId],'INVALID','Ciclo inválido');
  const mapId=oid('map',`${scope.organizationId}|${unitId}|${localDate}|${cycleId}`);
  return this.store.transaction(async db=>{
   const existing=await db.get(scope.organizationId,'map',mapId);
   if(existing){assertHospital(existing.unitId===unitId,'CONFLICT','Mapa em outra unidade');return existing}
   const map=await db.put(scope.organizationId,'map',unitId,{id:mapId,organizationId:scope.organizationId,unitId,localDate,cycleId,status:'DRAFT',createdAt:db.now(),updatedAt:db.now(),submittedAt:null,closedAt:null});
   await db.appendEvent(scope.organizationId,'map',mapId,'map.created',scope.uid,{unitId,localDate,cycleId});
   return map;
  });
 }
 async listMaps(scope,{unitId,localDate,cycleId,status,late,patientId,bedId,dietCode,mealType,version,restrictionCode}={}){
  requireHospitalPermission(scope,'map:read',unitId);
  if(localDate!==undefined)assertDate(localDate);
  if(cycleId!==undefined)assertHospital(!!CYCLES[cycleId],'INVALID','Ciclo inválido');
  const all=await this.store.list(scope.organizationId,'map',unitId);
  const selected=all.filter(m=>(!localDate||m.localDate===localDate)&&(!cycleId||m.cycleId===cycleId)
      &&(!status||m.status===status)&&(late===undefined||!!m.late===late));
  const result=[];
  for(const m of selected){
    const meals=await mealRows(this.store,scope,m);
    const versions=await this.store.listMapVersions(scope.organizationId,m.id);
    if(version!=null&&!versions.some(v=>v.version===Number(version)))continue;
    if(dietCode&&!meals.some(x=>x.dietCode===dietCode))continue;
    if(mealType&&!meals.some(x=>x.mealType===mealType))continue;
    if(restrictionCode&&!meals.some(x=>(x.dietRestrictionCodes??[]).includes(restrictionCode)))continue;
    if(patientId||bedId){
      let match=false;
      for(const meal of meals){
        const adm=await this.store.get(scope.organizationId,'admission',meal.admissionId);
        if(adm&&(patientId?adm.patientId===patientId:true)&&(bedId?adm.bedId===bedId:true)){match=true;break}
      }
      if(!match)continue;
    }
    result.push({...m,total:meals.filter(x=>x.status!=='CANCELLED').length,summary:summary(meals)});
  }
  return result;
 }
  async getMap(scope,{mapId}){
  const map=await mapVisible(this.store,scope,mapId);
  const meals=await mealRows(this.store,scope,map);
  return {map,meals,summary:summary(meals),receipt:await this.receipt(scope,{mapId}),versions:(await this.store.listMapVersions(scope.organizationId,mapId)).map(v=>({version:v.version,kind:v.kind,recordedAt:v.recordedAt,actorUid:v.actorUid,reason:v.reason}))};
 }
 async receipt(scope,{mapId}){
  const map=await mapVisible(this.store,scope,mapId);
  const versions=await this.store.listMapVersions(scope.organizationId,mapId);
  const submitted=versions.find(v=>v.kind==='SUBMISSION');
  return submitted?{mapId:map.id,organizationId:map.organizationId,unitId:map.unitId,localDate:map.localDate,cycleId:map.cycleId,submittedAt:map.submittedAt,submittedByUid:submitted.actorUid,submissionVersion:submitted.version,currentVersion:versions.length,late:!!map.late,needsKitchenReview:!!map.needsKitchenReview,status:map.status}:null;
 }
 /** Kitchen's explicit acknowledgement; reading a page never implies receipt. */
 async receiveMap(scope,{mapId,expectedRevision,idempotencyKey}={}){
  assertIdentifier(idempotencyKey,'idempotencyKey');
  const initial=await mapVisible(this.store,scope,mapId,'meal:production');
  assertHospital(['SUBMITTED','CLOSED'].includes(initial.status),'PRECONDITION','Somente mapas enviados podem ser recebidos');
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'w12.map.receive',idempotencyKey,digest({mapId,expectedRevision}),async()=>{
   const map=await mapVisible(db,scope,mapId,'meal:production');
   assertHospital(['SUBMITTED','CLOSED'].includes(map.status),'PRECONDITION','Mapa não enviado');
   if(map.receivedAt)return {map,alreadyReceived:true};
   checkMapRevision(map,expectedRevision);
   const updated=await db.put(scope.organizationId,'map',map.unitId,{
    ...map,receivedAt:db.now(),receivedByUid:scope.uid,updatedAt:db.now()
   },map.revision);
   await db.appendEvent(scope.organizationId,'map',map.id,'map.receivedByKitchen',scope.uid,{unitId:map.unitId,localDate:map.localDate,cycleId:map.cycleId,revision:updated.revision});
   return {map:updated,alreadyReceived:false};
  }));
 }
 /** A note is NOT a delivery confirmation and never mutates meal status. */
 async reportDeliveryIssue(scope,{mapId,admissionId=null,note,idempotencyKey}={}){
  assertIdentifier(idempotencyKey,'idempotencyKey');
  const initial=await mapVisible(this.store,scope,mapId,'incident:write');
  assertHospital(['SUBMITTED','CLOSED'].includes(initial.status),'PRECONDITION','Envie o mapa antes de registrar uma ocorrência');
  note=reasonText(note);
  if(admissionId!==null)assertIdentifier(admissionId,'admissionId');
  const input={mapId,admissionId,note};
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'w12.map.reportIssue',idempotencyKey,digest(input),async()=>{
   const map=await mapVisible(db,scope,mapId,'incident:write');
   if(admissionId){
    const admission=await db.get(scope.organizationId,'admission',admissionId);
    assertHospital(admission&&admission.unitId===map.unitId,'NOT_FOUND','Paciente fora da unidade');
   }
   const id='incident_'+randomUUID();
   const record=await db.put(scope.organizationId,'incident',map.unitId,{
    id,organizationId:scope.organizationId,unitId:map.unitId,admissionId,mapId,
    type:'DELIVERY_FEEDBACK',note,status:'OPEN',createdAt:db.now(),createdByUid:scope.uid
   });
   await db.appendEvent(scope.organizationId,'incident',id,'map.deliveryFeedback',scope.uid,{mapId,unitId:map.unitId,admissionId,note});
   return record;
  }));
 }
 async listDeliveryIssues(scope,{unitId,mapId=null,limit=25}={}){
  requireHospitalPermission(scope,'meal:production',unitId);
  assertHospital(Number.isInteger(limit)&&limit>=1&&limit<=100,'INVALID','Limite inválido');
  if(mapId!==null){assertIdentifier(mapId,'mapId');await mapVisible(this.store,scope,mapId,'meal:production');}
  const incidents=await this.store.list(scope.organizationId,'incident',unitId);
  return incidents.filter(x=>x.type==='DELIVERY_FEEDBACK'&&(!mapId||x.mapId===mapId))
   .sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??'')).slice(0,limit);
 }
 async listVersions(scope,{mapId}){
  const map=await mapVisible(this.store,scope,mapId);
  return await this.store.listMapVersions(scope.organizationId,map.id);
 }
 /**
  * Add/edit a request as a map mutation: scope+ETag+idempotency+uniqueness.
  * A 30-min delivery tolerance never becomes a new routine map deadline.
  */
 async setMeal(scope,{mapId,admissionId,mealType,medicalReferenceId,dietCode,expectedMapRevision,idempotencyKey,reason=null,effectiveAt=null}){
  for(const value of [mapId,admissionId,medicalReferenceId,dietCode,idempotencyKey])assertIdentifier(value);
  assertHospital(['PRIMARY','SECONDARY'].includes(mealType),'INVALID','Tipo de refeição inválido');
  const initial=await mapVisible(this.store,scope,mapId,'map:write');
  requireHospitalPermission(scope,'meal:write',initial.unitId);
  const input={mapId,admissionId,mealType,medicalReferenceId,dietCode,expectedMapRevision,reason,effectiveAt};
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'w3.meal.set',idempotencyKey,digest(input),async()=>{
   const map=await mapVisible(db,scope,mapId,'map:write');checkMapRevision(map,expectedMapRevision);
   const t=timingFor(db,map,mealType);
   if(t.requiresAmendment)reason=reasonText(reason);
   if(map.status!=='DRAFT')reason=reasonText(reason);
   if(t.principalDeliveryTolerancePassed&&mealType==='PRIMARY')
    assertHospital(false,'PRECONDITION','Principal fora da tolerância; registrar exceção clínica e contatar a assistência, sem liberação automática');
   const adm=await db.get(scope.organizationId,'admission',admissionId);
   assertHospital(adm&&adm.unitId===map.unitId&&adm.status==='ACTIVE','PRECONDITION','Paciente não está ativo nesta unidade; confira movimentação');
   const ref=await db.get(scope.organizationId,'medical_reference',medicalReferenceId);
   assertHospital(ref&&ref.unitId===map.unitId&&ref.admissionId===admissionId&&ref.catalogItemId===dietCode&&adm.medicalReferenceId===ref.id,'PRECONDITION','Registro não corresponde à prescrição médica vigente');
   const diet=await db.get(scope.organizationId,'catalog_diet',dietCode);
   assertHospital(diet&&diet.active,'PRECONDITION','Dieta inativa ou não autorizada');
   const codes=[...new Set([...(diet.restrictionCodes??[]),...(diet.allergenCodes??[]),...(ref.restrictionCodes??[])])];
   const blocked=!!adm.fasting||(adm.allergyCodes??[]).some(code=>codes.includes(code));
   const existingId=await db.getMealKey(scope.organizationId,admissionId,map.localDate,map.cycleId,mealType);
   const old=existingId?await db.get(scope.organizationId,'meal',existingId):null;
   assertHospital(!old||old.mapId===map.id,'CONFLICT','Refeição já vinculada a outro mapa na transferência; conciliar com a cozinha');
   assertHospital(!old||old.status!=='DELIVERED','PRECONDITION','Refeição já entregue; comunicar intercorrência');
   const safetyHold=old&&!['REQUESTED','SUSPENDED','SAFETY_BLOCKED','CANCELLED'].includes(old.status);
   const status=blocked||safetyHold?'SAFETY_BLOCKED':t.requiresAmendment&&mealType==='PRIMARY'?'SUSPENDED':'REQUESTED';
   const now=db.now();
   const meal=await db.put(scope.organizationId,'meal',map.unitId,{...old,id:old?.id??oid('meal',`${scope.organizationId}|${admissionId}|${map.localDate}|${map.cycleId}|${mealType}`),organizationId:scope.organizationId,unitId:map.unitId,mapId,admissionId,localDate:map.localDate,cycleId:map.cycleId,mealType,dietCode,dietRestrictionCodes:codes,catalogRevision:diet.revision,medicalReferenceId,status,requestedAt:old?.requestedAt??now,updatedAt:now,effectiveAt,advisory:t.recommendation,requiresRecheck:!!safetyHold||t.requiresAmendment&&mealType==='PRIMARY',suspensionReason:t.requiresAmendment&&mealType==='PRIMARY'?'LATE_PRIMARY_KITCHEN_REVIEW':old?.suspensionReason??null},old?.revision);
   if(!old)await db.ensureMealUnique(scope.organizationId,admissionId,map.localDate,map.cycleId,mealType,meal.id);
   await db.appendEvent(scope.organizationId,'meal',meal.id,['SAFETY_BLOCKED','SUSPENDED'].includes(status)?'meal.suspended':'meal.requested',scope.uid,{reason:reason??null,timing:t,status,oldRevision:old?.revision??null},effectiveAt);
   const updated=await incrementMap(db,scope,map);
   const amendment=await mapVersion(db,scope,updated,reason);
   return {map:updated,meal,amendmentVersion:amendment?.version??null,extraordinary:t.requiresAmendment,needsKitchenReview:t.requiresAmendment||status==='SAFETY_BLOCKED'};
  }));
 }
 async removeMeal(scope,{mapId,mealId,expectedMapRevision,expectedMealRevision,reason=null,idempotencyKey}){
  for(const x of [mapId,mealId,idempotencyKey])assertIdentifier(x);
  const initial=await mapVisible(this.store,scope,mapId,'map:write');
  requireHospitalPermission(scope,'meal:write',initial.unitId);
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'w3.meal.remove',idempotencyKey,digest({mapId,mealId,expectedMapRevision,expectedMealRevision,reason}),async()=>{
   const map=await mapVisible(db,scope,mapId,'map:write');checkMapRevision(map,expectedMapRevision);
   const meal=await db.get(scope.organizationId,'meal',mealId);
   assertHospital(meal&&meal.mapId===mapId&&meal.unitId===map.unitId,'NOT_FOUND','Refeição fora do mapa');
   assertHospital(meal.revision===expectedMealRevision,'CONFLICT','Refeição alterada por outra sessão');
   assertHospital(!['DELIVERED','CANCELLED'].includes(meal.status),'PRECONDITION','Não é possível remover refeição entregue/cancelada');
   if(map.status!=='DRAFT'||['PREPARING','READY','DISPATCHED','RECEIVED_BY_UNIT'].includes(meal.status))reason=reasonText(reason);
   const next=['PREPARING','READY','DISPATCHED','RECEIVED_BY_UNIT'].includes(meal.status)?'SUSPENDED':'CANCELLED';
   const updatedMeal=await db.put(scope.organizationId,'meal',map.unitId,{...meal,status:next,updatedAt:db.now(),suspensionReason:reason??'REMOVED_FROM_MAP'},meal.revision);
   await db.appendEvent(scope.organizationId,'meal',mealId,next==='SUSPENDED'?'meal.suspended':'meal.cancelled',scope.uid,{reason,previous:meal.status});
   const updated=await incrementMap(db,scope,map);
   const amendment=await mapVersion(db,scope,updated,reason);
   return {map:updated,meal:updatedMeal,amendmentVersion:amendment?.version??null};
  }));
 }
 async submitMap(scope,{mapId,expectedRevision,idempotencyKey,lateReason=null}){
  assertIdentifier(idempotencyKey);
  const initial=await mapVisible(this.store,scope,mapId,'map:write');
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'w3.map.submit',idempotencyKey,digest({mapId,expectedRevision,lateReason}),async()=>{
   const map=await mapVisible(db,scope,mapId,'map:write');checkMapRevision(map,expectedRevision);
   assertHospital(map.status==='DRAFT','PRECONDITION','Mapa já enviado; use adendo auditável');
   const timing=timingFor(db,map);
   const reason=timing.requiresAmendment?reasonText(lateReason):null;
   if(timing.requiresAmendment){
    // A late submission never quietly releases its previously drafted principal meals.
    for(const meal of (await mealRows(db,scope,map)).filter(x=>x.mealType==='PRIMARY'&&['REQUESTED','PREPARING','READY'].includes(x.status))){
     await db.put(scope.organizationId,'meal',map.unitId,{...meal,status:'SUSPENDED',requiresRecheck:true,suspensionReason:'LATE_MAP_SUBMISSION_REVIEW'},meal.revision);
     await db.appendEvent(scope.organizationId,'meal',meal.id,'meal.suspended',scope.uid,{reason:'LATE_MAP_SUBMISSION_REVIEW'});
    }
   }
   const updated=await db.put(scope.organizationId,'map',map.unitId,{...map,status:'SUBMITTED',submittedAt:db.now(),late:timing.requiresAmendment,needsKitchenReview:timing.requiresAmendment,updatedAt:db.now()},map.revision);
   const snapshot=await versionSnapshot(db,scope,updated,reason,'SUBMISSION');
   await db.appendEvent(scope.organizationId,'map',mapId,timing.requiresAmendment?'map.late':'map.onTime',scope.uid,{timing,version:snapshot.version});
   return {map:updated,receipt:{mapId,organizationId:scope.organizationId,unitId:map.unitId,localDate:map.localDate,cycleId:map.cycleId,submittedAt:updated.submittedAt,submittedByUid:scope.uid,submissionVersion:snapshot.version,currentVersion:snapshot.version,late:timing.requiresAmendment,needsKitchenReview:timing.requiresAmendment,status:updated.status},timing};
  }));
 }
 async closeDue(scope,{mapId,expectedRevision,idempotencyKey}){
  assertIdentifier(idempotencyKey,'idempotencyKey');
  await mapVisible(this.store,scope,mapId,'map:write');
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'w3.map.close',idempotencyKey,digest({mapId,expectedRevision}),async()=>{
   const map=await mapVisible(db,scope,mapId,'map:write');checkMapRevision(map,expectedRevision);
   assertHospital(map.status==='SUBMITTED','PRECONDITION','Somente mapa enviado pode ser fechado');
   const clock=localClock(db.now()),due=Number(CYCLES[map.cycleId].mapDue.slice(0,2))*60;
   assertHospital(clock.date>map.localDate||(clock.date===map.localDate&&clock.minuteOfDay>=due),'PRECONDITION','Ainda não chegou o horário oficial de fechamento');
   const updated=await db.put(scope.organizationId,'map',map.unitId,{...map,status:'CLOSED',closedAt:db.now(),updatedAt:db.now()},map.revision);
   const snapshot=await versionSnapshot(db,scope,updated,null,'CLOSE');
   return {map:updated,version:snapshot.version};
  }));
 }
 /** Records escalation as a pending incident. Does NOT authorize a late principal or prescribe food. */
 async escalateClinicalException(scope,{mapId,admissionId,mealType,reason,contactReference,idempotencyKey}){
  assertIdentifier(idempotencyKey,'idempotencyKey');
  const map=await mapVisible(this.store,scope,mapId,'map:write');
  requireHospitalPermission(scope,'incident:write',map.unitId);assertIdentifier(admissionId);
  assertHospital(['PRIMARY','SECONDARY'].includes(mealType),'INVALID','Tipo inválido');
  reason=reasonText(reason);contactReference=reasonText(contactReference);
  return this.store.transaction(async db=>db.idempotent(scope.organizationId,'w3.exception.escalate',idempotencyKey,digest({mapId,admissionId,mealType,reason,contactReference}),async()=>{
   const admission=await db.get(scope.organizationId,'admission',admissionId);
   assertHospital(admission&&admission.unitId===map.unitId&&admission.status==='ACTIVE','NOT_FOUND','Internação não ativa na unidade');
   const incidentId=`incident_${randomUUID()}`,now=db.now();
   const item=await db.put(scope.organizationId,'incident',map.unitId,{id:incidentId,organizationId:scope.organizationId,unitId:map.unitId,admissionId,mapId,type:'CLINICAL_ESCALATION',mealType,reason,contactReference,status:'OPEN',resolution:'PENDING_ASSISTANCE',createdAt:now,actorUid:scope.uid});
   await db.appendEvent(scope.organizationId,'incident',item.id,'meal.clinicalEscalation.requested',scope.uid,{mapId,mealType,contactReference});
   return {incidentId:item.id,status:'PENDING_ASSISTANCE',message:'Exceção registrada. Acionar responsável assistencial e cozinha; nenhuma refeição foi liberada automaticamente.'};
  }));
 }
}
