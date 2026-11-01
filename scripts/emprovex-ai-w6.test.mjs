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
test('IAM metadata token and Ollama JSON mode, think=false, output/time bounds',async()=>{
 const previous=globalThis.fetch;
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
 }finally{globalThis.fetch=previous;}
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
 '../authorize':{prepareAiAccess:async()=>({
  uid:'synthetic-a',workspaceId:'sector-a',ug:'160416',email:'a@example.test',googleToken:'fake'
 })},
 '../query':{executeAuthorizedAiQuery:async(access,query)=>{
  w3Calls.push({access,query});
  return {version:'emprovex.ai.response.v1',status:'ok',intent:query.intent,
   contract:'supplier.contact.find.v1',data:query.intent==='supplier_contact_find'?
    [{legalName:'Fornecedor Alfa',email:'alfa@example.test'}]:
    {commitmentId:'2026NE66',operationalBalance:10,committedAmount:10,receivedAmount:0},
   filters:query.params,evidence:[{source:'synthetic',documentId:'fake'}],
   asOf:'2026-11-01T00:00:00Z',coverage:'complete',limitations:[],
   pagination:null,metrics:{durationMs:0,examinedDocuments:1}};
 }},
 './lfm3':{proposeWithLfm3:async()=>{modelCalls++;return modelAnswer;}}
};
const {runAiAsk}=load('lib/emprovex-ai/integration/orchestrator.ts',mocked);
async function ask(message){return (await runAiAsk({authorization:'Bearer fake',input:{message}})).payload;}
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
 assert.match(result.answer,/alfa@example.test/);
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
