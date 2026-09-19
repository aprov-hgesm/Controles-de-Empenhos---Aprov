#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(resolve(process.cwd(), 'lib/reportingPeriod.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'reportingPeriod.ts',
}).outputText;

const context = vm.createContext({ console });
const module = new vm.SourceTextModule(transpiled, {
  context,
  identifier: 'file:///lib/reportingPeriod.js',
});
await module.link(() => {
  throw new Error('reportingPeriod.ts não deve possuir import runtime.');
});
await module.evaluate();

const {
  normalizeOperationalDate,
  isReportingPeriodValid,
  invoiceMatchesReportingPeriod,
  filterInvoicesByReportingPeriod,
  formatReportingPeriodLabel,
} = module.namespace;

const invoice = (issueDate) => ({ issueDate });

test('normaliza data ISO, ISO timestamp e data brasileira', () => {
  assert.equal(normalizeOperationalDate('2026-09-18'), '2026-09-18');
  assert.equal(normalizeOperationalDate('2026-09-18T13:45:00.000Z'), '2026-09-18');
  assert.equal(normalizeOperationalDate('18/09/2026'), '2026-09-18');
  assert.equal(normalizeOperationalDate('18-09-2026'), '');
});

test('período é inclusivo nas duas extremidades', () => {
  const period = { startDate: '2026-01-10', endDate: '2026-01-20' };
  assert.equal(invoiceMatchesReportingPeriod(invoice('2026-01-10'), period), true);
  assert.equal(invoiceMatchesReportingPeriod(invoice('2026-01-20'), period), true);
  assert.equal(invoiceMatchesReportingPeriod(invoice('2026-01-09'), period), false);
  assert.equal(invoiceMatchesReportingPeriod(invoice('2026-01-21'), period), false);
});

test('permite filtro apenas inicial ou final', () => {
  assert.equal(invoiceMatchesReportingPeriod(invoice('2026-03-05'), { startDate: '2026-03-01' }), true);
  assert.equal(invoiceMatchesReportingPeriod(invoice('2026-02-28'), { startDate: '2026-03-01' }), false);
  assert.equal(invoiceMatchesReportingPeriod(invoice('2026-03-05'), { endDate: '2026-03-10' }), true);
  assert.equal(invoiceMatchesReportingPeriod(invoice('2026-03-11'), { endDate: '2026-03-10' }), false);
});

test('período invertido é inválido e não retorna notas', () => {
  const period = { startDate: '2026-05-20', endDate: '2026-05-01' };
  assert.equal(isReportingPeriodValid(period), false);
  assert.deepEqual(filterInvoicesByReportingPeriod([invoice('2026-05-10')], period), []);
  assert.equal(formatReportingPeriodLabel(period), 'Período inválido');
});

test('sem datas mantém todas as notas', () => {
  const list = [invoice('2026-01-01'), invoice('2026-02-01')];
  assert.equal(filterInvoicesByReportingPeriod(list, {}).length, 2);
  assert.equal(formatReportingPeriodLabel({}), 'Todo o período');
});
