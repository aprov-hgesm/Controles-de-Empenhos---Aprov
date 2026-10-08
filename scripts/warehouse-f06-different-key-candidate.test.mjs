#!/usr/bin/env node
// F06 integration: execute the REAL locationRepository.transferWarehouseStock
// against the named Firestore Emulator. Never target a live Firebase project.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { reconcileDifferentKeyConcurrency } from './warehouse-f06-different-key-reconcile.mjs';

const PROJECT_ID = 'demo-emprovex-f06';
const WAREHOUSE_DATABASE = 'emprovex-warehouse';
const WORKSPACE_ID = 'hgesm-aprov';
const UG = '160416';
const OWNER_EMAIL = 'aprov1hgesm@gmail.com';
const ROOT = resolve(import.meta.dirname || new URL('.', import.meta.url).pathname, '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');

assert.equal(process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS, '1', 'F06 requires E2E emulators');
assert.equal(process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID, PROJECT_ID);
assert.equal(process.env.NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID || WAREHOUSE_DATABASE, WAREHOUSE_DATABASE);
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'F06 requires a running Firestore Emulator');
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'F06 requires a running Auth Emulator');

// Transpile the repository's actual TypeScript files in-memory; do not use a
// duplicate implementation, a mock transaction, or production credentials.
require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const { auth, warehouseDb } = require(resolve(ROOT, 'lib/firebase.ts'));
const { transferWarehouseStock } = require(resolve(ROOT, 'lib/warehouse/locationRepository.ts'));
const { createWarehouseLocationBalanceId } = require(resolve(ROOT, 'lib/warehouse/location.ts'));
const { createWarehouseMovementId } = require(resolve(ROOT, 'lib/warehouse/movement.ts'));
const {
  GoogleAuthProvider, signInWithCredential, signOut,
} = require('firebase/auth');
const {
  collection, connectFirestoreEmulator, doc, getDoc, getDocFromServer, getDocs, getDocsFromServer,
  getFirestore, query, where,
} = require('firebase/firestore');
const { initializeApp, deleteApp, getApp } = require('firebase/app');

const REST_BASE = 'http://127.0.0.1:8080/v1/projects/'
  + PROJECT_ID + '/databases/' + WAREHOUSE_DATABASE + '/documents';
const depotId = 'dep_' + 'a'.repeat(32);
const locationA = 'loc_' + 'b'.repeat(32);
const locationB = 'loc_' + 'c'.repeat(32);
const from = { kind: 'LOCATION', depotId, locationId: locationA, subpositionId: null };
const to = { kind: 'LOCATION', depotId, locationId: locationB, subpositionId: null };
const actor = () => {
  assert.ok(auth.currentUser, 'Authenticated founder session required');
  return auth.currentUser.uid;
};

function field(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value)
    ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'object') return { mapValue: { fields: fields(value) } };
  throw new Error('Unexpected fixture field: ' + typeof value);
}
function fields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, field(item)]));
}
async function seed(path, data) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(REST_BASE + '/' + encoded, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields(data) }),
  });
  assert.equal(response.status, 200, 'Seed ' + path + ' failed: ' + await response.text());
}
function pathFor(domain, id) { return 'warehouse/' + WORKSPACE_ID + '/' + domain + '/' + id; }
async function snapshot(domain, id) {
  return getDoc(doc(warehouseDb, pathFor(domain, id)));
}
async function allMovements(materialId) {
  const rows = await getDocs(query(
    collection(warehouseDb, 'warehouse/' + WORKSPACE_ID + '/movements'),
    where('materialId', '==', materialId)
  ));
  return rows.docs;
}
function fixtureId(n) { return 'mat_' + n.toString(16).padStart(32, '0'); }
function movementSeedId(n) { return 'mov_' + n.toString(16).padStart(64, '0'); }

