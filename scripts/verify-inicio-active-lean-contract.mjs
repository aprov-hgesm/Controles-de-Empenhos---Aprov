#!/usr/bin/env node
/**
 * Contrato da Home vigente (Core Lean/Essencial).
 * Os guards orbitais dos Blocos 19–21 descrevem componentes removidos.
 * Este teste NAO substitui verificacoes de auth, estoque, billing ou dominio:
 * certifica apenas a superficie Inicio realmente publicada.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const view = read('features/inicio/components/InicioView.tsx');
const viewCss = read('features/inicio/components/InicioView.module.css');
const core = read('features/inicio/components/InicioCore.tsx');
const coreCss = read('features/inicio/components/InicioCore.module.css');
const atmosphere = read('features/inicio/components/InicioAtmosphere.tsx');
const constellation = read('features/inicio/components/InicioConstellation.tsx');
const entry = read('features/inicio/components/InicioEntrySequence.tsx');
const profile = read('features/inicio/hooks/useInicioPerformanceProfile.ts');
const snapshot = read('features/inicio/domain/homeOperationalSnapshot.ts');
const subscription = read('lib/operationalSubscriptionPlan.ts');
const login = read('app/login/page.tsx');
const sidebar = read('components/layout/AppSidebar.tsx');

assert(!existsSync('features/inicio/components/InicioOrbitSystem.tsx'),
  'A antiga Home orbital nao deve ser recompilada.');
assert.match(view, /data-lean-home="true"/, 'Home enxuta nao esta ativada.');
assert.match(view, /data-testid="inicio-scene"/);
assert.match(view, /data-performance=\{performanceMode\}/);
assert.match(view, /data-ambient-paused=/);
assert.match(view, /<InicioCore/, 'Nucleo da Home deve ser mantido.');
assert.match(view, /<InicioConstellation/, 'Constelacao operacional deve ser mantida.');
assert.match(view, /<InicioAtmosphere\s*\/>/, 'Camada atmosferica deve ser mantida.');
assert.match(view, /<InicioEntrySequence\s*\/>/, 'Entrada controlada deve ser mantida.');
assert.doesNotMatch(view, /InicioOrbitSystem|<canvas|three\.js|onSnapshot\(/);

assert.match(core, /data-testid="inicio-logo-core"/);
assert.match(core, /src="\/emprovex-logo%20\(2\)\.png"/, 'Logo oficial nao esta no nucleo.');
assert.match(core, /snapshot\?\.alerts\.total/, 'Pendencias devem derivar de snapshot.');
assert.match(core, /aria-label=/, 'Nucleo deve ser acessivel.');
assert.doesNotMatch(core, /onSnapshot\(|firebase\/firestore|<canvas|three\.js/);
assert.match(constellation, /data-testid="inicio-constellation"/);
assert.match(constellation, /aria-label="Constelação operacional de empenhos"/);
assert.match(atmosphere, /InicioAtmosphere/);
assert.match(entry, /useReducedMotion/, 'Entrada precisa respeitar motion reduzido.');

assert.match(viewCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(coreCss, /@media \(prefers-reduced-motion: reduce\)/);
for (const mode of ['balanced','static']) {
  assert(viewCss.includes("[data-performance='"+mode+"']"),
    'Cena nao protege o modo '+mode);
  assert(coreCss.includes("[data-performance='"+mode+"']"),
    'Nucleo nao protege o modo '+mode);
}
assert.match(profile, /prefers-reduced-motion: reduce/);
assert.match(profile, /'static'/);
assert.match(snapshot, /INICIO_MAX_VISIBLE_STARS = 72/, 'Densidade maxima de estrelas alterada.');
assert.match(subscription, /inicio:\s*\{[\s\S]*?invoices: false/, 'Início abriu invoices realtime.');
assert.match(login, /<LegalAcceptanceGate/, 'Aceite juridico ausente da rota operacional.');
assert.match(login, /<InicioView/, 'Home nao esta na rota operacional.');
assert.match(sidebar, /onNavigate\('inicio'\)/, 'Navegacao Início ausente.');

console.log('INICIO ACTIVE LEAN CONTRACT: PASS | Home atual, logo, snapshot, acessibilidade, performance e legal');
