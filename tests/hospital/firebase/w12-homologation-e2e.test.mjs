import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HospitalFirestoreStore} from '../../../lib/server/hospital/firebase/firestore-store.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalPatientsService} from '../../../lib/server/hospital/patients/firestore-service.mjs';
import {HospitalDietsService} from '../../../lib/server/hospital/diets/firestore-service.mjs';
import {HospitalMapsService} from '../../../lib/server/hospital/maps/firestore-service.mjs';
import {ProductionService} from '../../../lib/server/hospital/production/firestore-service.mjs';
import {NutritionAuditService} from '../../../lib/server/hospital/nutrition-audit/firestore-service.mjs';
import {HospitalReportingService} from '../../../lib/server/hospital/reporting/firestore-service.mjs';
import {classifyMealTiming,CYCLES} from '../../../features/hospital/core/domain.mjs';

// Deliberately exercise native Firestore/Auth emulator, not a memory mock or real patient data.
assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^(?:127\.0\.0\.1|localhost):\d+$/);
assert.equal(process.env.HOSPITAL_FIRESTORE_QA_ENABLED,'1');
const unique=(type)=>type+'_'+randomUUID().replaceAll('-','').slice(0,16);
const localDay=(offset)=>new Intl.DateTimeFormat('en-CA',{
 timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date(Date.now()+offset*86_400_000));

test('W12 E2E native Firestore: five care units, role guards, two OMs, retries, clinical safety, immutable audit and reporting',async()=>{
 const store=new HospitalFirestoreStore(),org=unique('qa_hge'),another=unique('qa_other');
 const units=['UTI','UPI','PAM','ONCOLOGIA','BLOCO'];
 const users=Object.fromEntries(['UTI','UPI','PAM','ONCOLOGIA','BLOCO','KITCHEN','NUTRITION','ADMIN','COMMERCIAL'].map(k=>[k,unique('qa_'+k)]));
 try {
  await store.seedOrganization({id:org,ug:'UG_SYNTHETIC_01',active:true});
  await store.seedOrganization({id:another,ug:'UG_SYNTHETIC_02',active:true});
  for(const [role,uid] of Object.entries(users)){
   await store.seedMembership({id:'membership_'+uid,uid,organizationId:org,ug:'UG_SYNTHETIC_01',
    active:true,roles:role==='KITCHEN'?['KITCHEN']:role==='NUTRITION'?['NUTRITION']:
      role==='ADMIN'?['HOSPITAL_ADMIN']:role==='COMMERCIAL'?['COMMERCIAL']:['UNIT'],
    unitIds:['KITCHEN','NUTRITION','ADMIN'].includes(role)?units:role==='COMMERCIAL'?[]:[role]});
  }
  const scope=uid=>resolveHospitalScope({
   authorization:'Bearer '+uid,organizationId:org,store,
   verifyToken:async token=>({uid:token})
  });
  const s={};
  for(const [role,uid] of Object.entries(users)){
   if(role==='COMMERCIAL'){await assert.rejects(scope(uid),{code:'FORBIDDEN'});continue;}
   s[role]=await scope(uid);
  }
  for(const unit of units){
   requireHospitalPermission(s[unit],'patient:write',unit);
   assert.throws(()=>requireHospitalPermission(s[unit],'patient:read',units.find(u=>u!==unit)),{code:'FORBIDDEN'});
   assert.throws(()=>requireHospitalPermission(s[unit],'meal:production',unit),{code:'FORBIDDEN'});
  }
  assert.throws(()=>requireHospitalPermission(s.NUTRITION,'map:write','UTI'),{code:'FORBIDDEN'});
  assert.throws(()=>requireHospitalPermission(s.ADMIN,'patient:read','UTI'),{code:'FORBIDDEN'});
  assert.throws(()=>requireHospitalPermission({...s.UTI},'patient:read','UTI'),{code:'UNAUTHORIZED'});
  await assert.rejects(resolveHospitalScope({
    authorization:'Bearer '+users.UTI,organizationId:another,store,verifyToken:async token=>({uid:token})
  }),{code:'FORBIDDEN'});
  await assert.rejects(resolveHospitalScope({
    authorization:'Bearer revoked',organizationId:org,store,
    verifyToken:async()=>{throw Error('revoked')}
  }),{code:'UNAUTHORIZED'});
  
  const patients=new HospitalPatientsService(store),diets=new HospitalDietsService(store),
   maps=new HospitalMapsService(store),production=new ProductionService(store),
   nutrition=new NutritionAuditService(store),reports=new HospitalReportingService(store);
  await store.transaction(async db=>{
   for(const unitId of units){
    const row=await db.put(org,'unit',unitId,{id:unitId,organizationId:org,
      unitId,code:unitId,name:'Fictitious '+unitId,type:'CARE',active:true},0);
    await db.saveOrgUnit(org,row);
   }
  });
  const bed=await patients.saveBed(s.ADMIN,{unitId:'UTI',bedId:'BED_SYNTHETIC',label:'QA only'});
  const patient=await patients.registerPatient(s.UTI,{unitId:'UTI',
    referenceCode:unique('PATIENT').toUpperCase(),displayName:'Paciente Teste Sintético'});
  const admission=await patients.admit(s.UTI,{unitId:'UTI',patientId:patient.id,bedId:bed.id});
  await assert.rejects(patients.getAdmission(s.UPI,{unitId:'UPI',admissionId:admission.id}),
    {code:'NOT_FOUND'});
  const diet=await diets.saveCatalog(s.ADMIN,{catalogItemId:'DIET_W12',code:'DIET_W12',
    label:'Dieta sintética W12',type:'ORAL',consistency:'NORMAL',route:'ORAL',
    restrictionCodes:[],allergenCodes:[],status:'ACTIVE',expectedRevision:0});
  const medical=async(fasting,version)=>diets.recordReference(s.UTI,{
    unitId:'UTI',admissionId:admission.id,referenceId:unique('REF'),catalogItemId:diet.id,
    sourceRef:'FICTITIOUS_MEDICAL_ORDER',sourceVersion:String(version),
    prescriberAsRecorded:'Médico Fictício',prescribedAt:new Date().toISOString(),
    fasting,allergyCodes:[],restrictionCodes:[]
  });
  const ref=(await medical(false,1)).reference;
  const localDate=localDay(3);
  for(const cycle of ['06','10','16']){
   const draft=await maps.createDraft(s.UTI,{unitId:'UTI',localDate,cycleId:cycle});
   if(cycle!=='10'){
    const result=await maps.submitMap(s.UTI,{mapId:draft.id,expectedRevision:draft.revision,
      idempotencyKey:unique('submit')});
    assert.equal(result.receipt.status,'SUBMITTED');
    continue;
   }
   const p=await maps.setMeal(s.UTI,{mapId:draft.id,admissionId:admission.id,
     mealType:'PRIMARY',medicalReferenceId:ref.id,dietCode:diet.id,
     expectedMapRevision:draft.revision,idempotencyKey:unique('meal')});
   const q=await maps.setMeal(s.UTI,{mapId:draft.id,admissionId:admission.id,
     mealType:'SECONDARY',medicalReferenceId:ref.id,dietCode:diet.id,
     expectedMapRevision:p.map.revision,idempotencyKey:unique('meal')});
   assert.equal(p.meal.status,'REQUESTED');
   assert.equal(q.meal.status,'REQUESTED');
   const keyA=unique('submit'),keyB=unique('submit');
   const args={mapId:draft.id,expectedRevision:q.map.revision};
   const attempts=await Promise.allSettled([
     maps.submitMap(s.UTI,{...args,idempotencyKey:keyA}),
     maps.submitMap(s.UTI,{...args,idempotencyKey:keyB})
   ]);
   const won=attempts.filter(r=>r.status==='fulfilled');
   assert.equal(won.length,1,'duas abas não podem registrar dois envios');
   const receipt=won[0].value;
   const winnerKey=attempts[0].status==='fulfilled'?keyA:keyB;
   assert.deepEqual(await maps.submitMap(s.UTI,{...args,idempotencyKey:winnerKey}),receipt,
    'retry pós-timeout retorna exatamente a resposta original');
   await assert.rejects(maps.submitMap(s.UTI,{...args,idempotencyKey:winnerKey,lateReason:'Outra solicitação'}),
    {code:'CONFLICT'});
   const original=JSON.stringify((await maps.listVersions(s.UTI,{mapId:draft.id}))[0].snapshot);
   assert.equal((await maps.receipt(s.UTI,{mapId:draft.id})).submissionVersion,1);
   await medical(true,2);
   const held=await store.get(org,'meal',p.meal.id);
   assert.equal(held.status,'SAFETY_BLOCKED','nova prescrição de jejum nunca libera refeição preparada');
   await assert.rejects(production.createBatch(s.KITCHEN,{unitId:'UTI',localDate,cycleId:'10',
     mealIds:[p.meal.id],preparationLabel:'Fictitious',idempotencyKey:unique('batch')}),
     {code:'PRECONDITION'});
   assert.equal(JSON.stringify((await maps.listVersions(s.UTI,{mapId:draft.id}))[0].snapshot),original,
    'snapshot original permanece imutável após mudança da dieta');
   assert.ok((await maps.listVersions(s.UTI,{mapId:draft.id})).length>=2,
    'alteração clínica deixa adendo imutável');
   const finding=await nutrition.createFinding(s.NUTRITION,{unitId:'UTI',
     admissionId:admission.id,category:'DOCUMENTATION',risk:'LOW',
     evidence:'Evidência exclusivamente sintética',recommendation:'Verificação QA',
     idempotencyKey:unique('finding')});
   assert.equal(finding.status,'IDENTIFIED');
   const out=await reports.query(s.KITCHEN,{view:'production',filters:{
     from:localDate,to:localDate,unitId:'UTI',cycleId:'10'},page:1,pageSize:1});
   assert.equal(out.source,'W10_FIRESTORE_QA_EMULATOR');
   assert.equal(out.partial,false);
   assert.equal(out.summary.delivered,0,'expedição não comprova entrega');
   assert.equal(out.summary.planned,2);
   assert.equal(out.total,2,'duas modalidades de refeição aparecem na reconciliação');
   await assert.rejects(reports.query(s.KITCHEN,{view:'production',filters:{
     from:localDate,to:localDate,unitId:'UTI',organizationId:another}}),{code:'FORBIDDEN'});
   await assert.rejects(reports.query(s.KITCHEN,{view:'production',filters:{
     from:localDate,to:localDate,unitId:'UPI'}}),{code:'FORBIDDEN'});
  }
  const revoked=await store.findMembership(org,users.UTI);
  await store.transaction(db=>db.saveMembership(org,{...revoked,active:false},revoked.revision??0));
  await assert.rejects(scope(users.UTI),{code:'FORBIDDEN'});
 }finally{store.close();}
});

test('W12 06/10/16 Sao Paulo clocks keep sending deadline separate from delivery tolerance',()=>{
 for(const [cycle,hour] of [['06','06'],['10','10'],['16','16']]){
  assert.equal(CYCLES[cycle].mapDue,hour+':00');
  assert.equal(CYCLES[cycle].primaryTolerance,hour+':30');
  const date='2026-11-18';
  for(const [minutes,stage] of [['00','ON_TIME'],['01','LATE_BEFORE_TOLERANCE'],
   ['30','LATE_BEFORE_TOLERANCE'],['31','AFTER_TOLERANCE']]){
   const timing=classifyMealTiming({cycleId:cycle,localDate:date,
    at:date+'T'+hour+':'+minutes+':00-03:00',mealType:'PRIMARY'});
   assert.equal(timing.stage,stage);
   assert.equal(timing.mapOnTime,minutes==='00');
  }
 }
});

test('W12 Firestore outage fails closed without PHI cache or SQLite fallback',async()=>{
 const failing=new HospitalFirestoreStore({
   fetchImpl:async()=>{throw Error('synthetic network unavailable');}
 });
 await assert.rejects(failing.findOrganization('QA_OUTAGE'),{code:'UNAVAILABLE',
   message:'Firestore hospitalar indisponível'});
 assert.equal(failing.transport,'emulator');
});
