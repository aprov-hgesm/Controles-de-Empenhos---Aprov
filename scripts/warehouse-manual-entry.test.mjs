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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-manual-entry-'));

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

function candidate(overrides = {}) {
  return {
    schemaVersion: 'warehouse_movement_v1',
    id: MOVEMENT,
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    type: 'MANUAL_ENTRY',
    quantityDelta: 12,
    idempotencyKeyHash: 'a'.repeat(64),
    reversesMovementId: null,
    note: 'Entrada avulsa · doação',
    source: {
      kind: 'MANUAL_ENTRY',
      actorUid: 'founder-uid',
      provenance: 'Doação',
      reference: 'TERMO 01/2026',
    },
    ...overrides,
  };
}

test('MANUAL_ENTRY aceita procedência diversa auditável e quantidade positiva', () => {
  const result = movement.validateWarehouseMovement(candidate(), {
    expectedWorkspaceId: WORKSPACE,
    expectedUg: UG,
    expectedMaterialId: MATERIAL,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.type, 'MANUAL_ENTRY');
  assert.equal(result.data.source.kind, 'MANUAL_ENTRY');
  assert.equal(result.data.source.provenance, 'Doação');
});

test('MANUAL_ENTRY exige origem estruturada própria', () => {
  const result = movement.validateWarehouseMovement(candidate({ source: null }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === 'manual_entry_source_required'));
});

test('origem MANUAL_ENTRY não pode acompanhar outro tipo de movimento', () => {
  const result = movement.validateWarehouseMovement(candidate({
    type: 'INVOICE_ENTRY',
  }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === 'invalid_source_type'));
});

test('MANUAL_ENTRY rejeita procedência vazia e delta negativo', () => {
  const badSource = movement.validateWarehouseMovement(candidate({
    source: {
      kind: 'MANUAL_ENTRY',
      actorUid: 'founder-uid',
      provenance: '   ',
      reference: null,
    },
  }));
  assert.equal(badSource.ok, false);

  const badDelta = movement.validateWarehouseMovement(candidate({
    quantityDelta: -1,
  }));
  assert.equal(badDelta.ok, false);
  assert.ok(badDelta.issues.some((item) => item.code === 'invalid_quantity_direction'));
});
