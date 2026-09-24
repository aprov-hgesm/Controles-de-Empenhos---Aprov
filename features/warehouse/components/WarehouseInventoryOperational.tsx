'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseInventoryScope } from '../../../lib/warehouse/inventory';
import {
  beginWarehouseInventoryReview,
  cancelWarehouseInventory,
  confirmWarehouseInventory,
  listWarehouseInventoryItems,
  listWarehouseInventorySessions,
  listWarehouseUnlocatedStock,
  reopenWarehouseInventoryCounting,
  saveWarehouseInventoryCount,
  startWarehouseInventory,
  warehouseInventoryPositionLabel,
  warehouseInventoryScopeLabel,
  type WarehouseInventoryItemRecord,
  type WarehouseInventorySessionRecord,
  type WarehouseUnlocatedStock,
} from '../../../lib/warehouse/inventoryRepository';
import {
  listWarehouseDepots,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';

type Filter = 'ALL' | 'PENDING' | 'DIVERGENT' | 'MATCHED';

function quantity(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function statusLabel(status: WarehouseInventorySessionRecord['session']['status']): string {
  const labels: Record<WarehouseInventorySessionRecord['session']['status'], string> = {
    OPENING: 'Preparando',
    COUNTING: 'Em contagem',
    REVIEW: 'Em revisão',
    CONFIRMING: 'Aplicando ajustes',
    RECONCILIATION_REQUIRED: 'Reconciliação necessária',
    CONFIRMED: 'Finalizado',
    CANCELLED: 'Cancelado',
  };
  return labels[status];
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_INVENTORY_COUNT_INCOMPLETE')) return 'Ainda existem itens sem contagem.';
  if (raw.includes('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE')) return 'O estoque desta posição mudou após a contagem. Nenhum ajuste foi aplicado a esse item; a sessão foi pausada para reconciliação.';
  if (raw.includes('WAREHOUSE_INVENTORY_SCOPE_EMPTY')) return 'O escopo selecionado não possui saldo físico para inventariar.';
  if (raw.includes('WAREHOUSE_INVENTORY_SCOPE_TOO_LARGE')) return 'O escopo excede o limite seguro desta operação. Divida o inventário por depósito ou localização.';
  if (raw.includes('WAREHOUSE_INVENTORY_PROJECTION_INCONSISTENT')) return 'Saldo agregado e distribuição física estão inconsistentes. Corrija a projeção antes de abrir o inventário.';
  if (raw.includes('WAREHOUSE_INVENTORY_FINALIZED')) return 'Esta sessão já foi finalizada e não pode ser reescrita.';
  if (raw.includes('WAREHOUSE_INVENTORY_NOT_COUNTING')) return 'A sessão não está aberta para contagem.';
  return raw || 'Falha inesperada no inventário.';
}

export function WarehouseInventoryOperational({ workspaceId }: { workspaceId: string }) {
  const [sessions, setSessions] = useState<WarehouseInventorySessionRecord[]>([]);
  const [active, setActive] = useState<WarehouseInventorySessionRecord | null>(null);
  const [items, setItems] = useState<WarehouseInventoryItemRecord[]>([]);
  const [materials, setMaterials] = useState<WarehouseMaterial[]>([]);
  const [depots, setDepots] = useState<WarehouseDepotListItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationListItem[]>([]);
  const [unlocated, setUnlocated] = useState<WarehouseUnlocatedStock[]>([]);
  const [scopeKind, setScopeKind] = useState<WarehouseInventoryScope['kind']>('TOTAL');
  const [depotId, setDepotId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [subpositionId, setSubpositionId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [confirmAck, setConfirmAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials]
  );

  const depotLocations = useMemo(
    () => locations.filter(({ location }) =>
      location.kind === 'LOCAL'
      && location.status === 'active'
      && location.depotId === depotId
    ),
    [depotId, locations]
  );

  const localSubpositions = useMemo(
    () => locations.filter(({ location }) =>
      location.kind === 'SUBPOSITION'
      && location.status === 'active'
      && location.depotId === depotId
      && location.parentLocationId === locationId
    ),
    [depotId, locationId, locations]
  );

  const loadBase = async () => {
    const [nextSessions, nextMaterials, nextDepots, nextLocations, nextUnlocated] = await Promise.all([
      listWarehouseInventorySessions(workspaceId, 24),
      listWarehouseMaterials(workspaceId, 500),
      listWarehouseDepots(workspaceId, 250),
      listWarehouseLocations(workspaceId, 500),
      listWarehouseUnlocatedStock(workspaceId),
    ]);
    setSessions(nextSessions);
    setMaterials(nextMaterials);
    setDepots(nextDepots);
    setLocations(nextLocations);
    setUnlocated(nextUnlocated);

    const currentId = active?.session.id;
    const selected = currentId
      ? nextSessions.find((record) => record.session.id === currentId) || null
      : nextSessions.find((record) =>
          !['CONFIRMED', 'CANCELLED'].includes(record.session.status)
        ) || null;
    setActive(selected);
    if (selected) {
      setItems(await listWarehouseInventoryItems(workspaceId, selected.session.id));
    } else {
      setItems([]);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      await loadBase();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const chooseSession = async (record: WarehouseInventorySessionRecord) => {
    setBusy(true);
    setMessage(null);
    try {
      setActive(record);
      setItems(await listWarehouseInventoryItems(workspaceId, record.session.id));
      setDrafts({});
      setConfirmAck(false);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const scope = (): WarehouseInventoryScope => {
    if (scopeKind === 'TOTAL') return { kind: 'TOTAL' };
    if (scopeKind === 'DEPOT') return { kind: 'DEPOT', depotId };
    if (scopeKind === 'LOCATION') return { kind: 'LOCATION', depotId, locationId };
    return { kind: 'SUBPOSITION', depotId, locationId, subpositionId };
  };

  const start = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const created = await startWarehouseInventory(workspaceId, { scope: scope() });
      setActive(created);
      setItems(await listWarehouseInventoryItems(workspaceId, created.session.id));
      setMessage('Sessão aberta. A contagem está separada do estoque oficial até a confirmação.');
      await loadBase();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveCount = async (record: WarehouseInventoryItemRecord) => {
    if (!active || active.session.status !== 'COUNTING') return;
    const raw = drafts[record.item.id];
    const parsed = raw === undefined || raw.trim() === '' ? null : Number(raw.replace(',', '.'));
    if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
      setMessage('Informe uma quantidade contada válida.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await saveWarehouseInventoryCount(
        workspaceId,
        active.session.id,
        record.item.id,
        parsed
      );
      setItems(await listWarehouseInventoryItems(workspaceId, active.session.id));
      setMessage('Contagem salva. Nenhum saldo ou movimento de estoque foi alterado.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const beginReview = async () => {
    if (!active) return;
    setBusy(true);
    setMessage(null);
    try {
      await beginWarehouseInventoryReview(workspaceId, active.session.id);
      await loadBase();
      setMessage('Contagem fechada para revisão. Confira as divergências antes de confirmar.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await reopenWarehouseInventoryCounting(workspaceId, active.session.id);
      await loadBase();
      setConfirmAck(false);
      setMessage('Sessão reaberta para correção das contagens.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!active || !confirmAck) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await confirmWarehouseInventory(workspaceId, active.session.id);
      await loadBase();
      setMessage(
        'Inventário finalizado: ' + result.adjusted + ' ajuste(s) auditável(is) e '
        + result.matched + ' item(ns) sem divergência.'
      );
      setConfirmAck(false);
    } catch (error) {
      await loadBase().catch(() => undefined);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await cancelWarehouseInventory(workspaceId, active.session.id);
      await loadBase();
      setMessage('Sessão cancelada com histórico preservado.');
      setActive(null);
      setItems([]);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return items.filter(({ item }) => {
      if (filter === 'PENDING' && item.status !== 'PENDING' && item.status !== 'STALE') return false;
      if (filter === 'DIVERGENT' && item.status !== 'DIVERGENT' && item.status !== 'ADJUSTED') return false;
      if (filter === 'MATCHED' && item.status !== 'MATCHED') return false;
      if (!normalizedSearch) return true;
      const material = materialById.get(item.materialId);
      return (
        material?.description.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
        || material?.aliases.some((alias) => alias.toLocaleLowerCase('pt-BR').includes(normalizedSearch))
        || item.materialId.includes(normalizedSearch)
      );
    });
  }, [filter, items, materialById, search]);

  const progress = useMemo(() => {
    const counted = items.filter(({ item }) => !['PENDING', 'STALE'].includes(item.status)).length;
    const divergent = items.filter(({ item }) => ['DIVERGENT', 'ADJUSTED'].includes(item.status)).length;
    return { counted, divergent, total: items.length };
  }, [items]);

  const canStart =
    scopeKind === 'TOTAL'
    || (scopeKind === 'DEPOT' && Boolean(depotId))
    || (scopeKind === 'LOCATION' && Boolean(depotId && locationId))
    || (scopeKind === 'SUBPOSITION' && Boolean(depotId && locationId && subpositionId));

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-inventory-operational">
      <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" aria-hidden="true" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-100">Contagem não movimenta estoque</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              O esperado é um snapshot das projeções oficiais. Digitar e salvar contagens não altera ledger, saldo agregado ou distribuição física. Somente a confirmação humana gera INVENTORY_ADJUSTMENT.
            </p>
          </div>
        </div>
      </div>

      {!active && (
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5" data-testid="warehouse-inventory-new">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-200" aria-hidden="true" />
            <p className="text-sm font-black text-slate-200">Nova sessão de inventário</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Escopo
              <select
                data-testid="warehouse-inventory-scope-kind"
                value={scopeKind}
                onChange={(event) => {
                  setScopeKind(event.target.value as WarehouseInventoryScope['kind']);
                  setDepotId('');
                  setLocationId('');
                  setSubpositionId('');
                }}
                className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#030a16] px-3 text-xs text-slate-200 outline-none"
              >
                <option value="TOTAL">Inventário total</option>
                <option value="DEPOT">Por depósito</option>
                <option value="LOCATION">Por localização</option>
                <option value="SUBPOSITION">Por subposição</option>
              </select>
            </label>

            {scopeKind !== 'TOTAL' && (
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Depósito
                <select
                  data-testid="warehouse-inventory-depot"
                  value={depotId}
                  onChange={(event) => {
                    setDepotId(event.target.value);
                    setLocationId('');
                    setSubpositionId('');
                  }}
                  className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#030a16] px-3 text-xs text-slate-200 outline-none"
                >
                  <option value="">Selecione</option>
                  {depots.filter(({ depot }) => depot.status === 'active').map(({ depot }) => (
                    <option key={depot.id} value={depot.id}>{depot.code} · {depot.name}</option>
                  ))}
                </select>
              </label>
            )}

            {(scopeKind === 'LOCATION' || scopeKind === 'SUBPOSITION') && (
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Localização
                <select
                  data-testid="warehouse-inventory-location"
                  value={locationId}
                  onChange={(event) => {
                    setLocationId(event.target.value);
                    setSubpositionId('');
                  }}
                  className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#030a16] px-3 text-xs text-slate-200 outline-none"
                >
                  <option value="">Selecione</option>
                  {depotLocations.map(({ location }) => (
                    <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
                  ))}
                </select>
              </label>
            )}

            {scopeKind === 'SUBPOSITION' && (
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Subposição
                <select
                  data-testid="warehouse-inventory-subposition"
                  value={subpositionId}
                  onChange={(event) => setSubpositionId(event.target.value)}
                  className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#030a16] px-3 text-xs text-slate-200 outline-none"
                >
                  <option value="">Selecione</option>
                  {localSubpositions.map(({ location }) => (
                    <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button
            type="button"
            data-testid="warehouse-inventory-start"
            onClick={() => void start()}
            disabled={busy || !canStart}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500/90 px-4 text-xs font-black text-white transition hover:bg-emerald-400 disabled:opacity-40"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Iniciar inventário
          </button>
        </div>
      )}

      {active && (
        <div className="space-y-4" data-testid="warehouse-inventory-active">
          <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300/70">
                  {statusLabel(active.session.status)} · {active.session.id}
                </p>
                <p className="mt-2 text-lg font-black text-slate-100">
                  {warehouseInventoryScopeLabel(active.session.scope, depots, locations)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Responsável {active.session.openedBy} · referência {active.referenceCapturedAt ? new Date(active.referenceCapturedAt).toLocaleString('pt-BR') : 'registrada no servidor'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['COUNTING', 'REVIEW', 'RECONCILIATION_REQUIRED'].includes(active.session.status) && (
                  <button
                    type="button"
                    onClick={() => void cancel()}
                    disabled={busy}
                    className="rounded-xl border border-rose-300/15 bg-rose-400/[0.05] px-3 py-2 text-xs font-bold text-rose-200 disabled:opacity-40"
                  >
                    Cancelar sessão
                  </button>
                )}
                {['CONFIRMED', 'CANCELLED'].includes(active.session.status) && (
                  <button
                    type="button"
                    onClick={() => { setActive(null); setItems([]); setMessage(null); }}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300"
                  >
                    Nova sessão
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Progresso</p>
                <p className="mt-1 text-lg font-black text-slate-200">{progress.counted}/{progress.total}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Divergências</p>
                <p className="mt-1 text-lg font-black text-amber-200">{progress.divergent}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Estoque alterado pela contagem</p>
                <p className="mt-1 text-lg font-black text-emerald-200">0</p>
              </div>
            </div>
          </div>

          {active.session.status === 'COUNTING' && (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.07] bg-[#030a16] px-3">
                  <PackageSearch className="h-4 w-4 text-slate-600" aria-hidden="true" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar material"
                    data-testid="warehouse-inventory-search"
                    className="h-10 w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-700"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['ALL', 'Todos'],
                    ['PENDING', 'Pendentes'],
                    ['DIVERGENT', 'Divergentes'],
                    ['MATCHED', 'Conferidos'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={filter === value
                        ? 'rounded-lg border border-blue-300/20 bg-blue-400/[0.1] px-3 py-2 text-[10px] font-bold text-blue-100'
                        : 'rounded-lg border border-white/[0.06] px-3 py-2 text-[10px] font-bold text-slate-500'}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/10">
                <table className="min-w-[900px] w-full text-left text-xs">
                  <thead className="bg-white/[0.025] text-[9px] uppercase tracking-[0.12em] text-slate-600">
                    <tr>
                      <th className="p-3">Material / posição</th>
                      <th className="p-3">Esperado</th>
                      <th className="p-3">Contado</th>
                      <th className="p-3">Diferença</th>
                      <th className="p-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredItems.map((record) => {
                      const item = record.item;
                      const material = materialById.get(item.materialId);
                      const unit = material?.unit.label || material?.unit.code || 'un';
                      return (
                        <tr key={item.id} data-testid={'warehouse-inventory-item-' + item.id}>
                          <td className="p-3">
                            <p className="max-w-md font-bold text-slate-300">{material?.description || item.materialId}</p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-600">
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              {warehouseInventoryPositionLabel(item.position, depots, locations)}
                            </p>
                          </td>
                          <td className="p-3">
                            <p className="font-black text-slate-200">{quantity(item.expectedQuantity)}</p>
                            <p className="text-[9px] text-slate-600">{unit} · rev. {item.expectedLocationRevision}</p>
                          </td>
                          <td className="p-3">
                            <input
                              data-testid="warehouse-inventory-count"
                              data-expected={item.expectedQuantity}
                              inputMode="decimal"
                              value={drafts[item.id] ?? (item.countedQuantity === null ? '' : String(item.countedQuantity))}
                              onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void saveCount(record);
                                }
                              }}
                              onBlur={() => {
                                if (drafts[item.id] !== undefined) void saveCount(record);
                              }}
                              className="h-9 w-28 rounded-lg border border-white/[0.08] bg-[#030a16] px-3 text-xs font-bold text-slate-200 outline-none focus:border-blue-300/25"
                            />
                          </td>
                          <td className="p-3 font-black">
                            <span className={item.difference === null ? 'text-slate-600' : item.difference > 0 ? 'text-blue-200' : item.difference < 0 ? 'text-rose-200' : 'text-emerald-200'}>
                              {item.difference === null ? '—' : (item.difference > 0 ? '+' : '') + quantity(item.difference)}
                            </span>
                          </td>
                          <td className="p-3">
                            {item.status === 'PENDING' && <span className="text-slate-500">Não contado</span>}
                            {item.status === 'MATCHED' && <span className="font-bold text-emerald-200">Conferido</span>}
                            {item.status === 'DIVERGENT' && <span className="font-bold text-amber-200">Divergente</span>}
                            {item.status === 'ADJUSTED' && <span className="font-bold text-blue-200">Ajustado</span>}
                            {item.status === 'STALE' && <span className="font-bold text-rose-200">Referência alterada</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                data-testid="warehouse-inventory-review"
                onClick={() => void beginReview()}
                disabled={busy || progress.counted !== progress.total || progress.total === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/[0.08] px-4 text-xs font-black text-amber-100 disabled:opacity-40"
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Revisar divergências
              </button>
            </>
          )}

          {active.session.status === 'REVIEW' && (
            <div className="rounded-2xl border border-amber-300/12 bg-amber-400/[0.035] p-5" data-testid="warehouse-inventory-review-summary">
              <div className="flex items-center gap-2 text-amber-100">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <p className="text-sm font-black">Confirmação humana obrigatória</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {active.session.reviewSummary?.divergentItems || 0} divergência(s) gerarão movimentos INVENTORY_ADJUSTMENT. Itens sem diferença não geram movimento.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Positivas</p>
                  <p className="mt-1 font-black text-blue-200">+{quantity(active.session.reviewSummary?.positiveDifference || 0)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Negativas</p>
                  <p className="mt-1 font-black text-rose-200">{quantity(active.session.reviewSummary?.negativeDifference || 0)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Sem divergência</p>
                  <p className="mt-1 font-black text-emerald-200">{active.session.reviewSummary?.matchedItems || 0}</p>
                </div>
              </div>
              <label className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-black/10 p-3 text-xs leading-5 text-slate-400">
                <input
                  data-testid="warehouse-inventory-confirm-ack"
                  type="checkbox"
                  checked={confirmAck}
                  onChange={(event) => setConfirmAck(event.target.checked)}
                  className="mt-0.5"
                />
                Conferi o resumo e autorizo explicitamente os ajustes de estoque indicados pelas divergências.
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="warehouse-inventory-confirm"
                  onClick={() => void confirm()}
                  disabled={busy || !confirmAck}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500/90 px-4 text-xs font-black text-white disabled:opacity-40"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Confirmar e aplicar ajustes
                </button>
                <button
                  type="button"
                  onClick={() => void reopen()}
                  disabled={busy}
                  className="h-10 rounded-xl border border-white/[0.08] px-4 text-xs font-bold text-slate-300 disabled:opacity-40"
                >
                  Voltar à contagem
                </button>
              </div>
            </div>
          )}

          {active.session.status === 'RECONCILIATION_REQUIRED' && (
            <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.04] p-5">
              <div className="flex items-center gap-2 text-rose-200">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                <p className="text-sm font-black">Sessão pausada por concorrência</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Uma posição mudou depois da contagem. O sistema não aplicou cegamente a divergência. Cancele esta sessão de forma auditável e abra um novo inventário parcial para reconciliar a posição indicada.
              </p>
              <p className="mt-2 break-all font-mono text-[9px] text-slate-600">
                item {active.session.staleItemId || 'identificado no histórico'}
              </p>
            </div>
          )}

          {active.session.status === 'CONFIRMED' && (
            <div className="rounded-2xl border border-emerald-300/12 bg-emerald-400/[0.035] p-5">
              <div className="flex items-center gap-2 text-emerald-200">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <p className="text-sm font-black">Inventário finalizado e auditável</p>
              </div>
              <p className="mt-2 text-sm text-slate-400">A sessão é somente histórica. Correções posteriores exigem nova sessão e novos movimentos.</p>
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          data-testid="warehouse-inventory-message"
          className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs leading-5 text-slate-300"
        >
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5" data-testid="warehouse-inventory-unlocated">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-200">Materiais sem localização</p>
            <p className="mt-1 text-xs text-slate-600">Fila derivada do saldo oficial menos a distribuição física. Organize usando Localizações/Transferências.</p>
          </div>
          <span className="rounded-full border border-amber-300/10 bg-amber-400/[0.05] px-3 py-1 text-[10px] font-bold text-amber-200">{unlocated.length}</span>
        </div>
        <div className="mt-4 space-y-2">
          {unlocated.length === 0 ? (
            <p className="text-xs text-slate-600">Nenhum saldo sem localização física.</p>
          ) : unlocated.slice(0, 20).map((entry) => (
            <div key={entry.material.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
              <div>
                <p className="text-xs font-bold text-slate-300">{entry.material.description}</p>
                <p className="mt-1 font-mono text-[9px] text-slate-700">{entry.material.id}</p>
              </div>
              <p className="shrink-0 text-sm font-black text-amber-200">{quantity(entry.quantity)} {entry.material.unit.label || entry.material.unit.code}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5" data-testid="warehouse-inventory-history">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-200">Histórico de inventários</p>
            <p className="mt-1 text-xs text-slate-600">Leitura sob demanda · até 24 sessões</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || busy}
            className="rounded-lg border border-white/[0.07] p-2 text-slate-400"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-600">Nenhuma sessão registrada.</p>
          ) : sessions.map((record) => (
            <button
              key={record.session.id}
              type="button"
              onClick={() => void chooseSession(record)}
              className="flex w-full flex-col gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-left transition hover:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-300">{warehouseInventoryScopeLabel(record.session.scope, depots, locations)}</p>
                <p className="mt-1 font-mono text-[9px] text-slate-700">{record.session.id}</p>
              </div>
              <div className="text-[10px] text-slate-500 sm:text-right">
                {statusLabel(record.session.status)}<br />
                {record.createdAt ? new Date(record.createdAt).toLocaleString('pt-BR') : 'data do servidor'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
