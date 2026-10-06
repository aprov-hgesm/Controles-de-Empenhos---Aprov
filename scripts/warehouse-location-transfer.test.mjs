#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
    resolve(root, 'lib/warehouse/lot.ts'),
    resolve(root, 'lib/warehouse/barcode.ts'),
    resolve(root, 'lib/warehouse/locationBarcode.ts'),
    resolve(root, 'lib/warehouse/mobileScanner.ts'),
    resolve(root, 'lib/warehouse/mobileTransferLots.ts'),
    resolve(root, 'lib/warehouse/mobileTransfer.ts'),
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
const locationBarcode = require(resolve(outDir, 'warehouse/locationBarcode.js'));
const mobileTransferLots = require(resolve(outDir, 'warehouse/mobileTransferLots.js'));
const mobileTransfer = require(resolve(outDir, 'warehouse/mobileTransfer.js'));

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

test('helper legado calcula residual UNASSIGNED sem promovê-lo a estoque operacional', () => {
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


test('MOBILE-D aceita LOCATION e SUBPOSITION nas quatro combinações físicas', () => {
  const locationA = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const locationB = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };
  const subpositionA = { kind: 'SUBPOSITION', depotId, locationId: localA, subpositionId: subA };
  const subpositionB = { kind: 'SUBPOSITION', depotId, locationId: localB, subpositionId: 'sub_' + 'e'.repeat(32) };

  for (const [from, to] of [
    [locationA, locationB],
    [locationA, subpositionB],
    [subpositionA, locationB],
    [subpositionA, subpositionB],
  ]) {
    const prepared = mobileTransfer.prepareWarehouseMobileTransfer({
      materialId,
      from,
      to,
      quantity: 3,
      availableQuantity: 10,
      lots: [],
    });
    assert.equal(prepared.ok, true);
    assert.equal(prepared.quantity, 3);
    assert.deepEqual(prepared.relocateLotIds, []);
  }
});

test('MOBILE-D rejeita origem igual, zero e quantidade acima do disponível', () => {
  const from = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const to = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };

  assert.deepEqual(
    mobileTransfer.prepareWarehouseMobileTransfer({
      materialId, from, to: from, quantity: 1, availableQuantity: 10, lots: [],
    }),
    { ok: false, error: 'SAME_POSITION' }
  );
  assert.deepEqual(
    mobileTransfer.prepareWarehouseMobileTransfer({
      materialId, from, to, quantity: 0, availableQuantity: 10, lots: [],
    }),
    { ok: false, error: 'INVALID_QUANTITY' }
  );
  assert.deepEqual(
    mobileTransfer.prepareWarehouseMobileTransfer({
      materialId, from, to, quantity: 11, availableQuantity: 10, lots: [],
    }),
    { ok: false, error: 'INSUFFICIENT_STOCK' }
  );
});

test('MOBILE-D preserva lote em transferência parcial e integral', () => {
  const from = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const to = { kind: 'SUBPOSITION', depotId, locationId: localB, subpositionId: 'sub_' + 'e'.repeat(32) };
  const lots = [
    {
      id: 'lot_' + '1'.repeat(32),
      materialId,
      status: 'active',
      quantity: 6,
      position: from,
    },
    {
      id: 'lot_' + '2'.repeat(32),
      materialId,
      status: 'active',
      quantity: 4,
      position: from,
    },
  ];

  const partial = mobileTransfer.prepareWarehouseMobileTransfer({
    materialId, from, to, quantity: 4, availableQuantity: 10, lots,
  });
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.lotAllocations, [
    { lotId: 'lot_' + '1'.repeat(32), quantity: 4 },
  ]);
  assert.deepEqual(partial.relocateLotIds, []);
  assert.equal(partial.unattributedQuantity, 0);

  const integral = mobileTransfer.prepareWarehouseMobileTransfer({
    materialId, from, to, quantity: 10, availableQuantity: 10, lots,
  });
  assert.equal(integral.ok, true);
  assert.deepEqual(integral.lotAllocations, [
    { lotId: 'lot_' + '1'.repeat(32), quantity: 6 },
    { lotId: 'lot_' + '2'.repeat(32), quantity: 4 },
  ]);
  assert.deepEqual(integral.relocateLotIds, [
    'lot_' + '1'.repeat(32),
    'lot_' + '2'.repeat(32),
  ]);
});

