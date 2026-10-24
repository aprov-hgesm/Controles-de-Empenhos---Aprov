#!/usr/bin/env node
/**
 * Motor de Confianca — leituras reais sob IAM, banco demo isolado.
 * NUNCA utiliza banco ou credenciais de producao.
 */
import assert from 'node:assert/strict';
import { warehouseMobileReadServer } from '../lib/server/warehouseMobileRead';
import { bindWarehouseMobileTrust } from '../lib/server/warehouseMobileTrust.mjs';

process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR='1';
process.env.EMPROVEX_E2E_SERVER_AUTH='1';
process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID='demo-emprovex-security';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';

const project='demo-emprovex-security',db='emprovex-warehouse',ws='hgesm-aprov',ug='160416';
const root='projects/'+project+'/databases/'+db+'/documents';
const base='http://127.0.0.1:8080/v1/';
const actor={uid:'mobile-trust-tester',email:'tester@example.invalid',
  workspaceId:ws,ug,claimsUpdated:false};
const matId='mat_'+'a'.repeat(32),locId='loc_'+'b'.repeat(32);
const invId='inv_'+'c'.repeat(32),itemId='invit_'+'d'.repeat(64);
const fields=(value:Record<string,unknown>):Record<string,unknown>=>
  Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
function encode(v:unknown):Record<string,unknown> {
  if(v===null)return {nullValue:'NULL_VALUE'};
  if(typeof v==='string')return {stringValue:v};
  if(typeof v==='boolean')return {booleanValue:v};
  if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};
  if(v&&typeof v==='object')return {mapValue:{fields:fields(v as Record<string,unknown>)}};
  throw Error('Invalid seed');
}
async function put(path:string,data:Record<string,unknown>) {
  const response=await fetch(base+root+':commit',{method:'POST',headers:{
    'content-type':'application/json',authorization:'Bearer owner',
  },body:JSON.stringify({writes:[{update:{name:root+'/'+path,fields:fields(data)}}]})});
  assert.equal(response.status,200,'Seed failed: '+await response.text());
}
function read(input:Record<string,unknown>) {
  return warehouseMobileReadServer(actor,input);
}
async function main() {
  const trusted=bindWarehouseMobileTrust(actor,{workspaceId:ws,action:'MOBILE_READ'});
  assert.equal(trusted.ug,ug);
  assert.throws(()=>bindWarehouseMobileTrust(actor,{workspaceId:'other-ws',action:'MOBILE_READ'}),
    /WAREHOUSE_MOBILE_TRUST_SCOPE_DENIED/);
  assert.throws(()=>bindWarehouseMobileTrust(actor,{workspaceId:ws,action:'ADMIN_DELETE'}),
    /WAREHOUSE_MOBILE_TRUST_ACTION_DENIED/);
  console.log('PASS: politica de confianca sem login/regras extras');

  const prefix='warehouse/'+ws+'/';
  await put(prefix+'materials/'+matId,{workspaceId:ws,ug,id:matId,name:'Item piloto'});
  await put(prefix+'locationBalances/'+locId,{workspaceId:ws,ug,id:locId,materialId:matId,
    position:{kind:'LOCATION',locationId:'loc_'+'e'.repeat(32)},quantity:7});
  await put(prefix+'inventories/'+invId,{workspaceId:ws,ug,id:invId,
    createdAt:'2026-10-24T00:00:00.000Z'});
  await put(prefix+'inventories/'+invId+'/items/'+itemId,{
    workspaceId:ws,ug,id:itemId,inventoryId:invId,materialId:matId,
  });
  const material=await read({kind:'DOCUMENT',domain:'materials',id:matId});
  assert.equal(material.documents.length,1);
  assert.equal(material.documents[0].data.workspaceId,ws);
  const missing=await read({kind:'DOCUMENT',domain:'materials',id:'mat_'+'f'.repeat(32)});
  assert.deepEqual(missing.documents,[]);
  const batch=await read({kind:'BATCH',domain:'materials',ids:[matId,'mat_'+'f'.repeat(32)]});
  assert.equal(batch.documents.length,1);
  console.log('PASS: documentos existentes, ausentes e batchGet');

  const balance=await read({kind:'QUERY',domain:'locationBalances',
    filters:[{field:'materialId',op:'==',value:matId}],maxResults:60});
  assert.equal(balance.documents.length,1);
  const inventoried=await read({kind:'QUERY',domain:'inventories',filters:[],
    maxResults:60,newestFirst:true});
  assert.equal(inventoried.documents.length,1);
  const items=await read({kind:'QUERY',domain:'items',inventoryId:invId,
    filters:[],maxResults:500});
  assert.equal(items.documents.length,1);
  console.log('PASS: queries escopadas de saldos e inventario');

  for(const input of [
    {kind:'QUERY',domain:'materials',filters:[{field:'secret',op:'==',value:'x'}],maxResults:10},
    {kind:'QUERY',domain:'materials',filters:[],maxResults:501},
    {kind:'QUERY',domain:'destinations',filters:[],maxResults:500},
    {kind:'DOCUMENT',domain:'../../workspaces',id:'probe'},
    {kind:'BATCH',domain:'materials',ids:[matId,matId]},
    {kind:'QUERY',domain:'items',filters:[],maxResults:2},
  ]) {
    await assert.rejects(()=>read(input),/WAREHOUSE_MOBILE_READ_INVALID/);
  }
  console.log('PASS: filtros, limites e caminhos arbitrarios negados');

  await put(prefix+'materials/'+'mat_'+'e'.repeat(32),{
    workspaceId:ws,ug:'999999',id:'mat_'+'e'.repeat(32),
  });
  await assert.rejects(()=>read({kind:'DOCUMENT',domain:'materials',id:'mat_'+'e'.repeat(32)}),
    /WAREHOUSE_MOBILE_READ_SCOPE_INTEGRITY/);
  console.log('PASS: divergencia de UG no documento bloqueada');
  console.log('MOBILE TRUST READ EMULATOR PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
