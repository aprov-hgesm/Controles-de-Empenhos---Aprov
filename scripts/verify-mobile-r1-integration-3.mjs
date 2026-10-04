#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/central-mobile/inventario/page.tsx',
  'app/central-mobile/saida/page.tsx',
  'app/central-mobile/conferir/page.tsx',
  'features/warehouse/mobile/WarehouseMobileInventory.tsx',
  'features/warehouse/mobile/WarehouseMobileOutbound.tsx',
  'features/warehouse/mobile/WarehouseMobilePositionCheck.tsx',
  'lib/warehouse/mobileInventory.ts',
  'lib/warehouse/mobileOutbound.ts',
  'lib/warehouse/mobileOutboundRepository.ts',
  'lib/warehouse/mobilePositionCheck.ts',
  'lib/warehouse/mobilePositionCheckModel.ts',
]) {
  assert.equal(existsSync(resolve(root, path)), true, 'Integração 3 ausente: ' + path);
}

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
for (const route of [
  '/central-mobile/inventario',
  '/central-mobile/saida',
  '/central-mobile/conferir',
]) {
  assert.match(home, new RegExp(route.replaceAll('/', '\\/')));
}

const inventory = read('features/warehouse/mobile/WarehouseMobileInventory.tsx');
for (const required of [
  'saveWarehouseInventoryCount',
  'beginWarehouseInventoryReview',
  'reopenWarehouseInventoryCounting',
  'confirmWarehouseInventory',
]) {
  assert.match(inventory, new RegExp(required));
}
assert.doesNotMatch(inventory, /\bsetDoc\s*\(/);
assert.doesNotMatch(inventory, /\bupdateDoc\s*\(/);
assert.doesNotMatch(inventory, /\brunTransaction\s*\(/);

const outbound = read('features/warehouse/mobile/WarehouseMobileOutbound.tsx');
assert.match(outbound, /applyWarehouseExpressOutbound/);
assert.match(outbound, /createWarehouseOutboundIdempotencyKey/);
assert.match(outbound, /CONFIRMAR SAÍDA/);
assert.doesNotMatch(outbound, /\bsetDoc\s*\(/);
assert.doesNotMatch(outbound, /\bupdateDoc\s*\(/);
assert.doesNotMatch(outbound, /\brunTransaction\s*\(/);

const check = read('lib/warehouse/mobilePositionCheck.ts');
for (const forbidden of [
  'setDoc(',
  'updateDoc(',
  'runTransaction(',
  'writeBatch(',
  'transferWarehouseStock(',
  'applyWarehouseExpressOutbound(',
]) {
  assert.equal(check.includes(forbidden), false, 'MOBILE-H deve continuar read-only: ' + forbidden);
}
assert.match(check, /WAREHOUSE_MOBILE_POSITION_CHECK_BALANCE_LIMIT \+ 1/);
assert.match(check, /loadWarehouseMobilePhysicalPositionContents/);

const pkg = JSON.parse(read('package.json'));
for (const name of [
  'test:mobile-r1-inventory',
  'verify:mobile-r1-inventory',
  'test:mobile-r1-outbound',
  'verify:mobile-r1-outbound',
  'test:mobile-r1-position-check',
  'verify:mobile-r1-position-check',
  'test:mobile-r1-integration-3',
  'verify:mobile-r1-integration-3',
]) {
  assert.equal(typeof pkg.scripts[name], 'string', 'script ausente: ' + name);
}

const workflow = read('.github/workflows/application-ci.yml');
for (const marker of [
  'MOBILE-F inventory domain tests',
  'MOBILE-F inventory guard',
  'MOBILE-G outbound domain tests',
  'MOBILE-G outbound guard',
  'MOBILE-H position check domain tests',
  'MOBILE-H position check guard',
  'Integration 3 domain tests',
  'Integration 3 guard',
]) {
  assert.match(workflow, new RegExp(marker.replace(/[.*+?^$()|[\]{}]/g, '\\$&')));
}

console.log('MOBILE-R1 INTEGRATION 3: PASS');
console.log('- F/G/H coexistem sobre os contratos canônicos da Central Móvel');
console.log('- inventário não cria write direto de saldo/ledger');
console.log('- saída delega exclusivamente ao OUTBOUND canônico');
console.log('- conferência permanece read-only');
console.log('- Home, package e CI preservam as três frentes');
