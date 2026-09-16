from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, content):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Replacement expected once in {path}, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))

# 1) Domain types: explicit reversible NF location.
replace_once(
    'lib/types.ts',
    "  numeroNS?: string; // Número identificador do comprovante de liquidação (Nota de Sistema)\n  notaFiscalPdf?: InvoicePdfDocument;",
    "  numeroNS?: string; // Número identificador do comprovante de liquidação (Nota de Sistema)\n  localizacaoAtual?: 'APROVISIONAMENTO' | 'COMISSAO' | 'TESOURARIA'; // Localização operacional atual da NF; datas históricas são preservadas\n  notaFiscalPdf?: InvoicePdfDocument;"
)

# 2) Reuse authenticated private PDF retrieval for the consolidated document.
replace_once('lib/empenhoDocuments.ts', 'async function fetchEmpenhoPdf(\n', 'export async function fetchEmpenhoPdfBlob(\n')
replace_once('lib/empenhoDocuments.ts', '    const pdf = await fetchEmpenhoPdf(user, empenhoId, document);', '    const pdf = await fetchEmpenhoPdfBlob(user, empenhoId, document);')
replace_once('lib/invoiceDocuments.ts', 'async function fetchInvoicePdf(user: User, document: InvoicePdfDocument): Promise<Blob> {', 'export async function fetchInvoicePdfBlob(user: User, document: InvoicePdfDocument): Promise<Blob> {')
replace_once('lib/invoiceDocuments.ts', '    const pdf = await fetchInvoicePdf(user, document);', '    const pdf = await fetchInvoicePdfBlob(user, document);')

# 3) Empenho action: edit only the related Pregão without rebuilding the commitment.
replace_once(
    'features/empenhos/hooks/useEmpenhoActions.ts',
    "  // Handler to register new Commitment\n",
    """  const handleUpdateEmpenhoPregao = async (empenhoId: string, pregao: string): Promise<void> => {
    const currentEmpenho = empenhos.find((emp) => emp.id === empenhoId);
    if (!currentEmpenho) {
      showToast('Empenho não encontrado para alteração do Pregão.', 'error');
      return;
    }

    const normalizedPregao = pregao.trim() || 'Sem Pregão';
    const updatedEmpenho: Empenho = { ...currentEmpenho, pregao: normalizedPregao };

    try {
      if (user) await saveEmpenho(user.uid, updatedEmpenho);
      setEmpenhos((current) => current.map((emp) => emp.id === empenhoId ? updatedEmpenho : emp));
      showToast(`Pregão do empenho ${empenhoId} atualizado para ${normalizedPregao}.`, 'success');
    } catch (error) {
      console.error('Erro ao atualizar Pregão do empenho:', error);
      showToast('Não foi possível atualizar o Pregão do empenho.', 'error');
      throw error;
    }
  };

  // Handler to register new Commitment
"""
)
replace_once(
    'features/empenhos/hooks/useEmpenhoActions.ts',
    "    handleEmpenhoDocumentUploaded,\n    handleCreateEmpenho,",
    "    handleEmpenhoDocumentUploaded,\n    handleUpdateEmpenhoPregao,\n    handleCreateEmpenho,"
)

