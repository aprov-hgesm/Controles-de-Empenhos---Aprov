import test from 'node:test';
import assert from 'node:assert/strict';
import {HospitalFirestoreGateway} from '../../../lib/server/hospital/firebase/firestore-gateway.mjs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';

const identity = {email:'qa-hospital@cozinha-dietetica.iam.gserviceaccount.com',accessToken:'synthetic-only-credential-not-real-12345'};
async function authorizedScope(uid='unit-member') {
  return resolveHospitalScope({
    authorization:'Bearer synthetic-identity-token',
    organizationId:'om-hgesm',
    verifyToken:async()=>({uid}),
    store:{
      findMembership:(_org,id)=>({id:'m-'+id,uid:id,organizationId:'om-hgesm',ug:'160416',active:true,roles:['UNIT'],unitIds:['uti']}),
      findOrganization:()=>({id:'om-hgesm',ug:'160416',active:true}),
    },
  });
}
const enable=()=>{
  process.env.NODE_ENV='test';
  process.env.HOSPITAL_FIRESTORE_QA_ENABLED='1';
  process.env.HOSPITAL_FIRESTORE_PROJECT_ID='cozinha-dietetica';
  process.env.HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL=identity.email;
};
const response=(doc)=>({ok:true,status:200,json:async()=>doc});
test('Firestore gateway targets only the hospital project and authorized unit',async()=>{
  enable();
  const scope=await authorizedScope();
  const calls=[];
  const gateway=new HospitalFirestoreGateway({
    qa:true,identityProvider:async()=>identity,
    fetchImpl:async(url,opts)=>{
      calls.push({url,opts});
      return response({name:'projects/cozinha-dietetica/databases/(default)/documents/organizations/om-hgesm/units/uti/records/patient__p1',
        fields:{json:{stringValue:JSON.stringify({id:'p1',organizationId:'om-hgesm',unitId:'uti'})}},updateTime:'2026-11-11T10:00:00Z'});
    },
  });
  const got=await gateway.get(scope,{kind:'patient',unitId:'uti',id:'p1'});
  assert.equal(got.value.id,'p1');
  assert.match(calls[0].url,/projects\/cozinha-dietetica\/databases\/\(default\)\/documents/);
  assert.ok(!calls[0].url.includes('gen-lang-client-0982077967'));
  await assert.rejects(()=>gateway.get(scope,{kind:'patient',unitId:'upi',id:'p1'}),/Unidade fora/);
  await assert.rejects(()=>gateway.get(scope,{kind:'unknown',unitId:'uti',id:'p1'}),/Tipo de registro/);
});
test('atomic Firestore writes enforce create-only or updateTime and audit actor',async()=>{
  enable();
  const scope=await authorizedScope();
  let commit;
  const gateway=new HospitalFirestoreGateway({qa:true,identityProvider:async()=>identity,
    fetchImpl:async(url,options)=>{
      commit={url,options};
      return response({writeResults:[{updateTime:'2026-11-11T12:30:00Z'},{updateTime:'2026-11-11T12:30:00Z'}]});
    },
  });
  const value={id:'p1',organizationId:'om-hgesm',unitId:'uti',referenceCode:'TEST_ONLY'};
  const out=await gateway.writeWithAudit(scope,{kind:'patient',unitId:'uti',id:'p1',value,actorUid:'unit-member',eventType:'patient.created'});
  assert.equal(out.id,'p1');
  assert.ok(commit.url.endsWith('/documents:commit'));
  assert.equal(JSON.parse(commit.options.body).writes.length,2);
  assert.equal(JSON.parse(commit.options.body).writes[0].currentDocument.exists,false);
  assert.equal(JSON.parse(commit.options.body).writes[1].currentDocument.exists,false);
  await gateway.writeWithAudit(scope,{kind:'patient',unitId:'uti',id:'p1',value,actorUid:'unit-member',
    eventType:'patient.updated',expectedUpdateTime:out.updateTime});
  assert.equal(JSON.parse(commit.options.body).writes[0].currentDocument.updateTime,out.updateTime);
  await assert.rejects(()=>gateway.writeWithAudit(scope,{kind:'patient',unitId:'uti',id:'p1',value,actorUid:'other',eventType:'patient.updated'}),/Autor divergente/);
});
test('wrong IAM identity, wrong project, missing opt-in and production fail closed',async()=>{
  enable();
  let called=false;
  const scope=await authorizedScope();
  const bad=new HospitalFirestoreGateway({qa:true,identityProvider:async()=>({...identity,email:'main-app@example.com'}),
    fetchImpl:async()=>{called=true;return response({})}});
  await assert.rejects(()=>bad.get(scope,{kind:'patient',unitId:'uti',id:'p1'}),/Identidade de serviço/);
  assert.equal(called,false);
  process.env.HOSPITAL_FIRESTORE_PROJECT_ID='gen-lang-client-0982077967';
  assert.throws(()=>new HospitalFirestoreGateway({qa:true,identityProvider:async()=>identity}),/Projeto clínico incorreto/);
  process.env.HOSPITAL_FIRESTORE_PROJECT_ID='cozinha-dietetica';
  process.env.HOSPITAL_FIRESTORE_QA_ENABLED='0';
  assert.throws(()=>new HospitalFirestoreGateway({qa:true,identityProvider:async()=>identity}),/não autorizado/);
  process.env.HOSPITAL_FIRESTORE_QA_ENABLED='1';
  process.env.NODE_ENV='production';
  assert.throws(()=>new HospitalFirestoreGateway({qa:true,identityProvider:async()=>identity}),/apenas para QA/);
  process.env.NODE_ENV='test';
});
