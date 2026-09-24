'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, CalendarClock, ClipboardCheck, MapPin, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';

import {
  loadWarehouseLogisticsDashboardContext,
  reconcileWarehouseLogisticsAlerts,
  type WarehouseLogisticsDashboardContext,
} from '../../../lib/warehouse/logisticsRepository';
import type { WarehouseLogisticsAlertKind } from '../../../lib/warehouse/logisticsAlerts';

const ALL_LOGISTICS_ALERT_KINDS: WarehouseLogisticsAlertKind[] = [
  'MATERIAL_UNLOCATED',
  'LOT_EXPIRED',
  'LOT_NEAR_EXPIRY',
  'STOCK_ZERO',
  'LOW_STOCK',
  'INVENTORY_RECONCILIATION',
  'SISCOFIS_DIVERGENCE',
  'DELIVERY_DUE_SOON',
  'DELIVERY_OVERDUE',
];

function MetricCard({
  label,
  value,
  detail,
  href,
  testId,
}: {
  label: string;
  value: string | number;
  detail: string;
  href: string;
  testId: string;
}) {
  return (
    <Link href={href} data-testid={testId} className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 transition hover:border-blue-300/15 hover:bg-blue-400/[0.035]">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-[10px] leading-4 text-slate-600">{detail}</p>
    </Link>
  );
}

function dateTime(value: string | undefined | null): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? value
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(parsed));
}

