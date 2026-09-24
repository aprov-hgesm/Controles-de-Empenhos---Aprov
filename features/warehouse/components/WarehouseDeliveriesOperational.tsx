'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, FileText, PackageCheck, RefreshCw, TriangleAlert, Warehouse } from 'lucide-react';

import { buildWarehouseDeliveryAlertCandidates } from '../../../lib/warehouse/logisticsAlerts';
import {
  loadWarehouseDeliveriesContext,
  reconcileWarehouseLogisticsAlerts,
  type WarehouseDeliveriesContext,
} from '../../../lib/warehouse/logisticsRepository';
import {
  warehouseDeliveryStateLabel,
  type WarehouseDeliveryProjection,
} from '../../../lib/warehouse/logistics';

function quantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function dateLabel(value: string | null): string {
  if (!value) return '—';
  const normalized = value.length === 10 ? value + 'T00:00:00.000Z' : value;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed)
    ? value
    : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(parsed));
}

function statusClass(status: WarehouseDeliveryProjection['status']): string {
  if (status === 'OVERDUE') return 'border-rose-300/20 bg-rose-400/[0.08] text-rose-200';
  if (status === 'DUE_SOON' || status === 'PARTIALLY_RECEIVED') {
    return 'border-amber-300/20 bg-amber-400/[0.08] text-amber-200';
  }
  if (status === 'SCHEDULE_FULFILLED' || status === 'CLOSED') {
    return 'border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-200';
  }
  return 'border-blue-300/20 bg-blue-400/[0.08] text-blue-200';
}

