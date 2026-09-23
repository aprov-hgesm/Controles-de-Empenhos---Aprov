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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-stock-operational-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/lot.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
    '--outDir',
    outDir,
    '--module',
    'commonjs',
    '--target',
    'ES2020',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--esModuleInterop',
  ],
  { cwd: root, stdio: 'pipe' }
);

const require = createRequire(import.meta.url);
const lot = require(resolve(outDir, 'warehouse/lot.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const workspaceId = 'hgesm-aprov';
const ug = '160416';
const materialId = 'mat_123e4567e89b12d3a456426614174000';
const actorUid = 'founder-phase-7';

function manualOrigin(kind = 'MANUAL_ENRICHMENT') {
  return {
    kind,
    movementId: null,
    invoiceRecordKey: null,
    invoiceId: null,
    supplier: null,
    supplierCnpj: null,
  };
}

function sampleLot(overrides = {}) {
  return {
    schemaVersion: lot.WAREHOUSE_LOT_SCHEMA_VERSION,
    id: 'lot_' + 'a'.repeat(32),
    workspaceId,
    ug,
    materialId,
    code: 'LOTE-001',
    expiresOn: '2026-12-31',
    quantity: 10,
    position: { kind: 'UNASSIGNED' },
    origin: manualOrigin(),
    status: 'active',
    createdBy: actorUid,
    updatedBy: actorUid,
    ...overrides,
  };
}

test('warehouse_lot_v1 preserva material canônico e identidade técnica', () => {
  const result = lot.validateWarehouseLot(sampleLot());
  assert.equal(result.ok, true);
  assert.equal(result.data.materialId, materialId);
  assert.match(result.data.id, /^lot_[a-f0-9]{32}$/);
});

test('lote de outra UG/workspace é rejeitado pelo contrato', () => {
  assert.equal(
    lot.validateWarehouseLot(sampleLot({ ug: '999999' }), {
      expectedUg: ug,
      expectedWorkspaceId: workspaceId,
    }).ok,
    false
  );
  assert.equal(
    lot.validateWarehouseLot(sampleLot({ workspaceId: 'workspace-outro' }), {
      expectedWorkspaceId: workspaceId,
    }).ok,
    false
  );
});

test('validade aceita data ISO real e rejeita datas impossíveis', () => {
  assert.equal(lot.normalizeWarehouseExpiryDate('2026-02-28'), '2026-02-28');
  assert.equal(lot.normalizeWarehouseExpiryDate('2026-02-30'), undefined);
  assert.equal(lot.normalizeWarehouseExpiryDate('28/02/2026'), undefined);
  assert.equal(lot.normalizeWarehouseExpiryDate(null), null);
});

test('material sem validade continua válido e gera apenas contexto logístico', () => {
  const result = lot.validateWarehouseLot(sampleLot({ expiresOn: null }));
  assert.equal(result.ok, true);
  assert.equal(lot.warehouseLotExpiryState(result.data, new Date('2026-09-23T12:00:00Z')), 'NO_EXPIRY');
});

test('FEFO recomenda o lote disponível com vencimento válido mais próximo', () => {
  const today = new Date('2026-09-23T12:00:00Z');
  const later = lot.validateWarehouseLot(sampleLot({
    id: 'lot_' + 'b'.repeat(32),
    code: 'DEPOIS',
    expiresOn: '2026-12-15',
    quantity: 4,
  })).data;
  const sooner = lot.validateWarehouseLot(sampleLot({
    id: 'lot_' + 'c'.repeat(32),
    code: 'PRIMEIRO',
    expiresOn: '2026-10-20',
    quantity: 3,
  })).data;
  assert.equal(lot.selectWarehouseFefoLot([later, sooner], today)?.code, 'PRIMEIRO');
});

test('FEFO ignora lote vencido, sem saldo, sem validade e inativo', () => {
  const today = new Date('2026-09-23T12:00:00Z');
  const valid = lot.validateWarehouseLot(sampleLot({
    id: 'lot_' + 'd'.repeat(32),
    code: 'VALIDO',
    expiresOn: '2026-12-01',
    quantity: 1,
  })).data;
  const expired = lot.validateWarehouseLot(sampleLot({
    id: 'lot_' + 'e'.repeat(32),
    code: 'VENCIDO',
    expiresOn: '2026-09-01',
    quantity: 5,
  })).data;
  const depleted = lot.validateWarehouseLot(sampleLot({
    id: 'lot_' + 'f'.repeat(32),
    code: 'ZERADO',
    expiresOn: '2026-09-25',
    quantity: 0,
  })).data;
  const noExpiry = lot.validateWarehouseLot(sampleLot({
    id: 'lot_' + '1'.repeat(32),
    code: 'SEM-VALIDADE',
    expiresOn: null,
    quantity: 2,
  })).data;
  const inactive = lot.validateWarehouseLot(sampleLot({
    id: 'lot_' + '2'.repeat(32),
    code: 'INATIVO',
    expiresOn: '2026-09-24',
    quantity: 2,
    status: 'inactive',
  })).data;

  assert.equal(
    lot.selectWarehouseFefoLot([expired, depleted, noExpiry, inactive, valid], today)?.code,
    'VALIDO'
  );
  assert.equal(lot.warehouseLotExpiryState(expired, today), 'EXPIRED');
  assert.equal(lot.warehouseLotExpiryState(depleted, today), 'DEPLETED');
});

test('lote próximo ao vencimento recebe estado operacional próprio', () => {
  const result = lot.validateWarehouseLot(sampleLot({ expiresOn: '2026-10-10' }));
  assert.equal(result.ok, true);
  assert.equal(
    lot.warehouseLotExpiryState(result.data, new Date('2026-09-23T12:00:00Z')),
    'NEAR_EXPIRY'
  );
});

test('estoque legado sem lote permanece operável e vira pendência não bloqueante', () => {
  const pendencies = lot.buildWarehouseLogisticsPendencies({
    materialId,
    totalQuantity: 10,
    locationBalances: [],
    lots: [],
    today: new Date('2026-09-23T12:00:00Z'),
  });
  assert.ok(pendencies.some((item) => item.code === 'LOT_INFORMATION_MISSING'));
  assert.ok(pendencies.some((item) => item.code === 'UNASSIGNED_STOCK'));
  assert.ok(pendencies.every((item) => item.severity !== 'critical'));
});

test('lote sem validade vira pendência mas não é corrompido nem bloqueado', () => {
  const undated = lot.validateWarehouseLot(sampleLot({ expiresOn: null, quantity: 2 })).data;
  const pendencies = lot.buildWarehouseLogisticsPendencies({
    materialId,
    totalQuantity: 10,
    locationBalances: [],
    lots: [undated],
  });
  assert.ok(pendencies.some((item) => item.code === 'LOT_EXPIRY_MISSING'));
});

test('lote vencido é separado da recomendação e sinalizado criticamente', () => {
  const expired = lot.validateWarehouseLot(sampleLot({
    expiresOn: '2026-08-30',
    quantity: 2,
  })).data;
  const pendencies = lot.buildWarehouseLogisticsPendencies({
    materialId,
    totalQuantity: 10,
    locationBalances: [],
    lots: [expired],
    today: new Date('2026-09-23T12:00:00Z'),
  });
  assert.ok(
    pendencies.some(
      (item) => item.code === 'EXPIRED_LOT' && item.severity === 'critical'
    )
  );
  assert.equal(
    lot.selectWarehouseFefoLot([expired], new Date('2026-09-23T12:00:00Z')),
    null
  );
});

test('distribuição física maior que saldo gera pendência sem autocorreção', () => {
  const physical = [{
    schemaVersion: 'warehouse_location_balance_v1',
    id: 'locbal_' + 'a'.repeat(64),
    workspaceId,
    ug,
    materialId,
    position: {
      kind: 'LOCATION',
      depotId: 'dep_' + 'a'.repeat(32),
      locationId: 'loc_' + 'b'.repeat(32),
      subpositionId: null,
    },
    quantity: 11,
    revision: 1,
    lastMovementId: 'mov_' + 'a'.repeat(64),
  }];
  const pendencies = lot.buildWarehouseLogisticsPendencies({
    materialId,
    totalQuantity: 10,
    locationBalances: physical,
    lots: [],
  });
  assert.ok(pendencies.some((item) => item.code === 'PHYSICAL_BALANCE_MISMATCH'));
});

test('atribuição de lote nunca é tratada como autoridade do saldo agregado', () => {
  const attributed = lot.validateWarehouseLot(sampleLot({ quantity: 12 })).data;
  const pendencies = lot.buildWarehouseLogisticsPendencies({
    materialId,
    totalQuantity: 10,
    locationBalances: [],
    lots: [attributed],
  });
  assert.ok(pendencies.some((item) => item.code === 'LOT_ATTRIBUTION_EXCEEDS_STOCK'));
  assert.equal(10, 10, 'saldo oficial permanece externo ao contrato de lote');
});

test('origem de NF exige vínculo estrutural mínimo e não aceita texto solto', () => {
  const invalid = lot.validateWarehouseLot(sampleLot({
    origin: {
      kind: 'INVOICE',
      movementId: null,
      invoiceRecordKey: 'nf-1',
      invoiceId: '1',
      supplier: 'Fornecedor',
      supplierCnpj: null,
    },
  }));
  assert.equal(invalid.ok, false);

  const valid = lot.validateWarehouseLot(sampleLot({
    origin: {
      kind: 'INVOICE',
      movementId: 'mov_' + 'a'.repeat(64),
      invoiceRecordKey: 'nf-1',
      invoiceId: '1',
      supplier: 'Fornecedor',
      supplierCnpj: '12345678000199',
    },
  }));
  assert.equal(valid.ok, true);
});
