#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-phase5-siscofis-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/siscofis.ts'),
    resolve(root, 'lib/warehouse/siscofisPdf.ts'),
    resolve(root, 'lib/warehouse/invoiceIntegration.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/movement.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
    '--outDir',
    outDir,
    '--module',
    'commonjs',
    '--target',
    'es2022',
    '--moduleResolution',
    'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib',
    'es2022,dom',
  ],
  { cwd: root, stdio: 'pipe' }
);

const require = createRequire(import.meta.url);
const siscofis = require(resolve(outDir, 'warehouse/siscofis.js'));
const siscofisPdf = require(resolve(outDir, 'warehouse/siscofisPdf.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const materialId = 'mat_' + 'a'.repeat(32);
const externalJson = JSON.stringify({
  schemaVersion: 'emprovex_siscofis_inventory_v1',
  items: [
    { numeroItem: '07.0173P', descricao: 'ARROZ TIPO 1', quantidade: 2, valorUnitario: 10.5 },
    { numeroItem: '21.1000C', descricao: 'CAFÉ', quantidade: 1, valorUnitario: 15.25 },
    { numeroItem: '07.0173P', descricao: 'ARROZ TIPO 1', quantidade: 3, valorUnitario: 11.0 },
  ],
});
const validJson = JSON.stringify({
  schemaVersion: 'warehouse_siscofis_import_v1',
  ug: '160416',
  referenceDate: '2026-09-22',
  sourceLabel: 'Posição SISCOFIS 22/09/2026',
  rows: [
    {
      rowId: 'linha-001',
      materialId,
      description: 'Arroz tipo 1',
      unit: { code: 'kg', label: null },
      quantity: 25,
      unitValue: 6.5,
      totalValue: 162.5,
    },
  ],
});

function material(overrides = {}) {
  return {
    schemaVersion: 'warehouse_material_v1',
    id: materialId,
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    description: 'Arroz tipo 1',
    aliases: [],
    unit: { code: 'kg', label: null },
    status: 'active',
    conversions: [],
    ...overrides,
  };
}

function pdfText(x, y, value) {
  return [
    'BT',
    '/F1 0008 Tf',
    x.toFixed(4) + ' ' + y.toFixed(4) + ' Td',
    '( ' + value + ' ) Tj',
    'ET',
  ].join('\r\n');
}

function syntheticSiscofisPdf() {
  const stream = [
    pdfText(300, 550, 'MAPA DE EXISTENCIA - MATERIAL DE CONSUMO'),
    pdfText(30.2, 408.192, 'Nr Ficha'),
    pdfText(159.8, 408.192, 'Nome do Material'),
    pdfText(640.04, 395.232, 'Qtde Exist'),
    pdfText(701.96, 395.232, 'Qtde Disp'),
    pdfText(771.08, 395.232, 'Vlr Unit'),

    pdfText(30.2, 367.032, '07.0031C'),
    pdfText(159.8, 367.032, 'ERVILHA / Tipo: Seca;'),
    pdfText(640.04, 347.592, '68'),
    pdfText(701.96, 347.592, '68'),
    pdfText(771.08, 347.592, '4,99'),

    pdfText(30.2, 332.472, '07.1345C'),
    pdfText(159.8, 332.472, 'BETERRABA / Tipo: In natura;'),
    pdfText(640.04, 313.032, '10'),
    pdfText(701.96, 313.032, '0'),
    pdfText(771.08, 313.032, '2,74'),

    pdfText(30.2, 297.912, '21.1000C'),
    pdfText(159.8, 297.912, 'CANECA DE VIDRO'),
    pdfText(640.04, 278.472, '2'),
    pdfText(701.96, 278.472, '2'),
    pdfText(771.08, 278.472, '15,25'),

    pdfText(30.2, 263.352, '07.9998C'),
    pdfText(159.8, 263.352, 'ITEM SEM ESTOQUE'),
    pdfText(640.04, 243.912, '0'),
    pdfText(701.96, 243.912, '0'),
    pdfText(771.08, 243.912, '1,00'),

    pdfText(500, 40, 'Data de emissao : segunda-feira, 28 de setembro de 2026'),
  ].join('\r\n');

  const pdf = [
    '%PDF-1.3',
    '1 0 obj',
    '<< /Type /Catalog /Pages 3 0 R >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Pages /Count 1 /Kids [ 4 0 R ] >>',
    'endobj',
    '4 0 obj',
    '<< /Type /Page /Parent 3 0 R /Contents 5 0 R >>',
    'endobj',
    '5 0 obj',
    '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>',
    'stream',
    stream,
    'endstream',
    'endobj',
    '%%EOF',
  ].join('\r\n');

  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}

test('extrator local lê PDF SISCOFIS textual sem IA e usa Qtde Exist', () => {
  const extracted = siscofisPdf.extractEmprovexSiscofisInventoryFromPdfBytes(
    syntheticSiscofisPdf()
  );

  assert.equal(extracted.pageCount, 1);
  assert.equal(extracted.detectedRows, 4);
  assert.equal(extracted.zeroQuantityRows, 1);
  assert.equal(extracted.invalidRows, 0);
  assert.equal(extracted.referenceDate, '2026-09-28');
  assert.equal(extracted.inventory.items.length, 3);
  assert.deepEqual(extracted.inventory.items[0], {
    numeroItem: '07.0031C',
    descricao: 'ERVILHA / Tipo: Seca;',
    quantidade: 68,
    valorUnitario: 4.99,
  });
  assert.equal(extracted.inventory.items[1].quantidade, 10);
  assert.equal(extracted.inventory.items[1].valorUnitario, 2.74);
});

test('PDF direto reutiliza o classificador oficial de conta 07 e hortifruti', () => {
  const extracted = siscofisPdf.extractEmprovexSiscofisInventoryFromPdfBytes(
    syntheticSiscofisPdf()
  );
  const classifications = extracted.inventory.items.map((item) =>
    siscofis.classifyEmprovexSiscofisSourceItem(item)
  );
  assert.deepEqual(classifications, [null, 'FRESH_HORTIFRUTI', 'NON_ACCOUNT_07']);
});

test('aceita contrato externo simplificado e preserva Nr Ficha repetido', () => {
  const parsed = siscofis.parseEmprovexSiscofisInventoryJson(externalJson);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.schemaVersion, 'emprovex_siscofis_inventory_v1');
  assert.equal(parsed.data.items[0].numeroItem, '07.0173P');
  assert.equal(parsed.data.items[1].numeroItem, '21.1000C');
  assert.equal(parsed.data.items.length, 3);
});

test('normaliza somente compatibilidade monetária brasileira determinística', () => {
  const parsed = siscofis.parseEmprovexSiscofisInventoryJson(JSON.stringify({
    schemaVersion: 'emprovex_siscofis_inventory_v1',
    items: [{ numeroItem: '2416P', descricao: 'CAFETEIRA', quantidade: 1, valorUnitario: '1.944,00' }],
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.items[0].valorUnitario, 1944);
  assert.equal(parsed.issues.some((issue) => issue.code === 'legacy_brazilian_money'), true);
});


test('adapter preserva ficha e usa fallback canônico explícito quando unidade não vem da IA', () => {
  const parsed = siscofis.parseEmprovexSiscofisInventoryJson(externalJson);
  assert.equal(parsed.ok, true);
  const adapted = siscofis.adaptEmprovexSiscofisInventory({
    inventory: parsed.data,
    ug: '160416',
    referenceDate: '2026-09-24',
    materials: [],
  });
  assert.equal(adapted.importData.rows[0].sourceItemNumber, '07.0173P');
  assert.deepEqual(adapted.importData.rows[0].unit, {
    code: 'other',
    label: 'Apresentação não informada',
  });
  assert.equal(adapted.issues.some((issue) => issue.code === 'unit_fallback_applied'), true);
});


test('ambiguidade canônica exige override explícito', async () => {
  const parsed = siscofis.parseEmprovexSiscofisInventoryJson(JSON.stringify({
    schemaVersion: 'emprovex_siscofis_inventory_v1',
    items: [{ numeroItem: '07.2416P', descricao: 'CAFETEIRA', quantidade: 1, valorUnitario: 804 }],
  }));
  assert.equal(parsed.ok, true);
  const one = material({ id: 'mat_' + 'b'.repeat(32), description: 'CAFETEIRA' });
  const two = material({ id: 'mat_' + 'c'.repeat(32), description: 'CAFETEIRA' });
  const ambiguous = siscofis.adaptEmprovexSiscofisInventory({
    inventory: parsed.data,
    ug: '160416',
    referenceDate: '2026-09-24',
    materials: [one, two],
  });
  assert.equal(ambiguous.issues.some((issue) => issue.code === 'ambiguous_material_match' && issue.severity === 'error'), true);
  const preview = await siscofis.buildWarehouseSiscofisPreview({
    workspaceId: 'hgesm-aprov',
    importData: ambiguous.importData,
    materials: [one, two],
    balances: [],
    hasMarcoZero: false,
    cutoffAt: null,
    priorIssues: ambiguous.issues,
  });
  assert.equal(preview.canConfirm, false);
  assert.equal(preview.rows[0].materialId, null);

  const resolved = siscofis.adaptEmprovexSiscofisInventory({
    inventory: parsed.data,
    ug: '160416',
    referenceDate: '2026-09-24',
    materials: [one, two],
    materialOverrides: { 'siscofis-0001': one.id },
  });
  assert.equal(resolved.issues.some((issue) => issue.code === 'ambiguous_material_match'), false);
  assert.equal(resolved.importData.rows[0].materialId, one.id);
});

test('adapter mantém somente conta 07 e exclui hortifruti/granjeiros sem remover processados', () => {
  const parsed = siscofis.parseEmprovexSiscofisInventoryJson(JSON.stringify({
    schemaVersion: 'emprovex_siscofis_inventory_v1',
    items: [
      { numeroItem: '07.1345C', descricao: 'BETERRABA / Tipo: In natura;', quantidade: 10, valorUnitario: 2.74 },
      { numeroItem: '07.1369C', descricao: 'PIMENTÃO / Tipo: Verde;', quantidade: 5, valorUnitario: 6.04 },
      { numeroItem: '07.2532', descricao: 'CEBOLA / Tipo: Rôxa;', quantidade: 10, valorUnitario: 4.50 },
      { numeroItem: '07.9888C', descricao: 'ALHO / Tipo: Granulado;', quantidade: 41, valorUnitario: 11.90 },
      { numeroItem: '07.0031C', descricao: 'ERVILHA / Tipo: Seca;', quantidade: 68, valorUnitario: 4.99 },
      { numeroItem: '07.0046C', descricao: 'MILHO VERDE / Tipo: Em conserva;', quantidade: 98, valorUnitario: 21.90 },
      { numeroItem: '07.2302C', descricao: 'POLPA DE FRUTA / Sabor: Morango;', quantidade: 236, valorUnitario: 2.70 },
      { numeroItem: '21.1000C', descricao: 'CAFÉ', quantidade: 1, valorUnitario: 15.25 },
    ],
  }));
  assert.equal(parsed.ok, true);

  const adapted = siscofis.adaptEmprovexSiscofisInventory({
    inventory: parsed.data,
    ug: '160416',
    referenceDate: '2026-09-28',
    materials: [],
  });

  assert.deepEqual(
    adapted.importData.rows.map((row) => row.sourceItemNumber),
    ['07.9888C', '07.0031C', '07.0046C', '07.2302C']
  );
  assert.equal(adapted.issues.some((issue) => issue.code === 'siscofis_non_account_07_filtered'), true);
  assert.equal(adapted.issues.some((issue) => issue.code === 'siscofis_fresh_hortifruti_filtered'), true);
});

test('classificador exclui in natura e granjeiro, mas não confunde ingrediente processado', () => {
  assert.equal(
    siscofis.classifyEmprovexSiscofisSourceItem({ numeroItem: '07.4373C', descricao: 'BANANA / Tipo: In natura;' }),
    'FRESH_HORTIFRUTI'
  );
  assert.equal(
    siscofis.classifyEmprovexSiscofisSourceItem({ numeroItem: '07.9999C', descricao: 'OVOS / Tipo: Branco;' }),
    'FRESH_HORTIFRUTI'
  );
  assert.equal(
    siscofis.classifyEmprovexSiscofisSourceItem({ numeroItem: '21.4141C', descricao: 'CANECA DE VIDRO' }),
    'NON_ACCOUNT_07'
  );
  assert.equal(
    siscofis.classifyEmprovexSiscofisSourceItem({ numeroItem: '07.0033C', descricao: 'FARINHA DE MANDIOCA / Tipo: Mandioca Seca Branca Fina;' }),
    null
  );
  assert.equal(
    siscofis.classifyEmprovexSiscofisSourceItem({ numeroItem: '07.4702C', descricao: 'BATATA / Tipo: Palha;' }),
    null
  );
});

test('aceita contrato JSON versionado e estrito', () => {
  const parsed = siscofis.parseWarehouseSiscofisJson(validJson, '160416');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.schemaVersion, 'warehouse_siscofis_import_v1');
  assert.equal(parsed.data.rows[0].quantity, 25);
  assert.equal(parsed.issues.length, 0);
});

test('recusa campos inesperados, UG divergente e rowId duplicado', () => {
  const raw = JSON.stringify({
    ...JSON.parse(validJson),
    ug: '999999',
    ficha: 'campo proibido',
    rows: [
      JSON.parse(validJson).rows[0],
      { ...JSON.parse(validJson).rows[0] },
    ],
  });
  const parsed = siscofis.parseWarehouseSiscofisJson(raw, '160416');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.issues.some((item) => item.code === 'unexpected_root_field'), true);
  assert.equal(parsed.issues.some((item) => item.code === 'ug_mismatch'), true);
  assert.equal(parsed.issues.some((item) => item.code === 'duplicate_row_id'), true);
});

test('prompt oficial usa quatro campos e aplica conta 07, Qtde Exist e exclusão de hortifruti', () => {
  const prompt = siscofis.buildWarehouseSiscofisPrompt();
  assert.match(prompt, /emprovex_siscofis_inventory_v1/);
  assert.match(prompt, /numeroItem/);
  assert.match(prompt, /valorUnitario/);
  assert.match(prompt, /comece exatamente por "07"/);
  assert.match(prompt, /Qtde Exist/);
  assert.match(prompt, /NÃO use "Qtde Disp"/);
  assert.match(prompt, /HORTIFRUTI\/GRANJEIROS/);
  assert.match(prompt, /MILHO VERDE \/ Tipo: Em conserva/);
  assert.match(prompt, /NÃO CONSOLIDAR ITENS/);
  assert.doesNotMatch(prompt, /materialId/);
  assert.doesNotMatch(prompt, /workspaceId/);
});

test('Marco Zero usa identidade canônica e cria material somente quando materialId é nulo', async () => {
  const parsed = siscofis.parseWarehouseSiscofisJson(
    JSON.stringify({
      ...JSON.parse(validJson),
      rows: [{
        ...JSON.parse(validJson).rows[0],
        rowId: 'nova-linha',
        materialId: null,
        description: 'Material novo',
      }],
    }),
    '160416'
  );
  assert.equal(parsed.ok, true);

  const preview = await siscofis.buildWarehouseSiscofisPreview({
    workspaceId: 'hgesm-aprov',
    importData: parsed.data,
    materials: [],
    balances: [],
    hasMarcoZero: false,
    cutoffAt: null,
    priorIssues: parsed.issues,
  });

  assert.equal(preview.kind, 'MARCO_ZERO');
  assert.equal(preview.canConfirm, true);
  assert.equal(preview.rows[0].createsMaterial, true);
  assert.match(preview.rows[0].materialId, /^mat_[a-f0-9]{32}$/);
  assert.equal(siscofis.aggregateMarcoZeroRows(preview)[0].quantity, 25);
});

test('snapshot posterior apenas calcula divergência e não cria plano de saldo inicial', async () => {
  const parsed = siscofis.parseWarehouseSiscofisJson(validJson, '160416');
  const preview = await siscofis.buildWarehouseSiscofisPreview({
    workspaceId: 'hgesm-aprov',
    importData: parsed.data,
    materials: [material()],
    balances: [{
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId,
      quantity: 20,
      revision: 1,
      lastMovementId: 'mov_' + 'b'.repeat(64),
    }],
    hasMarcoZero: true,
    cutoffAt: '2026-09-23T12:00:00.000Z',
    priorIssues: parsed.issues,
  });

  assert.equal(preview.kind, 'SNAPSHOT');
  assert.equal(preview.rows[0].difference, 5);
  assert.equal(preview.rows[0].state, 'DIVERGENT');
  assert.deepEqual(siscofis.aggregateMarcoZeroRows(preview), []);
});

test('Marco Zero bloqueia sobreposição ambígua com cutoff quando já existe saldo', async () => {
  const parsed = siscofis.parseWarehouseSiscofisJson(
    JSON.stringify({
      ...JSON.parse(validJson),
      referenceDate: '2026-09-23',
    }),
    '160416'
  );
  const preview = await siscofis.buildWarehouseSiscofisPreview({
    workspaceId: 'hgesm-aprov',
    importData: parsed.data,
    materials: [material()],
    balances: [{
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId,
      quantity: 3,
      revision: 1,
      lastMovementId: 'mov_' + 'c'.repeat(64),
    }],
    hasMarcoZero: false,
    cutoffAt: '2026-09-23T10:00:00.000Z',
    priorIssues: parsed.issues,
  });

  assert.equal(preview.kind, 'MARCO_ZERO');
  assert.equal(preview.canConfirm, false);
  assert.equal(preview.issues.some((item) => item.code === 'marco_zero_cutoff_overlap'), true);
});

test('hash da importação é estável para replay idempotente', async () => {
  const parsed = siscofis.parseWarehouseSiscofisJson(validJson, '160416');
  const first = await siscofis.hashWarehouseSiscofisImport(parsed.data);
  const repeat = await siscofis.hashWarehouseSiscofisImport(parsed.data);
  assert.equal(first, repeat);
  assert.match(first, /^[a-f0-9]{64}$/);
});
