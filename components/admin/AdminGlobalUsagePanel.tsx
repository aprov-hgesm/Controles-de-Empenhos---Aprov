'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Gauge,
  Info,
  Loader2,
  RefreshCw,
  RadioTower,
  TimerReset,
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

type DiagnosticTone = 'ok' | 'attention' | 'error' | 'info';

interface DiagnosticItem {
  title: string;
  detail: string;
  tone: DiagnosticTone;
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

function minutesBetween(later: string | null, earlier: string | null): number | null {
  if (!later || !earlier) return null;
  const laterMs = Date.parse(later);
  const earlierMs = Date.parse(earlier);
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) return null;
  return Math.max(0, Math.round((laterMs - earlierMs) / 60_000));
}

function freshnessLabel(minutes: number | null): string {
  if (minutes === null) return 'Sem amostra';
  if (minutes <= 5) return 'Muito recente';
  if (minutes <= 15) return `${minutes} min de defasagem`;
  if (minutes <= 60) return `${minutes} min de defasagem`;
  return `${Math.round(minutes / 60)} h de defasagem`;
}

function buildDiagnostics(input: {
  snapshot: FirebaseGlobalUsageSnapshot | null;
  configured: boolean | null;
  observedAt: string | null;
  dataThrough: string | null;
  error: string | null;
}): DiagnosticItem[] {
  const { snapshot, configured, observedAt, dataThrough, error } = input;
  const diagnostics: DiagnosticItem[] = [];

  if (configured === false) {
    diagnostics.push({
      title: 'Credencial do Google não disponível neste ambiente',
      detail: 'A rota server-side não encontrou FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON nem a credencial dedicada de Monitoring.',
      tone: 'error',
    });
  } else if (configured === true) {
    diagnostics.push({
      title: 'Integração server-side configurada',
      detail: 'O EMPROVEX reconheceu uma credencial apta a tentar a leitura do Cloud Monitoring.',
      tone: 'ok',
    });
  } else {
    diagnostics.push({
      title: 'Configuração ainda em verificação',
      detail: 'A interface ainda não concluiu a primeira consulta da integração com o Google.',
      tone: 'info',
    });
  }

  if (error) {
    const normalized = error.toLocaleLowerCase('pt-BR');
    diagnostics.push({
      title: normalized.includes('permiss')
        ? 'Provável falta de permissão IAM'
        : normalized.includes('autentic')
          ? 'Provável falha de autenticação da conta de serviço'
          : 'Falha na consulta das métricas',
      detail: error,
      tone: 'error',
    });
  }

  if (snapshot) {
    const lagMinutes = minutesBetween(observedAt, dataThrough);
    diagnostics.push({
      title: dataThrough
        ? lagMinutes !== null && lagMinutes > 15
          ? 'Dados do Google estão chegando com atraso'
          : 'Amostra do Google disponível'
        : 'A consulta retornou números sem timestamp de amostra',
      detail: dataThrough
        ? `Último ponto do Monitoring: ${formatDateTime(dataThrough)} · ${freshnessLabel(lagMinutes)}.`
        : 'Quando não há dataThrough, alguma série filtrada pode ainda não ter pontos na janela atual.',
      tone: lagMinutes !== null && lagMinutes > 15 ? 'attention' : dataThrough ? 'ok' : 'attention',
    });

    diagnostics.push({
      title: 'Janela diária diferente do horário do Brasil',
      detail: `A cota é consultada desde ${formatDateTime(snapshot.windowStartedAt)} e usa reset em ${snapshot.billingReference.resetTimeZone}. Isso pode fazer o “hoje” do Google divergir do dia civil local.`,
      tone: 'info',
    });

    diagnostics.push({
      title: 'Banco Firestore nomeado',
      detail: `O filtro consulta especificamente o database_id “${snapshot.databaseId}”. Se o consumo ocorrer em outro banco do mesmo projeto, ele não entra nesta leitura.`,
      tone: 'info',
    });

    const ratio = snapshot.documentReads > 0
      ? snapshot.billableReadUnits / snapshot.documentReads
      : null;
    diagnostics.push({
      title: 'Read Units e documentos lidos são métricas diferentes',
      detail: ratio === null
        ? 'Ainda não há documentReads suficientes para uma relação visual. Não use uma métrica como substituta direta da outra.'
        : `Relação visual atual: ${ratio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} Read Unit(s) para cada documento lido observado. É apenas diagnóstico; não é taxa de conversão.`,
      tone: 'info',
    });

    diagnostics.push({
      title: 'Google é global; UG é atribuição interna',
      detail: 'O Cloud Monitoring enxerga o banco inteiro. O consumo por UG vem da instrumentação do EMPROVEX e não pode ser reconciliado 1:1 com a métrica global.',
      tone: 'info',
    });
  } else if (configured === true && !error) {
    diagnostics.push({
      title: 'Integração configurada, mas ainda sem fotografia',
      detail: 'Atualize as métricas reais. Se continuar vazio, as causas mais prováveis são atraso da série, filtro do database_id ou ausência de pontos na janela atual.',
      tone: 'attention',
    });
  }

  return diagnostics;
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
  const lagMinutes = minutesBetween(observedAt, dataThrough);
  const diagnostics = buildDiagnostics({
    snapshot,
    configured,
    observedAt,
    dataThrough,
    error,
  });

  return (
    <section
      data-testid="admin-global-usage-panel"
      className="overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#071225]/60 shadow-[0_22px_70px_rgba(0,8,28,0.18)] backdrop-blur-xl"
    >
      <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-200/70">
              <Cloud className="h-4 w-4" />
              Google Cloud Monitoring · fonte real
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

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatusBox
            label="Integração"
            value={
              configured === true
                ? 'Conectada'
                : configured === false
                  ? 'Não configurada'
                  : 'Verificando'
            }
            tone={configured === true ? 'ok' : configured === false ? 'error' : 'info'}
          />
          <StatusBox
            label="Último ponto Google"
            value={formatDateTime(dataThrough)}
            tone={dataThrough ? (lagMinutes !== null && lagMinutes > 15 ? 'attention' : 'ok') : 'attention'}
          />
          <StatusBox
            label="Defasagem"
            value={freshnessLabel(lagMinutes)}
            tone={lagMinutes !== null && lagMinutes > 15 ? 'attention' : dataThrough ? 'ok' : 'info'}
          />
          <StatusBox
            label="Banco"
            value={snapshot?.databaseId || 'Sem amostra'}
            tone={snapshot ? 'ok' : 'info'}
            mono
          />
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {configured === false && (
          <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100">
            A credencial server-side do Cloud Monitoring ainda não está disponível. O leitor aceita
            a credencial administrativa server-side do Firebase como fonte principal e mantém
            a credencial dedicada de Monitoring como fallback.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}

        {snapshot ? (
          <>
            <div
              data-testid="admin-firestore-primary-billing-quota"
              className="rounded-2xl border border-blue-300/20 bg-blue-500/[0.05] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-blue-200/85">
                    <WalletCards className="h-4 w-4" />
                    Limite principal · início de cobrança
                  </div>
                  <h4 className="mt-2 text-base font-black text-white">
                    Consumo faturável observado pelo Google
                  </h4>
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
                    Barras separadas deixam claro o peso de Read Units, Realtime Read Units e Write Units
                    contra as referências diárias configuradas.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-slate-950/25 px-3 py-2 text-right">
                  <div className="text-[8px] font-bold uppercase tracking-[0.10em] text-slate-500">
                    Janela atual
                  </div>
                  <div className="mt-1 text-[11px] font-extrabold text-slate-200">
                    {formatDateTime(snapshot.windowStartedAt)} → agora
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <QuotaLane
                  label="Read Units faturáveis"
                  used={snapshot.billableReadUnits}
                  limit={snapshot.billingReference.readUnitsDailyLimit}
                  primary
                />
                <QuotaLane
                  label="Realtime Read Units"
                  used={snapshot.billableRealtimeReadUnits}
                  limit={snapshot.billingReference.realtimeReadUnitsDailyLimit}
                />
                <QuotaLane
                  label="Write Units faturáveis"
                  used={snapshot.billableWriteUnits}
                  limit={snapshot.billingReference.writeUnitsDailyLimit}
                />
              </div>

              <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
                A estimativa por UG permanece independente e não é usada para fabricar ou ratear estes números globais.
                O reset da referência diária usa {snapshot.billingReference.resetTimeZone}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Leituras de documentos"
                value={snapshot.documentReads}
                icon={<Database className="h-3.5 w-3.5" />}
              />
              <Metric
                label="Writes de documentos"
                value={snapshot.documentWrites}
                icon={<Activity className="h-3.5 w-3.5" />}
              />
              <Metric
                label="Deletes de documentos"
                value={snapshot.documentDeletes}
                icon={<Database className="h-3.5 w-3.5" />}
              />
              <Metric
                label="Conexões ativas"
                value={snapshot.activeConnections}
                icon={<RadioTower className="h-3.5 w-3.5" />}
              />
              <Metric
                label="Snapshot listeners"
                value={snapshot.snapshotListeners}
                icon={<Gauge className="h-3.5 w-3.5" />}
              />
              <Metric
                label="Read Units faturáveis"
                value={snapshot.billableReadUnits}
                icon={<WalletCards className="h-3.5 w-3.5" />}
              />
              <Metric
                label="Realtime Read Units"
                value={snapshot.billableRealtimeReadUnits}
                icon={<RadioTower className="h-3.5 w-3.5" />}
              />
              <Metric
                label="Write Units faturáveis"
                value={snapshot.billableWriteUnits}
                icon={<Activity className="h-3.5 w-3.5" />}
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.10] bg-slate-950/15 px-5 py-10 text-center">
            <Cloud className="mx-auto h-6 w-6 text-slate-600" />
            <p className="mt-3 text-sm font-extrabold text-slate-300">
              Ainda não há fotografia real carregada
            </p>
            <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
              Use “Atualizar métricas reais”. Se a integração estiver configurada e continuar sem amostra,
              o painel de diagnóstico abaixo aponta as causas mais prováveis.
            </p>
          </div>
        )}

        <section
          data-testid="google-usage-diagnostics"
          className="rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.03] p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-400/[0.07] text-cyan-200">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Diagnóstico da visualização Google</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                A leitura abaixo usa o estado real que a interface recebeu e também as restrições do leitor
                server-side atual.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 xl:grid-cols-2">
            {diagnostics.map((item) => (
              <DiagnosticCard key={item.title + item.detail} item={item} />
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-4">
          <InfoBox label="Fonte" value="google-cloud-monitoring" />
          <InfoBox label="Consulta realizada" value={formatDateTime(observedAt)} />
          <InfoBox label="Dados disponíveis até" value={formatDateTime(dataThrough)} />
          <InfoBox label="Reset da cota" value={snapshot?.billingReference.resetTimeZone || 'America/Los_Angeles'} />
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500">
          O Cloud Monitoring pode apresentar atraso entre a operação e a disponibilidade da série.
          A interface agora separa explicitamente o horário da consulta do EMPROVEX do horário do último
          ponto entregue pelo Google. As contagens de documentos continuam como diagnóstico operacional;
          as unidades faturáveis permanecem a referência principal do painel.
        </p>
      </div>
    </section>
  );
}

function QuotaLane({
  label,
  used,
  limit,
  primary = false,
}: {
  label: string;
  used: number;
  limit: number;
  primary?: boolean;
}) {
  const percentage = quotaPercentage(used, limit);
  const width = Math.min(100, percentage);
  const exceeded = percentage > 100;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/20 p-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-extrabold text-slate-200">{label}</p>
            {primary && (
              <span className="rounded-full border border-blue-300/15 bg-blue-400/[0.07] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.10em] text-blue-200">
                principal
              </span>
            )}
          </div>
          <p className="mt-1 text-lg font-black text-white">
            {formatCount(used)}
            <span className="ml-1.5 text-[10px] font-bold text-slate-600">/ {formatCount(limit)}</span>
          </p>
        </div>
        <p className={`text-sm font-black ${exceeded ? 'text-rose-300' : percentage >= 70 ? 'text-amber-300' : 'text-emerald-300'}`}>
          {percentage.toLocaleString('pt-BR', {
            minimumFractionDigits: percentage > 0 && percentage < 10 ? 1 : 0,
            maximumFractionDigits: 1,
          })}%
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/55">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${exceeded ? 'bg-rose-400' : percentage >= 70 ? 'bg-amber-300' : 'bg-emerald-400'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
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

function StatusBox({
  label,
  value,
  tone,
  mono = false,
}: {
  label: string;
  value: string;
  tone: DiagnosticTone;
  mono?: boolean;
}) {
  const toneClass = tone === 'ok'
    ? 'border-emerald-300/15 bg-emerald-400/[0.045]'
    : tone === 'attention'
      ? 'border-amber-300/15 bg-amber-400/[0.045]'
      : tone === 'error'
        ? 'border-rose-300/15 bg-rose-400/[0.045]'
        : 'border-white/[0.07] bg-white/[0.025]';

  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[8px] font-black uppercase tracking-[0.11em] text-slate-600">{label}</p>
      <p className={`mt-1 truncate text-[10px] font-extrabold text-slate-200 ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function DiagnosticCard({ item }: { item: DiagnosticItem }) {
  const Icon = item.tone === 'ok'
    ? CheckCircle2
    : item.tone === 'error' || item.tone === 'attention'
      ? AlertTriangle
      : TimerReset;

  const toneClass = item.tone === 'ok'
    ? 'text-emerald-300'
    : item.tone === 'error'
      ? 'text-rose-300'
      : item.tone === 'attention'
        ? 'text-amber-300'
        : 'text-cyan-300';

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-slate-950/20 px-3.5 py-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneClass}`} />
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold text-slate-200">{item.title}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{item.detail}</p>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-slate-950/20 px-3 py-2.5">
      <div className="text-[8px] font-bold uppercase tracking-[0.10em] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-[10px] font-extrabold text-slate-200" title={value}>
        {value}
      </div>
    </div>
  );
}
