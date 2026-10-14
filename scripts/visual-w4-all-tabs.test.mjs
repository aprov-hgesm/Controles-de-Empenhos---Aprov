import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const MATRIX = [
  ['inicio', 'features/inicio/components/InicioSceneChrome.tsx', 'tab-beam-inicio', 'travel'],
  ['painel', 'features/dashboard/components/DashboardView.tsx', 'dashboard-balance-border-beam', 'travel'],
  ['empenhos', 'features/empenhos/components/EmpenhosView.tsx', 'tab-beam-empenhos', 'focus'],
  ['fornecedores', 'features/fornecedores/components/FornecedoresView.tsx', 'tab-beam-fornecedores', 'travel'],
  ['itens', 'features/itens/components/ConsultaItensView.tsx', 'tab-beam-itens', 'travel'],
  ['nova_nf', 'features/notas-fiscais/components/NotasFiscaisView.tsx', 'tab-beam-nova-nf', 'focus'],
  ['relatorios', 'features/relatorios/components/RelatoriosView.tsx', 'reports-tabs-border-beam', 'focus'],
  ['itens_empenho', 'features/empenhos/components/ItensEmpenhoView.tsx', 'tab-beam-itens-empenho', 'focus'],
  ['cronogramas', 'features/cronogramas/components/CronogramasView.tsx', 'tab-beam-cronogramas', 'travel'],
  ['avisos', 'features/avisos/components/CentralAvisosView.tsx', 'tab-beam-avisos', 'focus'],
];

test('every main operational tab has one real monochrome beam placement', () => {
  const surfaces = read('components/layout/OperationalSurfaceTransition.tsx');
  assert.equal(MATRIX.length, 10);
  for (const [tab, path, testId, variant] of MATRIX) {
    assert.match(surfaces, new RegExp('^  ' + tab + ':', 'm'));
    const code = read(path);
    assert.ok(code.includes('import { EmprovexBorderBeam }'), `missing import: ${tab}`);
    assert.ok(code.includes(`testId="${testId}"`), `missing actual placement: ${tab}`);
    assert.ok(code.includes(`variant="${variant}"`), `incorrect variant: ${tab}`);
    assert.equal(code.split('<EmprovexBorderBeam').length - 1, 1, `one beam per tab file: ${tab}`);
    assert.equal(code.split('</EmprovexBorderBeam>').length - 1, 1, `matched wrapper: ${tab}`);
  }
});

test('Home Orb R2 stays centered and only the small top rail receives a beam', () => {
  const scene = read('features/inicio/components/InicioSceneChrome.tsx');
  const core = read('features/inicio/components/InicioCore.tsx');
  const viewStyles = read('features/inicio/components/InicioView.module.css');
  assert.ok(scene.includes('className={styles.topRailContent}'));
  assert.ok(scene.includes('tab-beam-inicio'));
  assert.ok(!scene.includes('EmprovexThinkingOrb'));
  assert.ok(core.includes('palette="colored"'));
  assert.ok(core.includes('refinement="r2"'));
  assert.ok(viewStyles.includes('.system {')); 
  assert.ok(viewStyles.includes('top: 50%;'));
});

test('the border is decoration only and motion/accessibility guards remain', () => {
  const css = read('components/visual/EmprovexBorderBeam.module.css');
  const beam = read('components/visual/EmprovexBorderBeam.tsx');
  const app = read('app/page.tsx');
  assert.ok(css.includes('pointer-events: none'));
  assert.ok(css.includes('prefers-reduced-motion: reduce'));
  assert.ok(css.includes('max-width: 640px'));
  assert.ok(beam.includes('pauseWhenOffscreen = true'));
  assert.ok(beam.includes("duration = 24"));
  assert.ok(app.includes("activeTab === 'inicio'"));
  const examples = read('components/visual/EmprovexAllTabBeamPreview.tsx');
  assert.ok(examples.includes('SURFACES'));
  for (const [tab] of MATRIX) assert.ok(examples.includes(`id: '${tab}'`));
});
