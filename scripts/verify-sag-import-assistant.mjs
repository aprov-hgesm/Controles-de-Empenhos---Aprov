#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const view = read('features/relatorios/components/SagImportView.tsx');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

requireText(view, 'buildSupplierReports', 'Assistente SAG não reutiliza a consolidação por CNPJ.');
requireText(view, 'buildSagNsExtractionPrompt', 'Assistente SAG não gera o prompt oficial do Bloco 7.');
requireText(view, 'parseSagNsJson', 'Assistente SAG não valida o JSON pelo contrato oficial.');
requireText(view, 'Razão social ou CNPJ', 'Busca de fornecedor ausente.');
requireText(view, 'aria-pressed={selected}', 'Seleção de fornecedor não possui estado acessível.');
requireText(view, 'Abrir SAG', 'Atalho para o SAG ausente.');
requireText(view, 'Copiar Prompt', 'Ação de copiar prompt ausente.');
requireText(view, 'navigator.clipboard?.writeText', 'Integração com clipboard ausente.');
requireText(view, 'Colar e validar JSON', 'Etapa de colagem/validação ausente.');
requireText(view, 'Validar JSON', 'Ação de validação ausente.');
requireText(view, 'expectedSupplierCnpj: selectedSupplier.cnpj', 'Validação não fixa o CNPJ selecionado.');
requireText(view, 'validation.data.records.map', 'Prévia estrutural dos registros SAG ausente.');
requireText(view, 'JSON bloqueado pela validação', 'Estado visual de erro ausente.');
requireText(view, 'Alertas para conferência humana', 'Alertas de validação não são exibidos.');
requireText(view, 'Nenhuma NS será gravada automaticamente', 'Aviso de não persistência ausente.');
forbidText(view, 'updateDoc(', 'Assistente SAG não deve gravar diretamente no Firestore no Bloco 8.');
forbidText(view, 'setDoc(', 'Assistente SAG não deve gravar diretamente no Firestore no Bloco 8.');
forbidText(view, 'addDoc(', 'Assistente SAG não deve gravar diretamente no Firestore no Bloco 8.');
forbidText(view, 'numeroNS:', 'Assistente SAG não deve atualizar numeroNS no Bloco 8.');
requireText(pkg, '"verify:sag-import-assistant"', 'Script de verificação do Bloco 8 não está registrado.');
requireText(workflow, 'SAG import assistant guard', 'CI não executa o guard do Bloco 8.');

if (findings.length) {
  console.error('SAG IMPORT ASSISTANT: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SAG IMPORT ASSISTANT: READY');
  console.log('Fornecedor por CNPJ: ATIVO');
  console.log('Prompt oficial: ATIVO');
  console.log('JSON + validação visual: ATIVO');
  console.log('Persistência de NS: BLOQUEADA NESTE BLOCO');
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
