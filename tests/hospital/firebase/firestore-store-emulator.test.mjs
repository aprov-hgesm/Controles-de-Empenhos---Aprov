import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {initializeApp, deleteApp} from 'firebase/app';
import {getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc} from 'firebase/firestore';
import {getAuth, connectAuthEmulator, createUserWithEmailAndPassword} from 'firebase/auth';
import {HospitalFirestoreStore} from '../../../lib/server/hospital/firebase/firestore-store.mjs';
import {resolveHospitalScope, requireHospitalPermission} from '../../../lib/server/hospital/core/auth.mjs';

const QA_PROJECT='demo-cozinha-dietetica';
process.env.HOSPITAL_FIRESTORE_QA_ENABLED='1';
const host=process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host??'', /^127\.0\.0\.1:\d+$/, 'FIRESTORE_EMULATOR_HOST must point at loopback');
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST??'', /^127\.0\.0\.1:\d+$/, 'Auth emulator required');

const store=new HospitalFirestoreStore();
const otherStore=new HospitalFirestoreStore();
const suffix=Math.random().toString(36).slice(2,9);
const org='QA_HGE_'+suffix, otherOrg='QA_OTHER_'+suffix;
const user='synthetic_'+suffix, unit='UTI', otherUnit='UPI';
let app;

before(async()=>{
  await store.seedOrganization({id:org,ug:'UG_TEST_A',active:true});
  await store.seedOrganization({id:otherOrg,ug:'UG_TEST_B',active:true});
  await store.seedMembership({id:'member_a',uid:user,organizationId:org,ug:'UG_TEST_A',
    active:true,roles:['UNIT'],unitIds:[unit]});
  app=initializeApp({apiKey:'synthetic-api-key',projectId:QA_PROJECT,appId:'1:0:web:qa-only'},
    'hospital-w10-test-'+suffix);
});
after(async()=>{store.close();otherStore.close();if(app)await deleteApp(app)});

