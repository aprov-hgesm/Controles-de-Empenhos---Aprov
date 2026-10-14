import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('all ten sidebar destinations have identical decorative beams without changing navigation contracts', () => {
  const source = read('components/layout/AppSidebar.tsx');
  const scope = source.slice(source.indexOf('<nav className="emprovex-sidebar-nav'), source.indexOf('</nav>'));
  const count = (scope.match(/data-emprovex-nav-beam="true"/g) ?? []).length;
  assert.equal(count, 10);
  for (const key of ['inicio','painel','empenhos','fornecedores','itens','nova_nf','avisos','relatorios','cronogramas']) {
    assert.match(scope, new RegExp("onNavigate\\('"+key+"'\\)"));
  }
  assert.match(scope, /onOpenWarehouse/);
  assert.match(scope, /aria-current=/);
  assert.match(scope, /aria-label=\{\x60\$\{noticeCount\} aviso/);
  assert.match(source, /onLogout/);
  assert.match(scope, /beamStyles\.beam/);
});

test('all five bottom navigation tabs preserve actual click callbacks and selection', () => {
  const source = read('components/layout/MobileNavigation.tsx');
  assert.equal((source.match(/data-emprovex-nav-beam="true"/g) ?? []).length, 5);
  assert.equal((source.match(/data-active=\{/g) ?? []).length, 5);
  for (const key of ['painel','empenhos','nova_nf','relatorios','cronogramas']) {
    assert.match(source, new RegExp("setActiveTab\\('"+key+"'\\)"));
  }
  assert.match(source, /setSelectedEmpenhoDetailId\(null\)/);
});

test('beam stays monochrome, noninteractive, static on mobile and reduced motion', () => {
  const css = read('components/layout/OperationalNavigationBeam.module.css');
  assert.match(css, /24s linear infinite/);
  assert.match(css, /rgb\(231 237 246/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /animation-play-state: paused/);
  assert.match(css, /\[data-active='true'\]/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /#FFD25A|#FF5A46|rgba?\(255,\s*210,\s*90/);
  const lab = read('components/visual/EmprovexNavigationBeamPreview.tsx');
  assert.match(lab, /Nenhuma navegação nem operação foi executada/);
  assert.match(lab, /setActive\(destination\)/);
});

test('six additional operational screens receive only a single scoped header or tab beam', () => {
  const routes = [
    ['features/fornecedores/components/FornecedoresView.tsx', 'suppliers-header-border-beam', 'travel'],
    ['features/itens/components/ConsultaItensView.tsx', 'items-header-border-beam', 'travel'],
    ['features/avisos/components/CentralAvisosView.tsx', 'notices-header-border-beam', 'travel'],
    ['features/cronogramas/components/CronogramasView.tsx', 'schedules-header-border-beam', 'travel'],
    ['features/empenhos/components/EmpenhosView.tsx', 'commitments-tabs-border-beam', 'focus'],
    ['features/notas-fiscais/components/NotasFiscaisView.tsx', 'invoices-tabs-border-beam', 'focus'],
  ];
  for (const [path, id, variant] of routes) {
    const view = read(path);
    assert.match(view, /EmprovexBorderBeam/);
    assert.equal(view.split(`testId="${id}"`).length - 1, 1, path);
    assert.match(view, new RegExp('variant="' + variant + '"'));
    assert.match(view, /intensity="low"/);
    assert.match(view, /theme="light"/);
  }
  // Existing W4 assignments stay untouched in the parent PR.
  assert.match(read('features/dashboard/components/DashboardView.tsx'), /dashboard-balance-border-beam/);
  assert.match(read('features/relatorios/components/RelatoriosView.tsx'), /reports-tabs-border-beam/);
});
