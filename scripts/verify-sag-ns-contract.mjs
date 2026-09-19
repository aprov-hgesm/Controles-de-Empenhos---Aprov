#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const contract = read('lib/sagNsContract.ts');
const tests = read('scripts/sag-ns-contract.test.mjs');
const docs = read('docs/SAG_NS_JSON_CONTRACT.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

requireText(contract, "SAG_NS_SCHEMA_VERSION = 'emprovex_sag_ns_v1'", 'Versão oficial do schema SAG ausente.');
requireText(contract, 'validateSagNsPayload', 'Validador estrutural SAG ausente.');
requireText(contract, 'parseSagNsJson', 'Parser seguro do JSON SAG ausente.');
requireText(contract, 'normalizeSagNsNumber', 'Normalizador do número da NS ausente.');
requireText(contract, 'normalizeInvoiceNumber', 'Contrato SAG não reutiliza a normalização segura de NF.');
requireText(contract, 'supplier_cnpj_mismatch', 'Validação do CNPJ selecionado ausente.');
requireText(contract, 'duplicate_ns_in_payload', 'Detecção de NS duplicada no lote ausente.');
requireText(contract, 'forbidden_linkage_field', 'Proteção contra vínculo de NE fornecido pela IA ausente.');
requireText(contract, 'nf_date_after_ns_date', 'Alerta de anomalia temporal NF/NS ausente.');
requireText(contract, 'buildSagNsExtractionPrompt', 'Gerador do prompt oficial SAG ausente.');
requireText(contract, 'A ligação CNPJ → NF → NE será feita exclusivamente pelo EMPROVEX', 'Prompt não reserva a conciliação para o EMPROVEX.');
requireText(tests, 'data de NF posterior à NS vira alerta', 'Teste da anomalia temporal ausente.');
requireText(tests, 'rejeita campos que tentem vincular diretamente uma NE', 'Teste anti-inferência de NE ausente.');
requireText(docs, 'emprovex_sag_ns_v1', 'Documentação do contrato SAG ausente.');
requireText(pkg, '"test:sag-ns-contract"', 'Script de teste SAG não está registrado.');
requireText(pkg, '"verify:sag-ns-contract"', 'Guard SAG não está registrado.');
requireText(workflow, 'SAG NS contract tests', 'CI não executa os testes do contrato SAG.');
requireText(workflow, 'SAG NS contract guard', 'CI não executa o guard do contrato SAG.');

if (findings.length) {
  console.error('SAG NS CONTRACT: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SAG NS CONTRACT: READY');
  console.log('Schema: emprovex_sag_ns_v1');
  console.log('IA: SOMENTE EXTRAÇÃO');
  console.log('Conciliação CNPJ > NF > NE: RESERVADA AO EMPROVEX');
  console.log('Persistência automática: NÃO IMPLEMENTADA NESTE BLOCO');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
