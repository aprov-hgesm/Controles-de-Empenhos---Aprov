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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-labels-r1-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/labels.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
    resolve(root, 'features/warehouse/pdf/warehouseLabelsPdf.ts'),
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
const labels = require(resolve(outDir, 'lib/warehouse/labels.js'));
const pdf = require(resolve(outDir, 'features/warehouse/pdf/warehouseLabelsPdf.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const depot = {
  schemaVersion: 'warehouse_depot_v1',
  id: 'dep_' + 'a'.repeat(32),
  workspaceId: 'hgesm-aprov',
  ug: '160416',
  code: 'DEP-01',
  name: 'Gêneros Secos',
  description: null,
  visualType: 'STANDARD',
  sizeProfile: 'MEDIUM',
  status: 'active',
  createdBy: 'founder',
  updatedBy: 'founder',
};

const local = {
  schemaVersion: 'warehouse_location_v1',
  id: 'loc_' + 'b'.repeat(32),
  workspaceId: 'hgesm-aprov',
  ug: '160416',
  depotId: depot.id,
  kind: 'LOCAL',
  parentLocationId: null,
  code: 'EST-01',
  name: 'Estante 01',
  description: null,
  status: 'active',
  createdBy: 'founder',
  updatedBy: 'founder',
};

function subposition(index) {
  return {
    schemaVersion: 'warehouse_location_v1',
    id: 'sub_' + index.toString(16).padStart(32, '0'),
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    depotId: depot.id,
    kind: 'SUBPOSITION',
    parentLocationId: local.id,
    code: 'PRAT-' + String(index).padStart(2, '0'),
    name: 'Prateleira ' + String(index).padStart(2, '0'),
    description: null,
    status: 'active',
    createdBy: 'founder',
    updatedBy: 'founder',
  };
}

test('builder preserva hierarquia Depósito → Local → Subposição', () => {
  const child = subposition(1);
  const result = labels.buildWarehouseLabelsForScope({
    depot,
    locations: [local, child],
    selectedLocationId: local.id,
    scope: 'DEPOT_FULL',
  });

  assert.equal(result.length, 3);
  assert.deepEqual(result[0].hierarchy, ['Gêneros Secos']);
  assert.deepEqual(result[1].hierarchy, ['Gêneros Secos', 'Estante 01']);
  assert.deepEqual(result[2].hierarchy, ['Gêneros Secos', 'Estante 01', 'Prateleira 01']);
  assert.equal(result[2].kind, 'SUBPOSITION');
});

test('escopo de subposições retorna somente as filhas ativas do Local', () => {
  const active = subposition(1);
  const inactive = { ...subposition(2), status: 'inactive' };
  const result = labels.buildWarehouseLabelsForScope({
    depot,
    locations: [local, active, inactive],
    selectedLocationId: local.id,
    scope: 'LOCATION_SUBPOSITIONS',
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].code, 'PRAT-01');
});

test('paginação respeita 21, 12 e 8 etiquetas por A4', () => {
  const items = Array.from({ length: 25 }, (_, index) => ({ index }));
  assert.deepEqual(labels.paginateWarehouseLabels(items, 'COMPACT').map((page) => page.length), [21, 4]);
  assert.deepEqual(labels.paginateWarehouseLabels(items, 'MEDIUM').map((page) => page.length), [12, 12, 1]);
  assert.deepEqual(labels.paginateWarehouseLabels(items, 'LARGE').map((page) => page.length), [8, 8, 8, 1]);
});

test('gerador produz PDF A4 não vazio para impressão monocromática', async () => {
  const items = labels.buildWarehouseLabelsForScope({
    depot,
    locations: [local, ...Array.from({ length: 5 }, (_, index) => subposition(index + 1))],
    selectedLocationId: local.id,
    scope: 'DEPOT_FULL',
  });

  const blob = pdf.createWarehouseLabelsPdf(items, {
    preset: 'MEDIUM',
    includeUg: true,
    includeHierarchy: true,
  });

  assert.equal(blob.type, 'application/pdf');
  assert.ok(blob.size > 2000);
});
