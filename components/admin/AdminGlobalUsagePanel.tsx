'use client';

import {
  Activity,
  Cloud,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
  RadioTower,
} from 'lucide-react';

import type { FirebaseGlobalUsageSnapshot } from '../../lib/platformCapacity';

interface AdminGlobalUsagePanelProps {
  snapshot: FirebaseGlobalUsageSnapshot | null;
  configured: boolean | null;
  observedAt: string | null;
  dataThrough: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
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

export function AdminGlobalUsagePanel({
  snapshot,
  configured,
  observedAt,
  dataThrough,
  loading,
  error,
  onRefresh,
}: AdminGlobalUsagePanelProps) {
  return (
    <section
      data-testid="admin-global-usage-panel"
      className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 shadow-[0_22px_70px_rgba(0,8,28,0.18)] backdrop-blur-xl"
    >
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-200/70">
            <Cloud className="h-4 w-4" />
            Bloco 16.4 · Google Cloud Monitoring
          </div>
          <h3 className="text-lg font-extrabold text-white">Consumo global real do Firebase</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            Métricas oficiais do projeto Firestore consultadas pelo servidor. Esta visão é global,
            não é rateada por UG e não representa a fatura final do Google Cloud.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading || configured === false}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-3.5 text-xs font-extrabold text-emerald-100 transition hover:bg-emerald-400/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          Atualizar métricas reais
        </button>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {configured === false && (
          <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100">
            Integração preparada, mas a credencial server-side de leitura do Cloud Monitoring ainda
            não está configurada neste ambiente. Nenhuma credencial é solicitada ou armazenada no navegador.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Reads hoje (UTC)"
            value={snapshot?.documentReads || 0}
            icon={<Database className="h-3.5 w-3.5" />}
          />
          <Metric
            label="Writes hoje (UTC)"
            value={snapshot?.documentWrites || 0}
            icon={<Activity className="h-3.5 w-3.5" />}
          />
          <Metric
            label="Deletes hoje (UTC)"
            value={snapshot?.documentDeletes || 0}
            icon={<Activity className="h-3.5 w-3.5" />}
          />
          <Metric
            label="Conexões ativas"
            value={snapshot?.activeConnections || 0}
            icon={<RadioTower className="h-3.5 w-3.5" />}
          />
          <Metric
            label="Snapshot listeners"
            value={snapshot?.snapshotListeners || 0}
            icon={<Gauge className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Info label="Fonte" value="google-cloud-monitoring" />
          <Info
            label="Banco Firestore"
            value={snapshot?.databaseId || 'Aguardando configuração'}
          />
          <Info
            label="Dados disponíveis até"
            value={dataThrough ? formatDateTime(dataThrough) : 'Sem amostra'}
          />
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500">
          Consulta realizada: {formatDateTime(observedAt)}. O Cloud Monitoring amostra as métricas
          do Firestore periodicamente e pode apresentar atraso de alguns minutos. A estimativa por UG
          do Bloco 16.3 permanece independente e não é usada para fabricar estes números globais.
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
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3">
      <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.10em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-slate-100">{formatCount(value)}</div>
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
