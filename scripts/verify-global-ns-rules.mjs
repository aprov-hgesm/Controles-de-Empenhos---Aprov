#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const rules = read('firestore.rules');
const service = read('lib/nsIntegrityService.ts');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  'function isValidNsNumber(value)',
  "value.matches('^[0-9]{4}NS[0-9]{6}
  'function oldInvoiceLockReleasedAfter(workspaceId, id)',
  'function deletedInvoiceLockReleasedAfter(workspaceId, id)',
  'function validInvoiceCreate(workspaceId, id)',
  'function validInvoiceUpdate(workspaceId, id)',
  'function validInvoiceDelete(workspaceId, id)',
  'function sagNsLockTargetMatchesAfter(workspaceId)',
  'request.resource.data.id == sagNsLockIdForIdentity(',
  'allow create: if canAccessWorkspace(workspaceId)',
  '&& validInvoiceCreate(workspaceId, id);',
  '&& validInvoiceUpdate(workspaceId, id);',
  '&& validInvoiceDelete(workspaceId, id);',
]) {
  requireText(rules, expected, `Rules globais perderam requisito: ${expected}`);
}

const invoiceMatchStart = rules.indexOf('match /workspaces/{workspaceId}/invoices/{id}');
const invoiceMatchEnd = rules.indexOf('match /workspaces/{workspaceId}/comissoes/{id}', invoiceMatchStart);
const invoiceMatch = invoiceMatchStart >= 0 && invoiceMatchEnd > invoiceMatchStart
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
  'Reaplicações idempotentes também normalizam a identidade física',
]) {
  requireText(service, expected, `Serviço perdeu teto compatível com Rules: ${expected}`);
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
  'Registro legado com NS pode reparar recordKey e lock atomicamente',
  'Mesmo número de NS pode ser reservado em UGs diferentes',
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
  console.log('Troca/remoção/delete incoerentes: BLOQUEADOS');
  console.log('Atualizações comuns com lock coerente: PRESERVADAS');
  console.log('Budget de access calls: PROTEGIDO');
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
)",
  'function isValidNsUg(value)',
  "value.matches('^[0-9]{6}
  'function oldInvoiceLockReleasedAfter(workspaceId, id)',
  'function deletedInvoiceLockReleasedAfter(workspaceId, id)',
  'function validInvoiceCreate(workspaceId, id)',
  'function validInvoiceUpdate(workspaceId, id)',
  'function validInvoiceDelete(workspaceId, id)',
  'function sagNsLockTargetMatchesAfter(workspaceId)',
  'request.resource.data.id == sagNsLockIdForNumber(request.resource.data.numeroNS)',
  'allow create: if canAccessWorkspace(workspaceId)',
  '&& validInvoiceCreate(workspaceId, id);',
  '&& validInvoiceUpdate(workspaceId, id);',
  '&& validInvoiceDelete(workspaceId, id);',
]) {
  requireText(rules, expected, `Rules globais perderam requisito: ${expected}`);
}

const invoiceMatchStart = rules.indexOf('match /workspaces/{workspaceId}/invoices/{id}');
const invoiceMatchEnd = rules.indexOf('match /workspaces/{workspaceId}/comissoes/{id}', invoiceMatchStart);
const invoiceMatch = invoiceMatchStart >= 0 && invoiceMatchEnd > invoiceMatchStart
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
  'Reaplicações idempotentes também normalizam a identidade física',
]) {
  requireText(service, expected, `Serviço perdeu teto compatível com Rules: ${expected}`);
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
  'Registro legado com NS pode reparar recordKey e lock atomicamente',
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
  console.log('Troca/remoção/delete incoerentes: BLOQUEADOS');
  console.log('Atualizações comuns com lock coerente: PRESERVADAS');
  console.log('Budget de access calls: PROTEGIDO');
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
)",
  'function sagNsLockIdForIdentity(ug, numeroNS)',
  'function invoiceLockMatchesAfter(workspaceId, id, data)',
  'function oldInvoiceLockReleasedAfter(workspaceId, id)',
  'function deletedInvoiceLockReleasedAfter(workspaceId, id)',
  'function validInvoiceCreate(workspaceId, id)',
  'function validInvoiceUpdate(workspaceId, id)',
  'function validInvoiceDelete(workspaceId, id)',
  'function sagNsLockTargetMatchesAfter(workspaceId)',
  'request.resource.data.id == sagNsLockIdForNumber(request.resource.data.numeroNS)',
  'allow create: if canAccessWorkspace(workspaceId)',
  '&& validInvoiceCreate(workspaceId, id);',
  '&& validInvoiceUpdate(workspaceId, id);',
  '&& validInvoiceDelete(workspaceId, id);',
]) {
  requireText(rules, expected, `Rules globais perderam requisito: ${expected}`);
}

const invoiceMatchStart = rules.indexOf('match /workspaces/{workspaceId}/invoices/{id}');
const invoiceMatchEnd = rules.indexOf('match /workspaces/{workspaceId}/comissoes/{id}', invoiceMatchStart);
const invoiceMatch = invoiceMatchStart >= 0 && invoiceMatchEnd > invoiceMatchStart
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
  'Reaplicações idempotentes também normalizam a identidade física',
]) {
  requireText(service, expected, `Serviço perdeu teto compatível com Rules: ${expected}`);
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
  'Registro legado com NS pode reparar recordKey e lock atomicamente',
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
  console.log('Troca/remoção/delete incoerentes: BLOQUEADOS');
  console.log('Atualizações comuns com lock coerente: PRESERVADAS');
  console.log('Budget de access calls: PROTEGIDO');
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
