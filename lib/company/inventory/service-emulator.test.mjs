/**
 * W7 integrated service tests: REAL Firestore Emulator REST, fixtures shaped like W1/W2/W6.
 * W0 separately tests Auth. No production, no actual IAM, no network outside loopback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as engine from './engine.mjs';
const localRequire=createRequire(import.meta.url);
const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'';
assert.match(project,/^demo-[a-z0-9-]+$/);
assert.equal(process.env.EMPROVEX_E2E_SERVER_AUTH,'1');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
assert.ok(!process.env.K_SERVICE&&!process.env.VERCEL&&!process.env.GAE_SERVICE);
const rest='http://127.0.0.1:8080/v1/projects/'+project+'/databases/(default)/documents';
const firestoreName=rest.split('/v1/')[1];
const root=company=>'supplierCompanyWorkspaces/'+company;
function load(path,modules={}){
 const source=readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
 const transformed=ts.transpileModule(source,{fileName:path,compilerOptions:{
   module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
   allowJs:true,resolveJsonModule:true},reportDiagnostics:true});
 assert.equal(transformed.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length||0,0,path);
 const exports={};
 runInNewContext(transformed.outputText,{exports,require(name){
   if(Object.hasOwn(modules,name))return modules[name];
   if(name.startsWith('node:'))return localRequire(name);
   throw Error('Unexpected module '+name+' in '+path);
 },fetch:(...args)=>fetch(...args),process,console,Buffer,AbortSignal,URL,URLSearchParams,
 Date,BigInt,Map,Set,Promise,TextEncoder},{filename:path});
 return exports;
}
assert.equal(typeof engine.applyInventoryCommand,'function','W7 engine must transpile to executable JS');
const contracts={
 companyDocumentPath:(company,kind,id)=>{
   if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('INVALID_ID');
   return root(company)+'/'+kind+'/'+id;
 },
 companyCollectionPath:(company,kind)=>root(company)+'/'+kind,
};
const store=load('lib/company/inventory/store.ts',{
 'server-only':{},
 '../../../firebase-applet-config.json':{projectId:project,firestoreDatabaseId:'(default)'},
 '../contracts':contracts,
 '../../server/sectorProvisioningAdmin':{getGoogleAccessToken:()=>{throw Error('REAL_TOKEN_FORBIDDEN');}},
 './engine.mjs':engine,
});
const service=load('lib/company/inventory/service.ts',{
 'server-only':{},
 './store':store,'./engine.mjs':engine,
});
const makeCtx=(company,uid,action)=>({companyId:company,workspaceId:company,uid,rootPath:root(company),action,role:'owner'});
const a='company-w7-a',b='company-w7-b',uid='qa-owner-a';
const quantity=(value,unit='UN')=>({value,unit});
const ratio={from:'UN',to:'UN',numerator:1,denominator:1};
const fields=(record)=>Object.fromEntries(Object.entries(record).map(([k,v])=>[k,encode(v)]));
function encode(v){
 if(v===null)return{nullValue:'NULL_VALUE'};
 if(typeof v==='string')return{stringValue:v};
 if(typeof v==='boolean')return{booleanValue:v};
 if(typeof v==='number')return{integerValue:String(v)};
 if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};
 if(v&&typeof v==='object')return{mapValue:{fields:fields(v)}};
 throw Error('Unknown test value');
}
async function seed(company,kind,id,extra){
 const record={schemaVersion:'company-r1-v1',companyId:company,workspaceId:company,
   createdByUid:'qa-owner',createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z',
   revision:1,status:'active',id,...extra};
 const path=root(company)+'/'+kind+'/'+id;
 const res=await fetch(rest+':commit',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer owner'},
   body:JSON.stringify({writes:[{update:{name:firestoreName+'/'+path,fields:fields(record)},
   currentDocument:{exists:false}}]})});
 assert.equal(res.status,200,kind+': '+await res.text());
}
async function fixture(company){
 await seed(company,'catalogItems','cat_qa',{canonicalUnit:'UN',sourcingOptions:[
   {sourceSupplierId:'supa',supplierSku:'SKU-A',purchaseUnit:'UN',conversion:ratio},
   {sourceSupplierId:'supb',supplierSku:'SKU-B',purchaseUnit:'UN',conversion:ratio},
 ]});
 await seed(company,'customerOrders','ord_a',{fulfillmentState:'pending',lines:[
   {id:'line_a',quantity:quantity('500'),fulfilledQuantity:quantity('0')},
 ]});
 await seed(company,'customerOrders','ord_b',{fulfillmentState:'pending',lines:[
   {id:'line_b',quantity:quantity('300'),fulfilledQuantity:quantity('0')},
 ]});
 await seed(company,'customerOrders','ord_c',{fulfillmentState:'pending',lines:[
   {id:'line_c',quantity:quantity('200'),fulfilledQuantity:quantity('0')},
 ]});
}
async function purchase(company,purchaseId,supplier,sku,qty,plans){
 const assignments=plans.map(([orderId,lineId,n])=>({customerOrderId:orderId,customerOrderLineId:lineId,quantity:quantity(n)}));
 await seed(company,'purchaseOrders',purchaseId,{workflowState:'confirmed',sourceSupplierId:supplier,
  lines:[{id:'pl_1',catalogItemId:'cat_qa',supplierSku:sku,
    quantity:quantity(qty),confirmedQuantity:quantity(qty),receivedQuantity:quantity('0'),
    conversion:ratio,allocations:assignments}]});
}
async function operation(company,uid,kind,data,idem){
 const ctx=makeCtx(company,uid,service.inventoryActionFor(kind));
 return service.executeInventory(ctx,{kind,catalogItemId:'cat_qa',...data},idem);
}
const input=(value,rest={})=>({quantity:quantity(value),...rest});
const reserved=(order,orderLine,qty)=>input(qty,{customerOrderId:order,customerOrderLineId:orderLine});
const origin=(po,order,orderLine,qty)=>({...reserved(order,orderLine,qty),purchaseOrderId:po,purchaseLineId:'pl_1'});
test('W7 service + Firestore Emulator: saldo, reservas, N:M 500=100+300+100, replay e A/B',async()=>{
 await fixture(a);await fixture(b);
 await purchase(a,'po300','supa','SKU-A','300',[['ord_a','line_a','300']]);
 await purchase(a,'po100','supb','SKU-B','100',[['ord_a','line_a','100']]);
 const loaded=await operation(a,uid,'adjust_in',input('100',{reason:'Conferência em estoque QA'}),'adjust-in-100-a');
 assert.equal(loaded.stock.onHand,'100');
 const initial=await operation(a,uid,'reserve',reserved('ord_a','line_a','100'),'reserve-100-a');
 assert.equal(initial.stock.reserved,'100');
 const p1=await operation(a,uid,'plan_purchase',origin('po300','ord_a','line_a','300'),'plan-purchase-300-a');
 const p2=await operation(a,uid,'plan_purchase',origin('po100','ord_a','line_a','100'),'plan-purchase-100-a');
 assert.deepEqual([p1.allocation.stockReserved,p2.allocation.purchasePlanned,p2.stock.onHand],['100','400','100']);
 const replay=await operation(a,uid,'plan_purchase',origin('po300','ord_a','line_a','300'),'plan-purchase-300-a');
 assert.equal(replay.eventId,p1.eventId);
 await assert.rejects(operation(a,uid,'reserve',reserved('ord_a','line_a','1'),'reserve-more-rejected'),e=>e.status===409);
 const availableB=await service.getInventory(makeCtx(b,'qa-owner-b','stockEvents:read'),'cat_qa');
 assert.equal(availableB.onHand,'0');
 await assert.rejects(operation(b,'qa-owner-b','plan_purchase',origin('po300','ord_a','line_a','100'),'cross-company-rejected'),
   e=>e.status===409);
});
test('W7 service + Firestore Emulator: PO500 para OMs 200/300 sem dupla alocação',async()=>{
 await purchase(a,'po500','supa','SKU-A','500',[
   ['ord_c','line_c','200'],['ord_b','line_b','300'],
 ]);
 const p=await operation(a,uid,'plan_purchase',origin('po500','ord_c','line_c','200'),'plan-200-customer-a');
 const q=await operation(a,uid,'plan_purchase',origin('po500','ord_b','line_b','300'),'plan-300-customer-b');
 assert.equal(q.inbound.allocated,'500');
 assert.equal(p.inbound.allocated,'200');
 await assert.rejects(operation(a,uid,'plan_purchase',origin('po500','ord_c','line_c','1'),'overpurchase-500'),e=>e.status===409);
});
test('W7 service + Firestore Emulator: evento W6 purchase.received é lançado uma vez, entre UIDs',async()=>{
 await seed(a,'inboundShipments','w6_evt_a',{
   kind:'purchase.received',purchaseOrderId:'po300',sourceSupplierId:'supa',
   receiptReference:'DANFE-QA-100',stockPosted:false,
   receivedDeltas:[{lineId:'pl_1',catalogItemId:'cat_qa',quantity:quantity('100'),conversion:ratio}],
 });
 const payload={purchaseOrderId:'po300',purchaseLineId:'pl_1',purchaseEventId:'w6_evt_a'};
 const result=await operation(a,uid,'consume_receipt',payload,'consume-w6-receipt-a');
 assert.equal(result.stock.onHand,'200');
 assert.equal(result.inbound.received,'100');
 const replay=await operation(a,uid,'consume_receipt',payload,'consume-w6-receipt-a');
 assert.equal(replay.eventId,result.eventId);
 await assert.rejects(operation(a,'qa-stock-operator','consume_receipt',payload,'other-uid-other-key'),e=>e.status===409);
 const stock=await service.getInventory(makeCtx(a,uid,'stockEvents:read'),'cat_qa');
 assert.equal(stock.onHand,'200','Repeated receipt cannot increase physical stock');
});
