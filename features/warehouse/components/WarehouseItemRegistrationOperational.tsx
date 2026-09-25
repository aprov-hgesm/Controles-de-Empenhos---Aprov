'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  PackagePlus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import type { WarehouseItemIntakeListItem } from '../../../lib/warehouse/intake';
import {
  listWarehouseItemIntakes,
  markWarehouseImmediateConsumptionPosted,
} from '../../../lib/warehouse/intakeRepository';
import type { WarehouseItemIntakeEffectiveStatus } from '../../../lib/warehouse/intakeState';
import {
  loadWarehouseInvoiceIntakeQueue,
  type WarehouseInvoiceIntakeQueueContext,
  type WarehouseInvoiceIntakeQueueRow,
} from '../../../lib/warehouse/intakeStateRepository';
import { WarehouseSiscofisOperational } from './WarehouseSiscofisOperational';

type RegistrationTab = 'invoices' | 'siscofis' | 'immediate';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleDateString('pt-BR');
}

function formatQuantity(value: number, unitLabel: string): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
    + (unitLabel ? ' ' + unitLabel : '');
}

function intakeStatusLabel(status: WarehouseItemIntakeEffectiveStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pendente';
    case 'PARTIALLY_PROCESSED':
      return 'Parcialmente tratado';
    case 'PROCESSED':
      return 'Tratado';
    case 'RECONCILIATION_REQUIRED':
      return 'Reconciliação necessária';
  }
}

function intakeStatusClass(status: WarehouseItemIntakeEffectiveStatus): string {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-700';
    case 'PARTIALLY_PROCESSED':
      return 'bg-blue-100 text-blue-700';
    case 'PROCESSED':
      return 'bg-emerald-100 text-emerald-700';
    case 'RECONCILIATION_REQUIRED':
      return 'bg-rose-100 text-rose-700';
  }
}

function reconciliationMessage(row: WarehouseInvoiceIntakeQueueRow): string | null {
  switch (row.reconciliationReason) {
    case 'CANONICAL_QUANTITY_CHANGED':
      return 'A quantidade atual da NF diverge do estado logístico preservado. Nenhuma correção foi aplicada automaticamente.';
    case 'CANONICAL_SOURCE_MISSING':
      return 'A NF ou o item não está mais presente na fonte canônica consultada. O histórico warehouse foi preservado sem compensação automática.';
    case 'LEGACY_INVOICE_PROJECTION':
      return 'Existe projeção logística legada para este item, mas não há estado de tratamento compatível com o novo motor. Revisão será necessária antes de nova movimentação.';
    default:
      return null;
  }
}

