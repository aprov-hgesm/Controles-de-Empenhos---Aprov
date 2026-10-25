#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({ console, encodeURIComponent, Date });
async function load(file, runtimeImports = {}) {
  const source = readFileSync(resolve(process.cwd(), 'lib', file + '.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    fileName: file + '.ts',
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = new vm.SourceTextModule(js, { context, identifier: 'file:///lib/' + file + '.js' });
  await mod.link(async (specifier) => {
    if (!runtimeImports[specifier]) throw new Error('Unexpected runtime import: ' + specifier);
    return runtimeImports[specifier];
  });
  await mod.evaluate();
  return mod;
}
const identity = await load('invoiceIdentity');
const v2 = await load('financialIdentityV2', { './invoiceIdentity': identity });
const ns = await load('nsIntegrity', { './invoiceIdentity': identity });
const concurrency = await load('empenhoConcurrency');
const {
  resolveInvoiceFiscalIdentityV2: resolveFiscal,
  compareInvoiceFiscalIdentitiesV2: compare,
  resolveHistoricalInvoiceRecordKey,
  normalizeInvoiceSeries,
  normalizeInvoiceModel,
  hasValidNfeAccessKeyCheckDigit,
  assertInvoiceItemReferences,
  assertInvoicePdfReferences,
  assertDistinctPdfVersionIds,
} = v2.namespace;

const A = '02483088000175';
const B = '00000000E08G12';
const base = (patch = {}) => ({ supplierCnpj: A, number: '01234', series: '001', model: '55', ...patch });
function accessKey({ cnpj = A, model = '55', series = '001', number = '000001234' } = {}) {
  const stem = '43' + '2610' + cnpj + model + series + number + '1' + '12345678';
  let weight = 2, sum = 0;
  for (let i = 42; i >= 0; i--) {
    sum += Number(stem[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  return stem + (remainder < 2 ? 0 : 11 - remainder);
}
const pdf = (patch = {}) => ({
  id: 'pdf-v1', pathname: 'documentos/NF-1234.pdf', originalName: 'NF.pdf',
  contentType: 'application/pdf', size: 1024, uploadedAt: '2026-10-01T00:00:00.000Z',
  uploadedBy: 'uid-a', invoiceId: '1234', empenhoId: '2026NE000001',
  storage: { provider: 'google-drive', status: 'active', objectKey: 'drive-file-1', workspaceId: 'ws-a' },
  ...patch,
});

test('V2 distinguishes same NF number across suppliers including alphanumeric CNPJ', () => {
  assert.equal(resolveFiscal(base()).status, 'complete');
  assert.equal(compare(base(), base({ supplierCnpj: B })), 'distinct');
  assert.equal(resolveFiscal(base({ supplierCnpj: B })).status, 'complete');
});

test('V2 separates different series without making writes or changing legacy keys', () => {
  assert.equal(normalizeInvoiceSeries('001'), '1');
  assert.equal(normalizeInvoiceModel('55'), '55');
  assert.equal(compare(base(), base({ series: '002' })), 'distinct');
  assert.equal(resolveHistoricalInvoiceRecordKey({ id: '001234' }), '001234');
  assert.equal(resolveHistoricalInvoiceRecordKey({ id: '1234', recordKey: 'nf_' + A + '_1234' }), 'nf_' + A + '_1234');
  assert.equal(identity.namespace.buildInvoiceRecordKey(A, '1234'), identity.namespace.buildInvoiceRecordKey(A, '01234'));
});

test('same supplier, number, model and normalized series is a duplicate', () => {
  assert.equal(compare(base(), base({ number: '1234', series: '1' })), 'duplicate');
});

test('legacy without CNPJ or series and invalid values never authorizes uniqueness', () => {
  assert.equal(compare(base(), { number: '1234' }), 'ambiguous');
  assert.equal(compare(base(), base({ series: null })), 'ambiguous');
  assert.equal(compare(base(), base({ series: 'a' })), 'ambiguous');
  assert.equal(resolveFiscal(base({ supplierCnpj: '22222222000182' })).status, 'invalid');
  assert.equal(resolveFiscal(base({ supplierCnpj: null })).status, 'incomplete');
});

test('NFe 44-digit key checks DV and embedded fiscal fields', () => {
  const key = accessKey();
  assert.equal(key.length, 44);
  assert.equal(hasValidNfeAccessKeyCheckDigit(key), true);
  assert.equal(resolveFiscal(base({ accessKey: key })).status, 'complete');
  assert.equal(resolveFiscal(base({ accessKey: key.slice(0, 43) + String((Number(key[43]) + 1) % 10) })).status, 'invalid');
  assert.equal(resolveFiscal(base({ series: '2', accessKey: key })).status, 'invalid');
  assert.equal(resolveFiscal(base({ supplierCnpj: B, accessKey: key })).status, 'invalid');
});

test('existing NS scope, legacy locks and ownership contracts remain enforced', () => {
  const sn = '2026NS000001';
  assert.notEqual(ns.namespace.buildNsLockDocumentId('160416', sn), ns.namespace.buildNsLockDocumentId('160415', sn));
  assert.equal(ns.namespace.buildLegacyNsLockDocumentId(sn), 'sagNsLock_' + sn);
  assert.throws(() => ns.namespace.assertNsLockOwnership(
    { numeroNS: sn, ug: '160416', invoiceRecordKey: 'other-record' },
    { invoiceRecordKey: 'nf-record' }, '160416', sn, 'ns_lock_conflict'
  ), (e) => e?.code === 'ns_lock_conflict');
});

test('revision stale is rejected by the actual empenho contract', () => {
  assert.throws(() => concurrency.namespace.assertEmpenhoRevision(
    { id: '2026NE000001', revision: 3 }, 2
  ), (e) => e?.code === 'stale_revision');
});

test('invoice item references reject missing item, duplicate and warehouse mismatch', () => {
  const empenho = { id: '2026NE000001', items: [{ id: 'item-1', warehouseMaterialId: 'material-1' }] };
  const inv = { empenhoId: '2026NE000001', items: [{ itemId: 'item-1', warehouseMaterialId: 'material-1' }] };
  assert.doesNotThrow(() => assertInvoiceItemReferences(inv, empenho));
  assert.throws(() => assertInvoiceItemReferences({ ...inv, empenhoId: 'another' }, empenho), (e) => e?.code === 'empenho_mismatch');
  assert.throws(() => assertInvoiceItemReferences({ ...inv, items: [{ itemId: 'item-2' }] }, empenho), (e) => e?.code === 'unknown_empenho_item');
  assert.throws(() => assertInvoiceItemReferences({ ...inv, items: [inv.items[0], inv.items[0]] }, empenho), (e) => e?.code === 'duplicate_or_missing_item');
  assert.throws(() => assertInvoiceItemReferences({ ...inv, items: [{ itemId: 'item-1', warehouseMaterialId: 'material-2' }] }, empenho), (e) => e?.code === 'warehouse_link_conflict');
});

test('PDF logical ID and file storage ownership remain distinct', () => {
  const expected = { invoiceId: '1234', empenhoId: '2026NE000001', workspaceId: 'ws-a', documentId: 'pdf-v1', objectKey: 'drive-file-1' };
  assert.equal(assertInvoicePdfReferences(pdf(), expected), 'verified');
  assert.equal(assertInvoicePdfReferences(pdf({ storage: undefined }), expected), 'legacy-unverified');
  assert.throws(() => assertInvoicePdfReferences(pdf(), { ...expected, workspaceId: 'ws-b' }), (e) => e?.code === 'pdf_workspace_mismatch');
  assert.throws(() => assertInvoicePdfReferences(pdf({ invoiceId: 'foreign' }), expected), (e) => e?.code === 'pdf_owner_mismatch');
  assert.throws(() => assertDistinctPdfVersionIds(pdf(), [pdf({ pathname: 'different', storage: { ...pdf().storage, objectKey: 'other-file' } })]), (e) => e?.code === 'pdf_version_identity_collision');
});

test('scope claims cannot substitute authoritative session identity', () => {
  const expected = { invoiceId: '1234', empenhoId: '2026NE000001', workspaceId: 'trusted-ws' };
  assert.throws(() => assertInvoicePdfReferences(pdf({ storage: { ...pdf().storage, workspaceId: 'forged-ws' } }), expected), (e) => e?.code === 'pdf_workspace_mismatch');
  assert.equal(assertInvoicePdfReferences(pdf({ storage: undefined }), expected), 'legacy-unverified');
});


test('NS snapshot blocks reuse inside the UG and tolerates another UG', () => {
  const em = { id: '2026NE000001', supplierCnpj: A, items: [] };
  const target = {
    recordKey: 'nf_' + A + '_1234',
    invoice: { id: '1234', recordKey: 'nf_' + A + '_1234', empenhoId: em.id, supplierCnpj: A },
  };
  const owner = {
    recordKey: 'nf_' + A + '_5678',
    invoice: { id: '5678', recordKey: 'nf_' + A + '_5678', empenhoId: em.id, supplierCnpj: A,
      numeroNS: '2026NS000001', nsUg: '160416' },
  };
  const mutation = {
    invoiceRecordKey: target.recordKey, invoiceId: target.invoice.id,
    empenhoId: em.id, supplierCnpj: A, expectedCurrentUg: null,
    expectedCurrentNs: null, proposedUg: '160416', proposedNs: '2026NS000001', source: 'manual',
  };
  const check = (other) => ns.namespace.validateNsIntegritySnapshot({
    mutations: [mutation], targetInvoiceDocuments: [target],
    knownOwnerInvoiceDocuments: [target, other], empenhos: [em],
  });
  assert.throws(() => check(owner), (e) => e?.code === 'ns_reused_in_scope');
  assert.equal(check({ ...owner, invoice: { ...owner.invoice, nsUg: '160415' } }).writes.length, 1);
  assert.throws(
    () => check({ ...owner, invoice: { ...owner.invoice, nsUg: undefined } }),
    (e) => e?.code === 'ns_reused_in_scope'
  );
});

test('legacy NS lock is recognized and a forged owner is rejected', () => {
  const sn = '2026NS000001';
  const lock = { numeroNS: sn, invoiceRecordKey: 'legacy-record' };
  assert.equal(ns.namespace.buildLegacyNsLockDocumentId(sn), 'sagNsLock_' + sn);
  const ownership = { invoiceRecordKey: 'legacy-record' };
  assert.doesNotThrow(
    () => ns.namespace.assertNsLockOwnership(lock, ownership, null, sn, 'stale_lock_owner')
  );
  assert.throws(
    () => ns.namespace.assertNsLockOwnership(lock, { invoiceRecordKey: 'forged-record' }, null, sn, 'stale_lock_owner'),
    (e) => e?.code === 'stale_lock_owner'
  );
});

test('missing PDF identification, forged ownership and ambiguous versions fail closed', () => {
  const expected = { invoiceId: '1234', empenhoId: '2026NE000001', workspaceId: 'ws-a' };
  assert.throws(
    () => assertInvoicePdfReferences(pdf({ id: '' }), expected),
    (e) => e?.code === 'invalid_pdf_identity'
  );
  assert.throws(
    () => assertInvoicePdfReferences(pdf({ empenhoId: 'forged-empenho' }), expected),
    (e) => e?.code === 'pdf_owner_mismatch'
  );
  assert.throws(
    () => assertInvoicePdfReferences(pdf({ storage: { ...pdf().storage, workspaceId: 'ws-b' } }), expected),
    (e) => e?.code === 'pdf_workspace_mismatch'
  );
  assert.doesNotThrow(() => assertDistinctPdfVersionIds(pdf(), [
    pdf({ id: 'pdf-v2', pathname: 'documentos/NF-v2.pdf',
      storage: { ...pdf().storage, objectKey: 'drive-file-2' } }),
  ]));
});


test('PDF identity attestation distinguishes trusted IDs from matching untrusted metadata', () => {
  const expected = { invoiceId: '1234', empenhoId: '2026NE000001',
    workspaceId: 'ws-a', documentId: 'pdf-v1', objectKey: 'drive-file-1' };
  assert.equal(assertInvoicePdfReferences(pdf(), expected), 'verified');
  assert.equal(assertInvoicePdfReferences(pdf(), {
    invoiceId: '1234', empenhoId: '2026NE000001', workspaceId: 'ws-a',
  }), 'unattested');
  assert.throws(() => assertInvoicePdfReferences(pdf({ id: 'forged-document-id' }), expected),
    (e) => e?.code === 'pdf_document_id_mismatch');
  assert.throws(() => assertInvoicePdfReferences(pdf({
    storage: { ...pdf().storage, objectKey: 'forged-physical-file' },
  }), expected), (e) => e?.code === 'pdf_object_key_mismatch');
  assert.throws(() => assertInvoicePdfReferences(pdf({
    storage: { ...pdf().storage, objectKey: '' },
  }), expected), (e) => e?.code === 'invalid_pdf_storage');
  assert.equal(assertInvoicePdfReferences(pdf({ storage: undefined }), expected),
    'legacy-unverified');
});
