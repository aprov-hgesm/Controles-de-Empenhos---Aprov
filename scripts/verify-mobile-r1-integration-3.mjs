#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/operador-movel/inventario/page.tsx',
  'app/operador-movel/saida/page.tsx',
  'app/operador-movel/conferir/page.tsx',
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
  '/operador-movel/inventario',
  '/operador-movel/saida',
  '/operador-movel/conferir',
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
// MOBILE-G now submits a single authenticated server command instead of
// calling the legacy client-side withdrawal function. Guard the active
// client -> authenticated route -> canonical server finalizer contract.
assert.match(outbound, /warehouseServerCommand\s*</);
assert.match(outbound, /['"]WITHDRAWAL_FINALIZE_MOBILE['"]/);
assert.match(outbound, /withdrawalId:\s*command\.review\.withdrawalId/);
assert.match(outbound, /destinationId:\s*command\.destinationId/);
assert.match(outbound, /lines:\s*command\.review\.lines/);
assert.match(outbound, /result\.withdrawal\.status\s*!==\s*['"]FINALIZED['"]/);
const serverRoute = read('app/api/central-depositos/operations/route.ts');
assert.match(serverRoute, /verifyWarehouseRequest\s*\(/);
assert.match(serverRoute, /case\s+['"]WITHDRAWAL_FINALIZE_MOBILE['"]/);
assert.match(serverRoute, /finalizeWarehouseWithdrawalServer\s*\(/);
assert.match(serverRoute, /withdrawnBy:\s*access\.email/);
assert.doesNotMatch(serverRoute, /withdrawnBy:\s*body\.input\.withdrawnBy/);
const mobileTrust = read('lib/server/warehouseMobileTrust.mjs');
assert.match(mobileTrust, /['"]WITHDRAWAL_FINALIZE_MOBILE['"]/);
assert.match(outbound, /createWarehouseWithdrawalId/);
// v3: browser MUST NOT fabricate technical line IDs; server owns their derivation.
assert.doesNotMatch(outbound, /createWarehouseWithdrawalLineId/);
assert.match(outbound, /schemaVersion:\\s*WAREHOUSE_WITHDRAWAL_COMMAND_V3/);
const { warehouseWithdrawalV3DerivedLineId } = await import('../lib/server/warehouseWithdrawalV3Identity.mjs');
const wd='wd_'+'a'.repeat(32);
const first=warehouseWithdrawalV3DerivedLineId(wd,0,0);
assert.match(first,/^wline_[a-f0-9]{32}$/);
assert.equal(first,warehouseWithdrawalV3DerivedLineId(wd,0,0));
assert.notEqual(first,warehouseWithdrawalV3DerivedLineId(wd,1,0));
assert.notEqual(first,warehouseWithdrawalV3DerivedLineId(wd,0,1));
assert.notEqual(first,warehouseWithdrawalV3DerivedLineId('wd_'+'b'.repeat(32),0,0));
assert.match(outbound, /listWarehouseDestinationsCached/);
assert.match(outbound, /createWarehouseDestination/);
assert.match(outbound, /destinationId/);
assert.doesNotMatch(outbound, /applyWarehouseExpressOutbound\s*\(/);
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
console.log('- saída delega ao withdrawal canônico, que aplica o OUTBOUND transacional');
console.log('- conferência permanece read-only');
console.log('- Home, package e CI preservam as três frentes');
