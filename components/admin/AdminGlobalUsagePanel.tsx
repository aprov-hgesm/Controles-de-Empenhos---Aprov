'use client';

import {
  Activity,
  Cloud,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
  RadioTower,
  WalletCards,
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

function quotaPercentage(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, (used / limit) * 100);
}

function QuotaCard({ snapshot }: { snapshot: FirebaseGlobalUsageSnapshot }) {
  const reference = snapshot.billingReference;
  const used = snapshot.billableReadUnits;
  const limit = reference.readUnitsDailyLimit;
  const percentage = quotaPercentage(used, limit);
  const remaining = Math.max(0, limit - used);
  const exceeded = used > limit;
  const width = Math.min(100, percentage);

  return (
    <div
      data-testid="admin-firestore-primary-billing-quota"
      className="rounded-2xl border border-blue-300/20 bg-blue-500/[0.06] p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-blue-200/85">
            <WalletCards className="h-4 w-4" />
            Limite principal · início de cobrança
          </div>
          <h4 className="mt-2 text-base font-black text-white">
            Read Units do Firestore Enterprise
          </h4>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            O indicador principal compara as unidades de leitura faturáveis observadas com a
            franquia diária configurada para o banco. A janela acompanha o reset diário do
            Firestore em America/Los_Angeles.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-slate-950/25 px-3 py-2 text-right">
          <div className="text-[8px] font-bold uppercase tracking-[0.10em] text-slate-500">
            Uso da franquia
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {percentage.toLocaleString('pt-BR', {
              minimumFractionDigits: percentage >= 10 ? 0 : 1,
              maximumFractionDigits: 1,
            })}%
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-950/50">
        <div
          className="h-full rounded-full bg-blue-400 transition-[width] duration-500"
          style={{ width: `${width}%` }}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="Read Units usadas"
          value={used}
          icon={<Database className="h-3.5 w-3.5" />}
        />
        <Metric
          label="Limite diário"
          value={limit}
          icon={<Gauge className="h-3.5 w-3.5" />}
        />
        <Metric
          label={exceeded ? 'Acima da franquia' : 'Restante até cobrança'}
          value={exceeded ? used - limit : remaining}
          icon={<WalletCards className="h-3.5 w-3.5" />}
        />
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
        {reference.freeTierEligible
          ? exceeded
            ? 'A franquia diária de leitura foi ultrapassada; unidades adicionais entram na faixa sujeita a cobrança.'
            : 'Enquanto este indicador permanecer abaixo de 100%, as Read Units ainda estão dentro da referência diária sem custo configurada.'
          : 'Este banco está parametrizado como não elegível à franquia gratuita; a referência é exibida apenas para acompanhamento operacional.'}
      </p>
    </div>
  );
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
            A credencial server-side do Cloud Monitoring ainda não está disponível. O leitor agora
            aceita a credencial administrativa server-side do Firebase como fonte principal e mantém
            a credencial dedicada de Monitoring como fallback.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}

        {snapshot && <QuotaCard snapshot={snapshot} />}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="Read Units faturáveis"
            value={snapshot?.billableReadUnits || 0}
            icon={<Database className="h-3.5 w-3.5" />}
          />
          <Metric
            label="Realtime Read Units"
            value={snapshot?.billableRealtimeReadUnits || 0}
            icon={<RadioTower className="h-3.5 w-3.5" />}
          />
          <Metric
            label="Write Units faturáveis"
            value={snapshot?.billableWriteUnits || 0}
            icon={<Activity className="h-3.5 w-3.5" />}
          />
          <Metric
            label="Leituras de documentos"
            value={snapshot?.documentReads || 0}
            icon={<Database className="h-3.5 w-3.5" />}
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

        {snapshot && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Info
              label="Franquia Realtime/dia"
              value={formatCount(snapshot.billingReference.realtimeReadUnitsDailyLimit)}
            />
            <Info
              label="Franquia Write Units/dia"
              value={formatCount(snapshot.billingReference.writeUnitsDailyLimit)}
            />
            <Info
              label="Reset da cota"
              value={snapshot.billingReference.resetTimeZone}
            />
          </div>
        )}

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
          do Firestore periodicamente e pode apresentar atraso de alguns minutos. Métricas de
          unidades faturáveis são a referência principal de cota do Firestore Enterprise; as
          contagens de documentos permanecem apenas como diagnóstico operacional.
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
