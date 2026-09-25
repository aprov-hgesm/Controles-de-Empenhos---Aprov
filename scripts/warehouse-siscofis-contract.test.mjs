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

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const materialId = 'mat_' + 'a'.repeat(32);
const externalJson = JSON.stringify({
  schemaVersion: 'emprovex_siscofis_inventory_v1',
  items: [
    { numeroItem: '0173P', descricao: 'ARROZ TIPO 1', quantidade: 2, valorUnitario: 10.5 },
    { numeroItem: '21.1000C', descricao: 'CAFÉ', quantidade: 1, valorUnitario: 15.25 },
    { numeroItem: '0173P', descricao: 'ARROZ TIPO 1', quantidade: 3, valorUnitario: 11.0 },
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

test('aceita contrato externo simplificado e preserva Nr Ficha repetido', () => {
  const parsed = siscofis.parseEmprovexSiscofisInventoryJson(externalJson);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.schemaVersion, 'emprovex_siscofis_inventory_v1');
  assert.equal(parsed.data.items[0].numeroItem, '0173P');
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
  assert.equal(adapted.importData.rows[0].sourceItemNumber, '0173P');
  assert.deepEqual(adapted.importData.rows[0].unit, {
    code: 'other',
    label: 'Apresentação não informada',
  });
  assert.equal(adapted.issues.some((issue) => issue.code === 'unit_fallback_applied'), true);
});


test('ambiguidade canônica exige override explícito', async () => {
  const parsed = siscofis.parseEmprovexSiscofisInventoryJson(JSON.stringify({
    schemaVersion: 'emprovex_siscofis_inventory_v1',
    items: [{ numeroItem: '2416P', descricao: 'CAFETEIRA', quantidade: 1, valorUnitario: 804 }],
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

test('prompt oficial usa somente quatro campos e mantém IA como extratora', () => {
  const prompt = siscofis.buildWarehouseSiscofisPrompt();
  assert.match(prompt, /emprovex_siscofis_inventory_v1/);
  assert.match(prompt, /numeroItem/);
  assert.match(prompt, /valorUnitario/);
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