test('emulator: Firestore Rules deny anonymous and authenticated client SDK reads/writes',async()=>{
  const firestore=getFirestore(app);
  connectFirestoreEmulator(firestore,'127.0.0.1',Number(host.split(':')[1]));
  const ref=doc(firestore,'organizations',org,'units',unit,'records','patient__anon');
  await assert.rejects(getDoc(ref),/permission|insufficient/i);
  await assert.rejects(setDoc(ref,{unsafe:true}),/permission|insufficient/i);
  const auth=getAuth(app);
  connectAuthEmulator(auth,'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,{disableWarnings:true});
  await createUserWithEmailAndPassword(auth,'synthetic-'+suffix+'@example.invalid','test-only-password-123');
  await assert.rejects(getDoc(ref),/permission|insufficient/i);
  await assert.rejects(setDoc(ref,{unsafe:true}),/permission|insufficient/i);
});

test('server membership async and per-OM/unit authorization fail closed',async()=>{
  const verifyToken=async token=>token==='synthetic'?{uid:user}:null;
  const scope=await resolveHospitalScope({authorization:'Bearer synthetic',organizationId:org,store,verifyToken});
  assert.equal(scope.organizationId,org);
  assert.equal(scope.ug,'UG_TEST_A');
  requireHospitalPermission(scope,'patient:write',unit);
  assert.throws(()=>requireHospitalPermission(scope,'patient:read',otherUnit),{code:'FORBIDDEN'});
  await assert.rejects(
    resolveHospitalScope({authorization:'Bearer synthetic',organizationId:otherOrg,store,verifyToken}),
    {code:'FORBIDDEN'});
  await assert.rejects(
    resolveHospitalScope({authorization:'Bearer synthetic',organizationId:org,store,
      verifyToken:async()=>{throw Error('revoked')}}),{code:'UNAUTHORIZED'});
});

test('native Firestore transaction commits canonical record and immutable audit together',async()=>{
  const id='patient_'+suffix;
  const created=await store.transaction(async db=>{
    const p=await db.put(org,'patient',unit,{id,organizationId:org,unitId:unit,referenceCode:'SYNTHETIC'},0);
    await db.appendEvent(org,'patient',id,'patient.created',user,{unitId:unit});
    return p;
  });
  assert.equal(created.revision,1);
  assert.deepEqual(await store.get(org,'patient',id),created);
  assert.equal((await store.list(org,'patient',unit)).filter(x=>x.id===id).length,1);
  assert.equal((await store.events(org,'patient',id)).length,1);
  assert.equal(await store.get(otherOrg,'patient',id),null);
  assert.equal((await store.list(org,'patient',otherUnit)).length,0);
  await assert.rejects(store.transaction(db=>db.put(org,'patient',unit,{...created,displayName:'outdated'},0)),
    {code:'CONFLICT'});
  const revised=await store.transaction(db=>db.put(org,'patient',unit,{...created,displayName:'synthetic edit'},1));
  assert.equal(revised.revision,2);
  assert.equal((await store.get(org,'patient',id)).displayName,'synthetic edit');
});

test('native Firestore concurrent create-only guarantee and conflict retry do not overwrite',async()=>{
  const id='concurrent_'+suffix;
  const create=database=>database.transaction(async db=>{
    const value=await db.put(org,'patient',unit,{id,organizationId:org,unitId:unit,referenceCode:'TEST'},0);
    await db.appendEvent(org,'patient',id,'patient.created',user,{});
    return value;
  });
  const results=await Promise.allSettled([create(store),create(otherStore)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,1);
  assert.equal((await store.events(org,'patient',id)).length,1);
});

test('native uniqueness, idempotent retry, append-only snapshots and atomic rollback',async()=>{
  const result=async database=>database.transaction(async db=>db.idempotent(
    org,'meal.create','key_'+suffix,'request_hash',
    async()=>{
      await db.ensureMealUnique(org,'admission_'+suffix,'2026-11-11','10','PRIMARY','meal_'+suffix);
      await db.appendEvent(org,'meal','meal_'+suffix,'meal.requested',user,{status:'REQUESTED'});
      return {id:'meal_'+suffix,ok:true};
    }));
  const first=await result(store);
  assert.deepEqual(await result(otherStore),first);
  assert.equal(await store.getMealKey(org,'admission_'+suffix,'2026-11-11','10','PRIMARY'),first.id);
  await assert.rejects(store.transaction(db=>db.ensureMealUnique(
    org,'admission_'+suffix,'2026-11-11','10','PRIMARY','different')),{code:'CONFLICT'});
  await assert.rejects(store.transaction(db=>db.idempotent(
    org,'meal.create','key_'+suffix,'DIFFERENT_HASH',async()=>({}))),{code:'CONFLICT'});

  const mapId='map_'+suffix;
  await store.transaction(db=>db.saveMapVersion(org,mapId,1,'SUBMISSION',{synthetic:true},null,user));
  await assert.rejects(store.transaction(db=>db.saveMapVersion(
    org,mapId,1,'SUBMISSION',{synthetic:false},null,user)),{code:'CONFLICT'});
  assert.equal((await store.listMapVersions(org,mapId)).length,1);

  const rolledBackId='rollback_'+suffix;
  await assert.rejects(store.transaction(async db=>{
    await db.put(org,'patient',unit,{id:rolledBackId,organizationId:org,unitId:unit},0);
    await db.appendEvent(org,'patient',rolledBackId,'patient.created',user,{});
    throw Error('SIMULATED_FAILURE');
  }),/SIMULATED_FAILURE/);
  assert.equal(await store.get(org,'patient',rolledBackId),null);
  assert.equal((await store.events(org,'patient',rolledBackId)).length,0);
});

test('Firestore network failure never falls back to SQLite or live Firestore',async()=>{
  const broken=new HospitalFirestoreStore({fetchImpl:async()=>{throw Error('NETWORK_DOWN')}});
  await assert.rejects(broken.findOrganization(org),{code:'UNAVAILABLE'});
  assert.throws(()=>new HospitalFirestoreStore({host:'firestore.googleapis.com:443'}),{code:'UNAVAILABLE'});
  assert.throws(()=>new HospitalFirestoreStore({project:'cozinha-dietetica'}),{code:'UNAVAILABLE'});
});
