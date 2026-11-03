#!/usr/bin/env node
/** R3.1.2 — Consulta de Itens W3 matching and grouped balance, fully synthetic. */
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
 assert.ok(existsSync(filename),'source file '+path);
 const mod={exports:{}};cache.set(filename,mod);
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
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
 new Function('require','module','exports','process','Buffer','fetch','AbortSignal',code)(
  importer,mod,mod.exports,process,Buffer,(...args)=>globalThis.fetch(...args),AbortSignal);
 return mod.exports;
}
const access={workspaceId:'work-a',ug:'160416',googleToken:'synthetic'};
const item=(id,name,unit,quantity,received,unitPrice)=>
 ({id,name,unit,quantity,received,unitPrice});
const row=(id,items,supplier='Fornecedor teste')=>({id,data:{
 workspaceId:access.workspaceId,ug:access.ug,supplier,items
}});
const rows=[
 row('2026NE10',[item('1','Queijo Mussarela','kg',10,3,20),item('2','Arroz Branco','kg',5,0,10)]),
 row('2026NE11',[item('4','queijo mussarela','kg',8,1,15)]),
 row('2026NE12',[item('1','Queijo Mussarela','un',6,2,6)]),
 row('2026NE13',[item('3','Queijo Prato','kg',4,1,32)])
];
const contracts=load('lib/emprovex-ai/contracts.ts');
const adapter=load('lib/emprovex-ai/context/adapter.ts');
test('W3 new item contract requires product name, forbids workspace overrides',()=>{
 const proposed=adapter.makeW3Query('commitment_item_search',{materialQuery:'queijo'});
 assert.ok(proposed);
 assert.deepEqual(contracts.parseAiQuery(proposed).params,{materialQuery:'queijo'});
 assert.throws(()=>contracts.parseAiQuery({...proposed,
   params:{materialQuery:'queijo',workspaceId:'work-b'}}),/AI_UNEXPECTED_PARAMETER/);
 assert.equal(adapter.makeW3Query('commitment_item_search',{commitmentId:'2026NE10'}),null);
});
test('Consulta de Itens groups same description + unit, keeps separate units and NEs',async()=>{
 const calls=[];
 const financial=load('lib/emprovex-ai/financial.ts',{
  './reader':{
   coreOperationalQuery:async(a,domain,filter,max)=>{
    calls.push({a,domain,filter,max});return {rows,truncated:false,examined:rows.length};
   },
   coreOperationalDocument:async()=>{throw Error('not needed');}
  }
 });
 const result=await financial.executeFinancial(access,{intent:'commitment_item_search',
   params:{materialQuery:'QUEIJO'}});
 assert.equal(result.status,'ok');
 assert.equal(result.coverage,'complete');
 assert.equal(result.data.items.length,3);
 assert.equal(calls.length,1);
 assert.equal(calls[0].a.workspaceId,'work-a');
 assert.equal(calls[0].domain,'empenhos');
 assert.equal(calls[0].max,201);
 const kg=result.data.items.find(x=>x.name==='Queijo Mussarela'&&x.unit==='kg');
 assert.ok(kg);
 assert.equal(kg.pendingQuantity,14);
 assert.equal(kg.operationalBalance,245);
 assert.equal(kg.associations.length,2);
 assert.deepEqual(kg.associations.map(x=>x.itemId),['1','4']);
 assert.ok(result.data.items.some(x=>x.unit==='un'));
 assert.ok(result.data.items.some(x=>x.name==='Queijo Prato'));
 assert.equal(result.evidence.length,4);
});
test('Specified NE searches by name with a single authorized document GET',async()=>{
 let queries=0,reads=0;
 const financial=load('lib/emprovex-ai/financial.ts',{
  './reader':{
   coreOperationalQuery:async()=>{queries++;throw Error('should not scan');},
   coreOperationalDocument:async(a,domain,id)=>{
    reads++;assert.equal(id,'2026NE10');assert.equal(domain,'empenhos');
    assert.equal(a.workspaceId,'work-a');return rows[0];
   }
  }
 });
 const result=await financial.executeFinancial(access,{intent:'commitment_item_search',
  params:{materialQuery:'queijo',commitmentId:'2026NE10'}});
 assert.equal(result.status,'ok');
 assert.equal(result.data.items.length,1);
 assert.equal(result.data.items[0].pendingQuantity,7);
 assert.equal(reads,1);assert.equal(queries,0);
});
test('Truncated scans never pretend the total is complete or item absent',async()=>{
 const input=Array.from({length:201},(_,i)=>row('2026NE'+String(1000+i),[
   item('1',i===200?'Queijo':'Arroz','kg',2,0,5)
 ]));
 const financial=load('lib/emprovex-ai/financial.ts',{
  './reader':{
   coreOperationalQuery:async()=>({rows:input,truncated:true,examined:201}),
   coreOperationalDocument:async()=>{throw Error('should not GET');}
  }
 });
 const result=await financial.executeFinancial(access,{intent:'commitment_item_search',
  params:{materialQuery:'queijo'}});
 assert.equal(result.status,'partial');
 assert.equal(result.coverage,'incomplete');
 assert.equal(result.data.items.length,0);
 assert.ok(result.limitations.some(x=>/200 empenhos/.test(x)));
});
test('Partial corrupted records cannot become certified zero',async()=>{
 const financial=load('lib/emprovex-ai/financial.ts',{
  './reader':{
   coreOperationalQuery:async()=>({rows:[
    {...rows[0],data:{workspaceId:'work-a',ug:'160416',supplier:'x'}},
    rows[1]
   ],truncated:false,examined:2}),
   coreOperationalDocument:async()=>{throw Error('should not GET');}
  }
 });
 const result=await financial.executeFinancial(access,{intent:'commitment_item_search',
   params:{materialQuery:'queijo'}});
 assert.equal(result.status,'partial');assert.equal(result.coverage,'incomplete');
 assert.equal(result.data.items.length,1);
 assert.ok(result.limitations.some(x=>/itens estruturado/.test(x)));
});
test('Response clearly labels operational item balances, associations and incomplete coverage',()=>{
 const presentation=load('lib/emprovex-ai/integration/response.ts');
 const response={status:'partial',coverage:'incomplete',pagination:{truncated:true},
   intent:'commitment_item_search',data:{items:[{name:'Queijo Mussarela',unit:'kg',
   pendingQuantity:7,operationalBalance:140,
   associations:[{commitmentId:'2026NE10',itemId:'1'}]}]},
   limitations:['A busca pode não incluir outras NEs.']};
 const answer=presentation.presentAiResponse(response);
 assert.match(answer,/Queijo Mussarela/);
 assert.match(answer,/2026NE10/);
 assert.match(answer,/7 kg/);
 assert.match(answer,/cobertura parcial/);
});
