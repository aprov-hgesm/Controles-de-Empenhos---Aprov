import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';

function compile(path, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const built = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(built.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length ?? 0,0);
  const exports = {};
  runInNewContext(built.outputText,{exports,require(id){ assert.ok(Object.hasOwn(dependencies,id),`Unexpected import: ${id}`); return dependencies[id]; }, process, URL, URLSearchParams, AbortSignal, Request, Response, fetch, Date, console, ...globals});
  return exports;
}
const domain = compile('./domain.ts');
const supplier = (overrides={}) => ({legalName:'Origem Teste Ltda',tradeName:'Origem',cnpj:'11.222.333/0001-81',contacts:[{name:'Contato QA',role:'Vendas',email:'qa@example.com',phone:'',preferredChannel:'email'}],channels:['email'],commercialTerms:'Pagamento 30 dias',estimatedLeadTimeDays:5,lifecycle:'active',...overrides});
const offer = (supplierId='tax_11222333000181', extra={}) => ({ sourceSupplierId:supplierId,supplierSku:'REF-1',packageLabel:'Caixa 12',purchaseUnit:'CX',conversion:{from:'CX',to:'UN',numerator:12,denominator:1},estimatedLeadTimeDays:5,channel:'email',priceHistory:[{amountCents:1599,currency:'BRL',quotedAt:'2026-11-05',validFrom:'2026-11-05',validUntil:'2026-11-15',basis:'quotation'}],...extra });
const item = (options=[offer()]) => ({sku:'CANON-1',title:'Produto de exemplo',description:'Exemplo',canonicalUnit:'UN',sourcingOptions:options});

test('CNPJ e contatos: validação, normalização e fornecedor sem CNPJ',()=>{
  assert.equal(domain.isValidCnpj('11.222.333/0001-81'),true);
  assert.equal(domain.isValidCnpj('00.000.000/0000-00'),false);
  assert.equal(domain.parseSourceSupplier(supplier()).cnpj,'11222333000181');
  assert.equal(domain.parseSourceSupplier(supplier({cnpj:null})).cnpj,null);
  assert.throws(()=>domain.parseSourceSupplier(supplier({cnpj:'11111111111111'})),/INVALID_CNPJ/);
  assert.throws(()=>domain.parseSourceSupplier(supplier({contacts:[{name:'QA',preferredChannel:'email'}]})),/CONTACT_REQUIRES_CHANNEL/);
});
test('conversão racional exata — nenhuma quantidade é arredondada',()=>{
  assert.equal(domain.convertQuantityExact('1.5',{from:'CX',to:'UN',numerator:12,denominator:1}),'18');
  assert.equal(domain.convertQuantityExact('10',{from:'G',to:'KG',numerator:1,denominator:1000}),'0.01');
  assert.throws(()=>domain.convertQuantityExact('1',{from:'CX',to:'UN',numerator:1,denominator:3}),/INEXACT_CONVERSION/);
});
test('múltiplas fontes, datas reais de preço e impossibilidade de selecionar suspenso',()=>{
  const parsed = domain.parseCatalogItem(item([offer(),offer('name_abc',{supplierSku:'SKU-X',priceHistory:[]})]));
  assert.equal(parsed.sourcingOptions.length,2);
  assert.equal(parsed.sourcingOptions[0].priceHistory[0].quotedAt,'2026-11-05');
  assert.throws(()=>domain.parseCatalogItem(item([offer('tax_11222333000181',{conversion:{from:'CX',to:'KG',numerator:1,denominator:1}})])),/INVALID_CONVERSION/);
  assert.throws(()=>domain.parseCatalogItem(item([offer(),offer()])),/DUPLICATE_ENTRY/);
  assert.throws(()=>domain.assertSupplierSelectable({status:'suspended',lifecycle:'suspended'}),/SUPPLIER_NOT_SELECTABLE/);
});

