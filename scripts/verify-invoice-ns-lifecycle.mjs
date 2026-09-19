#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const service = read('lib/nsIntegrityService.ts');
const sync = read('lib/firebaseSync.ts');
const hook = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  'commitInvoiceReceiptLifecycle',
  'commitInvoiceDeletionLifecycle',
  'commitAllInvoicesDeletionLifecycle',
  'assertNsLockOwnership',
  'buildNsLockDocument',
  'buildNsLockDocumentId',
  'transaction.delete(previousInvoiceRef)',
  'transaction.delete(invoiceRef)',
  'transaction.delete(lockRef)',
  'MAX_INVOICE_LIFECYCLE_WRITES = 450',
]) {
  requireText(service, expected, `Serviço de ciclo de vida perdeu requisito: ${expected}`);
}

for (const expected of [
  'commitInvoiceReceiptLifecycle',
  'commitInvoiceDeletionLifecycle',
  'commitAllInvoicesDeletionLifecycle',
]) {
  requireText(sync, expected, `firebaseSync deixou de delegar para o ciclo de vida central: ${expected}`);
}

const receiptStart = sync.indexOf('export async function commitInvoiceReceiptChanges');
const receiptEnd = sync.indexOf('export async function commitInvoiceDeletion', receiptStart);
const receiptBlock = sync.slice(receiptStart, receiptEnd);
forbidText(receiptBlock, 'writeBatch(', 'Recebimento de NF voltou a usar batch sem consciência de lock.');

const deleteStart = sync.indexOf('export async function commitInvoiceDeletion');
const deleteEnd = sync.indexOf('export async function commitAllInvoicesDeletion', deleteStart);
const deleteBlock = sync.slice(deleteStart, deleteEnd);
forbidText(deleteBlock, 'writeBatch(', 'Exclusão individual voltou a usar batch sem lock.');

const bulkStart = sync.indexOf('export async function commitAllInvoicesDeletion');
const bulkEnd = sync.indexOf('export async function commitAllComissoesDeletion', bulkStart);
const bulkBlock = sync.slice(bulkStart, bulkEnd);
forbidText(bulkBlock, 'writeBatch(', 'Exclusão em lote voltou a ignorar locks.');

requireText(
  hook,
  'editingInvoice ? previousRecordKey : undefined',
  'Hook não informa a identidade anterior em toda edição de NF.'
);

for (const expected of [
  'validSagNsLockOwnerMigration(workspaceId)',
  'validSagNsLockMetadataRefresh(workspaceId)',
  'validSagNsLockDelete(workspaceId, id)',
  '!existsAfter(oldInvoicePath)',
  'existsAfter(newInvoicePath)',
  'getAfter(newInvoicePath).data.numeroNS == request.resource.data.numeroNS',
  '!isSagNsLockId(id)',
  'validSagNsLockDelete(workspaceId, id)',
]) {
  requireText(rules, expected, `Rules de ciclo de vida perderam requisito: ${expected}`);
}

for (const expected of [
  'Lock NS ativo não pode ser excluído isoladamente enquanto a NF ainda o utiliza',
  'Migração de recordKey move NF e proprietário do lock na mesma transação',
  'Exclusão de NF remove o lock correspondente na mesma transação',
  'Remoção manual da NS pode liberar lock quando a NF deixa de usar a NS',
  'Mesmo recordKey pode atualizar metadados do lock somente junto da NF coerente',
]) {
  requireText(security, expected, `Emulator não cobre cenário de ciclo de vida: ${expected}`);
}

requireText(pkg, '"verify:invoice-ns-lifecycle"', 'Guard de ciclo de vida NF+NS não está registrado.');
requireText(workflow, 'Invoice NS lifecycle guard', 'CI não executa o guard de ciclo de vida NF+NS.');

if (findings.length) {
  console.error('INVOICE NS LIFECYCLE: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('INVOICE NS LIFECYCLE: READY');
  console.log('Exclusão NF + lock: ATÔMICA');
  console.log('Migração recordKey + lock: ATÔMICA');
  console.log('Refresh de metadados: COERENTE');
  console.log('Delete isolado de lock ativo: BLOQUEADO');
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
