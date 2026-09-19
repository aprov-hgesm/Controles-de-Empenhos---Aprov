#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const domain = read('lib/nsIntegrity.ts');
const service = read('lib/nsIntegrityService.ts');
const sagPersistence = read('lib/sagNsPersistence.ts');
const sagPlan = read('lib/sagNsPersistencePlan.ts');
const manual = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  "export type NsIntegrityMutationSource = 'sag' | 'manual' | 'migration' | 'system'",
  'export interface NsIntegrityMutation',
  'export interface NsLockDocument',
  'buildNsLockDocumentId',
  'buildNsLockDocument',
  'assertNsLockOwnership',
  'validateNsIntegritySnapshot',
  "'duplicate_invoice_target'",
  "'duplicate_ns_in_batch'",
  "'stale_invoice_ns'",
  "'ns_reused_in_scope'",
  "'ns_lock_conflict'",
  "'stale_lock_owner'",
]) {
  requireText(domain, expected, `Domínio central perdeu requisito: ${expected}`);
}

for (const expected of [
  'runTransaction',
  'validateNsIntegritySnapshot',
  'transaction.get(',
  'operationalSettingsDocRef',
  'transaction.set(',
  'transaction.delete(',
  'deleteField()',
  'buildNsLockDocument',
  'MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS = 6',
  'MAX_NS_INTEGRITY_KNOWN_OWNER_READS = 200',
  'Reaplicações idempotentes também normalizam a identidade física',
]) {
  requireText(service, expected, `Serviço central perdeu requisito: ${expected}`);
}

requireText(sagPersistence, 'commitNsIntegrityMutations', 'SAG não delega para o serviço central de NS.');
requireText(sagPersistence, "source: 'sag'", 'Adaptador SAG não identifica a origem da mutação.');
forbidText(sagPersistence, "from 'firebase/firestore'", 'SAG voltou a importar Firestore diretamente.');
forbidText(sagPersistence, 'runTransaction(', 'SAG voltou a abrir transação própria.');
forbidText(sagPersistence, 'operationalSettingsDocRef', 'SAG voltou a manipular locks diretamente.');

requireText(sagPlan, 'validateNsIntegritySnapshot', 'Plano SAG não reutiliza a validação central.');
requireText(sagPlan, 'buildNsLockDocumentId', 'Identidade de lock SAG não reutiliza a camada central.');

requireText(
  manual,
  'const handleSaveNumeroNS',
  'O Bloco 1 não deve remover a edição manual antes da migração controlada do Bloco 2.'
);

requireText(pkg, '"test:ns-integrity"', 'Testes do serviço de integridade não estão registrados.');
requireText(pkg, '"verify:ns-integrity-service"', 'Guard do serviço de integridade não está registrado.');
requireText(workflow, 'NS integrity domain tests', 'CI não executa testes do domínio de integridade.');
requireText(workflow, 'NS integrity service guard', 'CI não executa o guard do serviço de integridade.');

if (findings.length) {
  console.error('NS INTEGRITY SERVICE: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('NS INTEGRITY SERVICE: READY');
  console.log('Domínio compartilhado: ATIVO');
  console.log('Transação NF + lock: CENTRALIZADA');
  console.log('SAG como adaptador: ATIVO');
  console.log('Atribuição/troca/remoção: MODELADAS');
  console.log('Migração manual: RESERVADA AO BLOCO 2');
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
