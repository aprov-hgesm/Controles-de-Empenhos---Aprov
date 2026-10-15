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

const metadata = read('app/central-depositos/layout.tsx');
assert.match(metadata, /Central de Depósitos · EMPROVEX/);
assert.match(metadata, /WarehouseProtectedLayout/);

const nav = read('features/warehouse/navigation.ts');
assert.match(nav, /href: '\/central-depositos'/);
assert.doesNotMatch(nav, /\/adm-deposito/);
assert.match(read('app/page.tsx'), /window\.location\.assign\('\/central-depositos'\)/);
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
