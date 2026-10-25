#!/usr/bin/env node
/**
 * W4 independent signed-token integration diagnosis for AuthZ PR370 + main.
 * No production access: only demo Auth/Firestore emulators.
 * Deliberately proves the current mobile operation is safely denied, not permitted.
 */
import assert from 'node:assert/strict';
import {verifyPlatformPrincipal} from '../lib/server/platformAuthorization';
import {assertWarehouseAuthorization} from '../lib/server/warehouseAccess';
import {POST} from '../app/api/central-depositos/operations/route';

const project='demo-emprovex-security',ws='ws-w4-mobile-integration',ug='160500';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'
  ||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'
  ||process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID!==project)
  throw Error('W4_AUTHZ_MOBILE_EMULATOR_ONLY');
process.env.EMPROVEX_E2E_SERVER_AUTH='1';
const A='http://127.0.0.1:9099',F='http://127.0.0.1:8080/v1/projects/'+project+
  '/databases/(default)/documents';
const password='Only-for-isolated-demo2026!';
async function authCall(endpoint,body) {
  const r=await fetch(A+'/identitytoolkit.googleapis.com/v1/'+endpoint+'?key=fake',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
  });
  const data=await r.json();
  assert.equal(r.ok,true,JSON.stringify({endpoint,data}));return data;
}
async function put(path,fields) {
  const r=await fetch(F+'/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer owner'},
    body:JSON.stringify({fields:Object.fromEntries(
      Object.entries(fields).map(([k,v])=>[k,{stringValue:v}]))}),
  });
  assert.equal(r.ok,true,await r.text());
}
const mail='w4-mobile-integration@example.test';
const signup=await authCall('accounts:signUp',{email:mail,password,returnSecureToken:true});
await authCall('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:signup.idToken});
const codes=await (await fetch(A+'/emulator/v1/projects/'+project+'/oobCodes')).json();
const match=[...codes.oobCodes].reverse().find(x=>x.email===mail&&x.requestType==='VERIFY_EMAIL');
assert.ok(match?.oobLink,'emulator verification link missing');
assert.equal((await fetch(match.oobLink)).ok,true);
const signed=await authCall('accounts:signInWithPassword',{
  email:mail,password,returnSecureToken:true,
});
await put('platformAccounts/'+mail,{email:mail,accountType:'sector',status:'active',
  firebaseUid:signed.localId,workspaceId:ws,ug,authProvider:'password'});
await put('workspaces/'+ws,{id:ws,status:'active',authorizedEmail:mail,ug});
const token='Bearer '+signed.idToken;
const principal=await verifyPlatformPrincipal(token);
assert.equal(principal.uid,signed.localId);
assert.equal(principal.workspaceId,ws);
assert.equal(principal.ug,ug);
const actor={uid:principal.uid,email:principal.email,workspaceId:ws,ug,claimsUpdated:false};
assert.doesNotThrow(()=>assertWarehouseAuthorization(actor,{
  capability:'warehouse.command',workspaceId:ws,operation:'WITHDRAWAL_FINALIZE',
}));
assert.throws(()=>assertWarehouseAuthorization(actor,{
  capability:'warehouse.command',workspaceId:ws,operation:'WITHDRAWAL_FINALIZE_MOBILE',
}),/Operação não autorizada/);
console.log('PASS AUTHZ: canonical withdrawal passes policy; mobile alias denied by active allowlist');
const request=async(operation,workspaceId=ws)=>POST(new Request(
  'http://localhost/api/central-depositos/operations',{
    method:'POST',headers:{authorization:token,'content-type':'application/json'},
    body:JSON.stringify({workspaceId,operation,input:{
      schemaVersion:'warehouse_withdrawal_command_v3',
      withdrawalId:'wd_'+'1'.repeat(32),
      destinationId:'dest_'+'2'.repeat(32),lines:[],
    }}),
  }));
const validIdentityDenied=await request('WITHDRAWAL_FINALIZE_MOBILE');
assert.equal(validIdentityDenied.status,403);
const body=await validIdentityDenied.json();
assert.equal(body?.error,'WAREHOUSE_SERVER_UNAUTHORIZED');
console.log('PASS AUTHZ: authenticated genuine sector mobile action receives expected fail-closed HTTP 403');
const wrongScope=await request('WITHDRAWAL_FINALIZE_MOBILE','other-workspace');
assert.equal(wrongScope.status,403);
const ledger=await request('LEDGER_MOVEMENT');
assert.equal(ledger.status,403);
console.log('PASS AUTHZ: forged workspace and generic ledger denied before writes');
console.log('W4_AUTHZ_MOBILE_INTEROPERABILITY_CLASSIFIED_SAFE_DENIAL');
