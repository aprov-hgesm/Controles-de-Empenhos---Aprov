#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const movement = read('lib/warehouse/movement.ts');
const repository = read('lib/warehouse/ledgerRepository.ts');
const namespace = read('lib/warehouse/namespace.ts');
const rules = read('firestore.rules');
const securitySuite = read('scripts/firestore-multitenancy-security.test.mjs');
const contractTests = read('scripts/warehouse-ledger-contract.test.mjs');
const phase0Guard = read('scripts/verify-adm-deposito-phase-0.mjs');
const phase1Guard = read('scripts/verify-adm-deposito-phase-1.mjs');
const ci = read('.github/workflows/application-ci.yml');
const pkg = JSON.parse(read('package.json'));

for (const marker of [
  "WAREHOUSE_MOVEMENT_SCHEMA_VERSION = 'warehouse_movement_v1'",
  "WAREHOUSE_BALANCE_SCHEMA_VERSION = 'warehouse_balance_v1'",
  "'INITIAL_BALANCE'",
  "'INVOICE_ENTRY'",
  "'OUTBOUND'",
  "'TRANSFER'",
  "'INVENTORY_ADJUSTMENT'",
  "'INVOICE_CORRECTION'",
  "'REVERSAL'",
  'createWarehouseMovementId',
  'validateWarehouseMovement',
  'applyWarehouseMovementToBalance',
  'warehouseMovementMatchesReplay',
]) {
  requireText(movement, marker, 'Contrato ledger/saldo incompleto: ' + marker);
}

for (const marker of [
  "warehouseDocumentPath(normalizedWorkspaceId, 'movements', movementId)",
  'const balancePath = warehouseDocumentPath(',
  'runTransaction',
  'existingMovementSnapshot.exists()',
  'WAREHOUSE_IDEMPOTENCY_CONFLICT',
  'applyWarehouseMovementToBalance',
  'serverTimestamp()',
  'getWarehouseBalance',
  'getWarehouseMovement',
]) {
  requireText(repository, marker, 'Persistência transacional da FASE 2 incompleta: ' + marker);
}

for (const marker of [
  "movements: 'movements'",
  "balances: 'balances'",
]) {
  requireText(namespace, marker, 'Namespace da FASE 2 incompleto: ' + marker);
}

for (const marker of [
  'function validWarehouseMovementDocument(workspaceId, movementId)',
  "request.resource.data.schemaVersion == 'warehouse_movement_v1'",
  'function warehouseMovementHasMatchingBalanceAfter(workspaceId, movementId)',
  'function validWarehouseBalanceDocument(workspaceId, materialId)',
  "request.resource.data.schemaVersion == 'warehouse_balance_v1'",
  'function warehouseBalanceWriteBackedByNewMovement(workspaceId, materialId)',
  'match /movements/{movementId}',
  'allow update, delete: if false;',
  'match /balances/{materialId}',
  "domain != 'movements'",
  "domain != 'balances'",
]) {
  requireText(rules, marker, 'Firestore Rules da FASE 2 incompletas: ' + marker);
}

const warehouseRuleStart = rules.indexOf('match /warehouse/{workspaceId}');
const operationalRuleStart = rules.indexOf('// Workspace-scoped operational data.', warehouseRuleStart);
if (warehouseRuleStart < 0 || operationalRuleStart < 0) {
  findings.push('Não foi possível isolar o bloco warehouse nas Rules.');
} else {
  const warehouseRules = rules.slice(warehouseRuleStart, operationalRuleStart);
  forbidText(
    warehouseRules,
    'canAccessWorkspace(workspaceId)',
    'FASE 2 reintroduziu fallback de workspace no namespace warehouse.'
  );
}

for (const scenario of [
  'Fundador cria movimento e saldo atômicos da FASE 2',
  'Fundador aplica segundo movimento e atualiza saldo da FASE 2',
  'Ledger da FASE 2 é append-only',
  'Saldo da FASE 2 não aceita alteração sem novo movimento',
  'Movimento da FASE 2 não existe sem atualização de saldo correspondente',
  'Setor externo não lê ledger da FASE 2',
  'Setor externo não lê saldo da FASE 2',
  'Sessão fundadora por senha não lê ledger da FASE 2',
]) {
  requireText(
    securitySuite,
    scenario,
    'Cenário de segurança da FASE 2 ausente: ' + scenario
  );
}

for (const marker of [
  'suporta os sete tipos iniciais do ledger da FASE 2',
  'gera ID determinístico por workspace e chave de idempotência',
  'saldo materializado é derivado do ledger e incrementa revisão',
  'replay idempotente exige payload canônico idêntico',
  'REVERSAL exige referência',
]) {
  requireText(contractTests, marker, 'Teste de domínio da FASE 2 ausente: ' + marker);
}

requireText(
  phase0Guard,
  'ADM DEPÓSITO FASE 0: READY',
  'Gate permanente da FASE 0 foi removido.'
);
requireText(
  phase1Guard,
  'ADM DEPÓSITO FASE 1: READY',
  'Gate permanente da FASE 1 foi removido.'
);
requireText(
  pkg.scripts?.['test:adm-deposito-ledger'] || '',
  'warehouse-ledger-contract.test.mjs',
  'package.json não registra testes do ledger.'
);
requireText(
  pkg.scripts?.['verify:adm-deposito-phase-2'] || '',
  'verify-adm-deposito-phase-2.mjs',
  'package.json não registra gate da FASE 2.'
);
requireText(ci, 'npm run verify:adm-deposito-phase-0', 'CI deixou de executar FASE 0.');
requireText(ci, 'npm run verify:adm-deposito-phase-1', 'CI deixou de executar FASE 1.');
requireText(ci, 'npm run test:adm-deposito-ledger', 'CI não executa testes da FASE 2.');
requireText(ci, 'npm run verify:adm-deposito-phase-2', 'CI não executa gate da FASE 2.');
requireText(ci, 'npm run test:security:multitenant', 'CI deixou de executar segurança multi-tenant.');

if (findings.length) {
  console.error('ADM DEPÓSITO FASE 2: BLOQUEADO\n');
  for (const finding of findings) console.error('  [BLOCK] ' + finding);
  process.exitCode = 2;
} else {
  console.log('ADM DEPÓSITO FASE 2: READY');
  console.log('DEP-2: ledger append-only com os sete tipos iniciais');
  console.log('DEP-2.1: saldo materializado atualizado atomicamente com o ledger');
  console.log('DEP-2.2: ID determinístico e replay idempotente sem duplicação');
  console.log('Segurança: gate fundador preservado e saldo não pode divergir do ledger');
  console.log('Escopo: NF→estoque e demais funcionalidades da FASE 3 não iniciadas');
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
