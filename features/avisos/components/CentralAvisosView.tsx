'use client';

import { useMemo, useState } from 'react';
import {
  Archive,
  BellRing,
  Check,
  CheckCheck,
  CircleAlert,
  ExternalLink,
  Info,
  RotateCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';

import type { Alert, AlertStatus, Empenho } from '../../../lib/types';
import {
  getNoticeSeverity,
  getNoticeSortTimestamp,
  getNoticeStatus,
  isNoticePending,
  isNoticeUnread,
  isNoticeVisibleInActiveQueue,
  type NoticeSeverity,
} from '../domain/noticeLifecycle';

type SeverityFilter = 'TODOS' | NoticeSeverity;
type StatusFilter = 'ATIVOS' | 'TODOS' | AlertStatus;

interface CentralAvisosViewProps {
  alerts: Alert[];
  empenhos: Empenho[];
  onUpdateStatus: (alert: Alert, status: AlertStatus) => Promise<boolean>;
  onMarkAllRead: () => Promise<void>;
  onOpenEmpenho: (empenhoId: string) => void;
}

function statusLabel(status: AlertStatus): string {
  switch (status) {
    case 'NOVO': return 'Novo';
    case 'LIDO': return 'Lido';
    case 'RESOLVIDO': return 'Resolvido';
    case 'ARQUIVADO': return 'Arquivado';
  }
}

function severityPresentation(severity: NoticeSeverity) {
  switch (severity) {
    case 'CRÍTICO':
      return {
        label: 'Crítico',
        icon: ShieldAlert,
        badge: 'border-rose-200 bg-rose-50 text-rose-700',
        rail: 'bg-rose-500',
      };
    case 'ATENÇÃO':
      return {
        label: 'Atenção',
        icon: CircleAlert,
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
        rail: 'bg-amber-400',
      };
    default:
      return {
        label: 'Informativo',
        icon: Info,
        badge: 'border-sky-200 bg-sky-50 text-sky-700',
        rail: 'bg-sky-400',
      };
  }
}

function formatNoticeDate(alert: Alert): string {
  if (alert.createdAt) {
    const date = new Date(alert.createdAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return alert.date || 'Data não informada';
}

export function CentralAvisosView({
  alerts,
  empenhos,
  onUpdateStatus,
  onMarkAllRead,
  onOpenEmpenho,
}: CentralAvisosViewProps) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ATIVOS');

  const empenhoById = useMemo(
    () => new Map(empenhos.map((empenho) => [empenho.id, empenho])),
    [empenhos]
  );

  const summary = useMemo(() => ({
    total: alerts.length,
    unread: alerts.filter(isNoticeUnread).length,
    pending: alerts.filter(isNoticePending).length,
    critical: alerts.filter((alert) =>
      getNoticeSeverity(alert) === 'CRÍTICO'
      && getNoticeStatus(alert) !== 'RESOLVIDO'
      && getNoticeStatus(alert) !== 'ARQUIVADO'
    ).length,
  }), [alerts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');

    return [...alerts]
      .sort((left, right) => getNoticeSortTimestamp(right) - getNoticeSortTimestamp(left))
      .filter((alert) => {
        const severity = getNoticeSeverity(alert);
        const status = getNoticeStatus(alert);
        const empenho = alert.empenhoId ? empenhoById.get(alert.empenhoId) : undefined;

        if (severityFilter !== 'TODOS' && severity !== severityFilter) return false;

        if (statusFilter === 'ATIVOS') {
          if (!isNoticeVisibleInActiveQueue(alert)) return false;
        } else if (statusFilter !== 'TODOS' && status !== statusFilter) {
          return false;
        }

        if (!query) return true;

        const haystack = [
          alert.title,
          alert.subtitle,
          alert.description,
          alert.empenhoId,
          empenho?.supplier,
          empenho?.supplierCnpj,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('pt-BR');

        return haystack.includes(query);
      });
  }, [alerts, empenhoById, search, severityFilter, statusFilter]);

  return (
    <section className="space-y-6" data-testid="central-avisos-view">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#00288e]">
              <BellRing className="h-4 w-4" aria-hidden="true" />
              Monitoramento operacional
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Central de Avisos
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
              Consulte informações do sistema, acompanhe ocorrências que exigem atenção
              e mantenha o histórico organizado sem perder o vínculo com os empenhos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onMarkAllRead()}
            disabled={summary.unread === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-extrabold text-[#00288e] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Marcar novos como lidos
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Pendentes', value: summary.pending, helper: 'atenção + críticos ativos' },
          { label: 'Novos', value: summary.unread, helper: 'ainda não lidos' },
          { label: 'Críticos', value: summary.critical, helper: 'exigem prioridade' },
          { label: 'Histórico', value: summary.total, helper: 'todos os registros' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-950">{item.value}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">{item.helper}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por aviso, empenho, fornecedor ou CNPJ..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
            />
          </label>

          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
            aria-label="Filtrar avisos por severidade"
          >
            <option value="TODOS">Todas as categorias</option>
            <option value="CRÍTICO">Críticos</option>
            <option value="ATENÇÃO">Atenção</option>
            <option value="INFORMATIVO">Informativos</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300"
            aria-label="Filtrar avisos por situação"
          >
            <option value="ATIVOS">Ativos</option>
            <option value="NOVO">Novos</option>
            <option value="LIDO">Lidos</option>
            <option value="RESOLVIDO">Resolvidos</option>
            <option value="ARQUIVADO">Arquivados</option>
            <option value="TODOS">Todos</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <BellRing className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-extrabold text-slate-600">
              Nenhum aviso encontrado com os filtros atuais.
            </p>
          </div>
        ) : (
          filtered.map((alert) => {
            const severity = getNoticeSeverity(alert);
            const presentation = severityPresentation(severity);
            const SeverityIcon = presentation.icon;
            const status = getNoticeStatus(alert);
            const empenho = alert.empenhoId ? empenhoById.get(alert.empenhoId) : undefined;
            const pending = isNoticePending(alert);

            return (
              <article
                key={alert.id}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                data-notice-status={status}
                data-notice-severity={severity}
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${presentation.rail}`} aria-hidden="true" />

                <div className="p-5 pl-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${presentation.badge}`}>
                          <SeverityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          {presentation.label}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                          {statusLabel(status)}
                        </span>
                        {pending && (
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-violet-700">
                            Pendente
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 text-base font-black text-slate-900">{alert.title}</h2>
                      <p className="mt-1 text-xs font-bold text-slate-500">{alert.subtitle}</p>
                      <p className="mt-3 max-w-4xl text-sm font-medium leading-6 text-slate-600">
                        {alert.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-400">
                        <span>{formatNoticeDate(alert)}</span>
                        {alert.empenhoId && <span>Empenho {alert.empenhoId}</span>}
                        {empenho?.supplier && <span>{empenho.supplier}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:max-w-[360px] xl:justify-end">
                      {status === 'NOVO' && (
                        <button
                          type="button"
                          onClick={() => void onUpdateStatus(alert, 'LIDO')}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-extrabold text-slate-600 transition hover:bg-slate-50"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Marcar lido
                        </button>
                      )}

                      {severity !== 'INFORMATIVO' && status !== 'RESOLVIDO' && status !== 'ARQUIVADO' && (
                        <button
                          type="button"
                          onClick={() => void onUpdateStatus(alert, 'RESOLVIDO')}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-extrabold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Resolver
                        </button>
                      )}

                      {(status === 'RESOLVIDO' || status === 'ARQUIVADO') && (
                        <button
                          type="button"
                          onClick={() => void onUpdateStatus(alert, 'NOVO')}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-extrabold text-[#00288e] transition hover:bg-blue-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Reabrir
                        </button>
                      )}

                      {status !== 'ARQUIVADO' && (
                        <button
                          type="button"
                          onClick={() => void onUpdateStatus(alert, 'ARQUIVADO')}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-extrabold text-slate-500 transition hover:bg-slate-50"
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          Arquivar
                        </button>
                      )}

                      {alert.empenhoId && empenho && (
                        <button
                          type="button"
                          onClick={() => onOpenEmpenho(alert.empenhoId!)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#00288e] px-3 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-blue-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          Abrir empenho
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