test('MOBILE-D bloqueia lote atribuído acima do saldo físico', () => {
  const from = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const to = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };
  const lots = [
    {
      id: 'lot_' + '3'.repeat(32),
      materialId,
      status: 'active',
      quantity: 440,
      position: from,
    },
    {
      id: 'lot_' + '4'.repeat(32),
      materialId,
      status: 'active',
      quantity: 100,
      position: from,
    },
  ];

  const result = mobileTransfer.prepareWarehouseMobileTransfer({
    materialId, from, to, quantity: 10, availableQuantity: 440, lots,
  });
  assert.deepEqual(result, {
    ok: false,
    error: 'LOT_ATTRIBUTION_EXCEEDS_STOCK',
  });
});

test('MOBILE-D transfere primeiro a parcela sem lote sem inventar procedência', () => {
  const from = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const to = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };
  const lots = [{
    id: 'lot_' + '5'.repeat(32),
    materialId,
    status: 'active',
    quantity: 100,
    position: from,
  }];

  const result = mobileTransfer.prepareWarehouseMobileTransfer({
    materialId, from, to, quantity: 10, availableQuantity: 440, lots,
  });
  assert.equal(result.ok, true);
  assert.equal(result.unattributedQuantity, 10);
  assert.deepEqual(result.lotAllocations, []);
});

test('MOBILE-K transferência física rejeita UNASSIGNED e aceita combinações físicas', () => {
  const locationA = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const locationB = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };
  const subpositionA = { kind: 'SUBPOSITION', depotId, locationId: localA, subpositionId: subA };
  const subpositionB = {
    kind: 'SUBPOSITION',
    depotId,
    locationId: localB,
    subpositionId: 'sub_' + 'e'.repeat(32),
  };
  const unassigned = { kind: 'UNASSIGNED' };

  for (const [from, to] of [
    [locationA, locationB],
    [locationA, subpositionB],
    [subpositionA, locationB],
    [subpositionA, subpositionB],
  ]) {
    const result = mobileTransfer.prepareWarehouseMobileTransfer({
      materialId,
      from,
      to,
      quantity: 1,
      availableQuantity: 5,
      lots: [],
    });
    assert.equal(result.ok, true);
  }

  for (const [from, to] of [
    [unassigned, locationA],
    [locationA, unassigned],
  ]) {
    const result = mobileTransfer.prepareWarehouseMobileTransfer({
      materialId,
      from,
      to,
      quantity: 1,
      availableQuantity: 5,
      lots: [],
    });
    assert.deepEqual(result, { ok: false, error: 'NON_PHYSICAL_POSITION' });
  }
});

test('MOBILE-D revalida concorrência usando o saldo físico mais recente', () => {
  const source = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const staleReviewQuantity = 3;
  const freshAvailableQuantity = 2;
  const result = mobileTransfer.validateWarehouseMobileTransferQuantity({
    materialId,
    source,
    quantity: staleReviewQuantity,
    availableQuantity: freshAvailableQuantity,
    lots: [],
  });
  assert.deepEqual(result, { ok: false, error: 'INSUFFICIENT_STOCK' });
});

