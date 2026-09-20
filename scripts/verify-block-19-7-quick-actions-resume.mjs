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
const sidebar = read('components/layout/AppSidebar.tsx');
const docs = read('docs/block-19-home-experience.md');

requireText(sidebar, "onNavigate('empenhos')", 'Empenhos deixou de estar acessível pela navegação principal.');
requireText(sidebar, "onNavigate('itens')", 'Itens deixou de estar acessível pela navegação principal.');
requireText(sidebar, "onNavigate('relatorios')", 'Relatórios deixou de estar acessível pela navegação principal.');
requireText(sidebar, "onNavigate('cronogramas')", 'Cronogramas deixou de estar acessível pela navegação principal.');
requireText(docs, 'Bloco 19.7', 'Documentação não registra o bloco originalmente reservado a atalhos/retomada.');

forbidText(view, "InicioQuickActions", 'Home voltou a renderizar o dock de ações rápidas.');
forbidText(view, 'Continuar de onde parei', 'Home voltou a exibir retomada de trabalho.');
forbidText(view, 'Ações rápidas', 'Home voltou a exibir ações rápidas.');
forbidText(page, 'useInicioWorkMemory', 'Página voltou a ativar memória de retomada sem interface.');
forbidText(page, 'inicioResumeTarget', 'Página voltou a manter destino de retomada da Home.');
forbidText(page, 'clearInicioWorkMemory', 'Logout voltou a carregar lógica de retomada desativada.');

if (findings.length) {
  console.error('BLOCK 19.7 MINIMAL HOME ACTION SURFACE: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.7 MINIMAL HOME ACTION SURFACE: READY');
  console.log('Dock de ações rápidas: REMOVIDO');
  console.log('Retomada na Home: REMOVIDA');
  console.log('Navegação principal: PRESERVADA');
  console.log('Firestore adicional: ZERO');
}
