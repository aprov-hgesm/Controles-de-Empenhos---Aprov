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
  calculateSupplierCnpjCheckDigits,
  formatSupplierCnpj,
  hasValidSupplierCnpjShape,
  isValidSupplierCnpj,
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

test('normaliza CNPJ numérico e alfanumérico para 14 posições canônicas', () => {
  assert.equal(normalizeSupplierCnpj('02.483.088/0001-75'), '02483088000175');
  assert.equal(normalizeSupplierCnpj('02483088000175'), '02483088000175');
  assert.equal(normalizeSupplierCnpj('00.000.000/E08G-12'), '00000000E08G12');
  assert.equal(normalizeSupplierCnpj('12.abc.345/01de-35'), '12ABC34501DE35');
  assert.equal(normalizeSupplierCnpj('12.ABC.345/01DE-XY'), '');
  assert.equal(normalizeSupplierCnpj('123'), '');
});

test('valida dígitos verificadores oficiais do CNPJ numérico e alfanumérico', () => {
  assert.equal(isValidSupplierCnpj('02.483.088/0001-75'), true);
  assert.equal(isValidSupplierCnpj('02.483.088/0001-74'), false);
  assert.equal(isValidSupplierCnpj('00.000.000/E08G-12'), true);
  assert.equal(isValidSupplierCnpj('12.ABC.345/01DE-35'), true);
  assert.equal(isValidSupplierCnpj('12.ABC.345/01DE-34'), false);
  assert.equal(isValidSupplierCnpj('00.000.000/0000-00'), false);
});

test('calcula DV pela regra ASCII-48 e módulo 11', () => {
  assert.equal(calculateSupplierCnpjCheckDigits('024830880001'), '75');
  assert.equal(calculateSupplierCnpjCheckDigits('00000000E08G'), '12');
  assert.equal(calculateSupplierCnpjCheckDigits('12ABC34501DE'), '35');
  assert.equal(calculateSupplierCnpjCheckDigits('ABC'), null);
});

test('distingue formato estrutural de validade matemática para históricos', () => {
  assert.equal(hasValidSupplierCnpjShape('22.222.222/0001-82'), true);
  assert.equal(isValidSupplierCnpj('22.222.222/0001-82'), false);
  assert.equal(formatSupplierCnpj('00000000E08G12'), '00.000.000/E08G-12');
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

test('recordKey aceita CNPJ alfanumérico oficial', () => {
  assert.equal(
    buildInvoiceRecordKey('00.000.000/E08G-12', '01234'),
    'nf_00000000E08G12_1234'
  );
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