async function fixture(n, quantity, options = {}) {
  const materialId = fixtureId(n);
  const uid = actor();
  await seed(pathFor('materials', materialId), {
    schemaVersion: 'warehouse_material_v1', id: materialId, workspaceId: WORKSPACE_ID,
    ug: UG, description: 'Fixture transacional F06 ' + n, aliases: [],
    unit: { code: 'unit', label: null }, conversions: [],
    status: options.inactive ? 'inactive' : 'active',
  });
  const fromId = await createWarehouseLocationBalanceId(WORKSPACE_ID, materialId, from);
  const toId = await createWarehouseLocationBalanceId(WORKSPACE_ID, materialId, to);
  await seed(pathFor('balances', materialId), {
    schemaVersion: 'warehouse_balance_v1', workspaceId: WORKSPACE_ID,
    ug: UG, materialId, quantity, revision: 1, lastMovementId: movementSeedId(n),
  });
  await seed(pathFor('locationBalances', fromId), {
    schemaVersion: 'warehouse_location_balance_v1', id: fromId, workspaceId: WORKSPACE_ID,
    ug: UG, materialId, position: from, quantity, revision: 1,
    lastMovementId: movementSeedId(n),
  });
  if (options.initialDestination) {
    await seed(pathFor('locationBalances', toId), {
      schemaVersion: 'warehouse_location_balance_v1', id: toId, workspaceId: WORKSPACE_ID,
      ug: UG, materialId, position: to, quantity: options.initialDestination,
      revision: 1, lastMovementId: movementSeedId(n),
    });
  }
  return { materialId, fromId, toId, uid };
}
function input(f, key, quantity, overrides = {}) {
  return {
    materialId: f.materialId, idempotencyKey: 'F06:' + key,
    from, to, quantity, note: 'F06 emulator', ...overrides,
  };
}
async function balances(f) {
  const [s, d, a] = await Promise.all([
    snapshot('locationBalances', f.fromId),
    snapshot('locationBalances', f.toId),
    snapshot('balances', f.materialId),
  ]);
  assert.equal(s.exists(), true);
  assert.equal(a.exists(), true);
  return { source: s.data(), destination: d.exists() ? d.data() : null, aggregate: a.data() };
}
async function assertState(f, sourceQty, destQty, movements) {
  const b = await balances(f);
  assert.equal(b.source.quantity, sourceQty, 'source physical stock');
  assert.equal(b.destination?.quantity || 0, destQty, 'destination physical stock');
  assert.equal(b.aggregate.quantity, (sourceQty + destQty), 'global quantity conserved');
  assert.ok(b.source.quantity >= 0 && (b.destination?.quantity || 0) >= 0);
  assert.equal((await allMovements(f.materialId)).length, movements, 'exact movement count');
}

async function seedLot(f, n, quantity) {
  const id = 'lot_' + n.toString(16).padStart(32, '0');
  const historicalTimestamp = new Date('2024-01-01T00:00:00.000Z');
  await seed(pathFor('lots', id), {
    schemaVersion: 'warehouse_lot_v1', id, workspaceId: WORKSPACE_ID,
    ug: UG, materialId: f.materialId, code: 'LEG-F06-' + n,
    expiresOn: null, quantity, position: from,
    origin: {
      kind: 'LEGACY', movementId: null, invoiceRecordKey: null,
      invoiceId: null, supplier: null, supplierCnpj: null,
    },
    status: 'active', createdBy: f.uid, updatedBy: f.uid,
    createdAt: historicalTimestamp, updatedAt: historicalTimestamp,
  });
  return id;
}

test.after(async () => {
  // Firestore holds open connections in Node; close them even when assertions fail.
  await deleteApp(getApp());
});

