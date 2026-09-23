import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const routes = {
  overview: ['app/adm-deposito/page.tsx', 'overview'],
  stock: ['app/adm-deposito/estoque/page.tsx', 'stock'],
  movements: ['app/adm-deposito/movimentacoes/page.tsx', 'movements'],
  locations: ['app/adm-deposito/localizacoes/page.tsx', 'locations'],
  warehouseView: ['app/adm-deposito/visao-do-deposito/page.tsx', 'warehouseView'],
  inventory: ['app/adm-deposito/inventario/page.tsx', 'inventory'],
  siscofis: ['app/adm-deposito/siscofis-conciliacao/page.tsx', 'siscofis'],
  deliveries: ['app/adm-deposito/entregas/page.tsx', 'deliveries'],
  settings: ['app/adm-deposito/configuracoes/page.tsx', 'settings'],
};

test('walking skeleton possui as nove superfícies estruturais roteáveis', () => {
  for (const [id, [path, section]] of Object.entries(routes)) {
    const source = read(path);
    assert.match(source, /WarehouseProtectedSurface/);
    assert.ok(source.includes(`section="${section}"`), `${id} deve apontar para ${section}`);
  }
});

test('navegação interna expõe todas as superfícies oficiais', () => {
  const navigation = read('features/warehouse/navigation.ts');
  for (const label of [
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
    assert.ok(navigation.includes(`label: '${label}'`), `Navegação ausente: ${label}`);
  }
});

test('layout compartilhado preserva gate founder-only em todas as rotas', () => {
  const gate = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
  assert.ok(gate.includes('resolveAuthenticatedWorkspaceContext(currentUser)'));
  assert.ok(gate.includes('canAccessWarehouseModule(context)'));
  assert.ok(gate.includes("fetch('/api/adm-deposito/status'"));
  assert.ok(gate.includes("window.location.replace('/')"));
});

test('walking skeleton reutiliza contratos oficiais sem persistência paralela', () => {
  const content = read('features/warehouse/components/WarehouseSectionContent.tsx');
  assert.ok(content.includes('WAREHOUSE_MATERIAL_SCHEMA_VERSION'));
  assert.ok(content.includes('WAREHOUSE_MOVEMENT_SCHEMA_VERSION'));
  assert.ok(content.includes('WAREHOUSE_BALANCE_SCHEMA_VERSION'));
  assert.ok(content.includes('WAREHOUSE_MOVEMENT_TYPES'));

  const uiSources = [
    read('features/warehouse/components/WarehouseModuleShell.tsx'),
    content,
    ...Object.values(routes).map(([path]) => read(path)),
  ].join('\n');

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
    assert.equal(uiSources.includes(forbidden), false, `Walking Skeleton não deve conter ${forbidden}`);
  }
});

test('estados futuros são explícitos e não simulam indicadores', () => {
  const content = read('features/warehouse/components/WarehouseSectionContent.tsx');
  assert.ok(content.includes('Capacidade futura'));
  assert.ok(content.includes('não exibe números fictícios'));
  assert.ok(content.includes('Nenhuma consulta automática ou listener'));
});

test('shell nasce responsivo e sem depender de animações pesadas', () => {
  const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
  assert.ok(shell.includes('overflow-x-hidden'));
  assert.ok(shell.includes('sm:grid-cols-3'));
  assert.ok(shell.includes('lg:grid-cols-[250px_minmax(0,1fr)]'));
  assert.equal(shell.includes('framer-motion'), false);
});
