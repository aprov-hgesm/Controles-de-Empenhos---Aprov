import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sidebar = read('components/layout/AppSidebar.tsx');
const css = read('app/globals.css');

test('every visible primary menu option has a non-interactive beam layer', () => {
  const icons = ['Home', 'Layers', 'FileSpreadsheet', 'Building2', 'Package', 'FileText',
    'BellRing', 'TrendingUp', 'CalendarDays', 'Boxes'];
  for (const icon of icons) {
    assert.ok(
      sidebar.includes('<span className="emprovex-sidebar-nav-item__beam" aria-hidden="true" />\n              <' + icon),
      'missing safe beam decoration ahead of the ' + icon + ' navigation icon'
    );
  }
  assert.equal((sidebar.match(/className="emprovex-sidebar-nav-item__beam"/g) ?? []).length, icons.length);
  assert.equal((sidebar.match(/className="emprovex-sidebar-nav-item"/g) ?? []).length, icons.length);
});

test('existing accessible navigation state, click destinations and sign-out remain', () => {
  for (const tab of ['inicio','painel','empenhos','fornecedores','itens','nova_nf',
                     'avisos','relatorios','cronogramas']) {
    assert.ok(sidebar.includes("onNavigate('" + tab + "')"), 'nav callback missing for ' + tab);
  }
  assert.match(sidebar, /aria-current=\{activeTab === 'inicio' \? 'page' : undefined\}/);
  assert.match(sidebar, /aria-current=\{activeTab === 'empenhos' \|\| activeTab === 'itens_empenho' \? 'page' : undefined\}/);
  assert.match(sidebar, /data-testid="nav-adm-deposito"/);
  assert.match(sidebar, /onClick=\{onOpenWarehouse\}/);
  assert.match(sidebar, /onClick=\{onLogout\}/);
});

test('the beam animates only the active desktop tab; reduced motion and forced colors are protected', () => {
  assert.match(css, /\.emprovex-sidebar-nav-item\[data-active='true'\] > \.emprovex-sidebar-nav-item__beam/);
  assert.match(css, /animation: emprovex-active-tab-beam 24s linear infinite paused/);
  assert.match(css, /@media \(min-width: 641px\) and \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@media \(max-width: 640px\), \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /mask-composite: exclude/);
  assert.match(css, /focus-visible > \.emprovex-sidebar-nav-item__beam/);
});
