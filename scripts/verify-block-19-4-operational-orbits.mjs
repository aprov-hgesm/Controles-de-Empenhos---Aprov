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
requireText(orbit, 'receiving.pendingEmpenhos', 'Planeta Recebimentos não usa saldo agregado do snapshot.');
requireText(orbit, 'execution.percentage', 'Planeta Execução não usa percentual agregado do snapshot.');
requireText(orbit, 'alertSeverity', 'Planeta Alertas não usa severidade agregada do snapshot.');
forbidText(orbit, 'onNavigate', 'Planetas voltaram a controlar navegação da Home.');
forbidText(orbit, 'onClick=', 'Planetas voltaram a possuir ação de clique navegável.');
requireText(orbitCss, '.alertPlanet', 'Planeta de Alertas sem identidade visual.');
requireText(orbitCss, '.receivingPlanet', 'Planeta de Recebimentos sem identidade visual.');
requireText(orbitCss, '.executionPlanet', 'Planeta de Execução sem identidade visual.');
requireText(orbitCss, '.dashboardPlanet', 'Planeta do Painel sem identidade visual.');
requireText(orbitCss, '.classPlanet', 'Planeta de Classes ausente.');
requireText(orbitCss, '.floatingClassTooltip', 'Tooltip consolidado de classes ausente.');
requireText(orbitCss, '.floatingTooltip', 'Tooltips orbitais não estão desacoplados da rotação dos planetas.');
requireText(orbit, 'showTooltip(', 'Sistema orbital não calcula posição independente para os tooltips.');
requireText(orbit, 'rootRef', 'Tooltips orbitais não possuem referencial estável da cena.');
requireText(orbitCss, '@keyframes planetOrbit', 'Planetas não possuem movimento orbital ao redor do núcleo.');
requireText(orbitCss, '@keyframes planetCounterOrbit', 'Conteúdo dos planetas não compensa a rotação orbital.');
requireText(orbitCss, '.orbitSlot:hover', 'Órbita não pausa para estabilizar hover/foco.');
requireText(orbit, 'data-inicio-star-orbit="outer"', 'Faixa orbital externa não está exposta para proteção da constelação.');
requireText(orbit, 'data-inicio-star-orbit="middle"', 'Faixa orbital intermediária não está exposta para proteção da constelação.');
requireText(orbit, 'data-inicio-star-orbit="inner"', 'Faixa orbital interna não está exposta para proteção da constelação.');
requireText(orbit, "tooltipState.key === 'classes'", 'Indicadores de classes não estão no tooltip flutuante independente.');
forbidText(orbit, 'className={styles.classMoons}', 'Indicadores de classes continuam permanentemente expostos ao lado do planeta.');
requireText(orbitCss, '@media (prefers-reduced-motion: reduce)', 'Sistema orbital não respeita reduced motion.');
requireText(plan, 'inicio:', 'Perfil realtime de Início ausente.');
requireText(plan, 'invoices: false', 'Proteção de invoices realtime não está registrada.');
requireText(docs, 'Bloco 19.4', 'Documentação não registra o sistema orbital.');
requireText(orbit, 'InicioOperationalSnapshot', 'Sistema orbital não consome o snapshot econômico.');
forbidText(orbit, 'Empenho[]', 'Sistema orbital voltou a consumir empenhos brutos.');
forbidText(orbit, 'Alert[]', 'Sistema orbital voltou a consumir alertas brutos.');
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
  console.log('Planetas: INFORMATIVOS, SEM NAVEGAÇÃO');
  console.log('Recebimentos: PLANETA ATIVO');
  console.log('Execução: PLANETA ATIVO');
  console.log('Classes: TOOLTIP SOB DEMANDA ATIVO');
  console.log('Órbitas planetárias: ATIVAS EM PERFIL FULL');
  console.log('Tooltips: SEMPRE ORIENTADOS À TELA');
  console.log('Realtime adicional: ZERO');
}
