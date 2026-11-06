import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  ProfileError, normalizeCnpj, authorizeCompanyProfile, listAuthorizedCompanyProfiles,
  selectAuthorizedCompanyProfile, assertSameProfileResource,
} from './core.mjs';
import { requestAdditionalCompany } from './registration.mjs';
import {
  signProfileSelection, verifyProfileSelection, profileSetCookie, profileClearCookie,
} from './selection.mjs';

const A='empresa_a', B='empresa_b', C='empresa_c';
const cnpjA='11222333000181',cnpjB='11444777000161',cnpjC='12345678000195';
const principal=(uid='uid-dual',email='dual@example.com')=>({
  uid,email,verified:true,active:true,emailVerified:true,provider:'password',accountType:'company',
});
function fixture() {
  const p=principal();
  const workspaces=new Map([
    [A,{id:A,workspaceType:'company',status:'active',name:'Empresa A',companyProfile:{
      cnpj:cnpjA,legalName:'Empresa A LTDA',registrationStatus:'active'}}],
    [B,{id:B,workspaceType:'company',status:'active',name:'Empresa B',companyProfile:{
      cnpj:cnpjB,legalName:'Empresa B LTDA',registrationStatus:'active'}}],
    [C,{id:C,workspaceType:'company',status:'active',name:'Empresa C',companyProfile:{
      cnpj:cnpjC,legalName:'Empresa C LTDA',registrationStatus:'active'}}],
  ]);
  const owners=new Map([
    [A,{companyId:A,workspaceId:A,status:'active',firebaseUid:p.uid,email:p.email}],
    [B,{companyId:B,workspaceId:B,status:'active',firebaseUid:p.uid,email:p.email}],
    [C,{companyId:C,workspaceId:C,status:'active',firebaseUid:'uid-else',email:'else@example.com'}],
  ]);
  const members=new Map();
  const candidates=new Map([[p.uid,[A,B,C]],['uid-only-a',[A,B]],['uid-stranger',[A,B,C]]]);
  const indexes=new Map([[cnpjA,A],[cnpjB,B],[cnpjC,C]]);
  const services={
    isKnownAction: action => ['company:read','company:write','customerOrders:write',
      'accountsReceivable:read'].includes(action),
    listCandidateIds: async user => candidates.get(user.uid) || [],
    readWorkspace: async id => workspaces.get(id)||null,
    readOwner: async id => owners.get(id)||null,
    readMember: async (id,user) => members.get(id+':'+user.uid)||null,
    verifyCnpjBinding: async (cnpj,id) => indexes.get(cnpj)===id,
    permitsAction: (roles,status,action) => status==='active'
      && (roles.includes('admin') || action==='company:read'
        || roles.includes('finance') && action==='accountsReceivable:read'),
  };
  return {p,services,workspaces,owners,members,candidates,indexes};
}
const isCode=(code,status) => e => e instanceof ProfileError && e.code===code && e.status===status;

