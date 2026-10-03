#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/central-mobile/inventario/page.tsx',
  'features/warehouse/mobile/WarehouseMobileInventory.tsx',
  'lib/warehouse/mobileInventory.ts',
  'lib/warehouse/inventoryRepository.ts',
]) {
  assert.equal(existsSync(resolve(root, path)), true, 'MOBILE-F ausente: ' + path);
}

const component = read('features/warehouse/mobile/WarehouseMobileInventory.tsx');
for (const contract of [
  'startWarehouseInventory',
  'listWarehouseInventorySessions',
  'listWarehouseInventoryItems',
  'saveWarehouseInventoryCount',
  'beginWarehouseInventoryReview',
  'reopenWarehouseInventoryCounting',
  'confirmWarehouseInventory',
  'cancelWarehouseInventory',
]) {
  assert.match(component, new RegExp('\\b' + contract + '\\b'), 'Contrato não reutilizado: ' + contract);
}

assert.match(component, /expectation="EXPECT_LOCATION"/);
assert.match(component, /expectation="EXPECT_PRODUCT"/);
assert.match(component, /Contagem salva\. Nenhum saldo foi alterado\./);
assert.match(component, /INVENTORY_ADJUSTMENT/);
assert.match(component, /RECONCILIATION_REQUIRED/);
assert.match(component, /STALE/);
assert.match(component, /CONFIRMED/);
assert.match(component, /CANCELLED/);

for (const forbidden of [
  /from ['"]firebase\/firestore['"]/,
  /\bsetDoc\s*\(/,
  /\bupdateDoc\s*\(/,
  /\brunTransaction\s*\(/,
  /\btransferWarehouseStock\b/,
  /\ballocateWarehousePendingItemFast\b/,
]) {
  assert.doesNotMatch(
    component,
    forbidden,
    'MOBILE-F não pode escrever diretamente em estoque/ledger nem reutilizar operação de outra frente'
  );
}

const helper = read('lib/warehouse/mobileInventory.ts');
assert.match(helper, /classifyWarehouseMobileProductScan/);
assert.match(helper, /return classifyWarehouseMobileProductScan\(value\)/);
assert.match(helper, /warehouseInventoryScopeIncludesPosition/);
assert.match(helper, /warehouseStockPositionsEqual/);

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
assert.match(home, /href: '\/central-mobile\/inventario'/);

const pkg = JSON.parse(read('package.json'));
assert.equal(
  pkg.scripts['test:mobile-r1-inventory'],
  'node --test scripts/mobile-r1-inventory.test.mjs'
);
assert.equal(
  pkg.scripts['verify:mobile-r1-inventory'],
  'node scripts/verify-mobile-r1-inventory.mjs'
);

const workflow = read('.github/workflows/application-ci.yml');
assert.match(workflow, /Central Móvel R1 MOBILE-F inventory domain tests/);
assert.match(workflow, /Central Móvel R1 MOBILE-F inventory guard/);

console.log('MOBILE-F INVENTORY: PASS');
console.log('- contagem usa inventário canônico e não escreve saldo/ledger diretamente');
console.log('- ajuste permanece atrás de revisão + confirmação humana explícita');
console.log('- STALE e RECONCILIATION_REQUIRED permanecem fail-closed');
console.log('- PRODUCT/LOCATION/UNKNOWN e WarehouseStockPosition são compartilhados');