# 4) Empenhos UI: inline specific Pregão editor in the detail screen.
replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    "  handleEmpenhoDocumentUploaded: (empenhoId: string, document: EmpenhoPdfDocument) => Promise<void>;\n",
    "  handleEmpenhoDocumentUploaded: (empenhoId: string, document: EmpenhoPdfDocument) => Promise<void>;\n  handleUpdateEmpenhoPregao: (empenhoId: string, pregao: string) => Promise<void>;\n"
)
replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    "handleDownloadTermoRecebimento, handleEmpenhoDocumentUploaded, handleGenerateEmpenhoReportPDF",
    "handleDownloadTermoRecebimento, handleEmpenhoDocumentUploaded, handleUpdateEmpenhoPregao, handleGenerateEmpenhoReportPDF"
)
replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    "  return (\n            <div className=\"space-y-6\">",
    """  const [editingPregaoEmpenhoId, setEditingPregaoEmpenhoId] = React.useState<string | null>(null);
  const [pregaoDraft, setPregaoDraft] = React.useState('');
  const [savingPregao, setSavingPregao] = React.useState(false);

  return (
            <div className="space-y-6">"""
)
replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    """                            <p className="text-sm text-gray-600 font-medium mt-1 leading-relaxed">
                              {targetEmp.description}
                            </p>
                          </div>
""",
    """                            <p className="text-sm text-gray-600 font-medium mt-1 leading-relaxed">
                              {targetEmp.description}
                            </p>

                            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 max-w-xl">
                              {editingPregaoEmpenhoId === targetEmp.id ? (
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                  <div className="flex-1">
                                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 block mb-1">Pregão relacionado à Nota de Empenho</label>
                                    <input
                                      value={pregaoDraft}
                                      onChange={(event) => setPregaoDraft(event.target.value)}
                                      placeholder="Ex.: 90013/2025"
                                      className="w-full h-9 px-3 rounded-lg border border-emerald-200 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div className="flex gap-2 sm:pt-4">
                                    <button
                                      type="button"
                                      disabled={savingPregao}
                                      onClick={async () => {
                                        if (savingPregao) return;
                                        setSavingPregao(true);
                                        try {
                                          await handleUpdateEmpenhoPregao(targetEmp.id, pregaoDraft);
                                          setEditingPregaoEmpenhoId(null);
                                        } finally {
                                          setSavingPregao(false);
                                        }
                                      }}
                                      className="h-9 px-3 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-60"
                                    >
                                      Salvar Pregão
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPregaoEmpenhoId(null)}
                                      className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-bold hover:bg-gray-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 block">Pregão relacionado</span>
                                    <span className="text-xs font-bold text-gray-800">{targetEmp.pregao || 'Sem Pregão'}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPregaoDraft(targetEmp.pregao === 'Sem Pregão' ? '' : (targetEmp.pregao || ''));
                                      setEditingPregaoEmpenhoId(targetEmp.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 bg-white text-emerald-800 text-xs font-bold hover:bg-emerald-100"
                                  >
                                    <Edit className="w-3.5 h-3.5" /> Alterar Pregão
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
"""
)

# 5) NF lifecycle: explicit current location while retaining historical timestamps.
replace_once(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    "      registeredAt: editingInvoice?.registeredAt || new Date().toISOString(),\n",
    "      registeredAt: editingInvoice?.registeredAt || new Date().toISOString(),\n      localizacaoAtual: editingInvoice?.localizacaoAtual || (editingInvoice?.tesourariaDate ? 'TESOURARIA' : editingInvoice?.comissaoDate ? 'COMISSAO' : 'APROVISIONAMENTO'),\n"
)
replace_once(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    "          comissaoDate: new Date().toISOString(),\n",
    "          comissaoDate: new Date().toISOString(),\n          localizacaoAtual: 'COMISSAO',\n"
)
replace_once(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    "          tesourariaDate: new Date().toISOString(),\n",
    "          tesourariaDate: new Date().toISOString(),\n          localizacaoAtual: 'TESOURARIA',\n"
)
replace_once(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    "  const handleSaveNumeroNS = async (invoiceId: string, value: string) => {\n",
    """  const handleUpdateInvoiceLocation = async (
    invoiceId: string,
    localizacaoAtual: NonNullable<Invoice['localizacaoAtual']>
  ): Promise<void> => {
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    if (!targetInvoice) {
      showToast('Nota Fiscal não encontrada para alteração de localização.', 'error');
      return;
    }

    const updatedInvoice: Invoice = { ...targetInvoice, localizacaoAtual };
    try {
      if (user) await saveInvoice(user.uid, updatedInvoice);
      setInvoices((current) => current.map((invoice) => invoice.id === invoiceId ? updatedInvoice : invoice));
      const labels = {
        APROVISIONAMENTO: 'Setor de Aprovisionamento',
        COMISSAO: 'Comissão de Recebimento',
        TESOURARIA: 'Tesouraria',
      } as const;
      showToast(`Localização da NF ${invoiceId} alterada para ${labels[localizacaoAtual]}.`, 'success');
    } catch (error) {
      console.error('Erro ao alterar localização da Nota Fiscal:', error);
      showToast('Não foi possível atualizar a localização da Nota Fiscal.', 'error');
      throw error;
    }
  };

  const handleSaveNumeroNS = async (invoiceId: string, value: string) => {
"""
)
replace_once(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    "    handleMarkTesouraria,\n    handleSaveNumeroNS,",
    "    handleMarkTesouraria,\n    handleUpdateInvoiceLocation,\n    handleSaveNumeroNS,"
)

