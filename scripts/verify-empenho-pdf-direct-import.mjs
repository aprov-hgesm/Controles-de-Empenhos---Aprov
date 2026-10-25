#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const findings = [];

function requireText(source, needle, message) {
  if (!source.includes(needle)) findings.push(message);
}

function forbidText(source, needle, message) {
  if (source.includes(needle)) findings.push(message);
}

const parser = read('lib/server/empenhoPdfParser.ts');
const route = read('app/api/empenhos/parse-ne/route.ts');
const view = read('features/empenhos/components/EmpenhosView.tsx');
const actions = read('features/empenhos/hooks/useEmpenhoActions.ts');
const state = read('hooks/useOperationalViewState.ts');
const types = read('lib/types.ts');
const page = read('app/page.tsx');
const operationalWorkspace = read('features/operational/components/OperationalWorkspace.tsx');

for (const marker of [
  "parseEmpenhoPdfBytes",
  "Nota de Empenho",
  "Lista de Itens",
  "20\\d{2}NC",
  "DISP",
  "SRP",
  "CONTRATO",
  "duplicatedRowsIgnored",
  "inflateSync",
]) {
  requireText(parser, marker, `Parser direto perdeu requisito: ${marker}`);
}

// A API passou da simples verificação de JWT para identidade, conta/workspace
// ativos e autorização do domínio, sempre no servidor.
for (const marker of [
  'verifyPlatformPrincipal',
  'evaluateServerAuthorization',
  "capability: 'core.parse'",
]) requireText(route, marker, `Rota de PDF não aplica autorização server-side: ${marker}`);
forbidText(route, 'await verifyFirebaseRequest(', 'PDF não pode autorizar apenas por JWT sem vínculo operacional.');
requireText(route, 'MAX_FILE_SIZE = 12 * 1024 * 1024', 'Rota perdeu limite de tamanho do PDF.');
requireText(route, 'parseEmpenhoPdfBytes', 'Rota deixou de usar o parser determinístico.');
forbidText(route, 'openai', 'Rota direta não pode depender de OpenAI.');
forbidText(route, 'anthropic', 'Rota direta não pode depender de Anthropic.');
forbidText(route, 'gemini', 'Rota direta não pode depender de Gemini.');

for (const marker of [
  "newEmpenhoMode === 'pdf'",
  'Importar PDF da NE',
  'empenho-pdf-direct-input',
  'Leitura direta da Nota de Empenho',
  'Nota de Crédito (NC)',
]) {
  requireText(view, marker, `Interface de cadastro perdeu requisito: ${marker}`);
}

for (const marker of [
  'handleProcessEmpenhoPdf',
  '/api/empenhos/parse-ne',
  'handleUpdateEmpenhoNotaCredito',
  'modalidadeContratacao',
  'numeroContratacao',
  'notaCredito',
]) {
  requireText(actions, marker, `Ações de Empenhos perderam requisito: ${marker}`);
}

requireText(
  state,
  "'manual' | 'pdf'",
  'Cadastro precisa manter apenas Manual + PDF direto.'
);

for (const marker of [
  'EmpenhoContractingModality',
  'notaCredito?: string',
  'numeroContratacao?: string',
  'contrato?: string',
]) {
  requireText(types, marker, `Modelo do empenho perdeu requisito: ${marker}`);
}

for (const forbidden of ["newEmpenhoMode === 'json'", "setNewEmpenhoMode('json')", 'Importar via JSON', 'Processar JSON', 'handleProcessJson', 'Prompt para IA (Claude']) {
  forbidText(view, forbidden, 'Entrada JSON de NE ainda ativa na interface: ' + forbidden);
}
for (const forbidden of ['const handleProcessJson', 'PROMPT_EXTRACAO_EMPENHO', 'handleDownloadPromptTxt']) {
  forbidText(actions, forbidden, 'Rotina JSON de NE ainda ativa: ' + forbidden);
}
requireText(actions, "reviewEmpenho.importSource !== 'pdf'", 'Salvamento da revisão deve exigir origem PDF.');
requireText(view, "newEmpenhoMode === 'manual'", 'Cadastro manual ausente.');
forbidText(state, "'manual' | 'pdf' | 'json'", 'Modo JSON permanece autorizado no estado.');

requireText(page, "import('../features/operational/components/OperationalWorkspace')", 'Página principal não conecta o host operacional sob demanda.');
requireText(operationalWorkspace, 'handleProcessEmpenhoPdf', 'Host operacional não expõe importação direta por PDF.');
requireText(operationalWorkspace, 'handleUpdateEmpenhoNotaCredito', 'Host operacional não expõe edição manual da NC.');

if (findings.length > 0) {
  console.error('EMPENHO PDF DIRECT IMPORT: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('EMPENHO PDF DIRECT IMPORT: READY');
  console.log('Fluxos: MANUAL + PDF DIRETO; JSON DESATIVADO');
  console.log('Parser: DETERMINÍSTICO / SEM IA EXTERNA');
  console.log('Metadados: NC + MODALIDADE + CONTRATAÇÃO + CONTRATO');
  console.log('Prévia editável: PRESERVADA');
}
