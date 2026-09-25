import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const primaryRoutes = {
  overview: ['app/adm-deposito/page.tsx', 'overview'],
  registration: ['app/adm-deposito/cadastro-de-itens/page.tsx', 'registration'],
  depots: ['app/adm-deposito/meus-depositos/page.tsx', 'depots'],
  control: ['app/adm-deposito/controle-de-itens/page.tsx', 'control'],
};

const legacyRoutes = {
  stock: ['app/adm-deposito/estoque/page.tsx', '/adm-deposito/controle-de-itens?aba=stock'],
  movements: ['app/adm-deposito/movimentacoes/page.tsx', '/adm-deposito/controle-de-itens?aba=movements'],
  locations: ['app/adm-deposito/localizacoes/page.tsx', '/adm-deposito/meus-depositos?aba=estrutura'],
  warehouseView: ['app/adm-deposito/visao-do-deposito/page.tsx', '/adm-deposito/meus-depositos?aba=croquis'],
  inventory: ['app/adm-deposito/inventario/page.tsx', '/adm-deposito/controle-de-itens?aba=inventory'],
  siscofis: ['app/adm-deposito/siscofis-conciliacao/page.tsx', '/adm-deposito/cadastro-de-itens?aba=siscofis'],
  deliveries: ['app/adm-deposito/entregas/page.tsx', '/adm-deposito/controle-de-itens?aba=deliveries'],
  settings: ['app/adm-deposito/configuracoes/page.tsx', '/adm-deposito/controle-de-itens?aba=settings'],
};

test('walking skeleton possui as quatro superfícies principais protegidas e redirects legados', () => {
  for (const [id, [path, section]] of Object.entries(primaryRoutes)) {
    const source = read(path);
    assert.match(source, /WarehouseProtectedSurface/);
    assert.ok(source.includes(`section="${section}"`), `${id} deve apontar para ${section}`);
  }

  for (const [id, [path, target]] of Object.entries(legacyRoutes)) {
    const source = read(path);
    assert.match(source, /redirect/);
    assert.ok(source.includes(target), `${id} deve redirecionar para ${target}`);
  }
});

test('navegação interna expõe a arquitetura consolidada oficial', () => {
  const navigation = read('features/warehouse/navigation.ts');
  for (const label of ['Início', 'Cadastro de Itens', 'Meus Depósitos', 'Controle de Itens']) {
    assert.ok(navigation.includes(`label: '${label}'`), `Navegação ausente: ${label}`);
  }

  const section = read('features/warehouse/components/WarehouseSectionContent.tsx');
  for (const component of [
    'WarehouseHomeOperational',
    'WarehouseItemRegistrationOperational',
    'WarehouseDepotsOperational',
    'WarehouseItemControlOperational',
  ]) {
    assert.ok(section.includes(component), `Superfície consolidada ausente: ${component}`);
  }
});

test('layout compartilhado preserva gate founder-only em todas as rotas principais', () => {
  const gate = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
  assert.ok(gate.includes('resolveAuthenticatedWorkspaceContext(currentUser)'));
  assert.ok(gate.includes('canAccessWarehouseModule(context)'));
  assert.ok(gate.includes("fetch('/api/adm-deposito/status'"));
  assert.ok(gate.includes("window.location.replace('/')"));
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

test('capacidades consolidadas estão ligadas às superfícies atuais sem segunda navegação', () => {
  const registration = read('features/warehouse/components/WarehouseItemRegistrationOperational.tsx');
  const depots = read('features/warehouse/components/WarehouseDepotsOperational.tsx');
  const control = read('features/warehouse/components/WarehouseItemControlOperational.tsx');

  assert.ok(registration.includes('WarehouseSiscofisOperational'));
  assert.ok(depots.includes('WarehouseLocationsOperational'));
  assert.ok(depots.includes('WarehouseDepotViewOperational'));

  for (const component of [
    'WarehouseStockOperational',
    'WarehouseExpressOutbound',
    'WarehouseMovementsOperational',
    'WarehouseInventoryOperational',
    'WarehouseDeliveriesOperational',
    'WarehouseLogisticsAlerts',
    'WarehouseLogisticsSettings',
  ]) {
    assert.ok(control.includes(component), `Controle de Itens perdeu ${component}`);
  }
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
