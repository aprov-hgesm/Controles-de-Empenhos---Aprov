import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeJwt } from 'jose';
import { createFiscalTransport } from '../fiscal/issuance/firestoreTransport.mjs';
import { createQaAdditionalCompanyRegistry, profileApprovalPath } from './qaRegistration.mjs';
import { requestAdditionalCompany } from './registration.mjs';
import { authorizeCompanyProfile, listAuthorizedCompanyProfiles } from './core.mjs';

const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'';
assert.match(project,/^demo-/);
assert.equal(process.env.EMPROVEX_E2E_SERVER_AUTH,'1');
assert.ok(['127.0.0.1:8080','localhost:8080'].includes(process.env.FIRESTORE_EMULATOR_HOST));
assert.ok(['127.0.0.1:9099','localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST));
assert.ok(!process.env.K_SERVICE&&!process.env.VERCEL&&process.env.NODE_ENV!=='production');
const authRoot='http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST
  +'/identitytoolkit.googleapis.com/v1';
const transport=createFiscalTransport({projectId:project,
  emulatorHost:process.env.FIRESTORE_EMULATOR_HOST,tokenProvider:async()=> 'owner'});
const registry=createQaAdditionalCompanyRegistry(transport);
const A='company-w10-stage3-owner-a', B='company-w10-stage3-owner-b';
const aCnpj='11444777000161',bCnpj='11222333000181';
const email='w10-stage3-owner@example.invalid';
const password='EmulatorOnlyW10NoRealUser!';
async function call(path,body) {
 const response=await fetch(authRoot+path+'?key=demo-key',{
  method:'POST',headers:{authorization:'Bearer owner','content-type':'application/json'},
  body:JSON.stringify(body),
 });
 const data=await response.json();
 assert.equal(response.status,200,'Auth Emulator '+path+' '+JSON.stringify(data));
 return data;
}
const ws=(id,cnpj,name,mail)=>({
  id,workspaceType:'company',name,status:'active',authorizedEmail:mail,
  companyProfile:{cnpj,registrationStatus:'active',tradeName:name,legalName:name,
    responsibleName:'Responsável QA',accessEmail:mail,city:'Santa Maria',state:'RS'},
  createdAt:'2026-11-06T10:00:00Z',updatedAt:'2026-11-06T10:00:00Z',
});
function services() {
 return {
  listCandidateIds:async p=>{
   const link=(await transport.read('companyProfileUidLinks/'+p.uid))?.value;
   return [A,...(link?.companyIds||[])];
  },
  readWorkspace:async id=>(await transport.read('workspaces/'+id))?.value||null,
  readOwner:async id=>(await transport.read('supplierCompanyWorkspaces/'+id+'/ownerBinding/primary'))?.value||null,
  readMember:async()=>null,
  verifyCnpjBinding:async (cnpj,id)=>{
   const index=(await transport.read('platformCnpjIndex/'+cnpj))?.value;
   return index?.workspaceId===id&&index?.cnpj===cnpj;
  },
  permitsAction:()=>false,isKnownAction:action=>['company:read','company:write'].includes(action),
  ...registry,
 };
}
test('Auth + Firestore Emulator REAIS: mesmo Firebase UID, A/B owners verificados, unicidade e replay transacional',async()=>{
 const created=await call('/projects/'+project+'/accounts',{
  email,password,emailVerified:true,disabled:false});
 assert.ok(created.localId);
 const signed=await call('/accounts:signInWithPassword',{email,password,returnSecureToken:true});
 const jwt=decodeJwt(signed.idToken);
 assert.equal(jwt.sub,created.localId);
 assert.equal(jwt.email_verified,true);
 const uid=created.localId;
 const principal={uid,email,verified:true,active:true,emailVerified:true,
  provider:'password',accountType:'company'};
 const owner={companyId:A,workspaceId:A,firebaseUid:uid,email,status:'active'};
 const authUsersBefore=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST
  +'/identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:batchGet?maxResults=1000',
  {headers:{authorization:'Bearer owner'}}).then(x=>x.json());
 const beforeCount=authUsersBefore.users?.length||0;
 await transport.commit([
  {path:'workspaces/'+A,value:ws(A,aCnpj,'Empresa A QA',email),precondition:{exists:false}},
  {path:'platformCnpjIndex/'+aCnpj,value:{cnpj:aCnpj,workspaceId:A,email,firebaseUid:uid},precondition:{exists:false}},
  {path:'supplierCompanyWorkspaces/'+A+'/ownerBinding/primary',value:owner,precondition:{exists:false}},
  {path:'platformAccounts/'+email,value:{accountType:'company',status:'active',email,workspaceId:A,firebaseUid:uid,authProvider:'password'},precondition:{exists:false}},
  {path:'platformAuthUidIndex/'+uid,value:{accountType:'company',email,workspaceId:A,firebaseUid:uid},precondition:{exists:false}},
 ]);
 const approval={status:'approved',proofType:'administrative-verification',
  uid,email,cnpj:bCnpj,proposedCompanyId:B,legalName:'Empresa B QA',
  responsibleName:'Titular B QA',city:'Santa Maria',state:'RS',
  approvedByUid:'founder-demo-administrator',approvedByEmail:'admin@example.invalid',
  evidenceSha256:'a'.repeat(64),
  expiresAt:new Date(Date.now()+3600_000).toISOString()};
 await transport.commit([{path:profileApprovalPath(uid,B,bCnpj),
   value:approval,precondition:{exists:false}}]);
 const cmd={primaryCompanyId:A,proposedCompanyId:B,
  legalName:'Empresa B QA',cnpj:bCnpj,idempotencyKey:'w10-stage3-qa-idem-000001'};
 const first=await requestAdditionalCompany(principal,cmd,services());
 assert.equal(first.outcome,'created');
 assert.equal(first.companyId,B);
 const second=await requestAdditionalCompany(principal,cmd,services());
 assert.equal(second.outcome,'replayed');
 const [pa,pb]=await Promise.all([
  authorizeCompanyProfile(principal,A,services()),
  authorizeCompanyProfile(principal,B,services())]);
 assert.equal(pa.role,'owner');assert.equal(pb.role,'owner');
 const list=await listAuthorizedCompanyProfiles(principal,services());
 assert.deepEqual(list.map(x=>x.companyId),[A,B]);
 const badPrincipal={...principal,uid:'other-auth-uid'};
 await assert.rejects(authorizeCompanyProfile(badPrincipal,B,services()),e=>e.status===403);
 await assert.rejects(requestAdditionalCompany(principal,
   {...cmd,idempotencyKey:'w10-stage3-qa-idem-000002',legalName:'Nome adulterado'},services()),
   e=>e.status===403);
 assert.equal((await transport.read('platformAccounts/'+email)).value.workspaceId,A);
 assert.equal((await transport.read('platformAuthUidIndex/'+uid)).value.workspaceId,A);
 assert.equal((await transport.read('platformCnpjIndex/'+bCnpj)).value.workspaceId,B);
 assert.equal((await transport.read('supplierCompanyWorkspaces/'+B+'/ownerBinding/primary')).value.firebaseUid,uid);
 const authUsersAfter=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST
  +'/identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:batchGet?maxResults=1000',
  {headers:{authorization:'Bearer owner'}}).then(x=>x.json());
 assert.equal(authUsersAfter.users?.length||0,beforeCount,'never create second Auth UID');
 const stored=await transport.read('workspaces/'+B);
 await transport.commit([{path:'workspaces/'+B,value:{...stored.value,status:'suspended'},
   precondition:{updateTime:stored.updateTime}}]);
 await assert.rejects(authorizeCompanyProfile(principal,B,services()),e=>e.status===403);
 const active=await listAuthorizedCompanyProfiles(principal,services());
 assert.deepEqual(active.map(x=>x.companyId),[A],'suspended B must disappear, A remains authorized');
});
