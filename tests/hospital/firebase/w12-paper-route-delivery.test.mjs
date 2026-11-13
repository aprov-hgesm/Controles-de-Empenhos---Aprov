import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HospitalFirestoreStore} from '../../../lib/server/hospital/firebase/firestore-store.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalPatientsService} from '../../../lib/server/hospital/patients/firestore-service.mjs';
import {HospitalDietsService} from '../../../lib/server/hospital/diets/firestore-service.mjs';
import {HospitalMapsService} from '../../../lib/server/hospital/maps/firestore-service.mjs';
import {ProductionService} from '../../../lib/server/hospital/production/firestore-service.mjs';
import {DistributionService} from '../../../lib/server/hospital/distribution/firestore-service.mjs';

assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^(127\.0\.0\.1|localhost):\d+$/);
const id=(prefix)=>prefix+'_'+randomUUID().replaceAll('-','').slice(0,16);
const sao=(date)=>new Intl.DateTimeFormat('en-CA',{
 timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
}).format(date);
const saoHour=(date)=>new Intl.DateTimeFormat('pt-BR',{
 timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false
}).format(date);

test('W12 real Emulator: paper observation, kitchen production, patient label and signed route time',async()=>{
 const store=new HospitalFirestoreStore(),org=id('QA_HG'),unit='UTI',kUid=id('kitchen'),uUid=id('ward'),aUid=id('admin');
 try{
  await store.seedOrganization({id:org,ug:'UG_SYNTHETIC',active:true});
  for(const [uid,roles] of [[kUid,['KITCHEN']],[uUid,['UNIT']],[aUid,['HOSPITAL_ADMIN']]])
   await store.seedMembership({id:'m_'+uid,uid,organizationId:org,ug:'UG_SYNTHETIC',active:true,roles,unitIds:[unit]});
  const scope=async uid=>resolveHospitalScope({authorization:'Bearer '+uid,organizationId:org,store,
   verifyToken:async(token)=>({uid:token})});
  const u=await scope(uUid),k=await scope(kUid),a=await scope(aUid);
  await store.transaction(async db=>{
   const row=await db.put(org,'unit',unit,{id:unit,organizationId:org,unitId:unit,code:unit,name:'UTI FICTICIA',type:'CARE',active:true},0);
   await db.saveOrgUnit(org,row);
  });
  const patients=new HospitalPatientsService(store),diets=new HospitalDietsService(store),
   maps=new HospitalMapsService(store),production=new ProductionService(store),distribution=new DistributionService(store);
  const bed=await patients.saveBed(a,{unitId:unit,bedId:id('bed'),label:'01'});
  const patient=await patients.registerPatient(u,{unitId:unit,displayName:'Pessoa Sintetica Teste',birthDate:'1990-02-03'});
  assert.match(patient.referenceCode,/^LOCAL_/);
  const adm=await patients.admit(u,{unitId:unit,patientId:patient.id,bedId:bed.id});
  const diet=await diets.saveCatalog(a,{catalogItemId:id('DIET'),code:id('DIETCODE'),label:'Dieta leve ficticia',
    type:'ORAL',consistency:'NORMAL',route:'ORAL',restrictionCodes:[],allergenCodes:[],status:'ACTIVE',expectedRevision:0});
  const ref=(await diets.recordReference(u,{unitId:unit,admissionId:adm.id,referenceId:id('ref'),catalogItemId:diet.id,
    sourceRef:'PAPEL_TESTE',sourceVersion:'1',prescriberAsRecorded:'Ficticio',
    prescribedAt:new Date().toISOString(),fasting:false,allergyCodes:[],restrictionCodes:[]})).reference;
  const localDate=sao(new Date()),draft=await maps.createDraft(u,{unitId:unit,localDate,cycleId:'16'});
  const added=await maps.setMeal(u,{mapId:draft.id,admissionId:adm.id,mealType:'SECONDARY',
   medicalReferenceId:ref.id,dietCode:diet.id,observation:'Sem acucar',
   expectedMapRevision:draft.revision,idempotencyKey:id('meal'),reason:'QA ficticia'});
  assert.equal(added.meal.observation,'Sem acucar');
  const sent=await maps.submitMap(u,{mapId:draft.id,expectedRevision:added.map.revision,
   idempotencyKey:id('submit'),lateReason:'QA ficticia'});
  assert.equal(sent.map.status,'SUBMITTED');
  const receipt=await maps.receiveMap(k,{mapId:draft.id,expectedRevision:sent.map.revision,idempotencyKey:id('receive')});
  assert.ok(receipt.map.receivedAt);
  await assert.rejects(maps.receiveMap(u,{mapId:draft.id,expectedRevision:receipt.map.revision,idempotencyKey:id('wrong')}),{code:'FORBIDDEN'});
  const snapshot=await production.snapshot(k,{unitIds:[unit],localDate,cycleId:'16'});
  assert.equal(snapshot.meals[0].observation,'Sem acucar');
  assert.equal(snapshot.meals[0].bedNumber,'01');
  const batch=await production.createBatch(k,{unitId:unit,localDate,cycleId:'16',
   mealIds:[added.meal.id],preparationLabel:'Dieta leve ficticia - sem acucar',idempotencyKey:id('batch')});
  const started=await production.startBatch(k,{unitId:unit,batchId:batch.id,
   expectedRevision:batch.revision,idempotencyKey:id('start')});
  const ready=await production.completeBatch(k,{unitId:unit,batchId:batch.id,
   expectedRevision:started.revision,confirmedQuantity:1,idempotencyKey:id('complete')});
  assert.equal(ready.status,'COMPLETE');
  const cmd=(op,body)=>distribution.command(k,op,{unitId:unit,mealId:added.meal.id,
   idempotencyKey:id('dist'),...body});
  await cmd('assembly.start',{});
  await cmd('assembly.complete',{preparedDietCode:diet.id,ingredientCodes:['ARROZ']});
  await cmd('assembly.check',{});
  await cmd('batch.dispatch',{mealIds:[added.meal.id]});
  const deliveryTime=saoHour(new Date());
  await assert.rejects(cmd('meal.deliver.paper',{deliveryTime,paperConfirmed:false,identityChecked:true}),{code:'PRECONDITION'});
  await assert.rejects(cmd('meal.deliver.paper',{deliveryTime:'25:99',paperConfirmed:true,identityChecked:true}),{code:'INVALID'});
  await assert.rejects(distribution.command(u,'meal.deliver.paper',{unitId:unit,mealId:added.meal.id,
   deliveryTime,paperConfirmed:true,identityChecked:true,idempotencyKey:id('forbidden')}),{code:'FORBIDDEN'});
  const registered=await cmd('meal.deliver.paper',{deliveryTime,paperConfirmed:true,identityChecked:true});
  assert.equal(registered.meal.status,'DELIVERED');
  assert.equal(registered.job.state,'DELIVERED');
  assert.equal(registered.event.type,'DELIVERED');
  assert.equal(registered.event.effectiveAt,registered.meal.deliveredAt);
  assert.equal(registered.event.actorUid,k.uid);
  assert.equal(registered.event.occurredAt!==null,true);
  const finalStatus=await distribution.status(k,{unitId:unit,mealId:added.meal.id});
  assert.equal(finalStatus.mealStatus,'DELIVERED');
  assert.ok(finalStatus.deliveredAt);
  await assert.rejects(cmd('meal.deliver.paper',{deliveryTime,paperConfirmed:true,identityChecked:true}),{code:'PRECONDITION'});

  // Distinct meals from the same 06h map, submitted after the primary's 30-minute limit.
  // A late main meal must be recorded and visible, never silently authorized.
  const overdueDate=sao(new Date(Date.now()-86400000));
  const overdueMap=await maps.createDraft(u,{unitId:unit,localDate:overdueDate,cycleId:'06'});
  const overdueMain=await maps.setMeal(u,{mapId:overdueMap.id,admissionId:adm.id,mealType:'PRIMARY',
   medicalReferenceId:ref.id,dietCode:diet.id,observation:'Dieta principal ficticia',
   expectedMapRevision:overdueMap.revision,idempotencyKey:id('late_main'),
   reason:'Solicitação principal registrada após a tolerância para avaliação'});
  assert.equal(overdueMain.meal.status,'SUSPENDED');
  assert.equal(overdueMain.meal.timingStage,'AFTER_TOLERANCE');
  assert.equal(overdueMain.requiresAssistanceEscalation,true);
  assert.equal(overdueMain.meal.suspensionReason,'LATE_PRIMARY_AFTER_TOLERANCE_ASSISTANCE');
  const overdueSnack=await maps.setMeal(u,{mapId:overdueMap.id,admissionId:adm.id,mealType:'SECONDARY',
   medicalReferenceId:ref.id,dietCode:diet.id,observation:'Lanche ficticio',
   expectedMapRevision:overdueMain.map.revision,idempotencyKey:id('late_snack'),
   reason:'Refeição secundária fora do horário com cozinha comunicada'});
  assert.equal(overdueSnack.meal.status,'REQUESTED');
  assert.equal(overdueSnack.meal.timingStage,'AFTER_TOLERANCE');
  assert.notEqual(overdueSnack.meal.id,overdueMain.meal.id);
  const sentOverdue=await maps.submitMap(u,{mapId:overdueMap.id,expectedRevision:overdueSnack.map.revision,
   idempotencyKey:id('late_submit'),lateReason:'Mapa atrasado de teste para comunicação assistencial'});
  assert.equal(sentOverdue.map.late,true);
  assert.equal(sentOverdue.map.submissionTimingStage,'AFTER_TOLERANCE');
  const verify=await maps.getMap(u,{mapId:overdueMap.id});
  assert.equal(verify.meals.filter(x=>x.mealType==='PRIMARY').length,1);
  assert.equal(verify.meals.filter(x=>x.mealType==='SECONDARY').length,1);
  assert.equal(verify.meals.find(x=>x.mealType==='PRIMARY').status,'SUSPENDED');
  await assert.rejects(production.createBatch(k,{unitId:unit,localDate:overdueDate,cycleId:'06',
   mealIds:[overdueMain.meal.id],preparationLabel:'Ficticio indevido',idempotencyKey:id('blocked_batch')}),{code:'PRECONDITION'});
 }finally{store.close()}
});
