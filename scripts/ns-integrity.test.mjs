#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const identitySource = readFileSync(resolve(root, 'lib/invoiceIdentity.ts'), 'utf8');
const integritySource = readFileSync(resolve(root, 'lib/nsIntegrity.ts'), 'utf8');

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

const integrityModule = new vm.SourceTextModule(transpile(integritySource, 'nsIntegrity.ts'), {
  context,
  identifier: 'file:///lib/nsIntegrity.js',
});
await integrityModule.link(async (specifier) => {
  if (specifier === './invoiceIdentity') return identityModule;
  throw new Error(`Import runtime inesperado em nsIntegrity: ${specifier}`);
});
await integrityModule.evaluate();

const {
  assertNsLockOwnership,
  buildNsLockDocument,
  buildNsLockDocumentId,
  isValidNsNumber,
  normalizeNsNumber,
  validateNsIntegritySnapshot,
} = integrityModule.namespace;

const CNPJ = '11111111000191';
const OTHER_CNPJ = '22222222000182';

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

const mutation = ({
  recordKey = 'nf_11111111000191_1234',
  id = '1234',
  empenhoId = '2026NE000001',
  cnpj = CNPJ,
  expectedCurrentNs = null,
  proposedNs = '2026NS000001',
  source = 'sag',
} = {}) => ({
  invoiceRecordKey: recordKey,
  invoiceId: id,
  empenhoId,
  supplierCnpj: cnpj,
  expectedCurrentNs,
  proposedNs,
  source,
});

const doc = (storedInvoice) => ({
  recordKey: storedInvoice.recordKey,
  invoice: storedInvoice,
});

const validate = ({
  mutations = [mutation()],
  targets = [doc(invoice())],
  owners = targets,
  empenhos = [empenho()],
} = {}) =>
  validateNsIntegritySnapshot({
    mutations,
    targetInvoiceDocuments: targets,
    knownOwnerInvoiceDocuments: owners,
    empenhos,
  });

test('normaliza e valida o formato canônico da NS', () => {
  assert.equal(normalizeNsNumber(' 2026 ns 000001 '), '2026NS000001');
  assert.equal(isValidNsNumber('2026 NS 000001'), true);
  assert.equal(isValidNsNumber('NS000001'), false);
});

test('mantém o lock físico legado determinístico no Bloco 1', () => {
  assert.equal(
    buildNsLockDocumentId(' 2026 ns 000001 '),
    'sagNsLock_2026NS000001'
  );
});

test('atribuição nova produz write', () => {
  const result = validate();
  assert.equal(result.writes.length, 1);
  assert.equal(result.noOps.length, 0);
});

test('reaplicar a mesma NS é no-op idempotente', () => {
  const stored = invoice({ numeroNS: '2026 NS 000001' });
  const result = validate({
    targets: [doc(stored)],
    owners: [doc(stored)],
  });
  assert.equal(result.writes.length, 0);
  assert.equal(result.noOps.length, 1);
});

test('troca de NS é aceita quando a NS atual coincide com o estado esperado', () => {
  const stored = invoice({ numeroNS: '2026NS000010' });
  const result = validate({
    mutations: [mutation({
      expectedCurrentNs: '2026NS000010',
      proposedNs: '2026NS000011',
      source: 'manual',
    })],
    targets: [doc(stored)],
    owners: [doc(stored)],
  });
  assert.equal(result.writes.length, 1);
});

test('remoção de NS é representada por proposedNs null', () => {
  const stored = invoice({ numeroNS: '2026NS000010' });
  const result = validate({
    mutations: [mutation({
      expectedCurrentNs: '2026NS000010',
      proposedNs: null,
      source: 'manual',
    })],
    targets: [doc(stored)],
    owners: [doc(stored)],
  });
  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].proposedNs, null);
});

test('remoção de NF já sem NS é no-op', () => {
  const result = validate({
    mutations: [mutation({ proposedNs: null, source: 'manual' })],
  });
  assert.equal(result.writes.length, 0);
  assert.equal(result.noOps.length, 1);
});

test('bloqueia duas mutações para a mesma NF no mesmo lote', () => {
  assert.throws(
    () => validate({
      mutations: [
        mutation(),
        mutation({ proposedNs: '2026NS000002' }),
      ],
    }),
    (error) => error?.code === 'duplicate_invoice_target'
  );
});

test('bloqueia a mesma NS proposta para duas NFs', () => {
  const secondInvoice = invoice({
    id: '1235',
    recordKey: 'nf_11111111000191_1235',
  });
  assert.throws(
    () => validate({
      mutations: [
        mutation(),
        mutation({
          id: '1235',
          recordKey: 'nf_11111111000191_1235',
        }),
      ],
      targets: [doc(invoice()), doc(secondInvoice)],
      owners: [doc(invoice()), doc(secondInvoice)],
    }),
    (error) => error?.code === 'duplicate_ns_in_batch'
  );
});

test('bloqueia NS já pertencente a outra NF conhecida', () => {
  const other = invoice({
    id: '9999',
    recordKey: 'nf_11111111000191_9999',
    numeroNS: '2026NS000001',
  });
  assert.throws(
    () => validate({
      owners: [doc(invoice()), doc(other)],
    }),
    (error) => error?.code === 'ns_reused_in_scope'
  );
});

test('bloqueia alteração concorrente da NS atual', () => {
  const stored = invoice({ numeroNS: '2026NS999999' });
  assert.throws(
    () => validate({
      targets: [doc(stored)],
      owners: [doc(stored)],
    }),
    (error) => error?.code === 'stale_invoice_ns'
  );
});

test('bloqueia CNPJ divergente entre empenho e mutação', () => {
  assert.throws(
    () => validate({
      empenhos: [empenho('2026NE000001', OTHER_CNPJ)],
    }),
    (error) => error?.code === 'supplier_scope_changed'
  );
});

test('bloqueia identidade de NF modificada', () => {
  const stored = invoice({ empenhoId: '2026NE000099' });
  assert.throws(
    () => validate({
      targets: [doc(stored)],
      owners: [doc(stored)],
    }),
    (error) => error?.code === 'invoice_identity_changed'
  );
});

test('constrói lock canônico com proprietário e UID responsáveis', () => {
  const item = mutation();
  const lock = buildNsLockDocument({
    workspaceId: 'workspace-a',
    mutation: item,
    userId: 'uid-a',
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
  });

  assert.equal(lock.id, 'sagNsLock_2026NS000001');
  assert.equal(lock.type, 'sag-ns-lock');
  assert.equal(lock.invoiceRecordKey, item.invoiceRecordKey);
  assert.equal(lock.updatedBy, 'uid-a');
});

test('validação de lock bloqueia proprietário diferente', () => {
  assert.throws(
    () =>
      assertNsLockOwnership(
        {
          numeroNS: '2026NS000001',
          invoiceRecordKey: 'nf_11111111000191_9999',
        },
        mutation(),
        '2026NS000001',
        'ns_lock_conflict'
      ),
    (error) => error?.code === 'ns_lock_conflict'
  );
});
