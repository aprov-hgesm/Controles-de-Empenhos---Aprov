#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const header = read('components/layout/AppHeader.tsx');
const sidebar = read('components/layout/AppSidebar.tsx');
const drive = read('components/layout/WorkspaceDriveControl.tsx');
const signature = read('components/layout/chrome/AppShellSignature.tsx');
const logo = read('components/layout/chrome/AppShellLogo.tsx');
const page = read('app/page.tsx');
const css = read('app/globals.css');

requireText(header, 'emprovex-app-header fixed top-0', 'Header deixou de ser fixo no topo.');
requireText(header, 'h-16', 'Header deixou de usar a altura estrutural de 4rem.');
requireText(header, '<AppShellSignature variant="header" />', 'Assinatura visual do Header não está montada.');
requireText(header, 'emprovex-header-energy-line', 'Linha de energia do Header foi removida.');
requireText(header, 'aria-label="Abrir menu principal"', 'Botão mobile do Header perdeu rótulo acessível.');

requireText(sidebar, 'fixed top-16 left-0', 'Sidebar deixou de ficar fixa abaixo do Header.');
requireText(sidebar, 'h-[calc(100vh-4rem)]', 'Sidebar perdeu a altura estrutural vinculada ao Header.');
requireText(sidebar, 'w-72', 'Sidebar deixou de usar a largura estrutural de 18rem.');
requireText(sidebar, '<AppShellSignature variant="sidebar" />', 'Assinatura visual da Sidebar não está montada.');
requireText(sidebar, 'aria-label="Menu principal"', 'Sidebar perdeu identificação acessível.');
requireText(sidebar, 'aria-current=', 'Navegação perdeu indicação semântica de item ativo.');
requireText(sidebar, 'emprovex-sidebar-mobile-close', 'Drawer mobile perdeu o controle explícito de fechamento.');

requireText(page, 'lg:pl-72', 'Conteúdo desktop deixou de reservar os 18rem da Sidebar.');
requireText(page, "useState<OperationalActiveTab>('inicio')", 'Sessão autenticada não abre mais diretamente no Início.');
requireText(
  page,
  "useState<OperationalActiveTab>('inicio')",
  'Sessão autenticada não abre mais diretamente no Início.'
);

requireText(drive, 'aria-expanded={open}', 'Controle do Drive deixou de expor aria-expanded.');
requireText(drive, 'aria-controls="emprovex-drive-panel"', 'Controle do Drive perdeu associação com o painel.');
requireText(drive, 'aria-haspopup="dialog"', 'Controle do Drive deixou de anunciar o diálogo.');
requireText(drive, 'id="emprovex-drive-panel"', 'Painel do Drive perdeu o id esperado.');
requireText(drive, 'role="dialog"', 'Painel do Drive deixou de usar semântica de diálogo.');

requireText(signature, 'aria-hidden="true"', 'Assinatura artística deixou de ser ignorada por tecnologias assistivas.');
forbidText(signature, 'firebase', 'Assinatura artística não pode acessar Firebase.');
forbidText(signature, 'googleDrive', 'Assinatura artística não pode acessar lógica do Drive.');
forbidText(signature, 'workspaceContext', 'Assinatura artística não pode acessar contexto de workspace.');

requireText(logo, 'AppShellLogo', 'Núcleo visual da marca não está presente.');

requireText(css, '.emprovex-shell-signature', 'CSS da assinatura artística não foi encontrado.');
requireText(css, 'pointer-events: none', 'Camada decorativa deixou de bloquear eventos do ponteiro.');
requireText(css, '@media (prefers-reduced-motion: reduce)', 'Shell deixou de respeitar movimento reduzido.');
requireText(css, '@media (prefers-reduced-transparency: reduce)', 'Shell deixou de respeitar transparência reduzida.');
requireText(css, '@media (prefers-contrast: more)', 'Shell deixou de oferecer contraste reforçado.');
requireText(css, '@media (forced-colors: active)', 'Shell deixou de oferecer fallback de cores forçadas.');
requireText(css, '.emprovex-sidebar-mobile-toolbar {\n  display: none;', 'Toolbar mobile da Sidebar está visível fora do breakpoint mobile/tablet.');
requireText(css, '@media (max-width: 1023px) {\n  .emprovex-sidebar-mobile-toolbar {\n    display: flex;', 'Toolbar mobile da Sidebar não é reativada abaixo de 1024px.');
requireText(css, '@media (max-width: 639px)', 'Refinamentos mobile principais não foram encontrados.');
requireText(css, '@media (max-width: 369px)', 'Fallback para telas extremamente estreitas não foi encontrado.');

if (findings.length > 0) {
  console.error('EMPROVEX APP SHELL: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('EMPROVEX APP SHELL: READY');
  console.log('Header: estrutura + energia + assinatura');
  console.log('Sidebar: fixa + responsiva + navegação acessível');
  console.log('Drive: semântica ARIA preservada');
  console.log('Acessibilidade: reduced-motion + reduced-transparency + contrast + forced-colors');
  console.log('Camada artística: decorativa e isolada de dados');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}
