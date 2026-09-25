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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-phase9-locator-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/depotLocator.ts'),
    resolve(root, 'lib/warehouse/layout.ts'),
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
const locator = require(resolve(outDir, 'warehouse/depotLocator.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const MATERIAL = 'mat_' + 'a'.repeat(32);
const OTHER_MATERIAL = 'mat_' + 'b'.repeat(32);
const DEPOT_A = 'dep_' + '1'.repeat(32);
const DEPOT_B = 'dep_' + '2'.repeat(32);
const LOC_A = 'loc_' + '3'.repeat(32);
const LOC_B = 'loc_' + '4'.repeat(32);
const LOC_C = 'loc_' + '5'.repeat(32);

function balance(id, materialId, quantity, position) {
  return {
    schemaVersion: 'warehouse_location_balance_v1',
    id: 'locbal_' + id.repeat(64),
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    materialId,
    position,
    quantity,
    revision: 1,
    lastMovementId: 'mov_' + 'f'.repeat(64),
  };
}

test('filtra saldo positivo do material e separa UNASSIGNED', () => {
  const result = locator.deriveWarehouseMaterialPositions([
    balance('1', MATERIAL, 25, { kind: 'UNASSIGNED' }),
    balance('2', MATERIAL, 10, { kind: 'LOCATION', depotId: DEPOT_A, locationId: LOC_A, subpositionId: null }),
    balance('3', MATERIAL, 0, { kind: 'LOCATION', depotId: DEPOT_A, locationId: LOC_B, subpositionId: null }),
    balance('4', OTHER_MATERIAL, 99, { kind: 'LOCATION', depotId: DEPOT_A, locationId: LOC_C, subpositionId: null }),
  ], MATERIAL, DEPOT_A);

  assert.equal(result.positiveBalances.length, 2);
  assert.equal(result.unassignedQuantity, 25);
  assert.equal(result.currentDepotBalances.length, 1);
  assert.equal(result.totalPositiveQuantity, 35);
});

test('destaca somente posições do depósito atual e preserva as demais no resumo', () => {
  const result = locator.deriveWarehouseMaterialPositions([
    balance('1', MATERIAL, 20, { kind: 'LOCATION', depotId: DEPOT_A, locationId: LOC_A, subpositionId: null }),
    balance('2', MATERIAL, 15, { kind: 'LOCATION', depotId: DEPOT_A, locationId: LOC_B, subpositionId: null }),
    balance('3', MATERIAL, 30, { kind: 'LOCATION', depotId: DEPOT_B, locationId: LOC_C, subpositionId: null }),
  ], MATERIAL, DEPOT_A);

  assert.deepEqual(
    result.currentDepotBalances.map((item) => item.position.depotId),
    [DEPOT_A, DEPOT_A]
  );
  assert.equal(result.otherDepotBalances.length, 1);
  assert.equal(result.totalPositiveQuantity, 65);
});

test('material sem saldo positivo não produz destaque', () => {
  const result = locator.deriveWarehouseMaterialPositions([
    balance('1', MATERIAL, 0, { kind: 'UNASSIGNED' }),
  ], MATERIAL, DEPOT_A);

  assert.equal(result.positiveBalances.length, 0);
  assert.equal(result.currentDepotBalances.length, 0);
  assert.equal(result.unassignedQuantity, 0);
  assert.equal(result.totalPositiveQuantity, 0);
});

test('cobertura visual considera somente objetos vinculados a warehouseLocationId', () => {
  const ids = locator.representedWarehouseLocationIds([
    {
      id: 'obj_' + '1'.repeat(32),
      kind: 'SHELF',
      label: 'Estante A',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 0,
      layer: 1,
      elevation: 1,
      visualVariant: 'solid',
      warehouseLocationId: LOC_A,
    },
    {
      id: 'obj_' + '2'.repeat(32),
      kind: 'WALL',
      label: 'Parede',
      x: 0,
      y: 60,
      width: 100,
      height: 20,
      rotation: 0,
      layer: 1,
      elevation: 0,
      visualVariant: 'outline',
      warehouseLocationId: null,
    },
  ]);

  assert.deepEqual([...ids], [LOC_A]);
});


test('subposição do depósito atual permanece destacável como posição logística real', () => {
  const subposition = 'sub_' + '6'.repeat(32);
  const result = locator.deriveWarehouseMaterialPositions([
    balance('5', MATERIAL, 7, {
      kind: 'SUBPOSITION',
      depotId: DEPOT_A,
      locationId: LOC_A,
      subpositionId: subposition,
    }),
  ], MATERIAL, DEPOT_A);

  assert.equal(result.currentDepotBalances.length, 1);
  assert.equal(result.currentDepotBalances[0].position.kind, 'SUBPOSITION');
  assert.equal(result.totalPositiveQuantity, 7);
});

test('quantidades negativas e material diferente não entram na projeção de localização', () => {
  const result = locator.deriveWarehouseMaterialPositions([
    balance('6', MATERIAL, -3, { kind: 'LOCATION', depotId: DEPOT_A, locationId: LOC_A, subpositionId: null }),
    balance('7', OTHER_MATERIAL, 40, { kind: 'LOCATION', depotId: DEPOT_A, locationId: LOC_B, subpositionId: null }),
  ], MATERIAL, DEPOT_A);

  assert.equal(result.positiveBalances.length, 0);
  assert.equal(result.currentDepotBalances.length, 0);
  assert.equal(result.totalPositiveQuantity, 0);
});

test('IDs visuais representados são únicos mesmo quando a entrada contém repetição', () => {
  const template = {
    kind: 'SHELF',
    label: 'Estante',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    layer: 1,
    elevation: 1,
    visualVariant: 'solid',
    warehouseLocationId: LOC_A,
  };
  const ids = locator.representedWarehouseLocationIds([
    { ...template, id: 'obj_' + '7'.repeat(32) },
    { ...template, id: 'obj_' + '8'.repeat(32) },
  ]);

  assert.deepEqual([...ids], [LOC_A]);
});
