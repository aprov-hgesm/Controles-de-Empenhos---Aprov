#!/usr/bin/env node
/** Eleonor R3.1 — deterministic/mock regression checks, no GCP/network or real data. */
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
 assert.ok(existsSync(filename),'source available: '+path);
 const mod={exports:{}};cache.set(filename,mod);
 const source=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
   esModuleInterop:true}}).outputText;
 const importer=id=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  if(id.startsWith('.')){
   const target=resolve(dirname(filename),id);
   if(extname(target)==='.json')return require(target);
   return load(extname(target)?target:existsSync(target+'.ts')?target+'.ts':
    resolve(target,'index.ts'),mocks,cache);
  }
  return require(id);
 };
 new Function('require','module','exports','process','Buffer','fetch','AbortSignal',source)(
  importer,mod,mod.exports,process,Buffer,(...args)=>globalThis.fetch(...args),AbortSignal);
 return mod.exports;
}
const context=load('lib/emprovex-ai/context/index.ts');
const now=new Date('2026-11-02T15:00:00Z');
const scoped={sessionId:'sid-r31',workspaceId:'workspace-a'};
test('W4 recognizes informal material questions and never combines different balances',()=>{
 const ask=message=>context.interpret({message,now,scope:scoped});
 const where=ask('Onde está o item maionese?');
 assert.equal(where.route,'DETERMINISTIC');
 assert.equal(where.query.intent,'warehouse_material_locations_list');
 assert.equal(where.query.params.materialQuery,'maionese');
 const quantity=ask('Quanto ainda temos de arroz?');
 assert.equal(quantity.route,'DETERMINISTIC');
 assert.equal(quantity.query.params.materialQuery,'arroz');
 const mixed=ask('Temos saldo do item queijo nos empenhos?');
 assert.equal(mixed.route,'DETERMINISTIC');
 assert.equal(mixed.query.intent,'commitment_item_search');
 assert.equal(mixed.query.params.materialQuery,'queijo');
 assert.equal(mixed.query.params.commitmentId,undefined);
 const total=ask('Qual o sald da NE 2026NE66?');
 assert.equal(total.query.intent,'commitment_total_balance','NE total must not be interpreted as product');
 const listing=ask('Quais itens da NE 2026NE66?');
 assert.equal(listing.query.intent,'commitment_get','NE item listing must remain valid');
 assert.equal(listing.query.params.includeItems,true);
 const within=ask('Qual saldo do item queijo na NE 2026NE66?');
 assert.equal(within.query?.intent,'commitment_item_search');
 assert.equal(within.query?.params.commitmentId,'2026NE66');
 const cross=ask('Quais empenhos possuem determinado material?');
 assert.equal(cross.route,'CLARIFY');
 assert.equal(cross.intent,'commitment_item_search');
 assert.match(cross.question,/nome do produto/i);
 const year=ask('Quais empenhos de 2025 possuem queijo?');
 assert.equal(year.route,'UNSUPPORTED','Year filter must never be silently dropped');
 const mutation=ask('Registre uma saída de cinco quilos de arroz.');
 assert.equal(mutation.route,'REJECT_MUTATION');
});
test('W4 signed short context can reference previous material without hallucinating it',()=>{
 const reference=context.interpret({message:'Qual saldo desse item?',now,scope:scoped,
  previous:{sessionId:scoped.sessionId,workspaceId:scoped.workspaceId,
   updatedAt:now.getTime()-1000,refs:{materialQuery:'arroz'}}});
 assert.equal(reference.route,'DETERMINISTIC');
 assert.equal(reference.query.params.materialQuery,'arroz');
});
test('Hybrid orchestrator skips LFM3 for exact reads and mutations, calls once for unknown operational intents',async()=>{
 let modelCalls=0,w3Calls=0;
 const query={version:'emprovex.ai.query.v1',intent:'warehouse_stock_get',params:{materialQuery:'arroz'}};
 const mocks={
  '../context':{interpret:({message})=>{
   const route=message.startsWith('Registre')?'REJECT_MUTATION':
    message.startsWith('Investigue')?'MODEL_ELIGIBLE':'DETERMINISTIC';
   return {route,reason:'TEST',intent:'warehouse_stock_get',query,
    model:{allowedIntents:['warehouse_stock_get'],userText:message,context:{}},
    metrics:{durationMs:0},filterAudit:{requested:[],represented:[],unhandled:[]}};
  },validateModelCandidate:()=>query},
  './modelFirst':{interpretFirstWithLfm3:async()=>{modelCalls++;return {
    kind:'operational',intent:'warehouse_stock_get',params:{materialQuery:'arroz'}};}},
  '../conversation/historyStore':{historyEnabled:()=>false},
  './environment':{aiLfm3Enabled:()=>true,aiConversationalModelEnabled:()=>false},
  '../conversation/engine':{planConversation:()=>null},
  './lfm3':{proposeWithLfm3:async()=>{throw Error('redundant call');}},
  './lfm3Guard':{guardLfm3Candidate:()=>({ok:true,audit:{requested:[],represented:[],unhandled:[]}})},
  '../contracts':{parseAiQuery:x=>x,AiInputError:class AiInputError extends Error{}},
  '../authorize':{prepareAiAccess:async()=>({uid:'test',workspaceId:'workspace-a',ug:'160416'})},
  '../query':{executeAuthorizedAiQuery:async()=>{w3Calls++;return {
   status:'ok',metrics:{examinedDocuments:1}};}},
  '../response':{AiExecutionError:class AiExecutionError extends Error{}},
  './session':{sessionForRequest:()=>({session:{sid:'test'},cookie:'test',newCookie:false}),
   restoreContext:()=>null,sealContext:()=> 'test-context'},
  './response':{presentAiResponse:()=> 'Saldo proveniente de W3'}
 };
 const old=process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED;
 process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED='1';
 try{
  const {runAiAsk}=load('lib/emprovex-ai/integration/orchestrator.ts',mocks);
  const run=message=>runAiAsk({authorization:'Bearer MOCK',input:{message},now});
  const fast=await run('Quanto arroz temos?');
  assert.equal(fast.payload.status,'ok');
  assert.equal(fast.payload.metrics.lfm3Calls,0);
  assert.equal(modelCalls,0);assert.equal(w3Calls,1);
  const forbidden=await run('Registre uma saída de arroz.');
  assert.equal(forbidden.payload.status,'rejected');
  assert.equal(modelCalls,0);assert.equal(w3Calls,1);
  const unknown=await run('Investigue o material arroz no estoque.');
  assert.equal(unknown.payload.status,'ok');
  assert.equal(unknown.payload.metrics.lfm3Calls,1);
  assert.equal(modelCalls,1);assert.equal(w3Calls,2);
 }finally{
  if(old===undefined)delete process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED;
  else process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED=old;
 }
});
const ws='workspace-a',ug='160416',materialId='mat_'+('a'.repeat(32));
const access={workspaceId:ws,ug,googleToken:'synthetic'};
const material={id:materialId,data:{workspaceId:ws,ug,description:'Queijo',aliases:[],
 unit:{code:'kg',label:null}}};