test('F06 real transaction on named Firestore Emulator', { timeout: 180000 }, async (t) => {
  // The live repository validates physical positions before each transaction.
  for (const [id, kind, name, code] of [
    [depotId, 'DEPOT', 'Deposito F06', 'DEP-F06'],
    [locationA, 'LOCAL', 'Origem F06', 'LOC-F06-A'],
    [locationB, 'LOCAL', 'Destino F06', 'LOC-F06-B'],
  ]) {
    await seed(pathFor(kind === 'DEPOT' ? 'depots' : 'locations', id), kind === 'DEPOT'
      ? {
          schemaVersion: 'warehouse_depot_v1', id, workspaceId: WORKSPACE_ID, ug: UG,
          code, name, description: null, status: 'active', visualType: 'STANDARD',
          sizeProfile: 'MEDIUM', createdBy: 'f06-seed', updatedBy: 'f06-seed',
        }
      : {
          schemaVersion: 'warehouse_location_v1', id, workspaceId: WORKSPACE_ID, ug: UG,
          depotId, kind, parentLocationId: null, code, name, description: null,
          status: 'active', createdBy: 'f06-seed', updatedBy: 'f06-seed',
        });
  }

  await signInWithCredential(auth, GoogleAuthProvider.credential(
    JSON.stringify({ sub: 'f06-founder-emulator', email: OWNER_EMAIL, email_verified: true })
  ));
  assert.equal(auth.currentUser.email, OWNER_EMAIL);

  await t.test('first transfer and replay after source depletion write exactly one movement', async () => {
    const f = await fixture(1, 10);
    const request = input(f, 'exhaustion', 10);
    const first = await transferWarehouseStock(WORKSPACE_ID, request);
    assert.equal(first.applied, true);
    await assertState(f, 0, 10, 1);
    const previous = await balances(f);
    const retry = await transferWarehouseStock(WORKSPACE_ID, request);
    assert.equal(retry.applied, false);
    assert.equal(retry.movement.id, first.movement.id);
    await assertState(f, 0, 10, 1);
    assert.deepEqual(await balances(f), previous, 'replay must not mutate revisions or balances');
  });

  await t.test('same idempotency key with changed payload must conflict without writes', async () => {
    const f = await fixture(2, 8);
    const original = input(f, 'conflict', 5);
    await transferWarehouseStock(WORKSPACE_ID, original);
    for (const altered of [
      { quantity: 4 }, { note: 'different note' }, { from: to, to: from },
    ]) {
      await assert.rejects(
        () => transferWarehouseStock(WORKSPACE_ID, { ...original, ...altered }),
        /WAREHOUSE_IDEMPOTENCY_CONFLICT/
      );
      await assertState(f, 3, 5, 1);
    }
  });

  await t.test('same-key concurrent calls commit once', async () => {
    const f = await fixture(3, 12);
    const request = input(f, 'same-key-race', 7);
    const attempts = await Promise.allSettled([
      transferWarehouseStock(WORKSPACE_ID, request),
      transferWarehouseStock(WORKSPACE_ID, request),
    ]);
    assert.equal(
      attempts.filter((item) => item.status === 'rejected').length,
      0,
      attempts.filter((item) => item.status === 'rejected').map((item) => String(item.reason)).join('; ')
    );
    assert.deepEqual(attempts.map((item) => item.value.applied).sort(), [false, true]);
    await assertState(f, 5, 7, 1);
  });

  await t.test('different-key concurrency cannot overdraw or partially commit', async () => {
    const f = await fixture(4, 10);
    const settledAttempts = await Promise.allSettled([
      transferWarehouseStock(WORKSPACE_ID, input(f, 'race-A', 7)),
      transferWarehouseStock(WORKSPACE_ID, input(f, 'race-B', 7)),
    ]);
    const ids = await Promise.all(['race-A', 'race-B'].map((key) =>
      createWarehouseMovementId(WORKSPACE_ID, 'F06:' + key)));
    const attempts = await reconcileDifferentKeyConcurrency({
      attempts: settledAttempts,
      keys: ids.map((movementId) => ({ movementId })),
      requestQuantity: 7,
      startingQuantity: 10,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      uid: f.uid,
      materialId: f.materialId,
      from,
      to,
      fromBalanceId: f.fromId,
      toBalanceId: f.toId,
      loadEvidence: async () => {
        const [source, destination, aggregate, first, second, ledger] = await Promise.all([
          getDocFromServer(doc(warehouseDb, pathFor('locationBalances', f.fromId))),
          getDocFromServer(doc(warehouseDb, pathFor('locationBalances', f.toId))),
          getDocFromServer(doc(warehouseDb, pathFor('balances', f.materialId))),
          getDocFromServer(doc(warehouseDb, pathFor('movements', ids[0]))),
          getDocFromServer(doc(warehouseDb, pathFor('movements', ids[1]))),
          getDocsFromServer(query(
            collection(warehouseDb, 'warehouse/' + WORKSPACE_ID + '/movements'),
            where('materialId', '==', f.materialId)
          )),
        ]);
        return {
          source: source.exists() ? source.data() : null,
          destination: destination.exists() ? destination.data() : null,
          aggregate: aggregate.exists() ? aggregate.data() : null,
          movements: [first, second].map((s) => s.exists() ? s.data() : null),
          ledger: ledger.docs.map((s) => ({ id: s.id, ...s.data() })),
        };
      },
    });
    assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1, JSON.stringify(attempts));
    const failures = attempts.filter((item) => item.status === 'rejected');
    assert.equal(failures.length, 1);
    assert.match(
      String(failures[0].reason),
      /WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/,
      'Concurrent overdraft must fail by stock invariant, not a Rules evaluation error'
    );
    await assertState(f, 3, 7, 1);
  });

  await t.test('partial and integral physical transfers conserve quantity', async () => {
    const partial = await fixture(5, 9);
    assert.equal((await transferWarehouseStock(WORKSPACE_ID, input(partial, 'partial', 4))).applied, true);
    await assertState(partial, 5, 4, 1);
    const integral = await fixture(6, 9);
    assert.equal((await transferWarehouseStock(WORKSPACE_ID, input(integral, 'integral', 9))).applied, true);
    await assertState(integral, 0, 9, 1);
  });

  await t.test('legacy lot follows integral transfer', async () => {
    const f = await fixture(7, 5);
    const lotId = await seedLot(f, 7, 5);
    assert.equal((await transferWarehouseStock(WORKSPACE_ID, input(f, 'legacy-full', 5))).applied, true);
    await assertState(f, 0, 5, 1);
    const lot = await snapshot('lots', lotId);
    assert.equal(lot.data().position.locationId, locationB);
    assert.equal(lot.data().quantity, 5);
    assert.equal(lot.data().origin.kind, 'LEGACY');
  });

  await t.test('legacy lot is atomically split in partial transfer', async () => {
    const f = await fixture(8, 7);
    const lotId = await seedLot(f, 8, 7);
    assert.equal((await transferWarehouseStock(WORKSPACE_ID, input(f, 'legacy-partial', 3))).applied, true);
    await assertState(f, 4, 3, 1);
    const sourceLot = await snapshot('lots', lotId);
    assert.equal(sourceLot.data().quantity, 4);
    const lots = await getDocs(query(
      collection(warehouseDb, 'warehouse/' + WORKSPACE_ID + '/lots'),
      where('materialId', '==', f.materialId)
    ));
    assert.equal(lots.size, 2);
    const split = lots.docs.find((item) => item.id !== lotId)?.data();
    assert.equal(split?.quantity, 3);
    assert.equal(split?.position.locationId, locationB);
    assert.equal(split?.origin.kind, 'LEGACY');
  });

  await t.test('inactive material fails inside transaction without any partial movement', async () => {
    const f = await fixture(9, 4, { inactive: true });
    await assert.rejects(
      () => transferWarehouseStock(WORKSPACE_ID, input(f, 'atomic-failure', 2)),
      /WAREHOUSE_MATERIAL_INACTIVE/
    );
    const result = await balances(f);
    assert.equal(result.source.quantity, 4);
    assert.equal(result.destination, null);
    assert.equal((await allMovements(f.materialId)).length, 0);
  });

  await t.test('unauthenticated engine and unauthorized Firestore read are rejected', async () => {
    const f = await fixture(10, 3);
    await signOut(auth);
    await assert.rejects(
      () => transferWarehouseStock(WORKSPACE_ID, input(f, 'anonymous', 1)),
      /WAREHOUSE_LOCATION_AUTH_REQUIRED/
    );
    const unauthenticatedApp = initializeApp({
      projectId: PROJECT_ID, apiKey: 'fake-api-key',
      authDomain: PROJECT_ID + '.firebaseapp.com',
    }, 'f06-anonymous-client');
    try {
      const anonymousDb = getFirestore(unauthenticatedApp, WAREHOUSE_DATABASE);
      connectFirestoreEmulator(anonymousDb, '127.0.0.1', 8080);
      await assert.rejects(
        () => getDoc(doc(anonymousDb, pathFor('materials', f.materialId))),
        (error) => error?.code === 'permission-denied'
      );
    } finally {
      await deleteApp(unauthenticatedApp);
    }
    await signInWithCredential(auth, GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'f06-founder-emulator', email: OWNER_EMAIL, email_verified: true })
    ));
    await assertState(f, 3, 0, 0);
  });

  const final = await snapshot('materials', fixtureId(1));
  assert.equal(final.exists(), true);
  console.log('F06 CERTIFICATION: transactional assertions executed on the named Firestore Emulator');
  console.log('WORKER8_DIAGNOSTIC_ONLY: case 4 proof adapter does not certify the production engine');
});
