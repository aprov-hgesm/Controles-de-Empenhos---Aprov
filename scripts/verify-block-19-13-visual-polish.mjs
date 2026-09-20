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
const chrome = read('features/inicio/components/InicioSceneChrome.tsx');
const chromeCss = read('features/inicio/components/InicioSceneChrome.module.css');
const identityCss = read('features/inicio/components/InicioIdentityPanel.module.css');
const quickCss = read('features/inicio/components/InicioQuickActions.module.css');
const coreCss = read('features/inicio/components/InicioCore.module.css');
const orbitCss = read('features/inicio/components/InicioOrbitSystem.module.css');
const constellationCss = read('features/inicio/components/InicioConstellation.module.css');
const atmosphereCss = read('features/inicio/components/InicioAtmosphere.module.css');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const docs = read('docs/block-19-home-experience.md');

requireText(view, "import { InicioSceneChrome }", 'InicioView não importa o chrome final.');
requireText(view, '<InicioSceneChrome />', 'InicioView não renderiza o chrome final.');
requireText(chrome, 'data-testid="inicio-scene-chrome"', 'Chrome não possui âncora E2E.');
requireText(chrome, 'aria-hidden="true"', 'Chrome decorativo não está oculto da árvore acessível.');
requireText(chromeCss, 'pointer-events: none', 'Chrome pode interceptar interação.');
requireText(chromeCss, '.cornerTopLeft', 'Chrome não possui cantos técnicos.');
requireText(chromeCss, '.topRail', 'Chrome não possui trilho superior.');
requireText(chromeCss, '.sideScale', 'Chrome não possui escala lateral.');
requireText(chromeCss, '@media (max-width: 640px)', 'Chrome não simplifica em mobile.');

for (const token of [
  '--inicio-line:',
  '--inicio-line-strong:',
  '--inicio-glass:',
  '--inicio-glass-strong:',
  '--inicio-text:',
  '--inicio-muted:',
  '--inicio-blue:',
  '--inicio-amber:',
  '--inicio-critical:',
]) {
  requireText(viewCss, token, `Token visual compartilhado ausente: ${token}`);
}

requireText(viewCss, '.scene::before', 'Cena não possui moldura interna refinada.');
requireText(identityCss, 'var(--inicio-line', 'Identidade não usa material compartilhado.');
requireText(quickCss, 'var(--inicio-glass', 'Dock não usa material compartilhado.');
requireText(coreCss, 'var(--inicio-text', 'Núcleo não usa tipografia compartilhada.');
requireText(orbitCss, 'var(--inicio-line', 'Órbitas não usam material compartilhado.');
requireText(constellationCss, 'var(--inicio-critical', 'Constelação não usa paleta semântica compartilhada.');
requireText(atmosphereCss, '.horizon::after', 'Atmosfera não recebeu acabamento de horizonte.');
requireText(e2e, "getByTestId('inicio-scene-chrome')", 'E2E não valida o chrome final.');
requireText(docs, 'Bloco 19.13', 'Documentação não registra o polimento final.');

forbidText(chromeCss, 'animation:', 'Chrome final adicionou animação contínua.');
forbidText(chromeCss, '@keyframes', 'Chrome final adicionou keyframes.');
forbidText(chromeCss, 'filter: blur', 'Chrome final adicionou blur caro.');
forbidText(chromeCss, 'backdrop-filter', 'Chrome final adicionou backdrop-filter.');
forbidText(chrome, 'firebase', 'Chrome final acoplou Firebase.');
forbidText(chrome, 'onSnapshot', 'Chrome final abriu listener Firestore.');
forbidText(chrome, 'useEffect', 'Chrome final adicionou efeito de runtime desnecessário.');

if (findings.length) {
  console.error('BLOCK 19.13 VISUAL POLISH: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.13 VISUAL POLISH: READY');
  console.log('Chrome técnico estático: ATIVO');
  console.log('Materiais visuais compartilhados: ATIVOS');
  console.log('Animações adicionais: ZERO');
  console.log('Blur/backdrop no chrome: ZERO');
  console.log('Firestore adicional: ZERO');
}
