import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const mobileFlows = [
  'WarehouseMobileIntakeAllocation', 'WarehouseMobileTransfer',
  'WarehouseMobileInventory', 'WarehouseMobileOutbound',
  'WarehouseMobileItemQuery', 'WarehouseMobileManualEntry',
];
test('seis telas móveis não acessam mais barcodeRepository diretamente', () => {
  for (const name of mobileFlows) {
    const source = file('features/warehouse/mobile/' + name + '.tsx');
    assert.match(source, /getWarehouseMobileBarcodeByCode/);
    assert.doesNotMatch(source, /barcodeRepository/);
    assert.doesNotMatch(source, /getWarehouseBarcodeByCode\(/);
  }
});
test('servidor autentica e valida workspace/UG e caminhos fixos', () => {
  const route = file('app/api/central-depositos/mobile-barcode/route.ts');
  const service = file('lib/server/warehouseMobileBarcodeRead.ts');
  const store = file('lib/server/warehouseFirestoreTransaction.ts');
  assert.match(route, /verifyWarehouseRequest/);
  assert.match(route, /input\.workspaceId !== access\.workspaceId/);
  assert.match(route, /Object\.keys\(input\)\.length !== 2/);
  assert.match(service, /createWarehouseBarcodeId\(access\.workspaceId, code\)/);
  assert.match(service, /expectedUg: access\.ug/);
  assert.match(service, /warehouseAdminBatchRead/);
  assert.match(store, /export async function warehouseAdminBatchRead/);
  assert.match(store, /expected\.has\(name\)/);
  assert.match(store, /WAREHOUSE_SERVER_INCOMPLETE_READ/);
});
test('cliente não faz fallback ao SDK e propaga indisponibilidade do servidor', () => {
  const source = file('lib/warehouse/mobileBarcodeReadClient.ts');
  assert.match(source, /getCurrentOperationalScope/);
  assert.match(source, /getIdToken\(\)/);
  assert.match(source, /\/api\/central-depositos\/mobile-barcode/);
  assert.doesNotMatch(source, /getDoc\(|getDocs\(|setDoc\(|updateDoc\(/);
});
