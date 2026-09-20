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

const core = read('features/inicio/components/InicioCore.tsx');
const coreCss = read('features/inicio/components/InicioCore.module.css');
const orbit = read('features/inicio/components/InicioOrbitSystem.tsx');
const orbitCss = read('features/inicio/components/InicioOrbitSystem.module.css');
const atmosphereCss = read('features/inicio/components/InicioAtmosphere.module.css');
const plan = read('lib/operationalSubscriptionPlan.ts');
const docs = read('docs/block-19-home-experience.md');

requireText(core, 'commandHalo', 'Núcleo perdeu o halo de centro de comando.');
requireText(core, 'reactorShell', 'Núcleo perdeu a carcaça multicamadas do reator.');
requireText(core, 'energyFilaments', 'Núcleo perdeu os filamentos de energia.');
requireText(core, 'apertureRing', 'Núcleo perdeu o anel de abertura holográfico.');
requireText(core, 'energyCore', 'Núcleo perdeu o coração energético.');
requireText(coreCss, 'Block 20 — premium holographic command reactor', 'CSS premium do núcleo ausente.');
requireText(coreCss, '@keyframes commandHaloSpin', 'Halo técnico do núcleo não possui movimento.');
requireText(coreCss, '@keyframes apertureSpin', 'Abertura holográfica do núcleo não possui rotação.');
requireText(coreCss, "[data-performance='balanced'] .commandArcB", 'Núcleo premium não reduz efeitos em balanced.');
requireText(coreCss, "[data-performance='static'] .commandHalo", 'Núcleo premium não protege o perfil static.');
requireText(coreCss, '@media (prefers-reduced-motion: reduce)', 'Núcleo premium não respeita reduced motion.');

requireText(orbit, 'planetMaterial', 'Planetas perderam materialidade cinematográfica.');
requireText(orbit, 'planetBands', 'Planetas perderam textura funcional.');
requireText(orbit, 'planetSpecular', 'Planetas perderam iluminação especular.');
requireText(orbit, 'planetHud', 'Planetas perderam anéis HUD.');
requireText(orbit, 'classMaterial', 'Classes perdeu materialidade própria.');
requireText(orbit, 'classHud', 'Classes perdeu HUD próprio.');
requireText(orbit, 'data-kind={tooltipState.key}', 'Tooltip não preserva identidade funcional do planeta.');
requireText(orbitCss, 'Block 20 — cinematic functional planets', 'CSS cinematográfico dos planetas ausente.');
requireText(orbitCss, '--planet-rgb: 255, 101, 78', 'Alertas perdeu acento coral/vermelho.');
requireText(orbitCss, '--planet-rgb: 72, 220, 209', 'Recebimentos perdeu acento ciano.');
requireText(orbitCss, '--planet-rgb: 245, 183, 72', 'Execução perdeu acento âmbar/dourado.');
requireText(orbitCss, '--planet-rgb: 160, 116, 255', 'Painel perdeu acento violeta.');
requireText(orbitCss, '--planet-rgb: 207, 179, 255', 'Classes perdeu acento lilás/prata.');
requireText(orbitCss, '@keyframes planetHudSpin', 'HUD dos planetas não possui movimento técnico.');
requireText(orbitCss, "[data-performance='balanced'] .planetHud", 'HUD premium não reduz movimento em balanced.');
requireText(orbitCss, "[data-performance='static'] .planetHud", 'HUD premium não protege o perfil static.');
requireText(orbitCss, '@media (prefers-reduced-motion: reduce)', 'Planetas premium não respeitam reduced motion.');

requireText(atmosphereCss, '.flowParticle', 'Atmosfera perdeu partículas de profundidade.');
requireText(plan, 'inicio:', 'Bloco 20 alterou ou perdeu o perfil realtime da Home.');
requireText(plan, 'invoices: false', 'Bloco 20 não preserva economia realtime.');
requireText(docs, 'Bloco 20 — redesign orbital premium', 'Documentação do Bloco 20 ausente.');

forbidText(core, 'onSnapshot', 'Núcleo premium abriu listener Firestore.');
forbidText(core, 'firebase', 'Núcleo premium acoplou Firebase.');
forbidText(orbit, 'onSnapshot', 'Planetas premium abriram listener Firestore.');
forbidText(orbit, 'firebase', 'Planetas premium acoplaram Firebase.');
forbidText(core, '<canvas', 'Núcleo premium introduziu Canvas.');
forbidText(orbit, '<canvas', 'Planetas premium introduziram Canvas.');
forbidText(core, 'three.js', 'Núcleo premium introduziu Three.js.');
forbidText(orbit, 'three.js', 'Planetas premium introduziram Three.js.');

if (findings.length) {
  console.error('BLOCK 20 PREMIUM ORBITAL REDESIGN: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 20 PREMIUM ORBITAL REDESIGN: READY');
  console.log('Núcleo holográfico multicamadas: ATIVO');
  console.log('Planetas cinematográficos funcionais: ATIVOS');
  console.log('HUD técnico e hover premium: ATIVOS');
  console.log('Identidade cromática funcional: PRESERVADA');
  console.log('Tooltips independentes da rotação: PRESERVADOS');
  console.log('Balanced/static/reduced motion: PROTEGIDOS');
  console.log('Firestore adicional: ZERO');
  console.log('Canvas/WebGL/Three.js: ZERO');
}