test('W12: CNPJ numerical canonical and checksum rejects invalid',()=>{
  assert.equal(normalizeCnpj('11.222.333/0001-81'),cnpjA);
  assert.throws(()=>normalizeCnpj('11.222.333/0001-82'),isCode('PROFILE_INVALID_CNPJ',400));
  assert.throws(()=>normalizeCnpj('11.111.111/1111-11'),isCode('PROFILE_INVALID_CNPJ',400));
  assert.throws(()=>normalizeCnpj('../A'),isCode('PROFILE_INVALID_CNPJ',400));
});
test('W12: one Firebase UID legally owns independent CNPJ A and B', async()=>{
  const {p,services}=fixture();
  const list=await listAuthorizedCompanyProfiles(p,services);
  assert.deepEqual(list.map(x=>x.companyId),[A,B]);
  assert.deepEqual(list.map(x=>x.cnpj),[cnpjA,cnpjB]);
  assert.deepEqual(list.map(x=>x.role),['owner','owner']);
});
test('W12: second UID only linked to A sees only A',async()=>{
  const f=fixture(),user=principal('uid-only-a','a@example.com');
  f.members.set(A+':'+user.uid,{companyId:A,workspaceId:A,firebaseUid:user.uid,
    email:user.email,status:'active',roles:['finance']});
  const result=await listAuthorizedCompanyProfiles(user,f.services);
  assert.deepEqual(result.map(x=>x.companyId),[A]);
  assert.equal(result[0].role,'member');
  assert.deepEqual(result[0].rights,['finance']);
});
test('W12: UID without membership gets no tenant data',async()=>{
  const f=fixture();
  assert.deepEqual(await listAuthorizedCompanyProfiles(principal('uid-stranger','x@example.com'),f.services),[]);
});
test('W12: member B with finance role may read but not modify unrelated action',async()=>{
  const f=fixture(),user=principal('uid-only-a','a@example.com');
  f.members.set(B+':'+user.uid,{companyId:B,workspaceId:B,firebaseUid:user.uid,
    email:user.email,status:'active',roles:['finance']});
  assert.equal((await authorizeCompanyProfile(user,B,f.services)).role,'member');
  await assert.rejects(()=>authorizeCompanyProfile(user,B,f.services,'customerOrders:write'),isCode('PROFILE_NOT_AUTHORIZED',403));
});
test('W12: invitation pending is not an active membership',async()=>{
  const f=fixture(),user=principal('uid-only-a','a@example.com');
  f.members.set(B+':'+user.uid,{companyId:B,workspaceId:B,firebaseUid:'',email:user.email,
    status:'invited',roles:['admin']});
  await assert.rejects(()=>selectAuthorizedCompanyProfile(user,B,f.services),isCode('PROFILE_NOT_AUTHORIZED',403));
  // W3 independent invitation acceptance binds verified UID and changes status server-side.
  f.members.set(B+':'+user.uid,{companyId:B,workspaceId:B,firebaseUid:user.uid,email:user.email,
    status:'active',roles:['admin']});
  assert.equal((await selectAuthorizedCompanyProfile(user,B,f.services)).companyId,B);
});
test('W12: role change and live revocation take effect on next request',async()=>{
  const f=fixture(),user=principal('uid-only-a','a@example.com');
  const member={companyId:B,workspaceId:B,firebaseUid:user.uid,email:user.email,status:'active',roles:['admin']};
  f.members.set(B+':'+user.uid,member);
  assert.equal((await selectAuthorizedCompanyProfile(user,B,f.services)).companyId,B);
  member.roles=['finance'];
  await assert.rejects(()=>authorizeCompanyProfile(user,B,f.services,'customerOrders:write'),isCode('PROFILE_NOT_AUTHORIZED',403));
  member.status='revoked';
  await assert.rejects(()=>selectAuthorizedCompanyProfile(user,B,f.services),isCode('PROFILE_NOT_AUTHORIZED',403));
});
test('W12: company suspended after selection becomes forbidden immediately',async()=>{
  const f=fixture();
  await selectAuthorizedCompanyProfile(f.p,B,f.services);
  f.workspaces.get(B).status='disabled';
  await assert.rejects(()=>selectAuthorizedCompanyProfile(f.p,B,f.services),isCode('PROFILE_NOT_AUTHORIZED',403));
  assert.deepEqual((await listAuthorizedCompanyProfiles(f.p,f.services)).map(x=>x.companyId),[A]);
});
test('W12: stale discovery index never grants a company',async()=>{
  const f=fixture();
  f.candidates.set(f.p.uid,[A,B,C]);
  const list=await listAuthorizedCompanyProfiles(f.p,f.services);
  assert.deepEqual(list.map(x=>x.companyId),[A,B]);
});
test('W12: changing owner UID/email denies selection',async()=>{
  const f=fixture();
  f.owners.get(B).firebaseUid='forged-other-uid';
  await assert.rejects(()=>selectAuthorizedCompanyProfile(f.p,B,f.services),isCode('PROFILE_NOT_AUTHORIZED',403));
});
test('W12: CNPJ directory mismatch denies selection',async()=>{
  const f=fixture();
  f.indexes.set(cnpjB,A);
  await assert.rejects(()=>selectAuthorizedCompanyProfile(f.p,B,f.services),isCode('PROFILE_NOT_AUTHORIZED',403));
});
test('W12: even owner cannot authorize an unknown capability',async()=>{
  const f=fixture();
  await assert.rejects(()=>authorizeCompanyProfile(f.p,A,f.services,'admin:delete'),
    isCode('PROFILE_NOT_AUTHORIZED',403));
});
test('W12: forged companyId and resource path cannot cross tenant',async()=>{
  const f=fixture();
  await assert.rejects(()=>selectAuthorizedCompanyProfile(f.p,'../empresa_b',f.services),isCode('PROFILE_INVALID_INPUT',400));
  const selected=await selectAuthorizedCompanyProfile(f.p,A,f.services);
  assert.throws(()=>assertSameProfileResource(selected,{companyId:B,workspaceId:B}),isCode('PROFILE_NOT_AUTHORIZED',403));
  assertSameProfileResource(selected,{companyId:A,workspaceId:A});
});
test('W12: sector/founder/provider mismatch never falls back to company',async()=>{
  const f=fixture();
  for (const change of [{accountType:'sector'},{accountType:'platformAdmin'},{provider:'google.com'},
    {active:false},{emailVerified:false},{verified:false}]) {
    await assert.rejects(()=>listAuthorizedCompanyProfiles({...f.p,...change},f.services),isCode('PROFILE_IDENTITY_FORBIDDEN',403));
  }
});
test('W12: directory outage yields 503 rather than partial list',async()=>{
  const f=fixture();
  f.services.readWorkspace=async id => {if(id===B)throw Error('network');return f.workspaces.get(id)};
  await assert.rejects(()=>listAuthorizedCompanyProfiles(f.p,f.services),isCode('PROFILE_DIRECTORY_UNAVAILABLE',503));
});
test('W12: malformed discovery index fails closed',async()=>{
  const f=fixture();
  f.services.listCandidateIds=async()=>[A,'../../platformAccounts'];
  await assert.rejects(()=>listAuthorizedCompanyProfiles(f.p,f.services),isCode('PROFILE_INTEGRITY_ERROR',503));
});
test('W12: no W10 adapter = 503; no simulated profile switch',async()=>{
  const f=fixture();
  await assert.rejects(()=>listAuthorizedCompanyProfiles(f.p,{}),isCode('PROFILE_INTEGRATION_REQUIRED',503));
  await assert.rejects(()=>selectAuthorizedCompanyProfile(f.p,A,{}),isCode('PROFILE_INTEGRATION_REQUIRED',503));
});
function registration(f) {
  const unique=new Map(),byKey=new Map();
  let commits=0;
  return {
    ...f.services,
    verifyLegalRepresentation: async ({uid,cnpj})=>uid===f.p.uid && cnpj===cnpjC,
    commitAdditionalCompany: async cmd=>{
      // Demo adapter: critical section with no await simulates Firestore atomic CAS.
      const key=cmd.uid+':'+cmd.idempotencyKey;
      if(byKey.has(key)) {
        const old=byKey.get(key);
        if(old.hash!==cmd.requestHash)throw new ProfileError('PROFILE_CONFLICT',409);
        return {...old.result,outcome:'replayed'};
      }
      if(unique.has(cmd.cnpj)||[...unique.values()].includes(cmd.proposedCompanyId)) {
        throw new ProfileError('PROFILE_CONFLICT',409);
      }
      commits++;
      unique.set(cmd.cnpj,cmd.proposedCompanyId);
      const result={companyId:cmd.proposedCompanyId,cnpj:cmd.cnpj,outcome:'created'};
      byKey.set(key,{hash:cmd.requestHash,result});
      return result;
    },
    getCommitCount:()=>commits,
  };
}
const extra=(key='idemkey_123456789')=>({primaryCompanyId:A,proposedCompanyId:C,
  cnpj:cnpjC,legalName:'Empresa C LTDA',idempotencyKey:key});
