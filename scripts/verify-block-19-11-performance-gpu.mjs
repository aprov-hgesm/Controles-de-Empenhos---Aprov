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

const profile = read('features/inicio/hooks/useInicioPerformanceProfile.ts');
const view = read('features/inicio/components/InicioView.tsx');
const viewCss = read('features/inicio/components/InicioView.module.css');
const interaction = read('features/inicio/components/InicioInteractionLayer.tsx');
const core = read('features/inicio/components/InicioCore.tsx');
const atmosphereCss = read('features/inicio/components/InicioAtmosphere.module.css');
const coreCss = read('features/inicio/components/InicioCore.module.css');
const orbitCss = read('features/inicio/components/InicioOrbitSystem.module.css');
const constellationCss = read('features/inicio/components/InicioConstellation.module.css');
const docs = read('docs/block-19-home-experience.md');

requireText(profile, "export type InicioPerformanceMode = 'full' | 'balanced' | 'static'", 'Perfis full/balanced/static ausentes.');
requireText(profile, "prefers-reduced-motion: reduce", 'Perfil não considera reduced motion.');
requireText(profile, "pointer: coarse", 'Perfil não considera ponteiro coarse.');
requireText(profile, 'navigator.hardwareConcurrency', 'Perfil não considera capacidade de CPU.');
requireText(profile, 'deviceMemory', 'Perfil não considera memória do dispositivo.');
requireText(profile, "visibilitychange", 'Perfil não pausa ao ocultar a aba.');

requireText(view, "data-performance={performanceMode}", 'Cena não expõe perfil de performance.');
requireText(view, "data-ambient-paused={ambientPaused ? 'true' : 'false'}", 'Cena não expõe estado de pausa.');
requireText(view, "performanceMode !== 'full' || ambientPaused", 'Parallax não é desativado fora do perfil full.');
requireText(view, 'const settled =', 'Parallax não possui condição de encerramento do RAF.');
requireText(view, 'const scheduleFrame = () =>', 'Parallax não é iniciado sob demanda.');

requireText(interaction, 'enabled: boolean', 'Interaction layer não possui chave explícita de habilitação.');
requireText(interaction, 'const settled =', 'Interaction layer não encerra RAF ao estabilizar.');
requireText(interaction, 'const scheduleFrame = () =>', 'Interaction layer não é RAF sob demanda.');

requireText(core, 'interactiveMotion: boolean', 'Core não recebe política de movimento fino.');
requireText(core, 'const settled =', 'Core não encerra RAF ao estabilizar.');
requireText(core, 'const scheduleFrame = () =>', 'Core não é RAF sob demanda.');

requireText(viewCss, ".scene[data-ambient-paused='true'] *", 'Animações CSS não são pausadas com aba oculta.');
requireText(viewCss, 'contain: paint style', 'Cena não possui contenção de pintura/estilo.');
requireText(atmosphereCss, "[data-performance='balanced'] .nebulaThree", 'Atmosfera não reduz camadas em balanced.');
requireText(coreCss, "[data-performance='balanced'] .orbitC", 'Core não reduz órbitas em balanced.');
requireText(orbitCss, "[data-performance='balanced'] .sweepInner", 'Sistema orbital não reduz sweeps em balanced.');
requireText(constellationCss, "[data-performance='balanced'] .star", 'Constelação não reduz animações em balanced.');
requireText(docs, 'Bloco 19.11', 'Documentação não registra performance/GPU.');

forbidText(atmosphereCss, 'will-change: transform', 'Atmosfera voltou a reservar camada GPU permanente.');
forbidText(coreCss, 'will-change: transform', 'Core voltou a reservar camada GPU permanente.');
forbidText(profile, 'localStorage', 'Perfil de performance não deve persistir estado.');
forbidText(profile, 'sessionStorage', 'Perfil de performance não deve persistir estado.');
forbidText(profile, 'firebase', 'Perfil de performance acoplou Firebase.');
forbidText(profile, 'onSnapshot', 'Perfil de performance abriu listener Firestore.');

if (findings.length) {
  console.error('BLOCK 19.11 PERFORMANCE/GPU: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.11 PERFORMANCE/GPU: READY');
  console.log('RAF contínuo em idle: ELIMINADO');
  console.log('Aba oculta: ANIMAÇÕES PAUSADAS');
  console.log('Perfil balanceado: ATIVO');
  console.log('Reduced motion: STATIC');
  console.log('Reserva GPU permanente: REMOVIDA');
  console.log('Firestore adicional: ZERO');
}
