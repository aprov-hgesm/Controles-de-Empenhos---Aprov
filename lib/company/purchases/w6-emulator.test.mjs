/**
 * W6 integration: real Firestore Emulator transactions using W1/W2-shaped fixtures.
 * NO production, NO simulated test results, NO W7 ledger writes.
 * Separate W0 CI covers Auth; this service-level suite does not assert login E2E.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const requireNode=createRequire(import.meta.url);
const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'';
assert.match(project,/^demo-[a-z0-9-]+$/);
assert.equal(process.env.EMPROVEX_E2E_SERVER_AUTH,'1');
assert.ok(['127.0.0.1:8080','localhost:8080'].includes(process.env.FIRESTORE_EMULATOR_HOST));
assert.ok(['127.0.0.1:9099','localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST));
assert.ok(!process.env.K_SERVICE&&!process.env.VERCEL&&!process.env.GAE_SERVICE);
const root='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/'+project+'/databases/(default)/documents';
function load(path,modules={}){
  const source=readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
  const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.equal(result.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length||0,0,path);
  const exported={};
  runInNewContext(result.outputText,{
    exports:exported,require(id){
      if(Object.hasOwn(modules,id))return modules[id];
      if(id.startsWith('node:'))return requireNode(id);
      throw Error('Unauthorized test import: '+id+' from '+path);
    },fetch:(...args)=>fetch(...args),process,console,Buffer,AbortSignal,URL,URLSearchParams,
    Request,Response,TextEncoder,Date,BigInt,Map,Set,Promise,
  },{filename:path});
  return exported;
}
const contracts={
  COMPANY_CONTRACT_VERSION:'company-r1-v1',
  companyDocumentPath:(company,kind,id)=>{
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('invalid id');
    return 'supplierCompanyWorkspaces/'+company+'/'+kind+'/'+id;
  },
};
const domain=load('lib/company/purchases/domain.ts');
const store=load('lib/company/purchases/store.ts',{
  'server-only':{},
  '../../../firebase-applet-config.json':{projectId:project,firestoreDatabaseId:'(default)'},
  '../../server/sectorProvisioningAdmin':{getGoogleAccessToken:()=>{throw Error('PRODUCTION_TOKEN_FORBIDDEN');}},
  '../contracts':contracts,'./domain':domain,
});
const c=(companyId,uid)=>({companyId,workspaceId:companyId,uid,
  rootPath:'supplierCompanyWorkspaces/'+companyId,companyName:'Empresa QA '+companyId,legalName:'Empresa QA '+companyId});
const a=c('company-w6-a','owner-a'),b=c('company-w6-b','owner-b');
const q=value=>({value,unit:'UN'});
const factor={from:'UN',to:'UN',numerator:1,denominator:1};
const encode=v=>{
  if(v===null)return{nullValue:'NULL_VALUE'};
  if(typeof v==='string')return{stringValue:v};
  if(typeof v==='number')return{integerValue:String(v)};
  if(typeof v==='boolean')return{booleanValue:v};
  if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};
  return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,val])=>[k,encode(val)]))}};
};
async function seed(ctx,kind,id,extra){
  const path=ctx.rootPath+'/'+kind+'/'+id;
  const value={schemaVersion:'company-r1-v1',id,companyId:ctx.companyId,workspaceId:ctx.companyId,
    createdByUid:ctx.uid,status:'active',revision:1,...extra};
  const response=await fetch(root+':commit',{method:'POST',headers:{'content-type':'application/json',
    authorization:'Bearer owner'},body:JSON.stringify({writes:[{update:{name:root.split('/v1/')[1]+'/'+path,
      fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))},
      currentDocument:{exists:false}}]})});
  assert.equal(response.status,200,await response.text());
}
async function fixture(ctx){
  await seed(ctx,'sourceSuppliers','sup_a',{legalName:'Fonte QA',lifecycle:'active'});
  await seed(ctx,'catalogItems','cat_a',{title:'Produto QA',canonicalUnit:'UN',
    sourcingOptions:[{sourceSupplierId:'sup_a',supplierSku:'SKU1',purchaseUnit:'UN',conversion:factor,priceHistory:[]}]});
  await seed(ctx,'customerOrders','order_a',{reference:'Pedido da OM QA',
    lines:[{id:'line_a',quantity:q('500'),fulfilledQuantity:q('0')}]});
}
const body=(qty='400')=>({sourceSupplierId:'sup_a',reference:'OC-2026-TEST',desiredAt:'2026-12-01T12:00:00Z',
  lines:[{id:'item_1',catalogItemId:'cat_a',supplierSku:'SKU1',description:'Produto de QA',
    quantity:q(qty),conversion:factor,unitPriceCents:3100,
    priceEvidence:{reference:'Cotação QA confirmada',quotedAt:'2026-11-05T10:00:00Z'},
    allocations:[{customerOrderId:'order_a',customerOrderLineId:'line_a',quantity:q('200')}]}]});
let firstId='';
test('W6: criação real em duas empresas demo com isolamento, idempotência e auditoria',async()=>{
  await fixture(a);await fixture(b);
  const one=await store.createPurchase(a,body(),'w6-idempotent-create-001');
  firstId=one.result.id;assert.equal(one.replayed,false);
  assert.equal(one.result.companyId,a.companyId);
  assert.equal(one.result.workflowState,'draft');
  assert.equal(one.result.lines[0].receivedQuantity.value,'0');
  const replay=await store.createPurchase(a,body(),'w6-idempotent-create-001');
  assert.equal(replay.replayed,true);assert.equal(replay.result.id,firstId);
  await assert.rejects(store.createPurchase(a,body('450'),'w6-idempotent-create-001'),
    e=>e.status===409);
  await assert.rejects(store.getPurchase(b,firstId),e=>e.status===404);
  const other=await store.createPurchase(b,body(),'w6-idempotent-create-001');
  assert.equal(other.result.companyId,b.companyId);
  assert.notEqual(other.result.id,firstId);
  const page=await store.listPurchases(a,20,'');
  assert.equal(page.items.length,1);assert.equal(page.items[0].companyId,a.companyId);
  const need=await store.previewPurchaseNeed(a,'order_a');
  assert.equal(need.lines[0].outstanding.value,'500');
  assert.equal(need.lines[0].netShortage,null);
  const doublePlan=body('300');
  doublePlan.lines[0].allocations[0].quantity=q('300');
  const second=structuredClone(doublePlan.lines[0]);second.id='item_2';
  doublePlan.lines.push(second);
  await assert.rejects(store.createPurchase(a,doublePlan,'w6-double-plan-001'),e=>e.status===409);
});
test('W6: concorrência por CAS permite uma mutação, nunca duas',async()=>{
  const send={action:'sent',expectedRevision:1,channel:'email',confirmationRef:'EMAIL-QA-1',confirmedByOperator:true};
  const result=await Promise.allSettled([
    store.updatePurchase(a,firstId,send,'w6-send-concurrent-001'),
    store.updatePurchase(a,firstId,{action:'cancel',expectedRevision:1,reference:'CANCEL-QA'},'w6-cancel-concurrent-001')
  ]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  const rejected=result.filter(x=>x.status==='rejected');
  assert.equal(rejected.length,1);
  assert.equal(rejected[0].reason.status,409);
});
test('W6: confirmação parcial e recebimento persistem evento, não estoque',async()=>{
  const created=await store.createPurchase(a,body(),'w6-create-followup-001');
  const id=created.result.id;
  const sent=await store.updatePurchase(a,id,{action:'sent',expectedRevision:1,channel:'email',
    confirmationRef:'MAIL-001',confirmedByOperator:true},'w6-followup-sent-001');
  assert.equal(sent.result.workflowState,'sent');
  const replied=await store.updatePurchase(a,id,{action:'reply',expectedRevision:2,reference:'RESP-001',
    confirmed:[{lineId:'item_1',quantity:q('250')}],promisedAt:'2026-12-15T12:00:00Z'},'w6-followup-reply-001');
  assert.equal(replied.result.workflowState,'partially_confirmed');
  assert.equal(replied.result.lines[0].receivedQuantity.value,'0');
  const received=await store.updatePurchase(a,id,{action:'receive',expectedRevision:3,reference:'DANFE-QA-001',
    received:[{lineId:'item_1',quantity:q('100')}]},'w6-followup-receive-001');
  assert.equal(received.result.workflowState,'partially_received');
  assert.equal(received.event.kind,'purchase.received');
  assert.equal(received.event.receivedDeltas[0].quantity.value,'100');
  assert.equal(received.event.stockPosted,false);
  const duplicated=await store.updatePurchase(a,id,{action:'receive',expectedRevision:3,reference:'DANFE-QA-001',
    received:[{lineId:'item_1',quantity:q('100')}]},'w6-followup-receive-001');
  assert.equal(duplicated.replayed,true);assert.equal(duplicated.event.id,received.event.id);
  await assert.rejects(store.updatePurchase(a,id,{action:'receive',expectedRevision:4,reference:'DANFE-QA-001',
    received:[{lineId:'item_1',quantity:q('10')}]},'w6-other-key-same-proof-001'),e=>e.status===409);
  const events=await store.listPurchaseEvents(a,id,50,'');
  assert.ok(events.items.some(e=>e.kind==='purchase.received'));
  const check=await fetch(root+'/'+a.rootPath+'/stockEvents?pageSize=10',{headers:{authorization:'Bearer owner'}});
  assert.ok([200,404].includes(check.status));
  if(check.status===200)assert.equal((await check.json()).documents?.length||0,0);
});
test('W6: fornecedor suspenso/inativo bloqueia criação nova',async()=>{
  await seed(a,'sourceSuppliers','sup_suspended',{lifecycle:'suspended',status:'suspended'});
  const input=body();input.sourceSupplierId='sup_suspended';
  await assert.rejects(store.createPurchase(a,input,'w6-supplier-suspended-001'),
    e=>e.status===409);
});
