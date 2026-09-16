'use client';

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
