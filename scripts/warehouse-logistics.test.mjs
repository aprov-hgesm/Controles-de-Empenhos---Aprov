#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-phase11-logistics-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/logistics.ts'),
    resolve(root, 'lib/warehouse/logisticsAlerts.ts'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'ES2020',
    '--moduleResolution', 'node',
    '--skipLibCheck',
    '--esModuleInterop',
  ],
  { cwd: root, stdio: 'pipe' }
);

const require = createRequire(import.meta.url);
const logistics = require(resolve(outDir, 'warehouse/logistics.js'));
const logisticsAlerts = require(resolve(outDir, 'warehouse/logisticsAlerts.js'));

test.after(() => rmSync(outDir, { recursive: true, force: true }));

const WORKSPACE = 'hgesm-aprov';
const TODAY = new Date('2026-09-24T12:00:00.000Z');
const EMPENHO_ID = '2026NE000001';
const MATERIAL_A = 'mat_' + 'a'.repeat(32);
const MATERIAL_B = 'mat_' + 'b'.repeat(32);

function empenho(received = 20) {
  return {
    id: EMPENHO_ID,
    supplier: 'Fornecedor FASE 11',
    status: 'Ativo',
    items: [
      { id: 'item-1', name: 'Item 1', unit: 'UN', quantity: 100, unitPrice: 10, received },
    ],
  };
}

function cronograma() {
  return {
    id: EMPENHO_ID,
    empenhoId: EMPENHO_ID,
    dataCriacao: '2026-09-01',
    localEntrega: 'Depósito',
    horarioEntrega: '08:00–12:00',
    observacoes: 'Cronograma oficial existente',
    colunasEntregas: [
      { id: 'remessa_1', titulo: '1ª Remessa', dataPrevista: '2026-09-20' },
      { id: 'remessa_2', titulo: '2ª Remessa', dataPrevista: '2026-10-10' },
    ],
    distribuicao: {
      'item-1': {
        remessa_1: 50,
        remessa_2: 50,
      },
    },
  };
}

function invoice({ quantity = 20, id = 'NF-001' } = {}) {
  return {
    id,
    recordKey: 'invoice-' + id,
    empenhoId: EMPENHO_ID,
    issueDate: '2026-09-21',
    registeredAt: '2026-09-21T10:00:00.000Z',
    supplier: 'Fornecedor FASE 11',
    totalValue: quantity * 10,
    items: [{ itemId: 'item-1', quantity, unitPrice: 10, subtotal: quantity * 10 }],
  };
}

function invoiceMovement(invoiceId = 'NF-001') {
  return {
    schemaVersion: 'warehouse_movement_v1',
    id: 'mov_' + 'a'.repeat(64),
    workspaceId: WORKSPACE,
    ug: '160416',
    materialId: MATERIAL_A,
    type: 'INVOICE_ENTRY',
    quantityDelta: 20,
    idempotencyKeyHash: 'a'.repeat(64),
    reversesMovementId: null,
    note: null,
    source: {
      kind: 'INVOICE',
      action: 'ENTRY',
      invoiceRecordKey: 'invoice-' + invoiceId,
      invoiceId,
      empenhoId: EMPENHO_ID,
      itemIds: ['item-1'],
      supplier: 'Fornecedor FASE 11',
      supplierCnpj: null,
      actorUid: 'founder',
    },
  };
}

test('Entregas reutiliza Cronograma + recebido do Empenho sem criar segundo recebimento', () => {
  const projection = logistics.buildWarehouseDeliveryProjection(
    empenho(20),
    cronograma(),
    [invoice()],
    [],
    [invoiceMovement()],
    TODAY
  );

  assert.equal(projection.hasSchedule, true);
  assert.equal(projection.committedQuantity, 100);
  assert.equal(projection.receivedQuantity, 20);
  assert.equal(projection.progressPercent, 20);
  assert.equal(projection.expectedThroughToday, 50);
  assert.equal(projection.overdueQuantity, 30);
  assert.equal(projection.status, 'OVERDUE');
  assert.equal('remessaId' in projection.invoices[0], false);
});

test('correlação NF → material é derivada do ledger e não de campo operacional legado', () => {
  const projection = logistics.buildWarehouseDeliveryProjection(
    empenho(20),
    cronograma(),
    [invoice()],
    [{ materialId: MATERIAL_A, quantity: 20 }],
    [invoiceMovement()],
    TODAY
  );

  assert.deepEqual(projection.invoices[0].projectedMaterialIds, [MATERIAL_A]);
  assert.equal(projection.stock.linkedMaterials, 1);
  assert.equal(projection.stock.positiveBalances, 1);
});

test('atraso é cumulativo por item e excesso de um item não mascara falta de outro', () => {
  const twoItems = {
    id: EMPENHO_ID,
    supplier: 'Fornecedor FASE 11',
    status: 'Ativo',
    items: [
      { id: 'item-1', quantity: 100, received: 60 },
      { id: 'item-2', quantity: 100, received: 10 },
    ],
  };
  const schedule = {
    ...cronograma(),
    distribuicao: {
      'item-1': { remessa_1: 50, remessa_2: 50 },
      'item-2': { remessa_1: 50, remessa_2: 50 },
    },
  };
  const projection = logistics.buildWarehouseDeliveryProjection(
    twoItems, schedule, [], [], [], TODAY
  );
  assert.equal(projection.expectedThroughToday, 100);
  assert.equal(projection.overdueQuantity, 40);
});

test('estoque zerado é objetivo e baixo estoque só existe com limiar configurado', () => {
  const materials = [
    { id: MATERIAL_A, description: 'Material A', status: 'active' },
    { id: MATERIAL_B, description: 'Material B', status: 'active' },
  ];
  const balances = [
    { materialId: MATERIAL_A, quantity: 0 },
    { materialId: MATERIAL_B, quantity: 3 },
  ];
  const base = {
    workspaceId: WORKSPACE,
    materials,
    balances,
    locationBalances: [],
    lots: [],
    inventories: [],
    siscofisSnapshots: [],
    deliveries: [],
    today: TODAY,
  };

  const withoutThreshold = logisticsAlerts.buildWarehouseLogisticsAlertCandidates({
    ...base,
    settings: null,
  });
  assert.ok(withoutThreshold.some((item) => item.kind === 'STOCK_ZERO'));
  assert.equal(withoutThreshold.some((item) => item.kind === 'LOW_STOCK'), false);

  const settings = {
    schemaVersion: 'warehouse_logistics_alert_settings_v1',
    workspaceId: WORKSPACE,
    ug: '160416',
    lowStockThreshold: 5,
    updatedBy: 'founder',
    updatedAt: null,
  };
  const withThreshold = logisticsAlerts.buildWarehouseLogisticsAlertCandidates({
    ...base,
    settings,
  });
  assert.ok(withThreshold.some((item) => item.kind === 'LOW_STOCK'));
});

test('configuração de baixo estoque é explícita e validada', () => {
  const valid = logistics.validateWarehouseLogisticsSettings({
    schemaVersion: 'warehouse_logistics_alert_settings_v1',
    workspaceId: WORKSPACE,
    ug: '160416',
    lowStockThreshold: 5,
    updatedBy: 'founder',
    updatedAt: null,
  }, WORKSPACE);
  assert.equal(valid.lowStockThreshold, 5);

  assert.throws(
    () => logistics.validateWarehouseLogisticsSettings({ ...valid, lowStockThreshold: 0 }, WORKSPACE),
    /INVALID_LOW_STOCK/
  );
});