test('W12: second CNPJ registration reuses same UID, with verified representation',async()=>{
  const f=fixture(),services=registration(f);
  const result=await requestAdditionalCompany(f.p,extra(),services);
  assert.equal(result.outcome,'created');
  assert.equal(result.companyId,C);
  assert.equal(services.getCommitCount(),1);
});
test('W12: owner consent is insufficient without independent representation verification',async()=>{
  const f=fixture(),services=registration(f);
  services.verifyLegalRepresentation=async()=>false;
  await assert.rejects(()=>requestAdditionalCompany(f.p,extra(),services),isCode('PROFILE_REPRESENTATION_REQUIRED',403));
  assert.equal(services.getCommitCount(),0);
});
test('W12: member of A may not enroll a second company as owner',async()=>{
  const f=fixture(),services=registration(f),user=principal('uid-only-a','a@example.com');
  f.members.set(A+':'+user.uid,{companyId:A,workspaceId:A,firebaseUid:user.uid,email:user.email,status:'active',roles:['admin']});
  await assert.rejects(()=>requestAdditionalCompany(user,extra(),services),isCode('PROFILE_NOT_AUTHORIZED',403));
});
test('W12: repeated idempotency key replays without duplicate creation',async()=>{
  const f=fixture(),services=registration(f);
  const first=await requestAdditionalCompany(f.p,extra(),services);
  const second=await requestAdditionalCompany(f.p,extra(),services);
  assert.equal(first.outcome,'created');
  assert.equal(second.outcome,'replayed');
  assert.equal(services.getCommitCount(),1);
});
test('W12: same idempotency key with changed data is a conflict',async()=>{
  const f=fixture(),services=registration(f);
  await requestAdditionalCompany(f.p,extra(),services);
  await assert.rejects(()=>requestAdditionalCompany(f.p,{...extra(),legalName:'Outra'},services),isCode('PROFILE_CONFLICT',409));
});
test('W12: concurrent register attempts for same CNPJ cannot both create',async()=>{
  const f=fixture(),services=registration(f);
  const settled=await Promise.allSettled([requestAdditionalCompany(f.p,extra('idemkey_123456789'),services),
    requestAdditionalCompany(f.p,extra('idemkey_987654321'),services)]);
  assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(settled.filter(x=>x.status==='rejected').length,1);
  assert.equal(services.getCommitCount(),1);
});
test('W12: missing atomic W10 adapter fails closed',async()=>{
  const f=fixture(),services=registration(f);
  delete services.commitAdditionalCompany;
  await assert.rejects(()=>requestAdditionalCompany(f.p,extra(),services),isCode('PROFILE_INTEGRATION_REQUIRED',503));
});
test('W12: signed profile cookie binds UID, auth_time, and expiry',()=>{
  const secret=randomBytes(32).toString('base64url'),session={uid:'uid-dual',authTime:1234567};
  const token=signProfileSelection(B,session,secret,2000000);
  assert.equal(verifyProfileSelection(token,session,secret,2000100),B);
  assert.throws(()=>verifyProfileSelection(token,{...session,uid:'different'},secret,2000100),isCode('PROFILE_NOT_AUTHORIZED',403));
  assert.throws(()=>verifyProfileSelection(token,{...session,authTime:1234568},secret,2000100),isCode('PROFILE_NOT_AUTHORIZED',403));
  assert.throws(()=>verifyProfileSelection(token,session,secret,2000600),isCode('PROFILE_NOT_AUTHORIZED',403));
  assert.throws(()=>verifyProfileSelection(token+'x',session,secret,2000100),isCode('PROFILE_NOT_AUTHORIZED',403));
});
test('W12: unsigned/missing-secret cookie is forbidden and browser flags are secure',()=>{
  const session={uid:'uid-dual',authTime:123};
  assert.throws(()=>signProfileSelection(B,session,'unsafe'),isCode('PROFILE_INTEGRATION_REQUIRED',503));
  const token=signProfileSelection(B,session,randomBytes(32).toString('base64url'));
  const cookie=profileSetCookie(token);
  assert.match(cookie,/__Host-emprovex-company-profile=/);
  assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
  assert.match(profileClearCookie(),/Max-Age=0/);
});
