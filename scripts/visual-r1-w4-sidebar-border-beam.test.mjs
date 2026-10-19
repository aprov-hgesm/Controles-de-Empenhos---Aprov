import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('all ten primary destinations preserve accessible native controls and share one decoration', () => {
  const sidebar = read('components/layout/AppSidebar.tsx');
  const nav = sidebar.slice(sidebar.indexOf('<nav className="emprovex-sidebar-nav'), sidebar.indexOf('</nav>'));
  assert.equal((nav.match(/className="emprovex-sidebar-nav-item"/g) ?? []).length, 10);
  assert.equal((nav.match(/data-emprovex-nav-beam="true"/g) ?? []).length, 10);
  assert.equal((nav.match(/aria-hidden="true" \/>/g) ?? []).length >= 10, true);
  for (const tab of ['inicio', 'painel', 'empenhos', 'fornecedores', 'itens', 'nova_nf', 'avisos', 'relatorios', 'cronogramas']) {
    assert.ok(nav.includes("onNavigate('" + tab + "')"), 'navigation callback changed: ' + tab);
  }
  assert.match(nav, /aria-current=/);
  const warehouseStart = nav.indexOf('data-testid="nav-central-depositos"');
  const warehouse = nav.slice(warehouseStart, nav.indexOf('</button>', warehouseStart));
  assert.ok(warehouseStart > 0);
  assert.match(warehouse, /onClick=\{onOpenWarehouse\}/);
  assert.doesNotMatch(warehouse, /data-active=/);
  assert.match(sidebar, /onClick=\{onLogout\}/);
});

test('one canonical modular beam, mobile motion safety, focus and contrast protections', () => {
  const css = read('components/layout/OperationalNavigationBeam.module.css');
  const sidebar = read('components/layout/AppSidebar.tsx');
  const globals = read('app/globals.css');
  assert.match(sidebar, /import beamStyles from '.\/OperationalNavigationBeam.module.css'/);
  assert.doesNotMatch(sidebar, /emprovex-sidebar-nav-item__beam/);
  assert.doesNotMatch(globals, /emprovex-sidebar-nav-item__beam/);
  assert.match(css, /24s linear infinite/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /animation-play-state: paused/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(min-width: 641px\) and \(max-width: 1023px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /display: none !important/);
  assert.match(css, /mask-composite: exclude/);
});


test('sidebar navigation follows operational workflow, preserving the ten native destinations', () => {
  const sidebar = read('components/layout/AppSidebar.tsx');
  const css = read('app/globals.css');
  const nav = sidebar.slice(sidebar.indexOf('<nav className="emprovex-sidebar-nav'), sidebar.indexOf('</nav>'));
  const groups = ['overview', 'management', 'follow-up', 'warehouse'];
  let previousGroup = -1;
  for (const id of groups) {
    const at = nav.indexOf('data-nav-group="' + id + '"');
    assert.ok(at > previousGroup, 'sidebar group absent or unordered: ' + id);
    previousGroup = at;
  }
  const orderedTabs = ['inicio', 'painel', 'empenhos', 'nova_nf', 'itens', 'fornecedores', 'cronogramas', 'relatorios', 'avisos'];
  let previousItem = -1;
  for (const id of orderedTabs) {
    const at = nav.indexOf("onNavigate('" + id + "')");
    assert.ok(at > previousItem, 'navigation must follow workflow: ' + id);
    previousItem = at;
  }
  assert.equal((nav.match(/className="emprovex-sidebar-nav-item"/g) ?? []).length, 10);
  assert.equal((nav.match(/data-emprovex-nav-beam="true"/g) ?? []).length, 10);
  assert.match(nav, /warehouseModuleEnabled && onOpenWarehouse && \(/);
  assert.match(nav, /data-testid="nav-central-depositos"/);
  assert.match(css, /\.emprovex-sidebar-nav-group--warehouse/);
  assert.match(css, /\.emprovex-sidebar-nav-group__heading/);
});

test('external sectors regain warehouse shortcut without bypassing authorization', () => {
  const page = read('app/page.tsx');
  const access = read('lib/platformModuleAccess.ts');
  const boundary = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
  assert.match(page, /warehouseModuleEnabled=\{canAccessWarehouseModule\(workspaceContext\)\}/);
  assert.doesNotMatch(page, /workspaceContext\.workspaceId === HGESM_WORKSPACE_ID/);
  assert.match(access, /context\.status === 'sector'/);
  assert.match(access, /context\.canLoadOperationalData/);
  assert.match(access, /Boolean\(context\.workspaceId\)/);
  assert.match(boundary, /canAccessWarehouseModule\(context\)/);
  assert.match(boundary, /requestWarehouseStatus\(currentUser/);
  assert.match(boundary, /authorization\.status\.workspaceId !== context\.workspaceId/);
  assert.match(boundary, /setGateState\('allowed'\)/);
});
