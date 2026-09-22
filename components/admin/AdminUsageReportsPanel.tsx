'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  Gauge,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

import { getFirestoreBillingDayKey } from '../../lib/firestoreBillingDay';
import { HGESM_WORKSPACE_ID } from '../../lib/hgesmWorkspace';
import type { Workspace } from '../../lib/platformIdentity';
import type { AdminWorkspaceUsageEstimate } from '../../lib/platformAdminUsage';
import type { FirebaseGlobalUsageSnapshot } from '../../lib/platformCapacity';
import { buildUsageReconciliation } from '../../lib/usageReconciliation';
import {
  getUsageReportRange,
  loadGlobalUsageHistory,
  loadWorkspaceUsageHistory,
  type GlobalUsageHistoryPoint,
  type UsageReportPeriod,
  type WorkspaceUsageHistoryPoint,
} from '../../lib/platformAdminUsageHistory';

interface AdminUsageReportsPanelProps {
  workspaces: Workspace[];
  usage: AdminWorkspaceUsageEstimate[];
  globalUsage: FirebaseGlobalUsageSnapshot | null;
  globalUsageObservedAt: string | null;
  globalUsageError: string | null;
  onRefreshUsage: () => Promise<void>;
  onRefreshGlobalUsage: () => Promise<void>;
}

