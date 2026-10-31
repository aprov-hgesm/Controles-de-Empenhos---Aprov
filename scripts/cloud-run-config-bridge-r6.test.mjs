import test from 'node:test';
import assert from 'node:assert/strict';
import {values,safeContext,SECRETS,main,MIGRATOR_EMAIL} from './cloud-run-config-bridge-r6.mjs';

const now=Math.floor(Date.now()/1000);
const claims={iss:'https://oidc.vercel.com/aprov-hgesms-projects',
  sub:'owner:aprov-hgesms-projects:project:controles-de-empenhos-aprov:environment:production',
  aud:'https://vercel.com/aprov-hgesms-projects',iat:now-10,exp:now+360};
const jwt=(c)=>['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify(c)).toString('base64url'),'signature'].join('.');
const context={VERCEL:'1',VERCEL_ENV:'production',
  EMPROVEX_R6_TRANSFER_CONFIRMATION:'EMPROVEX_R6_TRANSFER_20261031',
  VERCEL_OIDC_TOKEN:jwt(claims)};
const expected=[
  'EMPROVEX_BILLING_QA_WORKSPACE_ID',
  'EMPROVEX_BILLING_RULES_CERTIFIED',
  'EMPROVEX_BILLING_ENFORCEMENT_ENABLED',
  'INFINITEPAY_BILLING_PILOT_WORKSPACE_ID',
  'INFINITEPAY_BILLING_SCOPE',
  'INFINITEPAY_BILLING_ENABLED',
  'EMPROVEX_BILLING_PUBLIC_ORIGIN',
  'INFINITEPAY_HANDLE'
];
test('R6: exact eight-key allowlist',()=>{
 assert.deepEqual(SECRETS.map(x=>x[0]),expected);
 assert.equal(new Set(SECRETS.map(x=>x[1])).size,8);
 assert.ok(SECRETS.every(x=>x[1].startsWith('emprovex-')));
});
test('R6: accepts short boolean controls without exposing values',()=>{
 const mock=Object.fromEntries(expected.map(k=>[k,k.includes('ENABLED')?'1':'mock-value']));
 const parsed=values(mock);
 assert.equal(parsed.length,8);
 assert.deepEqual(parsed.map(x=>x.id),SECRETS.map(x=>x[1]));
});
test('R6: rejects missing keys',()=>{
 assert.throws(()=>values({}),/R6_MISSING_EMPROVEX_BILLING_QA_WORKSPACE_ID/);
});
test('R6: fails closed outside Vercel Production and without explicit confirmation',()=>{
 assert.throws(()=>safeContext({...context,VERCEL:'0'}),/R6_ONLY_VERCEL_BUILD/);
 assert.throws(()=>safeContext({...context,VERCEL_ENV:'preview'}),/R6_ONLY_VERCEL_PRODUCTION/);
 assert.throws(()=>safeContext({...context,EMPROVEX_R6_TRANSFER_CONFIRMATION:''}),/R6_NO_EXPLICIT_APPROVAL/);
});
test('R6: OIDC guards reject different issuer, audience, subject and expiry',()=>{
 for(const change of [{iss:'no'},{aud:'no'},{sub:'no'},{exp:now-1}]){
   assert.throws(()=>safeContext({...context,VERCEL_OIDC_TOKEN:jwt({...claims,...change})}));
 }
});
test('R6: account name valid, migration identity isolated',()=>{
 const id=MIGRATOR_EMAIL.split('@')[0];
 assert.match(id,/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
 assert.equal(MIGRATOR_EMAIL,'emprovex-r6-migrator@gen-lang-client-0982077967.iam.gserviceaccount.com');
});
test('R6: no confirmation means no transfer request',async()=>{
 const out=[];const original=console.info;console.info=(...v)=>out.push(v.join(' '));
 try{await main({})}finally{console.info=original}
 assert.equal(out.length,1);
 assert.match(out[0],/SKIPPED/);
});
