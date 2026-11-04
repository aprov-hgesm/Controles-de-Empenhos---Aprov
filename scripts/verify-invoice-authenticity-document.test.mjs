#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const types = read('lib/types.ts');
const storage = read('lib/invoiceDocuments.ts');
const actions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const view = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const workspace = read('features/operational/components/OperationalWorkspace.tsx');
const pdf = read('features/relatorios/hooks/useDocumentActions.ts');
const supplemental = read('components/InvoiceSupplementalDocuments.tsx');
const menu = read('components/EmpenhoDocumentMenu.tsx');

test('Campos novos são todos opcionais e preservados ao editar NFs antigas', () => {
  for (const field of [
    'certificadoAutenticidadePdf?: InvoicePdfDocument',
    'certificadoAutenticidadePdfVersions?: InvoicePdfDocument[]',
    'outrosDocumentosPdf?: InvoicePdfDocument[]',
  ]) assert.ok(types.includes(field), field);
  for (const field of ['editingInvoice?.certificadoAutenticidadePdf', 'editingInvoice?.certificadoAutenticidadePdfVersions', 'editingInvoice?.outrosDocumentosPdf']) {
    assert.ok(actions.includes(field), field);
  }
  assert.ok(actions.includes('certificadoAutenticidadePdfVersions: versions'));
  assert.ok(actions.includes('outrosDocumentosPdf: [...prior, document]'));
  assert.ok(actions.includes('handleInvoiceOtherDocumentRemoved'));
});

test('Armazenamento continua privado e validado para os dois novos tipos', () => {
  for (const text of [
    "kind: InvoiceStoredPdfKind",
    "'invoice-authenticity'",
    "'invoice-other'",
    "'certificados-autenticidade'",
    "'documentos-complementares'",
    'assertWorkspacePdfIsSafeForStorage',
    'uploadAndVerifyWorkspacePdf',
    'runtime.settings.invoicesFolderId',
    'workspaceId: runtime.session.workspaceId',
  ]) assert.ok(storage.includes(text), text);
  assert.ok(supplemental.includes('uploadInvoiceAuthenticityPdf'));
  assert.ok(supplemental.includes('uploadInvoiceOtherPdf'));
  assert.ok(supplemental.includes('deleteInvoicePdfUpload'));
});

test('Interface mantém quatro cartões e menu da NE, sem upload duplicado', () => {
  assert.ok(view.includes('<EmpenhoDocumentMenu'));
  assert.ok(view.includes('<InvoiceAuthenticityDocumentActions'));
  assert.ok(view.includes('<InvoiceOtherDocumentsActions'));
  assert.ok(view.includes('<TermoRecebimentoActions'));
  assert.ok(!view.includes('<EmpenhoDocumentActions'));
  for (const action of ["'view'", "'print'", "'download'"]) assert.ok(menu.includes(action));
  assert.ok(menu.includes('runEmpenhoPdfAction'));
  for (const name of ['handleInvoiceAuthenticityUploaded', 'handleInvoiceOtherDocumentUploaded', 'handleInvoiceOtherDocumentRemoved']) {
    assert.ok(workspace.includes(name), name);
    assert.ok(view.includes(name), name);
  }
});

test('Consolidado preserva obrigatoriedade da NE e sequência dos documentos', () => {
  const segment = pdf.slice(pdf.indexOf('const handleDownloadLiquidacaoConsolidada'), pdf.indexOf('const handleGenerateEmpenhoReportPDF'));
  const sections = [
    'if (!targetEmp.notaEmpenhoPdf)',
    'await appendPdf(await empenhoBlob.arrayBuffer())',
    'if (inv.notaFiscalPdf)',
    'if (inv.espelhoNotaFiscalPdf)',
    'if (inv.certificadoAutenticidadePdf)',
    'for (const document of inv.outrosDocumentosPdf || [])',
    'if (termo)',
  ];
  let pos = -1;
  for (const section of sections) {
    const next = segment.indexOf(section);
    assert.ok(next > pos, 'Ordem incorreta: ' + section);
    pos = next;
  }
  assert.ok(segment.includes('shouldIncludeTermo ? await buildTermoRecebimentoPdf(inv) : null'));
  assert.ok(!segment.includes('if (!inv.certificadoAutenticidadePdf)'));
  assert.ok(!segment.includes('if (!inv.outrosDocumentosPdf)'));
});
