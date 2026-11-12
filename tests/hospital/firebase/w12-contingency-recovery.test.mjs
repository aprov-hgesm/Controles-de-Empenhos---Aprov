import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {HospitalFirestoreStore} from '../../../lib/server/hospital/firebase/firestore-store.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalPatientsService} from '../../../lib/server/hospital/patients/firestore-service.mjs';
import {HospitalContingencyService} from '../../../lib/server/hospital/contingency/firestore-service.mjs';
import {createHospitalContingencyHandler} from '../../../lib/server/hospital/contingency/firestore-handler.mjs';

assert.equal(process.env.HOSPITAL_FIRESTORE_QA_ENABLED,'1');
assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^127\.0\.0\.1:\d+$/);
const uuid=label=>label+'_'+randomUUID().replaceAll('-','').slice(0,12);
const instant=()=>new Date(Date.now()-60_000).toISOString();

async function fixture(store){
 const org=uuid('qa_w12'),other=uuid('qa_other'),nurse=uuid('qa_nurse'),rogue=uuid('qa_wrong');
 await store.seedOrganization({id:org,ug:'UG_QA',active:true});
 await store.seedOrganization({id:other,ug:'UG_OTHER',active:true});
 await store.seedMembership({id:uuid('membership'),uid:nurse,organizationId:org,
  ug:'UG_QA',active:true,roles:['UNIT'],unitIds:['UTI']});
 const scope=async(orgId=org,uid=nurse)=>resolveHospitalScope({
  authorization:'Bearer '+uid,organizationId:orgId,store,
  verifyToken:async token=>({uid:token})
 });
 const patientService=new HospitalPatientsService(store),s=await scope();
 const patient=await patientService.registerPatient(s,{unitId:'UTI',
  referenceCode:uuid('SYNTHETIC').toUpperCase(),displayName:'Paciente Fictício W12'});
 const admission=await patientService.admit(s,{patientId:patient.id,unitId:'UTI'});
 return {org,other,nurse,rogue,scope,s,admission};
}

test('W12 real emulator: paper downtime entry is append-only and never auto-confirms delivery',async()=>{
 const store=new HospitalFirestoreStore();
 const {org,other,scope,s,admission}=await fixture(store);
 const service=new HospitalContingencyService(store),externalRecordRef=uuid('QA_FORM');
 const input={unitId:'UTI',admissionId:admission.id,externalRecordRef,
  stage:'DELIVERY_REPORTED',reasonCode:'SYSTEM_OUTAGE',identifiersChecked:true,
  effectiveAt:instant()};
 const result=await service.registerExternalRecord(s,input);
 assert.equal(result.status,'PENDING_INSTITUTIONAL_REVIEW');
 assert.equal(result.deliveryConfirmedBySystem,false);
 assert.ok(Date.parse(result.recordedAt)>=Date.parse(result.claimedEffectiveAt));
 assert.deepEqual(await service.registerExternalRecord(s,input),result,
  'replay returns the exact persisted response without additional incident');
 await assert.rejects(service.registerExternalRecord(s,{...input,reasonCode:'OTHER'}),{code:'CONFLICT'});
 await assert.rejects(service.registerExternalRecord(s,{...input,externalRecordRef:uuid('QA_NEW'),
  identifiersChecked:false}),{code:'PRECONDITION'});
 await assert.rejects(service.registerExternalRecord(s,{...input,externalRecordRef:uuid('QA_NEW'),
  effectiveAt:new Date(Date.now()+3600_000).toISOString()}),{code:'INVALID'});
 await assert.rejects(service.registerExternalRecord(s,{...input,externalRecordRef:'PATIENT_NAME'}),{code:'INVALID'});
 await assert.rejects(service.registerExternalRecord({...s},input),{code:'UNAUTHORIZED'});
 await assert.rejects(scope(other),{code:'FORBIDDEN'});
 assert.throws(()=>requireHospitalPermission(s,'incident:write','UPI'),{code:'FORBIDDEN'});
 const row=await store.get(org,'incident',result.incidentId);
 assert.equal(row.status,'PENDING_INSTITUTIONAL_REVIEW');
 assert.equal(row.claimedEffectiveAt,result.claimedEffectiveAt);
 assert.ok(!('patientName' in row));
 const events=await store.events(org,'incident',result.incidentId);
 assert.equal(events.length,1);
 assert.equal(events[0].effectiveAt,result.claimedEffectiveAt);
 assert.ok(Date.parse(events[0].occurredAt)>Date.parse(events[0].effectiveAt),
  'server-recorded clock is independent of declared physical time');
 assert.equal((await store.list(org,'delivery_event','UTI')).length,0,
  'paper claim must never create an actual delivery event');
 assert.equal((await store.list(org,'incident','UTI')).length,1);
 assert.equal((await store.list(other,'incident','UTI')).length,0);
 const handler=createHospitalContingencyHandler({store,verifyToken:async token=>({uid:token})});
 const forbidden=await handler({authorization:'Bearer '+s.uid,organizationId:other,
  operation:'downtime.record',payload:input});
 assert.equal(forbidden.status,403);
 const bad=await handler({authorization:'',organizationId:org,
  operation:'downtime.record',payload:input});
 assert.equal(bad.status,401);
 const good=await handler({authorization:'Bearer '+s.uid,organizationId:org,
  operation:'downtime.record',payload:input});
 assert.equal(good.status,200);
 assert.deepEqual(good.body.data,result);
});

