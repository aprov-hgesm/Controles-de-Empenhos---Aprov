#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const namespace = read('lib/warehouse/namespace.ts');
const layout = read('lib/warehouse/layout.ts');
const repository = read('lib/warehouse/layoutRepository.ts');
const ui = read('features/warehouse/components/WarehouseDepotViewOperational.tsx');
const section = read('features/warehouse/components/WarehouseSectionContent.tsx');
const navigation = read('features/warehouse/navigation.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const e2e = read('tests/e2e/warehouse-phase-9.spec.mjs');
const phaseDoc = read('docs/adm-deposito/PHASE_9_DEPOT_VIEW_LAYOUT.md');
const decisions = read('docs/adm-deposito/DECISIONS.md');
const roadmap = read('docs/adm-deposito/ROADMAP.md');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/application-ci.yml');

assert.match(namespace, /layouts: 'layouts'/);
assert.match(layout, /warehouse_depot_layout_v1/);
assert.match(layout, /warehouseLocationId/);
assert.match(layout, /renderWarehouseDepotLayoutSvg/);
assert.doesNotMatch(layout, /warehouse_balance_v1.*:/);
assert.match(repository, /saveWarehouseDepotLayoutVersion/);
assert.match(repository, /runTransaction/);
assert.match(repository, /status: 'archived'/);
assert.match(repository, /WAREHOUSE_LAYOUT_LOCATION_INVALID/);
assert.doesNotMatch(repository, /warehouse_balance_v1|warehouse_movement_v1/);
assert.match(ui, /listWarehouseLocationBalances/);

assert.match(ui, /warehouse-depot-view-operational/);
assert.match(ui, /warehouse-layout-material-search/);
assert.match(ui, /warehouse-layout-canvas/);
assert.match(ui, /warehouse-layout-editor/);
assert.match(ui, /warehouse-layout-save/);
assert.match(ui, /renderWarehouseDepotLayoutSvg/);
assert.match(ui, /selectWarehouseFefoLot/);
assert.match(ui, /warehouseLocationIdForPosition/);
assert.match(ui, /Nenhum saldo ou movimento de estoque foi alterado/);
assert.match(section, /WarehouseDepotViewOperational/);
assert.match(navigation, /warehouseView.*futurePhase: null/);

assert.match(rules, /warehouse_depot_layout_v1/);
assert.match(rules, /match \/layouts\/\{layoutId\}/);
assert.match(rules, /validWarehouseDepotLayoutCreate/);
assert.match(rules, /validWarehouseDepotLayoutArchive/);
assert.match(security, /FASE 9 — Visão do Depósito/);
assert.match(security, /Setor externo não lê layout da FASE 9/);
assert.match(e2e, /warehouse-layout-material-search/);
assert.match(e2e, /warehouse-layout-save/);

assert.match(phaseDoc, /warehouse_depot_layout_v1/);
assert.match(phaseDoc, /Firestore = estado operacional ativo/);
assert.match(decisions, /D-046 — Layout visual é representação versionada/);
assert.match(roadmap, /## FASE 9 — Visão do Depósito, Editor e Persistência — CONCLUÍDA/);

assert.equal(
  packageJson.scripts['test:adm-deposito-depot-layout'],
  'node --test scripts/warehouse-depot-layout.test.mjs'
);
assert.equal(
  packageJson.scripts['verify:adm-deposito-phase-9'],
  'node scripts/verify-adm-deposito-phase-9.mjs'
);
assert.match(workflow, /ADM Depósito Phase 9 depot layout domain tests/);
assert.match(workflow, /ADM Depósito Phase 9 permanent guard/);

console.log('ADM Depósito FASE 9 guard: PASS');
