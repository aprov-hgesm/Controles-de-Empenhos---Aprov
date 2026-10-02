#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(resolve(root, '.tmp-emprovex-labels-r1-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/labels.ts'),
    resolve(root, 'lib/warehouse/locationBarcode.ts'),
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
const locationBarcode = require(resolve(outDir, 'lib/warehouse/locationBarcode.js'));
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


test('identidade física é estável para depósito, local e subposição e independe de renomeação', () => {
  const child = subposition(1);
  const identities = [
    ['DEPOT', depot.id],
    ['LOCAL', local.id],
    ['SUBPOSITION', child.id],
  ];

  for (const [kind, entityId] of identities) {
    const code = locationBarcode.encodeWarehouseLocationBarcode({ kind, entityId });
    const decoded = locationBarcode.decodeWarehouseLocationBarcode(code);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.value.kind, kind);
    assert.equal(decoded.value.entityId, entityId);
    assert.match(code, /^EPX1[123][0-9]{39}$/);
  }

  const before = labels.buildLocationLabel(local, depot, [local]).physicalBarcode;
  const renamed = { ...local, name: 'Estante renomeada', code: 'EST-99' };
  const after = labels.buildLocationLabel(renamed, depot, [renamed]).physicalBarcode;
  assert.equal(before, after);
});

test('namespace de posição rejeita código comercial e payload malformado', () => {
  assert.deepEqual(
    locationBarcode.decodeWarehouseLocationBarcode('7891234567890'),
    { ok: false, error: 'NOT_LOCATION_CODE' }
  );
  assert.deepEqual(
    locationBarcode.decodeWarehouseLocationBarcode('EPX12INVALIDO'),
    { ok: false, error: 'MALFORMED_LOCATION_CODE' }
  );
  assert.equal(locationBarcode.isWarehouseLocationBarcode('7891234567890'), false);
});

test('IDs distintos não colidem e Code 128 compacta a cauda numérica', () => {
  const first = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: 'loc_' + '1'.repeat(32),
  });
  const second = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: 'loc_' + '2'.repeat(32),
  });
  assert.notEqual(first, second);

  const pattern = locationBarcode.buildWarehouseCode128Pattern(first);
  assert.ok(pattern.bars.length > 20);
  assert.ok(pattern.totalModules > 250);
  assert.ok(pattern.codewords.includes(99), 'Code C deve compactar a sequência decimal');
  assert.equal(pattern.codewords.at(-1), 106);
});

function resolverSource(overrides = {}) {
  const child = subposition(1);
  const depots = new Map([[depot.id, depot]]);
  const locations = new Map([
    [local.id, local],
    [child.id, child],
  ]);
  return {
    async getDepot(id) {
      return overrides.depot ?? depots.get(id) ?? null;
    },
    async getLocation(id) {
      if (overrides.locations && id in overrides.locations) {
        return overrides.locations[id];
      }
      return locations.get(id) ?? null;
    },
  };
}

test('resolver converte LOCAL e SUBPOSITION em WarehouseStockPosition', async () => {
  const localCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: local.id,
  });
  const localResult = await locationBarcode.resolveWarehouseStockPositionCode({
    code: localCode,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource());
  assert.equal(localResult.ok, true);
  assert.deepEqual(localResult.value.position, {
    kind: 'LOCATION',
    depotId: depot.id,
    locationId: local.id,
    subpositionId: null,
  });

  const child = subposition(1);
  const childCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'SUBPOSITION',
    entityId: child.id,
  });
  const childResult = await locationBarcode.resolveWarehouseStockPositionCode({
    code: childCode,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource());
  assert.equal(childResult.ok, true);
  assert.deepEqual(childResult.value.position, {
    kind: 'SUBPOSITION',
    depotId: depot.id,
    locationId: local.id,
    subpositionId: child.id,
  });
});

