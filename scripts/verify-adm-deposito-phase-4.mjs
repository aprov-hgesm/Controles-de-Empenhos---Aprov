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
const rules = read('firestore.rules');
const content = read('features/warehouse/components/WarehouseSectionContent.tsx');
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
  'integrateInvoiceReceiptInTransaction',
  'integrateInvoiceDeletionInTransaction',
  'applyWarehouseMovementToBalance',
  'createWarehouseMovementId',
  'serverTimestamp()',
  'WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION',
  'assertBulkInvoiceDeletionDoesNotBypassWarehouse',
]) {
  requireText(service, marker, 'Serviço transacional da FASE 4 incompleto: ' + marker);
}

for (const marker of [
  'currentSessionCanIntegrateWarehouse',
  'integrateInvoiceReceiptInTransaction',
  'integrateInvoiceDeletionInTransaction',
  'updatedInvoice',
  'assertBulkInvoiceDeletionDoesNotBypassWarehouse',
]) {
  requireText(nsLifecycle, marker, 'Lifecycle de NF não está acoplado à FASE 4: ' + marker);
}

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
  "domain != 'settings'",
  'existsAfter(',
  'getAfter(',
]) {
  requireText(rules, marker, 'Firestore Rules da FASE 4 incompletas: ' + marker);
}

for (const marker of [
  'listWarehouseBalances',
  'listWarehouseMovements',
  'Saldos reais',
  'Ledger oficial · histórico append-only',
]) {
  requireText(content, marker, 'Superfícies reais da FASE 4 incompletas: ' + marker);
}

for (const marker of [
  'Estoque integrado',
  'correção compensatória no ledger',
  'disabled={isSavingInvoice}',
]) {
  requireText(nfView, marker, 'UX de integração da NF incompleta: ' + marker);
}

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

console.log('FASE 4 — NF → Estoque: OK');
console.log('- NF/recebimento acoplado atomicamente ao ledger oficial');
console.log('- material canônico vinculado por identificador estável');
console.log('- idempotência, cutoff e correção/estorno auditável presentes');
console.log('- telas Estoque e Movimentações consultam dados reais de forma limitada');
console.log('- gate founder-only preservado pelas Rules e pelo runtime');
