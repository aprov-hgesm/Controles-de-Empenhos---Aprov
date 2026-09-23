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

const lot = read('lib/warehouse/lot.ts');
const lotRepository = read('lib/warehouse/lotRepository.ts');
const ledger = read('lib/warehouse/ledgerRepository.ts');
const namespace = read('lib/warehouse/namespace.ts');
const stock = read('features/warehouse/components/WarehouseStockOperational.tsx');
const content = read('features/warehouse/components/WarehouseSectionContent.tsx');
const navigation = read('features/warehouse/navigation.ts');
const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
const rules = read('firestore.rules');
const securityTests = read('scripts/firestore-multitenancy-security.test.mjs');
const browserE2e = read('tests/e2e/warehouse-phase-7.spec.mjs');
const externalE2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const packageJson = read('package.json');
const ci = read('.github/workflows/application-ci.yml');
const phaseDoc = read('docs/adm-deposito/PHASE_7_STOCK_LOTS_FEFO.md');
const decisions = read('docs/adm-deposito/DECISIONS.md');

for (const marker of [
  "WAREHOUSE_LOT_SCHEMA_VERSION = 'warehouse_lot_v1'",
  'validateWarehouseLot',
  'normalizeWarehouseExpiryDate',
  'warehouseLotExpiryState',
  'selectWarehouseFefoLot',
  'buildWarehouseLogisticsPendencies',
  'LOT_INFORMATION_MISSING',
  'EXPIRED_LOT',
]) {
  requireText(lot, marker, 'Domínio de lote/validade/FEFO incompleto: ' + marker);
}

for (const marker of [
  'listWarehouseLots',
  'createWarehouseLot',
  'updateWarehouseLot',
  'assertLotPositionBackedByStock',
  'WAREHOUSE_LOT_QUANTITY_EXCEEDS_BALANCE',
  'WAREHOUSE_LOT_QUANTITY_EXCEEDS_LOCATION',
]) {
  requireText(lotRepository, marker, 'Persistência de lote incompleta: ' + marker);
}

requireText(namespace, "lots: 'lots'", 'Namespace canônico de lotes foi removido.');
requireText(
  ledger,
  'listWarehouseMovementsForMaterial',
  'Histórico bounded por material está ausente.'
);

for (const marker of [
  'warehouse-stock-operational',
  'warehouse-stock-search',
  'warehouse-material-sheet',
  'warehouse-fefo-recommendation',
  'warehouse-logistics-pendencies',
  'warehouse-lot-save',
  'warehouse-locate-in-depot',
  'warehouse-location-highlight',
  'listWarehouseLots',
  'listWarehouseLocationBalances',
  'listWarehouseMovementsForMaterial',
]) {
  requireText(stock, marker, 'Superfície Estoque FASE 7 incompleta: ' + marker);
}

requireText(
  content,
  '<WarehouseStockOperational workspaceId={workspaceId} />',
  'A aba Estoque não está ligada à superfície operacional da FASE 7.'
);
requireText(
  navigation,
  "id: 'stock', label: 'Estoque'",
  'Navegação Estoque foi removida.'
);
requireText(
  navigation,
  "recomendação FEFO.', futurePhase: null",
  'Estoque ainda está marcado como capacidade futura.'
);
requireText(shell, 'EMPROVEX // FASE 7', 'Shell não identifica a FASE 7.');

for (const marker of [
  'function validWarehouseLotOrigin',
  'function warehouseLotMaterialMatches',
  'function warehouseLotInvoiceOriginMatches',
  'function validWarehouseLotDocument',
  'function validWarehouseLotCreate',
  'function validWarehouseLotUpdate',
  'match /lots/{lotId}',
  "domain != 'lots'",
  'allow delete: if false;',
]) {
  requireText(rules, marker, 'Firestore Rules da FASE 7 incompletas: ' + marker);
}

for (const marker of [
  'FASE 7 — Estoque Operável / Lotes / Validade / FEFO',
  'Fundador cria lote FASE 7 vinculado a material e origem de NF',
  'Lote FASE 7 rejeita validade fora do contrato',
  'Setor externo continua sem acesso aos lotes da FASE 7',
  'Lote FASE 7 não pode ser excluído',
  'Fundador cria lotes FEFO sem alterar saldo oficial',
]) {
  requireText(securityTests, marker, 'Cobertura Firestore Emulator FASE 7 ausente: ' + marker);
}

for (const marker of [
  'warehouse-stock-operational',
  'warehouse-fefo-recommendation',
  'LOTE-FEFO-PRIMEIRO',
  'warehouse-lot-save',
  'E2E-FASE7',
  'page.reload()',
]) {
  requireText(browserE2e, marker, 'Browser E2E da FASE 7 incompleto: ' + marker);
}

for (const marker of [
  "await page.goto('/adm-deposito/estoque');",
  "await expect(page).toHaveURL(/\\/$/",
]) {
  requireText(externalE2e, marker, 'Browser E2E não preserva bloqueio externo: ' + marker);
}

for (const marker of [
  '"test:adm-deposito-stock-operational"',
  '"verify:adm-deposito-phase-7"',
]) {
  requireText(packageJson, marker, 'Gate npm da FASE 7 ausente: ' + marker);
}

for (const marker of [
  'ADM Depósito Phase 7 stock lots FEFO domain tests',
  'npm run test:adm-deposito-stock-operational',
  'ADM Depósito Phase 7 permanent guard',
  'npm run verify:adm-deposito-phase-7',
]) {
  requireText(ci, marker, 'Application CI não executa gate da FASE 7: ' + marker);
}

for (const marker of [
  'warehouse_lot_v1',
  'FEFO',
  'pendências logísticas',
  'warehouse_balance_v1',
  'warehouse_location_balance_v1',
  'não altera saldo',
  'FASE 8',
]) {
  requireText(phaseDoc, marker, 'Documento técnico da FASE 7 incompleto: ' + marker);
}

for (const marker of ['D-039', 'D-040', 'D-041']) {
  requireText(decisions, marker, 'Decisão permanente da FASE 7 ausente: ' + marker);
}

if (findings.length) {
  console.error('FASE 7 — Estoque Operável / Lotes / Validade / FEFO: FALHOU');
  for (const finding of findings) console.error('- ' + finding);
  process.exit(1);
}

console.log('FASE 7 — Estoque Operável / Lotes / Validade / FEFO: OK');
console.log('- warehouse_lot_v1 enriquece estoque sem criar saldo concorrente');
console.log('- validade, vencidos, pendências e FEFO possuem contratos explícitos');
console.log('- Estoque oferece busca, filtros, ficha, localização e histórico bounded');
console.log('- Rules preservam founder-only, workspace/UG e integridade material/origem');
console.log('- Browser E2E cobre jornada operacional e o bloqueio externo permanece permanente');
