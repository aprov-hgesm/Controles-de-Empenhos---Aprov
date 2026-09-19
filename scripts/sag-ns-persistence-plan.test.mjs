#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const identitySource = readFileSync(resolve(root, 'lib/invoiceIdentity.ts'), 'utf8');
const contractSource = readFileSync(resolve(root, 'lib/sagNsContract.ts'), 'utf8');
const integritySource = readFileSync(resolve(root, 'lib/nsIntegrity.ts'), 'utf8');
const planSource = readFileSync(resolve(root, 'lib/sagNsPersistencePlan.ts'), 'utf8');

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

const contractModule = new vm.SourceTextModule(transpile(contractSource, 'sagNsContract.ts'), {
  context,
  identifier: 'file:///lib/sagNsContract.js',
});
await contractModule.link(async (specifier) => {
  if (specifier === './invoiceIdentity') return identityModule;
  throw new Error(`Import runtime inesperado no contrato: ${specifier}`);
});
await contractModule.evaluate();

const integrityModule = new vm.SourceTextModule(transpile(integritySource, 'nsIntegrity.ts'), {
  context,
  identifier: 'file:///lib/nsIntegrity.js',
});
await integrityModule.link(async (specifier) => {
  if (specifier === './invoiceIdentity') return identityModule;
  throw new Error(`Import runtime inesperado em nsIntegrity: ${specifier}`);
});
await integrityModule.evaluate();

const planModule = new vm.SourceTextModule(transpile(planSource, 'sagNsPersistencePlan.ts'), {
  context,
  identifier: 'file:///lib/sagNsPersistencePlan.js',
});
await planModule.link(async (specifier) => {
  if (specifier === './nsIntegrity') return integrityModule;
  if (specifier === './sagNsContract') return contractModule;
  throw new Error(`Import runtime inesperado no plano de persistência: ${specifier}`);
});
await planModule.evaluate();

const {
  buildSagNsLockDocumentId,
  buildSagNsPersistenceChanges,
  validateSagNsPersistenceSnapshot,
} = planModule.namespace;

const CNPJ = '11111111000191';
const OTHER_CNPJ = '22222222000191';

const empenho = (id = '2026NE000001', cnpj = CNPJ) => ({
  id,
  supplier: 'Fornecedor',
  supplierCnpj: cnpj,
  description: 'Objeto',
  date: '2026-01-01',
  status: 'Ativo',
  items: [],
});

const invoice = ({
  id = '1234',
  recordKey = 'nf_11111111000191_1234',
  empenhoId = '2026NE000001',
  cnpj = CNPJ,
  numeroNS,
} = {}) => ({
  id,
  recordKey,
  empenhoId,
  issueDate: '2026-01-10',
  items: [],
  totalValue: 100,
  supplier: 'Fornecedor',
  supplierCnpj: cnpj,
  ...(numeroNS ? { numeroNS } : {}),
});

const change = ({
  recordKey = 'nf_11111111000191_1234',
  id = '1234',
  empenhoId = '2026NE000001',
  expectedCurrentNs = null,
  proposedNs = '2026NS000001',
} = {}) => ({
  invoiceRecordKey: recordKey,
  invoiceId: id,
  empenhoId,
  expectedCurrentNs,
  proposedNs,
});

const doc = (storedInvoice) => ({
  recordKey: storedInvoice.recordKey,
  invoice: storedInvoice,
});

const validate = ({
  changes = [change()],
  targets = [doc(invoice())],
  scope = targets,
  empenhos = [empenho()],
  supplierCnpj = CNPJ,
} = {}) =>
  validateSagNsPersistenceSnapshot({
    supplierCnpj,
    changes,
    targetInvoiceDocuments: targets,
    scopedInvoiceDocuments: scope,
    empenhos,
  });

test('gera identidade determinística e segura para lock de NS', () => {
  assert.equal(
    buildSagNsLockDocumentId(' 2026 ns 000001 '),
    'sagNsLock_2026NS000001'
  );
  assert.equal(buildSagNsLockDocumentId(''), '');
});

