#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const view = read('features/relatorios/components/RelatorioPorFornecedorView.tsx');
const reporting = read('lib/supplierReporting.ts');

requireText(reporting, 'buildSupplierReports', 'Agregador por fornecedor ausente.');
requireText(reporting, 'normalizeSupplierCnpj', 'Agregação não normaliza CNPJ.');
requireText(reporting, 'empenhoIds.has(invoice.empenhoId)', 'NFs não são vinculadas pelo empenhoId.');
requireText(reporting, 'pregaoMap', 'Relatório não agrupa empenhos por Pregão.');
requireText(reporting, 'invoicesWithoutNs', 'Pendências de NS não são consolidadas.');
requireText(view, 'Razão social ou CNPJ', 'Busca de fornecedor ausente.');
requireText(view, 'aria-pressed={selected}', 'Seleção do fornecedor não possui estado acessível.');
requireText(view, 'selectedSupplier.pregoes.map', 'Detalhamento por Pregão ausente.');
requireText(view, 'pregaoReport.empenhos.map', 'Detalhamento das NEs do Pregão ausente.');
requireText(view, 'empenhoReport.invoices.map', 'Tabela de NFs do empenho ausente.');
requireText(view, 'invoice.numeroNS', 'Visualização de NS ausente.');
requireText(view, 'empenhosWithoutCnpj', 'Pendências históricas de CNPJ não são sinalizadas.');
forbidText(view, 'Base pronta para consolidação', 'Placeholder do Bloco 3 ainda está presente.');

if (findings.length) {
  console.error('SUPPLIER REPORTS: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SUPPLIER REPORTS: READY');
  console.log('Chave: CNPJ');
  console.log('Agrupamento: CNPJ > Pregão > NE > NF');
  console.log('NS: COBERTURA + PENDÊNCIAS');
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
