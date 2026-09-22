#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const findings = [];
const read = (path) => readFileSync(path, 'utf8');
const requireText = (source, marker, message) => {
  if (!source.includes(marker)) findings.push(message);
};

const types = read('lib/types.ts');
const nup = read('lib/spedNup.ts');
const actions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const invoicesView = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const reportView = read('features/relatorios/components/RelatorioPorEmpenhoView.tsx');
const documents = read('features/relatorios/hooks/useDocumentActions.ts');
const app = read('app/page.tsx');

requireText(types, 'spedNup?: string', 'Invoice não possui campo opcional spedNup.');
requireText(nup, 'SPED_NUP_CANONICAL_PATTERN', 'Normalização do NUP não possui padrão canônico.');
requireText(nup, "\\d{5}\\.\\d{6}\\/\\d{4}-\\d{2}", 'Formato NUP esperado foi alterado.');
requireText(nup, 'digits.length === 17', 'Normalização de NUP sem separadores foi removida.');
requireText(nup, 'isValidOptionalSpedNup', 'Validação opcional do NUP foi removida.');

requireText(actions, 'editingInvoice?.spedNup', 'Edição da NF não preserva o NUP existente.');
requireText(actions, 'handleMarkTesouraria = async', 'Fluxo de envio à Tesouraria não foi localizado.');
requireText(actions, 'spedNupValue', 'Envio à Tesouraria não recebe o NUP opcional.');
requireText(actions, 'normalizeSpedNup(spedNupValue)', 'NUP não é normalizado antes de persistir.');
requireText(actions, 'handleSaveSpedNup', 'Notas já enviadas não podem ter NUP corrigido posteriormente.');
requireText(actions, 'saveInvoice(user.uid, updatedTargetInvoice)', 'NUP e envio à Tesouraria não são persistidos no mesmo documento de NF.');

requireText(invoicesView, 'NUP do SPED · opcional', 'Campo opcional de NUP não aparece no fluxo da Tesouraria.');
requireText(invoicesView, '64594.015046/2026-11', 'Exemplo de NUP esperado não aparece no campo.');
requireText(invoicesView, 'handleMarkTesouraria(recordKey, draftValue)', 'Campo NUP não acompanha o envio para Tesouraria.');
requireText(invoicesView, 'Salvar NUP', 'NUP não pode ser corrigido após o envio.');
requireText(invoicesView, 'NUP: {inv.spedNup}', 'Cartão da NF não exibe o NUP persistido.');

requireText(reportView, 'NUP SPED', 'Relatório visual por empenho não possui coluna de NUP.');
requireText(reportView, 'inv.spedNup', 'Relatório visual não lê o NUP da NF.');
requireText(reportView, 'selectedReportInvoice.spedNup', 'Detalhamento da NF no relatório não mostra o NUP.');

requireText(documents, 'formattedNup', 'PDF do relatório não prepara o NUP.');
requireText(documents, "'NUP SPED'", 'PDF do relatório não possui coluna de NUP.');
requireText(documents, 'inv.spedNup', 'PDF do relatório não lê o NUP da NF.');

requireText(app, 'handleSaveSpedNup', 'A ação de salvar NUP não foi conectada à tela.');

if (findings.length) {
  console.error('SPED NUP REPORTING: FAIL');
  findings.forEach((finding) => console.error(`  [NUP] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SPED NUP REPORTING: READY');
  console.log('Tesouraria: NUP OPCIONAL');
  console.log('Persistência: MESMO DOCUMENTO DA NF');
  console.log('Correção posterior: ATIVA');
  console.log('Relatório visual: NUP POR NF');
  console.log('PDF/Impressão: NUP POR NF');
}
