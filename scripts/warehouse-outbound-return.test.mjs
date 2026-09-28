#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
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
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
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
const repositorySource = readFileSync(
  resolve(root, 'lib/warehouse/withdrawalRepository.ts'),
  'utf8'
);
const manualEntrySource = readFileSync(
  resolve(root, 'lib/warehouse/manualEntryRepository.ts'),
  'utf8'
);

const WORKSPACE = 'hgesm-aprov';
const UG = '160416';
const MATERIAL = 'mat_' + '1'.repeat(32);
const MOVEMENT = 'mov_' + 'a'.repeat(64);
const CONSUMPTION = 'cons_' + 'c'.repeat(64);

function returnEntry(overrides = {}) {
  return {
    schemaVersion: 'warehouse_movement_v1',
    id: MOVEMENT,
    workspaceId: WORKSPACE,
    ug: UG,
    materialId: MATERIAL,
    type: 'MANUAL_ENTRY',
    quantityDelta: 2,
    idempotencyKeyHash: 'a'.repeat(64),
    reversesMovementId: null,
    note: 'Devolução/cancelamento de saída · ' + CONSUMPTION,
    source: {
      kind: 'MANUAL_ENTRY',
      actorUid: 'founder-uid',
      provenance: 'Devolução de saída',
      reference: CONSUMPTION,
    },
    ...overrides,
  };
}

test('devolução usa MANUAL_ENTRY positivo com procedência auditável', () => {
  const result = movement.validateWarehouseMovement(returnEntry(), {
    expectedWorkspaceId: WORKSPACE,
    expectedUg: UG,
    expectedMaterialId: MATERIAL,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.type, 'MANUAL_ENTRY');
  assert.equal(result.data.source.kind, 'MANUAL_ENTRY');
  assert.equal(result.data.source.provenance, 'Devolução de saída');
  assert.equal(result.data.source.reference, CONSUMPTION);
});

test('MANUAL_ENTRY de devolução rejeita delta negativo', () => {
  const result = movement.validateWarehouseMovement(
    returnEntry({ quantityDelta: -2 })
  );
  assert.equal(result.ok, false);
});

test('repository reutiliza o motor oficial de Entrada Avulsa', () => {
  assert.match(repositorySource, /registerWarehouseManualEntry\(/);
  assert.match(repositorySource, /provenance: 'Devolução de saída'/);
  assert.match(repositorySource, /reference: consumptionId/);
});

test('repository limita a devolução ao saldo ainda retirado', () => {
  assert.match(repositorySource, /consumption\.quantity - baseReturned/);
  assert.match(repositorySource, /quantity > remaining \+ EPSILON/);
  assert.match(
    repositorySource,
    /current\.returnedQuantity \+ quantity/
  );
  assert.match(
    repositorySource,
    /nextReturned > current\.originalQuantity \+ EPSILON/
  );
});

test('status de devolução usa marcador separado e não atualiza consumptions', () => {
  assert.match(repositorySource, /'outboundReturns'/);
  assert.match(repositorySource, /warehouse_outbound_return_v1/);
  assert.equal(
    /transaction\.update\(consumptionRef,[\s\S]*returnedQuantity/.test(repositorySource),
    false
  );
});

test('devolução interna aceita posição UNASSIGNED sem afrouxar Entrada Avulsa comum', () => {
  assert.match(
    manualEntrySource,
    /position\.kind === 'UNASSIGNED' && !input\.allowUnassignedPosition/
  );
  assert.match(
    repositorySource,
    /allowUnassignedPosition: originalSource\.position\.kind === 'UNASSIGNED'/
  );
  assert.match(
    manualEntrySource,
    /position\.kind === 'UNASSIGNED'\s*\? null\s*:\s*await transferWarehouseStock/
  );
});

test('reserva pendente sem movimento pode ser assumida por nova tentativa', () => {
  assert.match(
    repositorySource,
    /existing\.pendingOperationId !== operationId/
  );
  assert.match(
    repositorySource,
    /if \(pendingMovementSnapshot\.exists\(\)\)/
  );
  assert.match(
    repositorySource,
    /Reserva antiga sem movimento correspondente/
  );
});

test('devolução não depende da API server-only removida', () => {
  assert.equal(
    repositorySource.includes('/api/adm-deposito/outbound-return'),
    false
  );
  assert.equal(
    repositorySource.includes('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON'),
    false
  );
});
