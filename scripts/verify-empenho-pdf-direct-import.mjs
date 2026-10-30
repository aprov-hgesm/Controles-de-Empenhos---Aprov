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
const rootEntry = read('app/page.tsx');
const page = rootEntry.includes("export { default } from './login/page'")
  ? read('app/login/page.tsx')
  : rootEntry;
if (rootEntry.includes("export { default } from './login/page'") && !page.includes("import('../../features/operational/components/OperationalWorkspace')")) {
  throw new Error('Shell canônico de /login não carrega OperationalWorkspace sob demanda.');
}
const operationalWorkspace = read('features/operational/components/OperationalWorkspace.tsx');
const empenhoDocuments = read('lib/empenhoDocuments.ts');

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

requireText(route, 'verifyFirebaseRequest', 'Rota de leitura direta precisa exigir sessão Firebase.');
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

// O PDF de origem não pode ser descartado após a extração: a revisão confirma
// um único cadastro com documento físico já verificado no Drive do setor.
for (const marker of [
  'pendingImportedPdfRef = useRef<File | null>(null)',
  'pendingImportedPdfRef.current = file',
  'await assertWorkspacePdfIsSafeForStorage(file, { maxBytes: MAX_EMPENHO_PDF_BYTES })',
  'pendingDriveUploadRef.current',
  'await uploadEmpenhoPdf(user, finalEmp.id, pdfToStore)',
  'finalEmp.notaEmpenhoPdf = uploadedDocument',
  'finalEmp.notaEmpenhoPdfVersions = [uploadedDocument]',
]) {
  requireText(actions, marker, `Cadastro por PDF perdeu integração com o Drive: ${marker}`);
}
requireText(empenhoDocuments, 'uploadAndVerifyWorkspacePdf', 'Upload de NE deve usar integridade SHA-256 no Drive.');
requireText(view, 'Salvar Empenho e PDF', 'Confirmação precisa informar o anexo automático.');
requireText(view, 'até 10 MB', 'Limite exibido precisa coincidir com o armazenamento documental.');

const reviewSave = actions.split('// Save the NE reviewed after direct PDF extraction')[1]?.split('// Handler to add item to the editing commitment')[0] || '';
const uploadPosition = reviewSave.indexOf('await uploadEmpenhoPdf(user, finalEmp.id, pdfToStore)');
const createPosition = reviewSave.indexOf('await createEmpenho(user.uid, finalEmp)');
if (uploadPosition < 0 || createPosition < 0 || uploadPosition > createPosition) {
  findings.push('PDF deve ser verificado no Drive ANTES da transação de criação do empenho.');
}
const uploadCatch = reviewSave.indexOf('PDF não salvo no Google Drive');
if (uploadCatch < 0 || uploadCatch > createPosition || !reviewSave.slice(uploadCatch, createPosition).includes('return;')) {
  findings.push('Falha no Drive deve interromper o cadastro antes de escrever no Firestore.');
}
if (!reviewSave.includes('O PDF foi preservado no Drive')) {
  findings.push('Falha incerta do Firestore não pode apagar o PDF possivelmente vinculado.');
}

requireText(view, "newEmpenhoMode === 'manual'", 'Cadastro manual ausente.');
forbidText(state, "'manual' | 'pdf' | 'json'", 'Modo JSON permanece autorizado no estado.');

requireText(page, "import('../../features/operational/components/OperationalWorkspace')", 'Página principal não conecta o host operacional sob demanda.');
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
