#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-outbound-return-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/movement.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/withdrawal.ts'),
    resolve(root, 'lib/warehouse/outboundReturn.ts'),
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
const movement = require(resolve(outDir, 'warehouse/movement.js'));
const outboundReturn = require(resolve(outDir, 'warehouse/outboundReturn.js'));

const WORKSPACE = 'hgesm-aprov';
const UG = '160416';
const MATERIAL = 'mat_' + '1'.repeat(32);
const MOVEMENT = 'mov_' + 'a'.repeat(64);
const ORIGINAL = 'mov_' + 'b'.repeat(64);
const CONSUMPTION = 'cons_' + 'c'.repeat(64);
const LOCATION_BALANCE = 'locbal_' + 'd'.repeat(64);
const DEPOT = 'dep_' + '2'.repeat(32);
const LOCATION = 'loc_' + '3'.repeat(32);
const SUBPOSITION = 'sub_' + '4'.repeat(32);
const LOT = 'lot_' + '8'.repeat(32);

const POSITION = {
  kind: 'SUBPOSITION',
  depotId: DEPOT,
  locationId: LOCATION,
  subpositionId: SUBPOSITION,
};

function candidate(overrides = {}) {
  return {
    schemaVersion: 'warehouse_movement_v1',
    id: MOVEMENT,
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    type: 'OUTBOUND_RETURN',
    quantityDelta: 2,
    idempotencyKeyHash: 'a'.repeat(64),
    reversesMovementId: null,
    note: 'Devolução de saída',
    source: {
      kind: 'OUTBOUND_RETURN',
      actorUid: 'founder-uid',
      consumptionId: CONSUMPTION,
      originalMovementId: ORIGINAL,
      quantity: 2,
      position: { kind: 'UNASSIGNED' },
      locationBalanceId: LOCATION_BALANCE,
      lotId: null,
      reason: 'Material devolvido',
    },
    ...overrides,
  };
}

function canonicalMaterial() {
  return {
    schemaVersion: 'warehouse_material_v1',
    id: MATERIAL,
    workspaceId: WORKSPACE,
    ug: UG,
    description: 'Material devolvido',
    aliases: [],
    unit: { code: 'unit', label: null },
    status: 'active',
    conversions: [],
  };
}

function originalOutbound() {
  return {
    schemaVersion: 'warehouse_movement_v1',
    id: ORIGINAL,
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    type: 'OUTBOUND',
    quantityDelta: -1,
    idempotencyKeyHash: 'b'.repeat(64),
    reversesMovementId: null,
    note: 'Saída original',
    source: {
      kind: 'EXPRESS_OUTBOUND',
      interface: 'MANUAL_SEARCH',
      actorUid: 'founder-uid',
      requestedQuantity: 1,
      quantity: 1,
      presentation: { code: 'unit', label: null },
      factorToBaseUnit: 1,
      barcodeId: null,
      barcode: null,
      position: POSITION,
      locationBalanceId: LOCATION_BALANCE,
      lotId: LOT,
      lotCode: 'PEND-R1',
    },
  };
}

function consumption(returnedQuantity = 0) {
  return {
    schemaVersion: 'warehouse_consumption_record_v1',
    id: CONSUMPTION,
    workspaceId: WORKSPACE,
    ug: UG,
    origin: 'STOCK_OUTBOUND',
    materialId: MATERIAL,
    materialDescription: 'Material devolvido',
    unitLabel: 'UN',
    quantity: 1,
    requestedQuantity: 1,
    presentationLabel: 'UN',
    destinationId: 'dest_' + '5'.repeat(32),
    destinationName: 'Cozinha',
    withdrawnBy: 'Militar',
    operatorUid: 'founder-uid',
    movementId: ORIGINAL,
    withdrawalId: 'wd_' + '6'.repeat(32),
    lineId: 'wline_' + '7'.repeat(32),
    intakeId: null,
    invoiceRecordKey: null,
    barcode: null,
    lotCode: 'PEND-R1',
    positionLabel: 'Subposição B',
    siscofisStatus: 'PENDING',
    occurredAt: null,
    updatedAt: null,
    siscofisUpdatedBy: null,
    siscofisUpdatedAt: null,
    returnedQuantity,
    lastReturnMovementId: null,
    lastReturnAt: null,
    lastReturnBy: null,
    lastReturnReason: null,
    legacy: false,
  };
}

