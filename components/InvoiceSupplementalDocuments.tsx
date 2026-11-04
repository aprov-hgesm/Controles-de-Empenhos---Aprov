'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { User } from 'firebase/auth';
import { Download, Eye, FileCheck2, FilePlus2, Loader2, Printer, Trash2, Upload } from 'lucide-react';
import {
  deleteInvoicePdfUpload,
  runInvoicePdfAction,
  uploadInvoiceAuthenticityPdf,
  uploadInvoiceOtherPdf,
} from '../lib/invoiceDocuments';
import { getInvoiceRecordKey } from '../lib/invoiceIdentity';
import type { Invoice, InvoicePdfDocument } from '../lib/types';

type ToastType = 'success' | 'error' | 'info';
type DocumentAction = 'view' | 'print' | 'download';

interface SharedProps {
  invoice: Invoice;
  user: User | null;
  onNotify: (message: string, type?: ToastType) => void;
}

function DocumentButtons({ user, document, label, disabled, onNotify }: {
  user: User | null;
  document: InvoicePdfDocument;
  label: string;
  disabled?: boolean;
  onNotify: SharedProps['onNotify'];
}) {
  const [busy, setBusy] = useState<DocumentAction | null>(null);
  const run = async (action: DocumentAction) => {
    if (!user || busy || disabled) return;
    setBusy(action);
    try {
      await runInvoicePdfAction(user, document, action, label);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Não foi possível abrir o PDF.', 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {([
        ['view', Eye, 'Visualizar'],
        ['print', Printer, 'Imprimir'],
        ['download', Download, 'Baixar'],
      ] as const).map(([action, Icon, title]) => (
        <button key={action} type="button" disabled={!user || disabled || busy !== null}
          onClick={() => void run(action)}
          title={title + ' ' + label}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-[#00288e] hover:bg-blue-50 disabled:opacity-50">
          {busy === action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {title}
        </button>
      ))}
    </div>
  );
}

/** PDF opcional por NF, com substituições rastreadas e última versão no consolidado. */
export function InvoiceAuthenticityDocumentActions({ invoice, user, onDocumentUploaded, onNotify }: SharedProps & {
  onDocumentUploaded: (invoiceRecordKey: string, document: InvoicePdfDocument) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const current = invoice.certificadoAutenticidadePdf;
  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user || uploading) return;
    setUploading(true);
    let uploaded: InvoicePdfDocument | null = null;
    try {
      uploaded = await uploadInvoiceAuthenticityPdf(user, invoice.empenhoId, invoice.id, file);
      await onDocumentUploaded(getInvoiceRecordKey(invoice), uploaded);
      onNotify('Certificado de autenticidade anexado com segurança.', 'success');
    } catch (error) {
      if (uploaded) {
        await deleteInvoicePdfUpload(user, uploaded.empenhoId, uploaded.invoiceId, uploaded).catch(() => undefined);
      }
      onNotify(error instanceof Error ? error.message : 'Falha ao anexar o certificado.', 'error');
    } finally {
      setUploading(false);
    }
  };
  return (
    <section className="bg-white/80 p-4 rounded-2xl border border-violet-100 shadow-sm min-w-0">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFileChange} />
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center flex-shrink-0">
          <FileCheck2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-black text-[#0b1c30]">Documento — Certificado de Autenticidade</h4>
          {current ? (
            <>
              <p className="text-xs text-gray-700 truncate mt-1" title={current.originalName}>{current.originalName}</p>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">
                {invoice.certificadoAutenticidadePdfVersions?.length || 1} versão(ões) protegida(s)
              </p>
            </>
          ) : <p className="text-xs text-gray-500 mt-1">Opcional. Comprove a autenticidade da NF anexando um PDF.</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {current && <DocumentButtons user={user} document={current} label="Certificado de Autenticidade" onNotify={onNotify} disabled={uploading} />}
        <button type="button" disabled={!user || uploading} onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-50 text-xs font-bold">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {current ? 'Nova versão' : 'Anexar certificado'}
        </button>
      </div>
    </section>
  );
}

export function InvoiceOtherDocumentsActions({ invoice, user, onDocumentUploaded, onDocumentRemoved, onNotify }: SharedProps & {
  onDocumentUploaded: (invoiceRecordKey: string, document: InvoicePdfDocument) => Promise<void>;
  onDocumentRemoved: (invoiceRecordKey: string, documentId: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const documents = invoice.outrosDocumentosPdf || [];
  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user || busyId) return;
    if (documents.length >= 12) {
      onNotify('Limite de 12 documentos adicionais por Nota Fiscal.', 'error');
      return;
    }
    setBusyId('upload');
    let uploaded: InvoicePdfDocument | null = null;
    try {
      uploaded = await uploadInvoiceOtherPdf(user, invoice.empenhoId, invoice.id, file);
      await onDocumentUploaded(getInvoiceRecordKey(invoice), uploaded);
      onNotify('Documento complementar anexado com segurança.', 'success');
    } catch (error) {
      if (uploaded) {
        await deleteInvoicePdfUpload(user, uploaded.empenhoId, uploaded.invoiceId, uploaded).catch(() => undefined);
      }
      onNotify(error instanceof Error ? error.message : 'Falha ao anexar o documento complementar.', 'error');
    } finally {
      setBusyId(null);
    }
  };
  const remove = async (document: InvoicePdfDocument) => {
    if (!user || busyId || !window.confirm('Retirar este PDF do consolidado? O arquivo original permanecerá protegido no armazenamento.')) return;
    setBusyId(document.id);
    try {
      await onDocumentRemoved(getInvoiceRecordKey(invoice), document.id);
      onNotify('Documento retirado do consolidado. O arquivo original foi preservado.', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Falha ao retirar documento.', 'error');
    } finally {
      setBusyId(null);
    }
  };
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFileChange} />
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h4 className="text-xs font-black text-[#0b1c30] flex items-center gap-1.5">
            <FilePlus2 className="h-4 w-4" /> Outros documentos (opcional)
          </h4>
          <p className="text-xs text-gray-500">Certificados adicionais ou PDFs complementares, incluídos após o certificado principal.</p>
        </div>
        <button type="button" disabled={!user || busyId !== null || documents.length >= 12}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-[#00288e] hover:bg-blue-50 disabled:opacity-50">
          {busyId === 'upload' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Adicionar PDF {documents.length > 0 ? '(' + documents.length + '/12)' : ''}
        </button>
      </div>
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((document, index) => (
            <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-slate-200 p-2">
              <p className="text-xs font-semibold text-gray-700 min-w-0 truncate" title={document.originalName}>
                {index + 1}. {document.originalName}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <DocumentButtons user={user} document={document} label="Documento Complementar" onNotify={onNotify} disabled={busyId !== null} />
                <button type="button" onClick={() => void remove(document)} disabled={!user || busyId !== null}
                  title="Retirar do consolidado (o arquivo original será preservado)"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-rose-700 border border-rose-100 hover:bg-rose-50 disabled:opacity-50 text-xs font-semibold">
                  {busyId === document.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Retirar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
