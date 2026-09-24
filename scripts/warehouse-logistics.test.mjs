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
      { id: 'item-1', quantity: 100, received, warehouseMaterialId: MATERIAL_A },
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

function invoice({ integrated = true, quantity = 20, id = 'NF-001' } = {}) {
  return {
    id,
    recordKey: 'invoice-' + id,
    empenhoId: EMPENHO_ID,
    issueDate: '2026-09-21',
    registeredAt: '2026-09-21T10:00:00.000Z',
    items: [{ quantity }],
    ...(integrated ? { warehouseIntegration: { status: 'APPLIED' } } : {}),
  };
}

test('Entregas reutiliza Cronograma + recebido do Empenho/NF sem criar segundo recebimento', () => {
  const projection = logistics.buildWarehouseDeliveryProjection(
    empenho(20),
    cronograma(),
    [invoice()],
    [],
    TODAY
  );

  assert.equal(projection.hasSchedule, true);
  assert.equal(projection.cronogramaId, EMPENHO_ID);
  assert.equal(projection.committedQuantity, 100);
  assert.equal(projection.receivedQuantity, 20);
  assert.equal(projection.progressPercent, 20);
  assert.equal(projection.expectedThroughToday, 50);
  assert.equal(projection.overdueQuantity, 30);
  assert.equal(projection.status, 'OVERDUE');
  assert.equal(projection.integratedInvoiceCount, 1);
  assert.equal(projection.operationalOnlyInvoiceCount, 0);
  assert.equal('remessaId' in projection.invoices[0], false, 'não inventa vínculo NF↔remessa');
});

test('nova NF/recebimento operacional altera automaticamente o progresso derivado', () => {
  const before = logistics.buildWarehouseDeliveryProjection(
    empenho(20), cronograma(), [invoice({ quantity: 20 })], [], TODAY
  );
  const after = logistics.buildWarehouseDeliveryProjection(
    empenho(50), cronograma(), [invoice({ quantity: 50, id: 'NF-002' })], [], TODAY
  );

  assert.equal(before.receivedQuantity, 20);
  assert.equal(before.overdueQuantity, 30);
  assert.equal(after.receivedQuantity, 50);
  assert.equal(after.progressPercent, 50);
  assert.equal(after.overdueQuantity, 0);
});

test('NF anterior ao cutoff permanece operacional, sem retrointegração silenciosa', () => {
  const projection = logistics.buildWarehouseDeliveryProjection(
    empenho(20),
    cronograma(),
    [invoice({ integrated: false, id: 'NF-LEGACY' })],
    [],
    TODAY
  );

  assert.equal(projection.integratedInvoiceCount, 0);
  assert.equal(projection.operationalOnlyInvoiceCount, 1);
  assert.equal(projection.invoices[0].warehouseIntegrated, false);
});

test('atraso é cumulativo por item e não exige atribuição de NF a remessa', () => {
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
  const projection = logistics.buildWarehouseDeliveryProjection(twoItems, schedule, [], [], TODAY);

  assert.equal(projection.expectedThroughToday, 100);
  assert.equal(projection.overdueQuantity, 40, 'excesso do item 1 não mascara falta do item 2');
});

test('alertas logísticos têm ID determinístico e entrega vencida não duplica por render', () => {
  const delivery = logistics.buildWarehouseDeliveryProjection(
    empenho(20), cronograma(), [invoice()], [], TODAY
  );
  const first = logisticsAlerts.buildWarehouseDeliveryAlertCandidates(WORKSPACE, [delivery]);
  const second = logisticsAlerts.buildWarehouseDeliveryAlertCandidates(WORKSPACE, [delivery]);

  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'DELIVERY_OVERDUE');
  assert.equal(first[0].alert.id, second[0].alert.id);
  assert.match(first[0].alert.id, /^warehouse-logistics-delivery-overdue-/);
  assert.equal(first[0].alert.logistics.active, true);
  assert.equal(first[0].alert.logistics.managedBy, 'warehouse-phase-11');
});

test('estoque zerado é objetivo; baixo estoque só existe com limiar configurado', () => {
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
    updatedAt: '2026-09-24T12:00:00.000Z',
  };
  const withThreshold = logisticsAlerts.buildWarehouseLogisticsAlertCandidates({
    ...base,
    settings,
  });
  assert.ok(withThreshold.some((item) => item.kind === 'STOCK_ZERO'));
  assert.ok(withThreshold.some((item) => item.kind === 'LOW_STOCK'));

  const disabledSummary = logisticsAlerts.buildWarehouseLogisticsDashboardSummary({
    ...base,
    settings: null,
  });
  assert.equal(disabledSummary.zeroStock, 1);
  assert.equal(disabledSummary.lowStock, null);

  const enabledSummary = logisticsAlerts.buildWarehouseLogisticsDashboardSummary({
    ...base,
    settings,
  });
  assert.equal(enabledSummary.zeroStock, 1);
  assert.equal(enabledSummary.lowStock, 1);
});

test('configuração de baixo estoque é explícita e auditável', () => {
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
    () => logistics.validateWarehouseLogisticsSettings({
      ...valid,
      lowStockThreshold: 0,
    }, WORKSPACE),
    /INVALID_LOW_STOCK/
  );
});