# 6) Term generation becomes reusable for generate/view/print/download and consolidated merge.
replace_once(
    'features/relatorios/hooks/useDocumentActions.ts',
    "import { saveInvoice } from '../../../lib/firebaseSync';\n",
    "import { saveInvoice } from '../../../lib/firebaseSync';\nimport { fetchEmpenhoPdfBlob } from '../../../lib/empenhoDocuments';\nimport { fetchInvoicePdfBlob } from '../../../lib/invoiceDocuments';\n"
)
replace_once(
    'features/relatorios/hooks/useDocumentActions.ts',
    "  const handleDownloadTermoRecebimento = async (inv: Invoice) => {\n",
    "  const buildTermoRecebimentoPdf = async (inv: Invoice) => {\n"
)
replace_once(
    'features/relatorios/hooks/useDocumentActions.ts',
    """     const filename = `Termo_Recebimento_QR_No_${termoNumero}_NF_${inv.id}.pdf`;
    doc.save(filename);
    showToast(`Download iniciado: ${filename}`, 'success');
  };

  const handleGenerateEmpenhoReportPDF""",
    """     const filename = `Termo_Recebimento_QR_No_${termoNumero}_NF_${inv.id}.pdf`;
    return { doc, filename, invoice: updatedInvoiceWithTR };
  };

  type TermoAction = 'generate' | 'view' | 'print' | 'download';

  const handleTermoRecebimentoAction = async (inv: Invoice, action: TermoAction): Promise<void> => {
    let targetWindow: Window | null = null;
    if (action === 'view' || action === 'print') {
      targetWindow = window.open('', '_blank');
      if (!targetWindow) {
        showToast('O navegador bloqueou a nova janela. Autorize pop-ups para visualizar ou imprimir o Termo.', 'error');
        return;
      }
      targetWindow.opener = null;
      targetWindow.document.write('<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f8fafc;color:#0b1c30"><p>Preparando Termo de Recebimento…</p></body></html>');
    }

    try {
      const result = await buildTermoRecebimentoPdf(inv);
      if (!result) {
        targetWindow?.close();
        return;
      }

      if (action === 'generate') {
        showToast(`Termo de Recebimento nº ${result.invoice.termoNumero} gerado e registrado.`, 'success');
        return;
      }

      if (action === 'download') {
        result.doc.save(result.filename);
        showToast(`Download iniciado: ${result.filename}`, 'success');
        return;
      }

      const pdfBlob = result.doc.output('blob');
      const objectUrl = URL.createObjectURL(pdfBlob);
      if (!targetWindow || targetWindow.closed) {
        URL.revokeObjectURL(objectUrl);
        showToast('A janela do documento foi fechada antes do carregamento.', 'error');
        return;
      }
      targetWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60_000);

      if (action === 'print') {
        window.setTimeout(() => {
          try {
            targetWindow?.focus();
            targetWindow?.print();
          } catch {
            // O PDF permanece aberto para impressão pelo controle nativo do navegador.
          }
        }, 1500);
      }
    } catch (error) {
      targetWindow?.close();
      console.error('Erro ao processar Termo de Recebimento:', error);
      showToast('Não foi possível processar o Termo de Recebimento.', 'error');
    }
  };

  const handleDownloadTermoRecebimento = async (inv: Invoice) => {
    await handleTermoRecebimentoAction(inv, 'download');
  };

  const handleDownloadLiquidacaoConsolidada = async (inv: Invoice): Promise<void> => {
    if (!user) {
      showToast('Faça login novamente antes de gerar a Liquidação Consolidada.', 'error');
      return;
    }

    const targetEmp = empenhos.find((emp) => emp.id === inv.empenhoId);
    if (!targetEmp) {
      showToast('Não foi possível localizar o empenho vinculado à Nota Fiscal.', 'error');
      return;
    }
    if (!targetEmp.notaEmpenhoPdf) {
      showToast('Anexe primeiro o PDF da Nota de Empenho para gerar a Liquidação Consolidada.', 'error');
      return;
    }

    try {
      const termo = await buildTermoRecebimentoPdf(inv);
      if (!termo) return;

      const [{ PDFDocument }, empenhoBlob] = await Promise.all([
        import('pdf-lib'),
        fetchEmpenhoPdfBlob(user, targetEmp.id, targetEmp.notaEmpenhoPdf),
      ]);

      const merged = await PDFDocument.create();
      const appendPdf = async (sourceBytes: ArrayBuffer) => {
        const source = await PDFDocument.load(sourceBytes);
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      };

      await appendPdf(await empenhoBlob.arrayBuffer());

      if (inv.notaFiscalPdf) {
        const invoiceBlob = await fetchInvoicePdfBlob(user, inv.notaFiscalPdf);
        await appendPdf(await invoiceBlob.arrayBuffer());
      }

      await appendPdf(termo.doc.output('arraybuffer'));

      const bytes = await merged.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      const safePart = (value: string | undefined, fallback: string) =>
        (value?.trim() || fallback)
          .replace(/[<>:\"/\\|?*\\u0000-\\u001F]/g, '-')
          .replace(/\\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^[-.]+|[-.]+$/g, '') || fallback;
      const filename = `NF${safePart(inv.id, 'SemNumero')}.NE${safePart(inv.empenhoId, 'SemNE')}.Pregão${safePart(targetEmp.pregao, 'SemPregao')}.pdf`;

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      showToast(`Documento de Liquidação Consolidada gerado: ${filename}`, 'success');
    } catch (error) {
      console.error('Erro ao consolidar documentos da liquidação:', error);
      showToast('Não foi possível consolidar os PDFs. Verifique se os documentos anexados são PDFs válidos e não protegidos por senha.', 'error');
    }
  };

  const handleGenerateEmpenhoReportPDF"""
)
replace_once(
    'features/relatorios/hooks/useDocumentActions.ts',
    "  return { handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF };\n",
    "  return { handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleGenerateEmpenhoReportPDF };\n"
)

