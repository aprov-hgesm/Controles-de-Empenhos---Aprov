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
const registration = read('features/warehouse/components/WarehouseItemRegistrationOperational.tsx');
const control = read('features/warehouse/components/WarehouseItemControlOperational.tsx');
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
  'buildWarehouseSiscofisPrompt',
  'buildWarehouseSiscofisPreview',
  'hashWarehouseSiscofisImport',
  'deriveSiscofisMarcoZeroMaterialId',
  'aggregateMarcoZeroRows',
]) {
  requireText(domain, marker, 'Contrato/domínio SISCOFIS incompleto: ' + marker);
}

for (const marker of [
  'loadWarehouseSiscofisContext',
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
  'PDF SISCOFIS direto · sem IA',
  'data-testid="warehouse-siscofis-json"',
  'data-testid="warehouse-siscofis-validate"',
  'data-testid="warehouse-siscofis-preview"',
  'confirmWarehouseSiscofisImport',
  'Nenhuma alteração automática foi feita no estoque',
]) {
  requireText(siscofisUi, marker, 'Jornada operacional SISCOFIS incompleta: ' + marker);
}

for (const marker of [
  'extractEmprovexSiscofisInventoryFromPdfBytes',
  "new TextDecoder('windows-1252')",
  "byText('Nr Ficha')",
  "byText('Nome do Material')",
  "byText('Qtde Exist')",
  "byText('Qtde Disp')",
  "byText('Vlr Unit')",
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
  "'PDF SISCOFIS — ' + file.name",
  'Importação direta de PDF perdeu a procedência do arquivo no snapshot.'
);

requireText(registration, 'WarehouseSiscofisOperational', 'Cadastro de Itens deixou de expor Migração SISCOFIS.');
requireText(registration, "requested === 'siscofis'", 'Redirect legado para SISCOFIS deixou de ser aceito.');
requireText(control, 'WarehouseSiscofisHistoryReport', 'Controle de Materiais deixou de expor o histórico SISCOFIS somente leitura.');
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
console.log('- contratos versionados, validação estrita e prompt para IA externa presentes');
console.log('- Marco Zero usa INITIAL_BALANCE no ledger oficial e replay idempotente');
console.log('- snapshots posteriores conciliam sem gerar movimentação automática');
console.log('- jornada atual está integrada à arquitetura Cadastro de Itens / Controle de Itens');
console.log('- Rules e suíte multitenant preservam founder-only e imutabilidade');
