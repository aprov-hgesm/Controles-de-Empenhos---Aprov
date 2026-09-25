#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const rules = read('firestore.rules');
const featureFlag = read('lib/platformModuleAccess.ts');
const protectedSurface = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const itemControl = read('features/warehouse/components/WarehouseItemControlOperational.tsx');
const stock = read('features/warehouse/components/WarehouseStockOperational.tsx');
const inventory = read('features/warehouse/components/WarehouseInventoryOperational.tsx');
const dashboard = read('features/warehouse/components/WarehouseLogisticsDashboard.tsx');
const alerts = read('features/warehouse/components/WarehouseLogisticsAlerts.tsx');
const reports = read('features/warehouse/components/WarehouseLogisticsReports.tsx');
const ledger = read('lib/warehouse/ledgerRepository.ts');
const logistics = read('lib/warehouse/logisticsRepository.ts');
const telemetry = read('lib/warehouse/telemetry.ts');
const namespace = read('lib/warehouse/namespace.ts');
const coreGuard = read('scripts/verify-emprovex-core-protection.mjs');
const securitySuite = read('scripts/firestore-multitenancy-security.test.mjs');
const pkg = JSON.parse(read('package.json'));

for (const marker of [
  'context.workspaceId === HGESM_WORKSPACE_ID',
  "context.status === 'sector'",
  "context.resolutionSource === 'legacy-hgesm-bootstrap'",
]) requireText(featureFlag, marker, `Gate founder-only ausente: ${marker}`);

for (const marker of [
  'resolveAuthenticatedWorkspaceContext(currentUser)',
  'canAccessWarehouseModule(context)',
  "fetch('/api/adm-deposito/status'",
]) requireText(protectedSurface, marker, `Proteção da superfície ADM incompleta: ${marker}`);

const materialsBlock = sliceBetween(
  rules,
  'match /materials/{materialId}',
  'match /depots/{depotId}'
);
requireText(materialsBlock, 'allow delete: if false;', 'Material canônico ainda permite delete físico.');

const movementsBlock = sliceBetween(
  rules,
  'match /movements/{movementId}',
  'match /balances/{materialId}'
);
requireText(movementsBlock, 'allow update, delete: if false;', 'Ledger deixou de ser append-only nas Rules.');

const balancesBlock = sliceBetween(
  rules,
  'match /balances/{materialId}',
  'match /locationBalances/{locationBalanceId}'
);
requireText(balancesBlock, 'warehouseBalanceWriteAllowed', 'Saldo agregado perdeu proteção derivada por movimento.');

for (const scenario of [
  'Setor externo não lê namespace ADM Depósito do fundador',
  'Setor externo não grava namespace ADM Depósito nem no próprio workspace',
  'Material canônico não pode ser apagado fisicamente',
  'Ledger da FASE 2 é append-only',
  'Saldo da FASE 2 não aceita alteração sem novo movimento',
]) requireText(securitySuite, scenario, `Cenário multi-tenant/hardening ausente: ${scenario}`);

for (const marker of [
  "tab === 'stock' &&",
  "tab === 'outbound' &&",
  "tab === 'inventory' &&",
  "tab === 'reports' &&",
]) requireText(itemControl, marker, `Controle de Itens deixou de montar somente a subaba ativa: ${marker}`);

for (const marker of [
  'locationBalancesByMaterial',
  'lotsByMaterial',
  'barcodesByMaterial',
  'listWarehouseMovementsForMaterial(workspaceId, selectedMaterialId, 50)',
]) requireText(stock, marker, `Hardening de Estoque ausente: ${marker}`);

for (const marker of [
  'deriveWarehouseUnlocatedStock',
  'listWarehouseBalances(workspaceId, 500)',
  'listWarehouseLocationBalances(workspaceId, 500)',
]) requireText(inventory, marker, `Inventário não reutiliza a leitura consolidada esperada: ${marker}`);
forbidText(
  inventory,
  'listWarehouseUnlocatedStock(workspaceId)',
  'Inventário voltou a reler materiais para calcular saldo sem localização.'
);

