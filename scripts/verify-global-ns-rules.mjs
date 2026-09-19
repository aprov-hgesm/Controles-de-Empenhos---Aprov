#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const rules = read('firestore.rules');
const service = read('lib/nsIntegrityService.ts');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  'function isValidNsNumber(value)',
  "value.matches('^[0-9]{4}NS[0-9]{6}$')",
  'function isValidNsUg(value)',
  "value.matches('^[0-9]{6}$')",
  'function sagNsLockIdForIdentity(ug, numeroNS)',
  'function legacySagNsLockIdForNumber(numeroNS)',
  'function invoiceHasCanonicalNsIdentity(data)',
  'function invoiceHasLegacyNsIdentity(data)',
  'function invoiceLockMatchesAfter(workspaceId, id, data)',
  'function oldInvoiceLockReleasedAfter(workspaceId, id)',
  'function deletedInvoiceLockReleasedAfter(workspaceId, id)',
  'function validInvoiceCreate(workspaceId, id)',
  'function validInvoiceUpdate(workspaceId, id)',
  'function validInvoiceDelete(workspaceId, id)',
  'function sagNsLockTargetMatchesAfter(workspaceId)',
  'function validLegacySagNsLockUpdate(workspaceId, id)',
  'request.resource.data.id == sagNsLockIdForIdentity(',
  '&& validInvoiceCreate(workspaceId, id);',
  '&& validInvoiceUpdate(workspaceId, id);',
  '&& validInvoiceDelete(workspaceId, id);',
]) {
  requireText(rules, expected, `Rules globais perderam requisito: ${expected}`);
}

const invoiceMatchStart = rules.indexOf('match /workspaces/{workspaceId}/invoices/{id}');
const invoiceMatchEnd = rules.indexOf(
  'match /workspaces/{workspaceId}/comissoes/{id}',
  invoiceMatchStart
);
const invoiceMatch =
  invoiceMatchStart >= 0 && invoiceMatchEnd > invoiceMatchStart
    ? rules.slice(invoiceMatchStart, invoiceMatchEnd)
    : '';

if (!invoiceMatch) {
  findings.push('Match operacional de invoices não foi localizado.');
} else {
  forbidText(invoiceMatch, 'allow read, write:', 'Invoices voltou a permitir write genérico.');
  forbidText(invoiceMatch, 'allow write:', 'Invoices possui bypass de write genérico.');
}

for (const expected of [
  'MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS = 6',
  'MAX_INVOICE_LIFECYCLE_NS_LOCKS = 8',
  'MAX_SUPPLIER_CNPJ_MIGRATION_NS_LOCKS = 5',
  'buildStoredNsLockDocumentId',
  'nsUg: proposedUg',
  'nsUg: deleteField()',
]) {
  requireText(service, expected, `Serviço perdeu proteção compatível com Rules: ${expected}`);
}

for (const expected of [
  'NF não recebe numeroNS diretamente sem lock correspondente',
  'NF não pode ser criada já liquidada sem lock correspondente',
  'numeroNS fora do formato canônico é rejeitado pelas Rules',
  'Lock não pode nascer órfão sem NF correspondente',
  'Transação coerente NF + lock continua autorizada',
  'Atualização comum da NF preserva NS quando o lock continua coerente',
  'Troca direta de NS sem novo lock é rejeitada',
  'Remoção direta de NS sem liberar o lock é rejeitada',
  'Exclusão direta de NF com lock ativo é rejeitada',
  'Registro legado com NS pode reparar recordKey preservando lock legado existente',
  'Setor não pode reservar NS com UG diferente da UG vinculada ao workspace',
  'Setor reserva NS usando automaticamente a UG vinculada ao workspace',
]) {
  requireText(security, expected, `Emulator não cobre bypass global: ${expected}`);
}

requireText(pkg, '"verify:global-ns-rules"', 'Guard global de Rules não está registrado.');
requireText(workflow, 'Global NS Firestore Rules guard', 'CI não executa o guard global de Rules.');

if (findings.length) {
  console.error('GLOBAL NS FIRESTORE RULES: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('GLOBAL NS FIRESTORE RULES: READY');
  console.log('Write direto de numeroNS sem lock: BLOQUEADO');
  console.log('Lock órfão: BLOQUEADO');
  console.log('Identidade canônica workspace + UG + NS: PROTEGIDA');
  console.log('Compatibilidade legada: CONTROLADA');
  console.log('Troca/remoção/delete incoerentes: BLOQUEADOS');
  console.log('Atualizações comuns com lock coerente: PRESERVADAS');
  console.log('Budget de access calls: PROTEGIDO');
}
