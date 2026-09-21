'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  CreditCard,
  KeyRound,
  Loader2,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';

import {
  getBillingAttention,
  type BillingAccount,
  type BillingAccountStatus,
  type BillingCycle,
  type BillingCycleStatus,
  type PlatformBillingConfig,
} from '../../lib/billing';
import type { Workspace } from '../../lib/platformIdentity';
import type { UpdatePlatformBillingConfigInput } from '../../lib/platformBillingStore';

interface AdminBillingPanelProps {
  workspaces: Workspace[];
  config: PlatformBillingConfig | null;
  accounts: BillingAccount[];
  cyclesByWorkspace: Map<string, BillingCycle[]>;
  loading: boolean;
  error: string | null;
  mutatingKey: string | null;
  onUpdateConfig: (input: UpdatePlatformBillingConfigInput) => Promise<unknown>;
  onGrantTrial: (workspace: Workspace, trialDays?: number) => Promise<unknown>;
  onSetStatus: (
    workspace: Workspace,
    status: Exclude<BillingAccountStatus, 'exempt'>
  ) => Promise<unknown>;
  onSetCycleStatus: (
    workspace: Workspace,
    referenceMonth: string,
    status: BillingCycleStatus,
    note?: string
  ) => Promise<unknown>;
}

const STATUS_LABEL: Record<BillingAccountStatus, string> = {
  trial: 'Período de teste',
  active: 'Em dia',
  pending: 'Pendente',
  suspended: 'Suspenso comercial',
  canceled: 'Cancelado',
  exempt: 'Isento',
};

