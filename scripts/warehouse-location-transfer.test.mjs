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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-location-contract-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/movement.ts'),
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
const location = require(resolve(outDir, 'warehouse/location.js'));
const movement = require(resolve(outDir, 'warehouse/movement.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const workspaceId = 'hgesm-aprov';
const ug = '160416';
const materialId = 'mat_123e4567e89b12d3a456426614174000';
const depotId = 'dep_' + 'a'.repeat(32);
const localA = 'loc_' + 'b'.repeat(32);
const localB = 'loc_' + 'c'.repeat(32);
const subA = 'sub_' + 'd'.repeat(32);
const actorUid = 'founder-phase-6';

function sampleDepot(overrides = {}) {
  return {
    schemaVersion: location.WAREHOUSE_DEPOT_SCHEMA_VERSION,
    id: depotId,
    workspaceId,
    ug,
    code: 'DEP-01',
    name: 'Depósito Principal',
    description: null,
    status: 'active',
    createdBy: actorUid,
    updatedBy: actorUid,
    ...overrides,
  };
}

function sampleLocation(overrides = {}) {
  return {
    schemaVersion: location.WAREHOUSE_LOCATION_SCHEMA_VERSION,
    id: localA,
    workspaceId,
    ug,
    depotId,
    kind: 'LOCAL',
    parentLocationId: null,
    code: 'EST-03',
    name: 'Estante 03',
    description: null,
    status: 'active',
    createdBy: actorUid,
    updatedBy: actorUid,
    ...overrides,
  };
}

test('depósito e localização usam IDs estáveis independentes do nome visível', () => {
  const first = location.validateWarehouseDepot(sampleDepot());
  const renamed = location.validateWarehouseDepot(sampleDepot({ name: 'Depósito Geral' }));
  assert.equal(first.ok, true);
  assert.equal(renamed.ok, true);
  assert.equal(first.data.id, renamed.data.id);
  assert.equal(first.data.code, 'DEP-01');
  assert.equal(renamed.data.code, 'DEP-01');

  const loc = location.validateWarehouseLocation(sampleLocation());
  const locRenamed = location.validateWarehouseLocation(
    sampleLocation({ name: 'Estante de secos' })
  );
  assert.equal(loc.ok, true);
  assert.equal(locRenamed.ok, true);
  assert.equal(loc.data.id, locRenamed.data.id);
});

test('código lógico é legível, normalizado e rejeita formatos indevidos', () => {
  assert.equal(location.normalizeWarehouseLogicalCode(' dep 01 '), 'DEP-01');
  assert.equal(location.normalizeWarehouseLogicalCode('est-03'), 'EST-03');
  assert.equal(location.normalizeWarehouseLogicalCode('x'), null);
  assert.equal(location.normalizeWarehouseLogicalCode('dep/01'), null);
});

test('hierarquia aceita Depósito → Local e subposição opcional', () => {
  const local = location.validateWarehouseLocation(sampleLocation());
  assert.equal(local.ok, true);

  const sub = location.validateWarehouseLocation(
    sampleLocation({
      id: subA,
      kind: 'SUBPOSITION',
      parentLocationId: localA,
      code: 'PRAT-B',
      name: 'Prateleira B',
    })
  );
  assert.equal(sub.ok, true);

  const invalidSub = location.validateWarehouseLocation(
    sampleLocation({
      id: subA,
      kind: 'SUBPOSITION',
      parentLocationId: null,
      code: 'PRAT-B',
      name: 'Prateleira B',
    })
  );
  assert.equal(invalidSub.ok, false);
});

test('um mesmo material pode manter projeções em múltiplas localizações', async () => {
  const posA = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const posB = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };
  const idA = await location.createWarehouseLocationBalanceId(workspaceId, materialId, posA);
  const idB = await location.createWarehouseLocationBalanceId(workspaceId, materialId, posB);
  assert.notEqual(idA, idB);
  assert.match(idA, /^locbal_[a-f0-9]{64}$/);
  assert.match(idB, /^locbal_[a-f0-9]{64}$/);
});

test('saldo legado é representado como Sem localização sem alterar o total', () => {
  const physical = [{
    schemaVersion: location.WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION,
    id: 'locbal_' + '1'.repeat(64),
    workspaceId,
    ug,
    materialId,
    position: { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null },
    quantity: 30,
    revision: 1,
    lastMovementId: 'mov_' + '1'.repeat(64),
  }];
  assert.equal(location.deriveUnassignedQuantity(100, physical), 70);
  assert.equal(location.deriveUnassignedQuantity(100, []), 100);
});

test('transferência parcial reduz origem e aumenta destino na mesma quantidade', async () => {
  const from = { kind: 'UNASSIGNED' };
  const to = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const movementId = await movement.createWarehouseMovementId(
    workspaceId,
    'phase6:transfer:partial'
  );
  const fromId = await location.createWarehouseLocationBalanceId(workspaceId, materialId, from);
  const toId = await location.createWarehouseLocationBalanceId(workspaceId, materialId, to);

  const fromAfter = location.applyWarehouseLocationDelta(null, {
    id: fromId,
    workspaceId,
    ug,
    materialId,
    position: from,
    quantityDelta: -20,
    movementId,
    initialQuantity: 100,
  });
  const toAfter = location.applyWarehouseLocationDelta(null, {
    id: toId,
    workspaceId,
    ug,
    materialId,
    position: to,
    quantityDelta: 20,
    movementId,
  });

  assert.equal(fromAfter.quantity, 80);
  assert.equal(toAfter.quantity, 20);
  assert.equal(fromAfter.quantity + toAfter.quantity, 100);
});

test('TRANSFER auditável usa delta geral zero e origem física estruturada', async () => {
  const from = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const to = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };
  const key = 'phase6:transfer:ledger';
  const movementId = await movement.createWarehouseMovementId(workspaceId, key);
  const candidate = {
    schemaVersion: movement.WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
    id: movementId,
    workspaceId,
    ug,
    materialId,
    type: 'TRANSFER',
    quantityDelta: 0,
    idempotencyKeyHash: movementId.slice(4),
    reversesMovementId: null,
    note: 'Transferência interna',
    source: {
      kind: 'LOCATION_TRANSFER',
      actorUid,
      quantity: 5,
      from,
      to,
      fromBalanceId: await location.createWarehouseLocationBalanceId(workspaceId, materialId, from),
      toBalanceId: await location.createWarehouseLocationBalanceId(workspaceId, materialId, to),
    },
  };
  const validated = movement.validateWarehouseMovement(candidate);
  assert.equal(validated.ok, true);

  const aggregateBefore = {
    schemaVersion: movement.WAREHOUSE_BALANCE_SCHEMA_VERSION,
    workspaceId,
    ug,
    materialId,
    quantity: 100,
    revision: 8,
    lastMovementId: 'mov_' + 'f'.repeat(64),
  };
  const aggregateAfter = movement.applyWarehouseMovementToBalance(validated.data, aggregateBefore);
  assert.equal(aggregateAfter.quantity, 100);
  assert.equal(aggregateAfter.revision, 9);
});

