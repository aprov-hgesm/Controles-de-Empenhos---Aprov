import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  bindWarehouseMobileTrust,
  WarehouseMobileTrustError,
} from '../lib/server/warehouseMobileTrust.mjs';

const file = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const mobileFlows = [
  'WarehouseMobileIntakeAllocation', 'WarehouseMobileTransfer',
  'WarehouseMobileInventory', 'WarehouseMobileOutbound',
  'WarehouseMobileItemQuery', 'WarehouseMobileManualEntry',
];
const verified = Object.freeze({
  uid: 'user-pilot', email: 'verified@example.test',
  workspaceId: 'hgesm-aprov', ug: '160416', claimsUpdated: false,
});
const bind = (access, workspaceId, action = 'BARCODE_READ') =>
  bindWarehouseMobileTrust(access, { workspaceId, action });

test('seis telas móveis dependem da leitura de barcode no servidor, sem fallback legado', () => {
  for (const name of mobileFlows) {
    const source = file('features/warehouse/mobile/' + name + '.tsx');
    assert.match(source, /getWarehouseMobileBarcodeByCode/);
    assert.doesNotMatch(source, /barcodeRepository/);
    assert.doesNotMatch(source, /getWarehouseBarcodeByCode\(/);
  }
});

test('motor autoriza sessao vinculada a workspace e UG, sem consultar Rule por chamada', () => {
  const result = bind(verified, verified.workspaceId);
  assert.deepEqual(result, verified);
  assert.equal(Object.isFrozen(result), true);
  assert.notEqual(result, verified);
  const engine = file('lib/server/warehouseMobileTrust.mjs');
  assert.doesNotMatch(engine, /getDoc\(|getDocs\(|fetch\(|getGoogleAccessToken\(/);
});

test('motor rejeita acesso entre workspaces, falta de identidade e UG inválida', () => {
  for (const [name, access, ws] of [
    ['workspace alheio', verified, 'outro-workspace'],
    ['falta de identidade', { ...verified, uid: '' }, verified.workspaceId],
    ['email não validado', { ...verified, email: '' }, verified.workspaceId],
    ['UG inválida', { ...verified, ug: '999' }, verified.workspaceId],
    ['sem contexto', null, verified.workspaceId],
  ]) {
    assert.throws(() => bind(access, ws), (e) =>
      e instanceof WarehouseMobileTrustError && e.status === 403, name);
  }
});

test('motor é fail-closed para operações não aprovadas no piloto', () => {
  for (const action of ['TRANSFER', 'INVENTORY_ADJUST', 'BULK_READ', '', null]) {
    assert.throws(() => bind(verified, verified.workspaceId, action),
      /WAREHOUSE_MOBILE_TRUST_ACTION_DENIED/);
  }
});

test('servidor autentica uma vez, vincula workspace e valida documentos por UG', () => {
  const route = file('app/api/central-depositos/mobile-barcode/route.ts');
  const service = file('lib/server/warehouseMobileBarcodeRead.ts');
  const store = file('lib/server/warehouseFirestoreTransaction.ts');
  assert.match(route, /verifyWarehouseRequest/);
  assert.match(route, /bindWarehouseMobileTrust\(access/);
  assert.match(route, /readWarehouseMobileBarcodeServer\(trusted, input\.barcode\)/);
  assert.match(route, /Object\.keys\(input\)\.length !== 2/);
  assert.match(route, /WAREHOUSE_MOBILE_BARCODE_INVALID_JSON/);
  assert.equal((route.match(/await verifyWarehouseRequest\(/g) || []).length, 1);
  assert.match(service, /createWarehouseBarcodeId\(access\.workspaceId, code\)/);
  assert.match(service, /expectedUg: access\.ug/);
  assert.match(service, /warehouseAdminBatchRead/);
  assert.match(store, /export async function warehouseAdminBatchRead/);
  assert.match(store, /expected\.has\(name\)/);
  assert.match(store, /WAREHOUSE_SERVER_INCOMPLETE_READ/);
});

test('SDK direto nao é fallback em falha de IAM e Rule continua protegendo clientes', () => {
  const client = file('lib/warehouse/mobileBarcodeReadClient.ts');
  const rules = file('firestore.warehouse.server-only.rules');
  const config = JSON.parse(file('firebase.json'));
  assert.match(client, /getCurrentOperationalScope/);
  assert.match(client, /getIdToken\(\)/);
  assert.match(client, /\/api\/central-depositos\/mobile-barcode/);
  assert.doesNotMatch(client, /getDoc\(|getDocs\(|setDoc\(|updateDoc\(/);
  assert.match(rules, /allow create, update, delete: if false/);
  assert.match(rules, /isBoundSector/);
  assert.match(rules, /isFounderWorkspace/);
  assert.equal(config.firestore.find(x=>x.database==='emprovex-warehouse')?.rules,
    'firestore.warehouse.server-only.rules');
});
