#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const shell = read('features/relatorios/components/RelatoriosView.tsx');
const empenho = read('features/relatorios/components/RelatorioPorEmpenhoView.tsx');
const fornecedor = read('features/relatorios/components/RelatorioPorFornecedorView.tsx');
const sag = read('features/relatorios/components/SagImportView.tsx');

requireText(shell, "'empenho' | 'fornecedor' | 'sag'", 'Shell não declara as três subabas.');
requireText(shell, '<RelatorioPorEmpenhoView context={context} />', 'Relatório legado não está preservado na subaba Por Empenho.');
requireText(shell, '<RelatorioPorFornecedorView', 'Subaba Por Fornecedor não está montada.');
requireText(shell, '<SagImportView', 'Subaba SAG não está montada.');
requireText(shell, "React.useState<RelatoriosSubTab>('empenho')", 'Por Empenho deixou de ser a subaba padrão.');
requireText(empenho, 'handleSaveNumeroNS', 'Fluxo atual de NS não foi preservado em Por Empenho.');
requireText(empenho, 'handleGenerateEmpenhoReportPDF', 'Geração de relatório por empenho foi perdida.');
requireText(empenho, 'handleDownloadTermoRecebimento', 'Fluxo de Termo de Recebimento foi perdido.');
requireText(fornecedor, 'supplierCnpj', 'Estrutura do relatório por fornecedor não usa CNPJ.');
requireText(sag, 'Nenhuma NS será gravada automaticamente', 'Subaba SAG perdeu a garantia de confirmação humana.');

if (findings.length) {
  console.error('REPORTS SHELL: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('REPORTS SHELL: READY');
  console.log('Por Empenho: PRESERVADO');
  console.log('Por Fornecedor: ESTRUTURA MONTADA');
  console.log('Importar NS — SAG: ESTRUTURA MONTADA');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
