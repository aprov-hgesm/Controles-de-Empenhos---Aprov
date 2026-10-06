import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeForensics,
  decodeValue,
} from './warehouse-data-repair-dry-run.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const finalPosition = {
  kind: 'LOCATION',
  depotId: 'dep_test',
  locationId: 'loc_final',
};
const sourceOne = {
  kind: 'SUBPOSITION',
  depotId: 'dep_old',
  locationId: 'loc_old',
  subpositionId: 'sub_one',
};
const sourceTwo = {
  kind: 'SUBPOSITION',
  depotId: 'dep_old',
  locationId: 'loc_old',
  subpositionId: 'sub_two',
};

function baseCollections() {
  return {
    depots: [{ _documentId: 'dep_test', status: 'active' }],
    locations: [{
      _documentId: 'loc_final',
      kind: 'LOCAL',
      depotId: 'dep_test',
      status: 'active',
    }],
    movements: [],
    balances: [],
    locationBalances: [],
    lots: [],
    intakes: [],
    withdrawals: [],
    consumptions: [],
    outboundReturns: [],
  };
}

function movement(collections, materialId, input) {
  collections.movements.push({
    _documentId: input.id,
    materialId,
    type: input.type,
    quantityDelta: input.quantityDelta,
    source: input.source ?? null,
    _createTime: input.at,
  });
}

function addBalance(collections, materialId, aggregate, physical, unassigned = 0) {
  collections.balances.push({
    _documentId: materialId,
    materialId,
    quantity: aggregate,
    revision: 4,
    lastMovementId: 'mov_last_' + materialId,
  });
  collections.locationBalances.push({
    _documentId: 'lb_' + materialId,
    materialId,
    position: finalPosition,
    quantity: physical,
    revision: 4,
    lastMovementId: 'mov_loc_' + materialId,
  });
  if (unassigned > 0) {
    collections.locationBalances.push({
      _documentId: 'lb_unassigned_' + materialId,
      materialId,
      position: { kind: 'UNASSIGNED' },
      quantity: unassigned,
      revision: 4,
      lastMovementId: 'mov_unassigned_' + materialId,
    });
  }
}

function addLot(collections, materialId, input) {
  collections.lots.push({
    _documentId: input.id,
    workspaceId: 'hgesm-aprov',
    materialId,
    code: input.code,
    quantity: input.quantity,
    position: finalPosition,
    status: 'active',
    origin: { kind: input.originKind, movementId: input.originMovementId ?? null },
    expiresOn: input.expiresOn ?? null,
    _createTime: input.createdAt,
    _updateTime: input.updatedAt ?? input.createdAt,
  });
}

test('decodifica valores REST Firestore usados pela forensics', () => {
  assert.equal(decodeValue({ integerValue: '10' }), 10);
  assert.equal(decodeValue({ doubleValue: 1.5 }), 1.5);
  assert.equal(decodeValue({ stringValue: 'x' }), 'x');
  assert.deepEqual(
    decodeValue({ mapValue: { fields: { kind: { stringValue: 'LOCATION' } } } }),
    { kind: 'LOCATION' }
  );
});

