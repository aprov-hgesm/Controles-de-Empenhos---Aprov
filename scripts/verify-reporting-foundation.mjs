#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const types = read('lib/types.ts');
const identity = read('lib/invoiceIdentity.ts');
const empenhoActions = read('features/empenhos/hooks/useEmpenhoActions.ts');
const invoiceActions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const sync = read('lib/firebaseSync.ts');

requireText(types, 'supplierCnpj?: string', 'Empenho/Invoice não expõem supplierCnpj.');
requireText(types, 'recordKey?: string', 'Invoice não expõe recordKey interno.');
requireText(identity, 'normalizeSupplierCnpj', 'Normalizador de CNPJ ausente.');
requireText(identity, 'normalizeInvoiceNumber', 'Normalizador de número da NF ausente.');
requireText(identity, 'buildInvoiceRecordKey', 'Construtor de recordKey ausente.');
requireText(identity, 'findInvoiceIdentityConflict', 'Validador de colisão fornecedor/NF ausente.');
requireText(empenhoActions, 'supplierCnpj:', 'CNPJ não é persistido ao salvar empenho.');
requireText(invoiceActions, 'findInvoiceIdentityConflict', 'Cadastro de NF não usa identidade fornecedor + número.');
requireText(invoiceActions, 'recordKey:', 'Cadastro de NF não persiste chave interna.');
requireText(invoiceActions, 'supplierCnpj:', 'NF não recebe CNPJ do fornecedor.');
requireText(sync, 'getInvoiceRecordKey', 'Persistência Firebase não usa recordKey da NF.');

if (findings.length) {
  console.error('REPORTING FOUNDATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('REPORTING FOUNDATION: READY');
  console.log('CNPJ persistente: PRONTO');
  console.log('Identidade NF por fornecedor + número: PRONTO');
  console.log('Compatibilidade com NFs legadas: PRESERVADA');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
