'use client';

import {
  Activity,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { HGESM_WORKSPACE_ID } from '../../lib/hgesmWorkspace';
import type { Workspace } from '../../lib/platformIdentity';
import type { AdminWorkspaceUsageEstimate } from '../../lib/platformAdminUsage';

interface AdminUsagePanelProps {
  workspaces: Workspace[];
  usage: AdminWorkspaceUsageEstimate[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Sem consolidação';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sem consolidação';
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminUsagePanel({
  workspaces,
  usage,
  loading,
  error,
  onRefresh,
}: AdminUsagePanelProps) {
  const rows = workspaces
    .filter((workspace) => workspace.ug)
    .map((workspace) => ({
      workspace,
      estimate: usage.find((item) => item.workspaceId === workspace.id) || null,
    }));

  const totalReads = usage.reduce(
    (sum, item) => sum + item.estimatedDocumentReads,
    0
  );
  const totalWrites = usage.reduce(
    (sum, item) => sum + item.estimatedDocumentWrites,
    0
  );

  return (
    <section
      data-testid="admin-usage-panel"
      className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 shadow-[0_22px_70px_rgba(0,8,28,0.18)] backdrop-blur-xl"
    >
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-cyan-200/65">
            <Gauge className="h-4 w-4" />
            Bloco 16.3 · telemetria por UG
          </div>
          <h3 className="text-lg font-extrabold text-white">Consumo estimado por UG</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            Atribuição interna do EMPROVEX. Estes números não são a cobrança oficial do Firebase;
            o consumo global real continuará separado e será integrado via Cloud Monitoring.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.07] px-3.5 text-xs font-extrabold text-blue-100 transition hover:bg-blue-400/[0.12] disabled:cursor-wait disabled:opacity-50"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          Atualizar estimativas
        </button>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Reads atribuídos hoje</p>
            <p data-testid="admin-usage-total-reads" className="mt-1 text-xl font-black text-white">
              {formatCount(totalReads)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Writes atribuídos hoje</p>
            <p className="mt-1 text-xl font-black text-white">{formatCount(totalWrites)}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Fonte</p>
            <p className="mt-1 font-mono text-[10px] font-extrabold text-cyan-100">
              emprovex-workspace-estimate
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}

        {rows.length === 0 && !loading && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-4 text-xs text-slate-400">
            Nenhum workspace com UG válida está disponível para telemetria.
          </div>
        )}

        <div className="grid gap-3">
          {rows.map(({ workspace, estimate }) => (
            <div
              key={workspace.id}
              data-testid={`admin-usage-workspace-${workspace.id}`}
              className="rounded-2xl border border-white/[0.08] bg-slate-950/20 p-4"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-extrabold text-white">{workspace.name}</h4>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                      UG {workspace.ug}
                    </span>
                    {workspace.id === HGESM_WORKSPACE_ID && (
                      <span className="rounded-full border border-violet-300/15 bg-violet-400/[0.07] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.10em] text-violet-100">
                        HGeSM · fundador
                      </span>
                    )}
                    <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.10em] text-cyan-100">
                      estimativa
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Última consolidação: {formatDateTime(estimate?.lastReportedAt || null)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:min-w-[620px]">
                  <Metric label="Reads" value={estimate?.estimatedDocumentReads || 0} icon={<Database className="h-3.5 w-3.5" />} />
                  <Metric label="Writes" value={estimate?.estimatedDocumentWrites || 0} icon={<Activity className="h-3.5 w-3.5" />} />
                  <Metric label="Deletes" value={estimate?.estimatedDocumentDeletes || 0} icon={<Activity className="h-3.5 w-3.5" />} />
                  <Metric label="Snapshots" value={estimate?.realtimeSnapshots || 0} icon={<Activity className="h-3.5 w-3.5" />} />
                  <Metric label="Carga pico listeners*" value={estimate?.peakRealtimeListeners || 0} icon={<Gauge className="h-3.5 w-3.5" />} />
                  <Metric label="Flushes" value={estimate?.telemetryFlushes || 0} icon={<RefreshCw className="h-3.5 w-3.5" />} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500">
          * “Carga pico listeners” é uma atribuição conservadora somada por cliente/aba e não representa
          conexões simultâneas oficiais do Firebase. A telemetria é agregada no cliente e consolidada
          com baixa frequência para não gerar um custo relevante por conta própria.
        </p>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.10em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-slate-100">{formatCount(value)}</div>
    </div>
  );
}
