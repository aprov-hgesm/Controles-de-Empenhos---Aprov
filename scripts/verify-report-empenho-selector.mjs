#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const report = read('features/relatorios/components/RelatorioPorEmpenhoView.tsx');
const selector = read('features/relatorios/components/RelatorioEmpenhoSelector.tsx');

requireText(report, '<RelatorioEmpenhoSelector', 'Relatório por empenho não monta o seletor em cards.');
forbidText(report, 'Selecionar Empenho (NE)', 'Select legado de empenhos voltou para o relatório.');
requireText(selector, 'type="search"', 'Seletor não possui busca textual.');
requireText(selector, 'pregaoFilter', 'Seletor não filtra por Pregão.');
requireText(selector, 'yearFilter', 'Seletor não filtra por ano.');
requireText(selector, 'classFilter', 'Seletor não filtra por classe.');
requireText(selector, 'statusFilter', 'Seletor não filtra por situação.');
requireText(selector, 'formatSupplierCnpj', 'Cards não exibem CNPJ quando disponível.');
requireText(selector, 'linkedInvoices.length', 'Cards não exibem quantidade de NFs.');
requireText(selector, 'invoicesWithNs', 'Cards não exibem cobertura de NS.');
requireText(selector, 'onSelectEmpenho(empenho.id)', 'Cards não selecionam a NE do relatório.');
requireText(selector, 'aria-pressed={selected}', 'Estado selecionado não possui semântica acessível.');
requireText(selector, 'visibleCount', 'Seletor não limita progressivamente grandes listas.');
requireText(selector, 'Mostrar mais empenhos', 'Seletor não oferece expansão progressiva.');

if (findings.length) {
  console.error('REPORT EMPENHO SELECTOR: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('REPORT EMPENHO SELECTOR: READY');
  console.log('Busca: READY');
  console.log('Filtros: Pregão + Ano + Classe + Situação');
  console.log('Cards: NF + NS + valores + seleção acessível');
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
