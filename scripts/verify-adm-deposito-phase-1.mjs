#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const material = read('lib/warehouse/material.ts');
const repository = read('lib/warehouse/materialRepository.ts');
const namespace = read('lib/warehouse/namespace.ts');
const rules = read('firestore.rules');
const securitySuite = read('scripts/firestore-multitenancy-security.test.mjs');
const contractTests = read('scripts/warehouse-material-contract.test.mjs');
const phase0Guard = read('scripts/verify-adm-deposito-phase-0.mjs');
const ci = read('.github/workflows/application-ci.yml');
const pkg = JSON.parse(read('package.json'));

for (const marker of [
  "WAREHOUSE_MATERIAL_SCHEMA_VERSION = 'warehouse_material_v1'",
  "'unit'",
  "'kg'",
  "'g'",
  "'l'",
  "'ml'",
  "'package'",
  "'box'",
  "'bundle'",
  "'other'",
  'workspaceId: string;',
  'ug: string;',
  'description: string;',
  'aliases: string[];',
  'status: WarehouseMaterialStatus;',
  'conversions: WarehouseMaterialConversion[];',
  'validateWarehouseMaterial',
  'createWarehouseMaterialId',
  'convertWarehouseMaterialQuantityToBase',
]) {
  requireText(material, marker, `Contrato de material incompleto: ${marker}`);
}

for (const marker of [
  "warehouseDomainPath(workspaceId, 'materials')",
  "warehouseDocumentPath(workspaceId, 'materials', materialId)",
  'validateForWorkspace',
  'listWarehouseMaterials',
  'getWarehouseMaterial',
  'saveWarehouseMaterial',
]) {
  requireText(repository, marker, `Persistência de material incompleta: ${marker}`);
}

requireText(
  namespace,
  'export function warehouseDocumentPath',
  'Namespace não possui helper estável de documento.'
);

for (const marker of [
  'function validWarehouseMaterialDocument(workspaceId, materialId)',
  "request.resource.data.schemaVersion == 'warehouse_material_v1'",
  'request.resource.data.workspaceId == workspaceId',
  'match /materials/{materialId}',
  'validWarehouseMaterialDocument(workspaceId, materialId)',
]) {
  requireText(rules, marker, `Firestore Rules não protegem contrato canônico: ${marker}`);
}

const warehouseRuleStart = rules.indexOf('match /warehouse/{workspaceId}');
const operationalRuleStart = rules.indexOf('// Workspace-scoped operational data.', warehouseRuleStart);
if (warehouseRuleStart < 0 || operationalRuleStart < 0) {
  findings.push('Não foi possível isolar o bloco warehouse nas Rules.');
} else {
  const warehouseRules = rules.slice(warehouseRuleStart, operationalRuleStart);
  forbidText(
    warehouseRules,
    'canAccessWorkspace(workspaceId)',
    'FASE 1 reintroduziu fallback de workspace no namespace warehouse.'
  );
}

for (const scenario of [
  'Fundador grava material canônico da FASE 1',
  'Fundador lê material canônico da FASE 1',
  'Fundador lista materiais da FASE 1',
  'Material canônico não pode ser apagado fisicamente',
  'Material não pode declarar workspace diferente do caminho',
  'Setor externo não lê material do fundador',
  'Setor externo não grava material nem no próprio workspace',
  'Sessão fundadora por senha não lê materiais da FASE 1',
  'Fundador não grava material em workspace externo',
]) {
  requireText(
    securitySuite,
    scenario,
    `Cenário de segurança da FASE 1 ausente: ${scenario}`
  );
}

for (const marker of [
  'cria e normaliza o contrato canônico de material',
  'rejeita material fora do contrato explícito',
  'valida compatibilidade com o workspace esperado',
  'suporta unidade, kg, g, L, mL, pacote, caixa, fardo e apresentação livre',
  'converte apresentações para a unidade canônica sem criar saldo ou movimento',
]) {
  requireText(contractTests, marker, `Teste de domínio da FASE 1 ausente: ${marker}`);
}

requireText(
  phase0Guard,
  'ADM DEPÓSITO FASE 0: READY',
  'Gate permanente da FASE 0 foi removido.'
);
requireText(
  pkg.scripts?.['test:adm-deposito-material'] || '',
  'warehouse-material-contract.test.mjs',
  'package.json não registra os testes funcionais da FASE 1.'
);
requireText(
  pkg.scripts?.['verify:adm-deposito-phase-1'] || '',
  'verify-adm-deposito-phase-1.mjs',
  'package.json não registra o gate da FASE 1.'
);
requireText(
  ci,
  'npm run verify:adm-deposito-phase-0',
  'CI deixou de executar o gate da FASE 0.'
);
requireText(
  ci,
  'npm run test:adm-deposito-material',
  'CI não executa testes funcionais da FASE 1.'
);
requireText(
  ci,
  'npm run verify:adm-deposito-phase-1',
  'CI não executa gate da FASE 1.'
);
requireText(
  ci,
  'npm run test:security:multitenant',
  'CI deixou de executar regressão de segurança multi-tenant.'
);

if (findings.length) {
  console.error('ADM DEPÓSITO FASE 1: BLOQUEADO\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('ADM DEPÓSITO FASE 1: READY');
  console.log('DEP-1: material canônico versionado, normalizado e isolado por workspace/UG');
  console.log('DEP-1.1: unidades/apresentações e conversões para unidade canônica');
  console.log('Segurança: gate fundador da FASE 0 preservado');
  console.log('Escopo: ledger, saldo, NF, lotes e localização não iniciados');
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
