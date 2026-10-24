#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const layout = read('app/central-depositos/layout.tsx');
const gate = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const navigation = read('features/warehouse/navigation.ts');
const registration = read('features/warehouse/components/WarehouseItemRegistrationOperational.tsx');
const depots = read('features/warehouse/components/WarehouseDepotsOperational.tsx');
const control = read('features/warehouse/components/WarehouseItemControlOperational.tsx');
const namespace = read('lib/warehouse/namespace.ts');
const phase0 = read('scripts/verify-adm-deposito-phase-0.mjs');
const phase1 = read('scripts/verify-adm-deposito-phase-1.mjs');
const phase2 = read('scripts/verify-adm-deposito-phase-2.mjs');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const ci = read('.github/workflows/application-ci.yml');
const pkg = JSON.parse(read('package.json'));

const primaryRoutes = [
  ['app/central-depositos/page.tsx', 'home'],
  ['app/central-depositos/meus-depositos/page.tsx', 'overview'],
  ['app/central-depositos/cadastro-de-itens/page.tsx', 'registration'],
  ['app/central-depositos/saida-de-material/page.tsx', 'outbound'],
  ['app/central-depositos/controle-de-depositos/page.tsx', 'depots'],
  ['app/central-depositos/controle-de-itens/page.tsx', 'control'],
];

requireText(
  layout,
  'WarehouseProtectedLayout',
  'Layout compartilhado da Central deixou de montar o gate multi-tenant.'
);

for (const [path, section] of primaryRoutes) {
  const route = read(path);
  requireText(route, 'WarehouseRouteContent', `Rota principal sem conteúdo modular: ${path}`);
  requireText(route, `section="${section}"`, `Rota principal aponta para seção incorreta: ${path}`);
  if (route.includes('WarehouseProtectedSurface')) {
    findings.push(`Rota principal voltou a montar gate por página: ${path}`);
  }
}

const legacyRoutes = [
  ['app/central-depositos/estoque/page.tsx', "/central-depositos/controle-de-itens?aba=stock"],
  ['app/central-depositos/movimentacoes/page.tsx', "/central-depositos/controle-de-itens?aba=movements"],
  ['app/central-depositos/localizacoes/page.tsx', "/central-depositos/controle-de-depositos?aba=estrutura"],
  ['app/central-depositos/visao-do-deposito/page.tsx', "/central-depositos/controle-de-depositos?aba=croquis"],
  ['app/central-depositos/inventario/page.tsx', "/central-depositos/controle-de-itens?aba=inventory"],
  ['app/central-depositos/siscofis-conciliacao/page.tsx', "/central-depositos/cadastro-de-itens?aba=siscofis"],
  ['app/central-depositos/entregas/page.tsx', "/central-depositos/controle-de-itens?aba=deliveries"],
  ['app/central-depositos/configuracoes/page.tsx', "/central-depositos/controle-de-itens?aba=settings"],
];

for (const [path, target] of legacyRoutes) {
  const route = read(path);
  requireText(route, "import { redirect } from 'next/navigation';", `Rota legada deixou de ser redirect: ${path}`);
  requireText(route, `redirect('${target}')`, `Rota legada aponta para destino incorreto: ${path}`);
}

for (const marker of ['Início', 'Meus Depósitos', 'Alocação de Material', 'Saída de Material', 'Controle de Depósitos', 'Controle de Materiais']) {
  requireText(navigation, marker, `Superfície principal ausente na navegação atual: ${marker}`);
}

for (const marker of [
  'resolveAuthenticatedWorkspaceContext(currentUser)',
  'canAccessWarehouseModule(context)',
  "fetch('/api/central-depositos/status'",
  "window.location.replace('/')",
]) {
  requireText(gate, marker, `Gate multi-tenant não preservado no layout: ${marker}`);
}

for (const marker of [
  'WarehouseSiscofisOperational',
  'InvoiceRegistrationQueue',
]) {
  requireText(registration, marker, `Alocação de Material perdeu capacidade oficial: ${marker}`);
}
// Desde o PR #366, locais e croquis foram consolidados em uma única superfície.
requireText(
  depots,
  'WarehouseCroquisR1Operational',
  'Controle de Depósitos perdeu a superfície oficial de croquis e locais.'
);
if (depots.includes('WarehouseLocationsR1Operational')) {
  findings.push('Controle de Depósitos voltou a montar a subaba legada de locais.');
}
for (const marker of [
  'WarehouseItemControlSummary',
  'WarehouseStockOperational',
  'WarehouseMovementsOperational',
  'WarehouseInventoryOperational',
  'WarehouseLogisticsReports',
]) {
  requireText(control, marker, `Controle de Materiais perdeu capacidade oficial: ${marker}`);
}

for (const marker of [
  "materials: 'materials'",
  "movements: 'movements'",
  "balances: 'balances'",
]) {
  requireText(namespace, marker, `Fonte canônica anterior foi removida: ${marker}`);
}

requireText(phase0, 'ADM DEPÓSITO FASE 0: READY', 'Gate permanente da FASE 0 foi removido.');
requireText(phase1, 'ADM DEPÓSITO FASE 1: READY', 'Gate permanente da FASE 1 foi removido.');
requireText(phase2, 'ADM DEPÓSITO FASE 2: READY', 'Gate permanente da FASE 2 foi removido.');
requireText(e2e, "page.getByTestId('nav-central-depositos')", 'Browser E2E não cobre a entrada da Central de Depósitos para setor externo.');
requireText(e2e, "Central de Depósitos", 'Browser E2E não confirma o novo rótulo da Central de Depósitos.');

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
  console.log('Navegação atual: seis superfícies principais protegidas');
  console.log('Compatibilidade: rotas legadas redirecionam para as novas superfícies');
  console.log('Contratos: namespace oficial de material, ledger e saldo preservado');
  console.log('Segurança: gate multi-tenant compartilhado permanece obrigatório');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
