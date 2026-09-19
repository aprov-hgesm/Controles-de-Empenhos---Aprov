#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const identitySource = readFileSync(resolve(root, 'lib/invoiceIdentity.ts'), 'utf8');
const supplierSource = readFileSync(resolve(root, 'lib/supplierReporting.ts'), 'utf8');

const transpile = (source, filename) => ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: filename,
}).outputText;

const context = vm.createContext({ console, encodeURIComponent });
const identityModule = new vm.SourceTextModule(transpile(identitySource, 'invoiceIdentity.ts'), {
  context,
  identifier: 'file:///lib/invoiceIdentity.js',
});
await identityModule.link(() => {
  throw new Error('invoiceIdentity.ts não deve possuir import runtime.');
});
await identityModule.evaluate();

const supplierModule = new vm.SourceTextModule(transpile(supplierSource, 'supplierReporting.ts'), {
  context,
  identifier: 'file:///lib/supplierReporting.js',
});
await supplierModule.link(async (specifier) => {
  if (specifier === './invoiceIdentity') return identityModule;
  throw new Error(`Import runtime inesperado: ${specifier}`);
});
await supplierModule.evaluate();

const { buildSupplierReports } = supplierModule.namespace;

const empenho = (id, cnpj, supplier, pregao, committed = 100) => ({
  id,
  supplier,
  supplierCnpj: cnpj,
  description: 'Objeto',
  date: '2026-01-01',
  status: 'Ativo',
  pregao,
  items: [{ id: '1', name: 'Item', unit: 'UN', quantity: 1, unitPrice: committed, received: 0 }],
});

const invoice = (id, empenhoId, totalValue, numeroNS) => ({
  id,
  empenhoId,
  issueDate: '2026-02-01',
  items: [],
  totalValue,
  supplier: 'Fornecedor',
  ...(numeroNS ? { numeroNS } : {}),
});

test('agrega vários empenhos e pregões do mesmo CNPJ', () => {
  const reports = buildSupplierReports(
    [
      empenho('2026NE000001', '02.483.088/0001-75', 'Fornecedor A', '90001/2026', 100),
      empenho('2026NE000002', '02483088000175', 'Fornecedor A', '90002/2026', 200),
    ],
    [
      invoice('10', '2026NE000001', 70, '2026NS000001'),
      invoice('11', '2026NE000002', 50),
    ]
  );

  assert.equal(reports.length, 1);
  assert.equal(reports[0].cnpj, '02483088000175');
  assert.equal(reports[0].empenhos.length, 2);
  assert.equal(reports[0].pregoes.length, 2);
  assert.equal(reports[0].totalCommitted, 300);
  assert.equal(reports[0].totalReceived, 120);
  assert.equal(reports[0].balance, 180);
  assert.equal(reports[0].invoicesWithNs, 1);
  assert.equal(reports[0].invoicesWithoutNs, 1);
  assert.equal(reports[0].nsCoverage, 50);
});

test('vincula NF ao fornecedor pelo empenhoId mesmo sem CNPJ na NF', () => {
  const reports = buildSupplierReports(
    [empenho('2026NE000010', '11111111000191', 'Fornecedor B', '90003/2026')],
    [invoice('1234', '2026NE000010', 40, '2026NS000010')]
  );

  assert.equal(reports[0].invoiceCount, 1);
  assert.equal(reports[0].empenhos[0].invoices[0].id, '1234');
});

test('mantém CNPJs diferentes separados mesmo com NFs de mesmo número', () => {
  const reports = buildSupplierReports(
    [
      empenho('2026NE000020', '11111111000191', 'Fornecedor B', '90003/2026'),
      empenho('2026NE000021', '22222222000182', 'Fornecedor C', '90003/2026'),
    ],
    [
      invoice('1234', '2026NE000020', 30),
      invoice('1234', '2026NE000021', 60),
    ]
  );

  assert.equal(reports.length, 2);
  assert.equal(reports[0].invoiceCount, 1);
  assert.equal(reports[1].invoiceCount, 1);
});

test('mantém aliases quando o mesmo CNPJ possui grafias diferentes de razão social', () => {
  const reports = buildSupplierReports(
    [
      empenho('2026NE000030', '33333333000173', 'Empresa Exemplo LTDA', '90004/2026'),
      empenho('2026NE000031', '33333333000173', 'EMPRESA EXEMPLO LTDA', '90004/2026'),
    ],
    []
  );

  assert.equal(reports[0].aliases.length, 2);
  assert.equal(reports[0].pregoes[0].empenhos.length, 2);
});

test('ignora empenhos sem CNPJ na consolidação por fornecedor', () => {
  const reports = buildSupplierReports(
    [empenho('2026NE000040', undefined, 'Sem CNPJ', '90005/2026')],
    []
  );
  assert.equal(reports.length, 0);
});
