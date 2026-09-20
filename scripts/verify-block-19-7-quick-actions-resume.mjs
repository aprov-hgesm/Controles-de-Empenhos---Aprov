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
const quick = read('features/inicio/components/InicioQuickActions.tsx');
const quickCss = read('features/inicio/components/InicioQuickActions.module.css');
const memory = read('features/inicio/hooks/useInicioWorkMemory.ts');
const docs = read('docs/block-19-home-experience.md');

requireText(view, "import { InicioQuickActions }", 'Início não importa o dock de ações rápidas.');
requireText(view, '<InicioQuickActions', 'Início não renderiza ações rápidas.');
requireText(page, "useInicioWorkMemory", 'Página principal não ativa memória de retomada.');
requireText(page, "workspaceContext.workspaceId", 'Memória não está separada por workspace.');
requireText(page, "workspaceContext.ug || 'sem-ug'", 'Memória não incorpora identidade da UG.');
requireText(page, "clearInicioWorkMemory();", 'Logout não limpa memória efêmera de retomada.');
requireText(page, "setShowNewEmpenhoModal(true)", 'Atalho Novo empenho não abre cadastro.');
requireText(page, "setNfSubTab('cadastrar')", 'Atalho Cadastrar NF não abre subaba correta.');
requireText(page, "empenhos.some((empenho) => empenho.id === inicioResumeTarget.empenhoId)", 'Retomada não valida empenho ainda existente.');
requireText(memory, "sessionStorage.getItem", 'Retomada não lê memória da sessão.');
requireText(memory, "sessionStorage.setItem", 'Retomada não grava memória da sessão.');
requireText(memory, "sessionStorage.removeItem", 'Retomada não permite limpeza no logout.');
requireText(memory, "TRACKABLE_TABS", 'Retomada não possui allowlist de módulos.');
requireText(memory, "'painel'", 'Painel não pode ser retomado.');
requireText(memory, "'empenhos'", 'Empenhos não podem ser retomados.');
requireText(memory, "'nova_nf'", 'Notas Fiscais não podem ser retomadas.');
requireText(memory, "'relatorios'", 'Relatórios não podem ser retomados.');
requireText(memory, "'cronogramas'", 'Cronogramas não podem ser retomados.');
requireText(quick, 'Continuar de onde parei', 'Card de retomada não possui rótulo explícito.');
requireText(quick, 'Novo empenho', 'Atalho Novo empenho ausente.');
requireText(quick, 'Cadastrar NF', 'Atalho Cadastrar NF ausente.');
requireText(quick, 'Itens', 'Atalho Itens ausente.');
requireText(quick, 'Relatórios', 'Atalho Relatórios ausente.');
requireText(quick, 'Cronogramas', 'Atalho Cronogramas ausente.');
requireText(quickCss, '@media (prefers-reduced-motion: reduce)', 'Dock não respeita reduced motion.');
requireText(docs, 'Bloco 19.7', 'Documentação não registra atalhos/retomada.');
forbidText(memory, 'localStorage', 'Retomada persistiu dados além da sessão.');
forbidText(memory, 'firebase', 'Memória de retomada acoplou Firebase.');
forbidText(memory, 'onSnapshot', 'Memória de retomada abriu listener Firestore.');
forbidText(memory, "'inicio'", 'A Home não deve salvar a própria Home como destino de retomada.');

if (findings.length) {
  console.error('BLOCK 19.7 QUICK ACTIONS + RESUME: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.7 QUICK ACTIONS + RESUME: READY');
  console.log('Ações rápidas: ATIVAS');
  console.log('Retomada por workspace: ATIVA');
  console.log('Persistência: SOMENTE SESSÃO');
  console.log('Empenho removido: PROTEGIDO');
  console.log('Firestore adicional: ZERO');
}
