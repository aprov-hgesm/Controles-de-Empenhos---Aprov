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
const transition = read('components/layout/OperationalSurfaceTransition.tsx');
const transitionCss = read('components/layout/OperationalSurfaceTransition.module.css');
const plan = read('lib/operationalSubscriptionPlan.ts');
const docs = read('docs/block-19-home-experience.md');

requireText(page, "import { OperationalSurfaceTransition }", 'App não importa a transição operacional.');
requireText(page, '<OperationalSurfaceTransition surfaceKey={activeTab}>', 'Conteúdo operacional não está envolvido pela transição.');
requireText(transition, 'key={surfaceKey}', 'Transição não é reativada por mudança de superfície.');
requireText(transition, 'useReducedMotion', 'Transição não respeita preferência de movimento.');
requireText(transition, 'duration: 0.34', 'Duração curta da transição não está preservada.');
requireText(transition, "filter: 'blur(3px) saturate(0.92)'", 'Entrada visual perdeu o tratamento de profundidade.');
requireText(transition, 'SURFACE_LABELS', 'Transição não identifica a superfície atual.');
requireText(transitionCss, '.entryBeam', 'Feixe de continuidade entre superfícies ausente.');
requireText(transitionCss, '.edgeSignal', 'Sinal contextual de superfície ausente.');
requireText(transitionCss, '@media (prefers-reduced-motion: reduce)', 'CSS da transição não respeita reduced motion.');
requireText(plan, 'buildOperationalSubscriptionPlan', 'Planejamento realtime não está preservado.');
requireText(docs, 'Bloco 19.9', 'Documentação não registra transições entre superfícies.');

forbidText(transition, 'AnimatePresence', 'Transição usa AnimatePresence e pode manter duas superfícies simultâneas.');
forbidText(transition, 'exit=', 'Transição define fase de saída e pode prolongar montagem anterior.');
forbidText(transition, 'mode="wait"', 'Transição bloqueia a troca funcional aguardando animação.');
forbidText(transition, 'setTimeout', 'Transição introduziu atraso artificial de navegação.');
forbidText(transition, 'onSnapshot', 'Transição abriu listener Firestore.');
forbidText(transition, 'firebase', 'Transição acoplou Firebase.');
forbidText(transition, 'localStorage', 'Transição introduziu persistência.');
forbidText(transition, 'sessionStorage', 'Transição introduziu persistência de sessão.');

if (findings.length) {
  console.error('BLOCK 19.9 SURFACE TRANSITIONS: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.9 SURFACE TRANSITIONS: READY');
  console.log('Troca funcional: IMEDIATA');
  console.log('Montagem simultânea de superfícies: ZERO');
  console.log('Transição visual: ATIVA');
  console.log('Reduced motion: PRESERVADO');
  console.log('Realtime adicional: ZERO');
}
