#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const rules = readFileSync(resolve(root, 'firestore.warehouse.rules'), 'utf8');
const sectionContent = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseSectionContent.tsx'),
  'utf8'
);
const plan = readFileSync(
  resolve(root, 'docs/adm-deposito/MODULAR_RELEASE_PLAN.md'),
  'utf8'
);

const firebaseSource = readFileSync(resolve(root, 'lib/firebase.ts'), 'utf8');
const firebaseConfig = readFileSync(resolve(root, 'firebase.json'), 'utf8');
const migrationScript = readFileSync(
  resolve(root, 'scripts/migrate-warehouse-database.mjs'),
  'utf8'
);
const legacyInvoiceBridge = readFileSync(
  resolve(root, 'lib/warehouse/invoiceIntegrationService.ts'),
  'utf8'
);

const findings = [];
const rulesBytes = Buffer.byteLength(rules, 'utf8');
const INTERNAL_RULES_BUDGET_BYTES = 200 * 1024;

if (rulesBytes > INTERNAL_RULES_BUDGET_BYTES) {
  findings.push(
    'firestore.warehouse.rules ultrapassou o orçamento interno de 200 KiB: '
      + (rulesBytes / 1024).toFixed(2)
      + ' KiB.'
  );
}

function fail(message) {
  findings.push(message);
}

function requireText(content, marker, message) {
  if (!content.includes(marker)) fail(message);
}

const warehouseStart = rules.indexOf('match /warehouse/{workspaceId}');
if (warehouseStart < 0) {
  fail('Bloco warehouse ausente.');
} else {
  const warehouseTail = rules.slice(warehouseStart);
  const endMarker = '\n    // a platform administrator cannot read another sector';
  const markerIndex = warehouseTail.indexOf(endMarker);
  const warehouseBlock = markerIndex >= 0
    ? warehouseTail.slice(0, markerIndex)
    : warehouseTail;

  for (const collection of [
    'materials',
    'depots',
    'locations',
    'movements',
    'balances',
    'locationBalances',
    'lots',
    'barcodes',
    'layouts',
    'siscofisSnapshots',
    'settings',
    'destinations',
    'consumptions',
    'intakes',
    'queueExclusions',
  ]) {
    requireText(
      warehouseBlock,
      'match /' + collection + '/{',
      'ADM-R1 perdeu coleção permitida: ' + collection
    );
  }

  for (const collection of [
    'alerts',
    'inventories',
    'withdrawals',
  ]) {
    if (warehouseBlock.includes('match /' + collection + '/{')) {
      fail('Domínio estacionado voltou às rules antes da liberação: ' + collection);
    }
  }


}

for (const helper of [
  'function warehouseModuleEnabled()',
  'function canAccessWarehouseModule(workspaceId)',
  'function validWarehouseMaterialDocument(workspaceId, materialId)',
  'function validWarehouseDepotCreate(workspaceId, depotId)',
  'function validWarehouseDepotUpdate(workspaceId, depotId)',
  'function validWarehouseLocationCreate(workspaceId, locationId)',
  'function validWarehouseLocationUpdate(workspaceId, locationId)',
  'function validWarehouseDepotLayoutCreate(workspaceId, layoutId)',
  'function validWarehouseDepotLayoutArchive(workspaceId, layoutId)',
  'function validWarehouseDestinationCreate(workspaceId, destinationId)',
  'function validWarehouseDestinationUpdate(workspaceId, destinationId)',
  'function validWarehouseLogisticsSettings(workspaceId, settingId)',
  'function warehouseMovementCreateAllowed(workspaceId, movementId)',
  'function warehouseBalanceWriteAllowed(workspaceId, materialId)',
  'function warehouseLocationBalanceWriteAllowed(workspaceId, locationBalanceId)',
  'function validWarehouseLotCreate(workspaceId, lotId)',
  'function validWarehouseBarcodeCreate(workspaceId, barcodeId)',
  'function validWarehouseItemIntakeV2Create(workspaceId, intakeId)',
  'function validWarehouseItemIntakeV2Update(workspaceId, intakeId)',
  'function warehouseImmediateConsumptionIntakeMatchesAfter(workspaceId)',
  'function validWarehouseConsumptionCreate(workspaceId, consumptionId)',
]) {
  requireText(rules, helper, 'Helper obrigatório da ADM-R1 ausente: ' + helper);
}

requireText(
  rules,
  "match /queueExclusions/{exclusionId}",
  'Contrato de queueExclusions ausente.'
);
requireText(
  rules,
  "allow read, create, update: if canAccessWarehouseModule(workspaceId);",
  'queueExclusions perdeu o gate founder-only/workspace.'
);

requireText(
  firebaseSource,
  "|| 'emprovex-warehouse';",
  'warehouseDb perdeu o databaseId padrão emprovex-warehouse.'
);
requireText(
  firebaseSource,
  'export const warehouseDb = getFirestore(app, WAREHOUSE_FIRESTORE_DATABASE_ID);',
  'warehouseDb não está inicializado explicitamente no Firebase client.'
);
requireText(
  firebaseConfig,
  '"database": "emprovex-warehouse"',
  'firebase.json perdeu a configuração do database dedicado.'
);
requireText(
  firebaseConfig,
  '"rules": "firestore.warehouse.rules"',
  'firebase.json não aponta o database dedicado para firestore.warehouse.rules.'
);

