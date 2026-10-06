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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-physical-query-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobilePhysicalQueryModel.ts'),
    resolve(root, 'lib/warehouse/locationBarcode.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/lot.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
    '--rootDir',
    resolve(root, 'lib'),
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
const model = require(resolve(outDir, 'warehouse/mobilePhysicalQueryModel.js'));
const locationBarcode = require(resolve(outDir, 'warehouse/locationBarcode.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const workspaceId = 'hgesm';
const ug = '160416';
const depotId = 'dep_' + '1'.repeat(32);
const locationId = 'loc_' + '2'.repeat(32);
const subpositionId = 'sub_' + '3'.repeat(32);
const otherLocationId = 'loc_' + '4'.repeat(32);
const position = {
  kind: 'LOCATION',
  depotId,
  locationId,
  subpositionId: null,
};
const subposition = {
  kind: 'SUBPOSITION',
  depotId,
  locationId,
  subpositionId,
};

function material(idDigit, description) {
  return {
    schemaVersion: 'warehouse_material_v1',
    id: 'mat_' + idDigit.repeat(32),
    workspaceId,
    ug,
    description,
    aliases: [],
    unit: { code: 'unit', label: null },
    status: 'active',
    conversions: [],
  };
}

function balance(materialId, quantity, targetPosition = position) {
  return {
    schemaVersion: 'warehouse_location_balance_v1',
    id: 'locbal_' + 'a'.repeat(64),
    workspaceId,
    ug,
    materialId,
    position: targetPosition,
    quantity,
    revision: 1,
    lastMovementId: 'mov_' + 'b'.repeat(64),
  };
}

function lot(materialId, options = {}) {
  return {
    schemaVersion: 'warehouse_lot_v1',
    id: 'lot_' + (options.idDigit || 'c').repeat(32),
    workspaceId,
    ug,
    materialId,
    code: options.code || 'L-01',
    expiresOn: options.expiresOn ?? '2027-12-31',
    quantity: options.quantity ?? 2,
    position: options.position || position,
    origin: {
      kind: 'LEGACY',
      movementId: null,
      invoiceRecordKey: null,
      invoiceId: null,
      supplier: null,
      supplierCnpj: null,
    },
    status: options.status || 'active',
    createdBy: 'tester',
    updatedBy: 'tester',
  };
}

test('planeja query por LOCAL e SUBPOSITION sem aceitar UNASSIGNED', () => {
  assert.deepEqual(model.warehouseMobilePhysicalQueryPlan(position), {
    field: 'position.locationId',
    value: locationId,
    kind: 'LOCATION',
  });
  assert.deepEqual(model.warehouseMobilePhysicalQueryPlan(subposition), {
    field: 'position.subpositionId',
    value: subpositionId,
    kind: 'SUBPOSITION',
  });
  assert.throws(
    () => model.warehouseMobilePhysicalQueryPlan({ kind: 'UNASSIGNED' }),
    /POSITION_REQUIRED/
  );
});


test('resolver canônico recusa posição inexistente', async () => {
  const code = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: locationId,
  });
  const resolved = await locationBarcode.resolveWarehouseStockPositionCode(
    { code, workspaceId, ug },
    {
      async getDepot() {
        return null;
      },
      async getLocation() {
        return null;
      },
    }
  );

  assert.deepEqual(resolved, { ok: false, error: 'ENTITY_NOT_FOUND' });
});

test('projeção de leitura ignora metadado legado sem alterar campos canônicos', () => {
  const coffee = material('1', 'Café');
  const canonical = balance(coffee.id, 8);
  const projected = model.warehouseMobileCanonicalBalanceReadInput(
    canonical.id,
    {
      ...canonical,
      legacyTimestamp: '2026-01-01T00:00:00Z',
      legacySource: 'migration-v0',
    }
  );

  assert.deepEqual(projected, canonical);
  assert.equal('legacyTimestamp' in projected, false);
  assert.equal('legacySource' in projected, false);
});

test('projeção de material ignora metadado legado e normaliza listas antigas ausentes', () => {
  const coffee = material('1', 'Café');
  const projected = model.warehouseMobileCanonicalMaterialReadInput(
    coffee.id,
    {
      ...coffee,
      legacySource: 'migration-v0',
      unit: { ...coffee.unit, legacyLabel: 'UND' },
      conversions: [
        {
          presentation: { code: 'box', label: 'Caixa', legacy: true },
          factorToBaseUnit: 12,
          legacyConversion: true,
        },
      ],
    }
  );

  assert.equal(projected.legacySource, undefined);
  assert.deepEqual(projected.unit, coffee.unit);
  assert.deepEqual(projected.conversions, [
    {
      presentation: { code: 'box', label: 'Caixa' },
      factorToBaseUnit: 12,
    },
  ]);

  const oldMaterial = model.warehouseMobileCanonicalMaterialReadInput(
    coffee.id,
    {
      schemaVersion: coffee.schemaVersion,
      workspaceId: coffee.workspaceId,
      ug: coffee.ug,
      description: coffee.description,
      unit: coffee.unit,
      status: coffee.status,
    }
  );
  assert.deepEqual(oldMaterial.aliases, []);
  assert.deepEqual(oldMaterial.conversions, []);
});

test('projeção de lote ignora metadado legado na raiz e na origem', () => {
  const coffee = material('1', 'Café');
  const canonical = lot(coffee.id);
  const projected = model.warehouseMobileCanonicalLotReadInput(
    canonical.id,
    {
      ...canonical,
      legacyTimestamp: '2026-01-01T00:00:00Z',
      origin: { ...canonical.origin, legacyOrigin: 'old-import' },
    }
  );

  assert.equal(projected.legacyTimestamp, undefined);
  assert.deepEqual(projected.origin, canonical.origin);
  assert.deepEqual(projected, canonical);
});

test('posição vazia produz resultado vazio sem inventar material', () => {
  const rows = model.buildWarehouseMobilePhysicalQueryItems({
    workspaceId,
    ug,
    position,
    balances: [],
    materials: [],
    lots: [],
  });
  assert.deepEqual(rows, []);
});

test('um material preserva quantidade, unidade canônica, lote e validade', () => {
  const coffee = material('1', 'Café');
  const rows = model.buildWarehouseMobilePhysicalQueryItems({
    workspaceId,
    ug,
    position,
    balances: [balance(coffee.id, 8)],
    materials: [coffee],
    lots: [lot(coffee.id, { quantity: 3, expiresOn: '2027-03-10' })],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].material.description, 'Café');
  assert.equal(rows[0].balance.quantity, 8);
  assert.equal(rows[0].material.unit.code, 'unit');
  assert.equal(rows[0].lots.length, 1);
  assert.equal(rows[0].lots[0].expiresOn, '2027-03-10');
});

test('vários materiais são apresentados em ordem estável', () => {
  const rice = material('2', 'Arroz');
  const coffee = material('1', 'Café');
  const rows = model.buildWarehouseMobilePhysicalQueryItems({
    workspaceId,
    ug,
    position,
    balances: [balance(coffee.id, 2), balance(rice.id, 5)],
    materials: [coffee, rice],
    lots: [],
  });

  assert.deepEqual(
    rows.map((row) => row.material.description),
    ['Arroz', 'Café']
  );
});

test('ignora lote inativo ou de outra posição', () => {
  const coffee = material('1', 'Café');
  const rows = model.buildWarehouseMobilePhysicalQueryItems({
    workspaceId,
    ug,
    position,
    balances: [balance(coffee.id, 8)],
    materials: [coffee],
    lots: [
      lot(coffee.id, { status: 'inactive', idDigit: 'c' }),
      lot(coffee.id, {
        position: {
          kind: 'LOCATION',
          depotId,
          locationId: otherLocationId,
          subpositionId: null,
        },
        idDigit: 'd',
      }),
    ],
  });

  assert.equal(rows[0].lots.length, 0);
});

test('não apresenta saldo de posição diferente', () => {
  const coffee = material('1', 'Café');
  const rows = model.buildWarehouseMobilePhysicalQueryItems({
    workspaceId,
    ug,
    position,
    balances: [
      balance(coffee.id, 8, {
        kind: 'LOCATION',
        depotId,
        locationId: otherLocationId,
        subpositionId: null,
      }),
    ],
    materials: [coffee],
    lots: [],
  });

  assert.deepEqual(rows, []);
});

test('falha fechado em workspace divergente', () => {
  const coffee = { ...material('1', 'Café'), workspaceId: 'outro' };
  assert.throws(
    () => model.buildWarehouseMobilePhysicalQueryItems({
      workspaceId,
      ug,
      position,
      balances: [balance(coffee.id, 8)],
      materials: [coffee],
      lots: [],
    }),
    /MATERIAL_WORKSPACE_MISMATCH/
  );
});

test('falha fechado em UG divergente', () => {
  const coffee = { ...material('1', 'Café'), ug: '999999' };
  assert.throws(
    () => model.buildWarehouseMobilePhysicalQueryItems({
      workspaceId,
      ug,
      position,
      balances: [balance(coffee.id, 8)],
      materials: [coffee],
      lots: [],
    }),
    /MATERIAL_UG_MISMATCH/
  );
});

test('falha fechado se saldo positivo aponta para material canônico ausente', () => {
  const coffee = material('1', 'Café');
  assert.throws(
    () => model.buildWarehouseMobilePhysicalQueryItems({
      workspaceId,
      ug,
      position,
      balances: [balance(coffee.id, 8)],
      materials: [],
      lots: [],
    }),
    /MATERIAL_NOT_FOUND/
  );
});

test('falha fechado em saldo duplicado do mesmo material na mesma posição', () => {
  const coffee = material('1', 'Café');
  assert.throws(
    () => model.buildWarehouseMobilePhysicalQueryItems({
      workspaceId,
      ug,
      position,
      balances: [balance(coffee.id, 8), balance(coffee.id, 2)],
      materials: [coffee],
      lots: [],
    }),
    /DUPLICATE_BALANCE/
  );
});