test('depósito resolve identidade física, mas falha fechado como posição de estoque', async () => {
  const code = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'DEPOT',
    entityId: depot.id,
  });
  const identity = await locationBarcode.resolveWarehousePhysicalIdentityCode({
    code,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource());
  assert.equal(identity.ok, true);
  assert.equal(identity.value.depot.id, depot.id);
  assert.equal(identity.value.position, null);

  const position = await locationBarcode.resolveWarehouseStockPositionCode({
    code,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource());
  assert.deepEqual(position, { ok: false, error: 'DEPOT_NOT_STOCK_POSITION' });
});

test('resolver recusa entidade inativa, escopo/UG divergentes e hierarquia inválida', async () => {
  const localCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: local.id,
  });
  const inactive = await locationBarcode.resolveWarehouseStockPositionCode({
    code: localCode,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource({
    locations: {
      [local.id]: { ...local, status: 'inactive' },
    },
  }));
  assert.deepEqual(inactive, { ok: false, error: 'ENTITY_INACTIVE' });

  const otherWorkspace = await locationBarcode.resolveWarehouseStockPositionCode({
    code: localCode,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource({
    locations: {
      [local.id]: { ...local, workspaceId: 'workspace-outro' },
    },
  }));
  assert.deepEqual(otherWorkspace, { ok: false, error: 'WORKSPACE_MISMATCH' });

  const otherUg = await locationBarcode.resolveWarehouseStockPositionCode({
    code: localCode,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource({
    locations: {
      [local.id]: { ...local, ug: '999999' },
    },
  }));
  assert.deepEqual(otherUg, { ok: false, error: 'UG_MISMATCH' });

  const child = subposition(1);
  const childCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'SUBPOSITION',
    entityId: child.id,
  });
  const invalidHierarchy = await locationBarcode.resolveWarehouseStockPositionCode({
    code: childCode,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource({
    locations: {
      [child.id]: { ...child, parentLocationId: 'loc_' + 'f'.repeat(32) },
      ['loc_' + 'f'.repeat(32)]: { ...local, id: 'loc_' + 'f'.repeat(32), depotId: 'dep_' + 'e'.repeat(32) },
    },
  }));
  assert.deepEqual(invalidHierarchy, { ok: false, error: 'HIERARCHY_INVALID' });
});

test('resolver recusa entidade divergente e round-trip encode → resolve preserva identidade', async () => {
  const child = subposition(1);
  const forgedKindCode = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: 'loc_' + 'c'.repeat(32),
  });
  const forgedLocal = {
    ...child,
    id: 'sub_' + 'c'.repeat(32),
  };
  const kindMismatch = await locationBarcode.resolveWarehouseStockPositionCode({
    code: forgedKindCode,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, {
    async getDepot(id) {
      return id === depot.id ? depot : null;
    },
    async getLocation() {
      return forgedLocal;
    },
  });
  assert.equal(kindMismatch.ok, false);
  assert.equal(kindMismatch.error, 'ENTITY_INVALID');

  const code = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'SUBPOSITION',
    entityId: child.id,
  });
  const result = await locationBarcode.resolveWarehouseStockPositionCode({
    code,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, resolverSource());
  assert.equal(result.ok, true);
  assert.equal(result.value.identity.code, code);
  assert.equal(result.value.identity.entityId, child.id);
});

test('builder inclui barcode físico em todas as etiquetas e ignora depósito inativo', () => {
  const child = subposition(1);
  const items = labels.buildWarehouseLabelsForScope({
    depot,
    locations: [local, child],
    scope: 'DEPOT_FULL',
  });
  assert.equal(items.length, 3);
  assert.ok(items.every((item) => /^EPX1[123][0-9]{39}$/.test(item.physicalBarcode)));

  const inactiveDepot = labels.buildWarehouseLabelsForScope({
    depot: { ...depot, status: 'inactive' },
    locations: [local, child],
    scope: 'DEPOT_FULL',
  });
  assert.deepEqual(inactiveDepot, []);
});
