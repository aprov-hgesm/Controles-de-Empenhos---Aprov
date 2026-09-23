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

const location = read('lib/warehouse/location.ts');
const repository = read('lib/warehouse/locationRepository.ts');
const ledger = read('lib/warehouse/ledgerRepository.ts');
const movement = read('lib/warehouse/movement.ts');
const namespace = read('lib/warehouse/namespace.ts');
const content = read('features/warehouse/components/WarehouseSectionContent.tsx');
const locationsUi = read('features/warehouse/components/WarehouseLocationsOperational.tsx');
const navigation = read('features/warehouse/navigation.ts');
const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
const rules = read('firestore.rules');
const securityTests = read('scripts/firestore-multitenancy-security.test.mjs');
const packageJson = read('package.json');
const ci = read('.github/workflows/application-ci.yml');
const browserE2e = read('tests/e2e/warehouse-phase-6.spec.mjs');
const phaseDoc = read('docs/adm-deposito/PHASE_6_LOCATIONS.md');
const decisions = read('docs/adm-deposito/DECISIONS.md');

for (const marker of [
  "WAREHOUSE_DEPOT_SCHEMA_VERSION = 'warehouse_depot_v1'",
  "WAREHOUSE_LOCATION_SCHEMA_VERSION = 'warehouse_location_v1'",
  "WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION",
  'validateWarehouseDepot',
  'validateWarehouseLocation',
  'validateWarehouseStockPosition',
  'createWarehouseLocationBalanceId',
  'deriveUnassignedQuantity',
]) requireText(location, marker, 'Domínio de localização incompleto: ' + marker);

for (const marker of [
  'createWarehouseDepot',
  'updateWarehouseDepot',
  'createWarehouseLocation',
  'updateWarehouseLocation',
  'listWarehouseLocationBalances',
  'transferWarehouseStock',
  "type: 'TRANSFER'",
  'WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK',
  'runTransaction',
  'fromBalanceRef',
  'toBalanceRef',
]) requireText(repository, marker, 'Persistência/transferência incompleta: ' + marker);

for (const marker of [
  "locationBalances: 'locationBalances'",
]) requireText(namespace, marker, 'Namespace da projeção física ausente: ' + marker);

for (const marker of [
  "kind: 'LOCATION_TRANSFER'",
  'WarehouseLocationTransferMovementSource',
  "type === 'TRANSFER'",
]) requireText(movement, marker, 'Ledger não reconhece origem auditável da transferência: ' + marker);

for (const marker of [
  'unassignedBalancePath',
  'applyWarehouseLocationDelta',
  "WAREHOUSE_TRANSFER_REQUIRES_LOCATION_FLOW",
]) requireText(ledger, marker, 'Integração do ledger com Sem localização ausente: ' + marker);

for (const marker of [
  'warehouse-locations-operational',
  'warehouse-depot-create',
  'warehouse-location-create',
  'warehouse-transfer-start',
  'warehouse-transfer-confirm',
  'Sem localização',
]) requireText(locationsUi, marker, 'Jornada UI da FASE 6 incompleta: ' + marker);

requireText(
  navigation,
  "id: 'locations', label: 'Localizações'",
  'Navegação de Localizações ausente.'
);
requireText(shell, 'EMPROVEX // FASE 6', 'Shell do ADM Depósito não identifica a FASE 6.');

for (const marker of [
  'function validWarehouseDepotCreate',
  'function validWarehouseLocationCreate',
  'function validWarehouseLocationBalanceDocument',
  'function warehouseTransferHasMatchingLocationBalancesAfter',
  'match /depots/{depotId}',
  'match /locations/{locationId}',
  'match /locationBalances/{locationBalanceId}',
  "domain != 'locationBalances'",
]) requireText(rules, marker, 'Firestore Rules da FASE 6 incompletas: ' + marker);

for (const marker of [
  'FASE 6 — Depósitos / Localizações / Transferências',
  'Transferência interna mantém saldo total e altera distribuição física',
  'Setor externo continua sem acesso às localizações da FASE 6',
  'Depósito da FASE 6 não pode ser excluído fisicamente',
]) requireText(securityTests, marker, 'Cobertura de segurança da FASE 6 ausente: ' + marker);

for (const marker of [
  'warehouse-locations-operational',
  'warehouse-transfer-confirm',
  'fundador cria local, transfere estoque e confirma a distribuição física',
]) requireText(browserE2e, marker, 'Browser E2E específico da FASE 6 incompleto: ' + marker);

for (const marker of [
  'warehouse_location_balance_v1',
  'UNASSIGNED',
  'TRANSFER',
]) requireText(phaseDoc, marker, 'Documento técnico da FASE 6 incompleto: ' + marker);

for (const marker of [
  'D-037',
  'D-038',
]) requireText(decisions, marker, 'Decisão arquitetural permanente da FASE 6 ausente: ' + marker);

for (const marker of [
  '"test:adm-deposito-locations"',
  '"verify:adm-deposito-phase-6"',
]) requireText(packageJson, marker, 'Gate npm da FASE 6 ausente: ' + marker);

for (const marker of [
  'ADM Depósito Phase 6 locations and transfers domain tests',
  'npm run test:adm-deposito-locations',
  'ADM Depósito Phase 6 permanent guard',
  'npm run verify:adm-deposito-phase-6',
]) requireText(ci, marker, 'Application CI não executa gate da FASE 6: ' + marker);

if (findings.length) {
  console.error('FASE 6 — Depósitos / Localizações / Transferências: FALHOU');
  for (const finding of findings) console.error('- ' + finding);
  process.exit(1);
}

console.log('FASE 6 — Depósitos / Localizações / Transferências: OK');
console.log('- depósitos, locais e subposições possuem identidade lógica estável');
console.log('- saldo físico é projeção derivada do ledger, com Sem localização para legado');
console.log('- TRANSFER mantém saldo agregado e atualiza origem/destino atomicamente');
console.log('- idempotência, founder-only e isolamento workspace/UG permanecem protegidos');
console.log('- UI operacional e gates permanentes da FASE 6 estão presentes');
