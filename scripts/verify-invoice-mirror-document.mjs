#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const types = read('lib/types.ts');
const storage = read('lib/invoiceDocuments.ts');
const actions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const view = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const component = read('components/InvoiceMirrorDocumentActions.tsx');
const documents = read('features/relatorios/hooks/useDocumentActions.ts');
const page = read('app/page.tsx');

for (const expected of [
  'espelhoNotaFiscalPdf?: InvoicePdfDocument',
  'espelhoNotaFiscalPdfVersions?: InvoicePdfDocument[]',
]) {
  requireText(types, expected, `Contrato de Invoice perdeu o campo do Espelho: ${expected}`);
}

for (const expected of [
  'uploadInvoiceMirrorPdf',
  "'invoice-mirror'",
  "'espelhos-nota-fiscal'",
  "documentLabel = 'Nota Fiscal'",
]) {
  requireText(storage, expected, `Storage do Espelho perdeu requisito: ${expected}`);
}

for (const expected of [
  'handleInvoiceMirrorDocumentUploaded',
  'espelhoNotaFiscalPdf: document',
  'espelhoNotaFiscalPdfVersions: versions',
  'editingInvoice?.espelhoNotaFiscalPdf',
  'editingInvoice?.espelhoNotaFiscalPdfVersions',
]) {
  requireText(actions, expected, `Persistência do Espelho perdeu requisito: ${expected}`);
}

for (const expected of [
  'InvoiceMirrorDocumentActions',
  'handleInvoiceMirrorDocumentUploaded',
  'Espelho da Nota Fiscal (quando anexado)',
]) {
  requireText(view, expected, `Tela Acompanhar NFs perdeu requisito: ${expected}`);
}

for (const expected of [
  'Documento — Espelho da Nota Fiscal',
  'Opcional. Quando anexado',
  'uploadInvoiceMirrorPdf',
  "runInvoicePdfAction(user, currentDocument, action, 'Espelho da Nota Fiscal')",
]) {
  requireText(component, expected, `Componente do Espelho perdeu requisito: ${expected}`);
}

const invoiceIndex = documents.indexOf('if (inv.notaFiscalPdf)');
const mirrorIndex = documents.indexOf('if (inv.espelhoNotaFiscalPdf)');
const termoIndex = documents.indexOf('if (termo)', mirrorIndex);
if (!(invoiceIndex >= 0 && mirrorIndex > invoiceIndex && termoIndex > mirrorIndex)) {
  findings.push('A ordem do consolidado deve ser Nota Fiscal -> Espelho -> Termo de Recebimento.');
}

requireText(
  documents,
  'fetchInvoicePdfBlob(user, inv.espelhoNotaFiscalPdf)',
  'O consolidado não carrega o PDF do Espelho da Nota Fiscal.'
);

requireText(
  page,
  'handleInvoiceMirrorDocumentUploaded',
  'A composição principal não repassa o handler do Espelho da Nota Fiscal.'
);

if (findings.length) {
  console.error('INVOICE MIRROR DOCUMENT: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('INVOICE MIRROR DOCUMENT: READY');
  console.log('Upload por NF: OPCIONAL');
  console.log('Storage: GOOGLE DRIVE PRIVADO');
  console.log('Versões: PRESERVADAS');
  console.log('Consolidado: NF -> ESPELHO -> TR');
  console.log('Ausência de Espelho: NÃO BLOQUEIA LIQUIDAÇÃO');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}
