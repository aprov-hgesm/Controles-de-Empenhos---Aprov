import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {HospitalFirestoreStore} from '../../../lib/server/hospital/firebase/firestore-store.mjs';
import {isHospitalGcpQaRuntime} from '../../../lib/server/hospital/firebase/gcp-qa-runtime.mjs';
import {hospitalGcpUserAccount,verifyHospitalGcpIdToken} from '../../../lib/server/hospital/firebase/verify-gcp-id-token.mjs';
import {resolveHospitalScope,requireHospitalPermission} from '../../../lib/server/hospital/core/auth.mjs';

const changed={
  NODE_ENV:'production',
  HOSPITAL_GCP_QA_ENABLED:'1',HOSPITAL_FIRESTORE_QA_ENABLED:'1',
  HOSPITAL_GCP_QA_PRIVATE:'1',
  HOSPITAL_FIRESTORE_PROJECT_ID:'cozinha-dietetica',
  GOOGLE_CLOUD_PROJECT:'cozinha-dietetica',
  K_SERVICE:'cozinha-dietetica-qa',
  HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL:'hospital-qa@cozinha-dietetica.iam.gserviceaccount.com',
};
const original=Object.fromEntries(Object.keys(changed).map(key=>[key,process.env[key]]));
const iam={email:changed.HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL,accessToken:'synthetic-oauth-token-1234567890'};
before(()=>{Object.assign(process.env,changed);delete process.env.FIRESTORE_EMULATOR_HOST;delete process.env.FIREBASE_AUTH_EMULATOR_HOST});
after(()=>{for(const [key,value] of Object.entries(original))if(value===undefined)delete process.env[key];else process.env[key]=value;});

test('runtime is isolated, never enabled by a flag or main service identity alone',()=>{
  assert.equal(isHospitalGcpQaRuntime(),true);
  for(const [key,value] of [
    ['K_SERVICE','emprovex-cloudrun-candidate'],
    ['GOOGLE_CLOUD_PROJECT','gen-lang-client-0982077967'],
    ['HOSPITAL_GCP_QA_PRIVATE','0'],
    ['HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL','emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com'],
    ['HOSPITAL_FIRESTORE_QA_ENABLED','0'],
  ]){
    const env={...process.env,[key]:value};
    assert.equal(isHospitalGcpQaRuntime(env),false,key);
  }
  assert.throws(()=>new HospitalFirestoreStore({transport:'gcp',project:'demo-cozinha-dietetica',host:null}),{code:'UNAVAILABLE'});
  assert.throws(()=>new HospitalFirestoreStore({transport:'gcp',project:'cozinha-dietetica',host:'127.0.0.1:8080'}),{code:'UNAVAILABLE'});
});

test('admin lookup is scoped to hospital project and service account, not public API key',async()=>{
  let calls=0;
  const account=await hospitalGcpUserAccount('qa_nurse',{
    identityProvider:async()=>iam,
    fetchImpl:async(url,options)=>{
      calls++;
      assert.equal(url,'https://identitytoolkit.googleapis.com/v1/projects/cozinha-dietetica/accounts:lookup');
      assert.equal(options.headers.Authorization,'Bearer '+iam.accessToken);
      assert.deepEqual(JSON.parse(options.body),{localId:['qa_nurse']});
      return {ok:true,json:async()=>({users:[{localId:'qa_nurse',disabled:false,validSince:'100'}]})};
    },
  });
  assert.equal(account.localId,'qa_nurse');
  assert.equal(calls,1);
  await assert.rejects(()=>hospitalGcpUserAccount('qa_nurse',{
    identityProvider:async()=>({...iam,email:'main@gen-lang-client-0982077967.iam.gserviceaccount.com'}),
    fetchImpl:async()=>{throw Error('must not fetch');},
  }),{code:'UNAVAILABLE'});
});

