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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-position-check-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobilePositionCheckModel.ts'),
    resolve(root, 'lib/warehouse/mobilePhysicalQueryModel.ts'),
    resolve(root, 'lib/warehouse/mobileIntakeAllocation.ts'),
    resolve(root, 'lib/warehouse/mobileLocationScan.ts'),
    resolve(root, 'lib/warehouse/locationBarcode.ts'),
    resolve(root, 'lib/warehouse/mobileScanner.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/lot.ts'),
    resolve(root, 'lib/warehouse/barcode.ts'),
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
    '--lib',
    'ES2020,DOM',
  ],
  { cwd: root, stdio: 'pipe' }
);

const require = createRequire(import.meta.url);
const check = require(resolve(outDir, 'warehouse/mobilePositionCheckModel.js'));
const allocation = require(resolve(outDir, 'warehouse/mobileIntakeAllocation.js'));
const locationScan = require(resolve(outDir, 'warehouse/mobileLocationScan.js'));
const locationBarcode = require(resolve(outDir, 'warehouse/locationBarcode.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const workspaceId = 'hgesm';
const ug = '160416';
const materialId = 'mat_' + 'a'.repeat(32);
const depotId = 'dep_' + 'b'.repeat(32);
const locationAId = 'loc_' + 'c'.repeat(32);
const locationBId = 'loc_' + 'd'.repeat(32);
const parentId = 'loc_' + 'e'.repeat(32);
const subpositionId = 'sub_' + 'f'.repeat(32);

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
const positionSub = {
  kind: 'SUBPOSITION',
  depotId,
  locationId: parentId,
  subpositionId,
};

const material = {
  schemaVersion: 'warehouse_material_v1',
  id: materialId,
  workspaceId,
  ug,
  description: 'Material de conferência',
  aliases: [],
  unit: { code: 'unit', label: null },
  status: 'active',
  conversions: [],
};

function balance(idDigit, position, quantity, overrides = {}) {
  return {
    schemaVersion: 'warehouse_location_balance_v1',
    id: 'locbal_' + idDigit.repeat(64),
    workspaceId,
    ug,
    materialId,
    position,
    quantity,
    revision: 1,
    lastMovementId: 'mov_' + '1'.repeat(64),
    ...overrides,
  };
}

function item(position, quantity) {
  return {
    material,
    balance: balance('2', position, quantity),
    lots: [],
  };
}

test('CORRETO: material com saldo positivo na LOCATION lida', () => {
  const result = check.buildWarehouseMobilePositionCheckDecision({
    workspaceId,
    ug,
    selectedPosition: positionA,
    materialId,
    physicalItems: [item(positionA, 7)],
    materialBalances: [],
  });

  assert.equal(result.status, 'CORRECT');
  assert.equal(result.current.balance.quantity, 7);
  assert.deepEqual(result.alternatives, []);
});

test('CORRETO: SUBPOSITION usa a mesma identidade física oficial', () => {
  const result = check.buildWarehouseMobilePositionCheckDecision({
    workspaceId,
    ug,
    selectedPosition: positionSub,
    materialId,
    physicalItems: [item(positionSub, 3)],
    materialBalances: [],
  });

  assert.equal(result.status, 'CORRECT');
  assert.equal(result.current.balance.position.kind, 'SUBPOSITION');
});

test('INCORRETO: material sem saldo físico não inventa posição', () => {
  const result = check.buildWarehouseMobilePositionCheckDecision({
    workspaceId,
    ug,
    selectedPosition: positionA,
    materialId,
    physicalItems: [],
    materialBalances: [],
  });

  assert.deepEqual(result, {
    status: 'INCORRECT',
    current: null,
    alternatives: [],
  });
});

test('INCORRETO: retorna múltiplas posições físicas oficiais quando disponíveis', () => {
  const result = check.buildWarehouseMobilePositionCheckDecision({
    workspaceId,
    ug,
    selectedPosition: positionA,
    materialId,
    physicalItems: [],
    materialBalances: [
      balance('3', positionB, 4),
      balance('4', positionSub, 2),
      balance('5', { kind: 'UNASSIGNED' }, 8),
      balance('6', positionA, 0),
    ],
  });

  assert.equal(result.status, 'INCORRECT');
  assert.equal(result.alternatives.length, 2);
  assert.deepEqual(
    new Set(result.alternatives.map((entry) => entry.position.kind)),
    new Set(['LOCATION', 'SUBPOSITION'])
  );
});

test('fail-closed: workspace e UG divergentes são recusados', () => {
  assert.throws(
    () => check.buildWarehouseMobilePositionCheckDecision({
      workspaceId,
      ug,
      selectedPosition: positionA,
      materialId,
      physicalItems: [],
      materialBalances: [
        balance('7', positionB, 1, { workspaceId: 'outro-workspace' }),
      ],
    }),
    /WORKSPACE_MISMATCH/
  );

  assert.throws(
    () => check.buildWarehouseMobilePositionCheckDecision({
      workspaceId,
      ug,
      selectedPosition: positionA,
      materialId,
      physicalItems: [],
      materialBalances: [
        balance('8', positionB, 1, { ug: '999999' }),
      ],
    }),
    /UG_MISMATCH/
  );
});

test('fail-closed: mudança concorrente na posição lida não vira INCORRETO falso', () => {
  assert.throws(
    () => check.buildWarehouseMobilePositionCheckDecision({
      workspaceId,
      ug,
      selectedPosition: positionA,
      materialId,
      physicalItems: [],
      materialBalances: [balance('9', positionA, 1)],
    }),
    /CONCURRENT_POSITION_CHANGE/
  );
});

test('fail-closed: UNASSIGNED não pode ser posição da conferência', () => {
  assert.throws(
    () => check.buildWarehouseMobilePositionCheckDecision({
      workspaceId,
      ug,
      selectedPosition: { kind: 'UNASSIGNED' },
      materialId,
      physicalItems: [],
      materialBalances: [],
    }),
    /PHYSICAL_POSITION_REQUIRED/
  );
});

const depot = {
  schemaVersion: 'warehouse_depot_v1',
  id: depotId,
  workspaceId,
  ug,
  code: 'DEP-01',
  name: 'Depósito 01',
  description: null,
  visualType: 'STANDARD',
  sizeProfile: 'MEDIUM',
  status: 'active',
  createdBy: 'tester',
  updatedBy: 'tester',
};

const localA = {
  schemaVersion: 'warehouse_location_v1',
  id: locationAId,
  workspaceId,
  ug,
  depotId,
  kind: 'LOCAL',
  parentLocationId: null,
  code: 'EST-01',
  name: 'Estante 01',
  description: null,
  status: 'active',
  createdBy: 'tester',
  updatedBy: 'tester',
};

const parent = {
  ...localA,
  id: parentId,
  code: 'EST-02',
  name: 'Estante 02',
};

const child = {
  schemaVersion: 'warehouse_location_v1',
  id: subpositionId,
  workspaceId,
  ug,
  depotId,
  kind: 'SUBPOSITION',
  parentLocationId: parentId,
  code: 'PRAT-01',
  name: 'Prateleira 01',
  description: null,
  status: 'active',
  createdBy: 'tester',
  updatedBy: 'tester',
};

function source(options = {}) {
  const locations = options.locations || {
    [localA.id]: localA,
    [parent.id]: parent,
    [child.id]: child,
  };
  const depotValue = options.depot === undefined ? depot : options.depot;
  return {
    async getDepot(id) {
      return depotValue && id === depotValue.id ? depotValue : null;
    },
    async getLocation(id) {
      return locations[id] || null;
    },
  };
}

test('resolver da conferência recusa DEPOT, posição inexistente e inativa', async () => {
  const depotCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'DEPOT',
    entityId: depot.id,
  });
  assert.deepEqual(
    await locationBarcode.resolveWarehouseStockPositionCode(
      { code: depotCode, workspaceId, ug },
      source()
    ),
    { ok: false, error: 'DEPOT_NOT_STOCK_POSITION' }
  );

  const missingCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: locationBId,
  });
  assert.deepEqual(
    await locationBarcode.resolveWarehouseStockPositionCode(
      { code: missingCode, workspaceId, ug },
      source()
    ),
    { ok: false, error: 'ENTITY_NOT_FOUND' }
  );

  const localCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: localA.id,
  });
  assert.deepEqual(
    await locationBarcode.resolveWarehouseStockPositionCode(
      { code: localCode, workspaceId, ug },
      source({ locations: { [localA.id]: { ...localA, status: 'inactive' } } })
    ),
    { ok: false, error: 'ENTITY_INACTIVE' }
  );
});

