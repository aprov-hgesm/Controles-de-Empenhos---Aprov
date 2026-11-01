import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

const path = new URL('../features/almoxarifado/pdf/SeparationSheet.ts', import.meta.url);
const source = readFileSync(path, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
const exports = {};
runInNewContext(compiled.outputText, {
  exports,
  require(name) {
    if (name === '../../../lib/pdfToolkit') return { loadJsPdf: async () => jsPDF };
    if (name === '../../../lib/almoxarifado/contracts') return {
      ALMOX_REQUEST_SCHEMA_VERSION: 'almox_request_v1',
      ALMOX_PLAN_SCHEMA_VERSION: 'almox_separation_plan_v1',
      ALMOX_SHEET_SCHEMA_VERSION: 'almox_separation_sheet_v1',
    };
    throw new Error('Unexpected runtime dependency: ' + name);
  },
});

const notice = 'Documento auxiliar: NÃO substitui registro ou autorização no SISCOFIS.';
const W = 'almox-qa-01';
const depot = (id, code) => ({ id, code, name: code, workspaceId: W });
const location = (id, code, depotId, kind = 'LOCAL', parentLocationId = null) =>
  ({ id, code, name: code, workspaceId: W, depotId, kind, parentLocationId });
const depots = [depot('dep-1','DEP-01'), depot('dep-2','DEP-02')];
const locations = [
  location('loc-1', 'EST-01', 'dep-1'),
  location('loc-2', 'EST-02', 'dep-1'),
  location('loc-3', 'EST-03', 'dep-2'),
  location('sub-1', 'P-01', 'dep-1', 'SUBPOSITION', 'loc-1'),
  location('sub-2', 'P-02', 'dep-1', 'SUBPOSITION', 'loc-2'),
];
function allocation(id, depotId, locationId, subpositionId, quantity) {
  return {
    allocationId: id,
    position: {
      position: subpositionId
        ? { kind: 'SUBPOSITION', depotId, locationId, subpositionId }
        : { kind: 'LOCATION', depotId, locationId, subpositionId: null },
      balanceRevision: 1,
      availableBaseQuantity: 90,
    },
    plannedBaseQuantity: quantity,
    actualBaseQuantity: null,
  };
}
function item(i, requested, planned, allocations, description = 'Material de expediente A4') {
  return {
    imported: {
      sourceRowId: 'linha-' + i,
      sourceText: String(i),
      sourceItemCode: 'SISCO-' + i,
      description,
      sourceQuantity: requested,
      quantityMeaning: 'REQUESTED',
      sourceUnit: 'UN',
      canonicalMaterialId: 'mat-' + i,
      factorToBaseUnit: 1,
      canonicalQuantity: requested,
      matchStatus: 'CONFIRMED',
    },
    plan: {
      sourceRowId: 'linha-' + i,
      materialId: 'mat-' + i,
      requestedBaseQuantity: requested,
      plannedBaseQuantity: planned,
      actualBaseQuantity: null,
      allocations,
      issues: [],
    },
  };
}
function input(items) {
  return {
    sheet: {
      schemaVersion: 'almox_separation_sheet_v1',
      sheetId: 'ficha-qa-1',
      workspaceId: W,
      requestId: 'pedido-qa-1',
      planId: 'plano-qa-1',
      planRevision: 2,
      organizationName: 'Organização Militar QA',
      requestingUnit: 'Dependência solicitante QA',
      externalRequestNumber: '2026-000123',
      issuedAt: '2026-10-31T18:00:00Z',
      issuedByUid: 'uid-emissor-qa',
      auxiliaryDocumentNotice: notice,
      plan: {
        schemaVersion: 'almox_separation_plan_v1',
        planId: 'plano-qa-1',
        requestId: 'pedido-qa-1',
        revision: 2,
        workspaceId: W,
        status: 'PLANNED',
        rows: items.map(x => x.plan),
        stockSnapshotRevision: 'rev-qa',
        createdByUid: 'uid-qa',
        createdAt: '2026-10-31T17:00:00Z',
        issues: [],
      },
    },
    request: {
      schemaVersion: 'almox_request_v1',
      requestId: 'pedido-qa-1',
      workspaceId: W,
      source: { system: 'SISCOFIS', format: 'TXT', sha256: 'a'.repeat(64), layoutId: 'qa', originalFilename: 'qa.txt' },
      externalRequestNumber: '2026-000123',
      requestingUnit: 'Dependência solicitante QA',
      referenceDate: '2026-10-30',
      officialStatus: null,
      revision: 1,
      rows: items.map(x => x.imported),
      issues: [],
    },
    depots, locations,
    almoxarifadoName: 'Almoxarifado',
    issuedByName: 'Militar QA',
  };
}
function pageText(doc) {
  return doc.internal.pages.slice(1).flat().join('\n');
}
async function verifyPdf(doc, expectedPages) {
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  assert.ok(bytes.length > 1_000);
  const actual = await PDFDocument.load(bytes);
  assert.equal(actual.getPageCount(), expectedPages);
  for (const page of actual.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 595.28) < 1);
    assert.ok(Math.abs(page.getHeight() - 841.89) < 1);
  }
}
test('posição única: documento A4 inclui identificação, código, quantidades e aviso', async () => {
  const i = item(1, 10, 10, [allocation('a1', 'dep-1','loc-1','sub-1',10)]);
  const before = input([i]);
  const copy = structuredClone(before);
  const result = await exports.createSeparationSheetPdf(before);
  assert.equal(result.mimeType, 'application/pdf');
  assert.equal(result.sourceSheetId, before.sheet.sheetId);
  assert.match(result.filename, /^EMPROVEX_Ficha_Separacao_.*\.pdf$/);
  assert.ok(result.pageCount >= 1);
  await verifyPdf(result.doc, result.pageCount);
  const text = pageText(result.doc);
  for (const value of ['SISCO-1', 'DEP-01', 'EST-01', 'P-01', '2026-000123',
    'PLANEJADA', 'SEPARADO', '10', 'Militar QA', 'Organiza']) {
    assert.ok(text.includes(value), 'Campo ausente no PDF: ' + value);
  }
  assert.deepEqual(before, copy, 'Geração documental não pode mutar estado operacional');
});