test('origem igual ao destino e quantidade inválida são rejeitadas no contrato de transferência', async () => {
  const pos = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const movementId = await movement.createWarehouseMovementId(workspaceId, 'phase6:invalid');
  const balanceId = await location.createWarehouseLocationBalanceId(workspaceId, materialId, pos);
  const same = movement.validateWarehouseMovement({
    schemaVersion: movement.WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
    id: movementId,
    workspaceId,
    ug,
    materialId,
    type: 'TRANSFER',
    quantityDelta: 0,
    idempotencyKeyHash: movementId.slice(4),
    reversesMovementId: null,
    note: null,
    source: {
      kind: 'LOCATION_TRANSFER',
      actorUid,
      quantity: 0,
      from: pos,
      to: pos,
      fromBalanceId: balanceId,
      toBalanceId: balanceId,
    },
  });
  assert.equal(same.ok, false);
});

test('retry mantém identidade idempotente e não cria um segundo movimento lógico', async () => {
  const first = await movement.createWarehouseMovementId(workspaceId, 'phase6:transfer:retry-001');
  const replay = await movement.createWarehouseMovementId(workspaceId, 'phase6:transfer:retry-001');
  const other = await movement.createWarehouseMovementId(workspaceId, 'phase6:transfer:retry-002');
  assert.equal(first, replay);
  assert.notEqual(first, other);
});

test('projeção de localização rejeita quantidade negativa e escopo divergente', async () => {
  const pos = { kind: 'UNASSIGNED' };
  const id = await location.createWarehouseLocationBalanceId(workspaceId, materialId, pos);
  const result = location.validateWarehouseLocationBalance({
    schemaVersion: location.WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION,
    id,
    workspaceId: 'workspace-outro',
    ug,
    materialId,
    position: pos,
    quantity: -1,
    revision: 1,
    lastMovementId: 'mov_' + 'a'.repeat(64),
  }, { expectedWorkspaceId: workspaceId });
  assert.equal(result.ok, false);
});


test('depósito aceita tipo visual e porte com defaults retrocompatíveis', () => {
  const legacy = location.validateWarehouseDepot(sampleDepot());
  assert.equal(legacy.ok, true);
  assert.equal(legacy.data.visualType, 'STANDARD');
  assert.equal(legacy.data.sizeProfile, 'MEDIUM');

  const coldContainer = location.validateWarehouseDepot(sampleDepot({
    visualType: 'COLD_CONTAINER',
    sizeProfile: 'LARGE',
  }));
  assert.equal(coldContainer.ok, true);
  assert.equal(coldContainer.data.visualType, 'COLD_CONTAINER');
  assert.equal(coldContainer.data.sizeProfile, 'LARGE');

  assert.equal(location.validateWarehouseDepot(sampleDepot({ visualType: 'NAVIO' })).ok, false);
  assert.equal(location.validateWarehouseDepot(sampleDepot({ sizeProfile: 'GIGANTE' })).ok, false);
});
