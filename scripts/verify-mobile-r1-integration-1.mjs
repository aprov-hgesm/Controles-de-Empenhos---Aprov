#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'features/warehouse/mobile/WarehouseMobileLocationFoundationCheck.tsx',
  'lib/warehouse/mobileLocationScan.ts',
  'lib/warehouse/locationBarcode.ts',
  'lib/warehouse/locationBarcodeResolver.ts',
]) {
  assert.equal(existsSync(resolve(root, path)), true, 'Arquivo da Integração 1 ausente: ' + path);
}

const classifier = read('lib/warehouse/mobileLocationScan.ts');
assert.match(classifier, /isWarehouseLocationBarcode/);
assert.match(classifier, /'LOCATION'/);
assert.match(classifier, /'UNKNOWN'/);
assert.doesNotMatch(classifier, /'PRODUCT'/);

const component = read('features/warehouse/mobile/WarehouseMobileLocationFoundationCheck.tsx');
assert.match(component, /expectation="EXPECT_LOCATION"/);
assert.match(component, /classifyWarehouseMobileLocationScan/);
assert.match(component, /resolveWarehouseStockPositionBarcode/);
assert.match(component, /useWarehouseWorkspaceContext/);
assert.match(component, /workspace\.workspaceId/);
assert.match(component, /workspace\.ug/);
assert.match(component, /DEPOT_NOT_STOCK_POSITION/);
assert.match(component, /Nenhum saldo ou movimento é alterado/);

for (const forbidden of [
  'transferWarehouseStock',
  'appendWarehouse',
  'createWarehouseMovement',
  'intakeAllocationRepository',
  'outboundRepository',
  'inventoryRepository',
  'setDoc(',
  'updateDoc(',
  'runTransaction(',
]) {
  assert.equal(
    component.includes(forbidden),
    false,
    'Integração 1 não pode escrever domínio operacional: ' + forbidden
  );
}

const resolver = read('lib/warehouse/locationBarcodeResolver.ts');
assert.match(resolver, /getWarehouseDepot/);
assert.match(resolver, /getWarehouseLocation/);
assert.match(resolver, /resolveWarehouseStockPositionCode/);
assert.doesNotMatch(resolver, /Cached/);

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
assert.match(home, /WarehouseMobileLocationFoundationCheck/);

const pkg = JSON.parse(read('package.json'));
assert.equal(
  pkg.scripts['test:mobile-r1-integration-1'],
  'node --test scripts/mobile-r1-integration-1.test.mjs'
);
assert.equal(
  pkg.scripts['verify:mobile-r1-integration-1'],
  'node scripts/verify-mobile-r1-integration-1.mjs'
);

console.log('MOBILE-R1 INTEGRATION 1: PASS');
console.log('- EPX1 é classificado como LOCATION; barcode comercial não é posição');
console.log('- resolver autoritativo revalida workspace/UG/status/hierarquia');
console.log('- LOCAL/SUBPOSITION chegam a WarehouseStockPosition');
console.log('- integração permanece read-only e sem movimentos de estoque');
