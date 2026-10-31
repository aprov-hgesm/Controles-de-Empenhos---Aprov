import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// EMPROVEX R6: build-only Vercel -> Google Secret Manager transfer.
// NEVER expose via HTTP, never print secrets or tokens, never merge this bridge to main.
const PROJECT_ID = 'gen-lang-client-0982077967';
const PROJECT_NUMBER = '943599311487';
const TEAM = 'aprov-hgesms-projects';
const VERCEL_PROJECT = 'controles-de-empenhos-aprov';
const POOL = 'emprovex-vercel-r6';
const PROVIDER = 'vercel-production';
const MIGRATOR_EMAIL = `emprovex-r6-migrator@${PROJECT_ID}.iam.gserviceaccount.com`;
const EXPECTED_SUBJECT = `owner:${TEAM}:project:${VERCEL_PROJECT}:environment:production`;
const EXPECTED_ISSUER = `https://oidc.vercel.com/${TEAM}`;
const EXPECTED_AUDIENCE = `https://vercel.com/${TEAM}`;
const EXPECTED_APPROVAL = 'EMPROVEX_R6_TRANSFER_20261031';
const SECRETS = Object.freeze([
  ['EMPROVEX_BILLING_QA_WORKSPACE_ID','emprovex-billing-qa-workspace-id'],
  ['EMPROVEX_BILLING_RULES_CERTIFIED','emprovex-billing-rules-certified'],
  ['EMPROVEX_BILLING_ENFORCEMENT_ENABLED','emprovex-billing-enforcement-enabled'],
  ['INFINITEPAY_BILLING_PILOT_WORKSPACE_ID','emprovex-infinitepay-billing-pilot-workspace-id'],
  ['INFINITEPAY_BILLING_SCOPE','emprovex-infinitepay-billing-scope'],
  ['INFINITEPAY_BILLING_ENABLED','emprovex-infinitepay-billing-enabled'],
  ['EMPROVEX_BILLING_PUBLIC_ORIGIN','emprovex-billing-public-origin'],
  ['INFINITEPAY_HANDLE','emprovex-infinitepay-handle']
]);

function assert(check,code){if(!check)throw new Error(code)}
function claims(jwt) {
  const parts=jwt.split('.');
  assert(parts.length===3,'R6_OIDC_MALFORMED');
  return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
}
function safeContext(env) {
  assert(env.VERCEL==='1','R6_ONLY_VERCEL_BUILD');
  assert(env.VERCEL_ENV==='production','R6_ONLY_VERCEL_PRODUCTION');
  assert(env.EMPROVEX_R6_TRANSFER_CONFIRMATION===EXPECTED_APPROVAL,'R6_NO_EXPLICIT_APPROVAL');
  assert(typeof env.VERCEL_OIDC_TOKEN==='string' && env.VERCEL_OIDC_TOKEN.length>100,'R6_OIDC_MISSING');
  const c=claims(env.VERCEL_OIDC_TOKEN),now=Math.floor(Date.now()/1000);
  assert(c.iss===EXPECTED_ISSUER,'R6_WRONG_ISSUER');
  assert(c.sub===EXPECTED_SUBJECT,'R6_WRONG_SUBJECT');
  assert(c.aud===EXPECTED_AUDIENCE||(Array.isArray(c.aud)&&c.aud.includes(EXPECTED_AUDIENCE)),'R6_WRONG_AUDIENCE');
  assert(Number.isInteger(c.exp)&&c.exp>now,'R6_EXPIRED_OIDC');
  assert(Number.isInteger(c.iat)&&c.iat<=now+60,'R6_BAD_OIDC_IAT');
  // Unverified claim checks are guardrails; Google STS validates OIDC signature, issuer, audience.
}
function values(env){
  return SECRETS.map(([name,id])=>{
    const value=env[name];
    assert(typeof value==='string'&&value.length>=1,`R6_MISSING_${name}`);
    return {id,value};
  });
}
async function api(url,opts,code){
  const response=await fetch(url,{...opts,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`${code}_HTTP_${response.status}`); // no response body
  return response.json();
}
async function googleToken(oidc){
  const audience=`//iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}`;
  const form=new URLSearchParams({
    audience,
    grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type:'urn:ietf:params:oauth:token-type:access_token',
    subject_token_type:'urn:ietf:params:oauth:token-type:jwt',
    subject_token:oidc,
    scope:'https://www.googleapis.com/auth/cloud-platform'
  });
  const first=await api('https://sts.googleapis.com/v1/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:form.toString()
  },'R6_STS');
  assert(typeof first.access_token==='string','R6_STS_NO_TOKEN');
  const second=await api(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(MIGRATOR_EMAIL)}:generateAccessToken`,{
      method:'POST',
      headers:{Authorization:`Bearer ${first.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify({scope:['https://www.googleapis.com/auth/cloud-platform'],lifetime:'600s'})
    },'R6_IMPERSONATION');
  assert(typeof second.accessToken==='string','R6_NO_ACCESS_TOKEN');
  return second.accessToken;
}
async function empty(id,token){
  const p=await api(`https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${id}/versions?pageSize=100`,{
    headers:{Authorization:`Bearer ${token}`}
  },'R6_PREFLIGHT');
  assert((!Array.isArray(p.versions)||p.versions.length===0)&&!p.nextPageToken,`R6_ALREADY_HAS_VERSION_${id}`);
}
async function add(secret,token){
  const p=await api(`https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secret.id}:addVersion`,{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({payload:{data:Buffer.from(secret.value,'utf8').toString('base64')}})
  },'R6_ADD_VERSION');
  assert(typeof p.name==='string' && p.name.startsWith(`projects/${PROJECT_NUMBER}/secrets/${secret.id}/versions/`),
    `R6_UNEXPECTED_VERSION_${secret.id}`);
  return p.name.split('/').at(-1);
}
async function main(env=process.env){
  if(env.EMPROVEX_R6_TRANSFER_CONFIRMATION!==EXPECTED_APPROVAL){
    console.info('R6_BRIDGE: SKIPPED (not explicitly enabled)');
    return;
  }
  safeContext(env);
  const secrets=values(env);
  const token=await googleToken(env.VERCEL_OIDC_TOKEN);
  for(const secret of secrets)await empty(secret.id,token); // all preflights before any writes
  for(const secret of secrets){
    const version=await add(secret,token);
    console.info(`R6_BRIDGE: CREATED ${secret.id} version ${version}`);
  }
  console.info('R6_BRIDGE: PASS (no secrets logged; no billing calls)');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{
    console.error(`R6_BRIDGE: STOPPED ${typeof e?.message==='string'?e.message:'UNKNOWN_ERROR'}`);
    process.exitCode=1;
  });
}
export {main,safeContext,values,SECRETS,MIGRATOR_EMAIL};
