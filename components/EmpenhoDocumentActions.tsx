'use client';

import { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Download, Eye, FileText, Loader2, Printer, ShieldCheck, Upload } from 'lucide-react';
import {
  deleteEmpenhoPdfUpload,
  runEmpenhoPdfAction,
  uploadEmpenhoPdf,
} from '../lib/empenhoDocuments';
import type { Empenho, EmpenhoPdfDocument } from '../lib/types';

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_EMPENHO_DOCUMENTS === 'true';

type ToastType = 'success' | 'error' | 'info';

interface EmpenhoDocumentActionsProps {
  empenho?: Empenho;
  user: User | null;
  variant?: 'panel' | 'compact';
  onDocumentUploaded: (empenhoId: string, document: EmpenhoPdfDocument) => Promise<void>;
  onNotify: (message: string, type?: ToastType) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

export function EmpenhoDocumentActions({
  empenho,
  user,
  variant = 'panel',
  onDocumentUploaded,
  onNotify,
}: EmpenhoDocumentActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyAction, setBusyAction] = useState<'upload' | 'view' | 'print' | 'download' | null>(null);

  if (!FEATURE_ENABLED || !empenho) return null;

  const currentDocument = empenho.notaEmpenhoPdf;

  const executeAction = async (action: 'view' | 'print' | 'download') => {
    if (!user || !currentDocument) return;
    setBusyAction(action);
    try {
      await runEmpenhoPdfAction(user, empenho.id, currentDocument, action);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Falha ao abrir o documento.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    let uploadedDocument: EmpenhoPdfDocument | null = null;
    setBusyAction('upload');
    try {
      uploadedDocument = await uploadEmpenhoPdf(user, empenho.id, file);
      await onDocumentUploaded(empenho.id, uploadedDocument);
      onNotify(
        currentDocument
          ? 'Nova versão da Nota de Empenho anexada com segurança.'
          : 'Nota de Empenho anexada com segurança.',
        'success'
      );
    } catch (error) {
      if (uploadedDocument) {
        await deleteEmpenhoPdfUpload(user, empenho.id, uploadedDocument.pathname).catch(() => undefined);
      }
      onNotify(error instanceof Error ? error.message : 'Falha ao anexar o PDF.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const actionButtons = currentDocument ? (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => executeAction('view')}
        disabled={busyAction !== null}
        aria-label="Visualizar Nota de Empenho"
        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-blue-100 bg-blue-50 text-[#00288e] hover:bg-blue-100 disabled:opacity-50 text-xs font-bold transition-all"
        title="Visualizar Nota de Empenho"
      >
        {busyAction === 'view' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
        {variant === 'panel' && 'Visualizar'}
      </button>
      <button
        type="button"
        onClick={() => executeAction('print')}
        disabled={busyAction !== null}
        aria-label="Imprimir Nota de Empenho"
        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 text-xs font-bold transition-all"
        title="Imprimir Nota de Empenho sem baixar"
      >
        {busyAction === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
        {variant === 'panel' && 'Imprimir'}
      </button>
      <button
        type="button"
        onClick={() => executeAction('download')}
        disabled={busyAction !== null}
        aria-label="Baixar Nota de Empenho"
        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 text-xs font-bold transition-all"
        title="Baixar Nota de Empenho"
      >
        {busyAction === 'download' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {variant === 'panel' && 'Baixar'}
      </button>
    </div>
  ) : null;

  if (variant === 'compact') return actionButtons;

  return (
    <section className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-blue-100 shadow-sm">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00288e] flex items-center justify-center flex-shrink-0">
            {currentDocument ? <FileText className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-[#0b1c30]">Documento — Nota de Empenho</h4>
            {currentDocument ? (
              <>
                <p className="text-xs font-semibold text-gray-600 truncate mt-0.5">{currentDocument.originalName}</p>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  {formatBytes(currentDocument.size)} • {empenho.notaEmpenhoPdfVersions?.length || 1} versão(ões) protegida(s)
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Nenhum PDF anexado. O arquivo ficará privado e limitado a usuários autorizados.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {actionButtons}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!user || busyAction !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00288e] text-white hover:bg-[#1e40af] disabled:opacity-50 text-xs font-bold transition-all"
          >
            {busyAction === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {currentDocument ? 'Nova versão' : 'Anexar PDF'}
          </button>
        </div>
      </div>
    </section>
  );
}
