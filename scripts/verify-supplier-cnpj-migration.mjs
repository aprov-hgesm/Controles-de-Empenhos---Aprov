#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const planner = read('lib/supplierCnpjMigration.ts');
const service = read('lib/nsIntegrityService.ts');
const hook = read('features/empenhos/hooks/useEmpenhoActions.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  'buildSupplierCnpjMigrationPlan',
  "'invalid_target_cnpj'",
  "'cannot_remove_with_invoices'",
  "'invoice_supplier_conflict'",
  "'duplicate_target_identity'",
  'buildInvoiceRecordKey',
  'updatedInvoice',
]) {
  requireText(planner, expected, `Planner de CNPJ perdeu requisito: ${expected}`);
}

for (const expected of [
  'commitEmpenhoSupplierCnpjMigration',
  'MAX_SUPPLIER_CNPJ_MIGRATION_INVOICES = 100',
  "where('empenhoId', '==', input.empenhoId)",
  'buildSupplierCnpjMigrationPlan',
  'occupiedTargetKeys',
  "'duplicate_target_identity'",
  'buildNsLockDocument',
  'assertNsLockOwnership',
  'transaction.delete(',
  'supplierCnpj: plan.targetSupplierCnpj',
  'migratedLockCount',
  'MAX_SUPPLIER_CNPJ_MIGRATION_NS_LOCKS = 5',
  'data.recordKey && data.recordKey !== snapshot.id',
  "data.empenhoId !== input.empenhoId",
  'storedTargetCnpj !== expectedTargetCnpj',
  "'supplier_scope_changed'",
  'legacyNsCanonicalOverrides',
  'backfilledNsUgCount',
  'canonicalizedLegacyNsCount',
  'scopeUg = normalizeNsUg(scope.ug)',
  'buildNsLockDocumentId(resolvedUg, resolvedNs)',
]) {
  requireText(service, expected, `Serviço de migração de CNPJ perdeu requisito: ${expected}`);
}

const handlerStart = hook.indexOf('const handleUpdateEmpenhoSupplierCnpj');
const handlerEnd = hook.indexOf('const handleUpdateEmpenhoClassification', handlerStart);
const handler = handlerStart >= 0 && handlerEnd > handlerStart
  ? hook.slice(handlerStart, handlerEnd)
  : '';

if (!handler) {
  findings.push('Handler de atualização de CNPJ não foi localizado.');
} else {
  requireText(handler, 'commitEmpenhoSupplierCnpjMigration', 'Handler não usa migração transacional.');
  requireText(handler, 'linkedInvoices.length', 'Handler não calcula impacto sobre NFs.');
  requireText(handler, 'confirm(', 'Migração com NFs não pede confirmação explícita.');
  requireText(handler, 'setInvoices((current)', 'Estado local das NFs não é sincronizado após a migração.');
  requireText(handler, 'setEmpenhos((current)', 'Estado local do empenho não é sincronizado após a migração.');
  requireText(handler, 'legacyNsCanonicalOverrides', 'Handler não prepara correção explícita de NS legada.');
  requireText(handler, 'isValidNsNumber', 'Handler não valida o formato canônico da NS legada.');
  requireText(handler, 'prompt(', 'Handler não solicita confirmação humana para converter NS abreviada.');
  requireText(handler, 'nsWithoutUgCount', 'Handler não informa backfill automático da UG.');
  forbidText(handler, 'saveEmpenho(', 'CNPJ voltou a ser salvo diretamente via saveEmpenho.');
}

for (const expected of [
  'invoiceEmpenhoMatchesAfter(workspaceId, data)',
  'getAfter(empenhoPath).data.supplierCnpj == data.supplierCnpj',
  'sagNsLockTargetMatchesAfter(workspaceId)',
  'validSagNsLockOwnerMigration(workspaceId)',
  'validSagNsLockMetadataRefresh(workspaceId)',
]) {
  requireText(rules, expected, `Rules perderam vínculo CNPJ NE/NF/lock: ${expected}`);
}

for (const expected of [
  'CNPJ migra empenho, NFs e lock de NS na mesma transação',
  'CNPJ saneia NS legada usando a UG da unidade na mesma transação',
  'legacyUgCanonicalNs',
  'nsUg: DEFAULT_NS_UG',
  'Lock não aceita novo CNPJ se o empenho final não confirmar o mesmo CNPJ',
]) {
  requireText(security, expected, `Emulator não cobre cenário de CNPJ: ${expected}`);
}

requireText(pkg, '"test:supplier-cnpj-migration"', 'Teste do planner de CNPJ não está registrado.');
requireText(pkg, '"verify:supplier-cnpj-migration"', 'Guard de migração de CNPJ não está registrado.');
requireText(workflow, 'Supplier CNPJ migration tests', 'CI não executa testes da migração de CNPJ.');
requireText(workflow, 'Supplier CNPJ migration guard', 'CI não executa guard da migração de CNPJ.');

if (findings.length) {
  console.error('SUPPLIER CNPJ MIGRATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SUPPLIER CNPJ MIGRATION: READY');
  console.log('Empenho + NFs + recordKeys: ATÔMICOS');
  console.log('Locks NS: MIGRADOS/RECONSTRUÍDOS');
  console.log('NS sem UG: BACKFILL PELA UG DO WORKSPACE');
  console.log('NS abreviada: CONVERSÃO EXPLÍCITA/CONFIRMADA');
  console.log('Colisões: BLOQUEADAS');
  console.log('CNPJ NE/NF/lock: COERENTE');
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
