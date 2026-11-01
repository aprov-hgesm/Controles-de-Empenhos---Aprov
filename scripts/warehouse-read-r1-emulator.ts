#!/usr/bin/env node
/**
 * Full-stack Warehouse READ-R1 contract smoke in disposable Firestore Emulator.
 * Writes ONLY to demo-emprovex-security / local 127.0.0.1.
 */
import assert from 'node:assert/strict';
import { createWarehouseItemIntakeId } from '../lib/warehouse/intake';
import { readWarehouseInvoiceQueueServer } from '../lib/server/warehouseQueueReadServer';

process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR='1';
process.env.EMPROVEX_E2E_SERVER_AUTH='1';
process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID='demo-emprovex-security';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';

const project='demo-emprovex-security';
const ws='hgesm-aprov',ug='160416';
const empId='read-r1-empenho-01',nfKey='read-r1-invoice-01',nfId='2026NF810001';
const itemId='read-r1-item-01';
const actor={uid:'read-r1-emulator-uid',email:'read-r1@example.invalid',
  workspaceId:ws,ug,sectorType:'aprovisionamento' as const,claimsUpdated:false};
const parent=(database:string)=>'projects/'+project+'/databases/'+database+'/documents';
const endpoint='http://127.0.0.1:8080/v1/';

function encode(v:unknown):Record<string,unknown> {
  if(v===null)return {nullValue:'NULL_VALUE'};
  if(typeof v==='string')return {stringValue:v};
  if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(typeof v==='boolean')return {booleanValue:v};
  if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};
  if(v && typeof v==='object')return {mapValue:{fields:fields(v as Record<string,unknown>)}};
  throw Error('unencodable value');
}
function fields(v:Record<string,unknown>):Record<string,unknown> {
  return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]));
}
async function put(db:string,path:string,data:Record<string,unknown>) {
  const parentPath=parent(db);
  const response=await fetch(endpoint+parentPath+':commit',{
    method:'POST',headers:{'content-type':'application/json','authorization':'Bearer owner'},
    body:JSON.stringify({writes:[{update:{name:parentPath+'/'+path,fields:fields(data)}}]}),
  });
  assert.equal(response.status,200,'seed failed: '+await response.text());
}
async function main() {
  await put('(default)','workspaces/'+ws+'/empenhos/'+empId,{
    id:empId,supplier:'Fornecedor READ R1',description:'QA READ',
    date:'2026-10-21',status:'Ativo',pregao:'2026/01',
    items:[{id:itemId,name:'Arroz integral',unit:'KG',quantity:8,unitPrice:10}],
  });
  await put('(default)','workspaces/'+ws+'/invoices/'+nfKey,{
    id:nfId,empenhoId:empId,supplier:'Fornecedor READ R1',
    issueDate:'2026-10-21',registeredAt:'2026-10-21T05:30:00.000Z',
    totalValue:80,items:[{itemId,quantity:8,unitPrice:10,subtotal:80}],
  });
  await put('emprovex-warehouse','warehouse/'+ws+'/settings/invoice-integration',{
    cutoffAt:'2026-10-20T00:00:00.000Z',
  });
  const first=await readWarehouseInvoiceQueueServer(actor);
  assert.equal(first.rows.length,1);
  assert.equal(first.rows[0].status,'PENDING');
  assert.equal(first.rows[0].pendingQuantity,8);
  assert.equal(first.rows[0].pregao,'2026/01');
  assert.equal(first.truncated,false);
  console.log('PASS: server bootstrap and source canonical NF/NE');

  const second=await readWarehouseInvoiceQueueServer(actor);
  assert.deepEqual(second,first);
  console.log('PASS: idempotent repeated queue read');

  const stateId=await createWarehouseItemIntakeId(ws,nfKey,itemId);
  const state={
    schemaVersion:'warehouse_item_intake_v2',id:stateId,workspaceId:ws,ug,
    invoiceRecordKey:nfKey,invoiceId:nfId,empenhoId:empId,itemId,
    materialId:null,description:'Arroz integral',unitLabel:'KG',
    supplier:'Fornecedor READ R1',receivedQuantity:8,allocatedQuantity:3,
    immediateConsumptionQuantity:0,pendingQuantity:5,status:'PARTIALLY_PROCESSED',
    createdAt:null,updatedAt:null,createdBy:actor.uid,updatedBy:actor.uid,
  };
  await put('emprovex-warehouse','warehouse/'+ws+'/intakes/'+stateId,state);
  const partial=await readWarehouseInvoiceQueueServer(actor);
  assert.equal(partial.rows[0].allocatedQuantity,3);
  assert.equal(partial.rows[0].pendingQuantity,5);
  assert.equal(partial.rows[0].status,'PARTIALLY_PROCESSED');
  console.log('PASS: server partial allocation state (5 remaining)');

  await put('(default)','workspaces/'+ws+'/invoices/'+nfKey,{
    id:nfId,empenhoId:empId,supplier:'Fornecedor READ R1',
    issueDate:'2026-10-21',registeredAt:'2026-10-21T05:30:00.000Z',
    totalValue:90,items:[{itemId,quantity:9,unitPrice:10,subtotal:90}],
  });
  const inconsistent=await readWarehouseInvoiceQueueServer(actor);
  assert.equal(inconsistent.rows[0].status,'RECONCILIATION_REQUIRED');
  assert.equal(inconsistent.rows[0].reconciliationReason,'CANONICAL_QUANTITY_CHANGED');
  console.log('PASS: quantity divergence requires reconciliation');

  const other=await readWarehouseInvoiceQueueServer({...actor,
    workspaceId:'read-r1-other-workspace',ug:'999999'});
  assert.equal(other.rows.length,0);
  console.log('PASS: workspace isolation');
  console.log('WAREHOUSE READ R1 EMULATOR PASS');
}
main().catch((error:unknown)=>{
  console.error(error);
  process.exitCode=1;
});
