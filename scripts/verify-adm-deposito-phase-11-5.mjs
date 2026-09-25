#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
const sidebar = read('features/warehouse/components/WarehouseSidebar.tsx');
const gate = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const appShell = read('app/page.tsx');
const appSidebar = read('components/layout/AppSidebar.tsx');
const appHeader = read('components/layout/AppHeader.tsx');

function requireText(source, marker, message) {
  if (!source.includes(marker)) findings.push(message);
}

function forbidText(source, marker, message) {
  if (source.includes(marker)) findings.push(message);
}

for (const marker of [
  "import { AppBackground } from '../../../components/layout/AppBackground'",
  "import { AppHeader } from '../../../components/layout/AppHeader'",
  "import { WarehouseSidebar } from './WarehouseSidebar'",
  'bg-gradient-to-br from-[#f0f4f8] via-[#e8ecf3] to-[#f4f6fa]',
  'pt-16',
  'lg:pl-72',
  'mx-auto',
  'max-w-7xl',
]) {
  requireText(shell, marker, 'Shell ADM não replica o framework visual EMPROVEX: ' + marker);
}

for (const marker of [
  'emprovex-app-sidebar',
  'emprovex-sidebar-operator',
  'emprovex-sidebar-nav',
  'emprovex-sidebar-nav-item',
  'emprovex-sidebar-system',
  'emprovex-sidebar-logout',
  'AppShellSignature',
]) {
  requireText(sidebar, marker, 'Sidebar ADM perdeu elemento visual oficial EMPROVEX: ' + marker);
}

for (const marker of [
  'Operador',
  'Acesso autorizado',
  'Sistema',
  'Operacional',
  'Sair da conta',
  'Voltar ao EMPROVEX',
]) {
  requireText(sidebar, marker, 'Sidebar ADM perdeu elemento funcional/visual esperado: ' + marker);
}

requireText(gate, 'SectorWorkspaceContext', 'Gate ADM não preserva o contexto completo do workspace para o header oficial.');
requireText(gate, 'workspaceContext={workspaceContext}', 'Gate ADM não entrega o contexto completo ao shell.');

requireText(appShell, '<AppHeader', 'Shell operacional EMPROVEX deixou de usar AppHeader.');
requireText(appShell, '<AppSidebar', 'Shell operacional EMPROVEX deixou de usar AppSidebar.');
requireText(appSidebar, 'emprovex-app-sidebar', 'Classe canônica da sidebar EMPROVEX não encontrada.');
requireText(appHeader, 'emprovex-app-header', 'Classe canônica do header EMPROVEX não encontrada.');

for (const forbidden of [
  'firebase/firestore',
  'runTransaction(',
  'saveInvoice(',
  'saveEmpenho(',
  'saveAlert(',
  'saveCronograma(',
]) {
  forbidText(shell + '\n' + sidebar, forbidden, 'FASE 11.5 visual introduziu mutação operacional: ' + forbidden);
}

if (findings.length) {
  console.error('ADM DEPÓSITO FASE 11.5 VISUAL: BLOQUEADO');
  for (const finding of findings) console.error('- ' + finding);
  process.exit(1);
}

console.log('ADM DEPÓSITO FASE 11.5 VISUAL: PASS');
console.log('- header oficial do EMPROVEX reutilizado');
console.log('- sidebar do ADM replica o chrome oficial do EMPROVEX');
console.log('- operador, navegação, status e logout preservados');
console.log('- layout responsivo usa pt-16 + lg:pl-72 como a plataforma principal');
console.log('- nenhuma regra de negócio ou mutação operacional foi adicionada pelo redesign');
