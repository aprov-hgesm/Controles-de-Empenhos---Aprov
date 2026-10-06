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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-integration-3-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobileInventory.ts'),
    resolve(root, 'lib/warehouse/inventory.ts'),
    resolve(root, 'lib/warehouse/mobileOutbound.ts'),
    resolve(root, 'lib/warehouse/outbound.ts'),
    resolve(root, 'lib/warehouse/mobilePositionCheckModel.ts'),
    resolve(root, 'lib/warehouse/mobilePhysicalQueryModel.ts'),
    resolve(root, 'lib/warehouse/mobileIntakeAllocation.ts'),
    resolve(root, 'lib/warehouse/mobileScanner.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/lot.ts'),
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
const mobileInventory = require(resolve(outDir, 'warehouse/mobileInventory.js'));
const mobileOutbound = require(resolve(outDir, 'warehouse/mobileOutbound.js'));
const positionCheck = require(resolve(outDir, 'warehouse/mobilePositionCheckModel.js'));
const allocation = require(resolve(outDir, 'warehouse/mobileIntakeAllocation.js'));

test.after(() => rmSync(outDir, { recursive: true, force: true }));

const workspaceId = 'ws_mobile_integration_3';
const ug = '160416';
const inventoryId = 'inv_' + '1'.repeat(32);
const materialId = 'mat_' + '2'.repeat(32);
const depotId = 'dep_' + '3'.repeat(32);
const locationAId = 'loc_' + '4'.repeat(32);
const locationBId = 'loc_' + '5'.repeat(32);
const movementId = 'mov_' + '6'.repeat(64);

const positionA = {
  kind: 'LOCATION',
  depotId,
  locationId: locationAId,
  subpositionId: null,
};
const positionB = {
  kind: 'LOCATION',
  depotId,
  locationId: locationBId,
  subpositionId: null,
};

const material = {
  schemaVersion: 'warehouse_material_v1',
  id: materialId,
  workspaceId,
  ug,
  description: 'Material Integração 3',
  aliases: [],
  unit: { code: 'unit', label: 'Unidade' },
  status: 'active',
  conversions: [],
};

const aggregateBalance = {
  schemaVersion: 'warehouse_balance_v1',
  workspaceId,
  ug,
  materialId,
  quantity: 5,
  revision: 1,
  lastMovementId: movementId,
};

const association = {
  schemaVersion: 'warehouse_barcode_v1',
  id: 'bar_' + '7'.repeat(64),
  workspaceId,
  ug,
  materialId,
  barcode: '7891234567890',
  presentation: material.unit,
  factorToBaseUnit: 1,
  status: 'active',
  createdBy: 'tester',
  updatedBy: 'tester',
};

function locationBalance(position, quantity, digit = '8') {
  return {
    schemaVersion: 'warehouse_location_balance_v1',
    id: 'locbal_' + digit.repeat(64),
    workspaceId,
    ug,
    materialId,
    position,
    quantity,
    revision: 1,
    lastMovementId: movementId,
  };
}

function inventoryItem(position) {
  return {
    schemaVersion: 'warehouse_inventory_item_v1',
    id: 'invit_' + '9'.repeat(64),
    inventoryId,
    workspaceId,
    ug,
    materialId,
    position,
    locationBalanceId: 'locbal_' + '8'.repeat(64),
    expectedQuantity: 5,
    expectedBalanceRevision: 1,
    expectedBalanceLastMovementId: movementId,
    expectedLocationRevision: 1,
    expectedLocationLastMovementId: movementId,
    countedQuantity: null,
    difference: null,
    status: 'PENDING',
    countedBy: null,
    adjustmentMovementId: null,
    adjustedBy: null,
  };
}

test('Integração 3: F, G e H compartilham a mesma identidade física canônica', () => {
  const scope = mobileInventory.warehouseMobileInventoryScopeFromPosition(positionA);
  assert.deepEqual(scope, {
    kind: 'LOCATION',
    depotId,
    locationId: locationAId,
  });

  const row = inventoryItem(positionA);
  assert.equal(
    mobileInventory.findWarehouseMobileInventoryItem([row], positionA, materialId)?.id,
    row.id
  );

  const outbound = mobileOutbound.prepareWarehouseMobileOutboundOptions({
    material,
    balance: aggregateBalance,
    barcodeAssociation: association,
    requestedQuantity: 2,
    locationBalances: [locationBalance(positionA, 5)],
    lots: [],
  });

  assert.equal(outbound.baseQuantity, 2);
  assert.equal(outbound.options.length, 1);
  assert.deepEqual(outbound.options[0].position, positionA);

  const physicalAfterOutbound = {
    material,
    balance: locationBalance(positionA, 3),
    lots: [],
  };
  const correct = positionCheck.buildWarehouseMobilePositionCheckDecision({
    workspaceId,
    ug,
    selectedPosition: positionA,
    materialId,
    physicalItems: [physicalAfterOutbound],
    materialBalances: [],
  });

  assert.equal(correct.status, 'CORRECT');
  assert.equal(correct.current.balance.quantity, 3);

  const incorrect = positionCheck.buildWarehouseMobilePositionCheckDecision({
    workspaceId,
    ug,
    selectedPosition: positionB,
    materialId,
    physicalItems: [],
    materialBalances: [locationBalance(positionA, 3)],
  });

  assert.equal(incorrect.status, 'INCORRECT');
  assert.equal(incorrect.alternatives.length, 1);
  assert.deepEqual(incorrect.alternatives[0].position, positionA);
});

test('Integração 3 preserva um único classificador PRODUCT/LOCATION/UNKNOWN', () => {
  const validLocationNumeric = '9812001101000';
  const commercialLike981 = '9819123456789';

  assert.equal(allocation.classifyWarehouseMobileProductScan('7891234567890'), 'PRODUCT');
  assert.equal(allocation.classifyWarehouseMobileProductScan(validLocationNumeric), 'LOCATION');
  assert.equal(allocation.classifyWarehouseMobileProductScan(commercialLike981), 'PRODUCT');
  assert.equal(allocation.classifyWarehouseMobileProductScan('EPX1INVALIDO'), 'UNKNOWN');
  assert.equal(allocation.classifyWarehouseMobileProductScan('   '), 'UNKNOWN');

  for (const value of [
    '7891234567890',
    validLocationNumeric,
    commercialLike981,
    'EPX1INVALIDO',
    '   ',
  ]) {
    const expected = allocation.classifyWarehouseMobileProductScan(value);
    assert.equal(mobileInventory.classifyWarehouseMobileInventoryProductScan(value), expected);
    assert.equal(mobileOutbound.classifyWarehouseMobileOutboundProductScan(value), expected);
  }
});

test('Integração 3 mantém RECONCILIATION_REQUIRED fail-closed na MOBILE-F', () => {
  assert.equal(
    mobileInventory.warehouseMobileInventorySessionMode('RECONCILIATION_REQUIRED'),
    'RECONCILE'
  );
  assert.equal(
    mobileInventory.warehouseMobileInventorySessionMode('CONFIRMED'),
    'FINALIZED'
  );
});

test('Integração 3 mantém posição escaneada estritamente igual na MOBILE-G', () => {
  assert.equal(
    mobileOutbound.warehouseMobileOutboundScannedPositionMatches(positionA, positionA),
    true
  );
  assert.equal(
    mobileOutbound.warehouseMobileOutboundScannedPositionMatches(positionB, positionA),
    false
  );
});
