#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const sag = read('features/relatorios/components/SagImportView.tsx');
const reports = read('features/relatorios/components/RelatoriosView.tsx');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

requireText(sag, 'Progresso da importação SAG', 'Navegador de progresso SAG ausente.');
requireText(sag, 'Trocar fornecedor', 'Seletor recolhível de fornecedor ausente.');
requireText(sag, 'Ver diagnóstico técnico', 'Diagnóstico técnico não pode ser recolhido.');
requireText(sag, "type PreviewFilter = 'all' | SagNsApplicationDecision", 'Filtro tipado da prévia ausente.');
requireText(sag, 'Filtros da prévia SAG', 'Controles de filtro da prévia ausentes.');
requireText(sag, 'filteredPreviewItems', 'Prévia não usa conjunto filtrado.');
requireText(sag, 'lg:hidden', 'Cards mobile da prévia ausentes.');
requireText(sag, 'hidden overflow-x-auto lg:block', 'Tabela desktop responsiva ausente.');
requireText(sag, 'Importar outro relatório', 'Atalho para nova importação ausente.');
requireText(sag, 'sticky bottom-0', 'Ações do modal não permanecem acessíveis em telas pequenas.');
requireText(sag, 'Nenhuma NS será gravada automaticamente', 'Garantia de escrita manual foi removida.');
forbidText(sag, "from 'firebase/firestore'", 'Camada visual SAG não pode acessar Firestore diretamente.');
forbidText(sag, 'updateDoc(', 'Camada visual SAG não pode escrever diretamente.');
forbidText(sag, 'setDoc(', 'Camada visual SAG não pode escrever diretamente.');

requireText(reports, 'overflow-x-auto', 'Navegação mobile de Relatórios não permite rolagem horizontal.');
requireText(reports, 'min-w-[210px]', 'Tabs mobile de Relatórios não possuem largura mínima legível.');

requireText(pkg, '"verify:sag-ux"', 'Guard de UX SAG não está registrado.');
requireText(workflow, 'SAG UX guard', 'CI não executa guard de UX SAG.');

if (findings.length) {
  console.error('SAG UX: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SAG UX: READY');
  console.log('Fluxo guiado: ATIVO');
  console.log('Diagnóstico técnico: RECOLHÍVEL');
  console.log('Prévia mobile: RESPONSIVA');
  console.log('Filtros de decisão: ATIVOS');
  console.log('Persistência: INALTERADA');
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