test('resolver da conferência recusa workspace, UG e hierarquia divergentes', async () => {
  const localCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: localA.id,
  });

  assert.deepEqual(
    await locationBarcode.resolveWarehouseStockPositionCode(
      { code: localCode, workspaceId, ug },
      source({ locations: { [localA.id]: { ...localA, workspaceId: 'outro-workspace' } } })
    ),
    { ok: false, error: 'WORKSPACE_MISMATCH' }
  );

  assert.deepEqual(
    await locationBarcode.resolveWarehouseStockPositionCode(
      { code: localCode, workspaceId, ug },
      source({ locations: { [localA.id]: { ...localA, ug: '999999' } } })
    ),
    { ok: false, error: 'UG_MISMATCH' }
  );

  const childCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'SUBPOSITION',
    entityId: child.id,
  });
  const wrongParentId = 'loc_' + '9'.repeat(32);
  assert.deepEqual(
    await locationBarcode.resolveWarehouseStockPositionCode(
      { code: childCode, workspaceId, ug },
      source({
        locations: {
          [child.id]: { ...child, parentLocationId: wrongParentId },
          [wrongParentId]: { ...parent, id: wrongParentId, depotId: 'dep_' + '8'.repeat(32) },
        },
      })
    ),
    { ok: false, error: 'HIERARCHY_INVALID' }
  );
});

test('classificadores recusam barcode inválido e EPX1 malformado', () => {
  assert.equal(allocation.classifyWarehouseMobileProductScan('   '), 'UNKNOWN');
  assert.equal(allocation.classifyWarehouseMobileProductScan('EPX12INVALIDO'), 'UNKNOWN');
  assert.equal(locationScan.classifyWarehouseMobileLocationScan('EPX12INVALIDO'), 'UNKNOWN');

  const localCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: localA.id,
  });
  assert.equal(allocation.classifyWarehouseMobileProductScan(localCode), 'LOCATION');
  assert.equal(locationScan.classifyWarehouseMobileLocationScan(localCode), 'LOCATION');
});
