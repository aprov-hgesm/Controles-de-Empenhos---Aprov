'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CircleCheck,
  Cloud,
  Database,
  Gauge,
  Loader2,
  RadioTower,
  RefreshCw,
  Users,
} from 'lucide-react';

import { usePlatformAdminUsageAlertPolicy } from '../../hooks/usePlatformAdminUsageAlertPolicy';
import type { Workspace } from '../../lib/platformIdentity';
import type { AdminWorkspaceUsageEstimate } from '../../lib/platformAdminUsage';
import {
  isAdminWorkspaceSessionActive,
  type AdminWorkspaceSession,
} from '../../lib/platformAdminSessions';
import {
  getDefaultSimultaneousSessionLimit,
  type FirebaseGlobalUsageSnapshot,
} from '../../lib/platformCapacity';
import {
  buildUsageThresholdAlerts,
  usageAlertLevelLabel,
  usageAlertMetricLabel,
  type UsageThresholdAlert,
} from '../../lib/usageAlerts';

interface AdminConsolidatedUsagePanelProps {
  workspaces: Workspace[];
  sessions: AdminWorkspaceSession[];
  usage: AdminWorkspaceUsageEstimate[];
  globalUsage: FirebaseGlobalUsageSnapshot | null;
  globalUsageConfigured: boolean | null;
  globalUsageObservedAt: string | null;
  globalUsageDataThrough: string | null;
  loadingUsage: boolean;
  loadingGlobalUsage: boolean;
  usageError: string | null;
  globalUsageError: string | null;
  onRefreshUsage: () => Promise<void>;
  onRefreshGlobalUsage: () => Promise<void>;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Sem dado';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sem dado';
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShare(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: value >= 10 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function totalEstimatedOperations(item: AdminWorkspaceUsageEstimate | null): number {
  if (!item) return 0;
  return (
    item.estimatedDocumentReads
    + item.estimatedDocumentWrites
    + item.estimatedDocumentDeletes
  );
}

export function AdminConsolidatedUsagePanel({
  workspaces,
  sessions,
  usage,
  globalUsage,
  globalUsageConfigured,
  globalUsageObservedAt,
  globalUsageDataThrough,
  loadingUsage,
  loadingGlobalUsage,
  usageError,
  globalUsageError,
  onRefreshUsage,
  onRefreshGlobalUsage,
}: AdminConsolidatedUsagePanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const alertPolicy = usePlatformAdminUsageAlertPolicy();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeSessions = useMemo(
    () => sessions.filter((session) => isAdminWorkspaceSessionActive(session, now)),
    [now, sessions]
  );

  const totals = useMemo(
    () => usage.reduce(
      (acc, item) => ({
        reads: acc.reads + item.estimatedDocumentReads,
        writes: acc.writes + item.estimatedDocumentWrites,
        deletes: acc.deletes + item.estimatedDocumentDeletes,
        snapshots: acc.snapshots + item.realtimeSnapshots,
      }),
      { reads: 0, writes: 0, deletes: 0, snapshots: 0 }
    ),
    [usage]
  );

  const estimatedOperations = totals.reads + totals.writes + totals.deletes;
  const realOperations = globalUsage
    ? globalUsage.documentReads + globalUsage.documentWrites + globalUsage.documentDeletes
    : null;

  const usageAlerts = useMemo(
    () => alertPolicy.policy
      ? buildUsageThresholdAlerts({
          workspaces,
          workspaceUsage: usage,
          globalUsage,
          policy: alertPolicy.policy,
        })
      : [],
    [alertPolicy.policy, globalUsage, usage, workspaces]
  );

  const configuredAlertReferences = alertPolicy.policy
    ? alertPolicy.policy.configuredGlobalMetrics
      + alertPolicy.policy.configuredWorkspaceUgs
    : 0;

  const rows = useMemo(() => (
    workspaces
      .filter((workspace) => workspace.ug)
      .map((workspace) => {
        const estimate = usage.find((item) => item.workspaceId === workspace.id) || null;
        const operations = totalEstimatedOperations(estimate);
        const share = estimatedOperations > 0
          ? (operations / estimatedOperations) * 100
          : null;
        const workspaceSessions = activeSessions.filter(
          (session) => session.workspaceId === workspace.id
        );
        const limit = getDefaultSimultaneousSessionLimit(workspace.authorizedEmail);

        return {
          workspace,
          estimate,
          operations,
          share,
          activeSessionCount: workspaceSessions.length,
          sessionLimit: limit,
        };
      })
      .sort((a, b) => (
        b.operations - a.operations
        || a.workspace.name.localeCompare(b.workspace.name, 'pt-BR')
      ))
  ), [activeSessions, estimatedOperations, usage, workspaces]);

  const namedDatabase = Boolean(
    globalUsage?.databaseId
    && globalUsage.databaseId !== '(default)'
  );
  const refreshing = loadingUsage || loadingGlobalUsage || alertPolicy.loading;

  const refreshAll = async () => {
    const jobs: Promise<void>[] = [
      onRefreshUsage(),
      alertPolicy.refresh(),
    ];
    if (globalUsageConfigured !== false) {
      jobs.push(onRefreshGlobalUsage());
    }
    await Promise.allSettled(jobs);
  };

  return (
    <section
      data-testid="admin-consolidated-usage-panel"
      className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/65 shadow-[0_22px_70px_rgba(0,8,28,0.20)] backdrop-blur-xl"
    >
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-blue-200/70">
            <Gauge className="h-4 w-4" />
            Bloco 16.5 · visão consolidada
          </div>
          <h3 className="text-lg font-extrabold text-white">Painel consolidado de consumo</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            Visão conjunta das métricas globais reais e da atribuição estimada por UG.
            As duas fontes permanecem independentes e nunca são tratadas como equivalentes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={refreshing}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.07] px-3.5 text-xs font-extrabold text-blue-100 transition hover:bg-blue-400/[0.12] disabled:cursor-wait disabled:opacity-50"
        >
          {refreshing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          Atualizar painel
        </button>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.045] p-4">
            <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-200/80">
              <Cloud className="h-4 w-4" />
              Fonte real · google-cloud-monitoring
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Operações observadas pelo Google Cloud para o banco Firestore configurado.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Reads" value={globalUsage ? formatCount(globalUsage.documentReads) : '—'} />
              <Metric label="Writes" value={globalUsage ? formatCount(globalUsage.documentWrites) : '—'} />
              <Metric label="Deletes" value={globalUsage ? formatCount(globalUsage.documentDeletes) : '—'} />
              <Metric label="Conexões" value={globalUsage ? formatCount(globalUsage.activeConnections) : '—'} />
              <Metric label="Listeners" value={globalUsage ? formatCount(globalUsage.snapshotListeners) : '—'} />
              <Metric label="Operações" value={realOperations === null ? '—' : formatCount(realOperations)} />
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4">
            <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-cyan-200/80">
              <Database className="h-4 w-4" />
              Fonte estimada · emprovex-workspace-estimate
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Atribuição interna do EMPROVEX para comparar o peso relativo das UGs.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Reads" value={formatCount(totals.reads)} />
              <Metric label="Writes" value={formatCount(totals.writes)} />
              <Metric label="Deletes" value={formatCount(totals.deletes)} />
              <Metric label="Snapshots" value={formatCount(totals.snapshots)} />
              <Metric label="Sessões ativas" value={formatCount(activeSessions.length)} />
              <Metric label="Operações" value={formatCount(estimatedOperations)} />
            </div>
          </div>
        </div>

        {globalUsageConfigured === false && (
          <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100">
            O Cloud Monitoring ainda não está configurado neste ambiente. A parte estimada por UG
            continua disponível e a ausência das credenciais server-side não bloqueia a administração.
          </div>
        )}

        {(usageError || globalUsageError) && (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs leading-relaxed text-rose-100">
            {usageError || globalUsageError}
          </div>
        )}

        <div
          data-testid="admin-usage-alerts-panel"
          className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.035] p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-amber-200/85">
                <BellRing className="h-4 w-4" />
                Bloco 16.6 · alertas de consumo/cotas
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">
                Alertas derivados de referências operacionais explícitas. Métrica global real,
                estimativa interna por UG e cobrança oficial continuam separadas.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-slate-950/25 px-3 py-2 text-[10px] font-bold text-slate-300">
              {usageAlerts.length} alertas ativos
            </div>
          </div>

          {alertPolicy.loading && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando referências de alerta…
            </div>
          )}

