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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-phase10-domain-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/inventory.ts'),
    resolve(root, 'lib/warehouse/movement.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
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
const inventory = require(resolve(outDir, 'warehouse/inventory.js'));
const movement = require(resolve(outDir, 'warehouse/movement.js'));

test.after(() => rmSync(outDir, { recursive: true, force: true }));

const WORKSPACE = 'hgesm-aprov';
const UG = '160416';
const MATERIAL = 'mat_123e4567e89b12d3a456426614174000';
const DEPOT = 'dep_' + '6'.repeat(32);
const LOCATION = 'loc_' + '6'.repeat(32);
const SUB = 'sub_' + '6'.repeat(32);
const LOCATION_BALANCE = 'locbal_' + 'a'.repeat(64);
const LAST_MOVEMENT = 'mov_' + 'b'.repeat(64);
const INVENTORY = 'inv_' + 'c'.repeat(32);
const ITEM = 'invit_' + 'd'.repeat(64);

const POSITION = {
  kind: 'LOCATION',
  depotId: DEPOT,
  locationId: LOCATION,
  subpositionId: null,
};

function inventoryItem(overrides = {}) {
  return {
    schemaVersion: 'warehouse_inventory_item_v1',
    id: ITEM,
    inventoryId: INVENTORY,
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    position: POSITION,
    locationBalanceId: LOCATION_BALANCE,
    expectedQuantity: 100,
    expectedBalanceRevision: 7,
    expectedBalanceLastMovementId: LAST_MOVEMENT,
    expectedLocationRevision: 4,
    expectedLocationLastMovementId: LAST_MOVEMENT,
    countedQuantity: null,
    difference: null,
    status: 'PENDING',
    countedBy: null,
    adjustmentMovementId: null,
    adjustedBy: null,
    ...overrides,
  };
}

test('inventário total e parcial usam a mesma abstração de escopo', () => {
  assert.equal(inventory.validateWarehouseInventoryScope({ kind: 'TOTAL' }).kind, 'TOTAL');
  assert.equal(inventory.validateWarehouseInventoryScope({ kind: 'DEPOT', depotId: DEPOT }).kind, 'DEPOT');
  assert.equal(inventory.validateWarehouseInventoryScope({ kind: 'LOCATION', depotId: DEPOT, locationId: LOCATION }).kind, 'LOCATION');
  assert.equal(inventory.validateWarehouseInventoryScope({ kind: 'SUBPOSITION', depotId: DEPOT, locationId: LOCATION, subpositionId: SUB }).kind, 'SUBPOSITION');

  assert.equal(inventory.warehouseInventoryScopeIncludesPosition({ kind: 'TOTAL' }, { kind: 'UNASSIGNED' }), true);
  assert.equal(inventory.warehouseInventoryScopeIncludesPosition({ kind: 'DEPOT', depotId: DEPOT }, POSITION), true);
  assert.equal(inventory.warehouseInventoryScopeIncludesPosition({ kind: 'LOCATION', depotId: DEPOT, locationId: LOCATION }, POSITION), true);
  assert.equal(inventory.warehouseInventoryScopeIncludesPosition({ kind: 'DEPOT', depotId: 'dep_' + '1'.repeat(32) }, POSITION), false);
});

test('divergência é contado menos esperado', () => {
  assert.equal(inventory.calculateWarehouseInventoryDifference(100, 100), 0);
  assert.equal(inventory.calculateWarehouseInventoryDifference(100, 97), -3);
  assert.equal(inventory.calculateWarehouseInventoryDifference(100, 105), 5);
  assert.equal(inventory.warehouseInventoryItemStatusForDifference(100, 0), 'MATCHED');
  assert.equal(inventory.warehouseInventoryItemStatusForDifference(97, -3), 'DIVERGENT');
});

test('item preserva snapshot esperado e revisão física', () => {
  const result = inventory.validateWarehouseInventoryItem(inventoryItem(), {
    expectedWorkspaceId: WORKSPACE,
    expectedInventoryId: INVENTORY,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.data.expectedQuantity, 100);
  assert.equal(result.ok && result.data.expectedLocationRevision, 4);
});

test('inconsistência contado/diferença é rejeitada', () => {
  const result = inventory.validateWarehouseInventoryItem(
    inventoryItem({ countedQuantity: 97, difference: 5, status: 'DIVERGENT', countedBy: 'founder' })
  );
  assert.equal(result.ok, false);
  assert.match(result.issues.map((item) => item.code).join(','), /difference_mismatch/);
});

test('resumo separa pendentes, conferidos, divergentes e ajustados', () => {
  const rows = [
    inventoryItem(),
    inventoryItem({ id: 'invit_' + '1'.repeat(64), countedQuantity: 100, difference: 0, status: 'MATCHED', countedBy: 'founder' }),
    inventoryItem({ id: 'invit_' + '2'.repeat(64), countedQuantity: 105, difference: 5, status: 'DIVERGENT', countedBy: 'founder' }),
    inventoryItem({ id: 'invit_' + '3'.repeat(64), countedQuantity: 98, difference: -2, status: 'ADJUSTED', countedBy: 'founder', adjustmentMovementId: 'mov_' + '3'.repeat(64), adjustedBy: 'founder' }),
  ].map((row) => {
    const parsed = inventory.validateWarehouseInventoryItem(row);
    assert.equal(parsed.ok, true);
    return parsed.data;
  });
  const summary = inventory.summarizeWarehouseInventoryItems(rows);
  assert.equal(summary.totalItems, 4);
  assert.equal(summary.countedItems, 3);
  assert.equal(summary.matchedItems, 1);
  assert.equal(summary.divergentItems, 1);
  assert.equal(summary.adjustedItems, 1);
  assert.equal(summary.positiveDifference, 5);
});

test('INVENTORY_ADJUSTMENT exige origem PHYSICAL_INVENTORY e delta coerente', () => {
  const source = {
    kind: 'PHYSICAL_INVENTORY',
    actorUid: 'founder',
    inventoryId: INVENTORY,
    inventoryItemId: ITEM,
    expectedQuantity: 100,
    countedQuantity: 97,
    position: POSITION,
    locationBalanceId: LOCATION_BALANCE,
    expectedLocationRevision: 4,
    expectedLocationLastMovementId: LAST_MOVEMENT,
  };
  const valid = movement.validateWarehouseMovement({
    schemaVersion: 'warehouse_movement_v1',
    id: 'mov_' + 'e'.repeat(64),
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    type: 'INVENTORY_ADJUSTMENT',
    quantityDelta: -3,
    idempotencyKeyHash: 'e'.repeat(64),
    reversesMovementId: null,
    note: null,
    source,
  });
  assert.equal(valid.ok, true);

  const missingSource = movement.validateWarehouseMovement({
    schemaVersion: 'warehouse_movement_v1',
    id: 'mov_' + 'f'.repeat(64),
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    type: 'INVENTORY_ADJUSTMENT',
    quantityDelta: -3,
    idempotencyKeyHash: 'f'.repeat(64),
    reversesMovementId: null,
    note: null,
    source: null,
  });
  assert.equal(missingSource.ok, false);
  assert.match(missingSource.issues.map((item) => item.code).join(','), /inventory_source_required/);
});
