import {createHash,randomUUID} from 'node:crypto';
import {assertHospital,assertDate,assertIdentifier,classifyMealTiming} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';

/**
 * One-screen transcription of an existing care-unit diet instruction. This is NOT a
 * prescription generator. Canonical patients, admissions, beds, maps and meals are
 * created in one Firestore transaction, with scope, idempotency and immutable audit.
 */
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stable=(prefix,value)=>prefix+'_'+hash(value).slice(0,24);
const required=(value,field,max=160)=>{
 assertHospital(typeof value==='string'&&value.trim().length>0&&value.trim().length<=max,'INVALID',field+' obrigatório ou inválido');
 return value.trim();
};
const allowedConsistency=new Set(['LIVRE','PASTOSA','BRANDA','LIQUIDA_RESTRITA','LIQUIDA_COMPLETA','LIQUIDA_SEM_RESIDUOS','OUTRA']);
const allowedRestrictions=new Set(['HIPOSSODICA','HIPOLIPIDICA','HIPOPROTEICA','DIABETICO','NPVO','SNE','OUTRO']);
const allowedMeals=new Set(['PRIMARY','SECONDARY']);
const codes=(value,field)=>{
 assertHospital(Array.isArray(value)&&value.length<=30&&value.every(x=>typeof x==='string'&&/^[A-Za-z0-9_:-]{1,64}$/.test(x)),'INVALID',field+' inválido');
 return [...new Set(value)];
};
const note=(value,max=180)=>{
 assertHospital(value==null||(typeof value==='string'&&value.trim().length<=max&&!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)),'INVALID','Observação inválida');
 return value?.trim()??'';
};
const restricted=(stage)=>stage!=='ON_TIME';