test('múltiplas posições: ordena depósito/local/subposição independentemente da ordem do plano', async () => {
  const i = item(2, 15, 15, [
    allocation('a3', 'dep-2', 'loc-3', null, 3),
    allocation('a2', 'dep-1', 'loc-2', 'sub-2', 5),
    allocation('a1', 'dep-1', 'loc-1', 'sub-1', 7),
  ]);
  const result = await exports.createSeparationSheetPdf(input([i]));
  const text = pageText(result.doc);
  assert.ok(text.indexOf('EST-01') < text.indexOf('EST-02'));
  assert.ok(text.indexOf('EST-02') < text.indexOf('EST-03'));
  assert.ok(text.includes('PARCELA'));
  await verifyPdf(result.doc, result.pageCount);
});

test('atendimento parcial e sem posição: faltas e pendências são explícitas; não constitui baixa', async () => {
  const a = item(1, 13, 4, [allocation('a1','dep-1','loc-2','sub-2',4)]);
  a.plan.issues.push({ code: 'INSUFFICIENT_STOCK', severity: 'WARNING', sourceRowId: 'linha-1', details: 'Falta material' });
  const b = item(2, 5, 0, []);
  const data = input([a, b]);
  data.sheet.plan.status = 'PARTIAL';
  const result = await exports.createSeparationSheetPdf(data);
  const text = pageText(result.doc);
  assert.ok(text.includes('INSUFFICIENT_STOCK'));
  assert.ok(text.includes('Não atribuído') || text.includes('atribu'));
  assert.ok(text.includes('13') && text.includes('4'));
  assert.ok(!text.includes('BAIXA REALIZADA'));
  await verifyPdf(result.doc, result.pageCount);
});

test('documento longo: repete cabeçalhos e aviso em cada página, sem truncar linhas', async () => {
  const many = Array.from({ length: 65 }, (_, idx) =>
    item(idx + 1, 2, 2, [allocation('a'+idx,'dep-1','loc-2','sub-2',2)],
      'Caneta esferográfica e material de escritório com descrição longa '.repeat(3) + String(idx + 1)));
  const result = await exports.createSeparationSheetPdf(input(many));
  assert.ok(result.pageCount >= 5);
  assert.equal(result.pageCount, result.doc.getNumberOfPages());
  const rawPages = result.doc.internal.pages.slice(1);
  for (const [index, raw] of rawPages.entries()) {
    const text = raw.join('\n');
    assert.ok(text.includes('EMPROVEX'), 'Cabeçalho página ' + (index + 1));
    assert.ok(text.includes('SISCOFIS'), 'Aviso obrigatório página ' + (index + 1));
    assert.ok(text.includes('gina '), 'Paginação página ' + (index + 1));
  }
  await verifyPdf(result.doc, result.pageCount);
});

test('falha fechada em contrato/tenant/posição/somas inválidos', async () => {
  const a = item(1, 3, 3, [allocation('a1','dep-1','loc-1','sub-1',3)]);
  const data = input([a]);
  const variants = [
    (copy) => { copy.sheet.workspaceId = 'outro'; },
    (copy) => { copy.depots[0].workspaceId = 'outro'; },
    (copy) => { copy.sheet.planRevision = 100; },
    (copy) => { copy.sheet.auxiliaryDocumentNotice = 'outro'; },
    (copy) => { copy.sheet.plan.rows[0].plannedBaseQuantity = 2; },
    (copy) => { copy.sheet.plan.status = 'CANCELLED'; },
    (copy) => { copy.locations = []; },
    (copy) => { copy.request.rows = []; },
  ];
  for (const corrupt of variants) {
    const copy = structuredClone(data);
    corrupt(copy);
    await assert.rejects(() => exports.createSeparationSheetPdf(copy), /ALMOX_SEPARATION_PDF/);
  }
});

test('sem leitura/escrita operacional, SDK, rede ou mecanismo de saída/CREM/TREM', () => {
  assert.doesNotMatch(source, /from ['"](?:firebase|firebase-admin|.*\/outbound|.*\/withdrawal)/i);
  assert.doesNotMatch(source, /\b(?:fetch|writeBatch|runTransaction|setDoc|updateDoc|addDoc|deleteDoc)\s*\(/);
  assert.doesNotMatch(source, /CREM|TREM/);
  assert.match(source, /loadJsPdf/);
  assert.match(source, /SeparationSheetV1/);
});
