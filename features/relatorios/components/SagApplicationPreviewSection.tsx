'use client';

import React from 'react';
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Eye,
  ListFilter,
  MinusCircle,
  PencilLine,
  ShieldCheck,
} from 'lucide-react';

import type {
  SagNsApplicationDecision,
  SagNsApplicationPreview,
  SagNsApplicationPreviewItem,
} from '../../../lib/sagNsApplicationPreview';

export type SagPreviewFilter = 'all' | SagNsApplicationDecision;

const APPLICATION_DECISION_META: Record<
  SagNsApplicationDecision,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  }
> = {
  change: {
    label: 'ALTERAR',
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    icon: PencilLine,
  },
  unchanged: {
    label: 'SEM ALTERAÇÃO',
    className: 'border-blue-100 bg-blue-50 text-blue-700',
    icon: CheckCircle2,
  },
  ignored: {
    label: 'IGNORAR',
    className: 'border-gray-200 bg-gray-50 text-gray-600',
    icon: MinusCircle,
  },
  blocked: {
    label: 'BLOQUEAR',
    className: 'border-rose-100 bg-rose-50 text-rose-700',
    icon: Ban,
  },
};

interface SagApplicationPreviewSectionProps {
  applicationPreview: SagNsApplicationPreview;
  filteredPreviewItems: SagNsApplicationPreviewItem[];
  previewFilter: SagPreviewFilter;
  onPreviewFilterChange: (filter: SagPreviewFilter) => void;
  onOpenApplyConfirmation: () => void;
}

