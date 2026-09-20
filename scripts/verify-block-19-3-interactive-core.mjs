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

const page = read('app/page.tsx');
const view = read('features/inicio/components/InicioView.tsx');
const core = read('features/inicio/components/InicioCore.tsx');
const coreCss = read('features/inicio/components/InicioCore.module.css');
const docs = read('docs/block-19-home-experience.md');

requireText(page, 'customLogo={customLogo}', 'Logo institucional não é fornecido ao Início.');
requireText(view, "import { InicioCore }", 'Início não importa o núcleo interativo.');
requireText(view, '<InicioCore', 'Início não renderiza o núcleo interativo.');
requireText(view, 'activeAlertCount={activeAlertCount}', 'Núcleo não recebe contexto agregado de alertas.');
requireText(core, "import Image from 'next/image'", 'Núcleo não usa next/image para o logo.');
requireText(core, 'useReducedMotion', 'Núcleo não respeita reduced motion.');
requireText(core, "root.addEventListener('pointermove'", 'Núcleo não reage ao ponteiro local.');
requireText(core, "'--core-density'", 'Núcleo não deriva intensidade visual da densidade operacional.');
requireText(core, 'totalEmpenhos', 'Núcleo perdeu métrica de empenhos.');
requireText(core, 'totalValueLabel', 'Núcleo perdeu valor total empenhado.');
requireText(coreCss, '.reactor', 'Tratamento visual de reator ausente.');
requireText(coreCss, '.orbitA', 'Primeira órbita do núcleo ausente.');
requireText(coreCss, '.orbitB', 'Segunda órbita do núcleo ausente.');
requireText(coreCss, '.orbitC', 'Terceira órbita do núcleo ausente.');
requireText(coreCss, '.telemetryArc', 'Arco telemétrico do núcleo ausente.');
requireText(coreCss, '@media (prefers-reduced-motion: reduce)', 'Núcleo não protege movimento reduzido.');
requireText(docs, 'Bloco 19.3', 'Documentação não registra o núcleo interativo.');
forbidText(core, 'three.js', 'Núcleo introduziu Three.js indevidamente.');
forbidText(core, '<canvas', 'Núcleo introduziu canvas indevidamente.');
forbidText(core, 'onSnapshot', 'Núcleo abriu listener Firestore indevido.');

if (findings.length) {
  console.error('BLOCK 19.3 INTERACTIVE CORE: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.3 INTERACTIVE CORE: READY');
  console.log('Logo institucional: INTEGRADO');
  console.log('Resposta ao ponteiro: ATIVA');
  console.log('Órbitas + telemetria: ATIVAS');
  console.log('Reduced motion: PRESERVADO');
  console.log('Firestore adicional: ZERO');
}
