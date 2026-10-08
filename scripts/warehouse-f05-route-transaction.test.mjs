#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Executes the production POST implementation with a Firestore REST contract fake:
// two databases, document versions, and all-or-nothing preconditioned commit.
// Not a Firebase Emulator/Rules test; it validates the route's transaction shape.
const source = readFileSync(resolve('app/api/adm-deposito/intake-action/route.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const workspaceId = 'ws-test', ug = '160416', uid = 'operator';
const hash = (s) => createHash('sha256').update(s).digest('hex');
const materialId = 'mat_' + 'a'.repeat(32);
const intakeId = 'intake_' + 'b'.repeat(64);
const position = { kind: 'LOCAL', depotId: 'dep_1', locationId: 'loc_1' };
const root = 'warehouse/' + workspaceId;
const now = '2026-10-08T18:00:00.000Z';
const invoice = { id: 'invoice-1', empenhoId: 'emp-1', supplier: 'Fornecedor', items: [{ itemId: 'item-1', quantity: 10 }] };
const empenho = { id: 'emp-1', supplier: 'Fornecedor', items: [{ id: 'item-1', name: 'Material de teste', unit: 'UN' }] };
const baseInput = {
  intakeId, invoiceRecordKey: 'nf-1', invoiceId: 'invoice-1', empenhoId: 'emp-1',
  itemId: 'item-1', expectedAllocatedQuantity: 0, expectedImmediateConsumptionQuantity: 0,
  effectiveStatus: 'PENDING', quantity: 4, operationId: 'operation_123',
  position, lotCode: 'LOT1', expiresOn: '2027-01-01', barcode: null,
};
const encode = (v) => {
  if (v === null) return { nullValue: 'NULL_VALUE' };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([,x]) => x !== undefined).map(([k,x]) => [k, encode(x)])) } };
};
const decode = (v) => 'stringValue' in v ? v.stringValue
  : 'timestampValue' in v ? v.timestampValue
  : 'integerValue' in v ? Number(v.integerValue)
  : 'doubleValue' in v ? v.doubleValue
  : 'booleanValue' in v ? v.booleanValue
  : 'nullValue' in v ? null
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(decode)
  : Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,x]) => [k, decode(x)]));
const fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, encode(v)]));
function fixture() {
  const docs = new Map();
  let revision = 0, commits = 0, failure = null;
  const put = (database, path, data) => docs.set(database + '/' + path, { data, version: String(++revision) });
  put('core', 'workspaces/' + workspaceId + '/invoices/nf-1', invoice);
  put('core', 'workspaces/' + workspaceId + '/empenhos/emp-1', empenho);
  put('emprovex-warehouse', root + '/depots/dep_1', { workspaceId, ug, status: 'active' });
  put('emprovex-warehouse', root + '/locations/loc_1', { workspaceId, ug, status: 'active', depotId: 'dep_1', kind: 'LOCAL' });
  return {
    docs, put, get: (database,path) => docs.get(database + '/' + path)?.data,
    get commits() { return commits; }, setFailure: (value) => failure = value,
    async fetch(url, options = {}) {
      const match = url.match(/\/databases\/([^/]+)\/documents(?::commit|\/([^?]*))$/);
      assert.ok(match, url);
      const database = decodeURIComponent(match[1]) === 'emprovex-warehouse' ? 'emprovex-warehouse' : 'core';
      const path = match[2]?.split('/').map(decodeURIComponent).join('/');
      const respond = (body, status = 200) => ({
        ok: status >= 200 && status < 300, status,
        json: async () => body, text: async () => JSON.stringify(body),
      });
      if (options.method !== 'POST') {
        if (failure?.read) return respond({ error: 'FORBIDDEN' }, failure.read);
        const existing = docs.get(database + '/' + path);
        return existing ? respond({ fields: fields(existing.data), updateTime: existing.version }) : respond({}, 404);
      }
      if (failure?.commit) return respond({ error: failure.commit === 412 ? 'FAILED_PRECONDITION' : 'PERMISSION_DENIED' }, failure.commit);
      const writes = JSON.parse(options.body).writes;
      for (const write of writes) {
        const name = write.update.name;
        const key = database + '/' + name.split('/documents/')[1];
        const current = docs.get(key);
        if (write.currentDocument.exists === false && current) return respond({ error: 'FAILED_PRECONDITION' }, 412);
        if (write.currentDocument.updateTime && current?.version !== write.currentDocument.updateTime) return respond({ error: 'FAILED_PRECONDITION' }, 412);
      }
      // Atomic apply: preconditions are evaluated before any document is changed.
      for (const write of writes) {
        const key = database + '/' + write.update.name.split('/documents/')[1];
        docs.set(key, { data: Object.fromEntries(Object.entries(write.update.fields).map(([k,v]) => [k,decode(v)])), version: String(++revision) });
      }
      commits++;
      return respond({});
    },
  };
}
const val = (obj) => ({ ok: true, data: obj });
function makeRoute(fx) {
  const helpers = {
    'next/server': { NextResponse: { json: (payload, init) => ({ status: init?.status || 200, payload }) } },
    'firebase-applet-config.json': { projectId: 'demo-test', firestoreDatabaseId: 'core' },
    'firebaseFounderAuth': { FounderAuthError: class FounderAuthError extends Error {} },
    'sectorProvisioningAdmin': { getGoogleAccessToken: async () => 'mock-admin', SectorProvisioningFailure: class SectorProvisioningFailure extends Error {} },
    'warehouseAccess': { verifyWarehouseRequest: async () => ({ workspaceId, ug, uid }), WarehouseAccessError: class WarehouseAccessError extends Error {} },
    'barcode': { normalizeWarehouseBarcode: (v) => v, createWarehouseBarcodeId: async (_w,b) => 'bc_' + hash(b).slice(0,32), barcodeAssociationMatchesMaterial: () => true, WAREHOUSE_BARCODE_SCHEMA_VERSION: 'warehouse_barcode_v1' },
    'invoiceIntegration': { deriveWarehouseMaterialIdForEmpenhoItem: async () => materialId, warehouseUnitFromOperationalLabel: (v) => ({code: v, label: v}) },
    'intake': { createWarehouseItemIntakeId: async () => intakeId },
    'intakeState': { calculateWarehouseItemIntakePendingQuantity: (r,a,c) => r-a-c, deriveWarehouseItemIntakeStatus: (r,a,c) => r-a-c <= 0 ? 'PROCESSED' : a+c > 0 ? 'PARTIALLY_PROCESSED' : 'PENDING', validateWarehouseItemIntakeState: val, WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION: 'warehouse_item_intake_v2' },
    'location': { createWarehouseLocationBalanceId: async () => 'lb_1', normalizeWarehouseLocationQuantity: (v) => Number.isFinite(v) && v >= 0 ? v : null, validateWarehouseStockPosition: (v) => v?.kind === 'LOCAL' ? v : null, warehouseStockPositionKey: (p) => JSON.stringify(p), WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION: 'warehouse_location_balance_v1' },
    'lot': { createWarehousePendingLotCode: () => 'PENDING', normalizeWarehouseExpiryDate: (v) => v, normalizeWarehouseLotCode: (v) => v, validateWarehouseLot: val, WAREHOUSE_LOT_SCHEMA_VERSION: 'warehouse_lot_v1' },
    'material': { createWarehouseMaterial: (v) => val({ ...v, schemaVersion: 'warehouse_material_v1' }), normalizeWarehouseMaterialId: (v) => v || null, WAREHOUSE_MATERIAL_SCHEMA_VERSION: 'warehouse_material_v1' },
    'movement': { createWarehouseMovementId: async (_w,k) => 'mov_' + hash(k).slice(0,40), normalizeWarehouseQuantity: (v) => Number.isFinite(v) && v >= 0 ? v : null, WAREHOUSE_BALANCE_SCHEMA_VERSION: 'warehouse_balance_v1', WAREHOUSE_MOVEMENT_SCHEMA_VERSION: 'warehouse_movement_v1' },
    'withdrawal': { normalizeWarehouseWithdrawnBy: (v) => v, WAREHOUSE_CONSUMPTION_SCHEMA_VERSION: 'warehouse_consumption_v1', WAREHOUSE_DESTINATION_SCHEMA_VERSION: 'warehouse_destination_v1' },
  };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, exports: module.exports, require: (id) => {
      const key = Object.keys(helpers).find((k) => id.endsWith(k));
      if (!key) throw new Error('Unexpected import ' + id);
      return helpers[key];
    },
    fetch: fx.fetch.bind(fx), crypto: webcrypto, TextEncoder, Date, JSON, console,
  });
  return async (input = baseInput) => module.exports.POST({
    headers: { get: () => 'Bearer mock' },
    json: async () => ({ action: 'ALLOCATE', workspaceId, input }),
  });
}
test('first allocation and identical replay: exactly one atomic ledger movement', async () => {
  const fx = fixture(), post = makeRoute(fx);
  const first = await post();
  assert.equal(first.status, 200, JSON.stringify(first));
  assert.equal(first.payload.result.applied, true);
  assert.equal(fx.commits, 1);
  assert.equal(fx.get('emprovex-warehouse',root+'/balances/'+materialId).quantity, 4);
  assert.equal(fx.get('emprovex-warehouse',root+'/locationBalances/lb_1').quantity, 4);
  assert.equal(fx.get('emprovex-warehouse',root+'/intakes/'+intakeId).pendingQuantity, 6);
  const lots = [...fx.docs.keys()].filter((k) => k.includes('/lots/'));
  const movements = [...fx.docs.keys()].filter((k) => k.includes('/movements/'));
  assert.equal(lots.length, 1); assert.equal(movements.length, 1);
  assert.equal(fx.docs.get(lots[0]).data.quantity, 4);
  const retry = await post();
  assert.equal(retry.status, 200, JSON.stringify(retry));
  assert.equal(retry.payload.result.applied, false);
  assert.equal(fx.commits, 1);
  const changed = await post({ ...baseInput, barcode: '7891234567890' });
  assert.equal(changed.status, 409); assert.equal(changed.payload.error, 'WAREHOUSE_IDEMPOTENCY_CONFLICT');
  assert.equal(fx.commits, 1);
});
test('permission denied, stale preconditions and atomic refusal do not mutate stock', async () => {
  for (const code of [403, 412]) {
    const fx = fixture(), post = makeRoute(fx);
    fx.setFailure({ commit: code });
    const rejected = await post();
    assert.equal(rejected.status, code === 403 ? 503 : 409);
    assert.equal(fx.commits, 0);
    assert.equal(fx.get('emprovex-warehouse',root+'/balances/'+materialId), undefined);
    assert.equal([...fx.docs.keys()].filter((k) => k.includes('/movements/')).length, 0);
  }
});
test('read permission refusal is classified before committing', async () => {
  const fx = fixture(), post = makeRoute(fx);
  fx.setFailure({ read: 403 });
  const response = await post();
  assert.equal(response.payload.error, 'WAREHOUSE_FAST_PATH_UPSTREAM_PERMISSION');
  assert.equal(fx.commits, 0);
});

test('historical lot retains timestamp encoding on allocation update', async () => {
  const fx = fixture(), post = makeRoute(fx);
  const lotId = 'lot_' + hash([workspaceId, intakeId, 'LOT1', JSON.stringify(position)].join(String.fromCharCode(10))).slice(0, 32);
  const legacyLot = {
    schemaVersion: 'warehouse_lot_v1', id: lotId, workspaceId, ug, materialId,
    code: 'LOT1', expiresOn: '2027-01-01', position, quantity: 2,
    status: 'active', origin: { kind: 'INVOICE' }, createdBy: uid, updatedBy: uid,
    createdAt: now,
  };
  fx.put('emprovex-warehouse', root + '/lots/' + lotId, legacyLot);
  const response = await post();
  assert.equal(response.status, 200, JSON.stringify(response));
  assert.equal(fx.get('emprovex-warehouse', root + '/lots/' + lotId).quantity, 6);
});