for (const repositoryPath of [
  'lib/warehouse/barcodeRepository.ts',
  'lib/warehouse/intakeAllocationRepository.ts',
  'lib/warehouse/intakeQueueExclusionRepository.ts',
  'lib/warehouse/intakeRepository.ts',
  'lib/warehouse/intakeStateRepository.ts',
  'lib/warehouse/inventoryRepository.ts',
  'lib/warehouse/layoutRepository.ts',
  'lib/warehouse/ledgerRepository.ts',
  'lib/warehouse/locationRepository.ts',
  'lib/warehouse/logisticsRepository.ts',
  'lib/warehouse/lotRepository.ts',
  'lib/warehouse/materialRepository.ts',
  'lib/warehouse/outboundRepository.ts',
  'lib/warehouse/withdrawalRepository.ts',
  'lib/warehouse/siscofisService.ts',
]) {
  const repositorySource = readFileSync(resolve(root, repositoryPath), 'utf8');
  requireText(
    repositorySource,
    'warehouseDb as db',
    repositoryPath + ' não está apontando explicitamente para warehouseDb.'
  );
}

requireText(
  migrationScript,
  "'inventories/*/items'",
  'Migrador não contempla a subcoleção inventories/{inventoryId}/items.'
);
requireText(
  migrationScript,
  'domainDigest(sourceDocuments, true)',
  'Migrador não normaliza referenceValue da origem antes de verificar o destino.'
);
requireText(
  migrationScript,
  "new Set(['plan', 'copy', 'verify'])",
  'Migrador perdeu os modos controlados plan/copy/verify.'
);
requireText(
  migrationScript,
  "method: 'POST'",
  'Migrador perdeu o commit explícito no database de destino.'
);

requireText(
  legacyInvoiceBridge,
  'WAREHOUSE_LEGACY_CROSS_DATABASE_INTEGRATION_DISABLED',
  'Ponte legada NF/warehouse deixou de falhar de forma segura.'
);
if (legacyInvoiceBridge.includes("import { db } from '../firebase'")) {
  fail('Ponte legada voltou a importar o db operacional principal.');
}
if (legacyInvoiceBridge.includes('warehouseDocumentPath(')) {
  fail('Ponte legada voltou a construir referências warehouse dentro de Transaction externa.');
}

function listSourceFiles(directory) {
  const absolute = resolve(root, directory);
  const entries = readdirSync(absolute);
  const files = [];

  for (const entry of entries) {
    const relativePath = directory + '/' + entry;
    const child = resolve(root, relativePath);
    if (statSync(child).isDirectory()) {
      files.push(...listSourceFiles(relativePath));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      files.push(relativePath);
    }
  }

  return files;
}

for (const sourcePath of [
  ...listSourceFiles('app'),
  ...listSourceFiles('components'),
  ...listSourceFiles('features'),
  ...listSourceFiles('lib'),
]) {
  if (sourcePath === 'lib/warehouse/invoiceIntegrationService.ts') continue;
  const source = readFileSync(resolve(root, sourcePath), 'utf8');
  if (source.includes('invoiceIntegrationService')) {
    fail(
      'Runtime ainda importa a ponte transacional legada NF/warehouse: '
      + sourcePath
    );
  }
}

requireText(
  sectionContent,
  "if (section === 'depots')",
  'Meus Depósitos deve permanecer operacional.'
);
requireText(
  sectionContent,
  "if (section === 'registration')",
  'Cadastro de Itens deve estar operacional nesta etapa modular.'
);
requireText(
  sectionContent,
  'warehouse-modular-r1-notice',
  'Superfícies avançadas precisam permanecer explicitamente estacionadas na ADM-R1.'
);
requireText(
  plan,
  'ADM-R1 — Fundação independente',
  'Plano modular oficial da ADM-R1 ausente.'
);

if (findings.length) {
  console.error('ADM Depósito ADM-R1 guard: FAIL');
  for (const finding of findings) console.error('- ' + finding);
  process.exit(1);
}

console.log('ADM Depósito modular guard: PASS');
console.log('- Meus Depósitos e Cadastro de Itens operacionais');
console.log('- rules em ' + (rulesBytes / 1024).toFixed(2) + ' KiB (orçamento interno: 200 KiB)');
console.log('- NF/Pregão podem sair da fila por exclusão lógica sem movimentar estoque');
console.log('- contratos de ledger, saldo, localização, lote, barcode e intake preservados');
console.log('- founder-only e validações transacionais preservados');
console.log('- repositories persistem exclusivamente em warehouseDb');
console.log('- migrador cobre inventories/*/items e normaliza referências Firestore');
console.log('- ponte transacional legada NF/warehouse bloqueada por fail-safe');
