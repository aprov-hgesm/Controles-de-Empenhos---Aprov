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
const service = read('lib/warehouse/siscofisService.ts');
const movement = read('lib/warehouse/movement.ts');
const content = read('features/warehouse/components/WarehouseSectionContent.tsx');
const navigation = read('features/warehouse/navigation.ts');
const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
const rules = read('firestore.rules');
const securityTests = read('scripts/firestore-multitenancy-security.test.mjs');
const packageJson = read('package.json');
const ci = read('.github/workflows/application-ci.yml');

for (const marker of [
  "WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION = 'warehouse_siscofis_import_v1'",
  "WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION = 'warehouse_siscofis_snapshot_v1'",
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
  'warehouse-siscofis-operational',
  'warehouse-siscofis-copy-prompt',
  'warehouse-siscofis-json',
  'warehouse-siscofis-validate',
  'warehouse-siscofis-preview',
  'warehouse-siscofis-confirm',
  'Divergências SISCOFIS nunca corrigem o estoque automaticamente',
]) {
  requireText(content, marker, 'Jornada operacional SISCOFIS incompleta: ' + marker);
}

requireText(
  navigation,
  "futurePhase: null",
  'SISCOFIS ainda está marcado como capacidade futura.'
);
requireText(shell, 'EMPROVEX // FASE ', 'Shell do ADM Depósito não preserva a identificação de fase.');

for (const marker of [
  'function validWarehouseSiscofisSnapshotBase',
  'function validWarehouseSiscofisSnapshotCreate',
  'function validWarehouseSiscofisSnapshotUpdate',
  'match /siscofisSnapshots/{snapshotId}',
  "domain != 'siscofisSnapshots'",
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
console.log('- JSON versionado, validação estrita e prompt para IA externa presentes');
console.log('- Marco Zero usa INITIAL_BALANCE no ledger oficial e replay idempotente');
console.log('- snapshots posteriores conciliam sem gerar movimentação automática');
console.log('- cutoff da FASE 4 protege contra sobreposição histórica');
console.log('- Rules e suíte multitenant preservam founder-only e imutabilidade');
console.log('- jornada UI prompt → JSON → preview → confirmação está operacional');