test('MOBILE-D mantém fronteira fina sobre scanner, resolver e TRANSFER canônico', () => {
  const ui = readFileSync(
    resolve(root, 'features/warehouse/mobile/WarehouseMobileTransfer.tsx'),
    'utf8'
  );
  const repository = readFileSync(
    resolve(root, 'lib/warehouse/locationRepository.ts'),
    'utf8'
  );

  assert.match(ui, /EXPECT_SOURCE_LOCATION/);
  assert.match(ui, /EXPECT_PRODUCT/);
  assert.match(ui, /EXPECT_DESTINATION_LOCATION/);
  assert.match(ui, /resolveWarehouseStockPositionBarcode/);
  assert.match(ui, /createWarehouseTransferIdempotencyKey/);
  assert.match(ui, /transferWarehouseStock/);
  assert.match(ui, /CONFIRMAR TRANSFERÊNCIA/);
  assert.doesNotMatch(ui, /\bsetDoc\s*\(/);
  assert.doesNotMatch(ui, /\bupdateDoc\s*\(/);
  assert.doesNotMatch(ui, /\bOUTBOUND\b/);

  assert.match(repository, /runTransaction\(db/);
  assert.match(repository, /WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/);
  assert.match(repository, /warehouseMovementMatchesReplay/);
  assert.match(repository, /type:\s*'TRANSFER'/);
  assert.match(repository, /quantityDelta:\s*0/);
});


test('MOBILE-D leitura crítica de lotes falha fechado quando o loader falha', async () => {
  await assert.rejects(
    mobileTransferLots.loadWarehouseMobileTransferCriticalLotsFailClosed(
      async () => {
        throw new Error('SIMULATED_FIRESTORE_LOT_QUERY_FAILURE');
      }
    ),
    /SIMULATED_FIRESTORE_LOT_QUERY_FAILURE/
  );
});

test('MOBILE-D leitura crítica detecta saturação por MAX + 1 e não assume completude', async () => {
  const saturatedLots = Array.from(
    { length: mobileTransferLots.WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_FETCH_LIMIT },
    (_, index) => ({ id: 'lot_' + index.toString(16).padStart(32, '0') })
  );
  const result = await mobileTransferLots.loadWarehouseMobileTransferCriticalLotsFailClosed(
    async () => saturatedLots
  );

  assert.deepEqual(result, {
    status: 'saturated',
    observedCount: mobileTransferLots.WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_FETCH_LIMIT,
  });

  const empty = await mobileTransferLots.loadWarehouseMobileTransferCriticalLotsFailClosed(
    async () => []
  );
  assert.deepEqual(empty, { status: 'complete', lots: [] });
});

test('MOBILE-D aceita 24 lotes ativos e bloqueia 25 antes do TRANSFER', () => {
  const from = { kind: 'LOCATION', depotId, locationId: localA, subpositionId: null };
  const to = { kind: 'LOCATION', depotId, locationId: localB, subpositionId: null };
  const buildLots = (count) => Array.from({ length: count }, (_, index) => ({
    id: 'lot_' + (index + 1).toString(16).padStart(32, '0'),
    materialId,
    status: 'active',
    quantity: 1,
    position: from,
  }));

  const accepted = mobileTransfer.prepareWarehouseMobileTransfer({
    materialId,
    from,
    to,
    quantity: 24,
    availableQuantity: 24,
    lots: buildLots(24),
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.relocateLotIds.length, 24);

  const blocked = mobileTransfer.prepareWarehouseMobileTransfer({
    materialId,
    from,
    to,
    quantity: 25,
    availableQuantity: 25,
    lots: buildLots(25),
  });
  assert.deepEqual(blocked, {
    ok: false,
    error: 'TOO_MANY_ACTIVE_LOTS',
  });
});

test('MOBILE-D preserva namespace EPX1 reservado na classificação de produto', () => {
  const validLocation = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: localA,
  });

  assert.equal(
    mobileTransfer.classifyWarehouseMobileTransferProductScan(validLocation),
    'LOCATION'
  );
  assert.equal(
    mobileTransfer.classifyWarehouseMobileTransferProductScan('EPX1-MALFORMADO'),
    'UNKNOWN'
  );
  assert.equal(
    mobileTransfer.classifyWarehouseMobileTransferProductScan('7891234567890'),
    'PRODUCT'
  );
  assert.equal(
    mobileTransfer.classifyWarehouseMobileTransferProductScan('\u0000'),
    'UNKNOWN'
  );
});

test('MOBILE-D usa reader crítico sem retorno vazio silencioso e sem escrita direta', () => {
  const ui = readFileSync(
    resolve(root, 'features/warehouse/mobile/WarehouseMobileTransfer.tsx'),
    'utf8'
  );
  const criticalRepository = readFileSync(
    resolve(root, 'lib/warehouse/mobileTransferLotRepository.ts'),
    'utf8'
  );

  assert.doesNotMatch(ui, /listWarehouseMobileTransferLotsCritical/);
  assert.doesNotMatch(ui, /listWarehouseLots\s*\(/);
  assert.doesNotMatch(ui, /lotAllocations\s*:/);
  assert.match(ui, /transferWarehouseStock/);
  assert.match(ui, /classifyWarehouseMobileTransferProductScan/);
  assert.match(criticalRepository, /WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_FETCH_LIMIT/);
  assert.match(criticalRepository, /WAREHOUSE_MOBILE_TRANSFER_LOTS_SATURATED/);
  assert.match(criticalRepository, /WAREHOUSE_MOBILE_TRANSFER_LOTS_READ_FAILED/);
  assert.doesNotMatch(criticalRepository, /return\s+\[\]/);
});
