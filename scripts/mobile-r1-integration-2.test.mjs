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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-integration-2-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobileIntakeAllocation.ts'),
    resolve(root, 'lib/warehouse/mobilePhysicalQueryModel.ts'),
    resolve(root, 'lib/warehouse/mobileTransfer.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/lot.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/barcode.ts'),
    resolve(root, 'lib/warehouse/locationBarcode.ts'),
    resolve(root, 'lib/warehouse/mobileScanner.ts'),
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
const allocation = require(resolve(outDir, 'warehouse/mobileIntakeAllocation.js'));
const physical = require(resolve(outDir, 'warehouse/mobilePhysicalQueryModel.js'));
const transfer = require(resolve(outDir, 'warehouse/mobileTransfer.js'));
const location = require(resolve(outDir, 'warehouse/location.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const workspaceId = 'ws_mobile_integration_2';
const ug = '160416';
const materialId = 'mat_' + 'a'.repeat(32);
const depotId = 'dep_' + 'b'.repeat(32);
const locationAId = 'loc_' + 'c'.repeat(32);
const locationBId = 'loc_' + 'd'.repeat(32);

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
  id: materialId,
  workspaceId,
  ug,
  description: 'Material Integração 2',
};

function balance(id, position, quantity, revision = 1) {
  return {
    schemaVersion: 'warehouse_location_balance_v1',
    id,
    workspaceId,
    ug,
    materialId,
    position,
    quantity,
    revision,
    lastMovementId: 'mov_' + 'e'.repeat(64),
  };
}

test('Integração 2: alocar → consultar → transferir → consultar preserva total físico', () => {
  const allocated = allocation.normalizeWarehouseMobileAllocationQuantity(5, 10);
  assert.equal(allocated, 5);

  const aBefore = balance('locbal_' + '1'.repeat(64), positionA, allocated);
  const aggregateAfterAllocation = allocated;

  const queryA = physical.buildWarehouseMobilePhysicalQueryItems({
    workspaceId,
    ug,
    position: positionA,
    balances: [aBefore],
    materials: [material],
    lots: [],
  });

  assert.equal(queryA.length, 1);
  assert.equal(queryA[0].balance.quantity, 5);

  const prepared = transfer.prepareWarehouseMobileTransfer({
    materialId,
    from: positionA,
    to: positionB,
    quantity: 2,
    availableQuantity: aBefore.quantity,
    lots: [],
  });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.quantity, 2);
  assert.deepEqual(prepared.relocateLotIds, []);

  const movementId = 'mov_' + 'f'.repeat(64);
  const aAfter = location.applyWarehouseLocationDelta(aBefore, {
    id: aBefore.id,
    workspaceId,
    ug,
    materialId,
    position: positionA,
    quantityDelta: -prepared.quantity,
    movementId,
  });
  const bAfter = location.applyWarehouseLocationDelta(null, {
    id: 'locbal_' + '2'.repeat(64),
    workspaceId,
    ug,
    materialId,
    position: positionB,
    quantityDelta: prepared.quantity,
    movementId,
  });

  const queryAAfter = physical.buildWarehouseMobilePhysicalQueryItems({
    workspaceId,
    ug,
    position: positionA,
    balances: [aAfter, bAfter],
    materials: [material],
    lots: [],
  });
  const queryBAfter = physical.buildWarehouseMobilePhysicalQueryItems({
    workspaceId,
    ug,
    position: positionB,
    balances: [aAfter, bAfter],
    materials: [material],
    lots: [],
  });

  assert.equal(queryAAfter[0].balance.quantity, 3);
  assert.equal(queryBAfter[0].balance.quantity, 2);
  assert.equal(
    queryAAfter[0].balance.quantity + queryBAfter[0].balance.quantity,
    aggregateAfterAllocation
  );
});

test('Integração 2 mantém uma única semântica PRODUCT/LOCATION/UNKNOWN', () => {
  for (const value of [
    '7891234567890',
    'EPX1INVALIDO',
    '   ',
  ]) {
    assert.equal(
      transfer.classifyWarehouseMobileTransferProductScan(value),
      allocation.classifyWarehouseMobileProductScan(value)
    );
  }
});

test('Integração 2 mantém fail-closed de quantidade na transferência', () => {
  const prepared = transfer.prepareWarehouseMobileTransfer({
    materialId,
    from: positionA,
    to: positionB,
    quantity: 6,
    availableQuantity: 5,
    lots: [],
  });
  assert.deepEqual(prepared, { ok: false, error: 'INSUFFICIENT_STOCK' });
});
