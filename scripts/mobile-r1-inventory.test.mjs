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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-inventory-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobileInventory.ts'),
    resolve(root, 'lib/warehouse/inventory.ts'),
    resolve(root, 'lib/warehouse/mobileIntakeAllocation.ts'),
    resolve(root, 'lib/warehouse/mobileScanner.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/barcode.ts'),
    resolve(root, 'lib/warehouse/movement.ts'),
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
const mobile = require(resolve(outDir, 'warehouse/mobileInventory.js'));
const inventory = require(resolve(outDir, 'warehouse/inventory.js'));
const allocation = require(resolve(outDir, 'warehouse/mobileIntakeAllocation.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const workspaceId = 'hgesm';
const ug = '160416';
const inventoryId = 'inv_' + '1'.repeat(32);
const depotId = 'dep_' + '2'.repeat(32);
const locationAId = 'loc_' + '3'.repeat(32);
const locationBId = 'loc_' + '4'.repeat(32);
const subpositionId = 'sub_' + '5'.repeat(32);
const materialA = 'mat_' + '6'.repeat(32);
const materialB = 'mat_' + '7'.repeat(32);

const locationA = {
  kind: 'LOCATION',
  depotId,
  locationId: locationAId,
  subpositionId: null,
};
const locationB = {
  kind: 'LOCATION',
  depotId,
  locationId: locationBId,
  subpositionId: null,
};
const subposition = {
  kind: 'SUBPOSITION',
  depotId,
  locationId: locationAId,
  subpositionId,
};

function item(idDigit, materialId, position, overrides = {}) {
  return {
    schemaVersion: 'warehouse_inventory_item_v1',
    id: 'invit_' + idDigit.repeat(64),
    inventoryId,
    workspaceId,
    ug,
    materialId,
    position,
    locationBalanceId: 'locbal_' + idDigit.repeat(64),
    expectedQuantity: 10,
    expectedBalanceRevision: 3,
    expectedBalanceLastMovementId: 'mov_' + '8'.repeat(64),
    expectedLocationRevision: 2,
    expectedLocationLastMovementId: 'mov_' + '9'.repeat(64),
    countedQuantity: null,
    difference: null,
    status: 'PENDING',
    countedBy: null,
    adjustmentMovementId: null,
    adjustedBy: null,
    ...overrides,
  };
}

test('MOBILE-F deriva escopo canônico de LOCATION e SUBPOSITION', () => {
  assert.deepEqual(
    mobile.warehouseMobileInventoryScopeFromPosition(locationA),
    { kind: 'LOCATION', depotId, locationId: locationAId }
  );
  assert.deepEqual(
    mobile.warehouseMobileInventoryScopeFromPosition(subposition),
    { kind: 'SUBPOSITION', depotId, locationId: locationAId, subpositionId }
  );
  assert.throws(
    () => mobile.warehouseMobileInventoryScopeFromPosition({ kind: 'UNASSIGNED' }),
    /POSITION_REQUIRED/
  );
});

test('MOBILE-F bloqueia posição fora do escopo e distingue posição vazia', () => {
  const rows = [item('a', materialA, locationA)];
  const scope = { kind: 'LOCATION', depotId, locationId: locationAId };

  assert.equal(
    mobile.warehouseMobileInventoryPositionDisposition(scope, rows, locationA),
    'IN_SCOPE_WITH_ITEMS'
  );
  assert.equal(
    mobile.warehouseMobileInventoryPositionDisposition(scope, rows, locationB),
    'OUT_OF_SCOPE'
  );
  assert.equal(
    mobile.warehouseMobileInventoryPositionDisposition(
      { kind: 'DEPOT', depotId },
      rows,
      locationB
    ),
    'EMPTY'
  );
});

test('MOBILE-F seleciona somente material esperado na posição lida', () => {
  const rows = [
    item('a', materialA, locationA),
    item('b', materialB, locationB),
  ];

  assert.equal(
    mobile.findWarehouseMobileInventoryItem(rows, locationA, materialA)?.materialId,
    materialA
  );
  assert.equal(
    mobile.findWarehouseMobileInventoryItem(rows, locationA, materialB),
    null
  );
});

test('MOBILE-F reutiliza a classificação PRODUCT/LOCATION/UNKNOWN compartilhada', () => {
  for (const value of ['7891234567890', 'EPX1INVALIDO', '   ']) {
    assert.equal(
      mobile.classifyWarehouseMobileInventoryProductScan(value),
      allocation.classifyWarehouseMobileProductScan(value)
    );
  }
});

test('MOBILE-F respeita ciclo de vida e torna finalizadas somente leitura', () => {
  assert.equal(mobile.warehouseMobileInventorySessionMode('COUNTING'), 'COUNT');
  assert.equal(mobile.warehouseMobileInventorySessionMode('REVIEW'), 'REVIEW');
  assert.equal(mobile.warehouseMobileInventorySessionMode('CONFIRMING'), 'CONFIRM');
  assert.equal(
    mobile.warehouseMobileInventorySessionMode('RECONCILIATION_REQUIRED'),
    'RECONCILE'
  );
  assert.equal(mobile.warehouseMobileInventorySessionMode('CONFIRMED'), 'FINALIZED');
  assert.equal(mobile.warehouseMobileInventorySessionMode('CANCELLED'), 'FINALIZED');
  assert.equal(mobile.warehouseMobileInventorySessionMode('OPENING'), 'WAIT');
});

test('MOBILE-F preserva diferença canônica: contado menos esperado', () => {
  assert.equal(inventory.calculateWarehouseInventoryDifference(10, 10), 0);
  assert.equal(inventory.calculateWarehouseInventoryDifference(10, 12), 2);
  assert.equal(inventory.calculateWarehouseInventoryDifference(10, 7), -3);
  assert.equal(inventory.warehouseInventoryItemStatusForDifference(10, 0), 'MATCHED');
  assert.equal(inventory.warehouseInventoryItemStatusForDifference(12, 2), 'DIVERGENT');
  assert.equal(inventory.warehouseInventoryItemStatusForDifference(7, -3), 'DIVERGENT');
});
