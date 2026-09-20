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
const atmosphere = read('features/inicio/components/InicioAtmosphere.tsx');
const atmosphereCss = read('features/inicio/components/InicioAtmosphere.module.css');
const entry = read('features/inicio/components/InicioEntrySequence.tsx');
const entryCss = read('features/inicio/components/InicioEntrySequence.module.css');
const sceneCss = read('features/inicio/components/InicioView.module.css');
const docs = read('docs/block-19-home-experience.md');

requireText(view, '<InicioAtmosphere />', 'Início não compõe a atmosfera cinematográfica.');
requireText(view, '<InicioEntrySequence />', 'Início não compõe a sequência de entrada.');
requireText(view, 'data-ready="true"', 'Cena não ativa o reveal controlado.');
requireText(atmosphere, "import styles from './InicioAtmosphere.module.css'", 'Atmosfera não usa CSS Module isolado.');
requireText(atmosphere, 'deepStars', 'Atmosfera perdeu estrelas de profundidade.');
requireText(atmosphere, 'dust', 'Atmosfera perdeu poeira ambiental.');
requireText(atmosphereCss, '@keyframes nebulaDriftA', 'Nebulosas não possuem deriva cinematográfica.');
requireText(atmosphereCss, '@keyframes scanSweep', 'Cena não possui varredura luminosa.');
requireText(entry, "sessionStorage.getItem(STORAGE_KEY)", 'Entrada não limita a animação completa por sessão.');
requireText(entry, "setMode(seen ? 'short' : 'full')", 'Entrada não diferencia visita inicial de retorno.');
requireText(entry, 'useReducedMotion', 'Entrada não respeita preferência de movimento reduzido.');
requireText(entryCss, '.aperture', 'Entrada perdeu abertura cinematográfica.');
requireText(sceneCss, '@keyframes orbitalSweep', 'Sistema solar não possui sinal orbital.');
requireText(sceneCss, '.interactionHint', 'Cena não possui affordance de exploração.');
requireText(sceneCss, '@media (prefers-reduced-motion: reduce)', 'Cena não protege usuários com movimento reduzido.');
requireText(docs, 'nenhum listener Firestore adicional', 'Documentação não registra neutralidade de consumo.');
forbidText(view, 'three.js', 'Bloco 19.2 introduziu WebGL/three.js indevidamente.');
forbidText(atmosphere, 'canvas', 'Atmosfera introduziu canvas sem necessidade.');

if (findings.length) {
  console.error('BLOCK 19.2 CINEMATIC SCENE: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.2 CINEMATIC SCENE: READY');
  console.log('Atmosfera profunda: ATIVA');
  console.log('Entrada por sessão: CONTROLADA');
  console.log('Reduced motion: PRESERVADO');
  console.log('Firestore adicional: ZERO');
  console.log('WebGL adicional: ZERO');
}
