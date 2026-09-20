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
const sidebar = read('components/layout/AppSidebar.tsx');
const plan = read('lib/operationalSubscriptionPlan.ts');
const view = read('features/inicio/components/InicioView.tsx');
const constellation = read('features/inicio/components/InicioConstellation.tsx');
const snapshotDomain = read('features/inicio/domain/homeOperationalSnapshot.ts');
const constellationCss = read('features/inicio/components/InicioConstellation.module.css');
const orbit = read('features/inicio/components/InicioOrbitSystem.tsx');
const styles = read('features/inicio/components/InicioView.module.css');
const docs = read('docs/block-19-home-experience.md');

requireText(page, "import { InicioView }", 'Página principal não importa a visão Início.');
requireText(page, "activeTab === 'inicio'", 'Página principal não renderiza a visão Início.');
requireText(page, "useState<OperationalActiveTab>('painel')", 'Destino padrão pós-login foi alterado antes da homologação.');
requireText(sidebar, "onNavigate('inicio')", 'Sidebar não oferece navegação para Início.');
requireText(plan, 'inicio:', 'Plano realtime não possui perfil para Início.');
requireText(snapshotDomain, 'INICIO_MAX_VISIBLE_STARS = 72', 'Snapshot não possui limite de densidade inicial.');
requireText(constellation, "data-severity={node.severity}", 'Estrelas não expõem severidade semântica.');
requireText(view, 'snapshot?.alerts.total ?? 0', 'Planeta de alertas não usa o snapshot econômico.');
requireText(orbit, "CLASS_CODES = ['QR', 'CALI', 'PASA', 'FUNADOM']", 'Classes iniciais não preservam QR/CALI/PASA/FUNADOM no sistema orbital.');
requireText(styles, '@media (prefers-reduced-motion: reduce)', 'Experiência não respeita reduced motion.');
requireText(constellationCss, ".star[data-severity='critical']", 'Estado crítico não possui tratamento visual.');
requireText(docs, 'snapshot compacto por UG', 'Documentação não protege a evolução de custo por UG.');
forbidText(view, 'Empenho[]', 'Início voltou a depender da coleção bruta de empenhos.');
forbidText(view, 'Alert[]', 'Início voltou a depender da coleção bruta de alertas.');
forbidText(page, "useState<OperationalActiveTab>('inicio')", 'Início foi promovido para landing antes da validação.');

if (findings.length) {
  console.error('BLOCK 19 HOME EXPERIENCE FOUNDATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19 HOME EXPERIENCE FOUNDATION: READY');
  console.log('Início: NAVEGÁVEL');
  console.log('Dashboard padrão pós-login: PRESERVADO');
  console.log('Constelação: LIMITADA A 72 ESTRELAS');
  console.log('Alertas + classes: CONECTADOS');
  console.log('Reduced motion: PROTEGIDO');
}
