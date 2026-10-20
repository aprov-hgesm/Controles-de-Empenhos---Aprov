import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadTypeScript(path, imports) {
  const content = readFileSync(resolve(ROOT, path), 'utf8');
  const output = ts.transpileModule(content, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(
    (name) => {
      assert.ok(Object.hasOwn(imports, name), 'unexpected repository import: ' + name);
      return imports[name];
    },
    module,
    module.exports
  );
  return module.exports;
}

// Exercise the production repository implementation, with deterministic Firestore
// document mocks. No emulator, network, production data or actual billed reads.
function createHarness() {
  let now = 1_000;
  let requests = 0;
  let observedDocuments = 0;
  let writes = 0;
  let denyWrites = false;
  const docs = new Map();
  const user = { uid: 'operator-a' };
  const scopes = new Map([
    ['operator-a', { workspaceId: 'ws-a', ug: 'UG-1' }],
    ['operator-b', { workspaceId: 'ws-a', ug: 'UG-1' }],
    ['operator-c', { workspaceId: 'ws-a', ug: 'UG-2' }],
    ['operator-d', { workspaceId: 'ws-b', ug: 'UG-1' }],
  ]);
  const memory = loadTypeScript('lib/warehouse/memoryReadCache.ts', {});
  const pathFor = (workspaceId, domain, id) => workspaceId + '/' + domain + '/' + id;
  const fakeFirestore = {
    doc: (_db, path) => ({ path }),
    getDoc: async (ref) => {
      requests += 1;
      await Promise.resolve();
      const found = docs.get(ref.path);
      return {
        id: ref.path.split('/').at(-1),
        exists: () => found !== undefined,
        data: () => found,
      };
    },
    updateDoc: async (ref, patch) => {
      if (denyWrites) throw new Error('PERMISSION_DENIED');
      writes += 1;
      const old = docs.get(ref.path);
      if (!old) throw new Error('NOT_FOUND');
      docs.set(ref.path, { ...old, ...patch });
    },
    // The tested functions do not use these other calls.
    collection: () => { throw new Error('UNEXPECTED_COLLECTION'); },
    getDocs: () => { throw new Error('UNEXPECTED_GET_DOCS'); },
    query: () => { throw new Error('UNEXPECTED_QUERY'); },
    runTransaction: async (_db, callback) => callback({
      get: async (ref) => {
        const found = docs.get(ref.path);
        return {
          id: ref.path.split('/').at(-1),
          exists: () => found !== undefined,
          data: () => found,
        };
      },
      set: () => { throw new Error('UNEXPECTED_TRANSACTION_SET'); },
      update: () => { throw new Error('UNEXPECTED_TRANSACTION_UPDATE'); },
    }),
    limit: () => { throw new Error('UNEXPECTED_LIMIT'); },
    serverTimestamp: () => 'server-time',
  };
  const imports = {
    'firebase/firestore': fakeFirestore,
    './telemetry': {
      recordWarehouseDocumentReads: (_workspaceId, count) => { observedDocuments += count; },
    },
    '../firebase': {
      auth: { currentUser: user },
      warehouseDb: {},
      handleFirestoreError: (error) => { throw error; },
      OperationType: { GET: 'GET', LIST: 'LIST', WRITE: 'WRITE' },
    },
    '../operationalPaths': { getCurrentOperationalScope: (uid) => scopes.get(uid) },
    './barcode': {
      createWarehouseBarcodeId: async (_workspaceId, barcode) => 'bar_' + barcode,
      normalizeWarehouseBarcode: (barcode) => barcode.trim(),
      validateWarehouseBarcodeAssociation: (data) => ({ ok: true, data }),
    },
    './material': {
      normalizeWarehouseMaterialUnit: (value) => value,
      validateWarehouseMaterial: (data) => ({ ok: true, data }),
    },
    './locationBarcode': { isWarehouseLocationBarcode: () => false },
    './location': {
      validateWarehouseStockPosition: (position) => position,
      createWarehouseLocationBalanceId: async () => 'locbal_test',
      validateWarehouseLocationBalance: (value) => ({ ok: true, data: value }),
    },
    './lot': { validateWarehouseLot: (value) => ({ ok: true, data: value }) },
    './movement': {
      createWarehouseMovementId: async () => 'mov_test',
      validateWarehouseBalance: (value) => ({ ok: true, data: value }),
      validateWarehouseMovement: (value) => ({ ok: true, data: value }),
    },
    './outbound': {},

    './namespace': {
      warehouseDomainPath: (ws, domain) => pathFor(ws, domain, ''),
      warehouseDocumentPath: pathFor,
    },
    './readCompatibility': {
      warehouseCanonicalBarcodeReadInput: (id, data) => ({ ...data, id }),
      warehouseCanonicalMaterialReadInput: (id, data) => ({ ...data, id }),
      warehouseCanonicalLocationBalanceReadInput: (id, data) => ({ ...data, id }),
      warehouseCanonicalLotReadInput: (id, data) => ({ ...data, id }),
    },
    './memoryReadCache': {
      createWorkspaceMemoryReadCache: (options) => memory.createWorkspaceMemoryReadCache({
        ...options,
        now: () => now,
      }),
    },
  };
  const repository = loadTypeScript('lib/warehouse/barcodeRepository.ts', imports);
  const outbound = loadTypeScript('lib/warehouse/outboundRepository.ts', imports);
  function seed(workspaceId = 'ws-a', barcode = '7891234567890', status = 'active') {
    docs.set(pathFor(workspaceId, 'barcodes', 'bar_' + barcode), {
      barcode, workspaceId, ug: 'UG-1', status, materialId: 'material-1',
    });
  }
  return {
    repository, outbound, user, seed, docs, pathFor,
    get requests() { return requests; },
    get observedDocuments() { return observedDocuments; },
    get writes() { return writes; },
    advance: (delta) => { now += delta; },
    denyWrites: (value) => { denyWrites = value; },
  };
}

test('repository real: scanner repete código com 1 getDoc e evita 4 requests de 5', async () => {
  const h = createHarness();
  h.seed();
  for (let i = 0; i < 5; i += 1) {
    const association = await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890');
    assert.equal(association.status, 'active');
  }
  assert.equal(h.requests, 1, 'baseline without cache: five getDoc calls');
  assert.equal(h.observedDocuments, 1);
});

test('repository real: solicitações concorrentes compartilham getDoc', async () => {
  const h = createHarness();
  h.seed();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890'))
  );
  assert.equal(h.requests, 1);
  assert.ok(results.every((result) => result.materialId === 'material-1'));
});

