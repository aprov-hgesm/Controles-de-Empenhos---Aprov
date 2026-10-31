import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// EMPROVEX R4: build-only Vercel -> Google Secret Manager transfer.
// NEVER expose via HTTP, never print secrets or tokens, never merge this bridge to main.
const PROJECT_ID = 'gen-lang-client-0982077967';
const PROJECT_NUMBER = '943599311487';
const TEAM = 'aprov-hgesms-projects';
const VERCEL_PROJECT = 'controles-de-empenhos-aprov';
const POOL = 'emprovex-vercel-r4';
const PROVIDER = 'vercel-production';
const MIGRATOR_EMAIL = `emprovex-r4-migrator@${PROJECT_ID}.iam.gserviceaccount.com`;
const EXPECTED_SUBJECT = `owner:${TEAM}:project:${VERCEL_PROJECT}:environment:production`;
const EXPECTED_ISSUER = `https://oidc.vercel.com/${TEAM}`;
const EXPECTED_AUDIENCE = `https://vercel.com/${TEAM}`;
const EXPECTED_APPROVAL = 'EMPROVEX_R4_TRANSFER_20261030';
const SECRETS = Object.freeze([
  ['INFINITEPAY_API_KEY','emprovex-infinitepay-api-key'],
  ['INFINITEPAY_ORDER_SECRET','emprovex-infinitepay-order-secret'],
  ['INFINITEPAY_WEBHOOK_TOKEN','emprovex-infinitepay-webhook-token']
]);

function assert(check,code){if(!check)throw new Error(code)}
function claims(jwt) {
  const parts=jwt.split('.');
  assert(parts.length===3,'R4_OIDC_MALFORMED');
  return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
}
function safeContext(env) {
  assert(env.VERCEL==='1','R4_ONLY_VERCEL_BUILD');
  assert(env.VERCEL_ENV==='production','R4_ONLY_VERCEL_PRODUCTION');
  assert(env.EMPROVEX_R4_TRANSFER_CONFIRMATION===EXPECTED_APPROVAL,'R4_NO_EXPLICIT_APPROVAL');
  assert(typeof env.VERCEL_OIDC_TOKEN==='string' && env.VERCEL_OIDC_TOKEN.length>100,'R4_OIDC_MISSING');
  const c=claims(env.VERCEL_OIDC_TOKEN),now=Math.floor(Date.now()/1000);
  assert(c.iss===EXPECTED_ISSUER,'R4_WRONG_ISSUER');
  assert(c.sub===EXPECTED_SUBJECT,'R4_WRONG_SUBJECT');
  assert(c.aud===EXPECTED_AUDIENCE||(Array.isArray(c.aud)&&c.aud.includes(EXPECTED_AUDIENCE)),'R4_WRONG_AUDIENCE');
  assert(Number.isInteger(c.exp)&&c.exp>now,'R4_EXPIRED_OIDC');
  assert(Number.isInteger(c.iat)&&c.iat<=now+60,'R4_BAD_OIDC_IAT');
  // Unverified claim checks are guardrails; Google STS validates OIDC signature, issuer, audience.
}
function values(env){
  return SECRETS.map(([name,id])=>{
    const value=env[name];
    assert(typeof value==='string'&&value.length>=16,`R4_MISSING_${name}`);
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
  },'R4_STS');
  assert(typeof first.access_token==='string','R4_STS_NO_TOKEN');
  const second=await api(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(MIGRATOR_EMAIL)}:generateAccessToken`,{
      method:'POST',
      headers:{Authorization:`Bearer ${first.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify({scope:['https://www.googleapis.com/auth/cloud-platform'],lifetime:'600s'})
    },'R4_IMPERSONATION');
  assert(typeof second.accessToken==='string','R4_NO_ACCESS_TOKEN');
  return second.accessToken;
}
async function empty(id,token){
  const p=await api(`https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${id}/versions?pageSize=100`,{
    headers:{Authorization:`Bearer ${token}`}
  },'R4_PREFLIGHT');
  assert((!Array.isArray(p.versions)||p.versions.length===0)&&!p.nextPageToken,`R4_ALREADY_HAS_VERSION_${id}`);
}
async function add(secret,token){
  const p=await api(`https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secret.id}:addVersion`,{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({payload:{data:Buffer.from(secret.value,'utf8').toString('base64')}})
  },'R4_ADD_VERSION');
  assert(typeof p.name==='string' && p.name.startsWith(`projects/${PROJECT_NUMBER}/secrets/${secret.id}/versions/`),
    `R4_UNEXPECTED_VERSION_${secret.id}`);
  return p.name.split('/').at(-1);
}
async function main(env=process.env){
  if(env.EMPROVEX_R4_TRANSFER_CONFIRMATION!==EXPECTED_APPROVAL){
    console.info('R4_BRIDGE: SKIPPED (not explicitly enabled)');
    return;
  }
  safeContext(env);
  const secrets=values(env);
  const token=await googleToken(env.VERCEL_OIDC_TOKEN);
  for(const secret of secrets)await empty(secret.id,token); // all preflights before any writes
  for(const secret of secrets){
    const version=await add(secret,token);
    console.info(`R4_BRIDGE: CREATED ${secret.id} version ${version}`);
  }
  console.info('R4_BRIDGE: PASS (no secrets logged; no billing calls)');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{
    console.error(`R4_BRIDGE: STOPPED ${typeof e?.message==='string'?e.message:'UNKNOWN_ERROR'}`);
    process.exitCode=1;
  });
}
export {main,safeContext,values,SECRETS,MIGRATOR_EMAIL};
