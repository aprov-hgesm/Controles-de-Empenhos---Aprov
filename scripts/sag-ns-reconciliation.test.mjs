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
const reconciliationSource = readFileSync(resolve(root, 'lib/sagNsReconciliation.ts'), 'utf8');

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

const reconciliationModule = new vm.SourceTextModule(
  transpile(reconciliationSource, 'sagNsReconciliation.ts'),
  {
    context,
    identifier: 'file:///lib/sagNsReconciliation.js',
  }
);
await reconciliationModule.link(async (specifier) => {
  if (specifier === './invoiceIdentity') return identityModule;
  if (specifier === './sagNsContract') return contractModule;
  throw new Error(`Import runtime inesperado na conciliação: ${specifier}`);
});
await reconciliationModule.evaluate();

const { reconcileSagNsPayload } = reconciliationModule.namespace;

const CNPJ_A = '11111111000191';
const CNPJ_B = '22222222000191';

const empenho = (id, cnpj) => ({
  id,
  supplier: cnpj === CNPJ_A ? 'Fornecedor A' : 'Fornecedor B',
  supplierCnpj: cnpj,
  description: 'Objeto',
  date: '2026-01-01',
  status: 'Ativo',
  items: [],
});

const invoice = ({
  id,
  empenhoId,
  cnpj,
  issueDate = '2026-01-10',
  numeroNS,
  nsUg,
  recordKey,
}) => ({
  id,
  empenhoId,
  issueDate,
  items: [],
  totalValue: 100,
  supplier: 'Fornecedor',
  ...(cnpj ? { supplierCnpj: cnpj } : {}),
  ...(numeroNS ? { numeroNS } : {}),
  ...(nsUg ? { nsUg } : {}),
  ...(recordKey ? { recordKey } : {}),
});

const payload = (records, cnpj = CNPJ_A) => ({
  schema_version: 'emprovex_sag_ns_v1',
  source: 'SAG',
  supplier_cnpj: cnpj,
  ug: '160416',
  records,
});

const record = ({
  ns = '2026NS000001',
  nf = '1234',
  nfDate = '2026-01-10',
}) => ({
  ns,
  ns_issue_date: '2026-01-20',
  nf_number_raw: nf,
  nf_issue_date: nfDate,
  observation: nf ? `NF ${nf}` : 'SEM NF',
});

test('concilia zeros à esquerda pelo número normalizado da NF', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '01234' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [invoice({ id: '1234', empenhoId: '2026NE000001', cnpj: CNPJ_A })]
  );

  assert.equal(result.items[0].status, 'matched');
  assert.equal(result.items[0].invoice.invoiceId, '1234');
  assert.equal(result.stats.readyToApply, 1);
});

test('concilia fornecedor com CNPJ alfanumérico oficial', () => {
  const alpha = '00000000E08G12';
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234' })], alpha),
    alpha,
    [empenho('2026NE000ALFA', alpha)],
    [invoice({ id: '1234', empenhoId: '2026NE000ALFA', cnpj: alpha })]
  );

  assert.equal(result.items[0].status, 'matched');
  assert.equal(result.supplierCnpj, alpha);
});

test('rejeita CNPJ selecionado com DV inválido antes da conciliação', () => {
  assert.throws(
    () =>
      reconcileSagNsPayload(
        payload([record({ nf: '1234' })], '22222222000182'),
        '22222222000182',
        [empenho('2026NE000BAD', '22222222000182')],
        [invoice({ id: '1234', empenhoId: '2026NE000BAD', cnpj: '22222222000182' })]
      ),
    /dígitos verificadores/
  );
});

test('isola a conciliação pelo CNPJ selecionado mesmo com NF igual em outro fornecedor', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234' })]),
    CNPJ_A,
    [
      empenho('2026NE000001', CNPJ_A),
      empenho('2026NE000002', CNPJ_B),
    ],
    [
      invoice({ id: '1234', empenhoId: '2026NE000001', cnpj: CNPJ_A }),
      invoice({ id: '1234', empenhoId: '2026NE000002', cnpj: CNPJ_B }),
    ]
  );

  assert.equal(result.items[0].status, 'matched');
  assert.equal(result.items[0].invoice.empenhoId, '2026NE000001');
  assert.equal(result.items[0].candidates.length, 1);
});

test('aceita NF legada sem supplierCnpj quando o empenho pertence ao CNPJ selecionado', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [invoice({ id: '1234', empenhoId: '2026NE000001' })]
  );

  assert.equal(result.items[0].status, 'matched');
});

test('mantém NS sem NF como pendência sem inferência por data', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: null, nfDate: null })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [invoice({ id: '9999', empenhoId: '2026NE000001', cnpj: CNPJ_A, issueDate: '2026-01-10' })]
  );

  assert.equal(result.items[0].status, 'missing_nf_reference');
  assert.equal(result.items[0].invoice, null);
  assert.equal(result.stats.missingReference, 1);
});

test('classifica NF inexistente no CNPJ como not_found', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '7777' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [invoice({ id: '1234', empenhoId: '2026NE000001', cnpj: CNPJ_A })]
  );

  assert.equal(result.items[0].status, 'not_found');
  assert.equal(result.stats.notFound, 1);
});

