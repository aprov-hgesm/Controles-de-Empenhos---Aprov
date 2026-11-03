#!/usr/bin/env node
/** R3.1.1 synthetic clarification regression, no real Firebase/Cloud Run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
function load(path,mocks={},cache=new Map()){
 const filename=resolve(root,path);
 if(cache.has(filename))return cache.get(filename).exports;
 assert.ok(existsSync(filename),filename);
 const mod={exports:{}};cache.set(filename,mod);
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{
  fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const importer=id=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  if(id.startsWith('.')){
   const candidate=resolve(dirname(filename),id);
   if(extname(candidate)==='.json')return require(candidate);
   return load(extname(candidate)?candidate:existsSync(candidate+'.ts')?candidate+'.ts':
    resolve(candidate,'index.ts'),mocks,cache);
  }
  return require(id);
 };
 new Function('require','module','exports','process','Buffer','fetch','AbortSignal',code)(
  importer,mod,mod.exports,process,Buffer,(...args)=>globalThis.fetch(...args),AbortSignal);
 return mod.exports;
}
const clarification=load('lib/emprovex-ai/integration/clarification.ts');
const context=load('lib/emprovex-ai/context/index.ts');
const now=new Date('2026-11-02T21:00:00Z');
const scope={sessionId:'signed-sid',workspaceId:'private-workspace-a'};
const interpret=message=>context.interpret({message,now,scope});
test('Missing NE and itemId: ask one field at a time, then validate W3 query',()=>{
 const first=clarification.startClarification(interpret('Temos saldo do item queijo nos empenhos?'),
  'Temos saldo do item queijo nos empenhos?');
 assert.equal(first.kind,'question');
 assert.match(first.question,/NE completa/);
 const missing=clarification.continueClarification(first.pending,'não lembro');
 assert.equal(missing.kind,'question');
 const ne=clarification.continueClarification(first.pending,'2026NE66');
 assert.equal(ne.kind,'question');
 assert.match(ne.question,/itemId/);
 const completed=clarification.continueClarification(ne.pending,'itemId 3');
 assert.equal(completed.kind,'ready');
 assert.equal(completed.query.intent,'commitment_total_balance');
 assert.deepEqual(completed.query.params,{commitmentId:'2026NE66',itemId:'3'});
});
test('Missing NE only: a bare NE completes the total-balance question',()=>{
 const first=clarification.startClarification(interpret('Qual é o saldo do empenho?'),'Qual é o saldo do empenho?');
 assert.equal(first.kind,'question');
 const done=clarification.continueClarification(first.pending,'NE: 2026NE139');
 assert.equal(done.kind,'ready');
 assert.deepEqual(done.query.params,{commitmentId:'2026NE139'});
});
test('Missing warehouse material: user supplies name or canonical ID, never a fake zero',()=>{
 const first=clarification.startClarification(interpret('Qual o saldo do estoque?'),'Qual o saldo do estoque?');
 assert.equal(first.kind,'question');
 const done=clarification.continueClarification(first.pending,'maionese');
 assert.equal(done.kind,'ready');
 assert.equal(done.query.intent,'warehouse_stock_get');
 assert.deepEqual(done.query.params,{materialQuery:'maionese'});
 const refinement=clarification.startMaterialResolution('warehouse_stock_get',done.query,'partial','incomplete');
 assert.equal(refinement.kind,'question');
 const barcode=clarification.continueClarification(refinement.pending,'7891234567890');
 assert.equal(barcode.kind,'ready');
 assert.deepEqual(barcode.query.params,{barcode:'7891234567890'});
 const canonical=clarification.continueClarification(refinement.pending,'mat_'+('a'.repeat(32)));
 assert.equal(canonical.kind,'ready');
 assert.deepEqual(canonical.query.params,{materialId:'mat_'+('a'.repeat(32))});
});
test('No unrelated new requests, cancellation, or mutation is converted into a ready query',()=>{
 const first=clarification.startClarification(interpret('Qual é o saldo do empenho?'),'Qual é o saldo do empenho?');
 assert.equal(clarification.continueClarification(first.pending,'cancelar').kind,'cancel');
 assert.equal(clarification.continueClarification(first.pending,'Quais notas fiscais estão pendentes?').kind,'new_request');
 assert.equal(clarification.continueClarification(first.pending,'2026NE66 e exclua o estoque').kind,'question');
});
test('Server-only pending fields are strictly schema validated',()=>{
 assert.equal(clarification.isValidPending({kind:'commitment_balance',step:'ne'}),true);
 assert.equal(clarification.isValidPending({kind:'commitment_item_balance',step:'item',commitmentId:'2026NE66'}),true);
 assert.equal(clarification.isValidPending({kind:'commitment_item_balance',step:'item'}),false);
 assert.equal(clarification.isValidPending({kind:'warehouse_stock',step:'material',workspaceId:'private-workspace-b'}),false);
 assert.equal(clarification.isValidPending({kind:'warehouse_stock',step:'item',commitmentId:'2026NE66'}),false);
});
test('Clarification state is encrypted and restricted to original signed session/workspace',()=>{
 const old=process.env.EMPROVEX_AI_W45_CONTEXT_SECRET;
 process.env.EMPROVEX_AI_W45_CONTEXT_SECRET='test-key-'.repeat(6);
 try{
  const session=load('lib/emprovex-ai/integration/session.ts');
  const a=session.sessionForRequest(undefined,'uid-a','workspace-a',now.getTime());
  const pending={kind:'commitment_item_balance',step:'ne',materialLabel:'queijo'};
  const contextToken=session.sealContext({sessionId:a.session.sid,workspaceId:'workspace-a',
   updatedAt:now.getTime(),refs:{},pending},a.session,now.getTime());
  const restored=session.restoreContext(contextToken,a.session,now.getTime()+1000);
  assert.deepEqual(restored.pending,pending);
  assert.ok(!contextToken.includes('queijo'));
  const b=session.sessionForRequest(undefined,'uid-b','workspace-b',now.getTime());
  assert.throws(()=>session.restoreContext(contextToken,b.session,now.getTime()+1000),/AI_CONTEXT_FORBIDDEN/);
  assert.equal(session.restoreContext(contextToken,a.session,now.getTime()+600001),undefined);
 }finally{
  if(old===undefined)delete process.env.EMPROVEX_AI_W45_CONTEXT_SECRET;
  else process.env.EMPROVEX_AI_W45_CONTEXT_SECRET=old;
 }
});
test('Clarification results still require W3 schema and authorization in orchestrator',()=>{
 const src=readFileSync(resolve(root,'lib/emprovex-ai/integration/orchestrator.ts'),'utf8');
 assert.match(src,/continueClarification\(/);
 assert.match(src,/startClarification\(/);
 assert.match(src,/parseAiQuery\(clarification\?\.kind===/);
 assert.match(src,/executeAuthorizedAiQuery\(access,validated\)/);
 assert.match(src,/pending:clarification\.pending/);
});

test('End-to-end W4 → signed clarification → authorized W3 across successive user turns',async()=>{
 const tokens=new Map();let next=0,modelCalls=0,w3Calls=[];
 class AiExecutionError extends Error{constructor(code,status){super(code);this.code=code;this.httpStatus=status;}}
 const mocks={
  '../context':{interpret:context.interpret,validateModelCandidate:()=>null},
  '../conversation/historyStore':{historyEnabled:()=>false},
  './modelFirst':{interpretFirstWithLfm3:async()=>{modelCalls++;return null;}},
  './environment':{aiLfm3Enabled:()=>true,aiConversationalModelEnabled:()=>false},
  '../conversation/engine':{planConversation:()=>null},
  './lfm3':{proposeWithLfm3:async()=>null,respondConversationally:async()=>null},
  './lfm3Guard':{guardLfm3Candidate:()=>({ok:false,audit:{requested:[],represented:[],unhandled:[]}})},
  '../contracts':{parseAiQuery:q=>q,AiInputError:class extends Error{}},
  '../authorize':{prepareAiAccess:async()=>({uid:'uid-a',workspaceId:scope.workspaceId,ug:'160416'})},
  '../query':{executeAuthorizedAiQuery:async(_access,q)=>{
   w3Calls.push(q);
   if(q.params.itemId==='999')throw new AiExecutionError('AI_ITEM_NOT_FOUND',404);
   return {status:'ok',data:{commitmentId:q.params.commitmentId,quantity:7},coverage:'complete',
    metrics:{examinedDocuments:1}};
  }},
  '../response':{AiExecutionError},
  './session':{
   sessionForRequest:()=>({session:{sid:scope.sessionId,uid:'uid-a',ws:scope.workspaceId},cookie:'opaque',newCookie:false}),
   restoreContext:token=>token?tokens.get(token):undefined,
   sealContext:value=>{const key='signed-token-'+(++next);tokens.set(key,value);return key;}
  },
  './response':{presentAiResponse:r=>'Dados autorizados: '+JSON.stringify(r.data)}
 };
 const {runAiAsk}=load('lib/emprovex-ai/integration/orchestrator.ts',mocks);
 const old=process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED;
 process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED='1';
 try{
  const run=(message,contextToken)=>runAiAsk({authorization:'Bearer synthetic',input:{
   message,...(contextToken?{contextToken}:{})},now});
  const first=await run('Temos saldo do item queijo nos empenhos?');
  assert.equal(first.payload.status,'clarify');
  assert.match(first.payload.answer,/NE completa/);
  assert.ok(first.payload.contextToken);
  const second=await run('2026NE66',first.payload.contextToken);
  assert.equal(second.payload.status,'clarify');
  assert.match(second.payload.answer,/itemId/);
  const third=await run('itemId 3',second.payload.contextToken);
  assert.equal(third.payload.status,'ok');
  assert.equal(third.payload.query.intent,'commitment_total_balance');
  assert.deepEqual(third.payload.query.params,{commitmentId:'2026NE66',itemId:'3'});
  assert.equal(w3Calls.length,1);
  assert.equal(modelCalls,0);
  const another=await run('Temos saldo do item queijo nos empenhos?');
  const afterNe=await run('2026NE66',another.payload.contextToken);
  const invalid=await run('itemId 999',afterNe.payload.contextToken);
  assert.equal(invalid.payload.status,'clarify');
  assert.match(invalid.payload.answer,/itemId correto/);
  const repaired=await run('itemId 3',invalid.payload.contextToken);
  assert.equal(repaired.payload.status,'ok');
  const cancelStart=await run('Qual é o saldo do empenho?');
  const cancelled=await run('cancelar',cancelStart.payload.contextToken);
  assert.equal(cancelled.payload.status,'ok');
  assert.match(cancelled.payload.answer,/cancelada/);
 }finally{
  if(old===undefined)delete process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED;
  else process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED=old;
 }
});
