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
const allocatedItems = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseAllocatedItemsOperational.tsx'),
  'utf8'
);
const manualEntryOperational = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseManualEntryOperational.tsx'),
  'utf8'
);
const manualEntryRepository = readFileSync(
  resolve(root, 'lib/warehouse/manualEntryRepository.ts'),
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
const outboundRepository = readFileSync(
  resolve(root, 'lib/warehouse/outboundRepository.ts'),
  'utf8'
);
const withdrawalRepository = readFileSync(
  resolve(root, 'lib/warehouse/withdrawalRepository.ts'),
  'utf8'
);
const outboundReturnSecurityTest = readFileSync(
  resolve(root, 'scripts/warehouse-modular-r1-security.test.mjs'),
  'utf8'
);
const ledgerRepository = readFileSync(
  resolve(root, 'lib/warehouse/ledgerRepository.ts'),
  'utf8'
);
const locationRepository = readFileSync(
  resolve(root, 'lib/warehouse/locationRepository.ts'),
  'utf8'
);
const barcodeRepository = readFileSync(
  resolve(root, 'lib/warehouse/barcodeRepository.ts'),
  'utf8'
);
const warehouseHome = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseHomeOperational.tsx'),
  'utf8'
);
const warehouseHomeStyles = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseHomeOperational.module.css'),
  'utf8'
);
const warehouseLanding = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseLandingOperational.tsx'),
  'utf8'
);
const warehouseLandingStyles = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseLandingOperational.module.css'),
  'utf8'
);
const warehouseModuleShell = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseModuleShell.tsx'),
  'utf8'
);
const isometricPreview = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseIsometricPreview.tsx'),
  'utf8'
);
const warehouseCroquisR1 = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseCroquisR1Operational.tsx'),
  'utf8'
);
const warehouseVisualStyle = readFileSync(
  resolve(root, 'features/warehouse/visualStyle.ts'),
  'utf8'
);
const consumptionReports = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseConsumptionReports.tsx'),
  'utf8'
);
const itemControl = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseItemControlOperational.tsx'),
  'utf8'
);
const itemControlSummary = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseItemControlSummary.tsx'),
  'utf8'
);
const stockOperational = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseStockOperational.tsx'),
  'utf8'
);
const inventoryOperational = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseInventoryOperational.tsx'),
  'utf8'
);
const logisticsReports = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseLogisticsReports.tsx'),
  'utf8'
);
const siscofisHistoryReport = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseSiscofisHistoryReport.tsx'),
  'utf8'
);
const siscofisContract = readFileSync(
  resolve(root, 'lib/warehouse/siscofis.ts'),
  'utf8'
);
const siscofisPdfExtractor = readFileSync(
  resolve(root, 'lib/warehouse/siscofisPdf.ts'),
  'utf8'
);
const siscofisOperational = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseSiscofisOperational.tsx'),
  'utf8'
);
const pendingPhysicalAllocationRepository = readFileSync(
  resolve(root, 'lib/warehouse/pendingPhysicalAllocationRepository.ts'),
  'utf8'
);
const siscofisPendingAllocation = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseSiscofisPendingAllocation.tsx'),
  'utf8'
);
const inventoryHistoryReport = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseInventoryHistoryReport.tsx'),
  'utf8'
);
const navigation = readFileSync(
  resolve(root, 'features/warehouse/navigation.ts'),
  'utf8'
);
const normalizedNavigation = navigation.replaceAll('\r\n', '\n');
const warehouseRootRoute = readFileSync(
  resolve(root, 'app/adm-deposito/page.tsx'),
  'utf8'
);
const warehouseOverviewRoute = readFileSync(
  resolve(root, 'app/adm-deposito/meus-depositos/page.tsx'),
  'utf8'
);
const warehouseDepotsRoute = readFileSync(
  resolve(root, 'app/adm-deposito/controle-de-depositos/page.tsx'),
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
const INTERNAL_RULES_BUDGET_BYTES = 150 * 1024;

if (rulesBytes > INTERNAL_RULES_BUDGET_BYTES) {
  findings.push(
    'firestore.warehouse.rules ultrapassou o orçamento interno de 150 KiB: '
      + (rulesBytes / 1024).toFixed(2)
      + ' KiB.'
  );
}

if ((rules.match(/rules_version = '2';/g) || []).length !== 1) {
  findings.push('firestore.warehouse.rules deve conter exatamente uma declaração rules_version.');
}

if ((rules.match(/function validWarehouseWithdrawalBase\(/g) || []).length > 1) {
  findings.push('Rules de withdrawals foram duplicadas acidentalmente.');
}

if ((rules.match(/function warehouseMovementCreateAllowed\(/g) || []).length !== 1) {
  findings.push('Rules devem conter exatamente um warehouseMovementCreateAllowed.');
}

if ((rules.match(/function validWarehouseConsumptionBase\(/g) || []).length !== 1) {
  findings.push('Rules devem conter exatamente um validWarehouseConsumptionBase.');
}

if ((rules.match(/match \/withdrawals\/\{withdrawalId\}/g) || []).length > 1) {
  findings.push('Bloco match de withdrawals foi duplicado acidentalmente.');
}

if (!rules.trimEnd().endsWith('}')) {
  findings.push('firestore.warehouse.rules possui conteúdo residual após o fechamento final.');
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
    'outboundReturns',
    'withdrawals',
    'inventories',
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
  'function validWarehouseInventorySessionCreate(workspaceId, inventoryId)',
  'function validWarehouseInventorySessionUpdate(workspaceId, inventoryId)',
  'function validWarehouseInventoryItemCreate(workspaceId, inventoryId, itemId)',
  'function validWarehouseInventoryCountUpdate(workspaceId, inventoryId)',
  'function validWarehouseInventoryAdjustmentUpdate(workspaceId, inventoryId, itemId)',
  'function validWarehouseInventoryMovementCreate(workspaceId, movementId)',
  'function validWarehouseInventoryBalanceUpdate(workspaceId, materialId, movement)',
  'function validWarehouseInventoryLocationBalanceUpdate(workspaceId, locationBalanceId, movement)',
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
  "if (section === 'home')",
  'Início deve permanecer como superfície visual real.'
);
requireText(
  sectionContent,
  '<WarehouseLandingOperational workspaceId={workspaceId} />',
  'Início perdeu a visão geral visual dos depósitos.'
);
requireText(
  sectionContent,
  "if (section === 'overview')",
  'Meus Depósitos deve permanecer como superfície operacional real.'
);
requireText(
  sectionContent,
  '<WarehouseHomeOperational workspaceId={workspaceId} />',
  'Meus Depósitos voltou a ser substituído por placeholder em vez do localizador visual.'
);
requireText(
  sectionContent,
  "if (section === 'depots')",
  'Controle de Depósitos deve permanecer operacional.'
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
  "if (section === 'control')",
  'Controle de Materiais deve estar operacional nesta etapa modular.'
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
  outboundRepository,
  'quantityDelta: -plan.baseQuantity',
  'Saída de Material deixou de produzir delta negativo no ledger.'
);
requireText(
  outboundRepository,
  'quantityDelta: -plan.baseQuantity,',
  'Saída de Material deixou de reduzir a posição física selecionada.'
);
requireText(
  outboundRepository,
  'transaction.set(locationBalanceRef',
  'Saída de Material deixou de persistir a baixa do locationBalance.'
);
requireText(
  outboundRepository,
  'lot.quantity - plan.baseQuantity',
  'Saída de Material deixou de reduzir o lote selecionado.'
);
requireText(
  warehouseHome,
  'item.balance.quantity > 0',
  'Meus Depósitos voltou a projetar no depósito posições com saldo zero.'
);
requireText(
  warehouseHome,
  'listWarehousePositiveLocationBalances(workspaceId, 500)',
  'Meus Depósitos voltou a ler locationBalances zerados sem necessidade.'
);
requireText(
  warehouseHome,
  'listWarehousePositiveBalances(workspaceId, 250)',
  'Meus Depósitos voltou a consultar saldo agregado sem restringir saldo positivo.'
);
requireText(
  warehouseHome,
  'depotMaterialIds.has(material.id)',
  'Pesquisa do Meus Depósitos voltou a oferecer material sem saldo físico no depósito selecionado.'
);
requireText(
  warehouseHome,
  '<WarehouseIsometricPreview',
  'Meus Depósitos deixou de reutilizar o renderer 3D oficial do ADM Depósito.'
);
requireText(
  warehouseCroquisR1,
  '<WarehouseIsometricPreview',
  'Controle de Depósitos deixou de reutilizar o renderer 3D oficial na prévia do Croqui.'
);
requireText(
  warehouseLanding,
  'WAREHOUSE_BOX_VISUAL',
  'Início deixou de importar a paleta oficial compartilhada das caixas.'
);
requireText(
  warehouseLanding,
  'WAREHOUSE_PALLET_VISUAL',
  'Início deixou de importar a paleta oficial compartilhada dos paletes.'
);
requireText(
  warehouseLanding,
  'fill={WAREHOUSE_BOX_VISUAL.frontFill}',
  'Início deixou de aplicar a paleta oficial compartilhada às caixas.'
);
requireText(
  isometricPreview,
  'WAREHOUSE_BOX_VISUAL',
  'Renderer 3D deixou de importar a paleta oficial compartilhada das caixas.'
);
requireText(
  isometricPreview,
  'WAREHOUSE_PALLET_VISUAL',
  'Renderer 3D deixou de importar a paleta oficial compartilhada dos paletes.'
);
requireText(
  isometricPreview,
  'fill={WAREHOUSE_BOX_VISUAL.frontFill}',
  'Renderer 3D deixou de aplicar a paleta oficial compartilhada às caixas.'
);
requireText(
  isometricPreview,
  'data-visual-role="warehouse-stock-box"',
  'Renderer 3D perdeu a caixa isométrica padronizada.'
);
for (const visualToken of [
  "frontFill: '#bf7834'",
  "frontStroke: '#e1ad6b'",
  "sideFill: '#925528'",
  "sideStroke: '#c98745'",
  "topFill: '#dda05a'",
  "topStroke: '#efc183'",
]) {
  requireText(
    warehouseVisualStyle,
    visualToken,
    'Paleta oficial compartilhada das caixas foi alterada fora da decisão visual consolidada.'
  );
}
for (const palletVisualToken of [
  "topLight: '#e8bf7a'",
  "topMid: '#cf9650'",
  "topDark: '#b77939'",
  "frontFill: '#9b642f'",
  "sideFill: '#7c4a22'",
  "runnerFill: '#70431f'",
]) {
  requireText(
    warehouseVisualStyle,
    palletVisualToken,
    'Paleta oficial compartilhada dos paletes foi alterada fora da decisão visual consolidada.'
  );
}
requireText(
  warehouseLanding,
  'function warehousePallet(',
  'Início perdeu o renderer único oficial dos paletes.'
);
requireText(
  warehouseLanding,
  "'receiving-warehouse-pallet'",
  'Área de recebimento deixou de reutilizar o renderer oficial dos paletes.'
);
requireText(
  warehouseLanding,
  "'allocated-warehouse-pallet'",
  'Estoque interno deixou de reutilizar o renderer oficial dos paletes.'
);
requireText(
  isometricPreview,
  'data-visual-role="warehouse-pallet"',
  'Renderer 3D compartilhado perdeu o palete visual padronizado.'
);
requireText(
  isometricPreview,
  "'Palete',",
  'Palete da Visão 3D perdeu o balão de identificação do local.'
);
requireText(
  isometricPreview,
  "subpositions.length ? subpositions.length + ' subposições' : 'Local aberto'",
  'Balão do palete perdeu o detalhamento de identificação do local.'
);
if (isometricPreview.includes('runnerRatios.flatMap((rx) => [0.17, 0.5, 0.83]')) {
  fail('Palete da Visão 3D voltou a desenhar os blocos/pés antigos fora da estrutura.');
}
if (warehouseLanding.includes("key={'pallet-block-' + index}")) {
  fail('Palete da Início voltou a desenhar os blocos/pés antigos fora da estrutura.');
}
requireText(
  isometricPreview,
  'const slatBottomZ = z - 3.2;',
  'Palete da Visão 3D voltou a usar superfície contínua em vez de ripas físicas.'
);
requireText(
  isometricPreview,
  "key={'slat-' + index}",
  'Palete da Visão 3D perdeu as ripas individuais.'
);
requireText(
  warehouseLanding,
  "key={'pallet-slat-' + index}",
  'Palete da Início perdeu as ripas individuais.'
);
requireText(
  warehouseLanding,
  'const gap = Math.max(0.9, cellWidth * 0.18);',
  'Palete da Início perdeu os vãos reais entre as ripas.'
);
requireText(
  warehouseLanding,
  'WAREHOUSE_PALLET_VISUAL',
  'Início deixou de usar a paleta oficial compartilhada dos paletes.'
);
requireText(
  isometricPreview,
  'WAREHOUSE_PALLET_VISUAL',
  'Visão 3D deixou de usar a paleta oficial compartilhada dos paletes.'
);
requireText(
  warehouseLanding,
  'WAREHOUSE_RACK_VISUAL',
  'Início deixou de usar a identidade visual compartilhada das estantes.'
);
requireText(
  isometricPreview,
  'WAREHOUSE_RACK_VISUAL',
  'Visão 3D deixou de usar a identidade visual compartilhada das estantes.'
);
requireText(
  warehouseLanding,
  'function warehouseRackBeam(',
  'Início perdeu as travessas volumétricas das estantes.'
);
requireText(
  isometricPreview,
  'function rackBeamPrism(',
  'Visão 3D perdeu as travessas volumétricas das estantes.'
);
for (const rackRole of [
  "'rack-front-beam'",
  "'rack-rear-beam'",
  "'rack-side-beam'",
]) {
  requireText(
    warehouseLanding,
    rackRole,
    'Início perdeu uma das orientações estruturais das travessas da estante.'
  );
  requireText(
    isometricPreview,
    rackRole,
    'Visão 3D perdeu uma das orientações estruturais das travessas da estante.'
  );
}
if (warehouseLanding.includes('stroke="#f47f13"')) {
  fail('Início voltou a usar linha laranja simples em vez de travessa volumétrica na estante.');
}
if (isometricPreview.includes('stroke={beam}')) {
  fail('Visão 3D voltou a usar linha laranja simples em vez de travessa volumétrica na estante.');
}
for (const rackVisualToken of [
  "postDark: '#0e3556'",
  "beamFront: '#f47f13'",
  "beamTop: '#ff9b36'",
  "beamSide: '#c85e08'",
  "rearBeamFront: '#d96b0d'",
  "deckTop: '#f4f7f9'",
]) {
  requireText(
    warehouseVisualStyle,
    rackVisualToken,
    'Identidade visual oficial das estantes foi alterada fora da decisão consolidada.'
  );
}
requireText(
  isometricPreview,
  'const beamDepth = clamp(object.height * 0.065, 2.6, 7.2);',
  'Travessas da Visão 3D voltaram a ficar espessas demais.'
);
requireText(
  isometricPreview,
  'const beamHeight = 3.35;',
  'Altura visual das travessas da Visão 3D saiu do perfil fino consolidado.'
);
requireText(
  warehouseLanding,
  'const beamDepth = Math.max(0.8, Math.min(height * 0.065, 2.8));',
  'Travessas da Início voltaram a ficar espessas demais.'
);
requireText(
  warehouseLanding,
  'const beamHeight = Math.max(1.55, Math.min(2.8, z * 0.027));',
  'Altura visual das travessas da Início saiu do perfil fino consolidado.'
);
if (isometricPreview.includes("fill={selected ? '#ffe8a8' : '#e7b26b'}")) {
  fail('Renderer 3D voltou a usar a caixa visual antiga em vez da paleta compartilhada.');
}
requireText(
  warehouseHome,
  'embedded',
  'Renderer 3D do Meus Depósitos deixou de usar o modo embutido dedicado.'
);
requireText(
  warehouseHome,
  'Validade / FEFO',
  'Meus Depósitos perdeu a leitura consultiva de validade/FEFO.'
);
requireText(
  warehouseHomeStyles,
  'linear-gradient(145deg, #030714 0%, #07101f 46%, #02040b 100%)',
  'Meus Depósitos perdeu a identidade visual imersiva alinhada à Home do EMPROVEX.'
);
requireText(
  warehouseModuleShell,
  "const isImmersive = section === 'home' || section === 'overview';",
  'Shell do ADM deixou de manter Início e Meus Depósitos como superfícies imersivas.'
);
requireText(
  warehouseModuleShell,
  '<AppBackground immersive={isImmersive} />',
  'Shell do ADM deixou de aplicar o fundo imersivo ao Início e Meus Depósitos.'
);
requireText(
  navigation,
  "id: 'home'",
  'Navegação perdeu a nova aba Início.'
);
requireText(
  normalizedNavigation,
  "id: 'overview',\n    label: 'Meus Depósitos',\n    href: '/adm-deposito/meus-depositos'",
  'Meus Depósitos perdeu sua rota dedicada.'
);
requireText(
  normalizedNavigation,
  "id: 'depots',\n    label: 'Controle de Depósitos',\n    href: '/adm-deposito/controle-de-depositos'",
  'Controle de Depósitos perdeu sua rota dedicada.'
);
requireText(
  warehouseRootRoute,
  'section="home"',
  'Rota raiz do ADM Depósito deixou de abrir o novo Início.'
);
requireText(
  warehouseOverviewRoute,
  'section="overview"',
  'Rota Meus Depósitos deixou de abrir a central visual premium.'
);
requireText(
  warehouseDepotsRoute,
  'section="depots"',
  'Rota Controle de Depósitos deixou de abrir a manutenção estrutural.'
);
requireText(
  warehouseLanding,
  'listWarehouseDepots(workspaceId, 250)',
  'Início deixou de carregar os depósitos de forma bounded.'
);
requireText(
  warehouseLanding,
  'listWarehouseDepotLayouts(workspaceId, 150)',
  'Início deixou de reutilizar os croquis oficiais de forma bounded.'
);
requireText(
  warehouseLanding,
  'listWarehouseLocations(workspaceId, 500)',
  'Início deixou de carregar os locais internos necessários à representação dos croquis.'
);
requireText(
  warehouseLanding,
  'listWarehousePositiveLocationBalances(workspaceId, 500)',
  'Início deixou de carregar somente saldos físicos positivos para projetar ocupação.'
);
requireText(
  warehouseLanding,
  "visualRole = 'allocated-stock-box'",
  'Renderer de caixas da Início perdeu o papel visual padrão do estoque alocado.'
);
requireText(
  warehouseLanding,
  'data-visual-role={visualRole}',
  'Início deixou de propagar o papel visual das caixas para o SVG.'
);
requireText(
  warehouseLanding,
  "'allocated-pallet-'",
  'Início deixou de projetar caixas de estoque sobre paletes internos ocupados.'
);
requireText(
  warehouseLanding,
  "'allocated-shelf-'",
  'Início deixou de projetar caixas de estoque sobre estantes ocupadas.'
);
requireText(
  warehouseLanding,
  'function warehouseBox(',
  'Início perdeu o renderer único oficial das caixas.'
);
requireText(
  warehouseLanding,
  "'receiving-stock-box'",
  'Área de recebimento deixou de reutilizar o renderer único das caixas.'
);
if (warehouseLanding.includes('function stockBox(')) {
  fail('Início voltou a manter um renderer paralelo para caixas internas.');
}
requireText(
  warehouseLanding,
  'occupancyBySubposition',
  'Início deixou de posicionar ocupação por subposição nas estantes.'
);
requireText(
  warehouseLanding,
  'visualBoxes(quantity',
  'Início deixou de limitar a representação visual de estoque por faixa de quantidade.'
);
requireText(
  warehouseLanding,
  'subpositionsByParent',
  'Início deixou de representar subposições internas vinculadas aos locais.'
);
requireText(
  warehouseLanding,
  'fill="#f5f8fa"',
  'Depósitos do Início deixaram de usar a base clara coerente com a Visão 3D oficial.'
);
requireText(
  warehouseLanding,
  "object.kind === 'SHELF' || object.kind === 'RACK'",
  'Início perdeu a representação detalhada de estantes/racks.'
);
requireText(
  warehouseLanding,
  'const a = isoPoint(x, y, 0);',
  'Início perdeu o vértice isométrico de origem usado por piso e estruturas.'
);
requireText(
  warehouseLanding,
  'loadWarehouseInvoiceIntakeQueue(workspaceId)',
  'Início deixou de refletir as pendências reais de alocação.'
);
requireText(
  warehouseLanding,
  "row.pendingQuantity > 0.000001",
  'Paletes do Início deixaram de representar somente itens realmente pendentes.'
);
requireText(
  warehouseLanding,
  '/adm-deposito/meus-depositos?deposito=',
  'Clique em depósito no Início deixou de direcionar para Meus Depósitos.'
);
requireText(
  warehouseLanding,
  'data-visual-role="world-floor"',
  'Início perdeu o piso único do ambiente isométrico.'
);
requireText(
  warehouseLanding,
  'data-visual-role="world-grid"',
  'Início perdeu a grade isométrica integrada ao mesmo ambiente.'
);
requireText(
  warehouseLanding,
  'data-visual-role="depots-world"',
  'Início deixou de projetar os depósitos no mesmo mundo visual.'
);
requireText(
  warehouseLanding,
  'data-visual-role="receiving-yard"',
  'Início deixou de manter os paletes no mesmo ambiente dos depósitos.'
);
requireText(
  warehouseLanding,
  'data-visual-role="text-overlay"',
  'Textos essenciais do Início deixaram de ser renderizados na camada frontal.'
);
requireText(
  warehouseLanding,
  'className={styles.yardTextBackdrop}',
  'Título da área de recebimento perdeu o fundo de contraste.'
);
for (const forbiddenInternalLabel of [
  'renderLocationTag',
  '{linked.code}',
]) {
  if (warehouseLanding.includes(forbiddenInternalLabel)) {
    fail('Início voltou a poluir os depósitos com legenda interna: ' + forbiddenInternalLabel);
  }
}
for (const forbiddenLandingSurface of [
  'depotGrid',
  'depotCard',
  'pendingYard',
  'summary',
  'glassCard',
]) {
  if (warehouseLanding.includes(forbiddenLandingSurface)) {
    fail('Início voltou a fragmentar a cena em cards/painéis: ' + forbiddenLandingSurface);
  }
}
for (const forbiddenLandingToken of [
  'listWarehouseMaterials(',
  'listWarehousePositiveBalances(',

  'listWarehouseLots(',
  'transferWarehouseStock(',
  'saveWarehouseMaterial(',
  'allocateWarehousePendingItem(',
]) {
  if (warehouseLanding.includes(forbiddenLandingToken)) {
    fail('Início visual voltou a carregar ou executar operação desnecessária: ' + forbiddenLandingToken);
  }
}

for (const forbiddenToken of [
  'Lotes e validade',
  'Lote {lot.code}',
  'warehouse-lot-create-code',
  'transferWarehouseStock(',
  'finalizeWarehouseMaterialWithdrawal(',
  'saveWarehouseMaterial(',
]) {
  if (warehouseHome.includes(forbiddenToken)) {
    fail('Meus Depósitos voltou a duplicar manutenção/operação ou expor lote: ' + forbiddenToken);
  }
}
requireText(
  isometricPreview,
  'if (balance.quantity <= 0) continue;',
  'Prévia 3D voltou a considerar saldo físico zerado como ocupação.'
);
requireText(
  isometricPreview,
  'balance.materialId !== selectedMaterialId || balance.quantity <= 0',
  'Prévia 3D voltou a destacar material sem saldo positivo.'
);
requireText(
  isometricPreview,
  'availableMaterialIds.has(material.id)',
  'Pesquisa da Prévia 3D voltou a oferecer materiais sem saldo físico positivo.'
);
requireText(
  isometricPreview,
  "balance.quantity <= 0 || balance.position.kind === 'UNASSIGNED'",
  'Prévia 3D voltou a considerar material sem presença física como disponível para pesquisa.'
);
requireText(
  consumptionReports,
  "fixedOrigin === 'STOCK_OUTBOUND' ? 'monthly' : 'daily'",
  'Relatórios de Saída deixaram de abrir com recorte mensal útil.'
);
requireText(
  consumptionReports,
  "fixedOrigin === 'STOCK_OUTBOUND'",
  'Registro de Saídas deixou de condicionar o carregamento automático à origem STOCK_OUTBOUND.'
);
requireText(
  consumptionReports,
  'initialOutboundLoadDone.current = true',
  'Registro de Saídas deixou de executar a carga automática inicial.'
);
requireText(
  consumptionReports,
  'returnWarehouseStockOutbound',
  'Relatórios de Saída perderam a ação de cancelamento/devolução.'
);
requireText(
  consumptionReports,
  'Cancelar / devolver',
  'Interface de Saída perdeu o comando visível de cancelamento/devolução.'
);
requireText(
  withdrawalRepository,
  'export async function returnWarehouseStockOutbound(',
  'Repository perdeu a fachada de devolução auditável de saída.'
);
requireText(
  withdrawalRepository,
  "registerWarehouseManualEntry(",
  'Devolução deixou de reutilizar o motor oficial de Entrada Avulsa.'
);
requireText(
  withdrawalRepository,
  "provenance: 'Devolução de saída'",
  'Entrada de devolução perdeu a procedência auditável.'
);
requireText(
  withdrawalRepository,
  'reference: consumptionId',
  'Entrada de devolução perdeu o vínculo com a saída original.'
);
requireText(
  withdrawalRepository,
  "position: originalSource.position",
  'Devolução deixou de solicitar reposicionamento na posição original.'
);
requireText(
  withdrawalRepository,
  "expiresOn,",
  'Devolução perdeu o reaproveitamento da validade original quando disponível.'
);
requireText(
  manualEntryRepository,
  'transferWarehouseStock(scope.workspaceId, {',
  'Motor de Entrada Avulsa deixou de reutilizar TRANSFER para posicionamento físico.'
);
if (withdrawalRepository.includes('/api/adm-deposito/outbound-return')) {
  fail('Devolução voltou a depender de API server-only desnecessária.');
}
if (withdrawalRepository.includes("type: 'OUTBOUND_RETURN'")) {
  fail('Repository voltou a criar movimento especial OUTBOUND_RETURN em vez de reutilizar MANUAL_ENTRY.');
}
requireText(
  rules,
  'match /outboundReturns/{consumptionId}',
  'Rules perderam a coleção leve de marcação da devolução.'
);
requireText(
  rules,
  "request.resource.data.schemaVersion == 'warehouse_outbound_return_v1'",
  'Rules perderam o contrato do marcador leve de devolução.'
);
requireText(
  rules,
  'request.resource.data.returnedQuantity <= request.resource.data.originalQuantity',
  'Rules perderam o limite quantitativo na criação do marcador.'
);
requireText(
  rules,
  'request.resource.data.returnedQuantity <= resource.data.originalQuantity',
  'Rules perderam o limite quantitativo na atualização do marcador.'
);
requireText(
  withdrawalRepository,
  "provenance: 'Devolução de saída'",
  'Repository perdeu a procedência auditável da devolução.'
);
requireText(
  withdrawalRepository,
  "registerWarehouseManualEntry(",
  'Repository deixou de reutilizar o motor oficial de Entrada Avulsa.'
);
if (rules.includes("source.kind == 'OUTBOUND_RETURN'")) {
  fail('Rules voltaram a introduzir caminho especial OUTBOUND_RETURN.');
}
requireText(
  outboundReturnSecurityTest,
  'movimento especial legado OUTBOUND_RETURN permanece bloqueado; devolução usa entrada auditável',
  'Teste de segurança deixou de bloquear o formato antigo OUTBOUND_RETURN.'
);
requireText(
  outboundReturnSecurityTest,
  "cancelamento parcial gera MANUAL_ENTRY auditável no estoque",
  'Teste de segurança deixou de provar a devolução via MANUAL_ENTRY auditável.'
);
requireText(
  outboundReturnSecurityTest,
  "marcador leve finaliza a devolução sem atualizar consumptions",
  'Teste de segurança deixou de provar a marcação separada da devolução.'
);
requireText(
  outboundReturnSecurityTest,
  "marcador de devolução bloqueia quantidade acima da saída original",
  'Teste de segurança deixou de provar o limite quantitativo do marcador.'
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
  fail('Saída de Material voltou a ficar duplicada dentro de Controle de Materiais.');
}
requireText(
  itemControl,
  "id: 'summary'",
  'Controle de Materiais perdeu a subaba Resumo.'
);
requireText(
  itemControl,
  "id: 'stock'",
  'Controle de Materiais perdeu a subaba Estoque.'
);
requireText(
  itemControl,
  "id: 'movements'",
  'Controle de Materiais perdeu a subaba Movimentações.'
);
requireText(
  itemControl,
  "id: 'inventory'",
  'Controle de Materiais perdeu a subaba Inventário.'
);
requireText(
  itemControl,
  "id: 'reports'",
  'Controle de Materiais perdeu a subaba Relatórios.'
);
for (const redundantTab of ["id: 'outbound'", "id: 'deliveries'", "id: 'alerts'", "id: 'siscofis'", "id: 'settings'"]) {
  if (itemControl.includes(redundantTab)) {
    fail('Controle de Materiais voltou a duplicar superfície externa: ' + redundantTab);
  }
}
requireText(
  itemControlSummary,
  'listWarehouseInventorySessions(workspaceId, 24)',
  'Resumo do Controle perdeu a leitura bounded de inventários.'
);
requireText(
  itemControlSummary,
  'listWarehouseMovements(workspaceId, 40)',
  'Resumo do Controle perdeu o histórico bounded de movimentações.'
);
requireText(
  logisticsReports,
  'WarehouseSiscofisHistoryReport',
  'Relatórios do Controle voltaram a usar a superfície operacional de migração SISCOFIS.'
);
if (logisticsReports.includes('WarehouseSiscofisOperational')) {
  fail('Controle de Materiais voltou a duplicar a migração SISCOFIS da Alocação de Material.');
}
requireText(
  logisticsReports,
  'WarehouseInventoryHistoryReport',
  'Relatórios do Controle voltaram a usar a superfície operacional de Inventário.'
);
requireText(
  logisticsReports,
  "{ id: 'outbound', label: 'Relatórios de Saída' }",
  'Relatórios do Controle perderam a separação de Saída.'
);
requireText(
  logisticsReports,
  "{ id: 'immediate', label: 'Relatórios de Consumo Imediato' }",
  'Relatórios do Controle perderam a separação de Consumo Imediato.'
);
requireText(
  logisticsReports,
  'fixedOrigin="STOCK_OUTBOUND"',
  'Relatórios de Saída deixaram de fixar a origem STOCK_OUTBOUND.'
);
requireText(
  logisticsReports,
  'fixedOrigin="IMMEDIATE_CONSUMPTION"',
  'Relatórios de Consumo Imediato deixaram de fixar a origem correta.'
);
if (logisticsReports.includes("{ id: 'consumption', label: 'Consumo e saídas' }")) {
  fail('Relatórios voltaram a misturar Saída e Consumo Imediato na mesma subaba.');
}
requireText(
  materialWithdrawal,
  'fixedOrigin="STOCK_OUTBOUND"',
  'Relatórios internos da Saída de Material voltaram a misturar consumo imediato.'
);
requireText(
  consumptionReports,
  "? 'Registro de Saídas'",
  'Registro de Saídas perdeu o título operacional específico.'
);
requireText(
  consumptionReports,
  'initialOutboundLoadDone.current',
  'Registro de Saídas voltou a repetir leituras automáticas a cada alteração de período.'
);
requireText(
  consumptionReports,
  "? 'Relatórios de Consumo Imediato'",
  'Componente de relatórios perdeu o título específico de Consumo Imediato.'
);
requireText(
  consumptionReports,
  "includeLegacy: fixedOrigin !== 'IMMEDIATE_CONSUMPTION'",
  'Relatório de Consumo Imediato voltou a consultar movimentos legados de saída sem necessidade.'
);
if (logisticsReports.includes('WarehouseInventoryOperational')) {
  fail('Relatórios voltaram a permitir mutação de inventário fora da subaba Inventário.');
}
requireText(
  inventoryHistoryReport,
  'listWarehouseInventorySessions(workspaceId, 60)',
  'Histórico de inventários perdeu a consulta bounded de sessões.'
);
requireText(
  inventoryHistoryReport,
  'listWarehouseInventoryItems(workspaceId, record.session.id, 500)',
  'Histórico de inventários perdeu o detalhamento bounded de itens.'
);
requireText(
  siscofisHistoryReport,
  'listWarehouseSiscofisSnapshots(workspaceId, 24)',
  'Relatório SISCOFIS perdeu a consulta somente leitura bounded.'
);
requireText(
  siscofisContract,
  "if (!input.numeroItem.trim().startsWith('07')) return 'NON_ACCOUNT_07';",
  'Migração SISCOFIS deixou de restringir o Marco Zero à conta de consumo 07.'
);
requireText(
  siscofisContract,
  "if (/\\bin natura\\b/.test(description)) return 'FRESH_HORTIFRUTI';",
  'Migração SISCOFIS deixou de excluir hortifruti explicitamente in natura.'
);
requireText(
  siscofisContract,
  'SISCOFIS_FRESH_HORTIFRUTI_NAMES',
  'Migração SISCOFIS perdeu a classificação determinística de hortifruti fresco.'
);
requireText(
  siscofisContract,
  'SISCOFIS_PROCESSED_HORTIFRUTI_MARKERS',
  'Migração SISCOFIS perdeu a proteção contra falso positivo em produtos processados.'
);
requireText(
  siscofisContract,
  "'siscofis_non_account_07_filtered'",
  'Migração SISCOFIS deixou de sinalizar linhas fora da conta 07.'
);
requireText(
  siscofisContract,
  "'siscofis_fresh_hortifruti_filtered'",
  'Migração SISCOFIS deixou de sinalizar hortifruti/granjeiros filtrados.'
);
requireText(
  siscofisContract,
  '3. quantidade — origem obrigatória: "Qtde Exist";',
  'Prompt SISCOFIS deixou de usar Qtde Exist como quantidade física do Marco Zero.'
);
requireText(
  siscofisContract,
  '- NÃO use "Qtde Disp";',
  'Prompt SISCOFIS voltou a permitir Qtde Disp no lugar de Qtde Exist.'
);
requireText(
  siscofisContract,
  'FILTRO OBRIGATÓRIO — NÃO MIGRAR HORTIFRUTI/GRANJEIROS:',
  'Prompt SISCOFIS perdeu a exclusão explícita de hortifruti/granjeiros.'
);
requireText(
  siscofisPdfExtractor,
  'extractEmprovexSiscofisInventoryFromPdfBytes',
  'Migração SISCOFIS perdeu o extrator local determinístico de PDF.'
);
requireText(
  siscofisPdfExtractor,
  "new TextDecoder('windows-1252')",
  'Extrator PDF deixou de preservar a codificação textual do relatório SISCOFIS.'
);
for (const pdfColumn of [
  "byText('Nr Ficha')",
  "byText('Nome do Material')",
  "byText('Qtde Exist')",
  "byText('Qtde Disp')",
  "byText('Vlr Unit')",
]) {
  requireText(
    siscofisPdfExtractor,
    pdfColumn,
    'Extrator PDF SISCOFIS perdeu coluna estrutural: ' + pdfColumn
  );
}
if (
  siscofisPdfExtractor.includes('fetch(')
  || siscofisPdfExtractor.includes('https://')
  || siscofisPdfExtractor.includes('http://')
) {
  fail('Extrator local do PDF SISCOFIS passou a depender de rede externa.');
}
requireText(
  siscofisOperational,
  'data-testid="warehouse-siscofis-pdf-direct"',
  'Migração SISCOFIS perdeu a opção visual de PDF direto.'
);
requireText(
  siscofisOperational,
  'data-testid="warehouse-siscofis-pdf-input"',
  'Migração SISCOFIS perdeu o seletor de PDF direto.'
);
requireText(
  siscofisOperational,
  "const { extractEmprovexSiscofisInventoryFromPdfBytes } = await import(",
  'Extrator PDF deixou de ser carregado sob demanda.'
);
requireText(
  siscofisOperational,
  "'../../../lib/warehouse/siscofisPdf'",
  'Migração SISCOFIS perdeu o módulo local do extrator PDF.'
);
requireText(
  siscofisOperational,
  'prepareEmprovexSiscofisInventoryImport(',
  'PDF direto deixou de convergir para a prévia oficial SISCOFIS.'
);
requireText(
  siscofisOperational,
  "'PDF SISCOFIS — ' + file.name",
  'PDF direto perdeu o rótulo auditável de origem do arquivo.'
);
requireText(
  itemRegistration,
  'WarehouseSiscofisPendingAllocation',
  'Alocação de Material perdeu a fila de pendências do Marco Zero SISCOFIS.'
);
requireText(
  itemRegistration,
  'Materiais pendentes',
  'Alocação de Material voltou a limitar a aba principal às Notas Fiscais.'
);
for (const pendingMarker of [
  'listWarehouseSiscofisSnapshots(workspaceId, 25)',
  "snapshot.kind === 'MARCO_ZERO'",
  "snapshot.status === 'CONFIRMED'",
  "balance.position.kind !== 'UNASSIGNED'",
  'listWarehousePositiveLocationBalances(workspaceId, 500)',
  'transferWarehouseStock(workspaceId, {',
  "from: { kind: 'UNASSIGNED' }",
]) {
  requireText(
    pendingPhysicalAllocationRepository,
    pendingMarker,
    'Pendência física SISCOFIS perdeu contrato: ' + pendingMarker
  );
}
if (pendingPhysicalAllocationRepository.includes('applyWarehouseMovement(')) {
  fail('Pendência SISCOFIS passou a duplicar saldo em vez de usar TRANSFER.');
}
requireText(
  siscofisPendingAllocation,
  'data-testid="warehouse-siscofis-pending-allocation"',
  'Pendência física SISCOFIS perdeu a superfície operacional.'
);
requireText(
  siscofisPendingAllocation,
  'allocateWarehousePendingPhysicalStock(workspaceId, {',
  'Pendência física SISCOFIS deixou de usar o motor dedicado de transferência.'
);
requireText(
  rules,
  'match /inventories/{inventoryId}',
  'Inventário não está liberado no database dedicado.'
);
requireText(
  rules,
  "movement.type == 'INVENTORY_ADJUSTMENT'",
  'Rules perderam o ajuste auditável de inventário.'
);


for (const [surfaceName, surfaceSource] of [
  ['Saída de Material', materialWithdrawal],
  ['Relatórios da Saída de Material', consumptionReports],
  ['Controle de Materiais', itemControl],
  ['Resumo do Controle de Materiais', itemControlSummary],
  ['Estoque do Controle de Materiais', stockOperational],
  ['Inventário do Controle de Materiais', inventoryOperational],
  ['Relatórios do Controle de Materiais', logisticsReports],
  ['Histórico SISCOFIS do Controle', siscofisHistoryReport],
  ['Histórico de Inventários do Controle', inventoryHistoryReport],
]) {
  for (const forbiddenToken of [
    'bg-[#071020]',
    'bg-black/20',
    'bg-black/25',
    'bg-black/15',
    'border-white/[0.08]',
    'border-white/[0.07]',
    'border-white/10',
    'bg-[linear-gradient(160deg,rgba(255,255,255,0.04)',
    'linear-gradient(135deg,rgba(4,12,28',
  ]) {
    if (surfaceSource.includes(forbiddenToken)) {
      fail(surfaceName + ' voltou a introduzir dark mode operacional: ' + forbiddenToken);
    }
  }
}

requireText(
  materialWithdrawal,
  "bg-[#00288e]",
  'Saída de Material perdeu o azul institucional nas ações primárias.'
);
requireText(
  materialWithdrawal,
  'border border-slate-200 bg-white',
  'Saída de Material perdeu formulários claros de alto contraste.'
);
requireText(
  consumptionReports,
  "bg-[#00288e]",
  'Relatórios da Saída perderam o azul institucional.'
);
requireText(
  consumptionReports,
  'border border-slate-200 bg-white',
  'Relatórios da Saída perderam o tema claro operacional.'
);
requireText(
  stockOperational,
  '.filter((balance) => hasWarehouseAvailableStock(balance.quantity))',
  'Estoque voltou a exibir materiais sem saldo disponível.'
);
requireText(
  stockOperational,
  'listWarehousePositiveBalances(workspaceId, 250)',
  'Estoque voltou a consultar balances sem restringir saldo positivo.'
);
requireText(
  ledgerRepository,
  "where('quantity', '>', 0)",
  'Consulta bounded de Estoque perdeu o filtro Firestore de saldo positivo.'
);
requireText(
  stockOperational,
  '.sort(compareWarehouseStockAvailability)',
  'Estoque perdeu a prioridade de ordenação pela menor validade.'
);
requireText(
  stockOperational,
  'summary.availableLots.map((lot) => warehouseLotExpiryState(lot))',
  'Filtro de validade voltou a considerar lotes sem saldo/inativos como estoque atual.'
);
requireText(
  stockOperational,
  'transferWarehouseStock(workspaceId, {',
  'Detalhe do item perdeu a alteração auditável de localidade.'
);
requireText(
  stockOperational,
  '.filter((item) => isWarehouseLocatedBalance(item))',
  'Ficha do item voltou a misturar saldo UNASSIGNED com localizações físicas.'
);
requireText(
  stockOperational,
  "position: { kind: 'UNASSIGNED' } as WarehouseStockPosition",
  'Ficha do item perdeu a representação única do saldo sem localização.'
);
requireText(
  stockOperational,
  'relocateLotIds,',
  'Realocação do item deixou de transportar os lotes ativos da posição.'
);
requireText(
  stockOperational,
  'saveWarehouseBarcodeAssociation(workspaceId, {',
  'Detalhe do item perdeu a inclusão de código de barras.'
);
requireText(
  stockOperational,
  'replaceWarehouseBarcodeAssociation(',
  'Detalhe do item perdeu a edição auditável de código de barras.'
);
requireText(
  stockOperational,
  'updateWarehouseLot(workspaceId, editingLotId, {',
  'Detalhe do item perdeu a edição de validade.'
);
requireText(
  stockOperational,
  'createWarehouseLot(workspaceId, {',
  'Detalhe do item perdeu o registro técnico de validade.'
);
requireText(
  itemRegistration,
  "setTab('manual')",
  'Alocação de Material perdeu a subaba Entrada avulsa.'
);
requireText(
  itemRegistration,
  '<WarehouseManualEntryOperational workspaceId={workspaceId} />',
  'Entrada avulsa deixou de montar a superfície operacional própria.'
);
requireText(
  manualEntryOperational,
  'Procedência diversa',
  'Entrada avulsa perdeu o campo obrigatório de procedência.'
);
requireText(
  manualEntryOperational,
  'Registrar entrada avulsa',
  'Entrada avulsa perdeu a ação explícita de confirmação.'
);
requireText(
  manualEntryRepository,
  "type: 'MANUAL_ENTRY'",
  'Entrada avulsa deixou de usar movimento próprio no ledger.'
);
requireText(
  manualEntryRepository,
  "from: { kind: 'UNASSIGNED' }",
  'Entrada avulsa deixou de passar pela projeção UNASSIGNED antes da localização física.'
);
requireText(
  manualEntryRepository,
  'transferWarehouseStock(scope.workspaceId, {',
  'Entrada avulsa deixou de reutilizar o motor oficial de TRANSFER.'
);
requireText(
  rules,
  "'INITIAL_BALANCE', 'MANUAL_ENTRY', 'INVOICE_ENTRY'",
  'Rules deixaram de reconhecer MANUAL_ENTRY como entrada quantitativa positiva.'
);
requireText(
  rules,
  "source.kind == 'MANUAL_ENTRY'",
  'Rules perderam a procedência estruturada da entrada avulsa.'
);
requireText(
  rules,
  "request.resource.data.type == 'MANUAL_ENTRY'",
  'Rules deixaram de exigir source auditável na entrada avulsa.'
);
requireText(
  itemRegistration,
  "lotCode: ''",
  'Alocação deixou de ocultar o código técnico de lote do operador.'
);
requireText(
  stockOperational,
  'createWarehousePendingLotCode(crypto.randomUUID())',
  'Registro manual de validade deixou de gerar código técnico interno automaticamente.'
);
requireText(
  allocatedItems,
  'A validade é o único dado temporal editável do item.',
  'Edição de item perdeu a simplificação para descritivo, validade e código de barras.'
);
requireText(
  allocatedItems,
  'createWarehousePendingLotCode(crypto.randomUUID())',
  'Item legado sem referência técnica deixou de permitir cadastro simples de validade.'
);
requireText(
  allocatedItems,
  'createWarehouseLot(workspaceId, {',
  'Item legado sem validade deixou de criar a referência técnica interna necessária.'
);
requireText(
  materialWithdrawal,
  'Validade / FEFO',
  'Saída de Material voltou a expor lote em vez de validade.'
);
requireText(
  outboundDocuments,
  'confira quantidade/validade',
  'Documento de saída voltou a orientar conferência por lote.'
);

for (const [surfaceName, surfaceSource, forbiddenTokens] of [
  ['Alocação de item', itemRegistration, ['Lote · opcional', 'setLotCode(', 'value={lotCode}']],
  ['Itens armazenados', allocatedItems, ['Lote e validade', '>Lote:</span>', 'warehouseLotDisplayCode']],
  ['Ficha do Estoque', stockOperational, ['Código do lote', 'warehouse-lot-create-code', '>Lotes e validade</p>', '>Lotes rastreados</p>']],
  ['Saída de Material', materialWithdrawal, ['Lote / FEFO', 'Sem lote explícito', " · lote "]],
  ['PDF de saída', outboundDocuments, ["'Lote ' +", "'Sem lote'"]],
]) {
  for (const forbiddenToken of forbiddenTokens) {
    if (surfaceSource.includes(forbiddenToken)) {
      fail(surfaceName + ' voltou a expor o dado de lote ao operador: ' + forbiddenToken);
    }
  }
}
requireText(
  locationRepository,
  'relocateLotIds?: string[];',
  'Contrato de transferência perdeu a realocação opcional de lotes.'
);
requireText(
  locationRepository,
  'transaction.update(relocateLotRefs[index], {',
  'Realocação física deixou de atualizar lote na mesma transação.'
);
if (locationRepository.includes('transaction.set(balanceRef, { ...nextBalance')) {
  fail('Realocação voltou a regravar o saldo agregado apesar de TRANSFER quantityDelta=0.');
}
requireText(
  barcodeRepository,
  'export async function replaceWarehouseBarcodeAssociation(',
  'Repository de barcode perdeu a substituição auditável.'
);
requireText(
  barcodeRepository,
  "status: 'inactive'",
  'Edição de barcode deixou de preservar o código anterior como inativo.'
);
requireText(
  stockOperational,
  "state.depots.filter(({ depot }) => depot.status === 'active')",
  'Filtro de depósito voltou a exibir depósitos inativos/excluídos.'
);
requireText(
  stockOperational,
  "location.status === 'active'",
  'Filtro de localização voltou a considerar localizações inativas.'
);
requireText(
  stockOperational,
  "location.kind === 'LOCAL'",
  'Filtro de localização voltou a listar subposições.'
);
requireText(
  stockOperational,
  'matchesWarehouseExpiryState(',
  'Estoque perdeu o filtro por estado de validade.'
);
requireText(
  stockOperational,
  'summary.availableLots.map((lot) => warehouseLotExpiryState(lot))',
  'Filtro de validade voltou a considerar lotes sem saldo/inativos como estoque atual.'
);
requireText(
  stockOperational,
  '<option value="NEAR_EXPIRY">Próximo do vencimento</option>',
  'Filtro de validade perdeu o estado Próximo do vencimento.'
);
requireText(
  stockOperational,
  '<option value="EXPIRED">Vencido</option>',
  'Filtro de validade perdeu o estado Vencido.'
);
requireText(
  stockOperational,
  '<option value="VALID">Válido</option>',
  'Filtro de validade perdeu o estado Válido.'
);
requireText(
  stockOperational,
  '<option value="NO_EXPIRY">Sem validade informada</option>',
  'Filtro de validade perdeu o estado Sem validade.'
);
if (stockOperational.includes("item.position.subpositionId === locationFilter")) {
  fail('Filtro de localização voltou a aceitar subposição como opção selecionável.');
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
console.log('- Início visual, Meus Depósitos premium, Controle de Depósitos, Alocação de Material, Saída de Material e Controle de Materiais operacionais');
console.log('- Início projeta todos os depósitos e pendências sem operações; Meus Depósitos mantém a Visão 3D consultiva');
console.log('- rules em ' + (rulesBytes / 1024).toFixed(2) + ' KiB (orçamento interno: 150 KiB)');
console.log('- NF/Pregão podem ser armazenados, consumidos imediatamente ou removidos logicamente da fila');
console.log('- Entrada avulsa registra procedência diversa via MANUAL_ENTRY e reutiliza ledger + TRANSFER oficiais');
console.log('- ficha institucional PDF de alocação física disponível por NF e por Pregão');
console.log('- ficha PDF otimizada para toner P&B, com grayscale neutro e contenção de textos');
console.log('- Saída de Material gera PDF duplo: retirada física + ficha auxiliar SISCOFIS com controle/código');
console.log('- Saída de Material e seus Relatórios seguem o tema claro oficial D-076/VISUAL_IDENTITY');
console.log('- Saída de Material reduz ledger/posição/lote e saldo zero deixa de ser projetado no croqui');
console.log('- Registro de Saídas carrega o mês uma vez; devolução reutiliza MANUAL_ENTRY + TRANSFER e marcador leve separado');
console.log('- Controle de Materiais consolidado em Resumo, Estoque, Movimentações, Inventário e Relatórios');
console.log('- Relatórios separados em Saída e Consumo Imediato, sem mistura de origens');
console.log('- Estoque exibe somente saldo positivo e prioriza a menor validade ativa');
console.log('- ficha do item separa localização física de saldo UNASSIGNED sem duplicação');
console.log('- item expõe somente descritivo, validade e código de barras como dados editáveis');
console.log('- realocação usa TRANSFER sem regravar saldo agregado e preserva referências técnicas de validade');
console.log('- edição de barcode preserva o código anterior inativo');
console.log('- filtros do Estoque exibem apenas depósitos ativos, locais-pai e estados de validade');
console.log('- Inventário opera no database dedicado com contagem isolada e ajuste confirmado');
console.log('- SISCOFIS no Controle é somente leitura; migração permanece em Alocação de Material');
console.log('- Inventário em Relatórios é somente leitura; contagem/ajuste permanece na subaba Inventário');
console.log('- consumo imediato em lote reutiliza o motor oficial com destino, responsável e idempotência por item');
console.log('- INVOICE_ENTRY v2 isolado não gera falso positivo de reconciliação legada');
console.log('- TRANSFER redistribui locationBalances sem regravar o saldo agregado');
console.log('- TRANSFER usa validador dedicado para permanecer abaixo do orçamento de expressões das Rules');
console.log('- contratos de ledger, saldo, localização, lote, barcode e intake preservados');
console.log('- founder-only e validações transacionais preservados');
console.log('- repositories persistem exclusivamente em warehouseDb');
console.log('- migrador cobre inventories/*/items e normaliza referências Firestore');
console.log('- ponte transacional legada NF/warehouse bloqueada por fail-safe');
