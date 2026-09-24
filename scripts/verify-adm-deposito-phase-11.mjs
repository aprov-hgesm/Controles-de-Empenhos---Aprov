#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const logistics = read('lib/warehouse/logistics.ts');
const alerts = read('lib/warehouse/logisticsAlerts.ts');
const repository = read('lib/warehouse/logisticsRepository.ts');
const deliveries = read('features/warehouse/components/WarehouseDeliveriesOperational.tsx');
const dashboard = read('features/warehouse/components/WarehouseLogisticsDashboard.tsx');
const settings = read('features/warehouse/components/WarehouseLogisticsSettings.tsx');
const section = read('features/warehouse/components/WarehouseSectionContent.tsx');
const navigation = read('features/warehouse/navigation.ts');
const page = read('app/page.tsx');
const rules = read('firestore.rules');
const phaseDoc = read('docs/adm-deposito/PHASE_11_DELIVERIES_DASHBOARD_ALERTS.md');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/application-ci.yml');

assert.match(logistics, /CronogramaEmpenho/);
assert.match(logistics, /Invoice/);
assert.match(logistics, /warehouseIntegration/);
assert.match(logistics, /expectedThroughToday/);
assert.match(logistics, /overdueQuantity/);
assert.match(logistics, /não cria associação NF ↔ remessa/);
assert.doesNotMatch(logistics, /INVOICE_ENTRY/);
assert.doesNotMatch(logistics, /confirm.*delivery|confirmar.*entrega/i);

assert.match(repository, /listOperationalBounded/);
assert.match(repository, /limit\(maxResults\)/);
assert.match(repository, /WAREHOUSE_LOGISTICS_ALERT_LIMIT/);
assert.match(repository, /reconcileWarehouseLogisticsAlerts/);
assert.match(repository, /saveAlert/);
assert.doesNotMatch(repository, /onSnapshot\(/);
assert.doesNotMatch(repository, /INVOICE_ENTRY/);
assert.doesNotMatch(repository, /deleteDoc\(/);

assert.match(alerts, /WAREHOUSE_LOGISTICS_ALERT_PREFIX/);
assert.match(alerts, /createWarehouseLogisticsAlertId/);
assert.match(alerts, /STOCK_ZERO/);
assert.match(alerts, /LOW_STOCK/);
assert.match(alerts, /DELIVERY_OVERDUE/);
assert.match(alerts, /DELIVERY_DUE_SOON/);
assert.match(alerts, /SISCOFIS_DIVERGENCE/);
assert.match(alerts, /warehouse-phase-11/);

assert.match(deliveries, /Cronograma → NF → estoque/);
assert.match(deliveries, /\?tab=cronogramas/);
assert.doesNotMatch(deliveries, /Confirmar entrega|Registrar entrega|Receber material/);
assert.match(dashboard, /\?tab=avisos/);
assert.match(settings, /lowStockThreshold/);
assert.match(section, /WarehouseDeliveriesOperational/);
assert.match(section, /WarehouseLogisticsDashboard/);
assert.match(section, /WarehouseLogisticsSettings/);
assert.match(navigation, /Acompanhamento logístico/);
assert.match(navigation, /Dashboard logístico/);
assert.match(page, /tab === 'cronogramas'/);
assert.match(page, /tab === 'avisos'/);

assert.match(rules, /warehouse_logistics_alert_settings_v1/);
assert.match(rules, /isWarehouseLogisticsAlertId/);
assert.match(rules, /canAccessWarehouseModule\(workspaceId\)/);
assert.match(rules, /allow delete: if canAccessWorkspace\(workspaceId\)[\s\S]{0,120}!isWarehouseLogisticsAlertId\(id\)/);

assert.match(phaseDoc, /Cronograma/);
assert.match(phaseDoc, /Nota Fiscal/);
assert.match(phaseDoc, /Central de Avisos/);
assert.match(phaseDoc, /bounded/i);
assert.match(phaseDoc, /não cria.*NF.*remessa/i);

assert.equal(
  packageJson.scripts['test:adm-deposito-logistics'],
  'node --test scripts/warehouse-logistics.test.mjs'
);
assert.equal(
  packageJson.scripts['verify:adm-deposito-phase-11'],
  'node scripts/verify-adm-deposito-phase-11.mjs'
);
assert.match(workflow, /ADM Depósito Phase 11 logistics domain tests/);
assert.match(workflow, /ADM Depósito Phase 11 permanent guard/);

console.log('ADM Depósito FASE 11 guard: PASS');
