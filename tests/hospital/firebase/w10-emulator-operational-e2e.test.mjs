import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HospitalFirestoreStore} from '../../../lib/server/hospital/firebase/firestore-store.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalPatientsService} from '../../../lib/server/hospital/patients/firestore-service.mjs';
import {HospitalDietsService} from '../../../lib/server/hospital/diets/firestore-service.mjs';
import {HospitalMapsService} from '../../../lib/server/hospital/maps/firestore-service.mjs';
import {ProductionService} from '../../../lib/server/hospital/production/firestore-service.mjs';
import {DistributionService} from '../../../lib/server/hospital/distribution/firestore-service.mjs';
import {NutritionAuditService} from '../../../lib/server/hospital/nutrition-audit/firestore-service.mjs';
import {HospitalAdministrationService} from '../../../lib/server/hospital/administration/firestore-service.mjs';
import {HospitalReportingService} from '../../../lib/server/hospital/reporting/firestore-service.mjs';

process.env.HOSPITAL_FIRESTORE_QA_ENABLED='1';
assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^127\.0\.0\.1:\d+$/);
const day=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
 year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
const uid=prefix=>prefix+'_'+randomUUID().replaceAll('-','').slice(0,16);

test('W10 EMULATOR: three maps, medical diet, patient, production, custody, nutrition, reporting and transfer',async()=>{
 const store=new HospitalFirestoreStore();
 const org=uid('QA_HGE'),otherOrg=uid('QA_OTHER'),unit='UTI',nextUnit='UPI';
 const person=uid('qa_unit'),admin=uid('qa_admin'),kitchen=uid('qa_kitchen'),nutrition=uid('qa_nutrition');
 try{
  await store.seedOrganization({id:org,ug:'UG_QA_001',active:true});
  await store.seedOrganization({id:otherOrg,ug:'UG_QA_002',active:true});
  for(const [id,roles,unitIds] of [
   [person,['UNIT'],[unit,nextUnit]],
   [admin,['HOSPITAL_ADMIN'],[unit,nextUnit]],
   [kitchen,['KITCHEN'],[unit]],
   [nutrition,['NUTRITION'],[unit]],
  ]) await store.seedMembership({id:'membership_'+id,uid:id,organizationId:org,ug:'UG_QA_001',
    active:true,roles,unitIds});
  const scope=async id=>resolveHospitalScope({
    authorization:'Bearer '+id,organizationId:org,store,verifyToken:async token=>({uid:token})
  });
  const sUnit=await scope(person),sAdmin=await scope(admin),sKitchen=await scope(kitchen),
    sNutrition=await scope(nutrition);
  assert.throws(()=>requireHospitalPermission(sNutrition,'map:write',unit),{code:'FORBIDDEN'});
  await assert.rejects(resolveHospitalScope({authorization:'Bearer '+person,organizationId:otherOrg,store,
   verifyToken:async token=>({uid:token})}),{code:'FORBIDDEN'});

  const patients=new HospitalPatientsService(store),diets=new HospitalDietsService(store),
    maps=new HospitalMapsService(store),production=new ProductionService(store),
    distribution=new DistributionService(store),nut=new NutritionAuditService(store),
    adminService=new HospitalAdministrationService(store),report=new HospitalReportingService(store);

  await store.transaction(async db=>{
    for(const [unitId,type] of [[unit,'CARE'],[nextUnit,'CARE']]){
      const row=await db.put(org,'unit',unitId,{id:unitId,organizationId:org,unitId,
        code:unitId,name:'FICTITIOUS '+unitId,type,active:true},0);
      await db.saveOrgUnit(org,row);
    }
  });
  const bed=await patients.saveBed(sAdmin,{unitId:unit,bedId:'BED_QA_1',label:'Leito ficcional'});
  assert.equal(bed.revision,1);
  const patient=await patients.registerPatient(sUnit,{unitId:unit,referenceCode:uid('PT').toUpperCase(),
    displayName:'Pessoa Sintética Não Real'});
  const admission=await patients.admit(sUnit,{patientId:patient.id,unitId:unit,bedId:bed.id});
  assert.equal((await patients.getAdmission(sUnit,{unitId:unit,admissionId:admission.id})).patient.id,patient.id);
  await assert.rejects(patients.admit(sUnit,{patientId:patient.id,unitId:unit}),{code:'CONFLICT'});
  const catalog=await diets.saveCatalog(sAdmin,{catalogItemId:'DIET_QA',code:'DIET_QA',label:'Dieta sintética',
   type:'ORAL',consistency:'NORMAL',route:'ORAL',restrictionCodes:[],allergenCodes:[],status:'ACTIVE',expectedRevision:0});
  assert.equal(catalog.revision,1);
  const reference=await diets.recordReference(sUnit,{
   unitId:unit,admissionId:admission.id,referenceId:uid('REF'),catalogItemId:catalog.id,
   sourceRef:'REF_MED_SINTETICA',sourceVersion:'1',prescriberAsRecorded:'Médico Teste Fictício',
   prescribedAt:new Date().toISOString(),fasting:false,allergyCodes:[],restrictionCodes:[]
  });
  assert.equal(reference.reference.revision,1);

  const targetDate=day(2);
  const draft06=await maps.createDraft(sUnit,{unitId:unit,localDate:targetDate,cycleId:'06'});
  const submitted06=await maps.submitMap(sUnit,{mapId:draft06.id,expectedRevision:draft06.revision,
    idempotencyKey:uid('submit06')});
  assert.equal(submitted06.receipt.status,'SUBMITTED');
  const draft10=await maps.createDraft(sUnit,{unitId:unit,localDate:targetDate,cycleId:'10'});
  const created=await maps.setMeal(sUnit,{mapId:draft10.id,admissionId:admission.id,mealType:'PRIMARY',
   medicalReferenceId:reference.reference.id,dietCode:catalog.id,expectedMapRevision:draft10.revision,
   idempotencyKey:'qa_meal_'+randomUUID().replaceAll('-','')});
  const request=created.meal;
  assert.equal(request.status,'REQUESTED');
  const sub10=await maps.submitMap(sUnit,{mapId:draft10.id,expectedRevision:created.map.revision,
    idempotencyKey:uid('submit10')});
  assert.equal(sub10.receipt.submissionVersion,1);
  const original=JSON.stringify((await maps.listVersions(sUnit,{mapId:draft10.id}))[0].snapshot);
  const draft16=await maps.createDraft(sUnit,{unitId:unit,localDate:targetDate,cycleId:'16'});
  await maps.submitMap(sUnit,{mapId:draft16.id,expectedRevision:draft16.revision,idempotencyKey:uid('submit16')});
  const list=await maps.listMaps(sUnit,{unitId:unit,localDate:targetDate});
  assert.deepEqual(new Set(list.map(x=>x.cycleId)),new Set(['06','10','16']));
  const queue=await maps.listKitchenQueue(sKitchen,{unitId:unit,localDate:targetDate,cycleId:'10'});
  assert.equal(queue.length,1);

  const snap=await production.snapshot(sKitchen,{unitIds:[unit],localDate:targetDate,cycleId:'10'});
  assert.equal(snap.meals.length,1);
  const batch=await production.createBatch(sKitchen,{unitId:unit,localDate:targetDate,cycleId:'10',
    mealIds:[request.id],preparationLabel:'Preparação fictícia',idempotencyKey:uid('batch')});
  assert.equal(batch.status,'PENDING');
  const started=await production.startBatch(sKitchen,{unitId:unit,batchId:batch.id,
    expectedRevision:batch.revision,idempotencyKey:uid('start')});
  assert.equal(started.status,'IN_PROGRESS');
  const completed=await production.completeBatch(sKitchen,{unitId:unit,batchId:batch.id,
    expectedRevision:started.revision,confirmedQuantity:1,idempotencyKey:uid('complete')});
  assert.equal(completed.status,'COMPLETE');
  const command=async (scope,operation,props)=>distribution.command(scope,operation,{
    unitId:unit,mealId:request.id,idempotencyKey:uid('op'),...props
  });
  const job=await command(sKitchen,'assembly.start',{});
  assert.equal(job.state,'ASSEMBLING');
  await command(sKitchen,'assembly.complete',{preparedDietCode:'DIET_QA',ingredientCodes:['RICE_QA']});
  await command(sKitchen,'assembly.check',{});
  const dispatch=await command(sKitchen,'batch.dispatch',{mealIds:[request.id],batchId:batch.id});
  assert.equal(dispatch[0].meal.status,'DISPATCHED');
  const received=await command(sUnit,'batch.receive',{mealIds:[request.id],batchId:batch.id});
  assert.equal(received[0].meal.status,'RECEIVED_BY_UNIT');
  const delivered=await command(sKitchen,'meal.deliver',{
    patientReferenceCode:patient.referenceCode,patientDisplayName:patient.displayName,identityMethod:'MANUAL'
  });
  assert.equal(delivered.meal.status,'DELIVERED');
  await assert.rejects(command(sKitchen,'meal.deliver',{
    patientReferenceCode:patient.referenceCode,patientDisplayName:patient.displayName,identityMethod:'MANUAL'
  }),{code:'PRECONDITION'});
  const audit=await nut.createFinding(sNutrition,{unitId:unit,admissionId:admission.id,
    category:'DOCUMENTATION',risk:'LOW',evidence:'Registro inteiramente sintético',
    recommendation:'Conferir documentação de QA',idempotencyKey:uid('audit')});
  assert.equal(audit.status,'IDENTIFIED');
  const closed=await nut.transitionFinding(sNutrition,{unitId:unit,findingId:audit.id,next:'CLOSED',
    reason:'Achado simulado encerrado',expectedRevision:audit.revision});
  assert.equal(closed.status,'CLOSED');
  const reportData=await report.query(sKitchen,{view:'production',
    filters:{from:targetDate,to:targetDate,unitId:unit},page:1,pageSize:30});
  assert.equal(reportData.partial,false);
  assert.equal(reportData.summary.delivered,1);
  assert.equal(reportData.source,'W10_FIRESTORE_QA_EMULATOR');
  assert.equal(JSON.stringify((await maps.listVersions(sUnit,{mapId:draft10.id}))[0].snapshot),original);

  const transfer=await patients.planTransfer(sUnit,{unitId:unit,admissionId:admission.id,toUnitId:nextUnit});
  const outcome=await patients.confirmTransfer(sUnit,{unitId:unit,eventId:transfer.id,
    expectedRevision:transfer.revision,admissionRevision:(await patients.getAdmission(sUnit,{unitId:unit,admissionId:admission.id})).admission.revision});
  assert.equal(outcome.admission.unitId,nextUnit);
  assert.equal(await store.getMealKey(org,admission.id,targetDate,'10','PRIMARY'),request.id);
  const overview=await adminService.listUnits(sAdmin);
  assert.ok(overview.some(x=>x.id===unit));

  await store.transaction(async db=>{
    const old=await db.findMembership(org,person);
    await db.saveMembership(org,{...old,active:false},old.revision??0);
  });
  await assert.rejects(scope(person),{code:'FORBIDDEN'});
 }finally{store.close()}
});
