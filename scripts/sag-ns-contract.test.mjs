#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const identitySource = readFileSync(resolve(root, 'lib/invoiceIdentity.ts'), 'utf8');
const sagSource = readFileSync(resolve(root, 'lib/sagNsContract.ts'), 'utf8');

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

const sagModule = new vm.SourceTextModule(transpile(sagSource, 'sagNsContract.ts'), {
  context,
  identifier: 'file:///lib/sagNsContract.js',
});
await sagModule.link(async (specifier) => {
  if (specifier === './invoiceIdentity') return identityModule;
  throw new Error(`Import runtime inesperado: ${specifier}`);
});
await sagModule.evaluate();

const {
  SAG_NS_SCHEMA_VERSION,
  normalizeSagNsNumber,
  normalizeSagIsoDate,
  parseSagNsJson,
  validateSagNsPayload,
  buildSagNsExtractionPrompt,
} = sagModule.namespace;

const basePayload = () => ({
  schema_version: 'emprovex_sag_ns_v1',
  source: 'SAG',
  supplier_cnpj: '02.483.088/0001-75',
  ug: '160416',
  records: [
    {
      ns: '2026 NS 000012',
      ns_issue_date: '2026-01-12',
      nf_number_raw: '01234',
      nf_issue_date: '2025-12-12',
      observation: 'APROPRIAÇÃO DE DESPESAS... NF 01234/12DEZ25...',
    },
    {
      ns: '2026NS000068',
      ns_issue_date: '2026-01-21',
      nf_number_raw: null,
      nf_issue_date: null,
      observation: 'DOCUMENTO EMITIDO PELO SIAFI-WEB...',
    },
  ],
});

test('normaliza NS e valida datas ISO estritamente', () => {
  assert.equal(SAG_NS_SCHEMA_VERSION, 'emprovex_sag_ns_v1');
  assert.equal(normalizeSagNsNumber('2026 NS-000012'), '2026NS000012');
  assert.equal(normalizeSagIsoDate('2026-02-28'), '2026-02-28');
  assert.equal(normalizeSagIsoDate('2026-02-30'), null);
});

test('aceita payload válido, normaliza CNPJ e preserva zeros da NF', () => {
  const result = validateSagNsPayload(basePayload(), {
    expectedSupplierCnpj: '02483088000175',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.supplier_cnpj, '02483088000175');
  assert.equal(result.data.records[0].ns, '2026NS000012');
  assert.equal(result.data.records[0].nf_number_raw, '01234');
  assert.equal(result.stats.totalRecords, 2);
  assert.equal(result.stats.recordsWithNf, 1);
  assert.equal(result.stats.recordsWithoutNf, 1);
});

test('aceita CNPJ alfanumérico oficial no payload SAG', () => {
  const payload = basePayload();
  payload.supplier_cnpj = '00.000.000/E08G-12';

  const result = validateSagNsPayload(payload, {
    expectedSupplierCnpj: '00000000E08G12',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.supplier_cnpj, '00000000E08G12');
});

test('rejeita CNPJ com forma válida mas dígitos verificadores incorretos', () => {
  const payload = basePayload();
  payload.supplier_cnpj = '02.483.088/0001-74';

  const result = validateSagNsPayload(payload);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'invalid_supplier_cnpj'), true);
});

test('rejeita fornecedor selecionado com DV inválido antes da conciliação', () => {
  const result = validateSagNsPayload(basePayload(), {
    expectedSupplierCnpj: '22.222.222/0001-82',
  });

  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'invalid_expected_supplier_cnpj'), true);
});

test('rejeita CNPJ diferente do fornecedor selecionado', () => {
  const result = validateSagNsPayload(basePayload(), {
    expectedSupplierCnpj: '11111111000191',
  });

  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'supplier_cnpj_mismatch'), true);
});

test('rejeita versão de schema incorreta e NS duplicada', () => {
  const payload = basePayload();
  payload.schema_version = 'outro_schema';
  payload.records[1].ns = '2026NS000012';

  const result = validateSagNsPayload(payload);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'invalid_schema_version'), true);
  assert.equal(result.issues.some((issue) => issue.code === 'duplicate_ns_in_payload'), true);
});

test('rejeita campos que tentem vincular diretamente uma NE', () => {
  const payload = basePayload();
  payload.records[0].empenho_id = '2026NE000999';

  const result = validateSagNsPayload(payload);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'forbidden_linkage_field'), true);
});

test('data de NF posterior à NS vira alerta, sem correção automática', () => {
  const payload = basePayload();
  payload.records[0].nf_issue_date = '2026-11-06';

  const result = validateSagNsPayload(payload);
  assert.equal(result.ok, true);
  assert.equal(result.data.records[0].nf_issue_date, '2026-11-06');
  assert.equal(result.issues.some((issue) => issue.code === 'nf_date_after_ns_date'), true);
});

test('NS sem referência de NF continua válida e explícita', () => {
  const payload = basePayload();
  payload.records = [payload.records[1]];

  const result = validateSagNsPayload(payload);
  assert.equal(result.ok, true);
  assert.equal(result.data.records[0].nf_number_raw, null);
  assert.equal(result.data.records[0].nf_issue_date, null);
});

test('parser aceita JSON puro e também remove apenas cerca Markdown externa', () => {
  const json = JSON.stringify(basePayload());
  assert.equal(parseSagNsJson(json).ok, true);
  assert.equal(parseSagNsJson(`\`\`\`json\n${json}\n\`\`\``).ok, true);
  assert.equal(parseSagNsJson('{json quebrado').ok, false);
});

test('prompt SAG normaliza CNPJ alfanumérico oficial', () => {
  const prompt = buildSagNsExtractionPrompt({
    supplierCnpj: '00.000.000/E08G-12',
    supplierName: 'Banco do Brasil S.A.',
    ug: '160416',
  });
  assert.equal(prompt.includes('00000000E08G12'), true);
});

test('prompt oficial fixa CNPJ, schema e proíbe inferência de NE', () => {
  const prompt = buildSagNsExtractionPrompt({
    supplierCnpj: '02.483.088/0001-75',
    supplierName: 'Fornecedor Exemplo LTDA',
    ug: '160416',
  });

  assert.equal(prompt.includes('02483088000175'), true);
  assert.equal(prompt.includes('emprovex_sag_ns_v1'), true);
  assert.equal(prompt.includes('NUNCA identifique, deduza, invente ou retorne número de Nota de Empenho (NE)'), true);
  assert.equal(prompt.includes('A ligação CNPJ → NF → NE será feita exclusivamente pelo EMPROVEX'), true);
  assert.equal(prompt.includes('Retorne SOMENTE JSON válido'), true);
});
