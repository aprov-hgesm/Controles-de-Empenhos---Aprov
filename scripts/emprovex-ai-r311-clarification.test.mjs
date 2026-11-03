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
test('Consulta de Itens automatically finds a named product; only missing name triggers clarification',()=>{
 const named=interpret('Temos saldo do item queijo nos empenhos?');
 assert.equal(named.route,'DETERMINISTIC');
 assert.equal(named.query.intent,'commitment_item_search');
 assert.deepEqual(named.query.params,{materialQuery:'queijo'});
 assert.equal(clarification.startClarification(named,'Temos saldo do item queijo nos empenhos?'),null);
 const unknown=interpret('Quais empenhos possuem determinado material?');
 const first=clarification.startClarification(unknown,'Quais empenhos possuem determinado material?');
 assert.equal(first.kind,'question');
 assert.match(first.question,/nome ou descrição do produto/i);
 const missing=clarification.continueClarification(first.pending,'');
 assert.equal(missing.kind,'question');
 const found=clarification.continueClarification(first.pending,'queijo');
 assert.equal(found.kind,'ready');
 assert.equal(found.query.intent,'commitment_item_search');
 assert.deepEqual(found.query.params,{materialQuery:'queijo'});
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
 assert.equal(clarification.isValidPending({kind:'commitment_item_search',step:'material'}),true);
 assert.equal(clarification.isValidPending({kind:'commitment_item_search',step:'material',commitmentId:'2026NE66'}),true);
 assert.equal(clarification.isValidPending({kind:'commitment_item_search',step:'item'}),false);
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
  assert.equal(first.payload.status,'ok');
  assert.equal(first.payload.query.intent,'commitment_item_search');
  assert.deepEqual(first.payload.query.params,{materialQuery:'queijo'});
  assert.equal(w3Calls.length,1);
  assert.equal(modelCalls,0);
  const second=await run('Quais empenhos possuem determinado material?');
  assert.equal(second.payload.status,'clarify');
  assert.match(second.payload.answer,/nome ou descrição do produto/i);
  assert.ok(second.payload.contextToken);
  const third=await run('queijo',second.payload.contextToken);
  assert.equal(third.payload.status,'ok');
  assert.equal(third.payload.query.intent,'commitment_item_search');
  assert.deepEqual(third.payload.query.params,{materialQuery:'queijo'});
  assert.equal(w3Calls.length,2);
  assert.equal(modelCalls,0);
  const specific=await run('Qual saldo do item queijo na NE 2026NE66?');
  assert.equal(specific.payload.status,'ok');
  assert.deepEqual(specific.payload.query.params,{materialQuery:'queijo',commitmentId:'2026NE66'});
  const cancelStart=await run('Qual é o saldo do empenho?');
  const cancelled=await run('cancelar',cancelStart.payload.contextToken);
  assert.equal(cancelled.payload.status,'ok');
  assert.match(cancelled.payload.answer,/cancelada/);
 }finally{
  if(old===undefined)delete process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED;
  else process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED=old;
 }
});

