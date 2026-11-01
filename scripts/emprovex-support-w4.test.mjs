import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Ajuda autenticada disponível nos dois menus sem criar abas ou rotas', () => {
  const main = read('app/login/page.tsx');
  const warehouse = read('features/warehouse/components/WarehouseModuleShell.tsx');
  const side = read('components/layout/AppSidebar.tsx');
  const warehouseSide = read('features/warehouse/components/WarehouseSidebar.tsx');
  assert.match(main, /onOpenHelp=\{\(\) =>/);
  assert.match(warehouse, /initialTopic="depositos"/);
  assert.match(side, /data-testid="nav-ajuda"/);
  const primaryNav = side.slice(side.indexOf('<nav className="emprovex-sidebar-nav'), side.indexOf('</nav>'));
  assert.doesNotMatch(primaryNav, /data-testid="nav-ajuda"/); // dez destinos originais intactos
  assert.match(warehouseSide, /data-testid="warehouse-nav-ajuda"/);
  assert.match(main, /const EmprovexHelpOverlay = lazy\(/);
  assert.match(warehouse, /const EmprovexHelpOverlay = lazy\(/);
});

test('Overlay de Ajuda é isolado, fechável e gerencia foco', () => {
  const src = read('features/support/EmprovexHelpOverlay.tsx');
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /onClose\(\)/);
  assert.match(src, /previouslyFocused.focus\(\)/);
  assert.match(src, /event.defaultPrevented/);
  assert.doesNotMatch(src, /firebase|onSnapshot|iframe/);
});

test('W2 preserva proteção founder-only e contratos no servidor', () => {
  const admin = read('app/api/admin/access-requests/route.ts');
  const publicRoute = read('app/api/public/access-requests/route.ts');
  const helper = read('lib/server/accessRequestSupport.ts');
  assert.match(admin, /verifyFounderFirebaseRequest/);
  assert.match(helper, /updateTime/);
  assert.match(publicRoute, /lastRequestedAt/);
});
