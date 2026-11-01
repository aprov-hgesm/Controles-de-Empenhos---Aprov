/**
 * W2 R1-A — fixtures EXCLUSIVAMENTE SINTÉTICAS, não certificam layout real SISCOFIS.
 * O typecheck completo é realizado separadamente pelo GitHub Actions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const root = new URL('../', import.meta.url);
const source = path => readFileSync(new URL(path, root), 'utf8');
const fixture = source('scripts/fixtures/siscofis-request-synthetic-r1.txt');
const asBytes = text => new Uint8Array(Buffer.from(text, 'utf8'));
const options = (text = fixture) => ({
  bytes: asBytes(text), workspaceId: 'almox-qa-w2', originalFilename: 'pedido-sintetico.txt',
});

const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  cache.set(path, exports);
  const result = ts.transpileModule(source(path), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  const require = id => {
    if (id === './contracts') return { ALMOX_REQUEST_SCHEMA_VERSION: 'almox_request_v1' };
    if (id === './siscofisRequestParser') return load('lib/almoxarifado/siscofisRequestParser.ts');
    if (id === 'pdf-lib') return { PDFDocument };
    if (id === 'node:zlib') return requireNodeZlib();
    if (id === 'node:crypto') return requireNodeCrypto();
    throw Error('Unexpected import: ' + id);
  };
  runInNewContext(result.outputText, {
    exports, require, Buffer, Uint8Array, TextDecoder, Date, Set, Map,
  }, { filename: path });
  return exports;
}
function requireNodeCrypto() { return cryptoNode; }
function requireNodeZlib() { return zlibNode; }
import * as cryptoNode from 'node:crypto';
import * as zlibNode from 'node:zlib';

const txt = load('lib/almoxarifado/siscofisRequestTxt.ts').parseSiscofisRequestTxt;
const pdf = load('lib/almoxarifado/siscofisRequestPdf.ts').parseSiscofisRequestPdf;

async function syntheticPdf(lines = fixture.trimEnd().split('\n')) {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, i) => page.drawText(line, {
    x: 30, y: 800 - i * 21, size: 10, font,
  }));
  return new Uint8Array(await document.save({ useObjectStreams: false }));
}

test('TXT fixture: contrato único, SHA original, linha física e quantidade solicitada', () => {
  const result = txt(options());
  assert.equal(result.ok, true);
  const data = result.data;
  assert.equal(data.schemaVersion, 'almox_request_v1');
  assert.equal(data.externalRequestNumber, 'PM-2026-001');
  assert.equal(data.requestingUnit, 'SECAO DE MATERIAL - OM TESTE');
  assert.equal(data.referenceDate, '2026-10-31');
  assert.equal(data.officialStatus, 'EM ANALISE');
  assert.equal(data.source.format, 'TXT');
  assert.equal(data.source.layoutId, 'EMPROVEX_SISCOFIS_REQUEST_SYNTHETIC_R1');
  assert.match(data.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(data.rows.length, 3);
  assert.equal(data.rows[0].sourceRowId, 'txt-l00007');
  assert.equal(data.rows[0].sourceQuantity, 20);
  assert.equal(data.rows[1].sourceQuantity, 1250.5);
  assert.equal(data.rows[0].quantityMeaning, 'REQUESTED');
  assert.equal(data.rows[0].canonicalMaterialId, null);
  assert.equal(data.rows[0].canonicalQuantity, null);
  assert.equal(data.rows[0].factorToBaseUnit, null);
  assert.equal(data.rows[0].matchStatus, 'UNRESOLVED');
  assert.equal(data.issues.every(i => i.code === 'MATERIAL_UNRESOLVED'), true);
  assert.equal(data.rows[0].sourceItemCode, data.rows[2].sourceItemCode);
  assert.notEqual(data.rows[0].sourceRowId, data.rows[2].sourceRowId);
  assert.match(data.rows[1].sourceText, /CANETA AZUL/);
});

test('TXT sem status/data preserva null; quantidade autorizada só se cabeçalho explícito', () => {
  const alt = fixture.replace(/Data:.*\n/, '').replace(/Situacao:.*\n/, '')
    .replace('Qtd Solicitada', 'Qtd Autorizada');
  const r = txt(options(alt));
  assert.equal(r.ok, true);
  assert.equal(r.data.referenceDate, null);
  assert.equal(r.data.officialStatus, null);
  assert.equal(r.data.rows[0].quantityMeaning, 'AUTHORIZED');
});

test('reimportação mesmo hash é duplicada e revisão diferente exige análise W5', () => {
  const original = txt(options());
  const previousImports = [original.data];
  assert.equal(txt({ ...options(), previousImports }).issue.code, 'DUPLICATE_REQUEST');
  const updated = options(fixture.replace('CANETA AZUL', 'CANETA PRETA'));
  assert.equal(txt({ ...updated, previousImports }).issue.code, 'IDEMPOTENCY_CONFLICT');
  const isolated = txt({ ...options(), workspaceId: 'almox-outro-w2' });
  assert.equal(isolated.ok, true);
  assert.notEqual(isolated.data.requestId, original.data.requestId);
  assert.equal(isolated.data.source.sha256, original.data.source.sha256);
  assert.equal(txt({ ...options(), previousImports: [isolated.data] }).issue.code, 'CROSS_WORKSPACE_ACCESS');
});

test('rejeições TXT determinísticas: formato, quantidade, unidade, duplicidade e truncamento', () => {
  const cases = [
    [fixture.replace('EMPROVEX_FIXTURE_R1', 'LAYOUT_REAL_DESCONHECIDO'), 'UNSUPPORTED_LAYOUT'],
    [fixture.replace('Qtd Solicitada', 'Qtd'), 'UNKNOWN_QUANTITY_MEANING'],
    [fixture.replace('|20|RESMA', '|12.5|RESMA'), 'INVALID_QUANTITY'],
    [fixture.replace('|20|RESMA', '|1.234|RESMA'), 'INVALID_QUANTITY'],
    [fixture.replace('|20|RESMA', '|0|RESMA'), 'INVALID_QUANTITY'],
    [fixture.replace('|20|RESMA', '|20|KG/UN'), 'UNIT_INCOMPATIBLE'],
    [fixture.replace('2|07.002C|', '1|07.002C|'), 'UNSUPPORTED_LAYOUT'],
    [fixture.replace('FIM_ITENS\n', ''), 'UNSUPPORTED_LAYOUT'],
    [fixture.replace('Solicitante: SECAO DE MATERIAL - OM TESTE\n', ''), 'MISSING_REQUESTING_UNIT'],
    [fixture.replace('Pedido: PM-2026-001\n', ''), 'MISSING_REQUEST_ID'],
  ];
  for (const [body, expected] of cases) {
    const result = txt(options(body));
    assert.equal(result.ok, false, body.slice(0, 75));
    assert.equal(result.issue.code, expected);
  }
  assert.equal(txt({ ...options(), bytes: new Uint8Array([0xff, 0xfe, 0]) }).issue.code, 'UNREADABLE_SOURCE');
  assert.equal(txt({ ...options(), bytes: new Uint8Array([0xff, 0xee]) }).issue.code, 'UNREADABLE_SOURCE');
  assert.equal(txt({ ...options(), bytes: new Uint8Array(2 * 1024 * 1024 + 1) }).issue.code, 'UNREADABLE_SOURCE');
});

test('PDF textual sintético produz MESMO contrato, com origem física e hash do PDF', async () => {
  const bytes = await syntheticPdf();
  const result = await pdf({ bytes, workspaceId: 'almox-qa-w2', originalFilename: 'pedido-sintetico.pdf' });
  assert.equal(result.ok, true, result.issue?.details);
  assert.equal(result.data.rows.length, 3);
  assert.equal(result.data.source.format, 'PDF');
  assert.equal(result.data.rows[0].sourceRowId, 'pdf-p001-l00007');
  assert.equal(result.data.rows[1].sourceQuantity, 1250.5);
  assert.equal(result.data.rows[0].quantityMeaning, 'REQUESTED');
  assert.equal(result.data.rows[0].canonicalMaterialId, null);
  assert.equal(result.data.source.sha256.length, 64);
  assert.notEqual(result.data.source.sha256, txt(options()).data.source.sha256);
});

test('PDF scan/corrompido e PDF de inventário são rejeitados sem fallback para Mapa', async () => {
  const blankDoc = await PDFDocument.create();
  blankDoc.addPage();
  const blank = new Uint8Array(await blankDoc.save({ useObjectStreams: false }));
  const scanned = await pdf({ bytes: blank, workspaceId: 'almox-qa-w2' });
  assert.equal(scanned.ok, false);
  assert.ok(['UNREADABLE_SOURCE', 'UNSUPPORTED_LAYOUT'].includes(scanned.issue.code));
  const fake = await pdf({ bytes: asBytes('%PDF-1.4\nBT (SISCOFIS|PEDIDO_DE_MATERIAL) Tj ET\n%%EOF'), workspaceId: 'almox-qa-w2' });
  assert.equal(fake.ok, false);
  assert.equal(fake.issue.code, 'UNREADABLE_SOURCE');
  const inventory = await syntheticPdf(['MAPA DE EXISTENCIA - MATERIAL DE CONSUMO', 'Nr Ficha', '07.001P', 'Nome do Material', 'Qtde Exist', 'Qtde Disp']);
  const wrong = await pdf({ bytes: inventory, workspaceId: 'almox-qa-w2' });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.issue.code, 'UNSUPPORTED_LAYOUT');
});

test('código separado da Central de Depósitos; nenhuma escrita de estoque/Rules', () => {
  const implementation = ['siscofisRequestTxt.ts', 'siscofisRequestPdf.ts', 'siscofisRequestParser.ts']
    .map(name => source('lib/almoxarifado/' + name)).join('\n');
  assert.doesNotMatch(implementation, /from ['"](?:\.\.\/warehouse\/siscofisPdf|@\/lib\/warehouse\/siscofisPdf)['"]/);
  assert.doesNotMatch(implementation, /commitTransaction|runTransaction|writeBatch|updateDoc|setDoc|deleteDoc|applyOutbound/);
});