# 7) Term document card grouped with NF and NE.
write('components/TermoRecebimentoActions.tsx', """'use client';

import { useState } from 'react';
import { Download, Eye, FileCheck2, Loader2, Printer, RefreshCw } from 'lucide-react';
import type { Invoice } from '../lib/types';

type TermoAction = 'generate' | 'view' | 'print' | 'download';

interface TermoRecebimentoActionsProps {
  invoice: Invoice;
  onAction: (invoice: Invoice, action: TermoAction) => Promise<void> | void;
}

export function TermoRecebimentoActions({ invoice, onAction }: TermoRecebimentoActionsProps) {
  const [busyAction, setBusyAction] = useState<TermoAction | null>(null);

  const execute = async (action: TermoAction) => {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await onAction(invoice, action);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-amber-100 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
          <FileCheck2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-black text-[#0b1c30]">Documento — Termo de Recebimento</h4>
          <p className="text-xs font-semibold text-gray-600 mt-0.5">
            {invoice.termoNumero
              ? `Termo nº ${invoice.termoNumero} • gerado em ${new Date(invoice.termoEmissaoDate || invoice.registeredAt || invoice.issueDate).toLocaleDateString('pt-BR')}`
              : 'Ainda não gerado. Gere o termo antes do envio para liquidação.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button type="button" onClick={() => execute('generate')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 text-xs font-bold transition-all" title="Gerar ou atualizar o Termo de Recebimento">
          {busyAction === 'generate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Gerar Termo
        </button>
        <button type="button" onClick={() => execute('view')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-blue-100 bg-blue-50 text-[#00288e] hover:bg-blue-100 disabled:opacity-50 text-xs font-bold transition-all">
          {busyAction === 'view' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Visualizar
        </button>
        <button type="button" onClick={() => execute('print')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 text-xs font-bold transition-all">
          {busyAction === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />} Imprimir
        </button>
        <button type="button" onClick={() => execute('download')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 text-xs font-bold transition-all">
          {busyAction === 'download' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar
        </button>
      </div>
    </section>
  );
}
""")

