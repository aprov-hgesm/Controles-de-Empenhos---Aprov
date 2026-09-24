'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardList,
  PackagePlus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import type { Empenho, Invoice, Item } from '../../../lib/types';
import {
  loadWarehouseDeliveriesContext,
  type WarehouseDeliveriesContext,
} from '../../../lib/warehouse/logisticsRepository';
import { WarehouseSiscofisOperational } from './WarehouseSiscofisOperational';

type RegistrationTab = 'invoices' | 'siscofis';

interface InvoiceQueueRow {
  key: string;
  invoice: Invoice;
  empenho: Empenho | null;
  item: Item | null;
  itemId: string;
  quantity: number;
  processed: boolean;
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleDateString('pt-BR');
}

function InvoiceRegistrationQueue({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] = useState<WarehouseDeliveriesContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setContext(await loadWarehouseDeliveriesContext(workspaceId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao consultar as Notas Fiscais.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo<InvoiceQueueRow[]>(() => {
    if (!context) return [];
    const empenhoById = new Map(context.empenhos.map((empenho) => [empenho.id, empenho]));
    const processedKeys = new Set<string>();

    for (const movement of context.movements) {
      const source = movement.source;
      if (source?.kind !== 'INVOICE') continue;
      for (const itemId of source.itemIds) {
        processedKeys.add(source.invoiceRecordKey + '|' + itemId);
      }
    }

    return context.invoices
      .slice()
      .sort((left, right) =>
        (right.registeredAt || right.issueDate || '').localeCompare(left.registeredAt || left.issueDate || '')
      )
      .flatMap((invoice) => {
        const empenho = empenhoById.get(invoice.empenhoId) || null;
        const recordKey = invoice.recordKey || invoice.id;
        return invoice.items.map((invoiceItem) => ({
          key: recordKey + '|' + invoiceItem.itemId,
          invoice,
          empenho,
          item: empenho?.items.find((item) => item.id === invoiceItem.itemId) || null,
          itemId: invoiceItem.itemId,
          quantity: invoiceItem.quantity,
          processed: processedKeys.has(recordKey + '|' + invoiceItem.itemId),
        }));
      });
  }, [context]);

  const pendingCount = rows.filter((row) => !row.processed).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-500">Itens de NF</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{rows.length}</p>
          <p className="mt-1 text-[10px] text-slate-500">lidos do EMPROVEX, sem duplicar a NF</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-600">Pendentes</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{pendingCount}</p>
          <p className="mt-1 text-[10px] text-slate-500">aguardando decisão logística no ADM</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600">Já integrados</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{rows.length - pendingCount}</p>
          <p className="mt-1 text-[10px] text-slate-500">com movimento de NF reconhecido no ledger</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <ClipboardList className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">Fila de Notas Fiscais</p>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              Cada item recebido pelo EMPROVEX aparece aqui para tratamento logístico.
              O núcleo operacional é somente leitura nesta superfície.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600">
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Atualizar
          </button>
        </div>

        {message && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{message}</div>}

        {loading && !context ? (
          <p className="mt-5 text-sm text-slate-500">Consultando NFs e empenhos…</p>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Nenhum item de NF encontrado na janela consultada.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((row) => (
              <div key={row.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={row.processed ? 'rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700' : 'rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700'}>
                        {row.processed ? 'Integrado' : 'Pendente de alocação'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">NF {row.invoice.id} · {formatDate(row.invoice.issueDate)}</span>
                    </div>
                    <p className="mt-2 truncate text-sm font-black text-slate-800">{row.item?.name || 'Item ' + row.itemId}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{row.invoice.supplier} · Empenho {row.invoice.empenhoId}</p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 text-right">
                    <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Quantidade</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{row.quantity.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Unidade</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{row.item?.unit || '—'}</p>
                    </div>
                  </div>
                </div>

                {!row.processed && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-3">
                      <div className="flex items-center gap-2 text-blue-700"><PackagePlus className="h-3.5 w-3.5" /><p className="text-[10px] font-black uppercase tracking-[0.1em]">Alocar no depósito</p></div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">Destino previsto: depósito → estrutura → nível, lote, validade e código de barras.</p>
                    </div>
                    <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-3">
                      <div className="flex items-center gap-2 text-violet-700"><Sparkles className="h-3.5 w-3.5" /><p className="text-[10px] font-black uppercase tracking-[0.1em]">Consumo imediato</p></div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">Não ocupa posição física; deverá alimentar o registro destinado ao lançamento no SISCOFIS.</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {context?.truncated && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A consulta atingiu um dos limites bounded. A fila não conclui sobre registros fora da janela carregada.
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-[10px] leading-5 text-slate-500">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
        Nesta reorganização a fila já passa a ser a porta de entrada do ADM. A gravação de alocação/consumo imediato será consolidada no namespace warehouse, sem voltar a acoplar o cadastro da NF ao núcleo EMPROVEX.
      </div>
    </div>
  );
}

export function WarehouseItemRegistrationOperational({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('aba');
  const [tab, setTab] = useState<RegistrationTab>(requested === 'siscofis' ? 'siscofis' : 'invoices');

  useEffect(() => {
    setTab(requested === 'siscofis' ? 'siscofis' : 'invoices');
  }, [requested]);

  return (
    <div className="mt-4 space-y-5" data-testid="warehouse-registration-operational">
      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
        <button type="button" onClick={() => setTab('invoices')} className={tab === 'invoices' ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm' : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'}>Notas Fiscais pendentes</button>
        <button type="button" onClick={() => setTab('siscofis')} className={tab === 'siscofis' ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm' : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'}>Migração SISCOFIS</button>
      </div>

      {tab === 'invoices'
        ? <InvoiceRegistrationQueue workspaceId={workspaceId} />
        : <WarehouseSiscofisOperational workspaceId={workspaceId} />}
    </div>
  );
}
