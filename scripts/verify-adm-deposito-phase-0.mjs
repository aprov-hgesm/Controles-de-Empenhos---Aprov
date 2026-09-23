#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const featureFlag = read('lib/warehouse/featureFlag.ts');
const namespace = read('lib/warehouse/namespace.ts');
const serverAccess = read('lib/server/warehouseAccess.ts');
const route = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const api = read('app/api/adm-deposito/status/route.ts');
const sidebar = read('components/layout/AppSidebar.tsx');
const home = read('app/page.tsx');
const rules = read('firestore.rules');
const securitySuite = read('scripts/firestore-multitenancy-security.test.mjs');
const browserE2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const ci = read('.github/workflows/application-ci.yml');
const pkg = JSON.parse(read('package.json'));

requireText(
  featureFlag,
  'export const warehouseModuleEnabled = true;',
  'Feature flag warehouseModuleEnabled não está explicitamente habilitada.'
);
requireText(
  featureFlag,
  'context.workspaceId === HGESM_WORKSPACE_ID',
  'Feature flag não está vinculada ao workspace fundador.'
);
requireText(
  featureFlag,
  "context.status === 'sector'",
  'Feature flag não exige perfil operacional do fundador.'
);
requireText(
  featureFlag,
  "context.resolutionSource === 'legacy-hgesm-bootstrap'",
  'Feature flag não exige a resolução fundadora consolidada.'
);

for (const marker of [
  "WAREHOUSE_NAMESPACE_ROOT = 'warehouse'",
  "materials: 'materials'",
  "depots: 'depots'",
  "locations: 'locations'",
  "movements: 'movements'",
  "lots: 'lots'",
  "inventories: 'inventories'",
  "siscofisSnapshots: 'siscofisSnapshots'",
]) {
  requireText(namespace, marker, `Namespace logístico incompleto: ${marker}`);
}

requireText(
  serverAccess,
  'verifyFounderFirebaseRequest(authorization)',
  'Gate server-side do ADM Depósito não reutiliza a autenticação forte da conta fundadora.'
);
requireText(
  api,
  'verifyWarehouseFounderRequest',
  'API do ADM Depósito não usa o gate server-side dedicado.'
);
requireText(
  route,
  'resolveAuthenticatedWorkspaceContext(currentUser)',
  'Rota ADM Depósito não valida o contexto autenticado.'
);
requireText(
  route,
  'canAccessWarehouseModule(context)',
  'Rota ADM Depósito não aplica a feature flag fundadora.'
);
requireText(
  route,
  "fetch('/api/adm-deposito/status'",
  'Rota ADM Depósito não confirma autorização no servidor antes de renderizar.'
);
requireText(
  route,
  "router.replace('/')",
  'Rota ADM Depósito não fecha acesso direto não autorizado.'
);

requireText(
  sidebar,
  'warehouseModuleEnabled && onOpenWarehouse',
  'Sidebar não condiciona a navegação do ADM Depósito à feature flag.'
);
requireText(
  sidebar,
  'data-testid="nav-adm-deposito"',
  'Entrada controlada do ADM Depósito não está identificada para regressão.'
);
requireText(
  home,
  'warehouseModuleEnabled={canAccessWarehouseModule(workspaceContext)}',
  'Home não calcula a visibilidade do módulo a partir do contexto autorizado.'
);
requireText(
  home,
  "window.location.assign('/adm-deposito')",
  'Navegação fundadora não aponta para a rota isolada do módulo.'
);

requireText(
  rules,
  'function warehouseModuleEnabled()',
  'Firestore Rules não possuem flag própria do ADM Depósito.'
);
requireText(
  rules,
  'function canAccessWarehouseModule(workspaceId)',
  'Firestore Rules não possuem gate dedicado do ADM Depósito.'
);
requireText(
  rules,
  "workspaceId == 'hgesm-aprov'",
  'Firestore Rules não restringem o namespace ao workspace fundador.'
);
requireText(
  rules,
  'match /warehouse/{workspaceId}',
  'Namespace warehouse não possui match dedicado nas Firestore Rules.'
);
requireText(
  rules,
  'allow read, write: if canAccessWarehouseModule(workspaceId);',
  'Namespace warehouse não está protegido pelo gate fundador.'
);

const warehouseRuleStart = rules.indexOf('match /warehouse/{workspaceId}');
const operationalRuleStart = rules.indexOf('// Workspace-scoped operational data.', warehouseRuleStart);
if (warehouseRuleStart < 0 || operationalRuleStart < 0) {
  findings.push('Não foi possível isolar o bloco de Rules do namespace warehouse.');
} else {
  const warehouseRules = rules.slice(warehouseRuleStart, operationalRuleStart);
  forbidText(
    warehouseRules,
    'canAccessWorkspace(workspaceId)',
    'Namespace warehouse não pode herdar autorização operacional de setores externos.'
  );
}

for (const scenario of [
  'Fundador grava no namespace ADM Depósito',
  'Fundador lê o namespace ADM Depósito',
  'Setor externo não lê namespace ADM Depósito do fundador',
  'Setor externo não grava namespace ADM Depósito nem no próprio workspace',
  'Sessão fundadora por senha não acessa ADM Depósito',
  'Fundador não usa o namespace ADM Depósito de workspace externo',
]) {
  requireText(
    securitySuite,
    scenario,
    `Cenário de segurança da FASE 0 ausente: ${scenario}`
  );
}

requireText(
  browserE2e,
  'usuário externo não vê nem acessa a rota ADM Depósito',
  'Browser E2E não cobre invisibilidade e bloqueio de URL direta para usuário externo.'
);

requireText(
  pkg.scripts?.['verify:adm-deposito-phase-0'] || '',
  'verify-adm-deposito-phase-0.mjs',
  'package.json não registra o gate da FASE 0.'
);
requireText(
  ci,
  'npm run verify:adm-deposito-phase-0',
  'Application CI não executa o gate da FASE 0.'
);
requireText(
  ci,
  'npm run test:security:multitenant',
  'Application CI deixou de executar a regressão multi-tenant.'
);

if (findings.length) {
  console.error('ADM DEPÓSITO FASE 0: BLOQUEADO\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('ADM DEPÓSITO FASE 0: READY');
  console.log('DEP-0: feature flag fundadora + sidebar + rota + API protegidas');
  console.log('DEP-0.1: namespace warehouse independente e reservado');
  console.log('Firestore: usuário externo sem fallback de acesso');
  console.log('Regressão: suíte multi-tenant preservada no CI');
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
