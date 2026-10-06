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
const position = {
  kind: 'LOCATION',
  depotId: 'dep_test',
  locationId: 'loc_test',
};

function baseCollections() {
  return {
    depots: [{ _documentId: 'dep_test', status: 'active' }],
    locations: [{
      _documentId: 'loc_test',
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

function addMaterial(collections, materialId, {
  aggregate,
  physical,
  lots,
  noLotOutbound = 0,
  revision = 1,
}) {
  collections.balances.push({
    _documentId: materialId,
    materialId,
    quantity: aggregate,
    revision,
    lastMovementId: noLotOutbound > 0 ? 'mov_out_' + materialId : 'mov_last_' + materialId,
  });
  collections.locationBalances.push({
    _documentId: 'lb_' + materialId,
    materialId,
    position,
    quantity: physical,
    revision,
    lastMovementId: 'mov_loc_' + materialId,
  });
  lots.forEach((quantity, index) => {
    collections.lots.push({
      _documentId: 'lot_' + materialId + '_' + index,
      workspaceId: 'hgesm-aprov',
      materialId,
      code: '__EMPROVEX_PENDING_LOT__:TEST_' + materialId,
      quantity,
      position,
      status: 'active',
      origin: { kind: 'INVOICE', movementId: 'mov_invoice_' + materialId },
      _createTime: '2026-09-27T10:00:00Z',
      _updateTime: '2026-09-27T10:00:00Z',
    });
  });
  if (noLotOutbound > 0) {
    collections.movements.push({
      _documentId: 'mov_out_' + materialId,
      materialId,
      type: 'OUTBOUND',
      quantityDelta: -noLotOutbound,
      source: {
        kind: 'EXPRESS_OUTBOUND',
        position,
        lotId: null,
        lotCode: null,
      },
      _createTime: '2026-09-28T10:00:00Z',
    });
  }
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

test('prova mecanismo de OUTBOUND sem lotId quando excesso fecha por posição', () => {
  const collections = baseCollections();
  addMaterial(collections, 'mat_272f2d996ee65ed3530ad2d7e27b66d7', {
    aggregate: 440,
    physical: 440,
    lots: [540],
    noLotOutbound: 100,
  });
  addMaterial(collections, 'mat_6feb0840ca4060f7d69fcce1663f21b8', {
    aggregate: 90,
    physical: 90,
    lots: [50, 50],
    noLotOutbound: 10,
  });
  addMaterial(collections, 'mat_bb6d4a089c224b1a48ad3a43f32170a3', {
    aggregate: 100,
    physical: 100,
    lots: [50, 50],
  });

  const report = analyzeForensics(
    { collections, cappedCollections: [] },
    { projectId: 'p', databaseId: 'd', workspaceId: 'hgesm-aprov', readCount: 0 }
  );

  const materialA = report.results.find(
    (row) => row.materialId === 'mat_272f2d996ee65ed3530ad2d7e27b66d7'
  );
  const materialB = report.results.find(
    (row) => row.materialId === 'mat_6feb0840ca4060f7d69fcce1663f21b8'
  );
  const control = report.results.find(
    (row) => row.materialId === 'mat_bb6d4a089c224b1a48ad3a43f32170a3'
  );

  assert.equal(materialA.lotExcess, 100);
  assert.equal(materialA.netNoLotOutbound, 100);
  assert.equal(materialA.causeProven, true);
  assert.equal(materialA.repairDeterministic, true);
  assert.equal(materialA.repairCandidates.length, 1);
  assert.equal(materialA.repairCandidates[0].after.quantity, 440);

  assert.equal(materialB.lotExcess, 10);
  assert.equal(materialB.netNoLotOutbound, 10);
  assert.equal(materialB.causeProven, true);
  assert.equal(materialB.repairDeterministic, false);
  assert.equal(materialB.repairCandidates.length, 0);
  assert.equal(materialB.duplicateLotGroups.length, 1);

  assert.equal(control.lotExcess, 0);
  assert.equal(control.repairNecessary, false);
  assert.equal(control.duplicateLotGroups.length, 1);
  assert.equal(report.readyForHumanRepairAuthorization, false);
  assert.equal(
    report.finalClassification,
    'PASS PARCIAL — CAUSA PROVADA EM PARTE / MAIS EVIDÊNCIA NECESSÁRIA'
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
