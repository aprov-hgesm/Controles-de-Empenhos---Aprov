#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const rules = readFileSync(resolve(root, 'firestore.warehouse.rules'), 'utf8');
const sectionContent = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseSectionContent.tsx'),
  'utf8'
);
const itemRegistration = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseItemRegistrationOperational.tsx'),
  'utf8'
);
const intakeStateRepository = readFileSync(
  resolve(root, 'lib/warehouse/intakeStateRepository.ts'),
  'utf8'
);
const intakeAllocationRepository = readFileSync(
  resolve(root, 'lib/warehouse/intakeAllocationRepository.ts'),
  'utf8'
);
const allocationSheet = readFileSync(
  resolve(root, 'features/warehouse/pdf/WarehouseAllocationSheet.ts'),
  'utf8'
);
const outboundDocuments = readFileSync(
  resolve(root, 'features/warehouse/pdf/WarehouseOutboundDocuments.ts'),
  'utf8'
);
const materialWithdrawal = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseMaterialWithdrawal.tsx'),
  'utf8'
);
const itemControl = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseItemControlOperational.tsx'),
  'utf8'
);
const navigation = readFileSync(
  resolve(root, 'features/warehouse/navigation.ts'),
  'utf8'
);
const outboundRoute = readFileSync(
  resolve(root, 'app/adm-deposito/saida-de-material/page.tsx'),
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
    'withdrawals',
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
  'function validWarehouseWithdrawalCreate(workspaceId, withdrawalId)',
  'function validWarehouseWithdrawalUpdate(workspaceId, withdrawalId)',
  'function validWarehouseLogisticsSettings(workspaceId, settingId)',
  'function validWarehouseTransferMovementCreate(workspaceId, movementId)',
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
  "match /withdrawals/{withdrawalId}",
  'Contrato founder-only de withdrawals ausente.'
);
requireText(
  rules,
  "validWarehouseWithdrawalCreate(workspaceId, withdrawalId)",
  'withdrawals perdeu o validador de criação auditável.'
);
requireText(
  rules,
  "validWarehouseWithdrawalUpdate(workspaceId, withdrawalId)",
  'withdrawals perdeu o validador de progressão/finalização.'
);

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
  'Alocação de Material deve estar operacional nesta etapa modular.'
);
requireText(
  sectionContent,
  "if (section === 'outbound')",
  'Saída de Material deve estar operacional nesta etapa modular.'
);
requireText(
  sectionContent,
  'warehouse-modular-r1-notice',
  'Superfícies avançadas precisam permanecer explicitamente estacionadas na ADM-R1.'
);
requireText(
  itemRegistration,
  "type PregaoBulkMode = 'storage' | 'immediate' | 'remove';",
  'Ações em lote de Pregão/NF perderam o modo de consumo imediato.'
);
requireText(
  itemRegistration,
  'applyWarehouseImmediateConsumption(workspaceId, {',
  'Consumo imediato em lote deixou de reutilizar o motor transacional oficial.'
);
requireText(
  itemRegistration,
  'destinationId,',
  'Consumo imediato em lote perdeu o destino operacional.'
);
requireText(
  itemRegistration,
  'withdrawnBy: withdrawnBy.trim(),',
  'Consumo imediato em lote perdeu a identificação de quem retirou/recebeu.'
);
requireText(
  itemRegistration,
  "quantity: row.pendingQuantity,",
  'Consumo imediato em lote deixou de tratar integralmente o saldo pendente de cada item.'
);

requireText(
  itemRegistration,
  'Ficha de Alocação Física · Pregão',
  'Cadastro de Itens perdeu a emissão de ficha por Pregão.'
);
requireText(
  itemRegistration,
  'Ficha PDF',
  'Cadastro de Itens perdeu a emissão de ficha por NF.'
);
requireText(
  itemRegistration,
  'downloadWarehouseAllocationSheet',
  'Cadastro de Itens perdeu a ação de download da ficha de alocação.'
);
requireText(
  itemRegistration,
  'printWarehouseAllocationSheet',
  'Cadastro de Itens perdeu a ação de impressão da ficha de alocação.'
);
requireText(
  allocationSheet,
  'FICHA DE ALOCAÇÃO FÍSICA DE MATERIAIS',
  'Gerador PDF perdeu o título institucional da ficha.'
);
requireText(
  allocationSheet,
  'const ALLOCATION_ROWS_PER_ITEM = 3;',
  'Ficha deixou de reservar três linhas de alocação física por item.'
);

