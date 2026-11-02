#!/usr/bin/env node
/** R3 isolated model-first and conversation lifecycle tests. No GCP, no real user records. */
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
 assert.ok(existsSync(file));
 const mod={exports:{}};cache.set(file,mod);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const importer=id=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  if(id.startsWith('.')){
   const base=resolve(dirname(file),id);
   const target=extname(base)?base:existsSync(base+'.ts')?base+'.ts':resolve(base,'index.ts');
   if(extname(target)==='.json')return require(target);
   return load(target,mocks);
  }
  return require(id);
 };
 new Function('require','module','exports','process','Buffer','fetch','AbortSignal',code)(
  importer,mod,mod.exports,process,Buffer,(...args)=>globalThis.fetch(...args),AbortSignal);
 return mod.exports;
}
const previous={...process.env};
process.env.K_SERVICE='emprovex-cloudrun-candidate';
process.env.K_CONFIGURATION='emprovex-cloudrun-candidate';
process.env.K_REVISION='emprovex-cloudrun-candidate-00023';
process.env.EMPROVEX_AI_HISTORY_ENABLED='1';
process.env.EMPROVEX_AI_W45_ENABLED='1';
process.env.EMPROVEX_AI_PRODUCTION_PILOT_ENABLED='1';
process.env.EMPROVEX_AI_LFM3_ENABLED='1';
process.env.EMPROVEX_AI_LFM3_URL='https://emprovex-ai-inference-example.a.run.app/';
delete process.env.VERCEL;delete process.env.VERCEL_ENV;
class AiExecutionError extends Error{constructor(code,status){super(code);this.code=code;this.httpStatus=status;}}
const store=load('lib/emprovex-ai/conversation/historyStore.ts',{
 '../integration/environment':{aiProductionPilotEnabled:()=>true},
 '../response':{AiExecutionError}
});
test('R3: authenticated UID/workspace-isolated history, rename and permanent delete',async()=>{
 const old=globalThis.fetch,docs=new Map(),calls=[];
 const a={uid:'user-a',workspaceId:'workspace-a',googleToken:'synthetic-a',email:'a@example.test',ug:'160416'};
 const b={...a,uid:'user-b',googleToken:'synthetic-b'};
 globalThis.fetch=async(url,opts={})=>{
  const urlText=String(url),method=opts.method||'GET',clean=urlText.split('?')[0];
  calls.push({url:urlText,method});
  if(method==='POST'){
   const id=new URL(urlText).searchParams.get('documentId');
   const name=clean+'/'+id;const value=JSON.parse(opts.body);
   docs.set(name,{name,updateTime:'2026-11-02T01:00:00Z',fields:value.fields});
   return {ok:true,status:200,json:async()=>docs.get(name)};
  }
  if(method==='GET'&&urlText.includes('?')){
   const documents=[...docs.values()].filter(x=>x.name.startsWith(clean+'/'));
   return {ok:true,status:200,json:async()=>({documents})};
  }
  if(method==='GET')return docs.has(clean)
    ?{ok:true,status:200,json:async()=>docs.get(clean)}
    :{ok:false,status:404};
  if(method==='PATCH'){
   if(!docs.has(clean))return {ok:false,status:404};
   const value=JSON.parse(opts.body),original=docs.get(clean);
   docs.set(clean,{name:clean,updateTime:original.updateTime,fields:value.fields});
   return {ok:true,status:200};
  }
  if(method==='DELETE'){
   if(!docs.has(clean))return {ok:false,status:404};
   docs.delete(clean);return {ok:true,status:200};
  }
  throw Error('Unexpected '+method);
 };
 try{
  assert.equal(store.historyEnabled(),true);
  const thread=await store.createHistory(a,'Detalhe o fornecedor TESTE');
  assert.match(thread.id,/^[a-f0-9-]{36}$/);
  await store.appendHistory(a,thread.id,'Detalhe o fornecedor TESTE',
   'Não há registros correspondentes.',{status:'empty',route:'MODEL_ELIGIBLE'});
  const loaded=await store.getHistory(a,thread.id);
  assert.equal(loaded.messages.length,2);
  assert.equal(loaded.messages[0].text,'Detalhe o fornecedor TESTE');
  assert.equal((await store.listHistory(a)).length,1);
  assert.equal((await store.listHistory(b)).length,0);
  await assert.rejects(()=>store.getHistory(b,thread.id),/AI_HISTORY_NOT_FOUND/);
  await store.renameHistory(a,thread.id,'Fornecedor TESTE');
  assert.equal((await store.getHistory(a,thread.id)).title,'Fornecedor TESTE');
  await store.deleteHistory(a,thread.id);
  await assert.rejects(()=>store.getHistory(a,thread.id),/AI_HISTORY_NOT_FOUND/);
  assert.equal(docs.size,0);
  assert.ok(calls.some(c=>c.method==='DELETE'&&c.url.includes('currentDocument.updateTime=')));
  assert.ok(calls.every(c=>!c.url.includes('workspaces/workspace-b')));
 }finally{globalThis.fetch=old;}
});
test('R3: disabled history fails closed without touching Firestore',async()=>{
 const old=process.env.EMPROVEX_AI_HISTORY_ENABLED,fetchBefore=globalThis.fetch;
 process.env.EMPROVEX_AI_HISTORY_ENABLED='0';
 globalThis.fetch=async()=>{throw Error('no I/O');};
 try{
  const access={uid:'user-a',workspaceId:'workspace-a',googleToken:'fake',email:'a@example.test',ug:'160416'};
  await assert.rejects(()=>store.listHistory(access),/AI_HISTORY_DISABLED/);
 }finally{process.env.EMPROVEX_AI_HISTORY_ENABLED=old;globalThis.fetch=fetchBefore;}
});
const model=load('lib/emprovex-ai/integration/modelFirst.ts');
test('R3: LFM3 classifies operational and conversational requests, never executes W3',async()=>{
 const old=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,opts)=>{
  calls.push({url:String(url),opts});
  if(calls.length%2===1)return {ok:true,text:async()=> 'aa.bb.cc'};
  const operational=calls.length===2;
  const value=operational?
   {kind:'operational',intent:'supplier_contact_find',params:{nameQuery:'Alfa'},answer:''}:
   {kind:'conversation',intent:'',params:{},answer:'Bem-vindos! Que esta etapa seja produtiva.'};
  return {ok:true,text:async()=>JSON.stringify({done_reason:'stop',message:{content:JSON.stringify(value)}})};
 };
 try{
  const first=await model.interpretFirstWithLfm3('Detalhe o fornecedor Alfa');
  assert.equal(first.kind,'operational');assert.equal(first.intent,'supplier_contact_find');
  const second=await model.interpretFirstWithLfm3('Crie uma mensagem de boas-vindas');
  assert.equal(second.kind,'conversation');assert.match(second.answer,/Bem-vindos/);
  assert.equal(calls.length,4);
  assert.equal(calls[1].url,'https://emprovex-ai-inference-example.a.run.app/api/chat');
  const sent=JSON.parse(calls[1].opts.body);
  assert.equal(sent.think,false);assert.equal(sent.stream,false);
  assert.ok(!calls.some(c=>c.url.includes('firestore.googleapis.com')));
 }finally{globalThis.fetch=old;}
});
test('R3: malformed model response returns null; private localhost is rejected',async()=>{
 const old=globalThis.fetch,prior=process.env.EMPROVEX_AI_LFM3_URL;
 try{
  process.env.EMPROVEX_AI_LFM3_URL='http://localhost:11434';
  globalThis.fetch=async()=>{throw Error('no requests');};
  assert.equal(await model.interpretFirstWithLfm3('Oi'),null);
  process.env.EMPROVEX_AI_LFM3_URL=prior;
  let n=0;
  globalThis.fetch=async()=>++n===1?{ok:true,text:async()=> 'aa.bb.cc'}:
   {ok:true,text:async()=>JSON.stringify({done_reason:'length',message:{content:'{}'}})};
  assert.equal(await model.interpretFirstWithLfm3('Olá'),null);
 }finally{globalThis.fetch=old;process.env.EMPROVEX_AI_LFM3_URL=prior;}
});
test('R3: operational data authority remains W3/W5 and chat client never writes Firestore',()=>{
 const orchestrator=readFileSync(resolve(root,'lib/emprovex-ai/integration/orchestrator.ts'),'utf8');
 const client=readFileSync(resolve(root,'features/eleonor/components/EleonorExperience.tsx'),'utf8');
 const rules=readFileSync(resolve(root,'firestore.rules'),'utf8');
 assert.match(orchestrator,/guardLfm3Candidate/);
 assert.match(orchestrator,/validateModelCandidate/);
 assert.match(orchestrator,/executeAuthorizedAiQuery/);
 assert.match(orchestrator,/interpretFirstWithLfm3/);
 assert.match(client,/EleonorHistoryPanel/);
 assert.doesNotMatch(client,/addDoc\(|setDoc\(|updateDoc\(/);
 assert.doesNotMatch(rules,/match \/eleonorHistory/);
});
