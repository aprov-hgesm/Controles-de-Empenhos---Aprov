import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {HospitalFirestoreStore} from '../../../lib/server/hospital/firebase/firestore-store.mjs';
import {HospitalPatientsService} from '../../../lib/server/hospital/patients/firestore-service.mjs';
import {HospitalDietsService} from '../../../lib/server/hospital/diets/firestore-service.mjs';
import {HospitalMapsService} from '../../../lib/server/hospital/maps/firestore-service.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';

const phase=process.argv[2];
assert.ok(['seed','verify'].includes(phase),'Specify seed/verify');
assert.equal(process.env.HOSPITAL_FIRESTORE_QA_ENABLED,'1');
assert.equal(process.env.NODE_ENV==='production',false);
assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^127\.0\.0\.1:\d+$/);
assert.equal(process.env.GOOGLE_CLOUD_PROJECT??'demo-cozinha-dietetica','demo-cozinha-dietetica');
const store=new HospitalFirestoreStore();
assert.equal(store.transport,'emulator');
const org='qa_w12_restore',other='qa_w12_restore_other',unit='UTI',user='qa_w12_restore_nurse',admin='qa_w12_restore_admin';
const scope=uid=>resolveHospitalScope({authorization:'Bearer '+uid,organizationId:org,store,
 verifyToken:async token=>({uid:token})});
const localDay=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
 year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400_000));
const probeHash=createHash('sha256').update('SYNTHETIC_ONLY').digest('hex');

if(phase==='seed'){
 await store.seedOrganization({id:org,ug:'UG_SYNTHETIC',active:true});
 await store.seedOrganization({id:other,ug:'UG_OTHER',active:true});
 for(const [uid,role] of [[user,'UNIT'],[admin,'HOSPITAL_ADMIN']]){
  await store.seedMembership({id:'membership_'+uid,uid,organizationId:org,ug:'UG_SYNTHETIC',
   active:true,roles:[role],unitIds:[unit]});
 }
 const s=await scope(user),a=await scope(admin);
 const patients=new HospitalPatientsService(store),diets=new HospitalDietsService(store),
  maps=new HospitalMapsService(store);
 const patient=await patients.registerPatient(s,{unitId:unit,referenceCode:'QA_BACKUP_001',
  displayName:'SYNTHETIC RESTORE PATIENT'});
 const admission=await patients.admit(s,{patientId:patient.id,unitId:unit});
 const catalog=await diets.saveCatalog(a,{catalogItemId:'QA_BACKUP_DIET',code:'QA_BACKUP_DIET',
  label:'Synthetic restore catalog',type:'ORAL',consistency:'NORMAL',route:'ORAL',
  restrictionCodes:[],allergenCodes:[],status:'ACTIVE',expectedRevision:0});
 const prescribed=await diets.recordReference(s,{unitId:unit,admissionId:admission.id,
  referenceId:'QA_BACKUP_REF',catalogItemId:catalog.id,sourceRef:'QA_SYNTHETIC_ORDER',
  sourceVersion:'1',prescriberAsRecorded:'Test Physician',
  prescribedAt:new Date().toISOString(),fasting:false,allergyCodes:[],restrictionCodes:[]});
 const draft=await maps.createDraft(s,{unitId:unit,localDate:localDay(2),cycleId:'10'});
 const added=await maps.setMeal(s,{mapId:draft.id,admissionId:admission.id,mealType:'PRIMARY',
  medicalReferenceId:prescribed.reference.id,dietCode:catalog.id,
  expectedMapRevision:draft.revision,idempotencyKey:'QA_BACKUP_MEAL'});
 const receipt=await maps.submitMap(s,{mapId:draft.id,expectedRevision:added.map.revision,
  idempotencyKey:'QA_BACKUP_SUBMIT'});
 assert.equal(receipt.receipt.status,'SUBMITTED');
 await store.transaction(async db=>db.idempotent(org,'w12.restore.probe','QA_BACKUP_PROBE',
   probeHash,async()=>({saved:true,marker:'QA_RESTORED'})));
 console.log('W12_BACKUP_SEEDED '+JSON.stringify({project:'demo-cozinha-dietetica',
  syntheticOnly:true,patientRecords:1,submittedMaps:1,snapshots:1}));
}else{
 assert.ok(await store.findOrganization(org),'restored organization must exist');
 assert.equal(await store.findOrganization(other).then(x=>x.ug),'UG_OTHER');
 const s=await scope(user);
 const patients=await store.list(org,'patient',unit),admissions=await store.list(org,'admission',unit);
 assert.equal(patients.length,1);assert.equal(admissions.length,1);
 assert.equal(patients[0].referenceCode,'QA_BACKUP_001');
 assert.equal(await store.get(other,'patient',patients[0].id),null);
 const maps=new HospitalMapsService(store);
 const list=await maps.listMaps(s,{unitId:unit,cycleId:'10'});
 assert.equal(list.length,1);assert.equal(list[0].status,'SUBMITTED');
 const receipt=await maps.receipt(s,{mapId:list[0].id});
 assert.equal(receipt.status,'SUBMITTED');assert.equal(receipt.submissionVersion,1);
 const snapshots=await maps.listVersions(s,{mapId:list[0].id});
 assert.equal(snapshots.length,1);
 assert.equal(snapshots[0].kind,'SUBMISSION');
 assert.equal(snapshots[0].snapshot.meals.length,1);
 assert.equal((await store.events(org,'map',list[0].id)).filter(e=>e.eventType==='map.submitted').length,1);
 const probe=await store.transaction(async db=>db.idempotent(org,'w12.restore.probe',
   'QA_BACKUP_PROBE',probeHash,async()=>{throw Error('idempotency replay executed again')}));
 assert.deepEqual(probe,{saved:true,marker:'QA_RESTORED'});
 await assert.rejects(store.transaction(db=>db.saveMapVersion(org,list[0].id,1,'SUBMISSION',
   {synthetic:false},null,user)),{code:'CONFLICT'});
 assert.equal((await store.list(org,'meal',unit)).length,1);
 console.log('W12_BACKUP_RESTORED '+JSON.stringify({project:'demo-cozinha-dietetica',
  syntheticOnly:true,patientRecords:1,submittedMaps:1,snapshots:1,
  immutableAuditVerified:true,idempotentReplayVerified:true}));
}