test('gera alterações somente a partir de linhas ALTERAR da prévia', () => {
  const changes = buildSagNsPersistenceChanges({
    supplierCnpj: CNPJ,
    stats: { total: 2, changes: 1, unchanged: 1, ignored: 0, blocked: 0, warningItems: 0 },
    canAdvanceToPersistenceReview: true,
    items: [
      {
        decision: 'change',
        reconciliationStatus: 'matched',
        ns: '2026NS000001',
        nfNumberRaw: '1234',
        invoiceId: '1234',
        invoiceRecordKey: 'nf_11111111000191_1234',
        empenhoId: '2026NE000001',
        currentNs: null,
        proposedNs: '2026NS000001',
        summary: '',
        warnings: [],
        blockers: [],
      },
      {
        decision: 'unchanged',
        reconciliationStatus: 'already_registered',
        ns: '2026NS000002',
        nfNumberRaw: '1235',
        invoiceId: '1235',
        invoiceRecordKey: 'nf_11111111000191_1235',
        empenhoId: '2026NE000001',
        currentNs: '2026NS000002',
        proposedNs: null,
        summary: '',
        warnings: [],
        blockers: [],
      },
    ],
  });

  assert.equal(changes.length, 1);
  assert.equal(changes[0].proposedNs, '2026NS000001');
  assert.equal(changes[0].expectedCurrentNs, null);
});

test('autoriza escrita quando identidade, CNPJ e NS atual continuam iguais à prévia', () => {
  const result = validate();
  assert.equal(result.writes.length, 1);
  assert.equal(result.alreadyApplied.length, 0);
});

test('segunda aplicação da mesma NS é idempotente e vira no-op', () => {
  const stored = invoice({ numeroNS: '2026 NS 000001' });
  const result = validate({
    targets: [doc(stored)],
    scope: [doc(stored)],
  });

  assert.equal(result.writes.length, 0);
  assert.equal(result.alreadyApplied.length, 1);
});

test('bloqueia se a NF recebeu outra NS depois da prévia', () => {
  const stored = invoice({ numeroNS: '2026NS999999' });
  assert.throws(
    () => validate({ targets: [doc(stored)], scope: [doc(stored)] }),
    (error) => error?.code === 'stale_invoice_ns'
  );
});

test('bloqueia se a NS proposta já pertence a outra NF do mesmo fornecedor', () => {
  const target = invoice();
  const other = invoice({
    id: '9999',
    recordKey: 'nf_11111111000191_9999',
    numeroNS: '2026NS000001',
  });

  assert.throws(
    () => validate({
      targets: [doc(target)],
      scope: [doc(target), doc(other)],
    }),
    (error) => error?.code === 'ns_reused_in_scope'
  );
});

test('bloqueia quando o empenho mudou de CNPJ desde a prévia', () => {
  assert.throws(
    () => validate({ empenhos: [empenho('2026NE000001', OTHER_CNPJ)] }),
    (error) => error?.code === 'supplier_scope_changed'
  );
});

test('bloqueia CNPJ divergente gravado diretamente na NF', () => {
  const stored = invoice({ cnpj: OTHER_CNPJ });
  assert.throws(
    () => validate({ targets: [doc(stored)], scope: [doc(stored)] }),
    (error) => error?.code === 'invoice_supplier_conflict'
  );
});

test('bloqueia se NF ou vínculo com NE mudou desde a prévia', () => {
  const stored = invoice({ empenhoId: '2026NE000999' });
  assert.throws(
    () => validate({ targets: [doc(stored)], scope: [doc(stored)] }),
    (error) => error?.code === 'invoice_identity_changed'
  );
});

test('bloqueia NF excluída antes da confirmação', () => {
  assert.throws(
    () => validate({ targets: [], scope: [] }),
    (error) => error?.code === 'invoice_missing'
  );
});

test('bloqueia a mesma NS proposta para duas NFs no mesmo lote', () => {
  const secondChange = change({
    recordKey: 'nf_11111111000191_1235',
    id: '1235',
    proposedNs: '2026NS000001',
  });
  assert.throws(
    () => validate({ changes: [change(), secondChange] }),
    (error) => error?.code === 'duplicate_ns_in_batch'
  );
});