test('R3.1.5 signed context lists items of the last NE without repeating the number',()=>{
 const first=context.interpret({message:'Mostre a NE 2026NE66',now,scope});
 assert.equal(first.route,'DETERMINISTIC');
 assert.equal(first.query.intent,'commitment_get');
 const second=context.interpret({message:'E os itens dessa?',now,scope,previous:first.nextContext});
 assert.equal(second.route,'DETERMINISTIC');
 assert.equal(second.query.intent,'commitment_get');
 assert.deepEqual(second.query.params,{commitmentId:'2026NE66',includeItems:true});
 for(const previous of [
   {...first.nextContext,workspaceId:'private-workspace-b'},
   {...first.nextContext,sessionId:'other-session'},
   {...first.nextContext,updatedAt:now.getTime()-600001}
 ]){
   const rejected=context.interpret({message:'E os itens dessa?',now,scope,previous});
   assert.ok(!rejected.query,'expired or cross-scope NE must never be reused');
 }
});
test('R3.1.5 fallback locates an item by name, not user supplied itemId',()=>{
 const interpreted={route:'CLARIFY',intent:'commitment_total_balance',
   reason:'ITEM_NAME_REQUIRES_ITEM_ID',
   filterAudit:{requested:['materialQuery'],represented:[],unhandled:['materialQuery']}};
 const direct=clarification.startClarification(interpreted,'Qual saldo do item queijo na NE 2026NE66?');
 assert.equal(direct.kind,'ready');
 assert.equal(direct.query.intent,'commitment_item_search');
 assert.deepEqual(direct.query.params,{materialQuery:'queijo',commitmentId:'2026NE66'});
 const absent=clarification.startClarification(interpreted,'Qual saldo por item na NE 2026NE66?');
 assert.equal(absent.kind,'question');
 assert.match(absent.question,/nome ou descrição/i);
 const ready=clarification.continueClarification(absent.pending,'queijo mussarela');
 assert.equal(ready.kind,'ready');
 assert.deepEqual(ready.query.params,{materialQuery:'queijo mussarela',commitmentId:'2026NE66'});
 const forbidden=clarification.startClarification({...interpreted,
   filterAudit:{requested:['materialQuery','period'],represented:[],
     unhandled:['materialQuery','period']}},'Qual saldo do item queijo na NE 2026NE66?');
 assert.equal(forbidden,null,'unsupported period must never be silently removed');
});
test('R3.1.5 legacy encrypted itemId clarification upgrades to Consulta de Itens',()=>{
 const pending={kind:'commitment_item_balance',step:'ne',materialLabel:'queijo'};
 const resumed=clarification.continueClarification(pending,'2026NE66');
 assert.equal(resumed.kind,'ready');
 assert.deepEqual(resumed.query.params,{materialQuery:'queijo',commitmentId:'2026NE66'});
 const old={kind:'commitment_item_balance',step:'item',commitmentId:'2026NE66',materialLabel:'queijo'};
 const newQuery=clarification.continueClarification(old,'queijo');
 assert.equal(newQuery.query.intent,'commitment_item_search');
 assert.deepEqual(newQuery.query.params,{materialQuery:'queijo',commitmentId:'2026NE66'});
});
test('R3.1.5 presents bounded item listing from authorized commitment response',()=>{
 const presenter=load('lib/emprovex-ai/integration/response.ts');
 const answer=presenter.presentAiResponse({status:'ok',coverage:'complete',
  intent:'commitment_get',data:{id:'2026NE66',supplier:'Fornecedor Teste',status:'aberto',
   items:[{id:'3',name:'Queijo Mussarela',unit:'kg',quantity:10,received:3}]}});
 assert.match(answer,/Queijo Mussarela/);
 assert.match(answer,/10 kg empenhados/);
 assert.match(answer,/3 recebidos/);
 assert.match(answer,/2026NE66/);
});

test('R3.1.5 W3 result groups enable optional name refinement with no itemId or balance in context',()=>{
 const result={items:[{name:'Queijo Mussarela',unit:'kg',pendingQuantity:7},
   {name:'Queijo Mussarela',unit:'un',pendingQuantity:3},
   {name:'Queijo Prato',unit:'kg',pendingQuantity:4}]};
 const query={intent:'commitment_item_search',
   params:{materialQuery:'queijo',commitmentId:'2026NE66'}};
 const pending=clarification.itemSearchRefinement(query,result,'ok');
 assert.deepEqual(pending,{kind:'commitment_item_search',step:'material',commitmentId:'2026NE66'});
 assert.ok(!('items' in pending)&&!('balance' in pending));
 const selected=clarification.continueClarification(pending,'mussarela');
 assert.equal(selected.kind,'ready');
 assert.equal(selected.query.intent,'commitment_item_search');
 assert.deepEqual(selected.query.params,{materialQuery:'mussarela',commitmentId:'2026NE66'});
 assert.equal(clarification.itemSearchRefinement(query,{items:[result.items[0]]},'ok'),null);
 assert.equal(clarification.itemSearchRefinement({intent:'warehouse_stock_get',params:{}},result,'ok'),null);
 assert.equal(clarification.continueClarification(pending,'Quais notas fiscais estão pendentes?').kind,'new_request');
 assert.equal(clarification.continueClarification(pending,'E os itens dessa?').kind,'new_request');
});
