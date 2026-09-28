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
const isometricPreview = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseIsometricPreview.tsx'),
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
const inventoryHistoryReport = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseInventoryHistoryReport.tsx'),
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
  "if (section === 'control')",
  'Controle de Itens deve estar operacional nesta etapa modular.'
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
  'Início voltou a projetar no depósito posições com saldo zero.'
);
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
  itemControl,
  "id: 'summary'",
  'Controle de Itens perdeu a subaba Resumo.'
);
requireText(
  itemControl,
  "id: 'stock'",
  'Controle de Itens perdeu a subaba Estoque.'
);
requireText(
  itemControl,
  "id: 'movements'",
  'Controle de Itens perdeu a subaba Movimentações.'
);
requireText(
  itemControl,
  "id: 'inventory'",
  'Controle de Itens perdeu a subaba Inventário.'
);
requireText(
  itemControl,
  "id: 'reports'",
  'Controle de Itens perdeu a subaba Relatórios.'
);
for (const redundantTab of ["id: 'outbound'", "id: 'deliveries'", "id: 'alerts'", "id: 'siscofis'", "id: 'settings'"]) {
  if (itemControl.includes(redundantTab)) {
    fail('Controle de Itens voltou a duplicar superfície externa: ' + redundantTab);
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
  fail('Controle de Itens voltou a duplicar a migração SISCOFIS da Alocação de Material.');
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
  "? 'Relatórios de Saída'",
  'Componente de relatórios perdeu o título específico de Saída.'
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
  ['Controle de Itens', itemControl],
  ['Resumo do Controle de Itens', itemControlSummary],
  ['Estoque do Controle de Itens', stockOperational],
  ['Inventário do Controle de Itens', inventoryOperational],
  ['Relatórios do Controle de Itens', logisticsReports],
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
console.log('- Meus Depósitos, Alocação de Material, Saída de Material e Controle de Itens operacionais');
console.log('- rules em ' + (rulesBytes / 1024).toFixed(2) + ' KiB (orçamento interno: 150 KiB)');
console.log('- NF/Pregão podem ser armazenados, consumidos imediatamente ou removidos logicamente da fila');
console.log('- ficha institucional PDF de alocação física disponível por NF e por Pregão');
console.log('- ficha PDF otimizada para toner P&B, com grayscale neutro e contenção de textos');
console.log('- Saída de Material gera PDF duplo: retirada física + ficha auxiliar SISCOFIS com controle/código');
console.log('- Saída de Material e seus Relatórios seguem o tema claro oficial D-076/VISUAL_IDENTITY');
console.log('- Saída de Material reduz ledger/posição/lote e saldo zero deixa de ser projetado no croqui');
console.log('- Controle de Itens consolidado em Resumo, Estoque, Movimentações, Inventário e Relatórios');
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
