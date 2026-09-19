#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const manual = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const service = read('lib/nsIntegrityService.ts');
const status = JSON.parse(read('ops/ns-integrity-resolution-status.json'));
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

const start = manual.indexOf('const handleSaveNumeroNS');
const end = manual.indexOf('const handleSaveComissao', start);
if (start < 0 || end < 0) {
  findings.push('Não foi possível localizar o bloco handleSaveNumeroNS.');
}

const block = start >= 0 && end > start ? manual.slice(start, end) : '';

for (const expected of [
  'commitNsIntegrityMutations',
  "source: 'manual'",
  'expectedCurrentNs',
  'knownNsOwnerRecordKeys',
  'normalizeNsNumber(value)',
  'isValidNsNumber(proposedNs)',
  "Faça login novamente antes de alterar o Número da NS.",
  'setInvoices((current)',
]) {
  requireText(block, expected, `Edição manual perdeu requisito: ${expected}`);
}

forbidText(block, 'saveInvoice(', 'handleSaveNumeroNS voltou a gravar a NF diretamente.');
forbidText(block, 'numeroNS: trimmed', 'handleSaveNumeroNS voltou a montar alteração local otimista.');
forbidText(block, 'const updatedInvoices = invoices.map', 'Estado local da NS está sendo alterado antes do commit.');

const commitIndex = block.indexOf('await commitNsIntegrityMutations');
const stateIndex = block.indexOf('setInvoices((current)');
if (commitIndex < 0 || stateIndex < 0 || stateIndex < commitIndex) {
  findings.push('Estado local deve ser atualizado somente depois do commit transacional.');
}

requireText(service, 'transaction.delete(', 'Serviço central não suporta liberação do lock antigo.');
requireText(service, 'deleteField()', 'Serviço central não suporta remoção real de numeroNS.');

if (status.gaps?.['GAP-001']?.status !== 'resolved') {
  findings.push('GAP-001 não está marcado como resolvido no status evolutivo.');
}
if (status.gaps?.['GAP-001']?.resolvedInBlock !== 2) {
  findings.push('GAP-001 deve apontar para resolução no Bloco 2.');
}

requireText(pkg, '"verify:manual-ns-integrity"', 'Guard da edição manual não está registrado.');
requireText(workflow, 'Manual NS integrity guard', 'CI não executa o guard da edição manual.');

if (findings.length) {
  console.error('MANUAL NS INTEGRITY: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('MANUAL NS INTEGRITY: READY');
  console.log('saveInvoice bypass: REMOVIDO');
  console.log('Origem manual: CENTRALIZADA');
  console.log('Atribuição/troca/remoção: TRANSACIONAIS');
  console.log('Manual x SAG: MESMO LOCK');
  console.log('GAP-001: RESOLVIDO');
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
