#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const gate = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const navigation = read('features/warehouse/navigation.ts');
const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
const content = read('features/warehouse/components/WarehouseSectionContent.tsx');
const namespace = read('lib/warehouse/namespace.ts');
const phase0 = read('scripts/verify-adm-deposito-phase-0.mjs');
const phase1 = read('scripts/verify-adm-deposito-phase-1.mjs');
const phase2 = read('scripts/verify-adm-deposito-phase-2.mjs');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const ci = read('.github/workflows/application-ci.yml');
const pkg = JSON.parse(read('package.json'));

const routeFiles = [
  ['app/adm-deposito/page.tsx', 'overview'],
  ['app/adm-deposito/estoque/page.tsx', 'stock'],
  ['app/adm-deposito/movimentacoes/page.tsx', 'movements'],
  ['app/adm-deposito/localizacoes/page.tsx', 'locations'],
  ['app/adm-deposito/visao-do-deposito/page.tsx', 'warehouseView'],
  ['app/adm-deposito/inventario/page.tsx', 'inventory'],
  ['app/adm-deposito/siscofis-conciliacao/page.tsx', 'siscofis'],
  ['app/adm-deposito/entregas/page.tsx', 'deliveries'],
  ['app/adm-deposito/configuracoes/page.tsx', 'settings'],
];

for (const [path, section] of routeFiles) {
  const route = read(path);
  requireText(route, 'WarehouseProtectedSurface', `Rota estrutural sem gate compartilhado: ${path}`);
  requireText(route, `section="${section}"`, `Rota estrutural aponta para seção incorreta: ${path}`);
}

for (const marker of [
  'Visão Geral',
  'Estoque',
  'Movimentações',
  'Localizações',
  'Visão do Depósito',
  'Inventário',
  'SISCOFIS / Conciliação',
  'Entregas',
  'Configurações',
]) {
  requireText(navigation, marker, `Superfície ausente na navegação da FASE 3: ${marker}`);
}

for (const marker of [
  'resolveAuthenticatedWorkspaceContext(currentUser)',
  'canAccessWarehouseModule(context)',
  "fetch('/api/adm-deposito/status'",
  "window.location.replace('/')",
]) {
  requireText(gate, marker, `Gate founder-only não preservado no layout: ${marker}`);
}

for (const marker of [
  'WAREHOUSE_MATERIAL_SCHEMA_VERSION',
  'WAREHOUSE_MOVEMENT_SCHEMA_VERSION',
  'WAREHOUSE_BALANCE_SCHEMA_VERSION',
  'WAREHOUSE_MOVEMENT_TYPES',
  'WAREHOUSE_NAMESPACE_ROOT',
]) {
  requireText(content, marker, `Walking Skeleton não reutiliza contrato oficial: ${marker}`);
}

for (const marker of [
  "materials: 'materials'",
  "movements: 'movements'",
  "balances: 'balances'",
]) {
  requireText(namespace, marker, `Fonte canônica anterior foi removida: ${marker}`);
}

const uiSources = [shell, content, ...routeFiles.map(([path]) => read(path))].join('\n');
for (const forbidden of [
  'firebase/firestore',
  'onSnapshot(',
  'getDocs(',
  'setDoc(',
  'addDoc(',
  'runTransaction(',
  'ledgerRepository',
  'materialRepository',
  'applyWarehouseMovement(',
  'saveWarehouseMaterial(',
]) {
  forbidText(uiSources, forbidden, `FASE 3 antecipou persistência/operação: ${forbidden}`);
}

for (const marker of [
  'Capacidade futura',
  'não exibe números fictícios',
  'Nenhuma consulta automática ou listener',
]) {
  requireText(content, marker, `Estado honesto da interface ausente: ${marker}`);
}

requireText(phase0, 'ADM DEPÓSITO FASE 0: READY', 'Gate permanente da FASE 0 foi removido.');
requireText(phase1, 'ADM DEPÓSITO FASE 1: READY', 'Gate permanente da FASE 1 foi removido.');
requireText(phase2, 'ADM DEPÓSITO FASE 2: READY', 'Gate permanente da FASE 2 foi removido.');
requireText(e2e, "await page.goto('/adm-deposito/estoque');", 'Browser E2E não cobre bloqueio de rota interna para usuário externo.');

requireText(pkg.scripts?.['test:adm-deposito-walking-skeleton'] || '', 'warehouse-walking-skeleton.test.mjs', 'package.json não registra testes estruturais da FASE 3.');
requireText(pkg.scripts?.['verify:adm-deposito-phase-3'] || '', 'verify-adm-deposito-phase-3.mjs', 'package.json não registra gate da FASE 3.');
requireText(ci, 'npm run verify:adm-deposito-phase-0', 'CI deixou de executar FASE 0.');
requireText(ci, 'npm run verify:adm-deposito-phase-1', 'CI deixou de executar FASE 1.');
requireText(ci, 'npm run verify:adm-deposito-phase-2', 'CI deixou de executar FASE 2.');
requireText(ci, 'npm run test:adm-deposito-walking-skeleton', 'CI não executa testes estruturais da FASE 3.');
requireText(ci, 'npm run verify:adm-deposito-phase-3', 'CI não executa gate da FASE 3.');
requireText(ci, 'npm run test:security:multitenant', 'CI deixou de executar segurança multi-tenant.');
requireText(ci, 'npm run build', 'CI deixou de executar build.');
requireText(ci, 'npm run typecheck', 'CI deixou de executar TypeScript.');

if (findings.length) {
  console.error('ADM DEPÓSITO FASE 3: BLOQUEADO\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('ADM DEPÓSITO FASE 3: READY');
  console.log('Walking Skeleton: nove superfícies estruturais navegáveis');
  console.log('Arquitetura: layout founder-only compartilhado + shell responsivo');
  console.log('Contratos: material, ledger e saldo oficiais reutilizados');
  console.log('Performance: nenhuma query/listener/persistência adicionada pelo skeleton');
  console.log('Escopo: FASE 4 NF → Estoque não iniciada');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}
