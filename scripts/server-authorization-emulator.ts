#!/usr/bin/env node
/**
 * End-to-end authorization proof using exclusively disposable emulators.
 * Tests real Firebase Auth ID tokens + server-side account/workspace lookup
 * through IAM-emulated REST; no credentials or production data are used.
 */
import assert from 'node:assert/strict';
import { verifyPlatformPrincipal, PlatformAuthorizationError } from '../lib/server/platformAuthorization';
import { evaluateServerAuthorization } from '../lib/server/authorizationPolicy';
import { verifyWarehouseRequest, assertWarehouseAuthorization } from '../lib/server/warehouseAccess';

process.env.EMPROVEX_E2E_SERVER_AUTH = '1';
process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID = 'demo-emprovex-security';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const project='demo-emprovex-security';
const auth='http://127.0.0.1:9099';
const fs='http://127.0.0.1:8080/v1/projects/'+project+'/databases/(default)/documents';
const pass='Strong-emulator-only-Pass2026!';
const email='authz-sector@example.test',ws='ws-authorization-demo',ug='160500';

async function authApi(endpoint:string, body:Record<string,unknown>, admin=false) {
  const resp=await fetch(auth+'/identitytoolkit.googleapis.com/v1/'+endpoint+'?key=fake-api-key',{
    method:'POST',
    headers:{'content-type':'application/json',...(admin?{authorization:'Bearer owner'}:{})},
    body:JSON.stringify(body),
  });
  const result=await resp.json() as Record<string,any>;
  assert.equal(resp.ok,true,'Auth emulator '+endpoint+': '+JSON.stringify(result));
  return result;
}
async function document(path:string, values:Record<string,string>) {
  const fields=Object.fromEntries(Object.entries(values).map(([key,v])=>[key,{stringValue:v}]));
  const response=await fetch(fs+'/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},
    body:JSON.stringify({fields}),
  });
  assert.equal(response.ok,true,'Firestore seed: '+path+' '+await response.text());
}
async function verifyEmail(idToken:string, address:string) {
  await authApi('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken});
  const response=await fetch(auth+'/emulator/v1/projects/'+project+'/oobCodes');
  assert.equal(response.ok,true);
  const codes=await response.json() as {oobCodes?:Array<{email:string,requestType:string,oobLink:string}>};
  const match=[...(codes.oobCodes||[])].reverse()
    .find(x=>x.email===address&&x.requestType==='VERIFY_EMAIL');
  assert.ok(match?.oobLink,'verification link missing');
  assert.equal((await fetch(match.oobLink)).ok,true,'verification failed');
}
async function bearer(address:string):Promise<{token:string,uid:string}> {
  const signup=await authApi('accounts:signUp',{
    email:address,password:pass,returnSecureToken:true,
  });
  await verifyEmail(signup.idToken,address);
  const signed=await authApi('accounts:signInWithPassword',{
    email:address,password:pass,returnSecureToken:true,
  });
  return {token:'Bearer '+signed.idToken,uid:signed.localId};
}
async function rejected(fn:()=>Promise<unknown>,status=403) {
  await assert.rejects(fn,(error:unknown)=>{
    assert.ok(error instanceof PlatformAuthorizationError || (typeof error==='object'&&error!==null&&'status' in error));
    assert.equal((error as {status:number}).status,status);
    return true;
  });
}
async function main() {
  const sector=await bearer(email);
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  await document('workspaces/'+ws,{
    id:ws,status:'active',authorizedEmail:email,ug,
  });
  const valid=await verifyPlatformPrincipal(sector.token);
  assert.equal(valid.uid,sector.uid);
  assert.equal(valid.role,'sector');
  assert.equal(valid.workspaceId,ws);
  assert.equal(valid.ug,ug);
  assert.deepEqual(evaluateServerAuthorization(valid,{capability:'warehouse.read',workspaceId:ws}),{allowed:true});
  assertWarehouseAuthorization({...valid,claimsUpdated:false},{capability:'warehouse.command',workspaceId:ws,operation:'TRANSFER'});
  assert.throws(()=>assertWarehouseAuthorization({...valid,claimsUpdated:false},{
    capability:'warehouse.command',workspaceId:'other-workspace',operation:'TRANSFER',
  }),/Operação não autorizada/);
  console.log('PASS: verified Firebase token + active IAM directory + tenant-scoped command');

  const intruder=await bearer('authz-intruder@example.test');
  await rejected(()=>verifyPlatformPrincipal(intruder.token));
  console.log('PASS: no directory entry denied');

  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:intruder.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: UID mismatch denied');
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'disabled',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: disabled account denied');
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  await document('workspaces/'+ws,{
    id:ws,status:'disabled',authorizedEmail:email,ug,
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: disabled workspace denied');
  await document('workspaces/'+ws,{
    id:ws,status:'active',authorizedEmail:email,ug:'999999',
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: UG mismatch denied');
  await document('workspaces/'+ws,{
    id:ws,status:'active',authorizedEmail:email,ug,
  });
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'google.com',
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: wrong provider denied');
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  const final=await verifyPlatformPrincipal(sector.token);
  assert.equal(final.workspaceId,ws);
  console.log('PASS: restored active identity');

  const guest=await rejected(()=>verifyPlatformPrincipal(null),401);
  void guest;
  console.log('PASS: unauthenticated denied');
  // This checks authorization in Warehouse without invoking claims materialization
  // for the sector; that separate behavior is covered by the existing Warehouse R2 smoke.
  assert.throws(()=>assertWarehouseAuthorization({...final,claimsUpdated:false},{
    capability:'warehouse.command',workspaceId:ws,operation:'LEDGER_MOVEMENT',
  }),/não autorizada/);
  console.log('PASS: arbitrary ledger mutation denied');
  console.log('SERVER_AUTHORIZATION_EMULATOR_PASS');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