export async function registerPatientInMap(store,scope,entry={}){
 const {mapId,expectedMapRevision,idempotencyKey}=entry;
 for(const id of [mapId,idempotencyKey])assertIdentifier(id);
 const original=await store.get(scope.organizationId,'map',mapId);
 assertHospital(original,'NOT_FOUND','Mapa não encontrado');
 for(const perm of ['map:write','patient:write','admission:write','meal:write'])requireHospitalPermission(scope,perm,original.unitId);
 assertHospital(Number.isInteger(expectedMapRevision),'INVALID','Revisão do mapa inválida');
 const fullName=required(entry.fullName,'Nome completo');
 const birthDate=assertDate(entry.birthDate);
 assertHospital(new Date(birthDate+'T12:00:00Z')<=new Date(),'INVALID','Data de nascimento futura');
 const bedLabel=required(entry.bedLabel,'Número do leito',60);
 const consistency=required(entry.consistency,'Consistência',40);
 assertHospital(allowedConsistency.has(consistency),'INVALID','Consistência não autorizada');
 const route=entry.route;
 assertHospital(['ORAL','SONDA'].includes(route),'INVALID','Via inválida');
 const restrictions=codes(entry.restrictions??[],'Restrições alimentares');
 assertHospital(restrictions.every(x=>allowedRestrictions.has(x)),'INVALID','Restrição desconhecida');
 const other=restrictions.includes('OUTRO')?required(entry.otherRestriction,'Especificação de outra restrição',120):'';
 const allergy=note(entry.allergyNote,180);
 const comment=note(entry.observation,180);
 const meals=entry.meals??['PRIMARY','SECONDARY'];
 assertHospital(Array.isArray(meals)&&meals.length<=2&&new Set(meals).size===meals.length&&meals.every(x=>allowedMeals.has(x)),'INVALID','Refeições inválidas');
 const companion=entry.companion===true;
 assertHospital(meals.length>0||companion,'INVALID','Selecione ao menos uma refeição para paciente ou acompanhante');
 const noOral=route==='SONDA'||restrictions.includes('NPVO')||restrictions.includes('SNE');
 assertHospital(!noOral||meals.length===0,'PRECONDITION','Paciente NPVO/SNE/sonda não recebe refeição oral da cozinha; mantenha somente acompanhante, se aplicável');
 assertHospital(entry.confirmedAgainstCareInstruction===true,'PRECONDITION','Confirme que os dados foram conferidos com a orientação assistencial vigente');
 if(meals.length)assertIdentifier(entry.catalogItemId,'catalogItemId');
 if(companion)assertIdentifier(entry.companionCatalogItemId,'companionCatalogItemId');
 const submitted=original.status!=='DRAFT';
 const reason=restricted(classifyMealTiming({cycleId:original.cycleId,localDate:original.localDate,at:store.now()}).stage)
  ?required(entry.reason,'Justificativa do horário extraordinário',1000)
  :submitted?'Inclusão complementar após envio do mapa':null;
 assertHospital(reason===null||reason.length>=5,'INVALID','Justificativa insuficiente');
 const input={mapId,expectedMapRevision,fullName,birthDate,bedLabel,consistency,route,restrictions,other,allergy,comment,meals,companion,catalogItemId:entry.catalogItemId,companionCatalogItemId:entry.companionCatalogItemId,reason};
 return store.transaction(async db=>db.idempotent(scope.organizationId,'hospital.map.patient.quick',idempotencyKey,hash(input),async()=>{
  const map=await db.get(scope.organizationId,'map',mapId);
  assertHospital(map&&map.unitId===original.unitId,'NOT_FOUND','Mapa fora da unidade');
  assertHospital(map.revision===expectedMapRevision,'CONFLICT','Mapa atualizado por outra sessão; recarregue');
  assertHospital(['DRAFT','SUBMITTED','CLOSED'].includes(map.status),'PRECONDITION','Mapa indisponível');
  const org=scope.organizationId,unitId=map.unitId,now=db.now();
  const diet=meals.length?await db.get(org,'catalog_diet',entry.catalogItemId):null;
  assertHospital(!meals.length||(diet?.active&&diet.unitId==='hospital_catalog'&&diet.type==='ORAL'&&diet.route==='ORAL'),'PRECONDITION','É necessária uma base de dieta oral autorizada; a consistência escolhida é independente do catálogo');
  const companionDiet=companion?await db.get(org,'catalog_diet',entry.companionCatalogItemId):null;
  assertHospital(!companion||(companionDiet?.active&&companionDiet.unitId==='hospital_catalog'&&companionDiet.type==='ORAL'&&companionDiet.route==='ORAL'),'PRECONDITION','Refeição oral do acompanhante não está habilitada no catálogo');
  const beds=await db.list(org,'bed',unitId);
  let bed=beds.find(b=>b.label.trim().toUpperCase()===bedLabel.toUpperCase());
  if(!bed){
    const id=stable('bed',org+'|'+unitId+'|'+bedLabel.trim().toUpperCase());
    bed=await db.get(org,'bed',id);
    if(!bed)bed=await db.put(org,'bed',unitId,{id,organizationId:org,unitId,label:bedLabel,active:true,origin:'MAP_QUICK_REGISTRATION',createdAt:now});
    await db.appendEvent(org,'bed',id,'bed.createdFromUnitMap',scope.uid,{unitId});
  }
  assertHospital(bed.unitId===unitId&&bed.active,'PRECONDITION','Leito indisponível');
  const possiblePatients=(await db.list(org,'patient',unitId)).filter(p=>p.displayName?.trim().toLocaleLowerCase('pt-BR')===fullName.toLocaleLowerCase('pt-BR')&&p.birthDate===birthDate);
  const activeMatches=[];
  for(const candidate of possiblePatients){
   const active=await db.getActiveAdmission(org,candidate.id);
   if(active)activeMatches.push({patient:candidate,admission:active});
  }
  // Never merge a former patient's identity using only name and birth date.
  assertHospital(activeMatches.length<=1&&activeMatches.every(x=>x.admission.unitId===unitId&&x.admission.bedId===bed.id),
    'CONFLICT','Há cadastro ativo correspondente em outro leito; confira a identificação antes de continuar');
  let patient=activeMatches[0]?.patient??null;
  let admission=activeMatches[0]?.admission??null;
  if(!patient){
   const id='pt_'+randomUUID().replaceAll('-','');
   const referenceCode='LOCAL_'+randomUUID().replaceAll('-','').toUpperCase();
   await db.reservePatientReference(org,referenceCode,id);
   patient=await db.put(org,'patient',unitId,{id,organizationId:org,unitId,referenceCode,displayName:fullName,birthDate,createdAt:now});
   await db.appendEvent(org,'patient',id,'patient/created',scope.uid,{unitId,origin:'MAP_QUICK_REGISTRATION'});
  }
  if(!admission){
   assertHospital(!await db.isBedOccupied(org,unitId,bed.id),'CONFLICT','Leito já ocupado por outro paciente');
   const id='adm_'+randomUUID().replaceAll('-','');
   await db.reserveActiveAdmission(org,patient.id,id);
   await db.reserveBed(org,unitId,bed.id,id);
   admission=await db.put(org,'admission',unitId,{id,organizationId:org,unitId,patientId:patient.id,bedId:bed.id,medicalReferenceId:null,status:'ACTIVE',fasting:restrictions.includes('NPVO'),allergyCodes:codes(allergy?allergy.split(',').map(x=>x.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')).filter(Boolean):[],'Alergias'),temporaryUnitId:null,plannedDischargeAt:null,createdAt:now,dischargedAt:null});
   await db.appendEvent(org,'admission',id,'patient/admission.updated',scope.uid,{action:'ADMITTED',unitId,bedId:bed.id,origin:'MAP_QUICK_REGISTRATION'});
  }
  const allergyCodes=codes(allergy?allergy.split(',').map(x=>x.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')).filter(Boolean):[],'Alergias');
  let ref=admission.medicalReferenceId?await db.get(org,'medical_reference',admission.medicalReferenceId):null;
  if(meals.length){
   if(ref){
    assertHospital(ref.catalogItemId===diet.id,'PRECONDITION','Já há dieta de outra referência para o paciente. Solicite correção específica à cozinha');
    assertHospital(admission.fasting===false,'PRECONDITION','Paciente em jejum; reavaliar antes de solicitar dieta oral');
    assertHospital(JSON.stringify(admission.allergyCodes??[])===JSON.stringify(allergyCodes),'PRECONDITION','Alergias divergentes: atualize a referência de segurança antes de solicitar refeições');
   }else{
    const refId='ref_'+randomUUID().replaceAll('-','');
    ref=await db.put(org,'medical_reference',unitId,{id:refId,organizationId:org,unitId,admissionId:admission.id,catalogItemId:diet.id,
      sourceType:'UNIT_MAP_TRANSCRIPTION',sourceRef:'MAPA_UNIDADE_'+map.cycleId,sourceVersion:randomUUID(),prescriberAsRecorded:'Não informado na transcrição',
      prescribedAt:now,fasting:false,allergyCodes,restrictionCodes:restrictions,confirmedAgainstCareInstruction:true,enteredByUid:scope.uid,createdAt:now});
    admission=await db.put(org,'admission',unitId,{...admission,medicalReferenceId:ref.id,fasting:false,allergyCodes},admission.revision);
    await db.appendEvent(org,'admission',admission.id,'dietReference.updated',scope.uid,{referenceId:ref.id,catalogItemId:diet.id,origin:'UNIT_MAP_TRANSCRIPTION'});
   }
  }
  const timing=classifyMealTiming({cycleId:map.cycleId,localDate:map.localDate,at:now});
  const created=[];
  const normalizedObservation=[consistency.replaceAll('_',' ').toLowerCase(),...restrictions.filter(x=>!['NPVO','SNE'].includes(x)).map(x=>x.toLowerCase()),other,comment].filter(Boolean).join(' · ');
  assertHospital(normalizedObservation.length<=180,'INVALID','Restrições/observações excedem 180 caracteres; resuma');
  for(const recipient of [...meals.map(mealType=>({mealType,recipientType:'PATIENT',catalog:diet})),...(companion?[{mealType:'PRIMARY',recipientType:'COMPANION',catalog:companionDiet}]:[])]){
    const keyAdmission=recipient.recipientType==='COMPANION'?admission.id+'_companion':admission.id;
    const existingId=await db.getMealKey(org,keyAdmission,map.localDate,map.cycleId,recipient.mealType);
    assertHospital(!existingId,'CONFLICT','Refeição já cadastrada neste mapa; use a edição ou correção');
    const mealId=stable('meal',org+'|'+keyAdmission+'|'+map.localDate+'|'+map.cycleId+'|'+recipient.mealType);
    const clinicalCodes=recipient.recipientType==='COMPANION'?[...(companionDiet.restrictionCodes??[]),...(companionDiet.allergenCodes??[])]:[...new Set([...(diet.restrictionCodes??[]),...(diet.allergenCodes??[]),...restrictions])];
    const blocked=recipient.recipientType==='PATIENT'&&allergyCodes.some(code=>clinicalCodes.includes(code));
    const meal=await db.put(org,'meal',unitId,{id:mealId,organizationId:org,unitId,mapId,admissionId:admission.id,localDate:map.localDate,cycleId:map.cycleId,
      mealType:recipient.mealType,recipientType:recipient.recipientType,dietCode:recipient.catalog.id,
      consistency:recipient.recipientType==='COMPANION'?'LIVRE':consistency,route:'ORAL',restrictionCodes:recipient.recipientType==='COMPANION'?[]:restrictions,
      allergyNote:recipient.recipientType==='COMPANION'?'':allergy,allergyAlert:recipient.recipientType==='PATIENT'&&!!allergy,
      observation:recipient.recipientType==='COMPANION'?'REFEIÇÃO DO ACOMPANHANTE':normalizedObservation,
      dietRestrictionCodes:clinicalCodes,catalogRevision:recipient.catalog.revision,medicalReferenceId:recipient.recipientType==='COMPANION'?null:ref.id,
      companionAuthorized:recipient.recipientType==='COMPANION'&&companion,
      status:blocked?'SAFETY_BLOCKED':'REQUESTED',requestedAt:now,updatedAt:now,effectiveAt:null,
      advisory:timing.recommendation,timingStage:timing.stage,lateReason:restricted(timing.stage)?reason:null,
      requiresRecheck:blocked,suspensionReason:blocked?'ALLERGY_CONFLICT':null});
    await db.ensureMealUnique(org,keyAdmission,map.localDate,map.cycleId,recipient.mealType,mealId);
    await db.appendEvent(org,'meal',mealId,blocked?'meal.suspended':'meal.requested',scope.uid,{origin:'MAP_QUICK_REGISTRATION',recipientType:recipient.recipientType,timing,allergyAlert:!!meal.allergyAlert});
    created.push(meal);
  }
  const updated=await db.put(org,'map',unitId,{...map,updatedAt:now,
    ...(map.status!=='DRAFT'&&restricted(timing.stage)?{hasLateAmendment:true,latestExtraTimingStage:timing.stage,latestExtraAt:now}:{})},map.revision);
  if(map.status!=='DRAFT'){
    const version=(await db.listMapVersions(org,map.id)).length+1;
    await db.saveMapVersion(org,map.id,version,'AMENDMENT',{map:updated,meals:(await db.list(org,'meal',unitId)).filter(m=>m.mapId===mapId)},reason,scope.uid);
    await db.appendEvent(org,'map',map.id,'map.amended',scope.uid,{version,reason,origin:'MAP_QUICK_REGISTRATION',addedMealIds:created.map(x=>x.id)});
  }
  return {map:updated,patientId:patient.id,admissionId:admission.id,mealIds:created.map(x=>x.id),added:created.length,extra:map.status!=='DRAFT',priority:restricted(timing.stage)};
 }));
}