test('Warehouse: exact indexed description resolves without scanning the catalogue',async()=>{
 const seen=[];
 const {executeWarehouse}=load('lib/emprovex-ai/warehouse.ts',{
  './reader':{warehouseQuery:async(_access,domain,filter,max)=>{
   seen.push({domain,filter,max});
   return {rows:[material],truncated:false,examined:1};
  },warehouseDocument:async(_access,domain)=>{
   assert.equal(domain,'balances');
   return {id:materialId,data:{workspaceId:ws,ug,quantity:12}};
  }},
  '../warehouse/barcode':{createWarehouseBarcodeId:async()=> 'unused'}
 });
 const result=await executeWarehouse(access,{intent:'warehouse_stock_get',params:{materialQuery:'Queijo'}});
 assert.equal(result.data.quantity,12);
 assert.deepEqual(seen,[{domain:'materials',filter:{field:'description',value:'Queijo'},max:3}]);
});
test('Warehouse: an item beyond the first 21 is found by bounded fallback',async()=>{
 const seen=[],rows=Array.from({length:80},(_,i)=>({id:'mat_'+String(i).padStart(32,'0'),
  data:{workspaceId:ws,ug,description:i===79?'Maionese':'Item '+i,aliases:[],
  unit:{code:'kg',label:null}}}));
 const {executeWarehouse}=load('lib/emprovex-ai/warehouse.ts',{
  './reader':{
   warehouseQuery:async(_access,domain,filter,max)=>{
    seen.push({domain,filter,max});
    return {rows:[],truncated:false,examined:0};
   },
   warehouseMaterialNameSearch:async(_access,name)=>{
    seen.push({domain:'materials',method:'nameDiscovery',name});
    return {rows:rows.filter(r=>r.data.description.toLowerCase().includes(name)),
      truncated:false,examined:80};
   },
   warehouseDocument:async(_access,domain)=>{
    assert.equal(domain,'balances');
    return {id:rows[79].id,data:{workspaceId:ws,ug,quantity:9}};
   }
  },'../warehouse/barcode':{createWarehouseBarcodeId:async()=> 'unused'}
 });
 const result=await executeWarehouse(access,{intent:'warehouse_stock_get',params:{materialQuery:'maionese'}});
 assert.equal(result.status,undefined);assert.equal(result.data.quantity,9);
 assert.deepEqual(seen[1],{domain:'materials',method:'nameDiscovery',name:'maionese'});
 assert.equal(result.examinedDocuments,81);
});
test('Warehouse: incomplete fallback can never claim definitive absence or zero balance',async()=>{
 const {executeWarehouse}=load('lib/emprovex-ai/warehouse.ts',{
  './reader':{
   warehouseQuery:async()=>({rows:[],truncated:false,examined:0}),
   warehouseMaterialNameSearch:async()=>({rows:[],truncated:true,examined:1200}),
   warehouseDocument:async()=>{throw Error('should not read balance');}
  },'../warehouse/barcode':{createWarehouseBarcodeId:async()=> 'unused'}
 });
 const result=await executeWarehouse(access,{intent:'warehouse_stock_get',params:{materialQuery:'Queijo'}});
 assert.equal(result.status,'partial');assert.equal(result.coverage,'incomplete');
 assert.equal(result.data,null);assert.equal(result.truncated,true);
});
test('Warehouse: location metadata reads overlap and reuse the same promises',async()=>{
 let active=0,maxActive=0,readCount=0;
 const depotId='dep_'+('b'.repeat(32)),locationId='loc_'+('c'.repeat(32));
 const positions=[1,2].map(i=>({id:'pos-'+i,data:{workspaceId:ws,ug,quantity:i,
  position:{kind:'LOCATION',depotId,locationId}}}));
 const {executeWarehouse}=load('lib/emprovex-ai/warehouse.ts',{
  './reader':{
   warehouseQuery:async(_a,domain)=>{assert.equal(domain,'locationBalances');
    return {rows:positions,truncated:false,examined:2};},
   warehouseDocument:async(_a,domain,id)=>{
    if(domain==='materials')return material;
    readCount++;active++;maxActive=Math.max(maxActive,active);
    await new Promise(r=>setTimeout(r,2));active--;
    return {id,data:domain==='depots'?{name:'Depósito',code:'D'}:
     {name:'Prateleira',code:'P',depotId}};
   }
  },'../warehouse/barcode':{createWarehouseBarcodeId:async()=> 'unused'}
 });
 const result=await executeWarehouse(access,{
  intent:'warehouse_material_locations_list',params:{materialId,pageSize:20}
 });
 assert.equal(result.data.locations.length,2);
 assert.equal(readCount,2);
 assert.ok(maxActive>=2,'location and depot can load concurrently');
});