test('não usa data para desempatar números de NF duplicados', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234', nfDate: '2026-01-10' })]),
    CNPJ_A,
    [
      empenho('2026NE000001', CNPJ_A),
      empenho('2026NE000002', CNPJ_A),
    ],
    [
      invoice({
        id: '1234',
        empenhoId: '2026NE000001',
        cnpj: CNPJ_A,
        issueDate: '2026-01-10',
        recordKey: 'nf_a_1234_1',
      }),
      invoice({
        id: '01234',
        empenhoId: '2026NE000002',
        cnpj: CNPJ_A,
        issueDate: '2026-02-10',
        recordKey: 'nf_a_1234_2',
      }),
    ]
  );

  assert.equal(result.items[0].status, 'ambiguous_invoice');
  assert.equal(result.items[0].candidates.length, 2);
  assert.equal(result.stats.ambiguous, 1);
});

test('reconhece NS idêntica já cadastrada como already_registered', () => {
  const result = reconcileSagNsPayload(
    payload([record({ ns: '2026NS000123', nf: '1234' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [
      invoice({
        id: '1234',
        empenhoId: '2026NE000001',
        cnpj: CNPJ_A,
        numeroNS: '2026 NS 000123',
        nsUg: '160416',
      }),
    ]
  );

  assert.equal(result.items[0].status, 'already_registered');
  assert.equal(result.stats.alreadyRegistered, 1);
  assert.equal(result.stats.readyToApply, 0);
});

test('bloqueia quando a NF já possui NS diferente', () => {
  const result = reconcileSagNsPayload(
    payload([record({ ns: '2026NS000123', nf: '1234' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [
      invoice({
        id: '1234',
        empenhoId: '2026NE000001',
        cnpj: CNPJ_A,
        numeroNS: '2026NS000999',
      }),
    ]
  );

  assert.equal(result.items[0].status, 'conflict_existing_ns');
  assert.equal(result.stats.conflicts, 1);
  assert.equal(
    result.items[0].issues.some((item) => item.code === 'invoice_has_different_ns'),
    true
  );
});

test('bloqueia reutilização da mesma NS em outra NF do fornecedor', () => {
  const result = reconcileSagNsPayload(
    payload([record({ ns: '2026NS000123', nf: '1234' })]),
    CNPJ_A,
    [
      empenho('2026NE000001', CNPJ_A),
      empenho('2026NE000002', CNPJ_A),
    ],
    [
      invoice({ id: '1234', empenhoId: '2026NE000001', cnpj: CNPJ_A }),
      invoice({
        id: '9999',
        empenhoId: '2026NE000002',
        cnpj: CNPJ_A,
        numeroNS: '2026NS000123',
      }),
    ]
  );

  assert.equal(result.items[0].status, 'conflict_ns_reused');
  assert.equal(result.stats.conflicts, 1);
});

test('divergência de data gera alerta mas não desfaz correspondência determinística', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234', nfDate: '2026-01-11' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [
      invoice({
        id: '1234',
        empenhoId: '2026NE000001',
        cnpj: CNPJ_A,
        issueDate: '2026-01-10',
      }),
    ]
  );

  assert.equal(result.items[0].status, 'matched');
  assert.equal(
    result.items[0].issues.some((item) => item.code === 'nf_issue_date_mismatch'),
    true
  );
});

test('bloqueia inconsistência quando NF ligada ao empenho tem CNPJ divergente', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [invoice({ id: '1234', empenhoId: '2026NE000001', cnpj: CNPJ_B })]
  );

  assert.equal(result.items[0].status, 'data_conflict');
  assert.equal(result.stats.conflicts, 1);
});

test('rejeita payload de CNPJ diferente antes de qualquer conciliação', () => {
  assert.throws(
    () =>
      reconcileSagNsPayload(
        payload([record({ nf: '1234' })], CNPJ_B),
        CNPJ_A,
        [empenho('2026NE000001', CNPJ_A)],
        [invoice({ id: '1234', empenhoId: '2026NE000001', cnpj: CNPJ_A })]
      ),
    /não corresponde/
  );
});


test('permite o mesmo número de NS em UG diferente', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234', ns: '2026NS000777' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [
      invoice({ id: '1234', empenhoId: '2026NE000001', cnpj: CNPJ_A }),
      invoice({
        id: '9999',
        empenhoId: '2026NE000001',
        cnpj: CNPJ_A,
        numeroNS: '2026NS000777',
        nsUg: '160415',
      }),
    ]
  );

  assert.equal(result.ug, '160416');
  assert.equal(result.items[0].status, 'matched');
});

test('bloqueia a mesma identidade UG + NS já usada em outra NF', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234', ns: '2026NS000778' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [
      invoice({ id: '1234', empenhoId: '2026NE000001', cnpj: CNPJ_A }),
      invoice({
        id: '9999',
        empenhoId: '2026NE000001',
        cnpj: CNPJ_A,
        numeroNS: '2026NS000778',
        nsUg: '160416',
      }),
    ]
  );

  assert.equal(result.items[0].status, 'conflict_ns_reused');
});

test('trata NS legada na NF alvo como migração quando o SAG informa UG', () => {
  const result = reconcileSagNsPayload(
    payload([record({ nf: '1234', ns: '2026NS000779' })]),
    CNPJ_A,
    [empenho('2026NE000001', CNPJ_A)],
    [
      invoice({
        id: '1234',
        empenhoId: '2026NE000001',
        cnpj: CNPJ_A,
        numeroNS: '2026NS000779',
      }),
    ]
  );

  assert.equal(result.items[0].status, 'matched');
  assert.equal(result.items[0].invoice.currentUg, null);
  assert.equal(result.items[0].issues.some((issue) => issue.code === 'legacy_ns_missing_ug'), true);
});
