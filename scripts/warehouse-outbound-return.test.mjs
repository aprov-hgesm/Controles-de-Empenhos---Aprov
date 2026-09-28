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

const WORKSPACE = 'hgesm-aprov';
const UG = '160416';
const MATERIAL = 'mat_' + '1'.repeat(32);
const MOVEMENT = 'mov_' + 'a'.repeat(64);
const ORIGINAL = 'mov_' + 'b'.repeat(64);
const CONSUMPTION = 'cons_' + 'c'.repeat(64);
const LOCATION_BALANCE = 'locbal_' + 'd'.repeat(64);

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