export function WarehouseDeliveriesOperational({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] = useState<WarehouseDeliveriesContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const next = await loadWarehouseDeliveriesContext(workspaceId);
      setContext(next);
      await reconcileWarehouseLogisticsAlerts(
        workspaceId,
        buildWarehouseDeliveryAlertCandidates(workspaceId, next.projections),
        ['DELIVERY_DUE_SOON', 'DELIVERY_OVERDUE'],
        !next.truncated
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar a visão de Entregas.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = useMemo(
    () => context?.projections.filter(
      (item) => item.status !== 'CLOSED' && item.status !== 'SCHEDULE_FULFILLED'
    ) || [],
    [context]
  );

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-deliveries-operational">
      <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-200">
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">Cronograma → NF → estoque</p>
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Cronograma é expectativa. Nota Fiscal cadastrada continua sendo o recebimento efetivo.
              A integração ao warehouse é apenas exibida quando existe, sem confirmação duplicada,
              saldo paralelo ou vínculo presumido entre NF e remessa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/?tab=cronogramas" className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/[0.04]">
              Abrir/Editar Cronograma
            </Link>
            <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-xl border border-white/[0.08] p-2.5 text-slate-300" aria-label="Atualizar Entregas">
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {context?.truncated && (
        <div className="rounded-xl border border-amber-300/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-amber-100/80">
          A consulta atingiu um limite bounded. Os dados exibidos permanecem reais, mas a resolução
          automática de avisos ausentes foi suspensa para não concluir sobre registros não lidos.
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-rose-300/15 bg-rose-400/[0.05] px-4 py-3 text-xs text-rose-100" data-testid="warehouse-deliveries-message">
          {message}
        </div>
      )}

      {loading && !context ? (
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">
          Carregando Cronogramas, Empenhos, NFs e saldos reais…
        </div>
      ) : !context?.projections.length ? (
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">
          Nenhum empenho foi encontrado na janela bounded desta visão.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Em acompanhamento</p><p className="mt-2 text-2xl font-black text-white">{active.length}</p></div>
            <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Previsões vencidas</p><p className="mt-2 text-2xl font-black text-white">{context.projections.filter((item) => item.overdueQuantity > 0).length}</p></div>
            <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Com cronograma</p><p className="mt-2 text-2xl font-black text-white">{context.projections.filter((item) => item.hasSchedule).length}</p></div>
            <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">NFs consultadas</p><p className="mt-2 text-2xl font-black text-white">{context.invoices.length}</p></div>
          </div>

          <div className="space-y-4">
            {context.projections.map((delivery) => (
              <article key={delivery.empenhoId} data-testid="warehouse-delivery-card" data-empenho-id={delivery.empenhoId} className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-black text-blue-200">{delivery.empenhoId}</p>
                      <span className={'rounded-full border px-2.5 py-1 text-[10px] font-bold ' + statusClass(delivery.status)}>
                        {warehouseDeliveryStateLabel(delivery.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-200">{delivery.supplier}</p>
                    {delivery.localEntrega && <p className="mt-1 text-xs text-slate-500">{delivery.localEntrega}{delivery.horarioEntrega ? ' · ' + delivery.horarioEntrega : ''}</p>}
                  </div>
                  <Link href="/?tab=cronogramas" className="w-fit rounded-xl border border-blue-300/15 bg-blue-400/[0.06] px-3 py-2 text-xs font-bold text-blue-100">
                    Abrir/Editar Cronograma
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Empenhado</p><p className="mt-1 text-sm font-black text-slate-200">{quantity(delivery.committedQuantity)}</p></div>
                  <div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Recebido</p><p className="mt-1 text-sm font-black text-slate-200">{quantity(delivery.receivedQuantity)}</p></div>
                  <div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Saldo não recebido</p><p className="mt-1 text-sm font-black text-slate-200">{quantity(delivery.remainingQuantity)}</p></div>
                  <div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Previsto vencido</p><p className="mt-1 text-sm font-black text-slate-200">{quantity(delivery.overdueQuantity)}</p></div>
                  <div><p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Progresso</p><p className="mt-1 text-sm font-black text-slate-200">{delivery.progressPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p></div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-blue-400/70" style={{ width: Math.max(0, Math.min(100, delivery.progressPercent)) + '%' }} /></div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-slate-300"><CalendarClock className="h-3.5 w-3.5" /><p className="text-xs font-bold">Cronograma existente</p></div>
                    {!delivery.hasSchedule ? <p className="mt-3 text-xs text-slate-600">Sem cronograma cadastrado.</p> : (
                      <div className="mt-3 space-y-2">
                        {delivery.nextDeliveries.length ? delivery.nextDeliveries.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">{entry.title} · {dateLabel(entry.date)}</span><strong className="text-slate-300">{quantity(entry.quantity)}</strong></div>
                        )) : <p className="text-xs text-slate-600">Nenhuma remessa futura na programação atual.</p>}
                        <p className="pt-1 text-[10px] text-slate-600">Previsto acumulado até hoje: {quantity(delivery.expectedThroughToday)}</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-slate-300"><FileText className="h-3.5 w-3.5" /><p className="text-xs font-bold">Recebimentos por NF</p></div>
                    <div className="mt-3 space-y-2">
                      {delivery.invoices.length ? delivery.invoices.slice(0, 4).map((invoice) => (
                        <div key={invoice.recordKey} className="rounded-lg border border-white/[0.05] px-3 py-2">
                          <div className="flex items-center justify-between gap-2 text-xs"><span className="font-bold text-slate-300">NF {invoice.invoiceId}</span><span className="text-slate-500">{quantity(invoice.quantity)}</span></div>
                          <p className="mt-1 text-[10px] text-slate-600">{dateLabel(invoice.registeredAt || invoice.issueDate)} · {invoice.warehouseIntegrated ? 'Entrada integrada ao warehouse' : 'Recebido no EMPROVEX · sem retrointegração ao warehouse'}</p>
                        </div>
                      )) : <p className="text-xs text-slate-600">Nenhuma NF encontrada para este empenho na janela consultada.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-slate-300"><Warehouse className="h-3.5 w-3.5" /><p className="text-xs font-bold">Situação logística relacionada</p></div>
                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                      <p>{delivery.stock.linkedMaterials} material(is) canônico(s) vinculado(s)</p>
                      <p>{delivery.stock.positiveBalances} com saldo positivo · {delivery.stock.zeroBalances} zerado(s)</p>
                      <p>{delivery.integratedInvoiceCount} NF(s) com integração warehouse · {delivery.operationalOnlyInvoiceCount} sem integração retroativa</p>
                    </div>
                  </div>
                </div>

                {delivery.overdueQuantity > 0 && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/12 bg-rose-400/[0.04] px-4 py-3 text-xs text-rose-100/80">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    O atraso é calculado cumulativamente por item: previsto vencido menos recebido efetivo.
                    Nenhuma NF foi associada artificialmente a uma remessa.
                  </div>
                )}
                {delivery.remainingQuantity <= 0 && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-emerald-200/80"><CheckCircle2 className="h-3.5 w-3.5" /> Empenho integralmente recebido.</div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
