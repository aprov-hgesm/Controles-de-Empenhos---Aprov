#!/usr/bin/env node
/** W4 independent cross-PR financial contracts; isolated opt-in module, no persistence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({console,encodeURIComponent,Date});
const loaded=new Map();
async function load(name) {
  if(loaded.has(name))return loaded.get(name);
  const file='lib/'+name+'.ts';
  const code=ts.transpileModule(readFileSync(file,'utf8'),{
    fileName:file,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const mod=new vm.SourceTextModule(code,{context,identifier:'file:///'+file});
  loaded.set(name,mod);
  await mod.link(async spec=>{
    if(spec==='./invoiceIdentity')return await load('invoiceIdentity');
    throw Error('UNEXPECTED_RUNTIME_IMPORT '+spec);
  });
  await mod.evaluate();return mod;
}
const invoice=(await load('invoiceIdentity')).namespace;
const fi=(await load('financialIdentityV2')).namespace;
const A='02483088000175', B='00000000E08G12';
const original={supplierCnpj:A,number:'000432',series:'001',model:'55'};
const proposed=patch=>({...original,...patch});
test('W4: same number in a different series is distinct in v2, legacy key remains unchanged',()=>{
  const series1=fi.resolveInvoiceFiscalIdentityV2(original);
  const series2=fi.resolveInvoiceFiscalIdentityV2(proposed({series:'002'}));
  assert.equal(series1.status,'complete');assert.equal(series2.status,'complete');
  assert.notEqual(series1.indexKey,series2.indexKey);
  assert.equal(fi.compareInvoiceFiscalIdentitiesV2(original,proposed({series:'002'})),'distinct');
  assert.equal(fi.compareInvoiceFiscalIdentitiesV2(original,proposed({series:'1',number:'432'})),'duplicate');
  assert.equal(invoice.buildInvoiceRecordKey(A,'432'),invoice.buildInvoiceRecordKey(A,'000432'));
  assert.equal(fi.resolveHistoricalInvoiceRecordKey({recordKey:'legacy-nf-identity'}),'legacy-nf-identity');
});
test('W4: incomplete source can be ambiguous but cannot prove false distinctness',()=>{
  for(const incomplete of [{number:'432'},{...original,series:null},{...original,supplierCnpj:null}]){
    assert.equal(fi.compareInvoiceFiscalIdentitiesV2(original,incomplete),'ambiguous');
  }
});
test('W4: supplier CNPJ, including alphanumeric supplier, scopes identity',()=>{
  const a=fi.resolveInvoiceFiscalIdentityV2(original);
  const b=fi.resolveInvoiceFiscalIdentityV2(proposed({supplierCnpj:B}));
  assert.equal(a.status,'complete');assert.equal(b.status,'complete');
  assert.notEqual(a.indexKey,b.indexKey);
  assert.equal(fi.compareInvoiceFiscalIdentitiesV2(original,proposed({supplierCnpj:B})),'distinct');
  assert.equal(fi.resolveInvoiceFiscalIdentityV2(proposed({supplierCnpj:'bogus'})).status,'invalid');
});
test('W4: forensic PDF ownership excludes forged workspace and foreign invoice',()=>{
  const pdf={id:'pdf-1',pathname:'doc/NF.pdf',invoiceId:'nf-1',empenhoId:'ne-1',
    storage:{provider:'google-drive',status:'active',workspaceId:'ws-a',objectKey:'sha-a'}};
  const expected={invoiceId:'nf-1',empenhoId:'ne-1',workspaceId:'ws-a'};
  assert.equal(fi.assertInvoicePdfReferences(pdf,expected),'unattested',
    'matching client metadata without server attestation is not verified ownership');
  const attested={...expected,documentId:pdf.id,objectKey:pdf.storage.objectKey};
  assert.equal(fi.assertInvoicePdfReferences(pdf,attested),'verified');
  assert.throws(()=>fi.assertInvoicePdfReferences(pdf,{...attested,documentId:'pdf-other'}),
    e=>e?.code==='pdf_document_id_mismatch');
  assert.throws(()=>fi.assertInvoicePdfReferences(pdf,{...attested,objectKey:'other-file'}),
    e=>e?.code==='pdf_object_key_mismatch');
  assert.throws(()=>fi.assertInvoicePdfReferences(pdf,{...expected,workspaceId:'ws-b'}),
    e=>e?.code==='pdf_workspace_mismatch');
  assert.throws(()=>fi.assertInvoicePdfReferences({...pdf,invoiceId:'nf-foreign'},expected),
    e=>e?.code==='pdf_owner_mismatch');
  assert.throws(()=>fi.assertDistinctPdfVersionIds(pdf,[{
    ...pdf,storage:{...pdf.storage,objectKey:'sha-b'}}]),
    e=>e?.code==='pdf_version_identity_collision');
});
test('W4: Invoice item and Warehouse material link cannot be swapped',()=>{
  const empenho={id:'NE-1',items:[{id:'item-1',warehouseMaterialId:'mat-a'}]};
  const invoiceRef={empenhoId:'NE-1',items:[{itemId:'item-1',warehouseMaterialId:'mat-a'}]};
  assert.doesNotThrow(()=>fi.assertInvoiceItemReferences(invoiceRef,empenho));
  assert.throws(()=>fi.assertInvoiceItemReferences({...invoiceRef,
    items:[{itemId:'item-1',warehouseMaterialId:'mat-b'}]},empenho),
    e=>e?.code==='warehouse_link_conflict');
});
