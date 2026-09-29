#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const findings = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(content, marker, message) {
  if (!content.includes(marker)) findings.push(message);
}

const domain = read('lib/warehouse/siscofis.ts');
const pdfExtractor = read('lib/warehouse/siscofisPdf.ts');
const service = read('lib/warehouse/siscofisService.ts');
const movement = read('lib/warehouse/movement.ts');
const siscofisUi = read('features/warehouse/components/WarehouseSiscofisOperational.tsx');
const pendingAllocation = read('lib/warehouse/pendingPhysicalAllocationRepository.ts');
const pendingAllocationUi = read('features/warehouse/components/WarehouseSiscofisPendingAllocation.tsx');
const registration = read('features/warehouse/components/WarehouseItemRegistrationOperational.tsx');
const control = read('features/warehouse/components/WarehouseItemControlOperational.tsx');
const logisticsReports = read('features/warehouse/components/WarehouseLogisticsReports.tsx');
const siscofisHistoryReport = read('features/warehouse/components/WarehouseSiscofisHistoryReport.tsx');
const navigation = read('features/warehouse/navigation.ts');
const rules = read('firestore.rules');
const securityTests = read('scripts/firestore-multitenancy-security.test.mjs');
const packageJson = read('package.json');
const ci = read('.github/workflows/application-ci.yml');

for (const marker of [
  "WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION = 'warehouse_siscofis_import_v1'",
  "WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION_V1 = 'warehouse_siscofis_snapshot_v1'",
  "WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION = 'warehouse_siscofis_snapshot_v2'",
  'parseWarehouseSiscofisJson',
  'buildWarehouseSiscofisPreview',
  'hashWarehouseSiscofisImport',
  'deriveSiscofisMarcoZeroMaterialId',
  'aggregateMarcoZeroRows',
]) {
  requireText(domain, marker, 'Contrato/domínio SISCOFIS incompleto: ' + marker);
}

for (const marker of [
  'loadWarehouseSiscofisContext',
  'prepareEmprovexSiscofisInventoryData',
  'prepareWarehouseSiscofisImport',
  'confirmWarehouseSiscofisImport',
  "type: 'INITIAL_BALANCE'",
  'applyWarehouseMovement',
  'siscofis:marco-zero:',
  "existingMarcoZero?.status === 'CONFIRMED'",
  'WAREHOUSE_SISCOFIS_MARCO_ZERO_CUTOFF_OVERLAP',
  "kind: 'SNAPSHOT'",
  'movementIds: []',
]) {
  requireText(service, marker, 'Persistência/Marco Zero incompleto: ' + marker);
}

for (const marker of [
  "'INITIAL_BALANCE'",
  'applyWarehouseMovementToBalance',
  'warehouseMovementMatchesReplay',
]) {
  requireText(movement, marker, 'Ledger oficial não foi preservado: ' + marker);
}

for (const marker of [
  'data-testid="warehouse-siscofis-operational"',
  'data-testid="warehouse-siscofis-pdf-direct"',
  'data-testid="warehouse-siscofis-pdf-input"',
  'Upload do Mapa de Existência',
  'Selecionar Mapa de Existência',
  'data-testid="warehouse-siscofis-preview"',
  'data-testid="warehouse-siscofis-revalidate"',
  'confirmWarehouseSiscofisImport',
  'prepareEmprovexSiscofisInventoryData',
  '<th className="p-3">Validade</th>',
]) {
  requireText(siscofisUi, marker, 'Jornada operacional SISCOFIS incompleta: ' + marker);
}
for (const removedSurface of [
  'Prompt para IA externa',
  'data-testid="warehouse-siscofis-json"',
  'Migração manual de item',
  'Copiar prompt',
]) {
  if (siscofisUi.includes(removedSurface)) {
    findings.push('Migração SISCOFIS voltou a expor fluxo removido: ' + removedSurface);
  }
}
requireText(
  siscofisUi,
  'data-visual-theme="operational-light"',
  'Migração SISCOFIS deixou de declarar o tema operacional claro obrigatório.'
);
requireText(
  siscofisUi,
  'data-testid="warehouse-siscofis-validation-summary"',
  'Migração SISCOFIS perdeu o resumo compacto da validação.'
);
requireText(
  siscofisUi,
  'data-testid="warehouse-siscofis-validation-toggle"',
  'Migração SISCOFIS perdeu o controle de expansão dos avisos.'
);
requireText(
  siscofisUi,
  "warningGroups.slice(0, 4)",
  'Migração SISCOFIS voltou a expandir todos os avisos por padrão.'
);
requireText(
  siscofisUi,
  "validationErrors.map((issue, index) =>",
  'Migração SISCOFIS deixou de manter erros bloqueantes imediatamente visíveis.'
);
requireText(
  siscofisUi,
  'data-testid="warehouse-siscofis-preview-exclude"',
  'Prévia do Marco Zero perdeu a ação manual de não importar item.'
);
requireText(
  siscofisUi,
  'data-testid="warehouse-siscofis-preview-undo-exclusions"',
  'Prévia do Marco Zero perdeu a reversão das exclusões antes da revalidação.'
);
requireText(
  siscofisUi,
  "preview.kind === 'MARCO_ZERO'",
  'Ação de não importar deixou de ficar restrita ao Marco Zero.'
);
requireText(
  siscofisUi,
  'filterSiscofisDraftRows(draftInventory, exclusions)',
  'Exclusão da prévia deixou de remover a linha do Mapa de Existência antes da revalidação.'
);
requireText(
  siscofisUi,
  'emprovexSiscofisSourceIndexFromRowId(rowId)',
  'Edição/exclusão SISCOFIS voltou a depender do índice visual filtrado.'
);
requireText(
  domain,
  'remapEmprovexSiscofisRowIdAfterExclusions',
  'Domínio SISCOFIS perdeu o remapeamento seguro de rowId após exclusões.'
);


