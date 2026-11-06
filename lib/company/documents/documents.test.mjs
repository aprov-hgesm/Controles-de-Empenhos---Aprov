import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function moduleAt(name, deps = {}) {
  const source = readFileSync(new URL(name, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports, Buffer, Date, Uint8Array, Set, Number, Object, String, JSON,
    require(name) {
      if (name === 'node:crypto') return require(name);
      if (Object.hasOwn(deps, name)) return deps[name];
      assert.fail('Dependência inesperada: ' + name);
    },
  });
  return exports;
}
const model = moduleAt('./model.ts', { '../contracts': { COMPANY_CONTRACT_VERSION: 'company-r1-v1' } });
const share = moduleAt('./shareDraft.ts');
const pdf = (value = '(Nota de Empenho) Tj') => Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length 50 >>\nstream\nBT ' + value + ' ET\nendstream\nendobj\n%%EOF\n');
const metadata = (bytes, type = 'application/pdf') => ({ name: '../../malicioso\\ne.pdf', type, size: bytes.length });
const parsed = {
  id: '2026NE123', ug: '160416', supplier: 'Fornecedor Exemplo', supplierCnpj: '11.222.333/0001-81',
  date: '05/11/2026', valorTotal: 10, items: [{ id: 'a', name: 'Produto QA', quantity: 2,
    unit: 'UN', unitPrice: 5, declaredTotal: 10 }],
};

test('rejeita PDF não textual/malformado, bytes e MIME divergentes', () => {
  const valid = pdf();
  assert.equal(model.validateUpload(metadata(valid), valid, 'ne').mime, 'application/pdf');
  assert.throws(() => model.validateUpload(metadata(valid, 'image/jpeg'), valid, 'ne'), /DOCUMENT_CONTENT_TYPE_INVALID/);
  const invalid = Buffer.from('%PDF-1.4' + ' '.repeat(40));
  assert.throws(() => model.validateUpload(metadata(invalid), invalid, 'ne'), /DOCUMENT_PDF_MALFORMED/);
  assert.throws(() => model.validateUpload({ ...metadata(valid), size: 12 * 1024 * 1024 + 1 }, valid, 'ne'), /DOCUMENT_SIZE_INVALID/);
});
test('segurança de arquivo e sanitização de caminho', () => {
  const valid = pdf();
  assert.equal(model.validateUpload(metadata(valid), valid, 'ne').filename, 'ne.pdf');
  assert.equal(model.safeFilename('..\\segredo.pdf'), 'segredo.pdf');
  assert.doesNotThrow(() => model.validateUpload(metadata(valid), valid, 'purchase'));
});
test('extração requer revisão humana e preserva BRL em centavos', () => {
  const original = model.extractedNeReview(parsed);
  assert.equal(original.totalCents, 1000);
  assert.equal(original.items[0].unitPriceCents, 500);
  assert.equal(model.validateNeReview(original).items.length, 1);
  assert.throws(() => model.validateNeReview({ ...original, items: [] }), /NE_REVIEW_INVALID/);
  assert.throws(() => model.validateNeReview({ ...original, items: [original.items[0], original.items[0]] }), /NE_LINE_INVALID/);
});
test('isolamento A/B, status e expiração do documento', () => {
  const record = model.makeRecord({
    kind: 'ne', displayName: 'ne.pdf', mediaType: 'application/pdf', byteLength: 42,
    sha256: 'a', storageObject: 'company-documents/empresa-a/d/ne.pdf',
    referenceType: null, referenceId: null, review: null, originalExtraction: null,
    confirmedByUid: null, confirmedAt: null, expiresAt: null,
  }, { id: 'd', uid: 'u', companyId: 'empresa-a', now: '2026-11-05T00:00:00.000Z' });
  assert.doesNotThrow(() => model.assertReadableCompanyDocument('empresa-a', record));
  assert.throws(() => model.assertReadableCompanyDocument('empresa-b', record), /DOCUMENT_NOT_FOUND/);
  assert.throws(() => model.assertReadableCompanyDocument('empresa-a',
    { ...record, expiresAt: '2026-01-01T00:00:00.000Z' }), /DOCUMENT_EXPIRED/);
  assert.equal(Object.hasOwn(model.publicDocument(record), 'storageObject'), false);
});
test('whatsapp/e-mail são apenas rascunhos, não evidência de envio', () => {
  const d = share.buildDocumentShareDraft({ channel: 'whatsapp', reference: 'OC-1', documentLabel: 'Pedido' });
  assert.equal(d.status, 'draft');
  assert.equal(Object.hasOwn(d, 'sentAt'), false);
  assert.ok(d.body.includes('OC-1'));
});
test('contratos do guard e da API empresarial não reutilizam endpoint setorial', () => {
  const route = readFileSync(new URL('../../../app/api/company/documents/import-ne/route.ts', import.meta.url), 'utf8');
  const confirm = readFileSync(new URL('../../../app/api/company/documents/confirm-ne/route.ts', import.meta.url), 'utf8');
  const download = readFileSync(new URL('../../../app/api/company/documents/[id]/download/route.ts', import.meta.url), 'utf8');
  assert.match(route, /requireCompanyContext/);
  assert.match(route, /parseEmpenhoPdfBytes/);
  assert.match(confirm, /NE_HUMAN_CONFIRMATION_REQUIRED/);
  assert.match(confirm, /sourceSha256/);
  assert.match(download, /authorization|requireCompanyContext/);
  assert.doesNotMatch(download, /signedUrl|publicUrl|shareToken/);
  assert.doesNotMatch(route, /api\/empenhos\/parse-ne|resolveBillingPortalSession/);
});
