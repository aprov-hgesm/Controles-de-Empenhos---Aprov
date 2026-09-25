'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';

import {
  listWarehouseLogisticsAlerts,
  loadWarehouseLogisticsDashboardContext,
  reconcileWarehouseLogisticsAlerts,
} from '../../../lib/warehouse/logisticsRepository';
import type { WarehouseLogisticsAlert } from '../../../lib/warehouse/logisticsAlerts';

function dateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? value
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(parsed));
}

function severityClass(severity: WarehouseLogisticsAlert['severity']): string {
  if (severity === 'CRITICAL') return 'border-rose-300/20 bg-rose-400/[0.07] text-rose-100';
  if (severity === 'WARNING') return 'border-amber-300/20 bg-amber-400/[0.07] text-amber-100';
  return 'border-blue-300/20 bg-blue-400/[0.07] text-blue-100';
}

export function WarehouseLogisticsAlerts({ workspaceId }: { workspaceId: string }) {
  const [alerts, setAlerts] = useState<WarehouseLogisticsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const context = await loadWarehouseLogisticsDashboardContext(workspaceId);
      if (context.degradedSources.length > 0) {
        setMessage(
          'Algumas fontes auxiliares estão indisponíveis; os alertas existentes permanecem visíveis e não serão resolvidos automaticamente nesta tentativa.'
        );
      }
      try {
        await reconcileWarehouseLogisticsAlerts(
          workspaceId,
          context.alertCandidates,
          !context.truncated && context.degradedSources.length === 0
        );
      } catch (error) {
        console.warn('Falha ao reconciliar alertas do ADM Depósito.', error);
        setMessage('Os dados foram lidos, mas a persistência dos alertas não pôde ser atualizada nesta tentativa.');
      }
      setAlerts(await listWarehouseLogisticsAlerts(workspaceId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar alertas logísticos.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = useMemo(() => alerts.filter((alert) => alert.active), [alerts]);
  const resolved = useMemo(() => alerts.filter((alert) => !alert.active), [alerts]);

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-logistics-alerts">
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-200">
            <ShieldAlert className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.12em]">Alertas do ADM Depósito</p>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            Alertas logísticos são derivados de estoque, localização, lotes, inventário,
            SISCOFIS e entregas. Eles permanecem exclusivamente em warehouse/{'{workspaceId}'}/alerts
            e não alteram a Central de Avisos operacional do EMPROVEX.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-xl border border-white/[0.08] p-2.5 text-slate-300" aria-label="Atualizar alertas logísticos">
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Ativos</p>
          <p className="mt-2 text-2xl font-black text-white">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Resolvidos automaticamente</p>
          <p className="mt-2 text-2xl font-black text-white">{resolved.length}</p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-amber-300/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-amber-100/80">
          {message}
        </div>
      )}

      {loading && !alerts.length ? (
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">
          Recalculando condições logísticas…
        </div>
      ) : !active.length ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.035] p-5 text-sm text-emerald-100/80">
          <CheckCircle2 className="h-4 w-4" />
          Nenhuma condição logística ativa no momento.
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((alert) => (
            <article key={alert.id} className={'rounded-2xl border p-5 ' + severityClass(alert.severity)}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black">{alert.title}</p>
                    <span className="rounded-full border border-current/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] opacity-80">
                      {alert.kind}
                    </span>
                  </div>
                  <p className="mt-1 text-xs opacity-80">{alert.subtitle}</p>
                  <p className="mt-3 text-xs leading-5 opacity-75">{alert.description}</p>
                  <p className="mt-3 font-mono text-[9px] opacity-50">
                    atualizado {dateTime(alert.updatedAt)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <summary className="cursor-pointer text-xs font-bold text-slate-400">
            Histórico resolvido ({resolved.length})
          </summary>
          <div className="mt-3 space-y-2">
            {resolved.slice(0, 50).map((alert) => (
              <div key={alert.id} className="rounded-xl border border-white/[0.05] px-3 py-3 text-xs text-slate-500">
                <p className="font-bold text-slate-400">{alert.title}</p>
                <p className="mt-1">{alert.subtitle} · resolvido {dateTime(alert.resolvedAt)}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
