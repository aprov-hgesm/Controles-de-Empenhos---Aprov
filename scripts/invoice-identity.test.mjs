#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(resolve(process.cwd(), 'lib/invoiceIdentity.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'invoiceIdentity.ts',
}).outputText;

const context = vm.createContext({ console, encodeURIComponent });
const module = new vm.SourceTextModule(transpiled, {
  context,
  identifier: 'file:///lib/invoiceIdentity.js',
});
await module.link(() => {
  throw new Error('invoiceIdentity.ts não deve possuir import runtime.');
});
await module.evaluate();

const {
  normalizeSupplierCnpj,
  normalizeInvoiceNumber,
  buildInvoiceRecordKey,
  getInvoiceRecordKey,
  sameInvoiceNumber,
  findInvoiceIdentityConflict,
} = module.namespace;

function invoice(id, supplierCnpj, recordKey) {
  return {
    id,
    empenhoId: '2026NE000001',
    issueDate: '2026-09-01',
    items: [],
    totalValue: 100,
    supplier: 'Fornecedor',
    ...(supplierCnpj ? { supplierCnpj } : {}),
    ...(recordKey ? { recordKey } : {}),
  };
}

test('normaliza CNPJ formatado para 14 dígitos', () => {
  assert.equal(normalizeSupplierCnpj('02.483.088/0001-75'), '02483088000175');
  assert.equal(normalizeSupplierCnpj('02483088000175'), '02483088000175');
  assert.equal(normalizeSupplierCnpj('123'), '');
});

test('normaliza zeros à esquerda somente para NF numérica', () => {
  assert.equal(normalizeInvoiceNumber('01234'), '1234');
  assert.equal(normalizeInvoiceNumber('000000'), '0');
  assert.equal(normalizeInvoiceNumber(' AB-012 '), 'AB-012');
  assert.equal(sameInvoiceNumber('01234', '1234'), true);
});

test('recordKey combina CNPJ e número normalizado', () => {
  assert.equal(
    buildInvoiceRecordKey('02.483.088/0001-75', '01234'),
    'nf_02483088000175_1234'
  );
  assert.equal(buildInvoiceRecordKey('', '1234'), null);
});

test('duas empresas podem possuir o mesmo número de NF', () => {
  const existing = invoice('1234', '02483088000175', 'nf_02483088000175_1234');
  const conflict = findInvoiceIdentityConflict(
    [existing],
    '11111111000191',
    '01234'
  );
  assert.equal(conflict, null);
});

test('mesmo CNPJ e NF com zeros à esquerda conflitam', () => {
  const existing = invoice('1234', '02483088000175', 'nf_02483088000175_1234');
  const conflict = findInvoiceIdentityConflict(
    [existing],
    '02.483.088/0001-75',
    '01234'
  );
  assert.equal(conflict, existing);
});

test('registro legado sem CNPJ bloqueia duplicação ambígua', () => {
  const legacy = invoice('1234');
  const conflict = findInvoiceIdentityConflict(
    [legacy],
    '02483088000175',
    '01234'
  );
  assert.equal(conflict, legacy);
});

test('recordKey legado continua usando id quando ausente', () => {
  assert.equal(getInvoiceRecordKey(invoice('00123')), '00123');
});