/** Minimal deterministic Firestore REST mock: commit all-or-nothing and updateTime CAS. */
function storeFixture() {
  const records = new Map();
  let clock = 0;
  const encode = (v) => typeof v==='string'?{stringValue:v}:typeof v==='number'?{integerValue:String(v)}:typeof v==='boolean'?{booleanValue:v}:v===null?{nullValue:'NULL_VALUE'}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
  const decode = (v) => v.stringValue!==undefined?v.stringValue:v.integerValue!==undefined?Number(v.integerValue):v.booleanValue!==undefined?v.booleanValue:v.nullValue?null:v.arrayValue?v.arrayValue.values.map(decode):Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,x])=>[k,decode(x)]));
  const pathOf=(value)=>decodeURIComponent(value.split('/documents/')[1] || '');
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  async function mockFetch(url, options={}) {
    const u = new URL(url);
    if (u.pathname.endsWith(':commit')) {
      const {writes}=JSON.parse(options.body);
      for(const w of writes) {
        const p=pathOf(w.update.name);
        const old=records.get(p);
        if(w.currentDocument.exists===false && old || w.currentDocument.updateTime && old?.updateTime!==w.currentDocument.updateTime) return json({error:{status:'ALREADY_EXISTS'}},409);
      }
      for(const w of writes) records.set(pathOf(w.update.name),{fields:w.update.fields,updateTime:'t'+(++clock)});
      return json({writeResults:writes.map(()=>({}))});
    }
    const p=pathOf(u.pathname);
    const document=records.get(p);
    if(document) return json({name:p,...document});
    const candidates=[...records].filter(([k])=>k.startsWith(p+'/') && !k.slice(p.length+1).includes('/')).sort(([a],[b])=>a.localeCompare(b));
    if(candidates.length || u.searchParams.has('pageSize')) {
      const offset=Number(u.searchParams.get('pageToken')||'0');
      const limit=Number(u.searchParams.get('pageSize')||'20');
      return json({documents:candidates.slice(offset,offset+limit).map(([k,v])=>({name:k,fields:v.fields,updateTime:v.updateTime})),nextPageToken:offset+limit<candidates.length?String(offset+limit):undefined});
    }
    return json({error:'NOT_FOUND'},404);
  }
  const store=compile('./store.ts',{'server-only':{},'node:crypto':{createHash,randomUUID},'../../../firebase-applet-config.json':{projectId:'demo-emprovex-company-w2',firestoreDatabaseId:'(default)'},'../../server/sectorProvisioningAdmin':{getGoogleAccessToken:async()=> 'unused'},'../contracts':{COMPANY_CONTRACT_VERSION:'company-r1-v1',companyDocumentPath:(companyId,collection,id)=>`supplierCompanyWorkspaces/${companyId}/${collection}/${id}`},'./domain':domain},{fetch:mockFetch,process:{env:{EMPROVEX_E2E_SERVER_AUTH:'1',NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID:'demo-emprovex-company-w2',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}}});
  const ctx=(id)=>({uid:id+'-uid',companyId:id,rootPath:'supplierCompanyWorkspaces/'+id});
  return {store,ctx,records,decode};
}
test('isolamento A/B, mesmo CNPJ por tenant, duplicidade e idempotência',async()=>{
  const {store,ctx}=storeFixture();
  const a=await store.createSourceSupplier(ctx('A'),supplier(),'operation-00001');
  const b=await store.createSourceSupplier(ctx('B'),supplier(),'operation-00001');
  assert.equal(a.result.id,b.result.id);
  assert.notEqual(a.result.companyId,b.result.companyId);
  const replay=await store.createSourceSupplier(ctx('A'),supplier(),'operation-00001');
  assert.equal(replay.replay,true);
  await assert.rejects(store.createSourceSupplier(ctx('A'),supplier(),'operation-00002'),e=>e.status===409);
  await assert.rejects(store.getCompanyRecord(ctx('B'),'sourceSuppliers','name_undefined'),e=>e.status===404);
  await assert.rejects(store.getCompanyRecord(ctx('A'),'sourceSuppliers','tax_00000000000000'),e=>e.status===404);
});
test('suspensão com revisão CAS, busca/paginação e histórico append-only',async()=>{
  const {store,ctx}=storeFixture(); const A=ctx('A');
  const created=(await store.createSourceSupplier(A,supplier(),'operation-00010')).result;
  const suspended=(await store.updateSourceSupplier(A,created.id,{expectedRevision:1,data:supplier({lifecycle:'suspended'})},'operation-00011')).result;
  assert.equal(suspended.status,'suspended');
  assert.equal(suspended.revision,2);
  await assert.rejects(store.updateSourceSupplier(A,created.id,{expectedRevision:1,data:supplier()},'operation-00012'),e=>e.status===409);
  const list=await store.listCompanyRecords(A,'sourceSuppliers','origem','',1);
  assert.equal(list.items.length,1);
  const catalog=(await store.createCatalogItem(A,item(),'operation-00013')).result;
  assert.equal(catalog.sourcingOptions.length,1);
  await assert.rejects(store.resolveSourceOptionForPurchase(A,catalog.id,created.id,'REF-1'),/SUPPLIER_NOT_SELECTABLE/);
  await assert.rejects(store.updateCatalogItem(A,catalog.id,{expectedRevision:1,data:item([offer(created.id,{priceHistory:[]})])},'operation-00014'),e=>e.status===409);
});
test('APIs W2 exigem autorização antes de qualquer leitura e retornam 401/403',async()=>{
  for (const status of [401,403]) {
    let accessed=false;
    const authError=Object.assign(new Error('COMPANY_ACCOUNT_FORBIDDEN'),{status});
    const http=compile('./http.ts',{ 'next/server':{NextResponse:{json:(data,options)=>Response.json(data,options)}},'../../server/companyAuthz':{requireCompanyContext:async()=>{throw authError;},companyErrorStatus:()=>status},'./domain':domain,'./store':{SupplierServiceError:class extends Error{}} });
    const route=compile('../../../app/api/company/suppliers/route.ts',{'../../../../lib/company/suppliers/http':http,'../../../../lib/company/suppliers/store':{listCompanyRecords:async()=>{accessed=true;return [];}},'../../../../lib/company/suppliers/domain':domain});
    const response=await route.GET(new Request('https://example.test/api/company/suppliers'));
    assert.equal(response.status,status);
    assert.equal(accessed,false);
  }
});