test('History: first append reuses Firestore creation version without a second GET',async()=>{
 const keys=['K_SERVICE','K_CONFIGURATION','EMPROVEX_AI_HISTORY_ENABLED'];
 const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 const oldFetch=globalThis.fetch;
 process.env.K_SERVICE='emprovex-cloudrun-candidate';
 process.env.K_CONFIGURATION='emprovex-cloudrun-candidate';
 process.env.EMPROVEX_AI_HISTORY_ENABLED='1';
 const requests=[];
 globalThis.fetch=async(url,opts={})=>{
  const method=opts.method||'GET',address=String(url);
  requests.push({method,address});
  if(method==='GET'&&address.includes('pageSize='))return {ok:true,status:200,
   json:async()=>({documents:[]})};
  if(method==='POST'){
   const body=JSON.parse(opts.body);
   return {ok:true,status:200,json:async()=>({updateTime:'2026-11-02T15:00:00Z',
    fields:body.fields})};
  }
  if(method==='PATCH'){
   assert.match(address,/currentDocument\.updateTime=/);
   return {ok:true,status:200};
  }
  throw Error('Unexpected network request: '+method+' '+address);
 };
 try{
  const store=load('lib/emprovex-ai/conversation/historyStore.ts',{
   '../integration/environment':{aiProductionPilotEnabled:()=>true},
   '../response':{AiExecutionError:class AiExecutionError extends Error{
    constructor(code,status){super(code);this.httpStatus=status;this.code=code;}
   }}
  });
  const thread=await store.createHistory(access,'Bom dia');
  await store.appendHistory(access,thread.id,'Bom dia','Olá!',{
   status:'ok',route:'CONVERSATIONAL'},thread);
  assert.equal(requests.filter(x=>x.method==='PATCH').length,1);
  assert.equal(requests.filter(x=>x.method==='GET'&&!x.address.includes('pageSize=')).length,0);
 }finally{
  globalThis.fetch=oldFetch;
  for(const key of keys){
   if(saved[key]===undefined)delete process.env[key];
   else process.env[key]=saved[key];
  }
 }
});
