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
  // O contexto antigo sem sectorType é normalizado sem perder UID/UG/workspace.
  assert.deepEqual(result, { ...verified, sectorType: 'aprovisionamento' });
  assert.equal(bind({ ...verified, sectorType: 'almoxarifado' }, verified.workspaceId).sectorType, 'almoxarifado');
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
    ['modalidade desconhecida', { ...verified, sectorType: 'company' }, verified.workspaceId],
    ['sem contexto', null, verified.workspaceId],
  ]) {
    assert.throws(() => bind(access, ws), (e) =>
      e instanceof WarehouseMobileTrustError && e.status === 403, name);
  }
});

test('motor é fail-closed para operações não aprovadas no piloto', () => {
  for (const action of ['BULK_READ', 'ADMIN_DELETE', '', null]) {
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


test('motor de confiança cobre as oito jornadas pelas operacoes reais', () => {
  const trust = file('lib/server/warehouseMobileTrust.mjs');
  const operations = file('app/api/central-depositos/operations/route.ts');
  const intake = file('app/api/central-depositos/intake-action/route.ts');
  const manual = file('app/api/central-depositos/manual-entry/route.ts');
  const queue = file('app/api/central-depositos/queue/route.ts');
  for (const action of ['BARCODE_READ','QUEUE_READ','MATERIAL_READ','POSITION_READ',
    'POSITION_BALANCES_READ','STOCK_READ','INVENTORY_READ','POSITION_CHECK','POSITION_CONTENTS',
    'ALLOCATE','MANUAL_ENTRY','TRANSFER','WITHDRAWAL_FINALIZE','DESTINATION_CREATE',
    'INVENTORY_START','INVENTORY_COUNT','INVENTORY_REVIEW','INVENTORY_REOPEN',
    'INVENTORY_BEGIN_CONFIRM','INVENTORY_ADJUST','INVENTORY_STALE',
    'INVENTORY_FINISH_CONFIRM','INVENTORY_CANCEL']) {
    assert.match(trust, new RegExp("'"+action+"'"));
  }
  assert.match(operations, /bindWarehouseMobileTrust\(verified/);
  assert.match(operations, /isWarehouseMobilePilotAction\(operation\)/);
  assert.match(intake, /performAllocation\(accessToken, trusted/);
  assert.match(manual, /registerWarehouseManualEntryServer\(trusted/);
  assert.match(queue, /readWarehouseInvoiceQueueServer\(trusted/);
  assert.doesNotMatch(trust, /getDoc\(|getDocs\(|fetch\(|getGoogleAccessToken\(/);
});


test('oito fluxos moveis usam repositorios de leitura server-only', () => {
  const ui={
    WarehouseMobileIntakeAllocation:['mobileBarcodeReadClient','mobileLocationBarcodeResolver'],
    WarehouseMobileManualEntry:['mobileMaterialRead','mobileLocationBarcodeResolver'],
    WarehouseMobileTransfer:['mobileLocationRead','mobileMaterialRead'],
    WarehouseMobileOutbound:['mobileOutboundRepository','mobileDestinationClient'],
    WarehouseMobileInventory:['mobileInventoryClient','mobileMaterialRead'],
    WarehouseMobileItemQuery:['mobileOutboundRepository'],
    WarehouseMobileLocationFoundationCheck:['mobilePhysicalQuery','mobileLocationBarcodeResolver'],
    WarehouseMobilePositionCheck:['mobilePositionCheck','mobileLocationBarcodeResolver'],
  };
  for(const [name,expected] of Object.entries(ui)){
    const source=file('features/warehouse/mobile/'+name+'.tsx');
    for(const module of expected)assert.match(source,new RegExp(module));
    assert.doesNotMatch(source,/from ['"]firebase\/firestore['"]/);
  }
  for(const name of ['mobilePhysicalQuery','mobilePositionCheck','mobileOutboundRepository']){
    const source=file('lib/warehouse/'+name+'.ts');
    assert.match(source,/mobileReadSdkBridge/);
    assert.doesNotMatch(source,/from ['"]firebase\/firestore['"]/);
  }
  for(const name of ['mobileMaterialRead','mobileLocationRead','mobileInventoryClient',
    'mobileDestinationClient']){
    assert.match(file('lib/warehouse/'+name+'.ts'),/mobileReadSdkBridge/);
  }
  const resolver=file('lib/warehouse/mobileLocationBarcodeResolver.ts');
  assert.match(resolver,/mobileLocationRead/);
  assert.doesNotMatch(resolver,/from ['"]\.\/locationRepository['"]/);
});

test('gateway da leitura so aceita consultas fechadas e verifica UG por registro',()=>{
  const api=file('app/api/central-depositos/mobile-read/route.ts');
  const server=file('lib/server/warehouseMobileRead.ts');
  const bridge=file('lib/warehouse/mobileReadSdkBridge.ts');
  const transaction=file('lib/server/warehouseFirestoreTransaction.ts');
  assert.match(api,/verifyWarehouseRequest/);
  assert.match(api,/bindWarehouseMobileTrust/);
  assert.match(api,/WAREHOUSE_MOBILE_READ_INVALID_JSON/);
  assert.match(api,/Object\.keys\(input\)\.sort\(\)/);
  assert.match(server,/r\.data\.workspaceId|row\.data\.workspaceId/);
  assert.match(server,/row\.data\.ug !== access\.ug/);
  assert.match(server,/warehouseAdminBatchRead/);
  assert.match(server,/warehouseAdminReadScopedQuery/);
  assert.match(server,/new Set\(r\.ids\)/);
  assert.match(server,/FILTERS\[r\.domain\]/);
  assert.match(transaction,/WAREHOUSE_MOBILE_READ_OUT_OF_SCOPE/);
  assert.match(bridge,/\/api\/central-depositos\/mobile-read/);
  assert.doesNotMatch(bridge,/from ['"]firebase\/firestore['"]/);
});