function money(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function dateLabel(value?: string | null): string {
  if (!value) return '—';
  const source = value.length === 10 ? `${value}T12:00:00Z` : value;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

function statusTone(status: BillingAccountStatus): string {
  switch (status) {
    case 'trial':
      return 'border-violet-300/20 bg-violet-400/[0.08] text-violet-100';
    case 'active':
      return 'border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100';
    case 'pending':
      return 'border-amber-300/20 bg-amber-400/[0.08] text-amber-100';
    case 'suspended':
      return 'border-rose-300/20 bg-rose-400/[0.08] text-rose-100';
    case 'canceled':
      return 'border-slate-300/15 bg-slate-400/[0.06] text-slate-300';
    case 'exempt':
      return 'border-blue-300/20 bg-blue-400/[0.08] text-blue-100';
  }
}

export function AdminBillingPanel({
  workspaces,
  config,
  accounts,
  cyclesByWorkspace,
  loading,
  error,
  mutatingKey,
  onUpdateConfig,
  onGrantTrial,
  onSetStatus,
  onSetCycleStatus,
}: AdminBillingPanelProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | BillingAccountStatus>('all');
  const [editingConfig, setEditingConfig] = useState(false);
  const [price, setPrice] = useState('70,00');
  const [trialDays, setTrialDays] = useState('30');
  const [graceDays, setGraceDays] = useState('10');
  const [pixKey, setPixKey] = useState('');
  const [pixRecipientName, setPixRecipientName] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PlatformBillingConfig['pixKeyType']>('');
  const [holidayDates, setHolidayDates] = useState('');

  const workspaceMap = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );

  const accountRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return accounts
      .map((account) => ({
        account,
        workspace: workspaceMap.get(account.workspaceId) || null,
      }))
      .filter(({ account, workspace }) => {
        if (filter !== 'all' && account.status !== filter) return false;
        if (!normalizedQuery) return true;
        return [
          workspace?.name,
          workspace?.ug,
          workspace?.authorizedEmail,
          workspace?.institutionalProfile.organizationName,
          workspace?.institutionalProfile.organizationShortName,
          account.workspaceId,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('pt-BR').includes(normalizedQuery));
      })
      .sort((a, b) => {
        const priority = (status: BillingAccountStatus) => (
          status === 'pending' ? 0
            : status === 'suspended' ? 1
              : status === 'trial' ? 2
                : status === 'active' ? 3
                  : status === 'exempt' ? 4
                    : 5
        );
        return priority(a.account.status) - priority(b.account.status)
          || (a.workspace?.name || a.account.workspaceId)
            .localeCompare(b.workspace?.name || b.account.workspaceId, 'pt-BR');
      });
  }, [accounts, filter, query, workspaceMap]);

  const counts = useMemo(() => {
    const result = {
      trial: 0,
      active: 0,
      pending: 0,
      suspended: 0,
      exempt: 0,
      attention: 0,
    };
    if (!config) return result;

    for (const account of accounts) {
      if (account.status in result) {
        const key = account.status as keyof typeof result;
        if (key !== 'attention') result[key] += 1;
      }
      const attention = getBillingAttention(
        account,
        cyclesByWorkspace.get(account.workspaceId) || [],
        config
      );
      if (attention.needsAttention) result.attention += 1;
    }
    return result;
  }, [accounts, config, cyclesByWorkspace]);

  const beginConfigEdit = () => {
    if (!config) return;
    setPrice((config.monthlyPriceCents / 100).toFixed(2).replace('.', ','));
    setTrialDays(String(config.defaultTrialDays));
    setGraceDays(String(config.gracePeriodDays));
    setPixKey(config.pixKey);
    setPixRecipientName(config.pixRecipientName);
    setPixKeyType(config.pixKeyType);
    setHolidayDates(config.holidayDates.join('\n'));
    setEditingConfig(true);
  };

  const saveConfig = async () => {
    if (!config) return;
    const normalizedPrice = Number(price.replace('.', '').replace(',', '.'));
    const parsedHolidays = holidayDates
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    await onUpdateConfig({
      monthlyPriceCents: Number.isFinite(normalizedPrice)
        ? Math.round(normalizedPrice * 100)
        : config.monthlyPriceCents,
      defaultTrialDays: Number(trialDays),
      gracePeriodDays: Number(graceDays),
      pixKey,
      pixKeyType,
      pixRecipientName,
      holidayDates: parsedHolidays,
      billingMode: 'observe',
      requirePayment: false,
    });
    setEditingConfig(false);
  };

  if (loading && accounts.length === 0) {
    return (
      <section className="rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 p-8 text-center backdrop-blur-xl">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-300" />
        <p className="mt-3 text-sm font-bold text-slate-200">Preparando controle administrativo de assinaturas…</p>
      </section>
    );
  }

  return (
    <div data-testid="admin-billing-panel" className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BillingMetric
          icon={<Sparkles className="h-5 w-5" />}
          label="Em período de teste"
          value={String(counts.trial)}
          detail="Trial padrão de 30 dias"
        />
        <BillingMetric
          icon={<BadgeCheck className="h-5 w-5" />}
          label="Em dia"
          value={String(counts.active)}
          detail="Situação comercial regular"
        />
        <BillingMetric
          icon={<Clock3 className="h-5 w-5" />}
          label="Atenção financeira"
          value={String(counts.attention)}
          detail="Sem bloqueio automático"
        />
        <BillingMetric
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Modo de cobrança"
          value={(config?.billingMode || 'observe').toUpperCase()}
          detail="OBSERVE não interfere no acesso"
        />
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-300/20 bg-rose-400/[0.08] px-5 py-4 text-sm text-rose-100">
          {error}
        </section>
      )}

      <section className="rounded-[2rem] border border-blue-300/15 bg-blue-500/[0.055] p-5 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-blue-200">
              <ShieldCheck className="h-5 w-5" />
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em]">
                Proteção de testes
              </p>
            </div>
            <h3 className="mt-2 text-xl font-extrabold text-white">Cobrança em modo de observação</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Trial, vencimentos, competências e situações comerciais são acompanhados, mas não participam
              da autorização operacional. Mesmo uma assinatura marcada como suspensa comercialmente continua
              sem bloquear login, sessões, empenhos, notas fiscais ou documentos enquanto o enforcement não for ativado em desenvolvimento futuro.
            </p>
          </div>
          <div className="min-w-[250px] rounded-2xl border border-white/[0.08] bg-slate-950/25 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Exigir pagamento</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-sm font-extrabold text-emerald-200">DESATIVADO</span>
              <button
                type="button"
                disabled
                title="Será liberado somente após a fase de testes dos usuários externos."
                className="cursor-not-allowed rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600"
              >
                Ativar
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Suspensão automática também permanece permanentemente desativada nesta fase.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 p-5 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-200">
              <WalletCards className="h-5 w-5" />
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em]">
                Política comercial
              </p>
            </div>
            <h3 className="mt-1 text-lg font-extrabold text-white">EMPROVEX completo</h3>
            <p className="mt-1 text-xs text-slate-400">
              Pix manual preparado administrativamente; ainda não é exibido ao usuário externo.
            </p>
          </div>
          {!editingConfig && (
            <button
              type="button"
              onClick={beginConfigEdit}
              className="rounded-xl border border-blue-300/15 bg-blue-400/[0.07] px-4 py-2.5 text-xs font-extrabold text-blue-100 transition hover:bg-blue-400/[0.12]"
            >
              Editar configuração
            </button>
          )}
        </div>

        {!editingConfig ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <InfoBox label="Mensalidade" value={money(config?.monthlyPriceCents ?? 7000)} />
            <InfoBox label="Trial padrão" value={`${config?.defaultTrialDays ?? 30} dias`} />
            <InfoBox label="Vencimento" value="5º dia útil" />
            <InfoBox label="Tolerância" value={`${config?.gracePeriodDays ?? 10} dias`} />
            <InfoBox label="Pix" value={config?.pixKey ? 'Configurado' : 'A configurar'} />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <ConfigField label="Mensalidade (R$)">
                <input value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} />
              </ConfigField>
              <ConfigField label="Trial padrão (dias)">
                <input type="number" min={1} max={365} value={trialDays} onChange={(event) => setTrialDays(event.target.value)} className={inputClass} />
              </ConfigField>
              <ConfigField label="Tolerância (dias corridos)">
                <input type="number" min={0} max={90} value={graceDays} onChange={(event) => setGraceDays(event.target.value)} className={inputClass} />
              </ConfigField>
            </div>

            <div className="grid gap-4 sm:grid-cols-[170px_1fr_1fr]">
              <ConfigField label="Tipo da chave Pix">
                <select value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as PlatformBillingConfig['pixKeyType'])} className={inputClass}>
                  <option value="">Não definido</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Aleatória</option>
                </select>
              </ConfigField>
              <ConfigField label="Chave Pix">
                <input value={pixKey} onChange={(event) => setPixKey(event.target.value)} className={inputClass} />
              </ConfigField>
              <ConfigField label="Nome do favorecido">
                <input value={pixRecipientName} onChange={(event) => setPixRecipientName(event.target.value)} className={inputClass} />
              </ConfigField>
            </div>

            <ConfigField label="Feriados adicionais para cálculo do 5º dia útil" hint="Um AAAA-MM-DD por linha. Feriados nacionais fixos já são considerados.">
              <textarea
                value={holidayDates}
                onChange={(event) => setHolidayDates(event.target.value)}
                rows={3}
                placeholder={'2026-10-XX\n2026-12-XX'}
                className={`${inputClass} resize-y font-mono`}
              />
            </ConfigField>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingConfig(false)}
                disabled={mutatingKey === 'config'}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveConfig()}
                disabled={mutatingKey === 'config'}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
              >
                {mutatingKey === 'config' && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar configuração
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 p-5 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-200">
              <CircleDollarSign className="h-5 w-5" />
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em]">Assinaturas</p>
            </div>
            <h3 className="mt-1 text-lg font-extrabold text-white">Controle por workspace</h3>
            <p className="mt-1 text-xs text-slate-400">
              Confirmação de pagamento e suspensão são exclusivamente administrativas.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar UG, setor ou e-mail"
                className={`${inputClass} min-w-[250px] pl-9`}
              />
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className={inputClass}
            >
              <option value="all">Todos</option>
              <option value="trial">Trial</option>
              <option value="active">Em dia</option>
              <option value="pending">Pendentes</option>
              <option value="suspended">Suspensos comerciais</option>
              <option value="exempt">Isentos</option>
              <option value="canceled">Cancelados</option>
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {accountRows.map(({ account, workspace }) => {
            if (!workspace || !config) return null;

            const workspaceCycles = cyclesByWorkspace.get(account.workspaceId) || [];
            const attention = getBillingAttention(account, workspaceCycles, config);
            const currentCycle = attention.currentCycle;
            const busy = Boolean(mutatingKey?.includes(workspace.id));
            const isFounder = account.status === 'exempt';

            return (
              <article
                key={account.workspaceId}
                className="rounded-2xl border border-white/[0.07] bg-slate-950/20 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-extrabold text-white">{workspace.name}</h4>
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.10em] ${statusTone(account.status)}`}>
                        {STATUS_LABEL[account.status]}
                      </span>
                      {attention.needsAttention && (
                        <span className="rounded-full border border-amber-300/20 bg-amber-400/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.10em] text-amber-100">
                          revisar pagamento
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      UG {workspace.ug || '—'} · {workspace.authorizedEmail}
                    </p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <MiniInfo
                        label="Trial"
                        value={
                          account.trialGranted
                            ? attention.trialExpired
                              ? 'Encerrado'
                              : `${attention.trialDaysRemaining ?? 0} dia(s) restante(s)`
                            : 'Não concedido'
                        }
                      />
                      <MiniInfo label="Vencimento do mês" value={dateLabel(attention.dueDate)} />
                      <MiniInfo
                        label="Competência atual"
                        value={
                          currentCycle?.status === 'paid'
                            ? 'Pagamento confirmado'
                            : currentCycle?.status === 'waived'
                              ? 'Dispensada'
                              : attention.needsAttention
                                ? `Pendente há ${attention.overdueDays} dia(s)`
                                : 'Sem pendência'
                        }
                      />
                      <MiniInfo label="Tolerância até" value={dateLabel(attention.graceEndsAt)} />
                    </div>
                  </div>

                  {!isFounder && (
                    <div className="flex flex-wrap gap-2 xl:max-w-[520px] xl:justify-end">
                      <ActionButton
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        label={account.status === 'trial' ? 'Renovar trial 30d' : 'Conceder trial'}
                        busy={mutatingKey === `trial:${workspace.id}`}
                        disabled={busy}
                        onClick={() => void onGrantTrial(workspace, config.defaultTrialDays)}
                      />
                      {currentCycle?.status === 'paid' ? (
                        <ActionButton
                          icon={<Clock3 className="h-3.5 w-3.5" />}
                          label="Reabrir mês"
                          busy={mutatingKey === `cycle:${workspace.id}:${attention.referenceMonth}`}
                          disabled={busy}
                          onClick={() => void onSetCycleStatus(workspace, attention.referenceMonth, 'pending')}
                        />
                      ) : (
                        <ActionButton
                          icon={<BadgeCheck className="h-3.5 w-3.5" />}
                          label="Confirmar pagamento"
                          busy={mutatingKey === `cycle:${workspace.id}:${attention.referenceMonth}`}
                          disabled={busy}
                          onClick={() => void onSetCycleStatus(workspace, attention.referenceMonth, 'paid')}
                        />
                      )}
                      {account.status === 'suspended' ? (
                        <ActionButton
                          icon={<PlayCircle className="h-3.5 w-3.5" />}
                          label="Regularizar status"
                          busy={mutatingKey === `status:${workspace.id}`}
                          disabled={busy}
                          onClick={() => void onSetStatus(workspace, 'active')}
                        />
                      ) : (
                        <ActionButton
                          icon={<PauseCircle className="h-3.5 w-3.5" />}
                          label="Suspender comercial"
                          busy={mutatingKey === `status:${workspace.id}`}
                          disabled={busy}
                          onClick={() => void onSetStatus(workspace, 'suspended')}
                        />
                      )}
                    </div>
                  )}
                </div>

                {account.trialGranted && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/[0.05] pt-3 text-[10px] text-slate-500">
                    <span>Trial iniciado: {dateLabel(account.trialStartedAt)}</span>
                    <span>Trial termina: {dateLabel(account.trialEndsAt)}</span>
                    <span>Mensalidade prevista: {money(account.monthlyPriceCents)}</span>
                    <span className="text-blue-300/70">Acesso operacional não é afetado nesta fase.</span>
                  </div>
                )}
              </article>
            );
          })}

          {accountRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.10] px-5 py-10 text-center text-sm text-slate-500">
              Nenhuma assinatura corresponde ao filtro atual.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BillingMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/[0.08] bg-[#071225]/60 p-5 backdrop-blur-xl">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/15 bg-blue-400/[0.07] text-blue-200">
        {icon}
      </div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-950/20 px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-slate-100">{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.10em] text-slate-600">{label}</p>
      <p className="mt-0.5 text-[11px] font-bold text-slate-300">{value}</p>
    </div>
  );
}

function ConfigField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-300">{label}</span>
        {hint && <span className="text-[9px] text-slate-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function ActionButton({
  icon,
  label,
  busy,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[10px] font-extrabold text-slate-300 transition hover:border-blue-300/15 hover:bg-blue-400/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-45"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-slate-950/30 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/10';