export function WarehouseLogisticsDashboard({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] = useState<WarehouseLogisticsDashboardContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const next = await loadWarehouseLogisticsDashboardContext(workspaceId);
      setContext(next);
      await reconcileWarehouseLogisticsAlerts(
        workspaceId,
        next.alertCandidates,
        ALL_LOGISTICS_ALERT_KINDS,
        !next.truncated
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar o Dashboard Logístico.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recentInvoices = useMemo(
    () => (context?.invoices || [])
      .slice()
      .sort((left, right) =>
        (right.registeredAt || right.issueDate || '').localeCompare(
          left.registeredAt || left.issueDate || ''
        )
      )
      .slice(0, 6),
    [context]
  );

  if (loading && !context) {
    return <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">Carregando indicadores reais e bounded…</div>;
  }

  if (!context) {
    return <div className="mt-6 rounded-2xl border border-rose-300/15 bg-rose-400/[0.04] p-5 text-sm text-rose-100">{message || 'Dashboard indisponível.'}</div>;
  }

  const { summary } = context;

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-logistics-dashboard">
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-200"><Boxes className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.12em]">Dashboard Logístico</p></div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            Indicadores derivados das fontes operacionais existentes. Não há listener global,
            métricas mockadas, segundo saldo ou cópia de Cronogramas e Notas Fiscais.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-xl border border-white/[0.08] p-2.5 text-slate-300" aria-label="Atualizar Dashboard Logístico">
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </div>

      {context.truncated && (
        <div className="rounded-xl border border-amber-300/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-amber-100/80">
          Um dos limites de segurança foi atingido. O painel não faz leituras ilimitadas e,
          neste ciclo, não resolve automaticamente avisos cuja causa possa estar fora da janela.
        </div>
      )}
      {message && <div className="rounded-xl border border-rose-300/15 bg-rose-400/[0.04] px-4 py-3 text-xs text-rose-100">{message}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard testId="warehouse-dashboard-stock-positive" label="Materiais com saldo" value={summary.materialsWithStock} detail="Saldos canônicos positivos" href="/adm-deposito/estoque" />
        <MetricCard testId="warehouse-dashboard-unlocated" label="Sem localização" value={summary.materialsWithoutLocation} detail="Saldo físico ainda não totalmente posicionado" href="/adm-deposito/localizacoes" />
        <MetricCard testId="warehouse-dashboard-expired" label="Lotes vencidos" value={summary.expiredLots} detail="Lotes ativos com quantidade rastreada" href="/adm-deposito/estoque" />
        <MetricCard testId="warehouse-dashboard-near-expiry" label="Próximos do vencimento" value={summary.nearExpiryLots} detail="Janela canônica de 30 dias da FASE 7" href="/adm-deposito/estoque" />
        <MetricCard testId="warehouse-dashboard-deliveries-overdue" label="Previsões vencidas" value={summary.overdueDeliveries} detail="Previsto acumulado ainda não recebido por NF" href="/adm-deposito/entregas" />
        <MetricCard testId="warehouse-dashboard-deliveries-upcoming" label="Entregas futuras" value={summary.upcomingDeliveries} detail="Cronogramas ativos com próxima data prevista" href="/adm-deposito/entregas" />
        <MetricCard testId="warehouse-dashboard-inventory" label="Inventários em atenção" value={summary.inventoryAttention} detail="Reconciliação física requerida" href="/adm-deposito/inventario" />
        <MetricCard testId="warehouse-dashboard-siscofis" label="Divergências SISCOFIS" value={summary.siscofisDivergences} detail="Último snapshot confirmado" href="/adm-deposito/siscofis-conciliacao" />
        <MetricCard testId="warehouse-dashboard-zero" label="Estoque zerado" value={summary.zeroStock} detail="Saldo canônico igual a zero" href="/adm-deposito/estoque" />
        <MetricCard
          testId="warehouse-dashboard-low-stock"
          label="Baixo estoque"
          value={summary.lowStock == null ? '—' : summary.lowStock}
          detail={summary.lowStock == null ? 'Mínimo não configurado; nenhum limiar é presumido' : 'Conforme mínimo explícito configurado'}
          href={summary.lowStock == null ? '/adm-deposito/configuracoes' : '/adm-deposito/estoque'}
        />
        <MetricCard testId="warehouse-dashboard-active-schedules" label="Cronogramas ativos" value={summary.activeSchedules} detail="Fonte: coleção operacional cronogramas" href="/?tab=cronogramas" />
        <MetricCard testId="warehouse-dashboard-alerts" label="Avisos logísticos ativos" value={context.alertCandidates.length} detail="Sincronizados na Central de Avisos existente" href="/?tab=avisos" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
          <div className="flex items-center gap-2 text-slate-300"><CalendarClock className="h-4 w-4" /><p className="text-sm font-black">Recebimentos por Nota Fiscal</p></div>
          <p className="mt-1 text-xs text-slate-600">Últimos registros dentro da consulta bounded de NFs.</p>
          <div className="mt-4 space-y-2">
            {recentInvoices.length ? recentInvoices.map((invoice) => (
              <div key={invoice.recordKey || invoice.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.05] px-3 py-3">
                <div><p className="text-xs font-bold text-slate-300">NF {invoice.id} · Empenho {invoice.empenhoId}</p><p className="mt-1 text-[10px] text-slate-600">{invoice.supplier}</p></div>
                <div className="text-right"><p className="text-[10px] text-slate-500">{dateTime(invoice.registeredAt || invoice.issueDate)}</p><p className="mt-1 text-[9px] text-slate-600">{invoice.warehouseIntegration ? 'warehouse integrado' : 'recebido no EMPROVEX'}</p></div>
              </div>
            )) : <p className="text-xs text-slate-600">Nenhuma NF na janela consultada.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
          <div className="flex items-center gap-2 text-slate-300"><ShieldAlert className="h-4 w-4" /><p className="text-sm font-black">Pendências acionáveis</p></div>
          <p className="mt-1 text-xs text-slate-600">A mesma ocorrência usa ID determinístico e não se multiplica a cada abertura.</p>
          <div className="mt-4 space-y-2">
            {context.alertCandidates.slice(0, 8).map((candidate) => (
              <div key={candidate.alert.id} className="rounded-xl border border-white/[0.05] px-3 py-3">
                <div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" /><div><p className="text-xs font-bold text-slate-300">{candidate.alert.title}</p><p className="mt-1 text-[10px] leading-4 text-slate-600">{candidate.alert.subtitle}</p></div></div>
              </div>
            ))}
            {!context.alertCandidates.length && <div className="flex items-center gap-2 text-xs text-emerald-200/75"><ClipboardCheck className="h-4 w-4" /> Nenhuma condição logística acionável detectada.</div>}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[10px] leading-5 text-slate-600">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        As leituras são carregadas sob demanda. Nenhum card instala listener global permanente.
      </div>
    </div>
  );
}