function InvoiceRegistrationQueue({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] =
    useState<WarehouseInvoiceIntakeQueueContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setContext(await loadWarehouseInvoiceIntakeQueue(workspaceId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Falha ao consultar as pendências das Notas Fiscais.'
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = context?.rows || [];
  const summary = useMemo(() => ({
    pending: rows.filter((row) => row.status === 'PENDING').length,
    partial: rows.filter((row) => row.status === 'PARTIALLY_PROCESSED').length,
    processed: rows.filter((row) => row.status === 'PROCESSED').length,
    reconciliation: rows.filter(
      (row) => row.status === 'RECONCILIATION_REQUIRED'
    ).length,
  }), [rows]);

  const explainFutureAction = (
    action: 'ALLOCATE' | 'IMMEDIATE',
    row: WarehouseInvoiceIntakeQueueRow
  ) => {
    if (row.status === 'RECONCILIATION_REQUIRED') {
      setMessage(
        'Este item exige reconciliação antes de qualquer nova classificação logística.'
      );
      return;
    }

    setMessage(
      action === 'ALLOCATE'
        ? 'A identidade e a pendência deste item já estão preparadas. A alocação física será habilitada no Módulo 2; nenhuma movimentação foi executada agora.'
        : 'A pendência está preparada para tratamento parcial. A classificação operacional de consumo imediato será habilitada em módulo posterior; nenhuma quantidade foi alterada agora.'
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-500">
            Itens de NF
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">{rows.length}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            lidos do EMPROVEX em modo somente leitura
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-600">
            Pendentes
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.pending}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">nenhuma quantidade tratada</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-white p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">
            Parciais
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.partial}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">ainda possuem saldo de tratamento</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600">
            Tratados
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.processed}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">pendência logística zerada</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-rose-600">
            Reconciliação
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.reconciliation}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">fonte canônica divergente ou legado</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <ClipboardList className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Fila de Notas Fiscais
              </p>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              Cada item recebido possui identidade logística estável. O motor distingue
              recebido, alocado, consumo imediato e pendente sem escrever de volta na NF.
            </p>
            <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-400">
              A ausência de documento warehouse representa o estado inicial Pendente.
              A persistência versionada começa quando houver tratamento logístico.
            </p>
            {context?.cutoffAt && (
              <p className="mt-1 text-[9px] font-semibold text-slate-400">
                Corte logístico preservado: {new Date(context.cutoffAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Atualizar
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-700">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">
            Consultando NFs e estados logísticos…
          </p>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Nenhum item de NF elegível encontrado na janela consultada.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((row) => {
              const reconciliation = reconciliationMessage(row);
              const canContinue =
                row.status === 'PENDING'
                || row.status === 'PARTIALLY_PROCESSED';

              return (
                <div
                  key={row.stateId}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              'rounded-full px-2 py-1 text-[9px] font-black uppercase '
                              + intakeStatusClass(row.status)
                            }
                          >
                            {intakeStatusLabel(row.status)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            NF {row.invoiceId} · {formatDate(row.issueDate)}
                          </span>
                          {!row.persisted && row.status === 'PENDING' && (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[8px] font-black uppercase text-slate-400">
                              estado inicial derivado
                            </span>
                          )}
                        </div>

                        <p className="mt-2 truncate text-sm font-black text-slate-800">
                          {row.itemName}
                        </p>
                        <div className="mt-2 grid gap-1 text-[10px] text-slate-500 sm:grid-cols-2">
                          <p>
                            <span className="font-black text-slate-600">Fornecedor:</span>{' '}
                            {row.supplier}
                          </p>
                          <p>
                            <span className="font-black text-slate-600">Empenho:</span>{' '}
                            {row.empenhoId}
                          </p>
                          <p>
                            <span className="font-black text-slate-600">Material:</span>{' '}
                            {row.itemName}
                          </p>
                          <p>
                            <span className="font-black text-slate-600">ID material:</span>{' '}
                            {row.materialId || 'a resolver'}
                          </p>
                        </div>
                      </div>

                      {canContinue && (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => explainFutureAction('ALLOCATE', row)}
                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                            Alocar no depósito
                          </button>
                          <button
                            type="button"
                            onClick={() => explainFutureAction('IMMEDIATE', row)}
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[10px] font-black text-violet-700"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Consumo imediato
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Recebido
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {formatQuantity(row.receivedQuantity, row.unitLabel)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Alocado
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {formatQuantity(row.allocatedQuantity, row.unitLabel)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Consumo imediato
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {formatQuantity(row.immediateConsumptionQuantity, row.unitLabel)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-amber-600">
                          Pendente
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {formatQuantity(row.pendingQuantity, row.unitLabel)}
                        </p>
                      </div>
                    </div>

                    {reconciliation && (
                      <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] leading-5 text-rose-700">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {reconciliation}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {context?.truncated && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A consulta atingiu um limite bounded. O motor não conclui sobre registros fora da janela carregada.
          </div>
        )}

        {context?.reconciliationCoverageLimited && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] leading-5 text-slate-600">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Como a janela canônica de NFs está limitada, ausência de NF fora dessa janela não é interpretada como exclusão.
          </div>
        )}
      </div>
    </div>
  );
}

function ImmediateConsumptionReport({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<WarehouseItemIntakeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listWarehouseItemIntakes(workspaceId, 500);
      setItems(all.filter((entry) => entry.intake.mode === 'IMMEDIATE_CONSUMPTION'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pending = items.filter((entry) => entry.intake.siscofisStatus === 'PENDING');

  const copyReport = async () => {
    const lines = [
      'EMPROVEX · ADM Depósito · Consumo imediato para lançamento no SISCOFIS',
      '',
      ...pending.map(({ intake }) =>
        [
          'NF ' + intake.invoiceId,
          'Empenho ' + intake.empenhoId,
          intake.description,
          intake.quantity.toLocaleString('pt-BR') + ' ' + intake.unitLabel,
        ].join(' · ')
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setMessage('Relatório pendente copiado.');
    } catch {
      setMessage('Não foi possível copiar o relatório automaticamente.');
    }
  };

  const markPosted = async (id: string) => {
    setWorkingId(id);
    setMessage(null);
    try {
      await markWarehouseImmediateConsumptionPosted(workspaceId, id);
      setMessage('Item marcado como lançado no SISCOFIS.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao atualizar o registro.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-700">
              <ClipboardCheck className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Relatório para lançamento no SISCOFIS
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Itens classificados como consumo imediato não entram no depósito. Eles permanecem
              nesta fila até o operador registrar a movimentação correspondente no SISCOFIS.
            </p>
          </div>
          <button
            type="button"
            onClick={copyReport}
            disabled={!pending.length}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-xs font-black text-violet-700 disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar pendências
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-black uppercase text-slate-400">Pendentes</p>
            <p className="mt-1 text-xl font-black text-slate-900">{pending.length}</p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-black uppercase text-slate-400">Já lançados</p>
            <p className="mt-1 text-xl font-black text-slate-900">{items.length - pending.length}</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-slate-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Carregando relatório…
        </div>
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-400">
          Nenhum item classificado como consumo imediato.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(({ intake, createdAt }) => (
            <div
              key={intake.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      intake.siscofisStatus === 'PENDING'
                        ? 'rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700'
                        : 'rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700'
                    }
                  >
                    {intake.siscofisStatus === 'PENDING' ? 'A lançar' : 'Lançado'}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    NF {intake.invoiceId} · {createdAt ? new Date(createdAt).toLocaleString('pt-BR') : 'registro atual'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-slate-800">{intake.description}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Empenho {intake.empenhoId} · {intake.quantity.toLocaleString('pt-BR')} {intake.unitLabel}
                </p>
              </div>
              {intake.siscofisStatus === 'PENDING' && (
                <button
                  type="button"
                  disabled={workingId === intake.id}
                  onClick={() => void markPosted(intake.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white disabled:opacity-50"
                >
                  {workingId === intake.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Marcar como lançado
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WarehouseItemRegistrationOperational({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('aba');
  const requestedTab: RegistrationTab =
    requested === 'siscofis'
      ? 'siscofis'
      : requested === 'consumo-imediato'
        ? 'immediate'
        : 'invoices';
  const [tab, setTab] = useState<RegistrationTab>(requestedTab);

  useEffect(() => {
    setTab(requestedTab);
  }, [requestedTab]);

  return (
    <div className="mt-4 space-y-5" data-testid="warehouse-registration-operational">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('invoices')}
          className={
            tab === 'invoices'
              ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm'
              : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'
          }
        >
          Notas Fiscais pendentes
        </button>
        <button
          type="button"
          onClick={() => setTab('siscofis')}
          className={
            tab === 'siscofis'
              ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm'
              : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'
          }
        >
          Migração SISCOFIS
        </button>
        <button
          type="button"
          onClick={() => setTab('immediate')}
          className={
            tab === 'immediate'
              ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm'
              : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'
          }
        >
          Consumo imediato / SISCOFIS
        </button>
      </div>

      {tab === 'invoices' && <InvoiceRegistrationQueue workspaceId={workspaceId} />}
      {tab === 'siscofis' && <WarehouseSiscofisOperational workspaceId={workspaceId} />}
      {tab === 'immediate' && <ImmediateConsumptionReport workspaceId={workspaceId} />}
    </div>
  );
}
