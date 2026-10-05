import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditDataset,
  classifyPosition,
} from './warehouse-integrity-reconcile-readonly.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function emptyCollections() {
  return {
    materials: [],
    depots: [],
    locations: [],
    movements: [],
    balances: [],
    locationBalances: [],
    lots: [],
    intakes: [],
    withdrawals: [],
    consumptions: [],
    outboundReturns: [],
    inventories: [],
  };
}

test('auditor usa somente HTTP GET e nenhum primitive Firestore de escrita', () => {
  const source = readFileSync(
    resolve(here, 'warehouse-integrity-reconcile-readonly.mjs'),
    'utf8'
  );
  const methods = [...source.matchAll(/method\s*:\s*['"]([A-Z]+)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(methods, ['GET']);

  for (const token of [
    'runTransaction(',
    'writeBatch(',
    'setDoc(',
    'updateDoc(',
    'deleteDoc(',
    ':commit',
    ':batchWrite',
  ]) {
    assert.equal(source.includes(token), false, 'primitive proibido: ' + token);
  }
});

test('posição física exige cadeia estrutural válida e ativa', () => {
  const depots = new Map([['dep_a', { status: 'active' }]]);
  const locations = new Map([
    ['loc_a', { kind: 'LOCAL', depotId: 'dep_a', status: 'active' }],
    ['sub_a', {
      kind: 'SUBPOSITION',
      depotId: 'dep_a',
      parentLocationId: 'loc_a',
      status: 'active',
    }],
  ]);

  assert.equal(
    classifyPosition(
      {
        kind: 'LOCATION',
        depotId: 'dep_a',
        locationId: 'loc_a',
        subpositionId: null,
      },
      depots,
      locations
    ).classification,
    'ACTIVE_PHYSICAL'
  );
  assert.equal(
    classifyPosition(
      {
        kind: 'SUBPOSITION',
        depotId: 'dep_a',
        locationId: 'loc_a',
        subpositionId: 'sub_a',
      },
      depots,
      locations
    ).classification,
    'ACTIVE_PHYSICAL'
  );
  assert.equal(
    classifyPosition({ kind: 'UNASSIGNED' }, depots, locations).classification,
    'UNASSIGNED'
  );
  assert.equal(
    classifyPosition(
      {
        kind: 'LOCATION',
        depotId: 'dep_a',
        locationId: 'loc_missing',
        subpositionId: null,
      },
      depots,
      locations
    ).classification,
    'INVALID_OR_ORPHAN'
  );
});

test('PAL-01 440 físico vs 540 em lotes é detectado genericamente', () => {
  const collections = emptyCollections();
  collections.materials.push({ _documentId: 'mat_pal' });
  collections.depots.push({ _documentId: 'dep_pal', status: 'active' });
  collections.locations.push({
    _documentId: 'loc_pal',
    kind: 'LOCAL',
    depotId: 'dep_pal',
    status: 'active',
  });

  const position = {
    kind: 'LOCATION',
    depotId: 'dep_pal',
    locationId: 'loc_pal',
    subpositionId: null,
  };

  collections.balances.push({
    _documentId: 'mat_pal',
    materialId: 'mat_pal',
    quantity: 440,
  });
  collections.locationBalances.push({
    _documentId: 'locbal_pal',
    materialId: 'mat_pal',
    position,
    quantity: 440,
  });
  collections.lots.push(
    {
      _documentId: 'lot_1',
      materialId: 'mat_pal',
      status: 'active',
      position,
      quantity: 300,
      code: 'A',
    },
    {
      _documentId: 'lot_2',
      materialId: 'mat_pal',
      status: 'active',
      position,
      quantity: 240,
      code: 'B',
    }
  );
  collections.movements.push(
    {
      _documentId: 'mov_1',
      materialId: 'mat_pal',
      type: 'INITIAL_BALANCE',
      quantityDelta: 540,
      _createTime: '2026-01-01T00:00:00Z',
    },
    {
      _documentId: 'mov_2',
      materialId: 'mat_pal',
      type: 'OUTBOUND',
      quantityDelta: -100,
      _createTime: '2026-02-01T00:00:00Z',
    }
  );

  const report = auditDataset(
    {
      collections,
      inventoryItems: [],
      cappedCollections: [],
      inventoryItemsCapped: false,
    },
    {
      projectId: 'p',
      databaseId: 'd',
      workspaceId: 'w',
      readCount: 9,
      cap: 5000,
    }
  );

  assert.equal(report.pal01.detected, true);
  assert.equal(report.pal01.candidates.includes('mat_pal'), true);
  assert.equal(
    report.issues.some(
      (issue) =>
        issue.code === 'LOT_ATTRIBUTION_EXCEEDS_STOCK' &&
        issue.materialId === 'mat_pal'
    ),
    true
  );
  const row = report.materials.find((item) => item.materialId === 'mat_pal');
  assert.equal(row.physicalActive, 440);
  assert.equal(row.activeLotQuantity, 540);
  assert.equal(row.differenceLotsVsPhysical, 100);
  assert.equal(
    report.finalClassification,
    'BLOCKER — INCONSISTÊNCIAS SISTÊMICAS IMPEDEM RC'
  );
});

test('intake v2 divergente e inventário UNASSIGNED viram inconsistências', () => {
  const collections = emptyCollections();
  collections.materials.push({ _documentId: 'mat_x' });
  collections.intakes.push({
    _documentId: 'intake_x',
    schemaVersion: 'warehouse_item_intake_v2',
    materialId: 'mat_x',
    receivedQuantity: 10,
    allocatedQuantity: 4,
    immediateConsumptionQuantity: 1,
    pendingQuantity: 9,
    status: 'PENDING',
  });

  const report = auditDataset(
    {
      collections,
      inventoryItems: [
        {
          _documentId: 'invit_x',
          _inventoryId: 'inv_x',
          materialId: 'mat_x',
          position: { kind: 'UNASSIGNED' },
          status: 'PENDING',
        },
      ],
      cappedCollections: [],
      inventoryItemsCapped: false,
    },
    {
      projectId: 'p',
      databaseId: 'd',
      workspaceId: 'w',
      readCount: 1,
      cap: 5000,
    }
  );

  assert.equal(
    report.issues.some((issue) => issue.code === 'INTAKE_QUANTITY_MISMATCH'),
    true
  );
  assert.equal(
    report.issues.some((issue) => issue.code === 'INVENTORY_UNASSIGNED_POSITION'),
    true
  );
  assert.equal(
    report.finalClassification,
    'BLOCKER — INCONSISTÊNCIAS SISTÊMICAS IMPEDEM RC'
  );
});
