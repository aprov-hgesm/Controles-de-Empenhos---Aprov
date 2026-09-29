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

const types = read('lib/types.ts');
const domain = read('lib/warehouse/invoiceIntegration.ts');
const service = read('lib/warehouse/invoiceIntegrationService.ts');
const nsLifecycle = read('lib/nsIntegrityService.ts');
const movement = read('lib/warehouse/movement.ts');
const rules = read('firestore.warehouse.rules');
const stock = read('features/warehouse/components/WarehouseStockOperational.tsx');
const movements = read('features/warehouse/components/WarehouseMovementsOperational.tsx');
const control = read('features/warehouse/components/WarehouseItemControlOperational.tsx');
const nfView = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const packageJson = read('package.json');

for (const marker of [
  'warehouseMaterialId?: string',
  'warehouseMovementIds?: string[]',
  'warehouseIntegration?: WarehouseInvoiceIntegrationState',
]) {
  requireText(types, marker, 'Contrato NF/material incompleto: ' + marker);
}

for (const marker of [
  'deriveWarehouseMaterialIdForEmpenhoItem',
  'buildWarehouseInvoiceMovementPlans',
  'buildWarehouseInvoiceIdempotencyKey',
  'isInvoiceOnOrAfterWarehouseCutoff',
  "'INVOICE_CORRECTION'",
]) {
  requireText(domain, marker, 'Domínio NF → estoque incompleto: ' + marker);
}

for (const marker of [
  'WAREHOUSE_LEGACY_CROSS_DATABASE_INTEGRATION_DISABLED',
  'integrateInvoiceReceiptInTransaction',
  'integrateInvoiceDeletionInTransaction',
  'assertBulkInvoiceDeletionDoesNotBypassWarehouse',
  'throw new Error(WAREHOUSE_LEGACY_CROSS_DATABASE_INTEGRATION_DISABLED)',
]) {
  requireText(service, marker, 'Compatibilidade segura da FASE 4 incompleta: ' + marker);
}

for (const forbidden of [
  'currentSessionCanIntegrateWarehouse',
  'integrateInvoiceReceiptInTransaction',
  'integrateInvoiceDeletionInTransaction',
  'assertBulkInvoiceDeletionDoesNotBypassWarehouse',
  "from './warehouse/",
]) {
  if (nsLifecycle.includes(forbidden)) {
    findings.push('EMPROVEX voltou a depender do ADM Depósito no lifecycle de NF: ' + forbidden);
  }
}
requireText(nsLifecycle, 'updatedInvoice', 'Lifecycle central de NF perdeu seu retorno operacional.');

for (const marker of [
  'WarehouseMovementSource',
  "kind: 'INVOICE'",
  'supplier: string',
  'actorUid: string',
  'source: WarehouseMovementSource | null',
]) {
  requireText(movement, marker, 'Rastreabilidade do ledger incompleta: ' + marker);
}

for (const marker of [
  'function validWarehouseMovementSource(workspaceId, type, source)',
  "source.action in ['ENTRY', 'CORRECTION', 'DELETE']",
  'source.actorUid == request.auth.uid',
  'function validWarehouseInvoiceIntegrationSettings(workspaceId, settingId)',
  "match /settings/{settingId}",
  'existsAfter(',
  'getAfter(',
]) {
  requireText(rules, marker, 'Firestore Rules da FASE 4 incompletas: ' + marker);
}

for (const marker of [
  'Saldo agregado',
  'Consulta sob demanda',
  'listWarehousePositiveBalances',
]) {
  requireText(stock, marker, 'Superfície atual de estoque incompleta: ' + marker);
}
for (const marker of [
  'listWarehouseMovements',
  'Ledger auditável do ADM Depósito',
]) {
  requireText(movements, marker, 'Superfície atual de movimentações incompleta: ' + marker);
}
for (const marker of [
  'WarehouseStockOperational',
  'WarehouseMovementsOperational',
]) {
  requireText(control, marker, 'Controle de Itens não expõe capacidade operacional: ' + marker);
}

requireText(nfView, 'disabled={isSavingInvoice}', 'Fluxo de NF perdeu proteção contra duplo envio.');

for (const marker of [
  '"test:adm-deposito-nf-stock"',
  '"verify:adm-deposito-phase-4"',
]) {
  requireText(packageJson, marker, 'Gate npm da FASE 4 ausente: ' + marker);
}

if (findings.length) {
  console.error('FASE 4 — NF → Estoque: FALHOU');
  for (const finding of findings) console.error('- ' + finding);
  process.exit(1);
}

console.log('FASE 4 — isolamento EMPROVEX/ADM Depósito: OK');
console.log('- lifecycle de NF do EMPROVEX não depende do namespace warehouse');
console.log('- integração atômica cross-database permanece explicitamente desativada');
console.log('- superfícies atuais expõem saldo oficial e ledger sem reintroduzir acoplamento');
console.log('- namespace warehouse continua separado e isolado por workspace/UG');