requireText(
  siscofisUi,
  'bg-[#00288e]',
  'Migração SISCOFIS perdeu o azul institucional nas ações primárias.'
);
requireText(
  siscofisUi,
  'border border-slate-200 bg-white',
  'Migração SISCOFIS perdeu formulários claros de alto contraste.'
);
for (const forbiddenVisualToken of [
  'bg-[#01050d]',
  'bg-black/',
  'border-white/[',
  'text-cyan-',
  'text-blue-200',
  'text-slate-200',
  'text-slate-300',
]) {
  if (siscofisUi.includes(forbiddenVisualToken)) {
    findings.push(
      'Migração SISCOFIS voltou a introduzir dark mode operacional: '
      + forbiddenVisualToken
    );
  }
}


for (const marker of [
  'extractEmprovexSiscofisInventoryFromPdfBytes',
  "new TextDecoder('windows-1252')",
  "byText('Nr Ficha')",
  "byText('Nome do Material')",
  "byText('Qtde Exist')",
  "byText('Qtde Disp')",
  "byText('Vlr Unit')",
  "byText('Validade')",
  'parseBrazilianDate',
  'Mapa de Existência - Material de Consumo',
]) {
  requireText(pdfExtractor, marker, 'Extrator local de PDF SISCOFIS incompleto: ' + marker);
}

if (pdfExtractor.includes('fetch(') || pdfExtractor.includes('https://') || pdfExtractor.includes('http://')) {
  findings.push('Extrator local de PDF SISCOFIS passou a depender de rede externa.');
}

requireText(
  siscofisUi,
  "const { extractEmprovexSiscofisInventoryFromPdfBytes } = await import(",
  'Jornada SISCOFIS deixou de carregar o extrator PDF somente sob demanda.'
);
requireText(
  siscofisUi,
  "'../../../lib/warehouse/siscofisPdf'",
  'Jornada SISCOFIS perdeu o módulo local do extrator PDF.'
);
requireText(
  siscofisUi,
  "'Mapa de Existência SISCOFIS — ' + file.name",
  'Upload do Mapa de Existência perdeu a procedência do arquivo no snapshot.'
);
requireText(
  domain,
  'expiresOn: item.validade',
  'Validade extraída do Mapa de Existência deixou de chegar ao contrato do Marco Zero.'
);
requireText(
  domain,
  'expiresOn: row.expiresOn ?? null',
  'Prévia do Marco Zero deixou de preservar a validade por linha.'
);
requireText(
  pdfExtractor,
  'validade: expiry',
  'Extrator do Mapa de Existência deixou de devolver a validade.'
);

