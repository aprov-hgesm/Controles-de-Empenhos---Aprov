#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const identitySource = readFileSync(resolve(root, 'lib/invoiceIdentity.ts'), 'utf8');
const migrationSource = readFileSync(resolve(root, 'lib/supplierCnpjMigration.ts'), 'utf8');

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

const migrationModule = new vm.SourceTextModule(transpile(migrationSource, 'supplierCnpjMigration.ts'), {
  context,
  identifier: 'file:///lib/supplierCnpjMigration.js',
});
await migrationModule.link(async (specifier) => {
  if (specifier === './invoiceIdentity') return identityModule;
  throw new Error(`Import runtime inesperado: ${specifier}`);
});
await migrationModule.evaluate();

const { buildSupplierCnpjMigrationPlan } = migrationModule.namespace;

const OLD = '11111111000191';
const NEXT = '22222222000182';

const empenho = (cnpj = OLD) => ({
  id: '2026NE000001',
  supplier: 'Fornecedor',
  supplierCnpj: cnpj || undefined,
  description: 'Objeto',
  date: '01/01/2026',
  status: 'Ativo',
  items: [],
});

const invoice = ({
  id = '1234',
  cnpj = OLD,
  recordKey = `nf_${cnpj}_1234`,
  ns,
} = {}) => ({
  id,
  empenhoId: '2026NE000001',
  issueDate: '2026-01-10',
  items: [],
  totalValue: 100,
  supplier: 'Fornecedor',
  supplierCnpj: cnpj || undefined,
  recordKey,
  ...(ns ? { numeroNS: ns } : {}),
});

test('migra CNPJ, supplierCnpj e recordKey de todas as NFs', () => {
  const plan = buildSupplierCnpjMigrationPlan(
    empenho(),
    [
      invoice(),
      invoice({ id: '5678', recordKey: `nf_${OLD}_5678` }),
    ],
    NEXT
  );

  assert.equal(plan.updatedEmpenho.supplierCnpj, NEXT);
  assert.equal(plan.items.length, 2);
  assert.equal(plan.items[0].targetRecordKey, `nf_${NEXT}_1234`);
  assert.equal(plan.items[0].updatedInvoice.supplierCnpj, NEXT);
  assert.equal(plan.items[1].targetRecordKey, `nf_${NEXT}_5678`);
  assert.equal(plan.isNoOp, false);
});

test('aceita NF legada sem CNPJ quando o empenho possui o CNPJ de origem', () => {
  const plan = buildSupplierCnpjMigrationPlan(
    empenho(),
    [invoice({ cnpj: '', recordKey: '1234' })],
    NEXT
  );
  assert.equal(plan.items[0].targetRecordKey, `nf_${NEXT}_1234`);
  assert.equal(plan.items[0].updatedInvoice.supplierCnpj, NEXT);
});

test('bloqueia NF com CNPJ divergente do empenho atual', () => {
  assert.throws(
    () => buildSupplierCnpjMigrationPlan(
      empenho(),
      [invoice({ cnpj: NEXT, recordKey: `nf_${NEXT}_1234` })],
      '33333333000173'
    ),
    (error) => error?.code === 'invoice_supplier_conflict'
  );
});

test('bloqueia remoção do CNPJ quando existem NFs vinculadas', () => {
  assert.throws(
    () => buildSupplierCnpjMigrationPlan(empenho(), [invoice()], ''),
    (error) => error?.code === 'cannot_remove_with_invoices'
  );
});

test('permite remover CNPJ quando não existem NFs vinculadas', () => {
  const plan = buildSupplierCnpjMigrationPlan(empenho(), [], '');
  assert.equal(plan.updatedEmpenho.supplierCnpj, undefined);
  assert.equal(plan.items.length, 0);
});

test('bloqueia duas NFs que resultariam na mesma identidade alvo', () => {
  assert.throws(
    () => buildSupplierCnpjMigrationPlan(
      empenho(),
      [
        invoice({ id: '1234', recordKey: 'legacy-a' }),
        invoice({ id: '001234', recordKey: 'legacy-b' }),
      ],
      NEXT
    ),
    (error) => error?.code === 'duplicate_target_identity'
  );
});

test('mesmo CNPJ com identidades já canônicas é no-op', () => {
  const plan = buildSupplierCnpjMigrationPlan(
    empenho(OLD),
    [invoice()],
    OLD
  );
  assert.equal(plan.isNoOp, true);
});

test('mesmo CNPJ corrige recordKey legado em vez de assumir no-op', () => {
  const plan = buildSupplierCnpjMigrationPlan(
    empenho(OLD),
    [invoice({ recordKey: '1234' })],
    OLD
  );
  assert.equal(plan.isNoOp, false);
  assert.equal(plan.items[0].targetRecordKey, `nf_${OLD}_1234`);
});