# 8) NF screen: group all 3 document cards, reversible location, consolidated download.
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    "import { InvoiceDocumentActions } from '../../../components/InvoiceDocumentActions';\n",
    "import { InvoiceDocumentActions } from '../../../components/InvoiceDocumentActions';\nimport { TermoRecebimentoActions } from '../../../components/TermoRecebimentoActions';\n"
)
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    "  handleDownloadTermoRecebimento: (...args: any[]) => any;\n",
    "  handleDownloadTermoRecebimento: (...args: any[]) => any;\n  handleTermoRecebimentoAction: (...args: any[]) => any;\n  handleDownloadLiquidacaoConsolidada: (...args: any[]) => any;\n"
)
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    "  handleMarkTesouraria: (...args: any[]) => any;\n",
    "  handleMarkTesouraria: (...args: any[]) => any;\n  handleUpdateInvoiceLocation: (...args: any[]) => any;\n"
)
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    "handleDeleteInvoice, handleDownloadTermoRecebimento, handleEditInvoice",
    "handleDeleteInvoice, handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleEditInvoice"
)
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    "handleInvoiceDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleSaveComissao",
    "handleInvoiceDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleUpdateInvoiceLocation, handleSaveComissao"
)
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    "  const [isSavingInvoice, setIsSavingInvoice] = useState(false);\n",
    """  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [consolidatingInvoiceId, setConsolidatingInvoiceId] = useState<string | null>(null);
  const getInvoiceLocation = (invoice: Invoice): NonNullable<Invoice['localizacaoAtual']> =>
    invoice.localizacaoAtual || (invoice.tesourariaDate ? 'TESOURARIA' : invoice.comissaoDate ? 'COMISSAO' : 'APROVISIONAMENTO');
"""
)
# Filter counts and filter semantics now reflect the current location, not historical timestamps.
replace_once('features/notas-fiscais/components/NotasFiscaisView.tsx', "{invoices.filter(i => !i.comissaoDate).length}", "{invoices.filter(i => getInvoiceLocation(i) === 'APROVISIONAMENTO').length}")
replace_once('features/notas-fiscais/components/NotasFiscaisView.tsx', "{invoices.filter(i => !i.tesourariaDate).length}", "{invoices.filter(i => getInvoiceLocation(i) === 'COMISSAO').length}")
replace_once('features/notas-fiscais/components/NotasFiscaisView.tsx', "{invoices.filter(i => !!i.tesourariaDate).length}", "{invoices.filter(i => getInvoiceLocation(i) === 'TESOURARIA').length}")
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    """                        let matchesTramitacao = true;
                        if (nfTramitacaoFilter === 'FaltaComissao') {
                          matchesTramitacao = !inv.comissaoDate;
                        } else if (nfTramitacaoFilter === 'FaltaTesouraria') {
                          matchesTramitacao = !inv.tesourariaDate;
                        } else if (nfTramitacaoFilter === 'Concluidas') {
                          matchesTramitacao = !!inv.tesourariaDate;
                        }
""",
    """                        let matchesTramitacao = true;
                        const currentLocation = getInvoiceLocation(inv);
                        if (nfTramitacaoFilter === 'FaltaComissao') {
                          matchesTramitacao = currentLocation === 'APROVISIONAMENTO';
                        } else if (nfTramitacaoFilter === 'FaltaTesouraria') {
                          matchesTramitacao = currentLocation === 'COMISSAO';
                        } else if (nfTramitacaoFilter === 'Concluidas') {
                          matchesTramitacao = currentLocation === 'TESOURARIA';
                        }
"""
)
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    """                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <InvoiceDocumentActions
                              invoice={inv}
                              user={user}
                              onDocumentUploaded={handleInvoiceDocumentUploaded}
                              onNotify={showToast}
                            />
                            <EmpenhoDocumentActions
                              empenho={empenhos.find((emp) => emp.id === inv.empenhoId)}
                              user={user}
                              variant="panel"
                              onDocumentUploaded={handleEmpenhoDocumentUploaded}
                              onNotify={showToast}
                            />
                          </div>
""",
    """                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                            <InvoiceDocumentActions
                              invoice={inv}
                              user={user}
                              onDocumentUploaded={handleInvoiceDocumentUploaded}
                              onNotify={showToast}
                            />
                            <EmpenhoDocumentActions
                              empenho={empenhos.find((emp) => emp.id === inv.empenhoId)}
                              user={user}
                              variant="panel"
                              onDocumentUploaded={handleEmpenhoDocumentUploaded}
                              onNotify={showToast}
                            />
                            <TermoRecebimentoActions
                              invoice={inv}
                              onAction={handleTermoRecebimentoAction}
                            />
                          </div>

                          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 block">Localização atual da Nota Fiscal</span>
                              <p className="text-xs text-gray-500 font-medium mt-0.5">Altere este campo quando a NF retornar da Comissão ou Tesouraria para correção. O histórico de datas permanece preservado.</p>
                            </div>
                            <select
                              value={getInvoiceLocation(inv)}
                              onChange={(event) => handleUpdateInvoiceLocation(inv.id, event.target.value)}
                              className="h-10 px-3 rounded-xl border border-sky-200 bg-white text-xs font-extrabold text-sky-900 outline-none focus:ring-1 focus:ring-sky-500 min-w-[220px]"
                            >
                              <option value="APROVISIONAMENTO">Aprovisionamento</option>
                              <option value="COMISSAO">Comissão de Recebimento</option>
                              <option value="TESOURARIA">Tesouraria</option>
                            </select>
                          </div>
"""
)
replace_once('features/notas-fiscais/components/NotasFiscaisView.tsx', "                              {!inv.comissaoDate && (", "                              {getInvoiceLocation(inv) === 'APROVISIONAMENTO' && (")
replace_once('features/notas-fiscais/components/NotasFiscaisView.tsx', "                              {!inv.tesourariaDate && (", "                              {getInvoiceLocation(inv) === 'COMISSAO' && (")
replace_once('features/notas-fiscais/components/NotasFiscaisView.tsx', '                                  disabled={!inv.comissaoDate}', "                                  disabled={getInvoiceLocation(inv) !== 'COMISSAO'}")
replace_once('features/notas-fiscais/components/NotasFiscaisView.tsx', "                                    inv.comissaoDate \n                                      ? 'bg-[#00288e] hover:bg-[#1e40af] text-white shadow-sm'", "                                    getInvoiceLocation(inv) === 'COMISSAO' \n                                      ? 'bg-[#00288e] hover:bg-[#1e40af] text-white shadow-sm'")
replace_once('features/notas-fiscais/components/NotasFiscaisView.tsx', '                                  title={!inv.comissaoDate ? "Envie primeiro para a Comissão de Recebimento" : ""}', '                                  title={getInvoiceLocation(inv) !== \'COMISSAO\' ? "A NF precisa estar na Comissão de Recebimento antes do envio à Tesouraria" : ""}')
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    """                          <button
                            onClick={() => handleDownloadTermoRecebimento(inv)}
                            className="w-full mt-3 py-2.5 bg-gradient-to-r from-emerald-600 to-[#00288e] hover:from-emerald-700 hover:to-[#001e6a] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
                          >
                            <FileDown className="w-4 h-4" /> Gerar Termo de Recebimento de Artigos de QR (PDF)
                          </button>
""",
    """                          <div className="mt-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-[#001453] uppercase tracking-wider">Documento de Liquidação Consolidada</p>
                              <p className="text-xs text-gray-600 font-medium mt-1">Une, nesta ordem, Nota de Empenho + Nota Fiscal (quando houver) + Termo de Recebimento em um único PDF.</p>
                            </div>
                            <button
                              type="button"
                              disabled={consolidatingInvoiceId !== null}
                              onClick={async () => {
                                if (consolidatingInvoiceId) return;
                                setConsolidatingInvoiceId(inv.id);
                                try {
                                  await handleDownloadLiquidacaoConsolidada(inv);
                                } finally {
                                  setConsolidatingInvoiceId(null);
                                }
                              }}
                              className="h-11 px-5 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-wait whitespace-nowrap"
                            >
                              {consolidatingInvoiceId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                              {consolidatingInvoiceId === inv.id ? 'Consolidando PDFs…' : 'Gerar e Baixar Consolidado'}
                            </button>
                          </div>
"""
)

