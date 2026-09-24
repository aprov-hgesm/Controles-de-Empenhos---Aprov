#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const inventory = read('lib/warehouse/inventory.ts');
const repository = read('lib/warehouse/inventoryRepository.ts');
const movement = read('lib/warehouse/movement.ts');
const ui = read('features/warehouse/components/WarehouseInventoryOperational.tsx');
const section = read('features/warehouse/components/WarehouseSectionContent.tsx');
const navigation = read('features/warehouse/navigation.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const e2e = read('tests/e2e/warehouse-phase-10.spec.mjs');
const phaseDoc = read('docs/adm-deposito/PHASE_10_PHYSICAL_INVENTORY.md');
const roadmap = read('docs/adm-deposito/ROADMAP.md');
const status = read('docs/adm-deposito/STATUS.md');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/application-ci.yml');

assert.match(inventory, /warehouse_inventory_v1/);
assert.match(inventory, /warehouse_inventory_item_v1/);
assert.match(inventory, /RECONCILIATION_REQUIRED/);
assert.match(inventory, /calculateWarehouseInventoryDifference/);
assert.match(inventory, /countedQuantity.*expectedQuantity/s);

assert.match(repository, /startWarehouseInventory/);
assert.match(repository, /saveWarehouseInventoryCount/);
assert.match(repository, /beginWarehouseInventoryReview/);
assert.match(repository, /confirmWarehouseInventory/);
assert.match(repository, /applyWarehouseInventoryAdjustment/);
assert.match(repository, /WAREHOUSE_INVENTORY_CONCURRENT_CHANGE/);
assert.match(repository, /listWarehouseUnlocatedStock/);
assert.match(repository, /runTransaction/);
assert.match(repository, /INVENTORY_ADJUSTMENT/);
assert.match(repository, /phase10:inventory:/);
assert.match(repository, /locationBalance\.revision !== item\.expectedLocationRevision/);
assert.doesNotMatch(repository, /deleteDoc\(/);

assert.match(movement, /WarehousePhysicalInventoryMovementSource/);
assert.match(movement, /PHYSICAL_INVENTORY/);
assert.match(movement, /inventory_source_required/);

assert.match(ui, /warehouse-inventory-operational/);
assert.match(ui, /warehouse-inventory-scope-kind/);
assert.match(ui, /warehouse-inventory-count/);
assert.match(ui, /warehouse-inventory-review-summary/);
assert.match(ui, /warehouse-inventory-confirm-ack/);
assert.match(ui, /warehouse-inventory-unlocated/);
assert.match(ui, /Nenhum saldo ou movimento de estoque foi alterado/);
assert.match(section, /WarehouseInventoryOperational/);
assert.match(navigation, /inventory'.*futurePhase: null/);

assert.match(rules, /warehouse_inventory_v1/);
assert.match(rules, /warehouse_inventory_item_v1/);
assert.match(rules, /match \/inventories\/\{inventoryId\}/);
assert.match(rules, /allow delete: if false/);
assert.match(rules, /warehouseMovementIsInventoryAdjustment/);
assert.match(rules, /warehouseInventoryMovementLinksItem/);
assert.doesNotMatch(rules, /match \/inventories\/\{document=\*\*\}[\s\S]{0,120}allow read, write/);

assert.match(security, /FASE 10 — Inventário Físico/);
assert.match(security, /Setor externo não lê inventário da FASE 10/);
assert.match(e2e, /warehouse-inventory-operational/);
assert.match(e2e, /warehouse-inventory-confirm/);

assert.match(phaseDoc, /warehouse_inventory_v1/);
assert.match(phaseDoc, /INVENTORY_ADJUSTMENT/);
assert.match(phaseDoc, /concorrência/i);
assert.match(roadmap, /FASE 10 — Inventário Físico — CONCLUÍDA/);
assert.match(status, /FASE 10 — CONCLUÍDA/);

assert.equal(
  packageJson.scripts['test:adm-deposito-inventory'],
  'node --test scripts/warehouse-inventory.test.mjs'
);
assert.equal(
  packageJson.scripts['verify:adm-deposito-phase-10'],
  'node scripts/verify-adm-deposito-phase-10.mjs'
);
assert.match(workflow, /ADM Depósito Phase 10 physical inventory domain tests/);
assert.match(workflow, /ADM Depósito Phase 10 permanent guard/);

console.log('ADM Depósito FASE 10 guard: PASS');
