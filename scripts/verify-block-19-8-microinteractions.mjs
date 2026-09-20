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
const layer = read('features/inicio/components/InicioInteractionLayer.tsx');
const layerCss = read('features/inicio/components/InicioInteractionLayer.module.css');
const coreCss = read('features/inicio/components/InicioCore.module.css');
const orbitCss = read('features/inicio/components/InicioOrbitSystem.module.css');
const constellationCss = read('features/inicio/components/InicioConstellation.module.css');
const quickCss = read('features/inicio/components/InicioQuickActions.module.css');
const docs = read('docs/block-19-home-experience.md');

requireText(view, "import { InicioInteractionLayer }", 'Início não importa a camada de microinterações.');
requireText(view, '<InicioInteractionLayer sceneRef={rootRef}', 'Camada de microinterações não está vinculada ao cenário.');
requireText(layer, "closest(", 'Retículo não detecta elementos interativos.');
requireText(layer, "button, a, [role=\"button\"], [tabindex]", 'Allowlist de alvos interativos ausente.');
requireText(layer, "pointermove", 'Camada não acompanha o ponteiro.');
requireText(layer, "pointerdown", 'Camada não reage ao acionamento.');
requireText(layer, "requestAnimationFrame", 'Movimento do retículo não usa RAF.');
requireText(layerCss, ".root[data-target='true'] .reticle", 'Retículo não diferencia alvo interativo.');
requireText(layerCss, ".root[data-pulse='true'] .pulse", 'Pulso de clique ausente.');
requireText(layerCss, '@media (pointer: coarse)', 'Microinterações não são desligadas em ponteiro coarse.');
requireText(layerCss, '@media (prefers-reduced-motion: reduce)', 'Microinterações não respeitam reduced motion.');
requireText(coreCss, '.root:active', 'Núcleo não possui resposta de pressionamento.');
requireText(orbitCss, '.planet:active .planetSurface', 'Planetas não possuem resposta de pressionamento.');
requireText(constellationCss, '.star:active', 'Estrelas não possuem resposta de pressionamento.');
requireText(quickCss, '.action:active', 'Ações rápidas não possuem resposta de pressionamento.');
requireText(docs, 'Bloco 19.8', 'Documentação não registra microinterações.');

forbidText(layerCss, 'cursor: none', 'Cursor nativo foi ocultado indevidamente.');
forbidText(layer, 'Audio(', 'Microinterações introduziram áudio.');
forbidText(layer, 'navigator.vibrate', 'Microinterações introduziram vibração/haptics.');
forbidText(layer, 'onSnapshot', 'Microinterações abriram listener Firestore.');
forbidText(layer, 'firebase', 'Microinterações acoplaram Firebase.');
forbidText(layer, '<canvas', 'Microinterações introduziram Canvas.');
forbidText(layer, 'three.js', 'Microinterações introduziram Three.js.');

if (findings.length) {
  console.error('BLOCK 19.8 MICROINTERACTIONS: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.8 MICROINTERACTIONS: READY');
  console.log('Retículo contextual: ATIVO');
  console.log('Pulso de interação: ATIVO');
  console.log('Resposta tátil visual: ATIVA');
  console.log('Cursor nativo: PRESERVADO');
  console.log('Reduced motion/coarse pointer: PROTEGIDOS');
  console.log('Firestore adicional: ZERO');
}
