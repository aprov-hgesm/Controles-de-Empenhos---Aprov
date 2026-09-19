#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const previewSource = readFileSync(resolve(root, 'lib/sagNsApplicationPreview.ts'), 'utf8');

const transpile = (source, filename) => ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: filename,
}).outputText;

const context = vm.createContext({ console });

const previewModule = new vm.SourceTextModule(transpile(previewSource, 'sagNsApplicationPreview.ts'), {
  context,
  identifier: 'file:///lib/sagNsApplicationPreview.js',
});
await previewModule.link(() => {
  throw new Error('sagNsApplicationPreview.ts não deve possuir imports runtime.');
});
await previewModule.evaluate();

const { buildSagNsApplicationPreview } = previewModule.namespace;

const baseRecord = (ns, nf = '1234') => ({
  ns,
  ns_issue_date: '2026-01-20',
  nf_number_raw: nf,
  nf_issue_date: '2026-01-10',
  observation: 'NF',
});

const invoiceRef = (invoiceId, empenhoId, currentNs = null, currentUg = null) => ({
  invoiceId,
  invoiceRecordKey: `nf_key_${invoiceId}`,
  empenhoId,
  issueDate: '2026-01-10',
  currentUg,
  currentNs,
});

const item = ({
  status,
  ns,
  nf = '1234',
  invoice = null,
  candidates = [],
  issues = [],
}) => ({
  record: baseRecord(ns, nf),
  status,
  invoice,
  candidates,
  issues,
});

const result = (items, ug = '160416') => ({
  supplierCnpj: '11111111000191',
  ug,
  items,
  stats: {
    total: items.length,
    matched: 0,
    alreadyRegistered: 0,
    conflicts: 0,
    ambiguous: 0,
    notFound: 0,
    missingReference: 0,
    readyToApply: 0,
  },
});

test('transforma correspondência segura em alteração proposta', () => {
  const preview = buildSagNsApplicationPreview(result([
    item({
      status: 'matched',
      ns: '2026NS000001',
      invoice: invoiceRef('1234', '2026NE000001'),
    }),
  ]));

  assert.equal(preview.items[0].decision, 'change');
  assert.equal(preview.items[0].currentUg, null);
  assert.equal(preview.items[0].currentNs, null);
  assert.equal(preview.items[0].proposedUg, '160416');
  assert.equal(preview.items[0].proposedNs, '2026NS000001');
  assert.equal(preview.stats.changes, 1);
  assert.equal(preview.canAdvanceToPersistenceReview, true);
});

test('marca NS idêntica já cadastrada como sem alteração', () => {
  const preview = buildSagNsApplicationPreview(result([
    item({
      status: 'already_registered',
      ns: '2026NS000010',
      invoice: invoiceRef('1234', '2026NE000001', '2026NS000010'),
    }),
  ]));

  assert.equal(preview.items[0].decision, 'unchanged');
  assert.equal(preview.items[0].proposedNs, null);
  assert.equal(preview.stats.unchanged, 1);
  assert.equal(preview.canAdvanceToPersistenceReview, false);
});

test('ignora NS sem NF explícita e NF não encontrada', () => {
  const preview = buildSagNsApplicationPreview(result([
    item({
      status: 'missing_nf_reference',
      ns: '2026NS000020',
      nf: null,
      issues: [{ severity: 'warning', code: 'missing_nf_reference', message: 'Sem NF.' }],
    }),
    item({
      status: 'not_found',
      ns: '2026NS000021',
      nf: '9999',
      issues: [{ severity: 'warning', code: 'invoice_not_found', message: 'NF ausente.' }],
    }),
  ]));

  assert.equal(preview.items[0].decision, 'ignored');
  assert.equal(preview.items[1].decision, 'ignored');
  assert.equal(preview.stats.ignored, 2);
  assert.equal(preview.stats.warningItems, 2);
});

test('bloqueia ambiguidades e conflitos', () => {
  const preview = buildSagNsApplicationPreview(result([
    item({
      status: 'ambiguous_invoice',
      ns: '2026NS000030',
      nf: '1234',
      issues: [{ severity: 'blocker', code: 'ambiguous', message: 'Duplicidade.' }],
    }),
    item({
      status: 'conflict_existing_ns',
      ns: '2026NS000031',
      invoice: invoiceRef('1235', '2026NE000001', '2026NS999999'),
      issues: [{ severity: 'blocker', code: 'existing', message: 'NS diferente.' }],
    }),
    item({
      status: 'conflict_ns_reused',
      ns: '2026NS000032',
      invoice: invoiceRef('1236', '2026NE000001'),
      issues: [{ severity: 'blocker', code: 'reused', message: 'NS reutilizada.' }],
    }),
    item({
      status: 'data_conflict',
      ns: '2026NS000033',
      issues: [{ severity: 'blocker', code: 'cnpj', message: 'CNPJ divergente.' }],
    }),
  ]));

  assert.equal(preview.stats.blocked, 4);
  assert.equal(preview.canAdvanceToPersistenceReview, false);
  assert.equal(preview.items.every((entry) => entry.decision === 'blocked'), true);
});

test('preserva alertas de data em alteração proposta', () => {
  const preview = buildSagNsApplicationPreview(result([
    item({
      status: 'matched',
      ns: '2026NS000040',
      invoice: invoiceRef('1234', '2026NE000001'),
      issues: [{ severity: 'warning', code: 'date', message: 'Data divergente.' }],
    }),
  ]));

  assert.equal(preview.items[0].decision, 'change');
  assert.deepEqual(Array.from(preview.items[0].warnings), ['Data divergente.']);
  assert.equal(preview.stats.warningItems, 1);
});

test('um lote com alterações e sem bloqueios pode avançar para revisão de persistência', () => {
  const preview = buildSagNsApplicationPreview(result([
    item({
      status: 'matched',
      ns: '2026NS000050',
      invoice: invoiceRef('1234', '2026NE000001'),
    }),
    item({
      status: 'already_registered',
      ns: '2026NS000051',
      invoice: invoiceRef('1235', '2026NE000001', '2026NS000051'),
    }),
    item({
      status: 'not_found',
      ns: '2026NS000052',
      nf: '9999',
      issues: [{ severity: 'warning', code: 'not_found', message: 'NF não encontrada.' }],
    }),
  ]));

  assert.equal(preview.stats.changes, 1);
  assert.equal(preview.stats.unchanged, 1);
  assert.equal(preview.stats.ignored, 1);
  assert.equal(preview.stats.blocked, 0);
  assert.equal(preview.canAdvanceToPersistenceReview, true);
});


test('bloqueia persistência quando o SAG não fornece UG emitente', () => {
  const preview = buildSagNsApplicationPreview(result([
    item({
      status: 'matched',
      ns: '2026NS000090',
      invoice: invoiceRef('1290', '2026NE000001'),
    }),
  ], null));

  assert.equal(preview.ug, null);
  assert.equal(preview.items[0].decision, 'blocked');
  assert.equal(preview.items[0].blockers.some((message) => message.includes('UG emitente')), true);
  assert.equal(preview.canAdvanceToPersistenceReview, false);
});