          {alertPolicy.error && !alertPolicy.loading && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300/15 bg-rose-400/[0.06] px-3 py-3 text-xs leading-relaxed text-rose-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {alertPolicy.error}
            </div>
          )}

          {!alertPolicy.loading && !alertPolicy.error && alertPolicy.policy && configuredAlertReferences === 0 && (
            <div className="mt-4 rounded-xl border border-blue-300/15 bg-blue-400/[0.05] px-3 py-3 text-xs leading-relaxed text-blue-100">
              Nenhuma referência operacional foi configurada. O EMPROVEX não presume franquia,
              limite gratuito ou valor de cobrança para gerar alertas.
            </div>
          )}

          {!alertPolicy.loading && !alertPolicy.error && alertPolicy.policy && configuredAlertReferences > 0 && usageAlerts.length === 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.05] px-3 py-3 text-xs leading-relaxed text-emerald-100">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Referências configuradas e nenhum limiar de 70%, 85%, 95% ou excedente foi atingido.
            </div>
          )}

          {usageAlerts.length > 0 && (
            <div className="mt-4 grid gap-2">
              {usageAlerts.slice(0, 12).map((alert) => (
                <UsageAlertCard key={alert.id} alert={alert} />
              ))}
              {usageAlerts.length > 12 && (
                <div className="px-1 pt-1 text-[10px] text-slate-500">
                  Mais {usageAlerts.length - 12} alertas permanecem ativos; os mais graves são exibidos primeiro.
                </div>
              )}
            </div>
          )}

          <p className="mt-4 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Alertas não bloqueiam operações e não representam cobrança oficial
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Info
            label="Banco monitorado"
            value={globalUsage?.databaseId || 'Aguardando Cloud Monitoring'}
          />
          <Info
            label="Última observação global"
            value={formatDateTime(globalUsageObservedAt)}
          />
          <Info
            label="Dados globais disponíveis até"
            value={formatDateTime(globalUsageDataThrough)}
          />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/25 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-slate-200">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white">Referência de cobrança</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {namedDatabase
                  ? 'O EMPROVEX está usando um banco Firestore nomeado. O painel não presume a franquia diária do banco gratuito e não calcula valor monetário sem uma referência explícita de região/tarifa.'
                  : 'O painel não transforma métricas de uso em fatura. Franquias, região, preços, créditos e arredondamentos permanecem separados das métricas operacionais.'}
              </p>
              <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Projeção financeira: referência operacional, não cobrança oficial
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 className="text-sm font-extrabold text-white">Consumo estimado por UG</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Participação calculada somente sobre a soma das estimativas EMPROVEX; não é rateio da fatura global.
              </p>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {rows.length} UGs monitoradas
            </div>
          </div>

          <div className="grid gap-3">
            {rows.map((row) => (
              <div
                key={row.workspace.id}
                data-testid={`admin-consolidated-usage-${row.workspace.id}`}
                className="rounded-2xl border border-white/[0.08] bg-slate-950/20 p-4"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-extrabold text-white">{row.workspace.name}</h5>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                        UG {row.workspace.ug}
                      </span>
                      <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.10em] text-cyan-100">
                        {formatShare(row.share)} das estimativas
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Última consolidação: {formatDateTime(row.estimate?.lastReportedAt || null)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-extrabold text-slate-200">
                      <Users className="h-3.5 w-3.5" />
                      {row.sessionLimit === null
                        ? 'Sessões ilimitadas'
                        : `${row.activeSessionCount} / ${row.sessionLimit} sessões`}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-extrabold text-slate-200">
                      <Gauge className="h-3.5 w-3.5" />
                      Pico listeners {formatCount(row.estimate?.peakRealtimeListeners || 0)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label="Reads estimados" value={formatCount(row.estimate?.estimatedDocumentReads || 0)} />
                  <Metric label="Writes estimados" value={formatCount(row.estimate?.estimatedDocumentWrites || 0)} />
                  <Metric label="Deletes estimados" value={formatCount(row.estimate?.estimatedDocumentDeletes || 0)} />
                  <Metric label="Snapshots" value={formatCount(row.estimate?.realtimeSnapshots || 0)} />
                </div>
              </div>
            ))}

            {rows.length === 0 && !loadingUsage && (
              <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-4 text-xs text-slate-500">
                Nenhuma UG com identidade válida está disponível para consolidação.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <RadioTower className="h-3.5 w-3.5" />
            Cloud Monitoring: leitura pontual, sem polling
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Telemetria UG: documento diário, sem listener administrativo
          </span>
          <span>Atualizado globalmente: {formatDateTime(globalUsageObservedAt)}</span>
        </div>
      </div>
    </section>
  );
}

function UsageAlertCard({ alert }: { alert: UsageThresholdAlert }) {
  const percentage = alert.assessment.percentage || 0;
  const scope = alert.origin === 'global-real'
    ? 'Global real · google-cloud-monitoring'
    : `UG ${alert.ug || '—'} · emprovex-workspace-estimate`;
  const title = alert.workspaceName
    ? `${alert.workspaceName} · ${usageAlertMetricLabel(alert.metric)}`
    : `Firebase global · ${usageAlertMetricLabel(alert.metric)}`;

  const tone = alert.level === 'exceeded'
    ? 'border-rose-300/20 bg-rose-400/[0.07] text-rose-100'
    : alert.level === 'critical'
      ? 'border-orange-300/20 bg-orange-400/[0.07] text-orange-100'
      : alert.level === 'elevated'
        ? 'border-amber-300/20 bg-amber-400/[0.07] text-amber-100'
        : 'border-yellow-200/15 bg-yellow-300/[0.05] text-yellow-50';

  return (
    <div className={`rounded-xl border px-3 py-3 ${tone}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-extrabold">{title}</div>
          <div className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.11em] opacity-70">
            {scope}
          </div>
        </div>
        <div className="rounded-full border border-current/15 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.10em]">
          {usageAlertLevelLabel(alert.level)} · {percentage.toLocaleString('pt-BR', {
            minimumFractionDigits: percentage >= 10 ? 0 : 1,
            maximumFractionDigits: 1,
          })}%
        </div>
      </div>
      <div className="mt-2 text-[10px] opacity-80">
        Consumo {formatCount(alert.used)} / referência {formatCount(alert.budget)}.
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
      <div className="text-[8px] font-bold uppercase tracking-[0.10em] text-slate-500">{label}</div>
      <div className="mt-1 text-base font-black text-slate-100">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/20 px-3 py-2.5">
      <div className="text-[8px] font-bold uppercase tracking-[0.10em] text-slate-500">{label}</div>
      <div className="mt-1 break-all font-mono text-[10px] font-extrabold text-slate-200">{value}</div>
    </div>
  );
}
