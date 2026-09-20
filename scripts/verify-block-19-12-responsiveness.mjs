#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const view = read('features/inicio/components/InicioView.tsx');
const viewCss = read('features/inicio/components/InicioView.module.css');
const orbit = read('features/inicio/components/InicioOrbitSystem.tsx');
const orbitCss = read('features/inicio/components/InicioOrbitSystem.module.css');
const constellation = read('features/inicio/components/InicioConstellation.tsx');
const constellationCss = read('features/inicio/components/InicioConstellation.module.css');
const identity = read('features/inicio/components/InicioIdentityPanel.tsx');
const identityCss = read('features/inicio/components/InicioIdentityPanel.module.css');
const quick = read('features/inicio/components/InicioQuickActions.tsx');
const quickCss = read('features/inicio/components/InicioQuickActions.module.css');
const coreCss = read('features/inicio/components/InicioCore.module.css');
const entryCss = read('features/inicio/components/InicioEntrySequence.module.css');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const docs = read('docs/block-19-home-experience.md');

requireText(view, 'data-testid="inicio-scene"', 'Cena não possui âncora E2E responsiva.');
requireText(view, 'data-testid="inicio-system"', 'Sistema solar não possui âncora responsiva.');
requireText(identity, 'data-testid="inicio-identity"', 'Identidade não possui âncora responsiva.');
requireText(quick, 'data-testid="inicio-quick-actions"', 'Dock não possui âncora responsiva.');
requireText(orbit, 'data-testid="inicio-orbit-system"', 'Órbitas não possuem âncora responsiva.');
requireText(constellation, 'data-testid="inicio-constellation"', 'Constelação não possui âncora responsiva.');

requireText(viewCss, '@media (max-width: 1100px)', 'Breakpoint intermediário de desktop/tablet ausente.');
requireText(viewCss, '@media (max-width: 900px)', 'Breakpoint tablet ausente.');
requireText(viewCss, '@media (max-width: 640px)', 'Breakpoint mobile ausente.');
requireText(viewCss, '@media (max-width: 420px)', 'Breakpoint narrow-phone ausente.');
requireText(viewCss, '@media (max-height: 560px) and (min-width: 641px)', 'Tratamento landscape baixo ausente.');
requireText(viewCss, '100svh', 'Cena não usa viewport dinâmica segura.');
requireText(viewCss, '--inicio-mobile-dock-reserve: 132px', 'Reserva explícita do dock mobile ausente.');

requireText(orbitCss, 'bottom: 29%', 'Planeta de recebimentos não foi afastado do dock mobile.');
requireText(orbitCss, '@media (hover: none), (pointer: coarse)', 'Órbitas não tratam touch/coarse pointer.');
requireText(orbitCss, '.tooltip {\n    display: none;', 'Tooltips orbitais continuam dependentes de hover em touch.');

requireText(constellationCss, 'bottom: 132px', 'Legenda não reserva espaço para o dock mobile.');
requireText(constellationCss, '.densityNote {\n    display: none !important;', 'Legenda mobile não reduz informação secundária.');
requireText(constellationCss, ".star::before", 'Estrelas não possuem área touch expandida.');
requireText(constellationCss, '@media (hover: none), (pointer: coarse)', 'Constelação não trata coarse pointer.');

requireText(identityCss, '@media (max-width: 420px)', 'Identidade não possui compactação narrow-phone.');
requireText(identityCss, '@media (max-height: 560px) and (min-width: 641px)', 'Identidade não compacta em landscape baixo.');
requireText(quickCss, 'grid-template-columns: repeat(5, minmax(0, 1fr))', 'Dock não distribui ações sem overflow.');
requireText(quickCss, 'min-height: 44px', 'Ações mobile não preservam alvo touch mínimo.');
requireText(coreCss, 'width: clamp(116px, 31vw, 132px)', 'Núcleo não escala para celular.');
requireText(entryCss, '@media (max-width: 420px)', 'Sequência de entrada não trata telas estreitas.');

requireText(e2e, "phone-small', width: 360, height: 800", 'E2E não cobre 360x800.');
requireText(e2e, "phone-standard', width: 390, height: 844", 'E2E não cobre 390x844.');
requireText(e2e, "tablet-portrait', width: 768, height: 1024", 'E2E não cobre tablet portrait.');
requireText(e2e, "phone-landscape', width: 844, height: 390", 'E2E não cobre landscape.');
requireText(e2e, 'document.documentElement.scrollWidth', 'E2E não verifica overflow horizontal.');
requireText(e2e, 'expectResponsiveInicio', 'E2E não possui contrato responsivo reutilizável.');
requireText(docs, 'Bloco 19.12', 'Documentação não registra responsividade completa.');

forbidText(viewCss, 'width: 126vw', 'Sistema móvel voltou ao oversizing de 126vw.');
forbidText(quickCss, 'overflow-x: auto', 'Dock voltou a depender de scroll horizontal.');
forbidText(view, 'onSnapshot', 'Responsividade abriu listener Firestore.');
forbidText(quick, 'firebase', 'Dock responsivo acoplou Firebase.');
forbidText(identity, 'firebase', 'Identidade responsiva acoplou Firebase.');

if (findings.length) {
  console.error('BLOCK 19.12 RESPONSIVENESS: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.12 RESPONSIVENESS: READY');
  console.log('Desktop/tablet/mobile/landscape: COBERTOS');
  console.log('Overflow horizontal mobile: PROTEGIDO');
  console.log('Dock mobile: ZONA RESERVADA');
  console.log('Touch/coarse pointer: PROTEGIDO');
  console.log('Firestore adicional: ZERO');
}
