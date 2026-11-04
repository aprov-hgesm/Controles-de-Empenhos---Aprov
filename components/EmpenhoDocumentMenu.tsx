'use client';

import { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ChevronDown, Download, Eye, FileText, Loader2, Printer } from 'lucide-react';
import { runEmpenhoPdfAction } from '../lib/empenhoDocuments';
import type { Empenho } from '../lib/types';

type Action = 'view' | 'print' | 'download';

export function EmpenhoDocumentMenu({ empenho, empenhoId, user, onNotify }: {
  empenho?: Empenho;
  empenhoId: string;
  user: User | null;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const document = empenho?.notaEmpenhoPdf;
  const run = async (action: Action) => {
    if (!empenho || !document || !user || busy) return;
    menuRef.current?.removeAttribute('open');
    setBusy(action);
    try {
      await runEmpenhoPdfAction(user, empenho.id, document, action);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Não foi possível abrir a Nota de Empenho.', 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <details ref={menuRef} className="relative text-xs font-semibold text-gray-600 group">
      <summary
        className="flex items-center gap-1 rounded-lg px-2 py-1 cursor-pointer hover:bg-blue-50 hover:text-[#00288e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 list-none [&::-webkit-details-marker]:hidden"
        aria-label={'Opções da Nota de Empenho ' + empenhoId}>
        <FileText className="w-3.5 h-3.5" />
        <span>Empenho: <strong>{empenhoId}</strong></span>
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
      </summary>
      <div className="absolute top-full left-0 z-30 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        {document && user ? (
          <div className="space-y-1">
            {([
              ['view', Eye, 'Visualizar'],
              ['print', Printer, 'Imprimir'],
              ['download', Download, 'Baixar'],
            ] as const).map(([action, Icon, label]) => (
              <button key={action} type="button" disabled={busy !== null}
                onClick={() => void run(action)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50">
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="p-2 text-xs text-slate-500">NE sem PDF disponível. Anexe o documento na aba Empenhos.</p>
        )}
      </div>
    </details>
  );
}
