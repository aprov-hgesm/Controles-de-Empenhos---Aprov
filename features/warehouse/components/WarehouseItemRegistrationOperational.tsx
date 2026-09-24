'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Barcode,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  PackagePlus,
  RefreshCw,
  ScanLine,
  Sparkles,
  TriangleAlert,
  Warehouse,
} from 'lucide-react';

import type { Empenho, Invoice, Item } from '../../../lib/types';
import type { WarehouseItemIntakeListItem } from '../../../lib/warehouse/intake';
import {
  allocateWarehouseInvoiceItem,
  getWarehouseInvoiceIntakeCutoff,
  listWarehouseItemIntakes,
  markWarehouseImmediateConsumptionPosted,
  registerWarehouseImmediateConsumption,
} from '../../../lib/warehouse/intakeRepository';
import type {
  WarehouseDepotListItem,
  WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  listWarehouseDepots,
  listWarehouseLocations,
} from '../../../lib/warehouse/locationRepository';
import type { WarehouseStockPosition } from '../../../lib/warehouse/location';
import {
  loadWarehouseDeliveriesContext,
  type WarehouseDeliveriesContext,
} from '../../../lib/warehouse/logisticsRepository';
import { WarehouseSiscofisOperational } from './WarehouseSiscofisOperational';

type RegistrationTab = 'invoices' | 'siscofis' | 'immediate';
type IntakeDecision = 'ALLOCATED' | 'IMMEDIATE_CONSUMPTION';

interface RegistrationState {
  context: WarehouseDeliveriesContext | null;
  intakes: WarehouseItemIntakeListItem[];
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  cutoffAt: string | null;
}

interface InvoiceQueueRow {
  key: string;
  invoice: Invoice;
  empenho: Empenho | null;
  item: Item | null;
  itemId: string;
  quantity: number;
  intake: WarehouseItemIntakeListItem | null;
  legacyIntegrated: boolean;
}

interface IntakeDraft {
  decision: IntakeDecision;
  depotId: string;
  locationId: string;
  subpositionId: string;
  lotCode: string;
  expiresOn: string;
  noExpiry: boolean;
  barcode: string;
}

const EMPTY_STATE: RegistrationState = {
  context: null,
  intakes: [],
  depots: [],
  locations: [],
  cutoffAt: null,
};

function formatDate(value: string | undefined | null): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleDateString('pt-BR');
}

function recordKey(invoice: Invoice): string {
  return (invoice.recordKey || invoice.id || '').trim();
}

function invoiceItemKey(invoice: Invoice, itemId: string): string {
  return recordKey(invoice) + '|' + itemId;
}

function defaultDraft(depots: WarehouseDepotListItem[]): IntakeDraft {
  return {
    decision: 'ALLOCATED',
    depotId: depots.find((item) => item.depot.status === 'active')?.depot.id || '',
    locationId: '',
    subpositionId: '',
    lotCode: '',
    expiresOn: '',
    noExpiry: false,
    barcode: '',
  };
}

function positionFromDraft(draft: IntakeDraft): WarehouseStockPosition | null {
  if (!draft.depotId || !draft.locationId) return null;
  if (draft.subpositionId) {
    return {
      kind: 'SUBPOSITION',
      depotId: draft.depotId,
      locationId: draft.locationId,
      subpositionId: draft.subpositionId,
    };
  }
  return {
    kind: 'LOCATION',
    depotId: draft.depotId,
    locationId: draft.locationId,
    subpositionId: null,
  };
}

