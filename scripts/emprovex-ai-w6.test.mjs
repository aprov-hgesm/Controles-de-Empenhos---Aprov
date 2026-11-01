#!/usr/bin/env node
/** W6 focused contract/security tests. No real GCP requests or customer data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const cache=new Map();
function load(path,mocks={}){
 const file=resolve(root,path);
 if(cache.has(file))return cache.get(file).exports;
 assert.ok(existsSync(file),'Source available: '+path);
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const importer=(id)=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  if(id.startsWith('.')){
   const basename=resolve(dirname(file),id);
   if(extname(basename)==='.json')return require(basename);
   const target=extname(basename)?basename:existsSync(basename+'.ts')?basename+'.ts':resolve(basename,'index.ts');
   return load(target,mocks);
  }
  return require(id);
 };
 new Function('require','module','exports','process','Buffer','fetch','AbortSignal',
  code)(importer,module,module.exports,process,Buffer,
   (...args)=>globalThis.fetch(...args),AbortSignal);
 return module.exports;
}
const candidateEnv={
 EMPROVEX_AI_W45_ENABLED:'1',EMPROVEX_AI_HOMOLOGATION_ENABLED:'1',
 EMPROVEX_AI_LFM3_ENABLED:'1',
 K_SERVICE:'emprovex-ai-w6-homologation',
 K_CONFIGURATION:'emprovex-ai-w6-homologation',
 K_REVISION:'emprovex-ai-w6-homologation-00001-abc'
};
Object.assign(process.env,candidateEnv);
delete process.env.VERCEL;delete process.env.VERCEL_ENV;
process.env.EMPROVEX_AI_LFM3_URL='https://emprovex-ai-inference-example.a.run.app/';
process.env.EMPROVEX_AI_W45_CONTEXT_SECRET='emprovex-w6-synthetic-context-secret-1234567890';
const env=load('lib/emprovex-ai/integration/environment.ts');
const model=load('lib/emprovex-ai/integration/lfm3.ts');
const {interpret,validateModelCandidate}=load('lib/emprovex-ai/context/index.ts');
const {guardLfm3Candidate}=load('lib/emprovex-ai/integration/lfm3Guard.ts');
test('Cloud Run gate requires exact separate W6 service and approval flags',()=>{
 assert.equal(env.aiExperimentalEnabled(candidateEnv),true);
 assert.equal(env.aiLfm3Enabled(candidateEnv),true);
 for(const bad of [
  {},{...candidateEnv,K_SERVICE:'emprovex'},
  {...candidateEnv,K_SERVICE:'emprovex-cloudrun-candidate'},
  {...candidateEnv,K_CONFIGURATION:'emprovex'},
  {...candidateEnv,K_REVISION:'emprovex-00001-abc'},
  {...candidateEnv,EMPROVEX_AI_HOMOLOGATION_ENABLED:'0'},
  {...candidateEnv,EMPROVEX_AI_LFM3_ENABLED:'0'},
  {...candidateEnv,VERCEL:'1',VERCEL_ENV:'preview'},
 ]){
  assert.equal(env.aiLfm3Enabled(bad),false,JSON.stringify(bad));
 }
});
test('W6 hosted candidate fails closed on project, emulator, and credentials',()=>{
 const isolation=load('lib/emprovex-ai/integration/w6Isolation.ts',{
  jose:{createRemoteJWKSet:()=>({}),jwtVerify:async()=>({payload:{sub:'uid',
   email:'user@example.test',email_verified:true,firebase:{sign_in_provider:'password'}}})},
  '../../server/firebaseFounderAuth':{FounderAuthError:class FounderAuthError extends Error{}}
 });
 const env={...candidateEnv,EMPROVEX_AI_W6_FIREBASE_PROJECT_ID:'emprovex-w6-test-2026',
  EMPROVEX_AI_W6_CORE_DATABASE_ID:'(default)',
  EMPROVEX_AI_W6_WAREHOUSE_DATABASE_ID:'emprovex-warehouse'};
 assert.deepEqual(isolation.w6DataTarget(env),{
  projectId:'emprovex-w6-test-2026',coreDatabaseId:'(default)',
  warehouseDatabaseId:'emprovex-warehouse'});
 assert.equal(isolation.w6DataTarget({...env,K_SERVICE:'other',
   K_CONFIGURATION:'other',K_REVISION:'other-00001-ab'}),null);
 for(const bad of [
  {...env,EMPROVEX_AI_W6_FIREBASE_PROJECT_ID:undefined},
  {...env,EMPROVEX_AI_W6_FIREBASE_PROJECT_ID:'gen-lang-client-0982077967'},
  {...env,EMPROVEX_AI_W6_FIREBASE_PROJECT_ID:'demo-emprovex-security'},
  {...env,EMPROVEX_AI_W6_WAREHOUSE_DATABASE_ID:undefined},
  {...env,FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:'{"private_key":"no"}'},
  {...env,GOOGLE_APPLICATION_CREDENTIALS:'/tmp/key.json'},
  {...env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'},
  {...env,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'},
  {...env,EMPROVEX_E2E_SERVER_AUTH:'1'},
  {...env,K_CONFIGURATION:'wrong'}
 ])assert.throws(()=>isolation.w6DataTarget(bad),/AI_W6_ISOLATION_NOT_CONFIGURED/);
 const old={};
 const vars=Object.keys(env);
 for(const key of vars){old[key]=process.env[key];process.env[key]=env[key];}
 const fetchWas=globalThis.fetch;
 return (async()=>{
  const calls=[];
  globalThis.fetch=async(url)=>{
   calls.push(String(url));
   if(String(url).endsWith('/email'))return {ok:true,text:async()=> 'not-authorized@example.test'};
   return {ok:true,text:async()=> '{"access_token":"ya29.synthetic-token-good"}'};
  };
  await assert.rejects(()=>isolation.getW6GoogleAccessToken(),/AI_W6_RUNTIME_IDENTITY_FORBIDDEN/);
  assert.equal(calls.some(x=>x.includes('firestore.googleapis.com')),false);
  globalThis.fetch=async(url)=>{
   calls.push(String(url));
   return {ok:true,text:async()=>String(url).endsWith('/email')?
    'emprovex-ai-w6-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com':
    '{"access_token":"ya29.synthetic-token-good"}'};
  };
  assert.equal(await isolation.getW6GoogleAccessToken(),'ya29.synthetic-token-good');
  assert.equal(calls.some(x=>x.includes('/token')),true);
  const verified=await isolation.verifyW6FirebaseRequest('Bearer test-verified-token');
  assert.equal(verified.email,'user@example.test');
  await assert.rejects(()=>isolation.verifyW6FirebaseRequest('Bearer invalid two spaces'));
  return isolation;
 })().finally(()=>{
   globalThis.fetch=fetchWas;
   for(const key of vars)old[key]===undefined?delete process.env[key]:process.env[key]=old[key];
 });
});
test('W6 Firestore Core and Warehouse target only the isolated project',async()=>{
 const w6={projectId:'emprovex-w6-test-2026',coreDatabaseId:'(default)',
  warehouseDatabaseId:'emprovex-warehouse'};
 const reader=load('lib/emprovex-ai/reader.ts',{
  './integration/w6Isolation':{w6DataTarget:()=>w6},
  '../server/warehouseFirestoreTransaction':{
   warehouseAdminBatchRead:async()=>{throw Error('PROD_WAREHOUSE_FORBIDDEN');},
   warehouseAdminReadScopedQuery:async()=>{throw Error('PROD_WAREHOUSE_FORBIDDEN');}
  }
 });
 const access={uid:'uid',email:'user@example.test',workspaceId:'sector-ai-a',
  ug:'160416',googleToken:'test-managed-token'};
 const former=globalThis.fetch, urls=[];
 globalThis.fetch=async(url,options={})=>{
  const target=String(url);urls.push(target);
  assert.match(target,/^https:\/\/firestore.googleapis.com\/v1\/projects\/emprovex-w6-test-2026\/databases\//);
  assert.equal(options.headers.authorization,'Bearer test-managed-token');
  if(target.endsWith('/workspaces/sector-ai-a'))
   return {ok:true,status:200,json:async()=>({name:'projects/emprovex-w6-test-2026/databases/(default)/documents/workspaces/sector-ai-a',
    fields:{status:{stringValue:'active'}}})};
  if(target.endsWith('/platformAccounts/user%40example.test'))
   return {ok:true,status:200,json:async()=>({name:'projects/emprovex-w6-test-2026/databases/(default)/documents/platformAccounts/user@example.test',
    fields:{email:{stringValue:'user@example.test'}}})};
  if(target.endsWith('/warehouse/sector-ai-a/materials/mat_123'))
   return {ok:true,status:200,json:async()=>({name:'projects/emprovex-w6-test-2026/databases/emprovex-warehouse/documents/warehouse/sector-ai-a/materials/mat_123',
    fields:{workspaceId:{stringValue:'sector-ai-a'},ug:{stringValue:'160416'}}})};
  if(target.endsWith('/warehouse/sector-ai-a:runQuery'))
   return {ok:true,status:200,json:async()=>([{document:{
    name:'projects/emprovex-w6-test-2026/databases/emprovex-warehouse/documents/warehouse/sector-ai-a/materials/mat_123',
    fields:{workspaceId:{stringValue:'sector-ai-a'},ug:{stringValue:'160416'}}}}])};
  throw Error('unexpected target '+target);
 };
 try{
  assert.equal((await reader.coreDocument('workspaces/sector-ai-a',access.googleToken)).status,'active');
  assert.equal((await reader.coreDocument('platformAccounts/user@example.test',access.googleToken)).email,'user@example.test');
  assert.equal((await reader.warehouseDocument(access,'materials','mat_123')).id,'mat_123');
  const queried=await reader.warehouseQuery(access,'materials',null,21);
  assert.equal(queried.rows.length,1);
  assert.equal(queried.rows[0].id,'mat_123');
  assert.equal(urls.length,4);
 }finally{globalThis.fetch=former;}
});

test('IAM metadata token and Ollama JSON mode, think=false, output/time bounds',async()=>{
 const previous=globalThis.fetch,previousTimeout=AbortSignal.timeout;
 const timeoutValues=[];
 AbortSignal.timeout=(ms)=>{timeoutValues.push(ms);return previousTimeout(ms);};
 let requests=[];
 globalThis.fetch=async(url,options)=>{
  requests.push({url:String(url),options});
  if(requests.length===1)return {ok:true,text:async()=> 'aa.bb.cc'};
  return {ok:true,text:async()=>JSON.stringify({done_reason:'stop',
   message:{content:JSON.stringify({intent:'supplier_contact_find',params:{nameQuery:'fornecedor Alfa'}})}})};
 };
 try {
  const interpreted=interpret({message:'Detalhe o fornecedor Alfa',now:new Date()});
  assert.equal(interpreted.route,'MODEL_ELIGIBLE');
  const proposal=await model.proposeWithLfm3(interpreted.model);
  assert.deepEqual(proposal,{intent:'supplier_contact_find',params:{nameQuery:'fornecedor Alfa'}});
  assert.equal(requests.length,2);
  assert.match(requests[0].url,/metadata.google.internal.*identity\?audience=/);
  assert.equal(requests[0].options.headers['Metadata-Flavor'],'Google');
  assert.equal(requests[1].url,'https://emprovex-ai-inference-example.a.run.app/api/chat');
  assert.equal(requests[1].options.headers.authorization,'Bearer aa.bb.cc');
  const body=JSON.parse(requests[1].options.body);
  assert.equal(body.model,'lfm3:1.7b-q4_K_M');
  assert.equal(body.stream,false);assert.equal(body.think,false);
  assert.equal(body.options.num_predict,128);
  assert.equal(body.options.temperature,0);
  assert.equal(body.format.additionalProperties,false);
  assert.ok(requests[1].options.signal);
  assert.deepEqual(timeoutValues,[1800,30000]);
 }finally{globalThis.fetch=previous;AbortSignal.timeout=previousTimeout;}
});
test('Model outages/invalid target/invalid JSON fail closed, not operational queries',async()=>{
 const original=globalThis.fetch,originalUrl=process.env.EMPROVEX_AI_LFM3_URL;
 try {
  process.env.EMPROVEX_AI_LFM3_URL='http://localhost:11434';
  let count=0;globalThis.fetch=async()=>{count++;throw Error('network must not execute');};
  assert.equal(await model.proposeWithLfm3({}),null);assert.equal(count,0);
  process.env.EMPROVEX_AI_LFM3_URL=originalUrl;
  globalThis.fetch=async()=>{throw Error('temporarily unavailable');};
  assert.equal(await model.proposeWithLfm3({}),null);
  let n=0;
  globalThis.fetch=async()=>++n===1?{ok:true,text:async()=> 'aa.bb.cc'}:{ok:true,text:async()=>'{invalid'};
  assert.equal(await model.proposeWithLfm3({allowedIntents:[],userText:'x',maxOutputTokens:128,context:{}}),null);
 }finally{globalThis.fetch=original;process.env.EMPROVEX_AI_LFM3_URL=originalUrl;}
});
test('W5 proposal and grounding guard reject invented parameters and silent filters',()=>{
 const message='Detalhe o fornecedor Alfa';
 const interpretation=interpret({message});
 assert.equal(interpretation.route,'MODEL_ELIGIBLE');
 const accepted=validateModelCandidate({intent:'supplier_contact_find',params:{nameQuery:'fornecedor Alfa'}},
   interpretation.route);
 assert.equal(guardLfm3Candidate({query:accepted,interpretation,message}).ok,true);
 const invented=validateModelCandidate({intent:'supplier_contact_find',params:{nameQuery:'fornecedor Beta'}},
   interpretation.route);
 assert.equal(guardLfm3Candidate({query:invented,interpretation,message}).ok,false);
 const filteredMessage='Detalhe o fornecedor Alfa com valores acima de 1000';
 const filteredInterpretation=interpret({message:filteredMessage});
 assert.equal(filteredInterpretation.route,'MODEL_ELIGIBLE');
 assert.equal(guardLfm3Candidate({query:accepted,interpretation:filteredInterpretation,
   message:filteredMessage}).ok,false);
 assert.equal(validateModelCandidate({intent:'another_intent',params:{}},'MODEL_ELIGIBLE'),null);
 assert.equal(validateModelCandidate({intent:'supplier_contact_find',
   params:{nameQuery:'fornecedor Alfa'},workspaceId:'other'},'MODEL_ELIGIBLE'),null);
});
let modelAnswer=null,modelCalls=0,w3Calls=[];
const mocked={
 '../authorize':{prepareAiAccess:async(token)=>token==='Bearer B'?{
  uid:'synthetic-b',workspaceId:'sector-b',ug:'160417',email:'b@example.test',googleToken:'fake'
 }:{uid:'synthetic-a',workspaceId:'sector-a',ug:'160416',email:'a@example.test',googleToken:'fake'}},
 '../query':{executeAuthorizedAiQuery:async(access,query)=>{
  w3Calls.push({access,query});
  return {version:'emprovex.ai.response.v1',status:'ok',intent:query.intent,
   contract:'supplier.contact.find.v1',data:query.intent==='supplier_contact_find'?
    [{legalName:'Fornecedor Alfa',email:access.workspaceId==='sector-b'?'b@example.test':'a@example.test'}]:
    {commitmentId:'2026NE66',operationalBalance:10,committedAmount:10,receivedAmount:0},
   filters:query.params,evidence:[{source:'synthetic',documentId:'fake'}],
   asOf:'2026-11-01T00:00:00Z',coverage:'complete',limitations:[],
   pagination:null,metrics:{durationMs:0,examinedDocuments:1}};
 }},
 './lfm3':{proposeWithLfm3:async()=>{modelCalls++;return modelAnswer;}}
};
const {runAiAsk}=load('lib/emprovex-ai/integration/orchestrator.ts',mocked);
async function ask(message,authorization='Bearer fake'){
 return (await runAiAsk({authorization,input:{message}})).payload;
}
test('Deterministic query never invokes LFM3 and stays workspace-scoped',async()=>{
 w3Calls=[];modelCalls=0;
 const result=await ask('Quanto resta da NE 2026NE66?');
 assert.equal(result.route,'DETERMINISTIC');assert.equal(result.status,'ok');
 assert.equal(result.metrics.lfm3Calls,0);assert.equal(modelCalls,0);
 assert.equal(w3Calls.length,1);assert.equal(w3Calls[0].access.workspaceId,'sector-a');
});
test('MODEL_ELIGIBLE only: model proposal proceeds through W5 and W3',async()=>{
 w3Calls=[];modelCalls=0;modelAnswer={intent:'supplier_contact_find',params:{nameQuery:'fornecedor Alfa'}};
 const result=await ask('Detalhe o fornecedor Alfa');
 assert.equal(result.route,'MODEL_ELIGIBLE');assert.equal(result.status,'ok');
 assert.equal(result.metrics.lfm3Calls,1);assert.equal(modelCalls,1);
 assert.equal(result.query.intent,'supplier_contact_find');
 assert.equal(w3Calls.length,1);assert.equal(w3Calls[0].access.workspaceId,'sector-a');
 assert.match(result.answer,/a@example.test/);
});
test('Untrusted or unavailable model never executes an unauthorized W3 query',async()=>{
 w3Calls=[];modelAnswer={intent:'supplier_contact_find',params:{nameQuery:'fornecedor Beta'}};
 const invalid=await ask('Detalhe o fornecedor Alfa');
 assert.equal(invalid.status,'clarify');assert.equal(invalid.query,undefined);
 modelAnswer=null;
 const offline=await ask('Detalhe o fornecedor Alfa');
 assert.equal(offline.status,'fallback_unavailable');
 assert.equal(w3Calls.length,0);
});
test('Model route retains independent sector authority and never shares response data',async()=>{
 modelAnswer={intent:'supplier_contact_find',params:{nameQuery:'fornecedor Alfa'}};
 w3Calls=[];
 const first=await ask('Detalhe o fornecedor Alfa','Bearer A');
 const other=await ask('Detalhe o fornecedor Alfa','Bearer B');
 assert.equal(first.status,'ok');assert.equal(other.status,'ok');
 assert.match(first.answer,/a@example.test/);
 assert.doesNotMatch(first.answer,/b@example.test/);
 assert.match(other.answer,/b@example.test/);
 assert.doesNotMatch(other.answer,/a@example.test/);
 assert.equal(w3Calls[0].access.workspaceId,'sector-a');
 assert.equal(w3Calls[1].access.workspaceId,'sector-b');
});

test('Founder-only Cloud Run production pilot is disabled by default and service-bound',()=>{
 const pilot={
  EMPROVEX_AI_W45_ENABLED:'1',
  EMPROVEX_AI_PRODUCTION_PILOT_ENABLED:'1',
  EMPROVEX_AI_LFM3_ENABLED:'1',
  K_SERVICE:'emprovex-cloudrun-candidate',
  K_CONFIGURATION:'emprovex-cloudrun-candidate',
  K_REVISION:'emprovex-cloudrun-candidate-00003-abc'
 };
 assert.equal(env.aiProductionPilotEnabled(pilot),true);
 assert.equal(env.aiExperimentalEnabled(pilot),true);
 assert.equal(env.aiLfm3Enabled(pilot),true);
 for(const bad of [
  {...pilot,EMPROVEX_AI_W45_ENABLED:'0'},
  {...pilot,EMPROVEX_AI_PRODUCTION_PILOT_ENABLED:'0'},
  {...pilot,K_SERVICE:'emprovex-cloudrun-staging'},
  {...pilot,K_CONFIGURATION:'emprovex-cloudrun-staging'},
  {...pilot,K_REVISION:'emprovex-cloudrun-staging-00003-abc'},
  {...pilot,VERCEL:'1'},
  {...pilot,VERCEL_ENV:'preview'},
 ]) {
  assert.equal(env.aiProductionPilotEnabled(bad),false,JSON.stringify(bad));
  assert.equal(env.aiLfm3Enabled(bad),false,JSON.stringify(bad));
 }
 assert.equal(env.aiExperimentalEnabled({...pilot,EMPROVEX_AI_LFM3_ENABLED:'0'}),true);
 assert.equal(env.aiLfm3Enabled({...pilot,EMPROVEX_AI_LFM3_ENABLED:'0'}),false);
});

test('Production pilot blocks all non-founder users before obtaining Google credentials',async()=>{
 let currentEmail='outside@example.test',googleCalls=0;
 class FakeAiExecutionError extends Error{
  constructor(code,status){super(code);this.code=code;this.httpStatus=status;}
 }
 const auth=load('lib/emprovex-ai/authorize.ts',{
  '../server/firebaseFounderAuth':{verifyFirebaseRequest:async()=>({
   uid:'test-uid',email:currentEmail,signInProvider:'password'
  })},
  '../server/sectorProvisioningAdmin':{getGoogleAccessToken:async()=>{googleCalls++;return 'legacy';}},
  './integration/w6Isolation':{w6DataTarget:()=>null,
   verifyW6FirebaseRequest:async()=>{throw Error('W6 must not run');},
   getW6GoogleAccessToken:async()=>{throw Error('W6 must not run');}},
  './integration/environment':{aiProductionPilotEnabled:()=>true},
  './integration/productionPilot':{getAiProductionGoogleAccessToken:async()=>{
   googleCalls++;return 'managed-token';}},
  '../hgesmWorkspace':{HGESM_SECTOR_EMAIL:'founder@example.test',
   HGESM_WORKSPACE_ID:'founder-sector',HGESM_UG:'160416'},
  '../platformIdentity':{isFounderSignInProvider:p=>['password','google.com'].includes(p),
   isValidUnitUg:()=>true,isValidWorkspaceId:()=>true,
   normalizePlatformEmail:email=>email},
  '../warehouse/featureFlag':{warehouseModuleEnabled:true},
  '../billingAccess':{decideBillingAccess:()=>({allowed:true})},
  '../billing':{},
  './reader':{coreDocument:async()=>({status:'active',ug:'160416',
   authorizedEmail:'founder@example.test'})},
  './response':{AiExecutionError:FakeAiExecutionError}
 });
 await assert.rejects(()=>auth.prepareAiAccess('Bearer fake'),
  e=>e.code==='AI_PILOT_FORBIDDEN'&&e.httpStatus===403);
 assert.equal(googleCalls,0);
 currentEmail='founder@example.test';
 const allowed=await auth.prepareAiAccess('Bearer fake');
 assert.equal(googleCalls,1);
 assert.equal(allowed.workspaceId,'founder-sector');
 assert.equal(allowed.googleToken,'managed-token');
});

test('Managed production pilot requires exact runtime service account',async()=>{
 const saved={};
 const pilot={
  EMPROVEX_AI_W45_ENABLED:'1',EMPROVEX_AI_PRODUCTION_PILOT_ENABLED:'1',
  K_SERVICE:'emprovex-cloudrun-candidate',
  K_CONFIGURATION:'emprovex-cloudrun-candidate',
  K_REVISION:'emprovex-cloudrun-candidate-00003-abc'
 };
 for(const key of Object.keys(pilot)){saved[key]=process.env[key];process.env[key]=pilot[key];}
 const originalFetch=globalThis.fetch;
 try{
  const client=load('lib/emprovex-ai/integration/productionPilot.ts');
  globalThis.fetch=async url=>({ok:true,text:async()=>String(url).endsWith('/email')
   ?'unexpected@example.test':'{"access_token":"ya29.synthetic-token-good"}'});
  await assert.rejects(()=>client.getAiProductionGoogleAccessToken(),
   /AI_PILOT_RUNTIME_IDENTITY_FORBIDDEN/);
  globalThis.fetch=async url=>({ok:true,text:async()=>String(url).endsWith('/email')
   ?'emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com'
   :'{"access_token":"ya29.synthetic-token-good"}'});
  const token=await client.getAiProductionGoogleAccessToken();
  assert.equal(token,'ya29.synthetic-token-good');
 }finally{
  globalThis.fetch=originalFetch;
  for(const key of Object.keys(pilot))
   saved[key]===undefined?delete process.env[key]:process.env[key]=saved[key];
 }
});
