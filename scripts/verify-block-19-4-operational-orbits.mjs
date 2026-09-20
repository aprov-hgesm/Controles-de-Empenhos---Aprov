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
const orbit = read('features/inicio/components/InicioOrbitSystem.tsx');
const orbitCss = read('features/inicio/components/InicioOrbitSystem.module.css');
const plan = read('lib/operationalSubscriptionPlan.ts');
const docs = read('docs/block-19-home-experience.md');

requireText(view, "import { InicioOrbitSystem }", 'Início não importa o sistema orbital.');
requireText(view, '<InicioOrbitSystem', 'Início não renderiza o sistema orbital.');
requireText(orbit, "const CLASS_CODES = ['QR', 'CALI', 'PASA', 'FUNADOM']", 'Sistema orbital perdeu classes previstas.');
requireText(orbit, 'pendingEmpenhos', 'Planeta Recebimentos não deriva empenhos com saldo.');
requireText(orbit, 'executionPct', 'Planeta Execução não deriva percentual operacional.');
requireText(orbit, 'alertSeverity', 'Planeta Alertas não diferencia severidade.');
requireText(orbit, "onNavigate('itens')", 'Planeta Recebimentos não navega para consulta de itens.');
requireText(orbit, "onNavigate('painel')", 'Planetas analíticos não navegam ao Painel.');
requireText(orbitCss, '.alertPlanet', 'Planeta de Alertas sem identidade visual.');
requireText(orbitCss, '.receivingPlanet', 'Planeta de Recebimentos sem identidade visual.');
requireText(orbitCss, '.executionPlanet', 'Planeta de Execução sem identidade visual.');
requireText(orbitCss, '.dashboardPlanet', 'Planeta do Painel sem identidade visual.');
requireText(orbitCss, '.classPlanet', 'Planeta de Classes ausente.');
requireText(orbitCss, '.classMoon', 'Luas de classes ausentes.');
requireText(orbitCss, '@media (prefers-reduced-motion: reduce)', 'Sistema orbital não respeita reduced motion.');
requireText(plan, 'inicio:', 'Perfil realtime de Início ausente.');
requireText(plan, 'invoices: false', 'Proteção de invoices realtime não está registrada.');
requireText(docs, 'Bloco 19.4', 'Documentação não registra o sistema orbital.');
forbidText(orbit, 'Invoice', 'Sistema orbital passou a depender de notas fiscais.');
forbidText(orbit, 'onSnapshot', 'Sistema orbital abriu listener Firestore diretamente.');
forbidText(orbit, 'firebase', 'Sistema orbital acoplou Firebase diretamente.');
forbidText(orbit, 'three.js', 'Sistema orbital introduziu Three.js indevidamente.');
forbidText(orbit, '<canvas', 'Sistema orbital introduziu canvas indevidamente.');

if (findings.length) {
  console.error('BLOCK 19.4 OPERATIONAL ORBITS: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.4 OPERATIONAL ORBITS: READY');
  console.log('Alertas: PLANETA ATIVO');
  console.log('Recebimentos: PLANETA ATIVO');
  console.log('Execução: PLANETA ATIVO');
  console.log('Classes + luas: ATIVAS');
  console.log('Realtime adicional: ZERO');
}