function InvoiceRegistrationQueue({ workspaceId }: { workspaceId: string }) {
  const [state, setState] = useState<RegistrationState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<IntakeDraft>(() => defaultDraft([]));
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [context, intakes, depots, locations, cutoffAt] = await Promise.all([
        loadWarehouseDeliveriesContext(workspaceId),
        listWarehouseItemIntakes(workspaceId, 500),
        listWarehouseDepots(workspaceId, 250),
        listWarehouseLocations(workspaceId, 500),
        getWarehouseInvoiceIntakeCutoff(workspaceId),
      ]);
      setState({ context, intakes, depots, locations, cutoffAt });
      setDraft((current) => ({
        ...current,
        depotId:
          current.depotId && depots.some(
            (item) => item.depot.id === current.depotId && item.depot.status === 'active'
          )
            ? current.depotId
            : depots.find((item) => item.depot.status === 'active')?.depot.id || '',
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao consultar as Notas Fiscais.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const intakeByKey = useMemo(
    () => new Map(
      state.intakes.map((entry) => [
        entry.intake.invoiceRecordKey + '|' + entry.intake.itemId,
        entry,
      ])
    ),
    [state.intakes]
  );

  const legacyMovementKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const movement of state.context?.movements || []) {
      const source = movement.source;
      if (source?.kind !== 'INVOICE') continue;
      for (const itemId of source.itemIds) {
        keys.add(source.invoiceRecordKey + '|' + itemId);
      }
    }
    return keys;
  }, [state.context]);

  const rows = useMemo<InvoiceQueueRow[]>(() => {
    if (!state.context) return [];
    const empenhoById = new Map(
      state.context.empenhos.map((empenho) => [empenho.id, empenho])
    );
    const cutoffMs = state.cutoffAt ? Date.parse(state.cutoffAt) : NaN;

    return state.context.invoices
      .filter((invoice) => {
        if (!Number.isFinite(cutoffMs)) return true;
        const registered = Date.parse(invoice.registeredAt || '');
        return Number.isFinite(registered) && registered >= cutoffMs;
      })
      .slice()
      .sort((left, right) =>
        (right.registeredAt || right.issueDate || '').localeCompare(
          left.registeredAt || left.issueDate || ''
        )
      )
      .flatMap((invoice) => {
        const empenho = empenhoById.get(invoice.empenhoId) || null;
        return invoice.items.map((invoiceItem) => {
          const key = invoiceItemKey(invoice, invoiceItem.itemId);
          return {
            key,
            invoice,
            empenho,
            item:
              empenho?.items.find((item) => item.id === invoiceItem.itemId) || null,
            itemId: invoiceItem.itemId,
            quantity: invoiceItem.quantity,
            intake: intakeByKey.get(key) || null,
            legacyIntegrated: !intakeByKey.has(key) && legacyMovementKeys.has(key),
          };
        });
      });
  }, [intakeByKey, legacyMovementKeys, state.context, state.cutoffAt]);

  const pendingRows = rows.filter((row) => !row.intake && !row.legacyIntegrated);
  const completedRows = rows.filter((row) => row.intake || row.legacyIntegrated);

  const activeDepots = state.depots.filter((item) => item.depot.status === 'active');
  const activeLocals = state.locations.filter(
    (item) =>
      item.location.status === 'active'
      && item.location.kind === 'LOCAL'
      && item.location.depotId === draft.depotId
  );
  const activeLevels = state.locations.filter(
    (item) =>
      item.location.status === 'active'
      && item.location.kind === 'SUBPOSITION'
      && item.location.depotId === draft.depotId
      && item.location.parentLocationId === draft.locationId
  );

  const openDecision = (row: InvoiceQueueRow, decision: IntakeDecision) => {
    setActiveKey(row.key);
    setDraft({
      ...defaultDraft(state.depots),
      decision,
    });
    setMessage(null);
  };

  const confirmDecision = async (row: InvoiceQueueRow) => {
    if (!row.empenho || !row.item) {
      setMessage('O item não pôde ser relacionado ao empenho de origem.');
      return;
    }
    setWorkingKey(row.key);
    setMessage(null);
    try {
      if (draft.decision === 'IMMEDIATE_CONSUMPTION') {
        await registerWarehouseImmediateConsumption(workspaceId, {
          invoice: row.invoice,
          empenho: row.empenho,
          itemId: row.itemId,
          barcode: draft.barcode || null,
        });
        setMessage(
          'Consumo imediato registrado. O item não entrou no estoque físico e foi enviado para a fila de lançamento SISCOFIS.'
        );
      } else {
        const position = positionFromDraft(draft);
        if (!position) {
          setMessage('Selecione depósito e estrutura/localização para a alocação.');
          return;
        }
        if (!draft.lotCode.trim()) {
          setMessage('Informe o lote do item.');
          return;
        }
        if (!draft.noExpiry && !draft.expiresOn) {
          setMessage('Informe a validade ou marque “sem validade”.');
          return;
        }

        await allocateWarehouseInvoiceItem(workspaceId, {
          invoice: row.invoice,
          empenho: row.empenho,
          itemId: row.itemId,
          position,
          lotCode: draft.lotCode,
          expiresOn: draft.noExpiry ? null : draft.expiresOn,
          barcode: draft.barcode || null,
        });
        setMessage('Item alocado no depósito com lote, validade e posição física registrados.');
      }
      setActiveKey(null);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao concluir o tratamento logístico.');
    } finally {
      setWorkingKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-500">Itens de NF</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{rows.length}</p>
          <p className="mt-1 text-[10px] text-slate-500">lidos do EMPROVEX, sem duplicar a Nota Fiscal</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-600">Pendentes</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{pendingRows.length}</p>
          <p className="mt-1 text-[10px] text-slate-500">aguardando alocação ou consumo imediato</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600">Tratados</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{completedRows.length}</p>
          <p className="mt-1 text-[10px] text-slate-500">decisão logística já registrada</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <ClipboardList className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">Fila de Notas Fiscais</p>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              Cada item de NF elegível aparece aqui. O operador decide se entra fisicamente
              no depósito ou se segue como consumo imediato para o relatório SISCOFIS.
            </p>
            {state.cutoffAt && (
              <p className="mt-1 text-[9px] font-semibold text-slate-400">
                Corte logístico: {new Date(state.cutoffAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Atualizar
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-slate-700">
            {message}
          </div>
        )}

        {loading && !state.context ? (
          <p className="mt-5 text-sm text-slate-500">Consultando NFs, empenhos e decisões logísticas…</p>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Nenhum item de NF elegível encontrado na janela consultada.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((row) => {
              const completed = Boolean(row.intake || row.legacyIntegrated);
              const intake = row.intake?.intake || null;
              const open = activeKey === row.key;

              return (
                <div
                  key={row.key}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            completed
                              ? 'rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700'
                              : 'rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700'
                          }
                        >
                          {intake
                            ? intake.mode === 'ALLOCATED'
                              ? 'Alocado'
                              : 'Consumo imediato'
                            : row.legacyIntegrated
                              ? 'Integrado anteriormente'
                              : 'Pendente'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          NF {row.invoice.id} · {formatDate(row.invoice.issueDate)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-black text-slate-800">
                        {row.item?.name || 'Item ' + row.itemId}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {row.invoice.supplier} · Empenho {row.invoice.empenhoId}
                      </p>
                      {intake?.mode === 'ALLOCATED' && (
                        <p className="mt-2 text-[10px] font-semibold text-[#00288e]">
                          Lote {intake.lotCode} · validade {formatDate(intake.expiresOn)} · posição física registrada
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Quantidade</p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {row.quantity.toLocaleString('pt-BR')} {row.item?.unit || ''}
                        </p>
                      </div>
                      {!completed && (
                        <>
                          <button
                            type="button"
                            onClick={() => openDecision(row, 'ALLOCATED')}
                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                            Alocar
                          </button>
                          <button
                            type="button"
                            onClick={() => openDecision(row, 'IMMEDIATE_CONSUMPTION')}
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[10px] font-black text-violet-700"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Consumo imediato
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {open && !completed && (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-slate-800">
                            {draft.decision === 'ALLOCATED'
                              ? 'Alocação física do item'
                              : 'Consumo imediato'}
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-slate-400">
                            {draft.decision === 'ALLOCATED'
                              ? 'Defina depósito, estrutura, nível, lote, validade e código de barras.'
                              : 'Nenhum saldo será inserido no depósito. A quantidade irá para o relatório de lançamento no SISCOFIS.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveKey(null)}
                          className="text-[10px] font-black uppercase text-slate-400"
                        >
                          Fechar
                        </button>
                      </div>

                      {draft.decision === 'ALLOCATED' ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Depósito
                            <select
                              value={draft.depotId}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  depotId: event.target.value,
                                  locationId: '',
                                  subpositionId: '',
                                })
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                            >
                              <option value="">Selecione…</option>
                              {activeDepots.map(({ depot }) => (
                                <option key={depot.id} value={depot.id}>
                                  {depot.code} · {depot.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Estrutura / localização
                            <select
                              value={draft.locationId}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  locationId: event.target.value,
                                  subpositionId: '',
                                })
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                            >
                              <option value="">Selecione…</option>
                              {activeLocals.map(({ location }) => (
                                <option key={location.id} value={location.id}>
                                  {location.code} · {location.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Nível / subposição
                            <select
                              value={draft.subpositionId}
                              onChange={(event) =>
                                setDraft({ ...draft, subpositionId: event.target.value })
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                            >
                              <option value="">Estrutura inteira / sem nível</option>
                              {activeLevels.map(({ location }) => (
                                <option key={location.id} value={location.id}>
                                  {location.code} · {location.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Lote
                            <input
                              value={draft.lotCode}
                              onChange={(event) => setDraft({ ...draft, lotCode: event.target.value })}
                              placeholder="Ex.: L240918"
                              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                            />
                          </label>

                          <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Validade
                            <input
                              type="date"
                              value={draft.expiresOn}
                              disabled={draft.noExpiry}
                              onChange={(event) => setDraft({ ...draft, expiresOn: event.target.value })}
                              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:bg-slate-100"
                            />
                            <span className="mt-2 flex items-center gap-2 normal-case tracking-normal text-[10px] font-semibold text-slate-500">
                              <input
                                type="checkbox"
                                checked={draft.noExpiry}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    noExpiry: event.target.checked,
                                    expiresOn: event.target.checked ? '' : draft.expiresOn,
                                  })
                                }
                              />
                              Item sem validade aplicável
                            </span>
                          </label>

                          <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Código de barras
                            <div className="relative mt-1">
                              <ScanLine className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                              <input
                                value={draft.barcode}
                                onChange={(event) => setDraft({ ...draft, barcode: event.target.value })}
                                placeholder="Leia no scanner ou digite"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs font-bold text-slate-700"
                              />
                            </div>
                          </label>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                            Código de barras do item (opcional)
                            <div className="relative mt-1">
                              <Barcode className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                              <input
                                value={draft.barcode}
                                onChange={(event) => setDraft({ ...draft, barcode: event.target.value })}
                                placeholder="Scanner ou teclado"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs font-bold text-slate-700"
                              />
                            </div>
                          </label>
                          <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-[10px] leading-4 text-violet-700">
                            Não cria entrada, lote ou localização física no estoque.
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          disabled={workingKey === row.key}
                          onClick={() => void confirmDecision(row)}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white disabled:opacity-50"
                        >
                          {workingKey === row.key ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {draft.decision === 'ALLOCATED'
                            ? 'Confirmar alocação'
                            : 'Confirmar consumo imediato'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {state.context?.truncated && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A consulta atingiu um dos limites bounded. A fila não conclui sobre registros fora da janela carregada.
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