requireText(
  allocationSheet,
  "doc.setFillColor('#F2F2F2');",
  'Ficha perdeu o fundo cinza neutro das instruções.'
);
requireText(
  allocationSheet,
  "doc.setFillColor('#EDEDED');",
  'Ficha perdeu o cabeçalho neutro em grayscale dos itens.'
);
requireText(
  allocationSheet,
  "label: 'PARA ALOCAR'",
  'Cabeçalho da quantidade pendente voltou ao texto longo que extravasava a célula.'
);
requireText(
  allocationSheet,
  'function fitTextLines(',
  'Ficha perdeu a contenção automática de textos longos.'
);
requireText(
  allocationSheet,
  "orientation: 'portrait'",
  'Ficha deixou de usar A4 retrato.'
);
requireText(
  allocationSheet,
  "row.status === 'PENDING' || row.status === 'PARTIALLY_PROCESSED'",
  'Ficha deixou de limitar a emissão aos itens ainda pendentes de alocação.'
);
requireText(
  allocationSheet,
  'Responsável pela alocação física · nome/assinatura',
  'Ficha perdeu o campo de assinatura da ponta física.'
);
requireText(
  allocationSheet,
  'Operador que lançou no EMPROVEX · nome/assinatura',
  'Ficha perdeu o campo de conferência do operador do sistema.'
);
requireText(
  navigation,
  "label: 'Saída de Material'",
  'Navegação perdeu a aba principal Saída de Material.'
);
requireText(
  navigation,
  "href: '/adm-deposito/saida-de-material'",
  'Navegação perdeu a rota dedicada de Saída de Material.'
);
requireText(
  outboundRoute,
  'section="outbound"',
  'Rota dedicada de Saída de Material deixou de usar a superfície protegida.'
);
requireText(
  materialWithdrawal,
  'downloadWarehouseOutboundDocuments(finalizedInput)',
  'Finalização da saída deixou de gerar automaticamente o PDF duplo.'
);
requireText(
  materialWithdrawal,
  'resolveOutboundDocumentLines(',
  'Saída perdeu a resolução documental NF/NE por lote/movimento de origem.'
);
requireText(
  outboundDocuments,
  'FICHA DE SAÍDA DE MATERIAL',
  'PDF de saída perdeu a ficha de orientação para retirada física.'
);
requireText(
  outboundDocuments,
  'FICHA AUXILIAR DE PEDIDO DE MATERIAL - SISCOFIS',
  'PDF de saída perdeu a ficha auxiliar obrigatória do SISCOFIS.'
);
requireText(
  outboundDocuments,
  'LOCALIZAÇÃO EXATA',
  'Ficha de saída perdeu a localização física exata do material.'
);
requireText(
  outboundDocuments,
  'NOTA DE EMPENHO',
  'Ficha SISCOFIS perdeu a Nota de Empenho.'
);
requireText(
  outboundDocuments,
  "controlCode: 'EMX-SM-'",
  'Documentos de saída perderam o código alfanumérico derivado da data/controle.'
);
if (itemControl.includes("id: 'outbound'")) {
  fail('Saída de Material voltou a ficar duplicada dentro de Controle de Itens.');
}

requireText(
  intakeStateRepository,
  "createWarehouseMovementId(",
  'Fila deixou de reconhecer deterministicamente o INVOICE_ENTRY do intake v2.'
);
requireText(
  intakeStateRepository,
  "record.movement.id !== expectedV2EntryMovementId",
  'INVOICE_ENTRY v2 voltou a ser classificado como projeção legada após tentativa interrompida.'
);
requireText(
  rules,
  "movement.type == 'TRANSFER'",
  'Rules deixaram de tratar TRANSFER como redistribuição física sem delta agregado.'
);
requireText(
  rules,
  'validWarehouseTransferSource(movement.source)',
  'TRANSFER perdeu o validador enxuto e dedicado de source.'
);
requireText(
  rules,
  "request.resource.data.diff(resource.data).affectedKeys().hasOnly([",
  'Update de intake perdeu a whitelist de campos mutáveis.'
);
if (intakeAllocationRepository.includes('applyWarehouseMovementToBalance(')) {
  fail('TRANSFER voltou a recalcular o saldo agregado dentro da alocação.');
}
if (intakeAllocationRepository.includes('transaction.set(balanceRef')) {
  fail('TRANSFER voltou a regravar balances apesar de quantityDelta=0.');
}
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
console.log('- Meus Depósitos, Alocação de Material e Saída de Material operacionais');
console.log('- rules em ' + (rulesBytes / 1024).toFixed(2) + ' KiB (orçamento interno: 200 KiB)');
console.log('- NF/Pregão podem ser armazenados, consumidos imediatamente ou removidos logicamente da fila');
console.log('- ficha institucional PDF de alocação física disponível por NF e por Pregão');
console.log('- ficha PDF otimizada para toner P&B, com grayscale neutro e contenção de textos');
console.log('- Saída de Material gera PDF duplo: retirada física + ficha auxiliar SISCOFIS com controle/código');
console.log('- consumo imediato em lote reutiliza o motor oficial com destino, responsável e idempotência por item');
console.log('- INVOICE_ENTRY v2 isolado não gera falso positivo de reconciliação legada');
console.log('- TRANSFER redistribui locationBalances sem regravar o saldo agregado');
console.log('- TRANSFER usa validador dedicado para permanecer abaixo do orçamento de expressões das Rules');
console.log('- contratos de ledger, saldo, localização, lote, barcode e intake preservados');
console.log('- founder-only e validações transacionais preservados');
console.log('- repositories persistem exclusivamente em warehouseDb');
console.log('- migrador cobre inventories/*/items e normaliza referências Firestore');
console.log('- ponte transacional legada NF/warehouse bloqueada por fail-safe');