# 9) Main orchestration wiring.
replace_once(
    'app/page.tsx',
    "    handleEmpenhoDocumentUploaded,\n    handleCreateEmpenho,",
    "    handleEmpenhoDocumentUploaded,\n    handleUpdateEmpenhoPregao,\n    handleCreateEmpenho,"
)
replace_once(
    'app/page.tsx',
    "    handleMarkTesouraria,\n    handleSaveNumeroNS,",
    "    handleMarkTesouraria,\n    handleUpdateInvoiceLocation,\n    handleSaveNumeroNS,"
)
replace_once(
    'app/page.tsx',
    "  const { handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF } = useDocumentActions({",
    "  const { handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleGenerateEmpenhoReportPDF } = useDocumentActions({"
)
replace_once(
    'app/page.tsx',
    "handleDownloadTermoRecebimento, handleEmpenhoDocumentUploaded, handleGenerateEmpenhoReportPDF",
    "handleDownloadTermoRecebimento, handleEmpenhoDocumentUploaded, handleUpdateEmpenhoPregao, handleGenerateEmpenhoReportPDF"
)
replace_once(
    'app/page.tsx',
    "handleDeleteInvoice, handleDownloadTermoRecebimento, handleEditInvoice",
    "handleDeleteInvoice, handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleEditInvoice"
)
replace_once(
    'app/page.tsx',
    "handleInvoiceDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleSaveComissao",
    "handleInvoiceDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleUpdateInvoiceLocation, handleSaveComissao"
)

print('Liquidacao consolidada v17 codemod applied successfully.')