for (const marker of [
  'degradedSources',
  "optional('inventories'",
  "optional('siscofis'",
  "optional('settings'",
]) requireText(logistics, marker, `Resiliência do Dashboard ausente: ${marker}`);
requireText(
  dashboard,
  'next.degradedSources.length === 0',
  'Dashboard pode resolver alertas com fonte auxiliar degradada.'
);
requireText(
  alerts,
  'context.degradedSources.length === 0',
  'Tela de alertas pode resolver histórico com contexto degradado.'
);

for (const forbidden of [
  'setDoc(',
  'updateDoc(',
  'deleteDoc(',
  'runTransaction(',
]) forbidText(reports, forbidden, `Relatórios Logísticos ganharam caminho de escrita: ${forbidden}`);
requireText(reports, 'listWarehouseMovements(workspaceId, 250)', 'Relatório de movimentos perdeu limite bounded de 250.');

for (const marker of [
  "from '../workspaceUsageTelemetry'",
  'recordWorkspaceDocumentReads',
  'recordWorkspaceDocumentWrites',
]) requireText(telemetry, marker, `Telemetria warehouse não reutiliza infraestrutura existente: ${marker}`);
forbidText(telemetry, "from 'firebase/firestore'", 'Telemetria warehouse criou acesso Firestore paralelo.');
requireText(ledger, 'recordWarehouseDocumentReads', 'Ledger/listagens não participam da telemetria estimada.');
requireText(logistics, 'recordWarehouseDocumentReads', 'Dashboard/entregas não participam da telemetria estimada.');

const realtimeAuditFiles = [
  'features/warehouse/components/WarehouseStockOperational.tsx',
  'features/warehouse/components/WarehouseMovementsOperational.tsx',
  'features/warehouse/components/WarehouseInventoryOperational.tsx',
  'features/warehouse/components/WarehouseDeliveriesOperational.tsx',
  'features/warehouse/components/WarehouseLogisticsAlerts.tsx',
  'features/warehouse/components/WarehouseLogisticsDashboard.tsx',
  'features/warehouse/components/WarehouseLogisticsReports.tsx',
  'features/warehouse/components/WarehouseSiscofisOperational.tsx',
  'lib/warehouse/ledgerRepository.ts',
  'lib/warehouse/logisticsRepository.ts',
  'lib/warehouse/inventoryRepository.ts',
];
for (const path of realtimeAuditFiles) {
  forbidText(read(path), 'onSnapshot(', `Listener realtime inesperado no ADM: ${path}`);
}

forbidText(namespace, 'warehouse_report', 'Namespace ganhou cache/materialização de relatório não autorizada.');
requireText(coreGuard, 'EMPROVEX CORE PROTECTION', 'Guard permanente de Core Protection não está disponível.');
requireText(
  pkg.scripts?.['verify:adm-deposito-phase-13'] || '',
  'verify-adm-deposito-phase-13.mjs',
  'package.json não registra o guard do Módulo 13.'
);

if (existsSync(resolve(root, 'firestore.indexes.json'))) {
  const indexes = read('firestore.indexes.json');
  if (/warehouse/i.test(indexes)) {
    findings.push('Índice warehouse foi adicionado; revisar necessidade antes do fechamento do Módulo 13.');
  }
}

if (findings.length) {
  console.error('ADM DEPÓSITO MÓDULO 13: BLOQUEADO\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('ADM DEPÓSITO MÓDULO 13: READY');
  console.log('Segurança: founder-only, multi-tenant e históricos protegidos.');
  console.log('Firestore: consultas bounded, sem listener global e sem índice preventivo.');
  console.log('Performance: subabas sob demanda, joins indexados e inventário sem releitura duplicada de materiais.');
  console.log('Telemetria: estimativa existente reutilizada de forma best-effort e bufferizada.');
  console.log('Core: fronteira EMPROVEX → ADM preservada; campanha global continua no Módulo 14.');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) return '';
  return source.slice(start, end);
}
