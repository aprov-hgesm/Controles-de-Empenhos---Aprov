'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { User } from 'firebase/auth';
import { Download, Eye, FileText, Loader2, Printer, ShieldCheck, Upload } from 'lucide-react';
import {
  deleteInvoicePdfUpload,
  runInvoicePdfAction,
  uploadInvoicePdf,
} from '../lib/invoiceDocuments';
import type { Invoice, InvoicePdfDocument } from '../lib/types';

type ToastType = 'success' | 'error' | 'info';

interface InvoiceDocumentActionsProps {
  invoice: Invoice;
  user: User | null;
  onDocumentUploaded: (invoiceId: string, document: InvoicePdfDocument) => Promise<void>;
  onNotify: (message: string, type?: ToastType) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

export function InvoiceDocumentActions({
  invoice,
  user,
  onDocumentUploaded,
  onNotify,
}: InvoiceDocumentActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyAction, setBusyAction] = useState<'upload' | 'view' | 'print' | 'download' | null>(null);
  const currentDocument = invoice.notaFiscalPdf;

  const executeAction = async (action: 'view' | 'print' | 'download') => {
    if (!user || !currentDocument) return;
    setBusyAction(action);
    try {
      await runInvoicePdfAction(user, currentDocument, action);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Falha ao abrir o documento.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    let uploadedDocument: InvoicePdfDocument | null = null;
    setBusyAction('upload');
    try {
      uploadedDocument = await uploadInvoicePdf(user, invoice.empenhoId, invoice.id, file);
      await onDocumentUploaded(invoice.id, uploadedDocument);
      onNotify(
        currentDocument ? 'Nova versão do documento da Nota Fiscal anexada com segurança.' : 'Documento da Nota Fiscal anexado com segurança.',
        'success'
      );
    } catch (error) {
      if (uploadedDocument) {
        await deleteInvoicePdfUpload(user, uploadedDocument.empenhoId, uploadedDocument.invoiceId, uploadedDocument.pathname).catch(() => undefined);
      }
      onNotify(error instanceof Error ? error.message : 'Falha ao anexar o PDF.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-emerald-100 shadow-sm">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            {currentDocument ? <FileText className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-[#0b1c30]">Documento — Nota Fiscal</h4>
            {currentDocument ? (
              <>
                <p className="text-xs font-semibold text-gray-600 truncate mt-0.5">{currentDocument.originalName}</p>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  {formatBytes(currentDocument.size)} • {invoice.notaFiscalPdfVersions?.length || 1} versão(ões) protegida(s)
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 font-medium mt-0.5">Nenhum PDF da Nota Fiscal anexado.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentDocument && (
            <>
              <button type="button" onClick={() => executeAction('view')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-blue-100 bg-blue-50 text-[#00288e] hover:bg-blue-100 disabled:opacity-50 text-xs font-bold transition-all" title="Visualizar Nota Fiscal">
                {busyAction === 'view' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Visualizar
              </button>
              <button type="button" onClick={() => executeAction('print')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 text-xs font-bold transition-all" title="Imprimir Nota Fiscal sem baixar">
                {busyAction === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />} Imprimir
              </button>
              <button type="button" onClick={() => executeAction('download')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 text-xs font-bold transition-all" title="Baixar Nota Fiscal">
                {busyAction === 'download' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar
              </button>
            </>
          )}
          <button type="button" onClick={() => inputRef.current?.click()} disabled={!user || busyAction !== null} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 text-xs font-bold transition-all">
            {busyAction === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {currentDocument ? 'Substituir PDF' : 'Anexar PDF'}
          </button>
        </div>
      </div>
    </section>
  );
}
