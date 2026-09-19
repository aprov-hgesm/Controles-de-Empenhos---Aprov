#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const plan = read('lib/sagNsPersistencePlan.ts');
const persistence = read('lib/sagNsPersistence.ts');
const hook = read('features/relatorios/hooks/useSagNsImportActions.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

requireText(plan, 'buildSagNsLockDocumentId', 'Identidade determinística do lock SAG ausente.');
requireText(plan, "'ns_lock_conflict'", 'Código de conflito de lock SAG ausente.');
requireText(plan, "'stale_lock_owner'", 'Código de lock SAG inconsistente ausente.');

requireText(persistence, 'MAX_SAG_NS_TRANSACTION_CHANGES = 100', 'Teto de 100 alterações não está protegido.');
requireText(persistence, 'MAX_SAG_NS_KNOWN_OWNER_READS = 200', 'Teto de leituras de donos conhecidos não está protegido.');
requireText(persistence, 'operationalSettingsDocRef', 'Persistência não utiliza lock no settings do workspace.');
requireText(persistence, 'transaction.get(operationalSettingsDocRef', 'Lock SAG não é relido dentro da transação.');
requireText(persistence, 'ns_lock_conflict', 'Colisão concorrente de NS não bloqueia o commit.');
requireText(persistence, "type: 'sag-ns-lock'", 'Documento de lock SAG não é criado.');
requireText(persistence, 'updatedBy: userId', 'Lock SAG não registra a identidade Firebase responsável.');

requireText(hook, 'knownNsOwnerRecordKeys', 'Hook não limita leituras aos possíveis donos das NS propostas.');
requireText(hook, 'proposedNs.has(normalizeSagNsNumber(invoice.numeroNS))', 'Filtro de donos conhecidos por NS proposta ausente.');
forbidText(hook, 'scopedInvoiceRecordKeys', 'Varredura ampla de todas as NFs do fornecedor reapareceu.');

requireText(rules, 'function validSagNsLock(workspaceId, id)', 'Rules não validam a estrutura do lock SAG.');
requireText(rules, 'function validSagNsLockUpdate(workspaceId, id)', 'Rules não protegem imutabilidade do lock SAG.');
requireText(rules, "request.resource.data.updatedBy == request.auth.uid", 'Rules não vinculam o lock ao UID autenticado.');
requireText(rules, '!isSagNsLockId(id)', 'Settings gerais não diferenciam locks SAG.');

requireText(security, 'Hardening transacional da importação SAG', 'Emulator suite não cobre o hardening SAG.');
requireText(security, 'concurrentReservations = await Promise.allSettled', 'Cenário concorrente SAG ausente no Emulator.');
requireText(security, 'Setor B não lê lock SAG do Setor A', 'Isolamento cross-tenant do lock não é testado.');
requireText(security, 'Lock SAG inválido cancela atomicamente a escrita da NF', 'Rollback atômico do lock não é testado.');

requireText(pkg, '"verify:sag-ns-hardening"', 'Guard do Bloco 12 não está registrado.');
requireText(workflow, 'SAG NS hardening guard', 'CI não executa o guard do Bloco 12.');
requireText(workflow, 'Multi-tenant Firestore security tests', 'CI deixou de executar o Emulator multi-tenant.');

if (findings.length) {
  console.error('SAG NS HARDENING: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SAG NS HARDENING: READY');
  console.log('Lock concorrencial por NS: ATIVO');
  console.log('Leituras por NS proposta: OTIMIZADAS');
  console.log('Rules multi-tenant do lock: ATIVAS');
  console.log('Firebase Emulator: COBERTO');
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
