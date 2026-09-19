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

const main = read('features/relatorios/components/SagImportView.tsx');
const progress = read('features/relatorios/components/SagImportProgress.tsx');
const supplier = read('features/relatorios/components/SagSupplierStep.tsx');
const prompt = read('features/relatorios/components/SagPromptStep.tsx');
const preview = read('features/relatorios/components/SagApplicationPreviewSection.tsx');
const confirmation = read('features/relatorios/components/SagApplyConfirmationDialog.tsx');
const assistantGuard = read('scripts/verify-sag-import-assistant.mjs');
const previewGuard = read('scripts/verify-sag-application-preview.mjs');
const uxGuard = read('scripts/verify-sag-ux.mjs');
const ugGuard = read('scripts/verify-ns-ug-identity.mjs');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const docs = read('docs/BLOCK_11_SAG_IMPORT_REFACTOR.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

const mainLines = main.split(/\r?\n/).length;
if (mainLines > 900) {
  findings.push(`SagImportView voltou a exceder 900 linhas: ${mainLines}.`);
}

for (const expected of [
  'buildSagNsExtractionPrompt',
  'parseSagNsJson',
  'reconcileSagNsPayload',
  'buildSagNsApplicationPreview',
  'buildSagNsApplicationFingerprint',
  'effectivePayload',
  'confirmationFingerprint',
  'onApplySagNsImport(',
  'effectivePayload,',
  'selectedSupplier.cnpj,',
]) {
  requireText(main, expected, `Orquestrador perdeu responsabilidade crítica: ${expected}`);
}

for (const component of [
  ['progress', progress],
  ['supplier', supplier],
  ['prompt', prompt],
  ['preview', preview],
  ['confirmation', confirmation],
]) {
  const [name, source] = component;
  for (const forbidden of [
    "from 'firebase/firestore'",
    'runTransaction(',
    'setDoc(',
    'updateDoc(',
    'addDoc(',
    'onApplySagNsImport(',
    'parseSagNsJson(',
    'reconcileSagNsPayload(',
    'buildSagNsApplicationPreview(',
  ]) {
    forbidText(source, forbidden, `Componente ${name} ganhou responsabilidade de domínio: ${forbidden}`);
  }
}

requireText(progress, 'Progresso da importação SAG', 'Progresso visual foi perdido.');
requireText(supplier, 'Trocar fornecedor', 'Seleção de fornecedor foi perdida.');
requireText(prompt, 'Prompt oficial do EMPROVEX', 'Etapa de prompt foi perdida.');
requireText(prompt, 'A UG vem automaticamente do cadastro do usuário/setor', 'Identidade UG não aparece no prompt.');
requireText(preview, 'O que aconteceria com este lote', 'Prévia final foi perdida.');
requireText(preview, "export type SagPreviewFilter = 'all' | SagNsApplicationDecision", 'Filtro tipado não foi preservado.');
requireText(confirmation, 'Confirmar importação das NS', 'Confirmação humana foi perdida.');
requireText(confirmation, 'sticky bottom-0', 'Ações mobile do modal deixaram de ser persistentes.');

for (const [name, source, expected] of [
  ['assistant', assistantGuard, 'SagSupplierStep.tsx'],
  ['preview', previewGuard, 'SagApplicationPreviewSection.tsx'],
  ['ux', uxGuard, 'SagApplyConfirmationDialog.tsx'],
  ['ug', ugGuard, 'SagPromptStep.tsx'],
]) {
  requireText(source, expected, `Guard legado ${name} não acompanha a superfície refatorada.`);
}

requireText(e2e, "relatorios-tab-sag", 'Browser E2E não abre a subaba SAG após a refatoração.');
requireText(e2e, 'Progresso da importação SAG', 'Browser E2E não verifica progresso SAG.');
requireText(e2e, 'Prompt oficial do EMPROVEX', 'Browser E2E não verifica prompt SAG.');

requireText(docs, '1.525 linhas', 'Documentação não registra baseline da refatoração.');
requireText(docs, 'abaixo de 900 linhas', 'Documentação não congela limite do orquestrador.');
requireText(docs, 'não existe alteração intencional de comportamento', 'Contrato não declara refatoração conservadora.');

requireText(pkg, '"verify:block-11-sag-refactor"', 'package.json não registra guard do Bloco 11.');
requireText(workflow, 'Block 11 SAG conservative refactor guard', 'Application CI não executa guard do Bloco 11.');

if (findings.length) {
  console.error('BLOCK 11 SAG CONSERVATIVE REFACTOR: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 11 SAG CONSERVATIVE REFACTOR: READY');
  console.log(`SagImportView: ${mainLines} linhas`);
  console.log('Estado e domínio: ORQUESTRADOR');
  console.log('Seções extraídas: APRESENTACIONAIS');
  console.log('Persistência direta em componentes: BLOQUEADA');
  console.log('Guards SAG legados: REFATORAÇÃO-AWARE');
}