test('GCP JWT rejects wrong project, expired, revoked, disabled and unavailable lookup',async()=>{
  const now=Math.floor(Date.now()/1000);
  const claims={iss:'https://securetoken.google.com/cozinha-dietetica',
    aud:'cozinha-dietetica',sub:'qa_nurse',iat:now-60,exp:now+3600,auth_time:now-60};
  const token='synthetic-gcp-firebase-token-not-valid';
  const accepted=()=>verifyHospitalGcpIdToken(token,{
    verifyJwt:async()=>({payload:claims}),
    lookupUser:async()=>({localId:'qa_nurse',disabled:false,validSince:String(now-3600)}),
  });
  assert.deepEqual(await accepted(),{uid:'qa_nurse'});
  for(const bad of [
    {...claims,aud:'gen-lang-client-0982077967'},
    {...claims,iss:'https://securetoken.google.com/other'},
    {...claims,exp:now-60},
    {...claims,auth_time:now+300},
  ])await assert.rejects(()=>verifyHospitalGcpIdToken(token,{
    verifyJwt:async()=>({payload:bad}),
    lookupUser:async()=>{throw Error('unexpected lookup')},
  }),{code:'UNAUTHORIZED'});
  for(const user of [
    {localId:'qa_nurse',disabled:true,validSince:String(now-3600)},
    {localId:'qa_nurse',disabled:false,validSince:String(now+10)},
    {localId:'unknown',disabled:false,validSince:String(now-3600)},
    {localId:'qa_nurse',disabled:false},
    null,
  ])await assert.rejects(()=>verifyHospitalGcpIdToken(token,{
    verifyJwt:async()=>({payload:claims}),lookupUser:async()=>user,
  }),{code:'UNAUTHORIZED'});
  await assert.rejects(()=>verifyHospitalGcpIdToken(token,{
    verifyJwt:async()=>({payload:claims}),lookupUser:async()=>{throw Error('OFFLINE')},
  }),/OFFLINE/);
});

test('W11 production-shape IAM adapter transacts against actual Firestore Emulator, not GCP',async(t)=>{
  const emulator=process.env.W11_TEST_EMULATOR_HOST;
  if(!emulator){t.skip('Only the explicit W11 emulator CI runs this test');return;}
  const rewrite=async(url,options)=>{
    assert.match(url,/^https:\/\/firestore\.googleapis\.com\/v1\/projects\/cozinha-dietetica\/databases\/\(default\)\/documents/);
    assert.equal(options.headers.Authorization,'Bearer '+iam.accessToken);
    const emuUrl=url.replace('https://firestore.googleapis.com','http://'+emulator)
      .replaceAll('/projects/cozinha-dietetica/','/projects/demo-cozinha-dietetica/');
    // The emulator uses its own synthetic elevated token; production still
    // sends the real IAM OAuth token (asserted above), never this fixture.
    const opts={...options,headers:{...options.headers,Authorization:'Bearer owner'},
      body:typeof options.body==='string'?options.body
      .replaceAll('projects/cozinha-dietetica/','projects/demo-cozinha-dietetica/'):options.body};
    return fetch(emuUrl,opts);
  };
  const a=new HospitalFirestoreStore({transport:'gcp',project:'cozinha-dietetica',host:null,
    identityProvider:async()=>iam,fetchImpl:rewrite});
  const b=new HospitalFirestoreStore({transport:'gcp',project:'cozinha-dietetica',host:null,
    identityProvider:async()=>iam,fetchImpl:rewrite});
  const suffix=Math.random().toString(36).slice(2,10);
  const org='qa_w11_'+suffix,other='qa_other_'+suffix,uid='qa_user_'+suffix,unit='UTI';
  await a.seedOrganization({id:org,ug:'UG_SYNTHETIC',active:true});
  await a.seedOrganization({id:other,ug:'UG_OTHER',active:true});
  await a.seedMembership({id:'membership',uid,organizationId:org,ug:'UG_SYNTHETIC',
    active:true,roles:['UNIT'],unitIds:[unit]});
  const scope=await resolveHospitalScope({authorization:'Bearer synthetic',organizationId:org,
    store:a,verifyToken:async()=>({uid})});
  requireHospitalPermission(scope,'patient:write',unit);
  assert.throws(()=>requireHospitalPermission(scope,'patient:read','UPI'),{code:'FORBIDDEN'});
  await assert.rejects(resolveHospitalScope({authorization:'Bearer synthetic',
    organizationId:other,store:a,verifyToken:async()=>({uid})}),{code:'FORBIDDEN'});
  const id='patient_'+suffix;
  const create=db=>db.transaction(async store=>{
    const row=await store.put(org,'patient',unit,{id,organizationId:org,unitId:unit},0);
    await store.appendEvent(org,'patient',id,'patient.created',uid,{unitId:unit});
    return row;
  });
  const writes=await Promise.allSettled([create(a),create(b)]);
  assert.equal(writes.filter(x=>x.status==='fulfilled').length,1,'only one create should succeed');
  assert.equal(writes.filter(x=>x.status==='rejected').length,1);
  assert.equal((await a.get(org,'patient',id)).revision,1);
  assert.equal((await a.events(org,'patient',id)).length,1);
  assert.equal(await a.get(other,'patient',id),null);
  const version='map_'+suffix;
  await a.transaction(store=>store.saveMapVersion(org,version,1,'SUBMISSION',{synthetic:true},null,uid));
  await assert.rejects(()=>b.transaction(store=>store.saveMapVersion(org,version,1,'SUBMISSION',{synthetic:false},null,uid)),{code:'CONFLICT'});
  assert.equal((await a.listMapVersions(org,version)).length,1);
});
