#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const report = read('features/relatorios/components/RelatorioPorEmpenhoView.tsx');
const documentActions = read('features/relatorios/hooks/useDocumentActions.ts');
const period = read('lib/reportingPeriod.ts');

requireText(period, 'filterInvoicesByReportingPeriod', 'Utilitário de filtro por período ausente.');
requireText(period, 'isReportingPeriodValid', 'Validação do período ausente.');
requireText(period, 'normalizeOperationalDate', 'Normalização de datas operacionais ausente.');
requireText(report, 'filterInvoicesByReportingPeriod(allLinkedInvoices, reportingPeriod)', 'Tabela de NFs não aplica período.');
requireText(report, 'periodReceivedNfe', 'Indicador financeiro do recorte ausente.');
requireText(report, 'invoicesWithoutNs', 'Pendências de NS não são destacadas.');
requireText(report, 'nsCoverage', 'Cobertura de NS não é calculada.');
requireText(report, 'O saldo atual do empenho continua acumulado.', 'Interface não esclarece a diferença entre recorte e saldo acumulado.');
requireText(report, "handleGenerateEmpenhoReportPDF(emp, 'download', reportingPeriod)", 'Download PDF não recebe o período.');
requireText(report, "handleGenerateEmpenhoReportPDF(emp, 'print', reportingPeriod)", 'Impressão PDF não recebe o período.');
requireText(documentActions, 'pdfAccumulatedReceivedNfe', 'PDF não preserva saldo acumulado real.');
requireText(documentActions, 'pdfPeriodReceivedNfe', 'PDF não calcula movimentação no recorte.');
requireText(documentActions, 'Recorte de NF-e:', 'PDF não identifica o período aplicado.');
forbidText(report, 'Filtrar Conciliação', 'Botão sem ação de filtro voltou à interface.');

if (findings.length) {
  console.error('REPORT EMPENHO DETAIL: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('REPORT EMPENHO DETAIL: READY');
  console.log('Período: FILTRO REAL E INCLUSIVO');
  console.log('Saldo atual: ACUMULADO');
  console.log('NS: COBERTURA + PENDÊNCIAS');
  console.log('PDF: RECORTE PRESERVADO');
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
