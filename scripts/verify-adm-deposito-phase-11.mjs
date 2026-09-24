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
const alertsUi = read('features/warehouse/components/WarehouseLogisticsAlerts.tsx');
const settings = read('features/warehouse/components/WarehouseLogisticsSettings.tsx');
const section = read('features/warehouse/components/WarehouseSectionContent.tsx');
const navigation = read('features/warehouse/navigation.ts');
const namespace = read('lib/warehouse/namespace.ts');
const rules = read('firestore.rules');
const decisions = read('docs/adm-deposito/DECISIONS.md');

assert.match(logistics, /CronogramaEmpenho/);
assert.match(logistics, /Invoice/);
assert.match(logistics, /WarehouseMovement/);
assert.match(logistics, /expectedThroughToday/);
assert.match(logistics, /overdueQuantity/);
assert.doesNotMatch(logistics, /warehouseIntegration|warehouseMaterialId|warehouseMovementIds/);

assert.match(repository, /operationalCollectionRef/);
assert.match(repository, /listOperationalBounded/);
assert.match(repository, /warehouseDomainPath\(normalized, 'alerts'\)/);
assert.match(repository, /reconcileWarehouseLogisticsAlerts/);
assert.doesNotMatch(repository, /firebaseSync|saveAlert\(|saveCronograma\(|operationalDocRef\(/);
assert.doesNotMatch(repository, /onSnapshot\(/);

assert.match(namespace, /alerts: 'alerts'/);
assert.match(alerts, /warehouse_logistics_alert_v1/);
assert.match(alerts, /DELIVERY_OVERDUE/);
assert.match(alerts, /SISCOFIS_DIVERGENCE/);

assert.match(deliveries, /Cronograma → NF → projeção logística/);
assert.match(deliveries, /ledger ADM/);
assert.doesNotMatch(deliveries, /Confirmar entrega|Registrar entrega|Receber material/);
assert.match(dashboard, /namespace warehouse/);
assert.match(alertsUi, /não alteram a Central de Avisos operacional/);
assert.match(settings, /namespace\s*warehouse/);
assert.match(section, /WarehouseLogisticsDashboard/);
assert.match(section, /WarehouseDeliveriesOperational/);
assert.match(section, /WarehouseLogisticsAlerts/);
assert.match(navigation, /label: 'Alertas'/);

assert.match(rules, /validWarehouseLogisticsSettings/);
assert.match(rules, /validWarehouseLogisticsAlertCreate/);
assert.match(rules, /match \/alerts\/\{alertId\}/);

const operationalMarker = '// Workspace-scoped operational data.';
const operationalStart = rules.indexOf(operationalMarker);
assert.ok(operationalStart >= 0);
assert.doesNotMatch(
  rules.slice(operationalStart),
  /warehouse_logistics|logalert-|canAccessWarehouseModule/
);

assert.match(decisions, /D-025/);
assert.match(decisions, /namespace `warehouse`/);

console.log('ADM Depósito FASE 11 protected guard: PASS');
console.log('- Cronogramas/Empenhos/NFs somente leitura');
console.log('- correlação logística derivada do ledger');
console.log('- alertas e configurações persistidos somente em warehouse/*');
console.log('- nenhuma mutação operacional comandada pelo ADM');