test('W12 real emulator: lost response after successful Firestore commit can be safely replayed',async()=>{
 const setup=new HospitalFirestoreStore(),{org,s,admission}=await fixture(setup);
 const input={unitId:'UTI',admissionId:admission.id,externalRecordRef:uuid('QA_TIMEOUT'),
  stage:'REQUESTED_EXTERNALLY',reasonCode:'NETWORK_OUTAGE',effectiveAt:instant()};
 let lost=false;
 const flaky=new HospitalFirestoreStore({fetchImpl:async(url,options)=>{
   const response=await fetch(url,options);
   if(!lost&&url.endsWith(':commit')&&response.ok){lost=true;throw Error('synthetic network drop after commit');}
   return response;
 }});
 await assert.rejects(new HospitalContingencyService(flaky).registerExternalRecord(s,input),
  {code:'UNAVAILABLE'});
 assert.equal(lost,true,'network drop injected AFTER commit');
 const stored=await new HospitalContingencyService(setup).registerExternalRecord(s,input);
 assert.equal(stored.deliveryConfirmedBySystem,false);
 const rows=await setup.list(org,'incident','UTI');
 assert.equal(rows.length,1);
 assert.equal((await setup.events(org,'incident',stored.incidentId)).length,1);
 assert.equal((await setup.list(org,'delivery_event','UTI')).length,0);
});

test('W12 emulator-only controlled load reports read p95 without PHI and no cross-tenant leakage',async()=>{
 const store=new HospitalFirestoreStore(),{org,other,nurse}=await fixture(store);
 const times=[],samples=40,parallel=5;
 for(let offset=0;offset<samples;offset+=parallel){
  await Promise.all(Array.from({length:parallel},async()=>{
   const start=performance.now();
   const member=await store.findMembership(org,nurse);
   assert.equal(member.uid,nurse);
   assert.equal(await store.findMembership(other,nurse),null);
   times.push(performance.now()-start);
  }));
 }
 times.sort((a,b)=>a-b);
 const p95=Number(times[Math.ceil(times.length*0.95)-1].toFixed(2));
 const summary={environment:'FIRESTORE_EMULATOR_LOOPBACK',syntheticOnly:true,
  samples,parallel,p95Milliseconds:p95,operationsPerSample:2,failures:0};
 assert.equal(times.length,samples);
 assert.ok(p95<15000,'emulator QA saturated unexpectedly');
 console.log('W12_SYNTHETIC_PERF '+JSON.stringify(summary));
});
