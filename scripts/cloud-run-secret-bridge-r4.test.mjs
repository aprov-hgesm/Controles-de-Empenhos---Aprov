import test from 'node:test';
import assert from 'node:assert/strict';
import {values,safeContext,SECRETS,main} from './cloud-run-secret-bridge-r4.mjs';

const now=Math.floor(Date.now()/1000);
const claims={iss:'https://oidc.vercel.com/aprov-hgesms-projects',
  sub:'owner:aprov-hgesms-projects:project:controles-de-empenhos-aprov:environment:production',
  aud:'https://vercel.com/aprov-hgesms-projects',iat:now-10,exp:now+360};
const jwt=(c)=>['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify(c)).toString('base64url'),'signature'].join('.');
const context={VERCEL:'1',VERCEL_ENV:'production',
  EMPROVEX_R4_TRANSFER_CONFIRMATION:'EMPROVEX_R4_TRANSFER_20261030',
  VERCEL_OIDC_TOKEN:jwt(claims)};
test('R4: exactly three secret keys',()=>{
 assert.deepEqual(SECRETS.map(x=>x[0]),['INFINITEPAY_API_KEY','INFINITEPAY_ORDER_SECRET','INFINITEPAY_WEBHOOK_TOKEN']);
 const input=Object.fromEntries(SECRETS.map(([k])=>[k,'simulated-not-a-secret-123456']));
 assert.deepEqual(values(input).map(x=>x.id),
 ['emprovex-infinitepay-api-key','emprovex-infinitepay-order-secret','emprovex-infinitepay-webhook-token']);
});
test('R4: no transfer with missing keys',()=>{
 assert.throws(()=>values({}),/R4_MISSING_INFINITEPAY_API_KEY/);
});
test('R4: refuses non-Vercel, non-production and missing approval',()=>{
 assert.throws(()=>safeContext({...context,VERCEL:'0'}),/R4_ONLY_VERCEL_BUILD/);
 assert.throws(()=>safeContext({...context,VERCEL_ENV:'preview'}),/R4_ONLY_VERCEL_PRODUCTION/);
 assert.throws(()=>safeContext({...context,EMPROVEX_R4_TRANSFER_CONFIRMATION:'0'}),/R4_NO_EXPLICIT_APPROVAL/);
});
test('R4: rejects wrong issuer, subject, audience, expired token',()=>{
 for(const change of [{sub:'wrong'},{iss:'wrong'},{aud:'wrong'},{exp:now-1}]){
   assert.throws(()=>safeContext({...context,VERCEL_OIDC_TOKEN:jwt({...claims,...change})}));
 }
});
test('R4: absent approval is a no-op',async()=>{
 const output=[];const old=console.info;console.info=(...a)=>output.push(a.join(' '));
 try{await main({})}finally{console.info=old}
 assert.equal(output.length,1);
 assert.match(output[0],/SKIPPED/);
});
