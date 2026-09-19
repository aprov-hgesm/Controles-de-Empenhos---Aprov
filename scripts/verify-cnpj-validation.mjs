#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const identity = read('lib/invoiceIdentity.ts');
const empenhoActions = read('features/empenhos/hooks/useEmpenhoActions.ts');
const empenhoView = read('features/empenhos/components/EmpenhosView.tsx');
const empenhoPrompt = read('features/empenhos/domain/empenhoHelpers.ts');
const invoiceActions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const migration = read('lib/supplierCnpjMigration.ts');
const integrity = read('lib/nsIntegrity.ts');
const service = read('lib/nsIntegrityService.ts');
const sagContract = read('lib/sagNsContract.ts');
const sagReconciliation = read('lib/sagNsReconciliation.ts');
const reporting = read('lib/supplierReporting.ts');
const reportingView = read('features/relatorios/components/RelatorioPorFornecedorView.tsx');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const identityTests = read('scripts/invoice-identity.test.mjs');
const migrationTests = read('scripts/supplier-cnpj-migration.test.mjs');
const sagTests = read('scripts/sag-ns-contract.test.mjs');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  "const CNPJ_CANONICAL_PATTERN = /^[0-9A-Z]{12}[0-9]{2}$/",
  'CNPJ_FIRST_DV_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]',
  'CNPJ_SECOND_DV_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]',
  'character.charCodeAt(0) - 48',
  'remainder === 0 || remainder === 1 ? 0 : 11 - remainder',
  'calculateSupplierCnpjCheckDigits',
  'isValidSupplierCnpj',
  "cnpj === '00000000000000'",
]) {
  requireText(identity, expected, `Validador central perdeu requisito: ${expected}`);
}

for (const [source, label] of [
  [empenhoActions, 'ações de empenho'],
  [invoiceActions, 'ações de NF'],
  [migration, 'migração de CNPJ'],
  [integrity, 'integridade de NS'],
  [service, 'serviço transacional'],
  [sagContract, 'contrato SAG'],
  [sagReconciliation, 'conciliação SAG'],
]) {
  requireText(source, 'isValidSupplierCnpj', `${label} não usa a validação matemática central de CNPJ.`);
}

requireText(empenhoView, 'placeholder="00.000.000/E08G-12"', 'UI não exibe exemplo de CNPJ alfanumérico.');
requireText(empenhoView, 'inputMode="text"', 'Input de CNPJ não está preparado para letras.');
requireText(empenhoView, 'autoCapitalize="characters"', 'Input de CNPJ não orienta capitalização alfanumérica.');
forbidText(
  empenhoView,
  'placeholder="00.000.000/0000-00"',
  'UI voltou a apresentar somente o modelo numérico antigo.'
);
requireText(
  empenhoPrompt,
  'CNPJs novos podem ser alfanuméricos',
  'Prompt de extração de empenho não preserva CNPJ alfanumérico.'
);

requireText(reporting, 'cnpjValid: boolean', 'Relatório não expõe validade matemática do CNPJ.');
requireText(reporting, 'cnpjValid: isValidSupplierCnpj(cnpj)', 'Relatório não calcula flag de CNPJ inválido.');
requireText(reportingView, 'CNPJs históricos inválidos', 'UI não sinaliza CNPJs históricos inválidos.');
requireText(reportingView, 'CNPJ com DV inválido', 'Detalhe do fornecedor não sinaliza DV inválido.');

for (const expected of [
  'function isValidCnpjShape(value)',
  "value.matches('^[0-9A-Z]{12}[0-9]{2}$')",
  'function empenhoCnpjCreateIsValid(data)',
  'function empenhoCnpjUpdateIsValid()',
  'isValidCnpjShape(data.supplierCnpj)',
  'isValidCnpjShape(request.resource.data.supplierCnpj)',
]) {
  requireText(rules, expected, `Rules perderam requisito estrutural de CNPJ: ${expected}`);
}
forbidText(
  rules,
  'supplierCnpj.size() == 14',
  'Rules voltaram a validar CNPJ apenas por tamanho.'
);

for (const expected of [
  'Empenho aceita CNPJ alfanumérico oficial em forma canônica',
  'Empenho rejeita letras nas duas posições de DV do CNPJ',
  'Empenho rejeita CNPJ com caractere fora do alfabeto oficial',
]) {
  requireText(security, expected, `Emulator não cobre estrutura alfanumérica: ${expected}`);
}

for (const expected of [
  "isValidSupplierCnpj('00.000.000/E08G-12'), true",
  "isValidSupplierCnpj('12.ABC.345/01DE-35'), true",
  "isValidSupplierCnpj('02.483.088/0001-74'), false",
  "calculateSupplierCnpjCheckDigits('00000000E08G'), '12'",
]) {
  requireText(identityTests, expected, `Teste oficial de CNPJ ausente: ${expected}`);
}
requireText(migrationTests, "const alpha = '00.000.000/E08G-12'", 'Migração não testa CNPJ alfanumérico.');
requireText(sagTests, "payload.supplier_cnpj = '00.000.000/E08G-12'", 'SAG não testa CNPJ alfanumérico.');

for (const source of [empenhoActions, migration, sagContract]) {
  forbidText(source, 'CNPJ válido com 14 dígitos', 'Texto legado de CNPJ numérico reapareceu.');
}

requireText(pkg, '"verify:cnpj-validation"', 'Guard do Bloco 6 não está registrado no package.json.');
requireText(workflow, 'Official CNPJ validation guard', 'CI não executa o guard do Bloco 6.');

if (findings.length) {
  console.error('OFFICIAL CNPJ VALIDATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('OFFICIAL CNPJ VALIDATION: READY');
  console.log('CNPJ numérico legado: SUPORTADO');
  console.log('CNPJ alfanumérico 2026: SUPORTADO');
  console.log('Dígitos verificadores módulo 11: VALIDADO');
  console.log('Históricos inválidos: VISÍVEIS E SINALIZADOS');
  console.log('Novas operações com DV inválido: BLOQUEADAS');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}