export function SagApplicationPreviewSection({
  applicationPreview,
  filteredPreviewItems,
  previewFilter,
  onPreviewFilterChange,
  onOpenApplyConfirmation,
}: SagApplicationPreviewSectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <div className="border-b border-sky-100 bg-sky-50/50 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sky-100 text-sky-700">
              <Eye className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-sky-700">
                Prévia final do lote
              </p>
              <h4 className="mt-1 text-base font-black text-[#0b1c30]">O que aconteceria com este lote</h4>
              <p className="mt-1 max-w-3xl text-xs font-medium leading-relaxed text-gray-500">
                Esta visão transforma a conciliação em um plano legível antes de qualquer escrita:
                alterações propostas, registros já corretos, itens ignorados e bloqueios.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-sky-100 bg-white px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-sky-700">
            Prévia — nada será gravado
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ['Alterar', applicationPreview.stats.changes, 'text-emerald-700'],
            ['Sem alteração', applicationPreview.stats.unchanged, 'text-blue-700'],
            ['Ignorar', applicationPreview.stats.ignored, 'text-gray-700'],
            ['Bloqueados', applicationPreview.stats.blocked, 'text-rose-700'],
            ['Com alertas', applicationPreview.stats.warningItems, 'text-amber-700'],
          ].map(([label, value, valueClass]) => (
            <div key={String(label)} className="rounded-xl border border-white bg-white px-3 py-3 shadow-sm">
              <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">{label}</p>
              <p className={`mt-1 text-lg font-black ${valueClass}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <ListFilter className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Filtrar prévia</span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros da prévia SAG">
            {[
              ['all', 'Todos', applicationPreview.stats.total],
              ['change', 'Alterar', applicationPreview.stats.changes],
              ['blocked', 'Bloqueados', applicationPreview.stats.blocked],
              ['unchanged', 'Sem alteração', applicationPreview.stats.unchanged],
              ['ignored', 'Ignorar', applicationPreview.stats.ignored],
            ].map(([filter, label, count]) => {
              const active = previewFilter === filter;
              return (
                <button
                  key={String(filter)}
                  type="button"
                  onClick={() => onPreviewFilterChange(filter as SagPreviewFilter)}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-extrabold transition ${
                    active
                      ? 'border-[#00288e] bg-[#00288e] text-white'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200 hover:text-[#00288e]'
                  }`}
                >
                  {label} · {count}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filteredPreviewItems.length > 0 ? (
        <div className="space-y-3 p-4 lg:hidden">
          {filteredPreviewItems.map((item, index) => {
            const meta = APPLICATION_DECISION_META[item.decision];
            const DecisionIcon = meta.icon;

            return (
              <article
                key={`mobile-${item.ns}-${index}`}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#00288e]">
                      {item.invoiceId
                        ? `NF ${item.invoiceId}`
                        : item.nfNumberRaw
                          ? `NF ${item.nfNumberRaw}`
                          : 'NF não identificada'}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] font-bold text-gray-400">
                      {item.empenhoId || 'Sem NE vinculada'}
                    </p>
                  </div>
                  <span className={`inline-flex flex-none items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-extrabold ${meta.className}`}>
                    <DecisionIcon className="h-3.5 w-3.5" aria-hidden={true} />
                    {meta.label}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-gray-50 p-3">
                  <div>
                    <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">NS atual</p>
                    <p className="mt-1 break-all font-mono text-[10px] font-bold text-gray-600">
                      {item.currentNs || 'Sem NS'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300" aria-hidden="true" />
                  <div>
                    <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">NS proposta</p>
                    <p className="mt-1 break-all font-mono text-[10px] font-black text-emerald-700">
                      {item.proposedNs || 'Nenhuma'}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[10px] font-semibold leading-relaxed text-gray-600">{item.summary}</p>

                {item.blockers.length > 0 ? (
                  <div className="mt-3 space-y-1.5 rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                    {item.blockers.map((message, blockerIndex) => (
                      <p key={blockerIndex} className="text-[10px] font-semibold leading-relaxed text-rose-700">
                        {message}
                      </p>
                    ))}
                  </div>
                ) : item.warnings.length > 0 ? (
                  <div className="mt-3 space-y-1.5 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                    {item.warnings.map((message, warningIndex) => (
                      <p key={warningIndex} className="text-[10px] font-semibold leading-relaxed text-amber-700">
                        {message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-xs font-extrabold text-gray-500">Nenhum item neste filtro</p>
          <p className="mt-1 text-[10px] font-medium text-gray-400">Escolha outra categoria para continuar a conferência.</p>
        </div>
      )}

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[9px] uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3 font-extrabold">Decisão</th>
              <th className="px-4 py-3 font-extrabold">NF</th>
              <th className="px-4 py-3 font-extrabold">NE</th>
              <th className="px-4 py-3 font-extrabold">NS atual</th>
              <th className="px-4 py-3 font-extrabold">NS proposta</th>
              <th className="px-4 py-3 font-extrabold">Efeito</th>
              <th className="px-4 py-3 font-extrabold">Alertas / bloqueios</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredPreviewItems.map((item, index) => {
              const meta = APPLICATION_DECISION_META[item.decision];
              const DecisionIcon = meta.icon;

              return (
                <tr key={`${item.ns}-${index}`} className="align-top hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-extrabold ${meta.className}`}>
                      <DecisionIcon className="h-3.5 w-3.5" aria-hidden={true} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-black text-[#00288e]">
                    {item.invoiceId
                      ? `NF ${item.invoiceId}`
                      : item.nfNumberRaw
                        ? `NF ${item.nfNumberRaw}`
                        : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] font-bold text-gray-600">
                    {item.empenhoId || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {item.currentNs ? (
                      <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[9px] font-bold text-gray-700">
                        {item.currentNs}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-gray-400">Sem NS</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.proposedNs ? (
                      <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 font-mono text-[9px] font-black text-emerald-700">
                        {item.proposedNs}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-gray-400">Nenhuma</span>
                    )}
                  </td>
                  <td className="max-w-sm px-4 py-3 text-[10px] font-semibold leading-relaxed text-gray-600">
                    {item.summary}
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    {item.blockers.length > 0 ? (
                      <div className="space-y-1.5">
                        {item.blockers.map((message, blockerIndex) => (
                          <p key={blockerIndex} className="text-[10px] font-semibold leading-relaxed text-rose-700">
                            {message}
                          </p>
                        ))}
                      </div>
                    ) : item.warnings.length > 0 ? (
                      <div className="space-y-1.5">
                        {item.warnings.map((message, warningIndex) => (
                          <p key={warningIndex} className="text-[10px] font-semibold leading-relaxed text-amber-700">
                            {message}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Sem ressalvas adicionais
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className={`border-t px-5 py-4 ${
          applicationPreview.stats.blocked > 0
            ? 'border-rose-100 bg-rose-50/50'
            : applicationPreview.canAdvanceToPersistenceReview
              ? 'border-emerald-100 bg-emerald-50/50'
              : 'border-gray-100 bg-gray-50/70'
        }`}
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p
              className={`text-xs font-black ${
                applicationPreview.stats.blocked > 0
                  ? 'text-rose-800'
                  : applicationPreview.canAdvanceToPersistenceReview
                    ? 'text-emerald-800'
                    : 'text-gray-700'
              }`}
            >
              {applicationPreview.stats.blocked > 0
                ? 'Lote com bloqueios: não pode avançar para persistência.'
                : applicationPreview.canAdvanceToPersistenceReview
                  ? 'Lote sem bloqueios e com alterações propostas.'
                  : 'Lote sem alterações pendentes para gravar.'}
            </p>
            <p className="mt-1 text-[10px] font-semibold leading-relaxed text-gray-500">
              Antes da escrita, o EMPROVEX refaz a conciliação e a transação relê NF, NE, CNPJ e NS diretamente do Firestore.
            </p>
          </div>
          {applicationPreview.canAdvanceToPersistenceReview ? (
            <button
              type="button"
              onClick={onOpenApplyConfirmation}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-[10px] font-extrabold text-white shadow-sm transition hover:bg-[#001f70]"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Revisar gravação de {applicationPreview.stats.changes} NS
            </button>
          ) : (
            <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-gray-600">
              Gravação indisponível
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
