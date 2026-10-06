#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

test('paginação fixa a etiqueta compacta em 140 × 35 mm e mantém 8 por A4', () => {
  const items = Array.from({ length: 25 }, (_, index) => ({ index }));
  const compact = labels.WAREHOUSE_LABEL_PRESETS.COMPACT;

  assert.equal(compact.columns, 1);
  assert.equal(compact.rows, 8);
  assert.equal(compact.widthMm, 140);
  assert.equal(compact.heightMm, 35);
  assert.equal(compact.gapMm, 0.5);
  assert.equal(compact.marginMm, 6.75);

  const compactCellHeight =
    (297 - compact.marginMm * 2 - compact.gapMm * (compact.rows - 1))
    / compact.rows;
  assert.equal(compactCellHeight, 35);
  assert.match(compact.description, /14 × 3,5 cm/);

  assert.deepEqual(labels.paginateWarehouseLabels(items, 'COMPACT').map((page) => page.length), [8, 8, 8, 1]);
  assert.deepEqual(labels.paginateWarehouseLabels(items, 'MEDIUM').map((page) => page.length), [12, 12, 1]);
  assert.deepEqual(labels.paginateWarehouseLabels(items, 'LARGE').map((page) => page.length), [8, 8, 8, 1]);
});

test('layout compacto preserva identificação à esquerda e Code 128 dominante à direita', () => {
  const source = readFileSync(
    resolve(root, 'features/warehouse/pdf/warehouseLabelsPdf.ts'),
    'utf8'
  );

  assert.match(source, /function drawCompactShelfLabel/);
  assert.match(source, /CENTRAL DE DEPÓSITOS/);
  assert.match(source, /width \* 0\.43/);
  assert.match(source, /ESTRUTURA FÍSICA/);
  assert.match(source, /item\.workspaceId\.toUpperCase\(\)/);
  assert.match(source, /22\.5,/);
  assert.match(source, /5\.6,/);
});

test('preset compacto é padrão da UI e a prévia representa o layout lateral', () => {
  const source = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseLabelsR1.tsx'),
    'utf8'
  );

  assert.match(
    source,
    /useState<WarehouseLabelSheetPreset>\('COMPACT'\)/,
    'Tela de etiquetas deve iniciar no formato 140 × 35 mm'
  );
  assert.match(source, /grid-cols-\[43%_57%\]/);
  assert.match(source, /CENTRAL DE DEPÓSITOS/);
  assert.match(source, /previewLabel\?\.physicalBarcode/);
});