requireText(
  registration,
  'WarehouseSiscofisPendingAllocation',
  'Alocação de Material deixou de exibir pendências físicas do Marco Zero SISCOFIS.'
);
requireText(
  registration,
  'Materiais pendentes',
  'Aba principal de pendências voltou a representar somente Notas Fiscais.'
);
for (const marker of [
  'listWarehouseSiscofisSnapshots(workspaceId, 25)',
  "snapshot.kind === 'MARCO_ZERO'",
  "snapshot.status === 'CONFIRMED'",
  "balance.position.kind !== 'UNASSIGNED'",
  'listWarehousePositiveLocationBalances(workspaceId, 500)',
  'transferWarehouseStock(workspaceId, {',
  "from: { kind: 'UNASSIGNED' }",
]) {
  requireText(
    pendingAllocation,
    marker,
    'Fila física SISCOFIS perdeu contrato operacional: ' + marker
  );
}
if (pendingAllocation.includes('applyWarehouseMovement(')) {
  findings.push('Alocação física SISCOFIS voltou a criar saldo em vez de apenas transferir localização.');
}
for (const marker of [
  'data-testid="warehouse-siscofis-pending-allocation"',
  'Materiais importados ainda sem localização física',
  'Confirmar alocação',
  'allocateWarehousePendingPhysicalStock(workspaceId, {',
]) {
  requireText(
    pendingAllocationUi,
    marker,
    'Superfície de pendências físicas SISCOFIS incompleta: ' + marker
  );
}

requireText(registration, 'WarehouseSiscofisOperational', 'Cadastro de Itens deixou de expor Migração SISCOFIS.');
requireText(registration, "requested === 'siscofis'", 'Redirect legado para SISCOFIS deixou de ser aceito.');
requireText(
  control,
  'WarehouseLogisticsReports',
  'Controle de Materiais deixou de expor a área de Relatórios.'
);
requireText(
  logisticsReports,
  'WarehouseSiscofisHistoryReport',
  'Relatórios do Controle de Materiais deixaram de expor o histórico SISCOFIS.'
);
requireText(
  logisticsReports,
  "{ id: 'siscofis', label: 'SISCOFIS' }",
  'Relatórios do Controle de Materiais perderam a subaba SISCOFIS.'
);
requireText(
  siscofisHistoryReport,
  'Consulta somente leitura dos Marcos Zero e snapshots já confirmados.',
  'Histórico SISCOFIS deixou de ser explicitamente somente leitura.'
);
requireText(
  siscofisHistoryReport,
  'listWarehouseSiscofisSnapshots(workspaceId, 24)',
  'Histórico SISCOFIS perdeu a consulta bounded de snapshots.'
);
if (logisticsReports.includes('WarehouseSiscofisOperational')) {
  findings.push('Controle de Materiais voltou a duplicar a superfície operacional de migração SISCOFIS.');
}
requireText(navigation, 'Alocação de Material', 'Arquitetura atual perdeu a superfície Alocação de Material.');

for (const marker of [
  'function validWarehouseSiscofisSnapshotBase',
  'function validWarehouseSiscofisSnapshotCreate',
  'function validWarehouseSiscofisSnapshotUpdate',
  'match /siscofisSnapshots/{snapshotId}',
  'allow delete: if false;',
]) {
  requireText(rules, marker, 'Firestore Rules da FASE 5 incompletas: ' + marker);
}

for (const marker of [
  'FASE 5 — SISCOFIS / Marco Zero / Conciliação',
  'Fundador cria Marco Zero SISCOFIS em estado APPLYING',
  'Setor externo não cria snapshot SISCOFIS nem no próprio workspace',
  'Snapshot SISCOFIS não pode ser excluído',
]) {
  requireText(securityTests, marker, 'Cobertura de segurança da FASE 5 ausente: ' + marker);
}

for (const marker of [
  '"test:adm-deposito-siscofis"',
  '"verify:adm-deposito-phase-5"',
]) {
  requireText(packageJson, marker, 'Gate npm da FASE 5 ausente: ' + marker);
}

for (const marker of [
  'ADM Depósito Phase 5 SISCOFIS domain tests',
  'npm run test:adm-deposito-siscofis',
  'ADM Depósito Phase 5 SISCOFIS guard',
  'npm run verify:adm-deposito-phase-5',
]) {
  requireText(ci, marker, 'Application CI não executa gate da FASE 5: ' + marker);
}

if (findings.length) {
  console.error('FASE 5 — SISCOFIS / Marco Zero / Conciliação: FALHOU');
  for (const finding of findings) console.error('- ' + finding);
  process.exit(1);
}

console.log('FASE 5 — SISCOFIS / Marco Zero / Conciliação: OK');
console.log('- upload do Mapa de Existência é a única entrada operacional; validade é preservada por linha');
console.log('- Marco Zero usa INITIAL_BALANCE no ledger oficial e replay idempotente');
console.log('- snapshots posteriores conciliam sem gerar movimentação automática');
console.log('- migração permanece em Alocação de Material; histórico SISCOFIS fica somente leitura em Controle de Materiais → Relatórios');
console.log('- Rules e suíte multitenant preservam founder-only e imutabilidade');
