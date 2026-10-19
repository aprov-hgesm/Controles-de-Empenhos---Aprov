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

const MODULE_LABELS = [
  { id: 'empenhos', label: 'Empenhos' },
  { id: 'notas', label: 'Notas Fiscais' },
  { id: 'deposito', label: 'Depósito' },
  { id: 'sessoes', label: 'Sessões e acesso' },
  { id: 'outros', label: 'Outros fluxos' },
] as const;

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
            Informações por unidade
          </div>
          <h3 className="text-lg font-extrabold text-white">Quais unidades usam mais o EMPROVEX?</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            Acompanhe a atividade registrada pelo EMPROVEX para cada UG (código da unidade).
            Estes valores são estimativas internas, não uma cobrança do Google.
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
        <div className="rounded-xl border border-[#ccddf0] bg-[#eff6ff] px-4 py-3" data-testid="admin-ug-simple-guide">
          <p className="text-xs font-extrabold text-[#215388]">Como entender estes números</p>
          <p className="mt-1 text-xs leading-6 text-[#496784]">
            <strong>Leituras</strong> são consultas de informações.
            <strong> Gravações</strong> são registros ou alterações salvas.
            <strong> Exclusões</strong> são documentos apagados.
            Atualizações em tempo real aparecem separadas porque algumas telas acompanham os dados continuamente.
          </p>
          <p className="mt-1 text-xs leading-6 text-[#496784]">
            <strong>Importante:</strong> números sem medição não significam ausência de uso.
            A contagem por UG não corresponde diretamente à fatura do Google.
            A divisão por módulo identifica apenas as operações que o EMPROVEX conseguiu acompanhar.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Leituras estimadas hoje</p>
            <p data-testid="admin-usage-total-reads" className="mt-1 text-xl font-black text-white">
              {formatCount(totalReads)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Gravações estimadas hoje</p>
            <p className="mt-1 text-xl font-black text-white">{formatCount(totalWrites)}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Origem dos dados</p>
            <p className="mt-1 text-xs font-bold text-cyan-100">
              Medições internas do EMPROVEX
            </p>
          </div>
        </div>

        {usage.length === 0 && !loading && !error && (
          <p className="text-xs leading-6 text-[#627b98]">
            Ainda não há medições por UG nesta consulta. Os totais acima não comprovam consumo zero.
          </p>
        )}

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
                    {estimate
                      ? 'Última atualização da medição: ' + formatDateTime(estimate.lastReportedAt)
                      : 'Ainda não há medição disponível para esta UG.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:min-w-[620px]">
                  <Metric label="Leituras" detail="Consultas de documentos" value={estimate?.estimatedDocumentReads ?? null} icon={<Database className="h-3.5 w-3.5" />} />
                  <Metric label="Gravações" detail="Dados salvos ou alterados" value={estimate?.estimatedDocumentWrites ?? null} icon={<Activity className="h-3.5 w-3.5" />} />
                  <Metric label="Exclusões" detail="Documentos apagados" value={estimate?.estimatedDocumentDeletes ?? null} icon={<Activity className="h-3.5 w-3.5" />} />
                  <Metric label="Atualizações recebidas" detail="Mudanças vistas em tempo real" value={estimate?.realtimeSnapshots ?? null} icon={<Activity className="h-3.5 w-3.5" />} />
                  <Metric label="Pico de observadores*" detail="Maior carga de consultas acompanhadas" value={estimate?.peakRealtimeListeners ?? null} icon={<Gauge className="h-3.5 w-3.5" />} />
                  <Metric label="Envios de medição" detail="Vezes em que o uso foi consolidado" value={estimate?.telemetryFlushes ?? null} icon={<RefreshCw className="h-3.5 w-3.5" />} />
                </div>
              </div>
              <div className="mt-4 border-t border-[#d5e4f3] pt-4" data-testid={`admin-ug-modules-${workspace.id}`}>
                <p className="text-xs font-extrabold text-[#1c4c82]">De onde veio a atividade desta UG?</p>
                {!estimate?.moduleBreakdownAvailable ? (
                  <p className="mt-2 text-xs leading-5 text-[#657d9a]">
                    Sem detalhamento por módulo neste dia. Os registros antigos não permitem saber qual tela gerou as operações.
                  </p>
                ) : (() => {
                  const operations = MODULE_LABELS.map(({ id, label }) => ({
                    id, label, count: estimate.moduleOperations[id],
                  }));
                  const total = operations.reduce((sum, item) => sum + item.count, 0);
                  const classified = total - estimate.moduleOperations.outros;
                  return (
                    <>
                      <p className="mt-1 text-xs leading-5 text-[#657d9a]">
                        {formatCount(total)} operações instrumentadas com categoria.
                        {total > 0
                          ? ` ${Math.round(classified / total * 100)}% foram associadas a um módulo específico.`
                          : ' Ainda não há operações classificadas nesta medição.'}
                        {' '}Isso mede a organização dos registros captados, não a precisão da conta do Google.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {operations.map(item => {
                          const percent = total > 0 ? item.count / total * 100 : 0;
                          return (
                            <div key={item.id} className="rounded-lg border border-[#d6e5f4] bg-[#f4f8fd] px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-[#3f6082]">{item.label}</span>
                                <span className="text-[11px] font-extrabold text-[#1b4a7d]">{formatCount(item.count)} · {percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dce7f5]">
                                <div className="h-full rounded-full bg-[#568bc5]" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500">
          * O pico de observadores é estimado por tela e não informa exatamente quantas pessoas estão conectadas.
          Os registros são agrupados periodicamente para evitar leituras extras desnecessárias.
        </p>
      </div>
    </section>
  );
}

function Metric({
  label,
  detail,
  value,
  icon,
}: {
  label: string;
  detail: string;
  value: number | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.10em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-slate-100">{value === null ? 'Sem medição' : formatCount(value)}</div>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}