test('repository real: TTL expira aos 30 segundos e resultado ausente não gera consultas repetidas', async () => {
  const h = createHarness();
  assert.equal(await h.repository.getWarehouseBarcodeByCode('ws-a', 'MISSING'), null);
  assert.equal(await h.repository.getWarehouseBarcodeByCode('ws-a', 'MISSING'), null);
  assert.equal(h.requests, 1);
  h.advance(30_000);
  h.seed('ws-a', 'MISSING');
  assert.equal((await h.repository.getWarehouseBarcodeByCode('ws-a', 'MISSING')).status, 'active');
  assert.equal(h.requests, 2);
});

test('repository real: workspace e identidade UID/UG não compartilham resultado', async () => {
  const h = createHarness();
  h.seed('ws-a');
  h.seed('ws-b');
  await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890');
  h.user.uid = 'operator-b';
  await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890');
  h.user.uid = 'operator-c';
  await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890');
  h.user.uid = 'operator-d';
  await h.repository.getWarehouseBarcodeByCode('ws-b', '7891234567890');
  assert.equal(h.requests, 4);
  await assert.rejects(
    h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890'),
    /WAREHOUSE_BARCODE_SCOPE_MISMATCH/
  );
});

test('repository real: write bem-sucedido invalida; write negado preserva valor cacheado', async () => {
  const h = createHarness();
  h.seed();
  assert.equal((await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890')).status, 'active');
  await h.repository.setWarehouseBarcodeStatus('ws-a', 'bar_7891234567890', 'inactive');
  assert.equal((await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890')).status, 'inactive');
  assert.equal(h.requests, 2);
  assert.equal(h.writes, 1);
  h.denyWrites(true);
  await assert.rejects(
    h.repository.setWarehouseBarcodeStatus('ws-a', 'bar_7891234567890', 'active'),
    /PERMISSION_DENIED/
  );
  assert.equal((await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890')).status, 'inactive');
  assert.equal(h.requests, 2);
});

test('repository real: cache de barcode não é autoridade de saldo nem valida escrita', async () => {
  const h = createHarness();
  h.seed();
  await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890');
  assert.equal(h.requests, 1);
  assert.equal(h.writes, 0, 'lookup must not write stock');
  // External change is visible once TTL expires; mutations must still
  // validate authoritative Firestore state separately at confirmation time.
  h.docs.set(h.pathFor('ws-a', 'barcodes', 'bar_7891234567890'), {
    barcode: '7891234567890', workspaceId: 'ws-a', ug: 'UG-1',
    status: 'inactive', materialId: 'material-1',
  });
  h.advance(30_000);
  assert.equal((await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890')).status, 'inactive');
  assert.equal(h.requests, 2);
});


test('repository real: leitura cacheada não autoriza mutação contra material inativo', async () => {
  const h = createHarness();
  h.seed();
  const cached = await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890');
  assert.equal(cached.status, 'active');
  h.docs.set(h.pathFor('ws-a', 'materials', 'material-1'), {
    workspaceId: 'ws-a', ug: 'UG-1', status: 'inactive', id: 'material-1',
  });
  await assert.rejects(
    h.repository.saveWarehouseBarcodeAssociation('ws-a', {
      barcode: '7891234567890',
      materialId: 'material-1',
      presentation: { code: 'unit', label: 'Unidade' },
    }),
    /WAREHOUSE_MATERIAL_INACTIVE/
  );
  assert.equal(h.writes, 0);
});

test('outbound real: barcode stale não supera reread transacional do Firestore', async () => {
  const h = createHarness();
  h.seed();
  const barcode = await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890');
  assert.equal(barcode.status, 'active');
  h.docs.set(h.pathFor('ws-a', 'materials', 'material-1'), {
    workspaceId: 'ws-a', ug: 'UG-1', status: 'active', id: 'material-1',
  });
  h.docs.set(h.pathFor('ws-a', 'balances', 'material-1'), {
    schemaVersion: 'warehouse_balance_v1', workspaceId: 'ws-a',
    ug: 'UG-1', materialId: 'material-1', quantity: 15,
    revision: 1, lastMovementId: 'mov_previous',
  });
  // Another operator changed the association while our short read cache is still warm.
  h.docs.set(h.pathFor('ws-a', 'barcodes', 'bar_7891234567890'), {
    ...barcode, status: 'inactive',
  });
  assert.equal((await h.repository.getWarehouseBarcodeByCode('ws-a', '7891234567890')).status, 'active');
  await assert.rejects(
    h.outbound.applyWarehouseExpressOutbound('ws-a', {
      materialId: 'material-1',
      requestedQuantity: 1,
      presentation: { code: 'unit', label: 'Unidade' },
      position: { kind: 'LOCATION', depotId: 'depot-1', locationId: 'location-1' },
      barcodeAssociation: barcode,
      idempotencyKey: 'test-idempotency',
    }),
    /WAREHOUSE_BARCODE_CHANGED/
  );
  assert.equal(h.writes, 0, 'no movement or stock writes may follow a changed barcode');
});