test('layout médio reserva uma faixa exclusiva para o Code 128', () => {
  const source = readFileSync(
    resolve(root, 'features/warehouse/pdf/warehouseLabelsPdf.ts'),
    'utf8'
  );

  assert.match(
    source,
    /const barcodeHeight = compact \? 10\.2 : large \? 15\.5 : 7\.8/,
    'Médio deve manter o barcode abaixo da hierarquia, sem sobreposição'
  );
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


test('EPX1/EPX2 permanecem compatíveis e o novo físico numérico tem 13 dígitos', () => {
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

  const numeric = labels.buildLocationLabel(local, depot, [local]).physicalBarcode;
  assert.equal(numeric, '9812001201000');
  assert.equal(numeric.length, 13);
  assert.match(numeric, /^\d{13}$/);
  assert.equal(locationBarcode.isWarehouseLocationBarcode(numeric), true);

  const legacyCompact = locationBarcode.encodeWarehouseCompactLocationBarcode({
    kind: 'LOCAL',
    depotCode: depot.code,
    locationCode: local.code,
  });
  assert.equal(legacyCompact, 'EPX2L:DEP-01:EST-01');
  assert.equal(locationBarcode.isWarehouseLocationBarcode(legacyCompact), true);

  const renamed = { ...local, name: 'Estante renomeada', code: 'EST-99' };
  const after = labels.buildLocationLabel(renamed, depot, [renamed]).physicalBarcode;
  assert.equal(after, '9812001299000');
  assert.notEqual(numeric, after);
});

test('namespace de posição rejeita código comercial comum e payload físico malformado', () => {
  assert.deepEqual(
    locationBarcode.decodeWarehouseLocationBarcode('7891234567890'),
    { ok: false, error: 'NOT_LOCATION_CODE' }
  );
  assert.deepEqual(
    locationBarcode.decodeWarehouseLocationBarcode('EPX12INVALIDO'),
    { ok: false, error: 'MALFORMED_LOCATION_CODE' }
  );
  assert.equal(locationBarcode.isWarehouseLocationBarcode('7891234567890'), false);
  assert.equal(locationBarcode.isWarehouseLocationBarcode('9812001201000'), true);
  assert.equal(locationBarcode.isWarehouseLocationBarcode('9819001201000'), false);
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

test('resolver numérico de 13 dígitos encontra LOCAL sem migração de IDs', async () => {
  const code = locationBarcode.encodeWarehouseNumericLocationBarcode({
    kind: 'LOCAL',
    depotCode: depot.code,
    locationCode: local.code,
  });
  assert.equal(code, '9812001201000');

  const result = await locationBarcode.resolveWarehouseStockPositionCode({
    code,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, {
    ...resolverSource(),
    async getDepotByCode(depotCode) {
      return ['DEP-001', 'DEP-01'].includes(depotCode) ? depot : null;
    },
    async getLocationByCode(input) {
      if (
        input.depotId === depot.id
        && input.kind === 'LOCAL'
        && input.parentLocationId === null
        && input.code === local.code
      ) return local;
      return null;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.identity.version, 3);
  assert.equal(result.value.identity.entityId, local.id);
  assert.deepEqual(result.value.position, {
    kind: 'LOCATION',
    depotId: depot.id,
    locationId: local.id,
    subpositionId: null,
  });
});

test('resolver numérico de 13 dígitos encontra SUBPOSITION com hierarquia completa', async () => {
  const child = subposition(1);
  const code = locationBarcode.encodeWarehouseNumericLocationBarcode({
    kind: 'SUBPOSITION',
    depotCode: depot.code,
    parentCode: local.code,
    locationCode: child.code,
  });
  assert.equal(code, '9813001201101');

  const result = await locationBarcode.resolveWarehouseStockPositionCode({
    code,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, {
    ...resolverSource(),
    async getDepotByCode(depotCode) {
      return ['DEP-001', 'DEP-01', 'DEP-1'].includes(depotCode) ? depot : null;
    },
    async getLocationByCode(input) {
      if (
        input.depotId === depot.id
        && input.kind === 'LOCAL'
        && input.parentLocationId === null
        && input.code === local.code
      ) return local;
      if (
        input.depotId === depot.id
        && input.kind === 'SUBPOSITION'
        && input.parentLocationId === local.id
        && input.code === child.code
      ) return child;
      return null;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.identity.version, 3);
  assert.equal(result.value.identity.entityId, child.id);
  assert.deepEqual(result.value.position, {
    kind: 'SUBPOSITION',
    depotId: depot.id,
    locationId: local.id,
    subpositionId: child.id,
  });
});

test('resolver EPX2 encontra LOCAL pelo caminho lógico sem migração de IDs', async () => {
  const code = locationBarcode.encodeWarehouseCompactLocationBarcode({
    kind: 'LOCAL',
    depotCode: depot.code,
    locationCode: local.code,
  });

  const result = await locationBarcode.resolveWarehouseStockPositionCode({
    code,
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  }, {
    ...resolverSource(),
    async getDepotByCode(depotCode) {
      return depotCode === depot.code ? depot : null;
    },
    async getLocationByCode(input) {
      if (
        input.depotId === depot.id
        && input.kind === 'LOCAL'
        && input.parentLocationId === null
        && input.code === local.code
      ) return local;
      return null;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.identity.version, 2);
  assert.equal(result.value.identity.entityId, local.id);
  assert.deepEqual(result.value.position, {
    kind: 'LOCATION',
    depotId: depot.id,
    locationId: local.id,
    subpositionId: null,
  });
});

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

test('builder prioriza barcode físico numérico e mantém fallback legado', () => {
  const child = subposition(1);
  const items = labels.buildWarehouseLabelsForScope({
    depot,
    locations: [local, child],
    scope: 'DEPOT_FULL',
  });
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((item) => item.physicalBarcode),
    [
      '9811001000000',
      '9812001201000',
      '9813001201101',
    ]
  );

  const customLocal = { ...local, code: 'AREA-A' };
  const fallback = labels.buildLocationLabel(customLocal, depot, [customLocal]);
  assert.equal(fallback.physicalBarcode, 'EPX2L:DEP-01:AREA-A');

  const inactiveDepot = labels.buildWarehouseLabelsForScope({
    depot: { ...depot, status: 'inactive' },
    locations: [local, child],
    scope: 'DEPOT_FULL',
  });
  assert.deepEqual(inactiveDepot, []);
});
