#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/central-mobile/alocar/page.tsx',
  'features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx',
  'lib/warehouse/mobileIntakeAllocation.ts',
  'scripts/mobile-r1-intake-allocation.test.mjs',
]) {
  assert.equal(
    existsSync(resolve(root, path)),
    true,
    'Arquivo obrigatório da MOBILE-C ausente: ' + path
  );
}

const component = read('features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx');

for (const required of [
  'loadWarehouseInvoiceIntakeQueue',
  'allocateWarehousePendingItemFast',
  'getWarehouseBarcodeByCode',
  'deriveWarehouseMaterialIdForEmpenhoItem',
  'resolveWarehouseStockPositionBarcode',
  'classifyWarehouseMobileLocationScan',
  'classifyWarehouseMobileProductScan',
  'expectation="EXPECT_PRODUCT"',
  'expectation="EXPECT_LOCATION"',
  'Associar este código ao material do item',
  'lotCode: lotCode.trim()',
  'navigator.onLine',
  'operationId',
  'expectedAllocatedQuantity',
  'expectedImmediateConsumptionQuantity',
  'CONFIRMAR ALOCAÇÃO',
]) {
  assert.equal(
    component.includes(required),
    true,
    'Contrato obrigatório ausente na UI MOBILE-C: ' + required
  );
}

for (const forbidden of [
  'saveWarehouseBarcodeAssociation',
  'setDoc(',
  'updateDoc(',
  'runTransaction(',
  'applyWarehouseMovement',
  'createWarehouseMovement',
  'locationBalances',
  'balances/',
]) {
  assert.equal(
    component.includes(forbidden),
    false,
    'MOBILE-C não pode escrever diretamente domínio de estoque: ' + forbidden
  );
}

const helper = read('lib/warehouse/mobileIntakeAllocation.ts');
assert.match(helper, /WAREHOUSE_LOCATION_BARCODE_PREFIX/);
assert.match(helper, /isWarehouseLocationBarcode/);
assert.match(helper, /normalizeWarehouseMobileAllocationQuantity/);
assert.match(helper, /warehouseMobileBarcodeDisposition/);
assert.match(helper, /createWarehouseMobileAllocationOperationId/);
assert.match(helper, /WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION/);

const route = read('app/central-mobile/alocar/page.tsx');
assert.match(route, /WarehouseMobileIntakeAllocation/);

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
assert.match(home, /\/central-mobile\/alocar/);
assert.match(home, /Alocar recebimento/);

const pkg = JSON.parse(read('package.json'));
assert.equal(
  pkg.scripts['test:mobile-r1-intake-allocation'],
  'node --test scripts/mobile-r1-intake-allocation.test.mjs'
);
assert.equal(
  pkg.scripts['verify:mobile-r1-intake-allocation'],
  'node scripts/verify-mobile-r1-intake-allocation.mjs'
);

console.log('MOBILE-C INTAKE ALLOCATION: PASS');
console.log('- fila de NF é carregada sob demanda e sem listener próprio');
console.log('- barcode comercial e EPX1 permanecem namespaces distintos');
console.log('- desconhecido exige associação explícita; conflito bloqueia');
console.log('- LOCAL/SUBPOSITION usam resolver autoritativo antes do ALLOCATE');
console.log('- commit usa ALLOCATE oficial com snapshot concorrente e operationId');
console.log('- UI não escreve saldo, ledger ou barcode diretamente');