test('prova os dois mecanismos causais observados na leitura viva', () => {
  const collections = baseCollections();
  const materialA = 'mat_272f2d996ee65ed3530ad2d7e27b66d7';
  const materialB = 'mat_6feb0840ca4060f7d69fcce1663f21b8';
  const control = 'mat_bb6d4a089c224b1a48ad3a43f32170a3';

  addBalance(collections, materialA, 445, 440, 5);
  movement(collections, materialA, {
    id: 'mov_a_invoice',
    type: 'INVOICE_ENTRY',
    quantityDelta: 500,
    at: '2026-09-27T20:39:12.534Z',
    source: { kind: 'INVOICE' },
  });
  addLot(collections, materialA, {
    id: 'lot_a_invoice',
    code: '__EMPROVEX_PENDING_LOT__:INTAKE_A',
    quantity: 100,
    originKind: 'INVOICE',
    originMovementId: 'mov_a_invoice',
    createdAt: '2026-09-27T20:39:13.149Z',
  });
  movement(collections, materialA, {
    id: 'mov_a_out_50',
    type: 'OUTBOUND',
    quantityDelta: -50,
    at: '2026-09-28T02:03:56.649Z',
    source: {
      kind: 'EXPRESS_OUTBOUND',
      position: { kind: 'UNASSIGNED' },
      lotId: null,
    },
  });
  movement(collections, materialA, {
    id: 'mov_a_out_10',
    type: 'OUTBOUND',
    quantityDelta: -10,
    at: '2026-09-28T02:05:42.463Z',
    source: {
      kind: 'EXPRESS_OUTBOUND',
      position: { kind: 'UNASSIGNED' },
      lotId: null,
    },
  });
  addLot(collections, materialA, {
    id: 'lot_a_manual',
    code: '__EMPROVEX_PENDING_LOT__:MANUAL_A',
    quantity: 440,
    originKind: 'MANUAL_ENRICHMENT',
    createdAt: '2026-09-28T10:27:04.639Z',
    updatedAt: '2026-09-29T13:06:01.717Z',
  });
  movement(collections, materialA, {
    id: 'mov_a_return',
    type: 'MANUAL_ENTRY',
    quantityDelta: 5,
    at: '2026-09-28T21:43:25.469Z',
    source: { kind: 'MANUAL_ENTRY' },
  });

  addBalance(collections, materialB, 90, 90, 0);
  movement(collections, materialB, {
    id: 'mov_b_invoice',
    type: 'INVOICE_ENTRY',
    quantityDelta: 100,
    at: '2026-09-27T19:36:54.539Z',
    source: { kind: 'INVOICE' },
  });
  movement(collections, materialB, {
    id: 'mov_b_transfer_1',
    type: 'TRANSFER',
    quantityDelta: 0,
    at: '2026-09-27T20:13:14.305Z',
    source: {
      kind: 'LOCATION_TRANSFER',
      quantity: 50,
      from: { kind: 'UNASSIGNED' },
      to: sourceOne,
    },
  });
  addLot(collections, materialB, {
    id: 'lot_b_1',
    code: '__EMPROVEX_PENDING_LOT__:INTAKE_B',
    quantity: 50,
    originKind: 'INVOICE',
    originMovementId: 'mov_b_invoice',
    createdAt: '2026-09-27T20:13:14.382Z',
  });
  movement(collections, materialB, {
    id: 'mov_b_transfer_2',
    type: 'TRANSFER',
    quantityDelta: 0,
    at: '2026-09-27T20:27:35.520Z',
    source: {
      kind: 'LOCATION_TRANSFER',
      quantity: 50,
      from: { kind: 'UNASSIGNED' },
      to: sourceTwo,
    },
  });
  addLot(collections, materialB, {
    id: 'lot_b_2',
    code: '__EMPROVEX_PENDING_LOT__:INTAKE_B',
    quantity: 50,
    originKind: 'INVOICE',
    originMovementId: 'mov_b_invoice',
    createdAt: '2026-09-27T20:27:35.601Z',
  });
  movement(collections, materialB, {
    id: 'mov_b_out_10',
    type: 'OUTBOUND',
    quantityDelta: -10,
    at: '2026-09-28T02:03:55.198Z',
    source: {
      kind: 'EXPRESS_OUTBOUND',
      position: sourceTwo,
      lotId: null,
    },
  });

  addBalance(collections, control, 100, 100, 0);
  movement(collections, control, {
    id: 'mov_c_invoice',
    type: 'INVOICE_ENTRY',
    quantityDelta: 100,
    at: '2026-09-27T18:00:00.000Z',
    source: { kind: 'INVOICE' },
  });
  addLot(collections, control, {
    id: 'lot_c_1',
    code: '__EMPROVEX_PENDING_LOT__:INTAKE_C',
    quantity: 50,
    originKind: 'INVOICE',
    createdAt: '2026-09-27T18:01:00.000Z',
  });
  addLot(collections, control, {
    id: 'lot_c_2',
    code: '__EMPROVEX_PENDING_LOT__:INTAKE_C',
    quantity: 50,
    originKind: 'INVOICE',
    createdAt: '2026-09-27T18:02:00.000Z',
  });

  const report = analyzeForensics(
    { collections, cappedCollections: [] },
    { projectId: 'p', databaseId: 'd', workspaceId: 'hgesm-aprov', readCount: 0 }
  );

  const a = report.results.find((row) => row.materialId === materialA);
  const b = report.results.find((row) => row.materialId === materialB);
  const c = report.results.find((row) => row.materialId === control);

  assert.equal(a.lotExcess, 100);
  assert.equal(a.manualOverAttribution.length, 1);
  assert.equal(a.manualOverAttribution[0].lotId, 'lot_a_manual');
  assert.equal(a.manualOverAttribution[0].overAggregateAfterCreation, 100);
  assert.equal(a.causeProven, true);
  assert.equal(a.repairDeterministic, true);
  assert.equal(a.repairCandidates.length, 1);
  assert.equal(a.repairCandidates[0].before.quantity, 440);
  assert.equal(a.repairCandidates[0].after.quantity, 340);

  assert.equal(b.lotExcess, 10);
  assert.equal(b.netNoLotOutbound, 10);
  assert.equal(b.noLotGlobalQuantityMatch, true);
  assert.equal(b.noLotAffectedLots.length, 1);
  assert.equal(b.noLotAffectedLots[0].lotId, 'lot_b_2');
  assert.equal(b.causeProven, true);
  assert.equal(b.repairDeterministic, true);
  assert.equal(b.repairCandidates.length, 1);
  assert.equal(b.repairCandidates[0].before.quantity, 50);
  assert.equal(b.repairCandidates[0].after.quantity, 40);
  assert.equal(b.duplicateLotGroups.length, 1);

  assert.equal(c.lotExcess, 0);
  assert.equal(c.repairNecessary, false);
  assert.equal(c.duplicateLotGroups.length, 1);

  assert.equal(report.readyForHumanRepairAuthorization, true);
  assert.equal(
    report.finalClassification,
    'PASS — CAUSA PROVADA / REPAIR PLAN PRONTO PARA APROVAÇÃO'
  );
});

test('guard estático: transporte Firestore do dry-run permanece GET-only', () => {
  const source = readFileSync(
    resolve(here, 'warehouse-data-repair-dry-run.mjs'),
    'utf8'
  );

  assert.match(source, /method:\s*['"]GET['"]/);
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
  assert.doesNotMatch(source, /:commit\b|:batchWrite\b|:rollback\b/);
  assert.doesNotMatch(source, /firebase\/firestore|firebase-admin/);
});