function balance() {
  return {
    schemaVersion: 'warehouse_balance_v1',
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    quantity: 7,
    revision: 3,
    lastMovementId: ORIGINAL,
  };
}

function locationBalance() {
  return {
    schemaVersion: 'warehouse_location_balance_v1',
    id: LOCATION_BALANCE,
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    position: POSITION,
    quantity: 2,
    revision: 3,
    lastMovementId: ORIGINAL,
  };
}

function planInput(overrides = {}) {
  return {
    workspaceId: WORKSPACE,
    ug: UG,
    actorUid: 'founder-uid',
    movementId: MOVEMENT,
    quantity: 1,
    reason: 'Retorno ao depósito',
    consumption: consumption(),
    originalMovement: originalOutbound(),
    material: canonicalMaterial(),
    balance: balance(),
    locationBalance: locationBalance(),
    ...overrides,
  };
}

test('OUTBOUND_RETURN aceita delta positivo e vínculo auditável', () => {
  const result = movement.validateWarehouseMovement(candidate(), {
    expectedWorkspaceId: WORKSPACE,
    expectedUg: UG,
    expectedMaterialId: MATERIAL,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.type, 'OUTBOUND_RETURN');
  assert.equal(result.data.source.kind, 'OUTBOUND_RETURN');
  assert.equal(result.data.source.quantity, 2);
});

test('OUTBOUND_RETURN rejeita delta negativo', () => {
  const result = movement.validateWarehouseMovement(candidate({ quantityDelta: -2 }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === 'invalid_quantity_direction'));
});

test('OUTBOUND_RETURN exige source próprio', () => {
  const result = movement.validateWarehouseMovement(candidate({ source: null }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === 'outbound_return_source_required'));
});

test('quantidade do source deve coincidir com delta devolvido', () => {
  const result = movement.validateWarehouseMovement(candidate({
    source: {
      ...candidate().source,
      quantity: 1,
    },
  }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === 'return_quantity_mismatch'));
});

test('planner server-side recompõe saldo agregado e posição física atomicamente', () => {
  const plan = outboundReturn.planWarehouseOutboundReturn(planInput());
  assert.equal(plan.movement.type, 'OUTBOUND_RETURN');
  assert.equal(plan.movement.quantityDelta, 1);
  assert.equal(plan.movement.source.consumptionId, CONSUMPTION);
  assert.equal(plan.balance.quantity, 8);
  assert.equal(plan.balance.revision, 4);
  assert.equal(plan.balance.lastMovementId, MOVEMENT);
  assert.equal(plan.locationBalance.quantity, 3);
  assert.equal(plan.locationBalance.revision, 4);
  assert.equal(plan.locationBalance.lastMovementId, MOVEMENT);
  assert.equal(plan.returnedQuantity, 1);
  assert.equal(plan.remainingQuantity, 0);
});

test('planner server-side não permite devolver acima do total originalmente retirado', () => {
  assert.throws(
    () => outboundReturn.planWarehouseOutboundReturn(
      planInput({ quantity: 2 })
    ),
    /WAREHOUSE_OUTBOUND_RETURN_EXCEEDS_REMAINING/
  );
});

test('planner server-side não permite nova devolução quando a saída já foi integralmente devolvida', () => {
  assert.throws(
    () => outboundReturn.planWarehouseOutboundReturn(
      planInput({ consumption: consumption(1) })
    ),
    /WAREHOUSE_OUTBOUND_RETURN_EXCEEDS_REMAINING/
  );
});

test('planner server-side exige exatamente a posição física da saída original', () => {
  assert.throws(
    () => outboundReturn.planWarehouseOutboundReturn(
      planInput({
        locationBalance: {
          ...locationBalance(),
          position: { kind: 'UNASSIGNED' },
        },
      })
    ),
    /WAREHOUSE_OUTBOUND_RETURN_LOCATION_MISMATCH/
  );
});
