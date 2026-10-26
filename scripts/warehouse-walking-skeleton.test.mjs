import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const primaryRoutes = {
  home: ['app/central-depositos/page.tsx', 'home'],
  overview: ['app/central-depositos/meus-depositos/page.tsx', 'overview'],
  registration: ['app/central-depositos/cadastro-de-itens/page.tsx', 'registration'],
  outbound: ['app/central-depositos/saida-de-material/page.tsx', 'outbound'],
  depots: ['app/central-depositos/controle-de-depositos/page.tsx', 'depots'],
  control: ['app/central-depositos/controle-de-itens/page.tsx', 'control'],
};

const legacyRoutes = {
  stock: ['app/central-depositos/estoque/page.tsx', '/central-depositos/controle-de-itens?aba=stock'],
  movements: ['app/central-depositos/movimentacoes/page.tsx', '/central-depositos/controle-de-itens?aba=movements'],
  locations: ['app/central-depositos/localizacoes/page.tsx', '/central-depositos/controle-de-depositos?aba=estrutura'],
  warehouseView: ['app/central-depositos/visao-do-deposito/page.tsx', '/central-depositos/controle-de-depositos?aba=croquis'],
  inventory: ['app/central-depositos/inventario/page.tsx', '/central-depositos/controle-de-itens?aba=inventory'],
  siscofis: ['app/central-depositos/siscofis-conciliacao/page.tsx', '/central-depositos/cadastro-de-itens?aba=siscofis'],
  deliveries: ['app/central-depositos/entregas/page.tsx', '/central-depositos/controle-de-itens?aba=deliveries'],
  settings: ['app/central-depositos/configuracoes/page.tsx', '/central-depositos/controle-de-itens?aba=settings'],
  expressOutbound: ['app/central-depositos/saida-expressa/page.tsx', '/central-depositos/saida-de-material'],
};

test('walking skeleton possui layout protegido, seis superfícies atuais e redirects legados', () => {
  const layout = read('app/central-depositos/layout.tsx');
  assert.match(layout, /WarehouseProtectedLayout/);

  for (const [id, [path, section]] of Object.entries(primaryRoutes)) {
    const source = read(path);
    assert.match(source, /WarehouseRouteContent/);
    assert.equal(source.includes('WarehouseProtectedSurface'), false);
    assert.ok(source.includes(`section="${section}"`), `${id} deve apontar para ${section}`);
  }

  for (const [id, [path, target]] of Object.entries(legacyRoutes)) {
    const source = read(path);
    assert.match(source, /redirect/);
    assert.ok(source.includes(target), `${id} deve redirecionar para ${target}`);
  }
});

test('navegação interna expõe a arquitetura modular atual', () => {
  const navigation = read('features/warehouse/navigation.ts');
  for (const label of [
    'Início',
    'Meus Depósitos',
    'Alocação de Material',
    'Saída de Material',
    'Controle de Depósitos',
    'Controle de Materiais',
  ]) {
    assert.ok(navigation.includes(`label: '${label}'`), `Navegação ausente: ${label}`);
  }

  const section = read('features/warehouse/components/WarehouseSectionContent.tsx');
  for (const component of [
    'WarehouseLandingOperational',
    'WarehouseHomeOperational',
    'WarehouseItemRegistrationOperational',
    'WarehouseMaterialWithdrawal',
    'WarehouseDepotsOperational',
    'WarehouseItemControlOperational',
  ]) {
    assert.ok(section.includes(component), `Superfície modular ausente: ${component}`);
  }
});

test('layout compartilhado preserva gate multi-tenant em todas as rotas principais', () => {
  const gate = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
  assert.ok(gate.includes('resolveAuthenticatedWorkspaceContext(currentUser)'));
  assert.ok(gate.includes('canAccessWarehouseModule(context)'));
  assert.ok(gate.includes("fetch('/api/central-depositos/status'"));
  assert.ok(gate.includes("window.location.replace('/login')"));
});

test('walking skeleton preserva contratos canônicos sem persistência paralela no shell', () => {
  const material = read('lib/warehouse/material.ts');
  const movement = read('lib/warehouse/movement.ts');
  const namespace = read('lib/warehouse/namespace.ts');

  assert.ok(material.includes('WAREHOUSE_MATERIAL_SCHEMA_VERSION'));
  assert.ok(movement.includes('WAREHOUSE_MOVEMENT_SCHEMA_VERSION'));
  assert.ok(movement.includes('WAREHOUSE_BALANCE_SCHEMA_VERSION'));
  assert.ok(movement.includes('WAREHOUSE_MOVEMENT_TYPES'));
  assert.ok(namespace.includes("materials: 'materials'"));
  assert.ok(namespace.includes("movements: 'movements'"));
  assert.ok(namespace.includes("balances: 'balances'"));

  const uiShellSources = [
    read('features/warehouse/components/WarehouseModuleShell.tsx'),
    read('features/warehouse/components/WarehouseSectionContent.tsx'),
    ...Object.values(primaryRoutes).map(([path]) => read(path)),
    ...Object.values(legacyRoutes).map(([path]) => read(path)),
  ].join('\n');

  for (const forbidden of [
    'firebase/firestore',
    'onSnapshot(',
    'getDocs(',
    'setDoc(',
    'addDoc(',
    'runTransaction(',
    'applyWarehouseMovement(',
    'saveWarehouseMaterial(',
  ]) {
    assert.equal(uiShellSources.includes(forbidden), false, `Shell/rotas não devem conter ${forbidden}`);
  }
});

test('capacidades consolidadas estão ligadas às superfícies atuais', () => {
  const registration = read('features/warehouse/components/WarehouseItemRegistrationOperational.tsx');
  const depots = read('features/warehouse/components/WarehouseDepotsOperational.tsx');
  const control = read('features/warehouse/components/WarehouseItemControlOperational.tsx');

  assert.ok(registration.includes('WarehouseSiscofisOperational'));
  assert.ok(registration.includes('InvoiceRegistrationQueue'));
  // PR #366 unificou cadastro e locais no Croqui 2D; não reintroduzir subaba legada.
  assert.ok(!depots.includes('WarehouseLocationsR1Operational'));
  assert.ok(depots.includes('WarehouseCroquisR1Operational'));

  for (const component of [
    'WarehouseItemControlSummary',
    'WarehouseStockOperational',
    'WarehouseMovementsOperational',
    'WarehouseInventoryOperational',
    'WarehouseLogisticsReports',
  ]) {
    assert.ok(control.includes(component), `Controle de Materiais perdeu ${component}`);
  }

  const section = read('features/warehouse/components/WarehouseSectionContent.tsx');
  assert.ok(section.includes('WarehouseMaterialWithdrawal'));
  assert.ok(section.includes("section === 'outbound'"));
});

test('shell reutiliza o chrome responsivo oficial do EMPROVEX', () => {
  const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
  const sidebar = read('features/warehouse/components/WarehouseSidebar.tsx');
  assert.ok(shell.includes('AppHeader'));
  assert.ok(shell.includes('AppBackground'));
  assert.ok(shell.includes('WarehouseSidebar'));
  assert.ok(shell.includes('lg:pl-72'));
  assert.ok(sidebar.includes('emprovex-app-sidebar'));
  assert.ok(sidebar.includes('emprovex-sidebar-nav-item'));
  assert.equal(shell.includes('framer-motion'), false);
});
