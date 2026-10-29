#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const canonical = '/central-depositos';
const legacy = '/adm-deposito';

const next = read('next.config.ts');
assert.match(next, /async redirects\(\)/);
assert.match(next, /source: '\/adm-deposito', destination: '\/central-depositos', permanent: true/);
assert.match(next, /source: '\/adm-deposito\/:path\*', destination: '\/central-depositos\/:path\*', permanent: true/);

const mainRoutes = ['',
  '/meus-depositos', '/cadastro-de-itens', '/saida-de-material',
  '/controle-de-depositos', '/controle-de-itens',
];
const aliases = [
  '/alertas', '/configuracoes', '/entregas', '/estoque', '/inventario',
  '/localizacoes', '/movimentacoes', '/relatorios',
  '/saida-expressa', '/siscofis-conciliacao', '/visao-do-deposito',
];
for (const suffix of [...mainRoutes, ...aliases]) {
  assert.equal(existsSync(resolve(root, 'app/central-depositos' + suffix + '/page.tsx')), true,
    'A rota canônica está ausente: ' + canonical + suffix);
}
assert.equal(existsSync(resolve(root, 'app/central-depositos/layout.tsx')), true);
assert.equal(existsSync(resolve(root, 'app/adm-deposito')), false,
  'Páginas antigas precisam usar redirect Next.js, sem duplicar código.');

// Operador Móvel é extensão operacional protegida, não módulo independente.
const operatorRoutes = ['',
  '/alocar', '/avulso', '/transferir', '/consultar-localizacao',
  '/consultar-item', '/inventario', '/saida', '/conferir',
];
for (const suffix of operatorRoutes) {
  assert.equal(existsSync(resolve(root, 'app/operador-movel' + suffix + '/page.tsx')), true,
    'Rota canônica do Operador Móvel ausente: /operador-movel' + suffix);
}
assert.equal(existsSync(resolve(root, 'app/operador-movel/layout.tsx')), true);
assert.equal(existsSync(resolve(root, 'app/central-mobile')), false);
assert.match(next, /source: '\/central-mobile', destination: '\/operador-movel', permanent: true/);
assert.match(next, /source: '\/central-mobile\/:path\*', destination: '\/operador-movel\/:path\*', permanent: true/);
const operatorLayout = read('app/operador-movel/layout.tsx');
assert.match(operatorLayout, /Operador Móvel · Central de Depósitos/);
assert.match(operatorLayout, /WarehouseMobileProtectedLayout/);
assert.match(read('features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx'), /HGESM_SECTOR_EMAIL/);
const operatorShell = read('features/warehouse/mobile/WarehouseMobileShell.tsx');
assert.match(operatorShell, /usePathname/);
assert.match(operatorShell, /isOperatorHome/);
assert.match(operatorShell, /!isOperatorHome &&/);
assert.match(operatorShell, /Voltar às operações/);
assert.match(operatorShell, /Menu do Operador Móvel/);
assert.match(operatorShell, /aria-label="Voltar à lista de operações do Operador Móvel"/);
assert.match(operatorShell, /data-testid="warehouse-mobile-nav-home"/);
assert.doesNotMatch(operatorShell, /warehouse-mobile-nav-desktop/);
assert.doesNotMatch(operatorShell, />\s*Central\s*</);
const operatorHome = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
assert.match(operatorHome, /Operador Móvel/);
assert.match(operatorHome, /href: '\/operador-movel\/avulso'/);
assert.match(operatorHome, /href: '\/operador-movel\/alocar'/);
const operatorSidebar = read('features/warehouse/components/WarehouseSidebar.tsx');
assert.match(operatorSidebar, /href="\/operador-movel"/);
assert.match(operatorSidebar, /warehouse-nav-operador-movel/);
assert.match(operatorSidebar, /showMobileAccess &&/);
assert.ok(operatorSidebar.indexOf('{WAREHOUSE_SECTIONS.map(')
  < operatorSidebar.indexOf('{showMobileAccess && ('),
  'Operador Móvel deve aparecer depois das operações da Central de Depósitos');
assert.doesNotMatch(operatorSidebar, /Central Móvel/);

const metadata = read('app/central-depositos/layout.tsx');
assert.match(metadata, /Central de Depósitos · EMPROVEX/);
assert.match(metadata, /WarehouseProtectedLayout/);

const nav = read('features/warehouse/navigation.ts');
assert.match(nav, /href: '\/central-depositos'/);
assert.doesNotMatch(nav, /\/adm-deposito/);
const rootEntry = read('app/page.tsx');
const operationalEntry = rootEntry.includes("export { default } from './login/page'")
  ? read('app/login/page.tsx') : rootEntry;
assert.match(operationalEntry, /window\.location\.assign\(/, 'Atalho para Central perdido.');
assert.match(operationalEntry, /\/central-depositos\/controle-de-itens/, 'Modo Essencial perdeu acesso à Central.');
assert.match(operationalEntry, /: '\/central-depositos'/, 'Modo Normal perdeu acesso à Central.');
assert.match(operationalEntry, /canAccessWarehouseModule\(workspaceContext\)/, 'Gate de módulo Warehouse removido.');
assert.match(read('features/warehouse/mobile/WarehouseMobileShell.tsx'), /href="\/central-depositos"/);
assert.match(read('features/warehouse/components/WarehouseLandingOperational.tsx'), /\/central-depositos\/meus-depositos/);
assert.match(read('components/layout/AppSidebar.tsx'), /data-testid="nav-central-depositos"/);

const protectedSurface = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
assert.match(protectedSurface, /WarehouseAccessBoundary/);
assert.match(protectedSurface, /\/api\/central-depositos\/status/);
assert.match(read('lib/warehouse/intakeActionClient.ts'), /\/api\/central-depositos\/intake-action/);

for (const [name,verb] of [['status', 'GET'], ['intake-action', 'POST']]) {
  const official = read('app/api/central-depositos/' + name + '/route.ts');
  const alias = read('app/api/adm-deposito/' + name + '/route.ts');
  assert.match(official, new RegExp('export async function ' + verb + '\\('));
  assert.ok(alias.includes("export { " + verb + " } from '../../central-depositos/" + name + "/route';"),
    'Alias legado de API não preserva o handler autenticado: ' + name);
}
assert.match(read('app/api/central-depositos/intake-action/route.ts'), /verifyWarehouseRequest/);
assert.match(read('app/api/central-depositos/status/route.ts'), /verifyWarehouseRequest/);

const phase3 = read('scripts/verify-adm-deposito-phase-3.mjs');
assert.match(phase3, /app\/central-depositos\/layout\.tsx/);
assert.match(phase3, /\/api\/central-depositos\/status/);
const core = read('scripts/verify-emprovex-core-protection.mjs');
assert.match(core, /app\/central-depositos/);
assert.match(core, /app\/api\/central-depositos/);

const namespace = read('lib/warehouse/namespace.ts');
assert.match(namespace, /WAREHOUSE_NAMESPACE_ROOT = 'warehouse'/);
assert.match(namespace, /WAREHOUSE_NAMESPACE_VERSION = 'warehouse_v1'/);
assert.match(read('docs/adm-deposito/DECISIONS.md'), /D-123 — Central de Depósitos/);

console.log('CENTRAL-DEPOSITOS-ROUTES: PASS — rota canônica, aliases, guard e domínio preservados');