const PERIODS: Array<{ id: UsageReportPeriod; label: string }> = [
  { id: 'daily', label: 'Diário' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensal' },
  { id: 'annual', label: 'Anual' },
];

function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: value >= 10 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatDayKey(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function liveGlobalPoint(snapshot: FirebaseGlobalUsageSnapshot): GlobalUsageHistoryPoint {
  const limit = snapshot.billingReference.readUnitsDailyLimit;
  return {
    dayKey: getFirestoreBillingDayKey(new Date(snapshot.windowStartedAt)),
    billableReadUnits: snapshot.billableReadUnits,
    billableRealtimeReadUnits: snapshot.billableRealtimeReadUnits,
    billableWriteUnits: snapshot.billableWriteUnits,
    documentReads: snapshot.documentReads,
    documentWrites: snapshot.documentWrites,
    documentDeletes: snapshot.documentDeletes,
    readUnitsDailyLimit: limit,
    realtimeReadUnitsDailyLimit: snapshot.billingReference.realtimeReadUnitsDailyLimit,
    writeUnitsDailyLimit: snapshot.billingReference.writeUnitsDailyLimit,
    readQuotaPercentage: limit > 0 ? (snapshot.billableReadUnits / limit) * 100 : 0,
    observedAt: snapshot.windowEndedAt,
    dataThrough: snapshot.windowEndedAt,
  };
}

function liveWorkspacePoint(
  estimate: AdminWorkspaceUsageEstimate
): WorkspaceUsageHistoryPoint {
  return {
    workspaceId: estimate.workspaceId,
    ug: estimate.ug,
    dayKey: estimate.dayKey,
    estimatedDocumentReads: estimate.estimatedDocumentReads,
    estimatedDocumentWrites: estimate.estimatedDocumentWrites,
    estimatedDocumentDeletes: estimate.estimatedDocumentDeletes,
    realtimeSnapshots: estimate.realtimeSnapshots,
    peakRealtimeListeners: estimate.peakRealtimeListeners,
    telemetryFlushes: estimate.telemetryFlushes,
    lastReportedAt: estimate.lastReportedAt,
  };
}

function quotaTone(percentage: number): string {
  if (percentage > 100) return 'text-rose-200';
  if (percentage >= 95) return 'text-orange-200';
  if (percentage >= 85) return 'text-amber-200';
  if (percentage >= 70) return 'text-yellow-100';
  return 'text-emerald-200';
}

export function AdminUsageReportsPanel({
  workspaces,
  usage,
  globalUsage,
  globalUsageObservedAt,
  globalUsageError,
  onRefreshUsage,
  onRefreshGlobalUsage,
}: AdminUsageReportsPanelProps) {
  const [period, setPeriod] = useState<UsageReportPeriod>('monthly');
  const [workspaceId, setWorkspaceId] = useState(HGESM_WORKSPACE_ID);
  const [globalHistory, setGlobalHistory] = useState<GlobalUsageHistoryPoint[]>([]);
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceUsageHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const range = useMemo(() => getUsageReportRange(period), [period]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId)
      || workspaces.find((workspace) => workspace.id === HGESM_WORKSPACE_ID)
      || workspaces[0]
      || null,
    [workspaceId, workspaces]
  );

  useEffect(() => {
    if (!selectedWorkspace?.ug) {
      setWorkspaceHistory([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setHistoryError(null);

    void Promise.all([
      loadGlobalUsageHistory(range),
      loadWorkspaceUsageHistory(selectedWorkspace.id, selectedWorkspace.ug, range),
    ])
      .then(([globalPoints, workspacePoints]) => {
        if (cancelled) return;
        setGlobalHistory(globalPoints);
        setWorkspaceHistory(workspacePoints);
      })
      .catch((error) => {
        if (cancelled) return;
        setHistoryError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o histórico de consumo.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, selectedWorkspace]);

  const effectiveGlobalHistory = useMemo(() => {
    const byDay = new Map(globalHistory.map((point) => [point.dayKey, point]));
    if (globalUsage) {
      const live = liveGlobalPoint(globalUsage);
      if (live.dayKey >= range.startDayKey && live.dayKey <= range.endDayKey) {
        byDay.set(live.dayKey, live);
      }
    }
    return [...byDay.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [globalHistory, globalUsage, range.endDayKey, range.startDayKey]);

  const effectiveWorkspaceHistory = useMemo(() => {
    const byDay = new Map(workspaceHistory.map((point) => [point.dayKey, point]));
    const live = usage.find((item) => item.workspaceId === selectedWorkspace?.id);
    if (
      live
      && live.dayKey >= range.startDayKey
      && live.dayKey <= range.endDayKey
    ) {
      byDay.set(live.dayKey, liveWorkspacePoint(live));
    }
    return [...byDay.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [range.endDayKey, range.startDayKey, selectedWorkspace?.id, usage, workspaceHistory]);

  const currentQuotaPercentage = globalUsage?.billingReference.readUnitsDailyLimit
    ? (globalUsage.billableReadUnits / globalUsage.billingReference.readUnitsDailyLimit) * 100
    : 0;

  const averageQuota = effectiveGlobalHistory.length
    ? effectiveGlobalHistory.reduce((sum, point) => sum + point.readQuotaPercentage, 0)
      / effectiveGlobalHistory.length
    : 0;
  const peakQuota = effectiveGlobalHistory.reduce(
    (peak, point) => Math.max(peak, point.readQuotaPercentage),
    0
  );
  const workspaceReads = effectiveWorkspaceHistory.reduce(
    (sum, point) => sum + point.estimatedDocumentReads,
    0
  );
  const workspaceWrites = effectiveWorkspaceHistory.reduce(
    (sum, point) => sum + point.estimatedDocumentWrites,
    0
  );
  const totalCurrentEstimatedReads = usage.reduce(
    (sum, item) => sum + item.estimatedDocumentReads,
    0
  );
  const selectedCurrentUsage = usage.find((item) => item.workspaceId === selectedWorkspace?.id);
  const currentWorkspaceShare = totalCurrentEstimatedReads > 0 && selectedCurrentUsage
    ? (selectedCurrentUsage.estimatedDocumentReads / totalCurrentEstimatedReads) * 100
    : 0;
  const currentReconciliation = useMemo(
    () => globalUsage ? buildUsageReconciliation(globalUsage, usage) : null,
    [globalUsage, usage]
  );
  const selectedReconciliationRow = currentReconciliation?.rows.find(
    (row) => row.workspaceId === selectedWorkspace?.id
  ) || null;

  const refresh = async () => {
    setLoading(true);
    await Promise.allSettled([onRefreshGlobalUsage(), onRefreshUsage()]);
    if (selectedWorkspace?.ug) {
      try {
        const [globalPoints, workspacePoints] = await Promise.all([
          loadGlobalUsageHistory(range),
          loadWorkspaceUsageHistory(selectedWorkspace.id, selectedWorkspace.ug, range),
        ]);
        setGlobalHistory(globalPoints);
        setWorkspaceHistory(workspacePoints);
        setHistoryError(null);
      } catch (error) {
        setHistoryError(
          error instanceof Error ? error.message : 'Falha ao atualizar o histórico.'
        );
      }
    }
    setLoading(false);
  };

  const exportCsv = () => {
    const globalByDay = new Map(effectiveGlobalHistory.map((point) => [point.dayKey, point]));
    const workspaceByDay = new Map(effectiveWorkspaceHistory.map((point) => [point.dayKey, point]));
    const days = [...new Set([
      ...effectiveGlobalHistory.map((point) => point.dayKey),
      ...effectiveWorkspaceHistory.map((point) => point.dayKey),
    ])].sort();

    const rows = [
      [
        'Data',
        'UG',
        'Read Units globais',
        'Limite diario',
        '% da cota',
        'Realtime Units globais',
        'Write Units globais',
        'Reads estimados UG',
        'Writes estimados UG',
        'Deletes estimados UG',
        'Snapshots UG',
      ],
      ...days.map((key) => {
        const globalPoint = globalByDay.get(key);
        const workspacePoint = workspaceByDay.get(key);
        return [
          key,
          selectedWorkspace?.ug || '',
          globalPoint?.billableReadUnits || 0,
          globalPoint?.readUnitsDailyLimit || 0,
          globalPoint?.readQuotaPercentage.toFixed(2) || '0',
          globalPoint?.billableRealtimeReadUnits || 0,
          globalPoint?.billableWriteUnits || 0,
          workspacePoint?.estimatedDocumentReads || 0,
          workspacePoint?.estimatedDocumentWrites || 0,
          workspacePoint?.estimatedDocumentDeletes || 0,
          workspacePoint?.realtimeSnapshots || 0,
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `emprovex-consumo-${period}-${selectedWorkspace?.ug || 'sem-ug'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      data-testid="admin-usage-reports-panel"
      className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/65 shadow-[0_22px_70px_rgba(0,8,28,0.20)] backdrop-blur-xl"
    >
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-violet-200/70">
              <BarChart3 className="h-4 w-4" />
              Inteligência de consumo
            </div>
            <h3 className="mt-2 text-lg font-extrabold text-white">
              Histórico &amp; Relatórios de Cotas
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              A cota global usa métricas faturáveis reais do Cloud Monitoring. A visão por UG usa
              a telemetria atribuída pelo EMPROVEX e permanece identificada como estimativa.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-500/10 px-3.5 text-xs font-extrabold text-blue-100 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!effectiveGlobalHistory.length && !effectiveWorkspaceHistory.length}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-xs font-extrabold text-slate-200 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex min-w-0 gap-2 overflow-x-auto">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={
                  'min-h-10 whitespace-nowrap rounded-xl border px-3.5 text-xs font-extrabold transition '
                  + (period === item.id
                    ? 'border-violet-300/25 bg-violet-500/15 text-violet-100'
                    : 'border-white/[0.07] bg-white/[0.025] text-slate-400 hover:text-white')
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="flex min-h-10 items-center gap-3 rounded-xl border border-white/[0.08] bg-slate-950/25 px-3">
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
              UG analisada
            </span>
            <select
              value={selectedWorkspace?.id || ''}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-100 outline-none"
            >
              {workspaces
                .filter((workspace) => workspace.ug)
                .map((workspace) => (
                  <option key={workspace.id} value={workspace.id} className="bg-slate-950">
                    {workspace.ug} · {workspace.name}
                    {workspace.id === HGESM_WORKSPACE_ID ? ' · Fundador' : ''}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <ReportMetric
            label="Cota global hoje"
            value={globalUsage ? formatPercent(currentQuotaPercentage) : '—'}
            detail={globalUsage
              ? `${formatCount(globalUsage.billableReadUnits)} / ${formatCount(globalUsage.billingReference.readUnitsDailyLimit)} RU`
              : 'Aguardando Cloud Monitoring'}
            emphasis
          />
          <ReportMetric
            label="Média do período"
            value={effectiveGlobalHistory.length ? formatPercent(averageQuota) : '—'}
            detail={range.label}
          />
          <ReportMetric
            label="Pico diário"
            value={effectiveGlobalHistory.length ? formatPercent(peakQuota) : '—'}
            detail="Maior uso da cota observado"
          />
          <ReportMetric
            label={`Reads UG ${selectedWorkspace?.ug || '—'}`}
            value={formatCount(workspaceReads)}
            detail={`${formatCount(workspaceWrites)} writes estimados`}
          />
          <ReportMetric
            label="Participação hoje"
            value={selectedReconciliationRow?.readShareOfAttributed !== null
              && selectedReconciliationRow?.readShareOfAttributed !== undefined
              ? formatPercent(selectedReconciliationRow.readShareOfAttributed * 100)
              : selectedCurrentUsage
                ? formatPercent(currentWorkspaceShare)
                : '—'}
            detail="Entre reads atribuídos na janela do Firestore"
          />
          <ReportMetric
            label="Read Units proxy UG"
            value={selectedReconciliationRow
              ? formatCount(selectedReconciliationRow.estimatedBillableReadUnits)
              : '—'}
            detail={currentReconciliation
              ? `Cobertura global de reads: ${formatPercent(currentReconciliation.readCoverage.percentage || 0)} · estimativa não oficial`
              : 'Aguardando reconciliação global'}
          />
        </div>

        {currentReconciliation && (
          <div
            data-testid="admin-usage-report-reconciliation"
            className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.045] px-4 py-3"
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-violet-200/85">
                  Reconciliação do dia atual
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {formatCount(currentReconciliation.readCoverage.attributed)} de {formatCount(currentReconciliation.readCoverage.globalObserved)}
                  {' '}leituras documentais observadas estão atribuídas a UGs ({formatPercent(currentReconciliation.readCoverage.percentage || 0)}).
                  A parcela restante não é redistribuída artificialmente.
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-white/[0.08] bg-slate-950/25 px-3 py-2 text-[10px] font-extrabold text-slate-200">
                Não atribuídas: {formatCount(currentReconciliation.readCoverage.unattributed)} reads · ~{formatCount(currentReconciliation.estimatedUnattributedReadUnits)} RU
              </div>
            </div>
          </div>
        )}

        {(globalUsageError || historyError) && (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs leading-relaxed text-rose-100">
            {globalUsageError || historyError}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-slate-950/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-blue-200/75">
                  Consumo da franquia de Read Units
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Cada coluna representa um dia com fotografia histórica disponível.
                </p>
              </div>
              <Gauge className="h-5 w-5 text-blue-300/70" />
            </div>

            <div className="mt-5 overflow-x-auto pb-2">
              <div className="flex min-h-44 min-w-max items-end gap-2 border-b border-white/[0.08] px-1">
                {effectiveGlobalHistory.map((point) => {
                  const height = Math.max(3, Math.min(100, point.readQuotaPercentage));
                  return (
                    <div
                      key={point.dayKey}
                      className="group flex w-7 flex-col items-center justify-end gap-1"
                      title={`${formatDayKey(point.dayKey)} · ${formatPercent(point.readQuotaPercentage)} · ${formatCount(point.billableReadUnits)} RU`}
                    >
                      <span className={`text-[8px] font-bold ${quotaTone(point.readQuotaPercentage)}`}>
                        {Math.round(point.readQuotaPercentage)}
                      </span>
                      <div
                        className={
                          'w-4 rounded-t-md transition-all '
                          + (point.readQuotaPercentage > 100
                            ? 'bg-rose-400/80'
                            : point.readQuotaPercentage >= 95
                              ? 'bg-orange-400/80'
                              : point.readQuotaPercentage >= 85
                                ? 'bg-amber-400/80'
                                : point.readQuotaPercentage >= 70
                                  ? 'bg-yellow-300/75'
                                  : 'bg-blue-400/75')
                        }
                        style={{ height: `${height * 1.25}px` }}
                      />
                      <span className="mt-1 text-[7px] text-slate-600">
                        {point.dayKey.slice(5)}
                      </span>
                    </div>
                  );
                })}

                {!effectiveGlobalHistory.length && (
                  <div className="flex h-36 w-[520px] items-center justify-center text-xs text-slate-500">
                    Ainda não há fotografia histórica global neste período.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
              <span>0–69% normal</span>
              <span>70–84% atenção</span>
              <span>85–94% elevado</span>
              <span>95–100% crítico</span>
              <span>&gt;100% acima da franquia</span>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.035] p-4">
            <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-cyan-200/80">
              <TrendingUp className="h-4 w-4" />
              UG {selectedWorkspace?.ug || '—'} · histórico atribuído
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {selectedWorkspace?.name || 'Workspace não selecionado'}
              {selectedWorkspace?.id === HGESM_WORKSPACE_ID
                ? ' · conta fundadora HGeSM'
                : ''}
            </p>

            <div className="mt-4 space-y-2">
              <HistoryStat label="Dias com telemetria" value={formatCount(effectiveWorkspaceHistory.length)} />
              <HistoryStat label="Reads estimados" value={formatCount(workspaceReads)} />
              <HistoryStat label="Writes estimados" value={formatCount(workspaceWrites)} />
              <HistoryStat
                label="Média de reads/dia"
                value={effectiveWorkspaceHistory.length
                  ? formatCount(workspaceReads / effectiveWorkspaceHistory.length)
                  : '0'}
              />
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
              A Cloud Monitoring informa o total real do banco, mas não separa a cobrança por UG.
              Por isso esta coluna é uma atribuição interna baseada nas operações instrumentadas pelo EMPROVEX.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
          <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <CalendarDays className="h-4 w-4 text-violet-300" />
                Relatório detalhado
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {range.label} · global real + UG selecionada
              </p>
            </div>
            <span className="font-mono text-[9px] text-slate-500">
              Global atualizado: {globalUsageObservedAt
                ? new Date(globalUsageObservedAt).toLocaleString('pt-BR')
                : 'sem leitura'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[10px]">
              <thead className="bg-slate-950/30 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-bold uppercase">Data</th>
                  <th className="px-3 py-2 font-bold uppercase">Read Units</th>
                  <th className="px-3 py-2 font-bold uppercase">% cota</th>
                  <th className="px-3 py-2 font-bold uppercase">Reads UG</th>
                  <th className="px-3 py-2 font-bold uppercase">Writes UG</th>
                  <th className="px-3 py-2 font-bold uppercase">Snapshots UG</th>
                </tr>
              </thead>
              <tbody>
                {[...new Set([
                  ...effectiveGlobalHistory.map((point) => point.dayKey),
                  ...effectiveWorkspaceHistory.map((point) => point.dayKey),
                ])]
                  .sort()
                  .reverse()
                  .slice(0, 40)
                  .map((key) => {
                    const globalPoint = effectiveGlobalHistory.find((point) => point.dayKey === key);
                    const workspacePoint = effectiveWorkspaceHistory.find((point) => point.dayKey === key);
                    return (
                      <tr key={key} className="border-t border-white/[0.05] text-slate-300">
                        <td className="whitespace-nowrap px-3 py-2 font-mono">{formatDayKey(key)}</td>
                        <td className="px-3 py-2">{globalPoint ? formatCount(globalPoint.billableReadUnits) : '—'}</td>
                        <td className={`px-3 py-2 font-extrabold ${quotaTone(globalPoint?.readQuotaPercentage || 0)}`}>
                          {globalPoint ? formatPercent(globalPoint.readQuotaPercentage) : '—'}
                        </td>
                        <td className="px-3 py-2">{workspacePoint ? formatCount(workspacePoint.estimatedDocumentReads) : '—'}</td>
                        <td className="px-3 py-2">{workspacePoint ? formatCount(workspacePoint.estimatedDocumentWrites) : '—'}</td>
                        <td className="px-3 py-2">{workspacePoint ? formatCount(workspacePoint.realtimeSnapshots) : '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500">
          O histórico global passa a ser consolidado pelo servidor sempre que as métricas reais são
          consultadas. O histórico por UG reutiliza os documentos diários de telemetria que o EMPROVEX
          já grava. Assim, relatórios mensais e anuais ficam progressivamente mais completos sem criar
          listeners adicionais.
        </p>
      </div>
    </section>
  );
}

function ReportMetric({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <div className={
      'rounded-2xl border px-4 py-3 '
      + (emphasis
        ? 'border-blue-300/20 bg-blue-500/[0.07]'
        : 'border-white/[0.07] bg-white/[0.025]')
    }>
      <div className="text-[8px] font-bold uppercase tracking-[0.11em] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
      <div className="mt-1 text-[9px] text-slate-500">{detail}</div>
    </div>
  );
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-slate-950/20 px-3 py-2.5">
      <span className="text-[9px] font-bold uppercase tracking-[0.10em] text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-100">{value}</span>
    </div>
  );
}
