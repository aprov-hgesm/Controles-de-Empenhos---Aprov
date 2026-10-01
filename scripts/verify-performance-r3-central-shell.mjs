#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const layoutPath = 'app/adm-deposito/layout.tsx';
assert.equal(existsSync(resolve(root, layoutPath)), true, 'Layout compartilhado da Central ausente.');

const layout = read(layoutPath);
assert.match(layout, /WarehouseProtectedLayout/);
assert.match(layout, /<WarehouseProtectedLayout>\{children\}<\/WarehouseProtectedLayout>/);

const protectedLayout = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
assert.match(protectedLayout, /onAuthStateChanged/);
assert.match(protectedLayout, /requestWarehouseStatus/);
assert.match(protectedLayout, /startWorkspaceSessionControl/);
assert.match(protectedLayout, /clearResolvedWorkspaceContext/);
assert.match(protectedLayout, /WarehouseWorkspaceContext\.Provider/);
assert.match(protectedLayout, /<WarehouseModuleShell workspaceContext=\{workspaceContext\}>/);

const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
assert.match(shell, /usePathname/);
assert.match(shell, /getWarehouseSectionForPathname/);
assert.match(shell, /\{children\}/);
assert.equal(
  shell.includes('WarehouseSectionContent'),
  false,
  'Shell persistente não pode importar a superfície operacional ativa.'
);

for (const forbidden of [
  'WarehouseDepotsOperational',
  'WarehouseItemRegistrationOperational',
  'WarehouseMaterialWithdrawal',
  'WarehouseItemControlOperational',
  'WarehouseHomeOperational',
  'WarehouseLandingOperational',
]) {
  assert.equal(
    shell.includes(forbidden),
    false,
    'Shell persistente importou superfície pesada: ' + forbidden
  );
  assert.equal(
    protectedLayout.includes(forbidden),
    false,
    'Gate persistente importou superfície pesada: ' + forbidden
  );
}

const routeContent = read('features/warehouse/components/WarehouseRouteContent.tsx');
assert.match(routeContent, /WarehouseSectionContent/);
assert.match(routeContent, /useWarehouseWorkspaceContext/);

const primaryRoutes = new Map([
  ['app/adm-deposito/page.tsx', 'home'],
  ['app/adm-deposito/meus-depositos/page.tsx', 'overview'],
  ['app/adm-deposito/cadastro-de-itens/page.tsx', 'registration'],
  ['app/adm-deposito/saida-de-material/page.tsx', 'outbound'],
  ['app/adm-deposito/controle-de-depositos/page.tsx', 'depots'],
  ['app/adm-deposito/controle-de-itens/page.tsx', 'control'],
]);

for (const [path, section] of primaryRoutes) {
  const page = read(path);
  assert.match(page, /WarehouseRouteContent/);
  assert.match(page, new RegExp(`section=["']${section}["']`));
  assert.equal(
    page.includes('WarehouseProtectedSurface'),
    false,
    'Página principal ainda remonta o gate por rota: ' + path
  );
  assert.equal(
    page.includes('WarehouseModuleShell'),
    false,
    'Página principal ainda remonta o shell por rota: ' + path
  );
}

const sectionContent = read('features/warehouse/components/WarehouseSectionContent.tsx');
assert.match(sectionContent, /dynamic\(/);
for (const component of [
  'WarehouseDepotsOperational',
  'WarehouseItemRegistrationOperational',
  'WarehouseMaterialWithdrawal',
  'WarehouseItemControlOperational',
  'WarehouseHomeOperational',
  'WarehouseLandingOperational',
]) {
  assert.match(
    sectionContent,
    new RegExp(`import\\(['"]\\./${component}['"]\\)`),
    'Boundary lazy da PERF-B ausente para ' + component
  );
  assert.doesNotMatch(
    sectionContent,
    new RegExp(`import\\s+.*from\\s+['"]\\./${component}['"]`),
    'Import estático reintroduzido para ' + component
  );
}

const sidebar = read('features/warehouse/components/WarehouseSidebar.tsx');
assert.match(sidebar, /from ['"]next\/link['"]/);
assert.equal(
  /window\.location\.(?:assign|replace)|window\.location\.href|<a\s+[^>]*href=/.test(sidebar),
  false,
  'Sidebar da Central reintroduziu navegação com reload completo.'
);

console.log('PERFORMANCE R3 CENTRAL SHELL: PASS');
console.log('- layout compartilhado mantém gate + shell fora das páginas');
console.log('- páginas principais entregam somente a superfície operacional ativa');
console.log('- boundaries dynamic() da PERF-B permanecem protegidos');
console.log('- navegação principal da sidebar continua em Next Link');
console.log('- invalidação contínua de sessão/workspace permanece fail-closed');
