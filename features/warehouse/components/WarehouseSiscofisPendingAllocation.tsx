'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  PackageOpen,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import type { WarehouseStockPosition } from '../../../lib/warehouse/location';
import {
  listWarehouseDepotsCached,
  listWarehouseLocationsCached,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  allocateWarehousePendingPhysicalStock,
  listWarehousePendingPhysicalAllocations,
  type WarehousePendingPhysicalAllocationRow,
} from '../../../lib/warehouse/pendingPhysicalAllocationRepository';

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function quantityLabel(row: WarehousePendingPhysicalAllocationRow): string {
  const unit = row.unit.label || row.unit.code;
  return row.pendingQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
    + (unit ? ' ' + unit : '');
}

function allocationErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (raw.includes('WAREHOUSE_PENDING_ALLOCATION_RECONCILIATION_REQUIRED')) {
    return 'Este registro é uma projeção legada do Marco Zero e exige reconciliação dedicada antes de virar estoque físico localizado.';
  }
  if (raw.includes('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK')) {
    return 'A projeção legada mudou. Atualize a fila antes de revisar novamente.';
  }
  if (
    raw.includes('WAREHOUSE_POSITION_INACTIVE')
    || raw.includes('WAREHOUSE_SUBPOSITION_INACTIVE')
    || raw.includes('WAREHOUSE_POSITION_NOT_FOUND')
  ) {
    return 'O depósito, local ou subposição deixou de estar ativo. Selecione outra posição.';
  }
  if (raw.includes('WAREHOUSE_PENDING_ALLOCATION_LOCATION_REQUIRED')) {
    return 'Selecione uma posição física válida.';
  }
  if (raw.includes('WAREHOUSE_TRANSFER_INVALID_QUANTITY')) {
    return 'Informe uma quantidade válida para alocação.';
  }
  if (raw.includes('WAREHOUSE_IDEMPOTENCY_CONFLICT')) {
    return 'Esta tentativa já foi registrada com dados diferentes. Feche e reabra a alocação.';
  }
  return raw || 'Não foi possível alocar o saldo SISCOFIS.';
}

function SiscofisAllocationDialog({
  workspaceId,
  row,
  depots,
  locations,
  loadingStructure,
  onClose,
  onComplete,
}: {
  workspaceId: string;
  row: WarehousePendingPhysicalAllocationRow;
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  loadingStructure: boolean;
  onClose: () => void;
  onComplete: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(row.pendingQuantity));
  const [depotId, setDepotId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [subpositionId, setSubpositionId] = useState('');
  const [operationId] = useState(() => window.crypto.randomUUID());
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDepots = useMemo(
    () => depots.filter((item) => item.depot.status === 'active'),
    [depots]
  );

  const localOptions = useMemo(
    () =>
      locations.filter(
        (item) =>
          item.location.status === 'active'
          && item.location.kind === 'LOCAL'
          && item.location.depotId === depotId
      ),
    [depotId, locations]
  );

  const subpositionOptions = useMemo(
    () =>
      locations.filter(
        (item) =>
          item.location.status === 'active'
          && item.location.kind === 'SUBPOSITION'
          && item.location.depotId === depotId
          && item.location.parentLocationId === locationId
      ),
    [depotId, locationId, locations]
  );

  useEffect(() => {
    if (activeDepots.length === 1 && !depotId) {
      setDepotId(activeDepots[0].depot.id);
    }
  }, [activeDepots, depotId]);

  useEffect(() => {
    if (localOptions.length === 1 && !locationId) {
      setLocationId(localOptions[0].location.id);
    }
  }, [localOptions, locationId]);

  const numericQuantity = Number(quantity.replace(',', '.'));
  const validQuantity =
    Number.isFinite(numericQuantity)
    && numericQuantity > 0
    && numericQuantity <= row.pendingQuantity + 0.000001;

  const destination: WarehouseStockPosition | null = (() => {
    if (!depotId || !locationId) return null;
    if (subpositionId) {
      return {
        kind: 'SUBPOSITION',
        depotId,
        locationId,
        subpositionId,
      };
    }
    return {
      kind: 'LOCATION',
      depotId,
      locationId,
      subpositionId: null,
    };
  })();

  const submit = async () => {
    setError(null);
    if (!validQuantity) {
      setError('Informe uma quantidade maior que zero e limitada à quantidade legada observada.');
      return;
    }
    if (!destination) {
      setError('Selecione um depósito e uma localização.');
      return;
    }

    setWorking(true);
    try {
      await allocateWarehousePendingPhysicalStock(workspaceId, {
        materialId: row.materialId,
        quantity: numericQuantity,
        position: destination,
        operationId,
      });
      await onComplete();
    } catch (allocationError) {
      setError(allocationErrorMessage(allocationError));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Revisar legado do Marco Zero SISCOFIS"
    >
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#00288e]/60">
              Marco Zero SISCOFIS · alocação física
            </p>
            <h3 className="mt-1 text-base font-black text-slate-900">{row.description}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {row.sourceItemNumbers.length > 0
                ? 'Ficha(s) ' + row.sourceItemNumbers.join(', ') + ' · '
                : ''}
              {quantityLabel(row)} em projeção legada
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-slate-600">
            Este registro é compatibilidade histórica do Marco Zero SISCOFIS. Ele
            <strong className="text-slate-800"> não é estoque físico disponível nem pendência do intake v2</strong>.
            A alocação automática está bloqueada até existir um fluxo dedicado de reconciliação que preserve a evidência histórica.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                Quantidade
              </span>
              <input
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-300"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                Quantidade legada
              </span>
              <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700">
                {quantityLabel(row)}
              </div>
            </div>
          </div>

          {loadingStructure ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs font-bold text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando estrutura dos depósitos…
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Depósito
                </span>
                <select
                  value={depotId}
                  onChange={(event) => {
                    setDepotId(event.target.value);
                    setLocationId('');
                    setSubpositionId('');
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
                >
                  <option value="">Selecione o depósito</option>
                  {activeDepots.map((item) => (
                    <option key={item.depot.id} value={item.depot.id}>
                      {item.depot.code} · {item.depot.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Localização
                </span>
                <select
                  value={locationId}
                  onChange={(event) => {
                    setLocationId(event.target.value);
                    setSubpositionId('');
                  }}
                  disabled={!depotId}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">Selecione a localização</option>
                  {localOptions.map((item) => (
                    <option key={item.location.id} value={item.location.id}>
                      {item.location.code} · {item.location.name}
                    </option>
                  ))}
                </select>
              </label>

              {subpositionOptions.length > 0 && (
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Subposição opcional
                  </span>
                  <select
                    value={subpositionId}
                    onChange={(event) => setSubpositionId(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
                  >
                    <option value="">Usar a localização inteira</option>
                    {subpositionOptions.map((item) => (
                      <option key={item.location.id} value={item.location.id}>
                        {item.location.code} · {item.location.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={working || loadingStructure || !validQuantity || !destination}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white disabled:opacity-40"
            >
              {working ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              Revisar reconciliação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WarehouseSiscofisPendingAllocation({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [rows, setRows] = useState<WarehousePendingPhysicalAllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');
  const [selected, setSelected] = useState<WarehousePendingPhysicalAllocationRow | null>(null);
  const [depots, setDepots] = useState<WarehouseDepotListItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationListItem[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [structureLoaded, setStructureLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listWarehousePendingPhysicalAllocations(workspaceId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Falha ao carregar materiais SISCOFIS pendentes de alocação.'
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(queryText);
    if (!query) return rows;
    return rows.filter((row) =>
      normalizeSearch([
        row.description,
        row.materialId,
        ...row.sourceItemNumbers,
      ].join(' ')).includes(query)
    );
  }, [queryText, rows]);

  const ensureStructure = async () => {
    if (structureLoaded || loadingStructure) return;
    setLoadingStructure(true);
    try {
      const [nextDepots, nextLocations] = await Promise.all([
        listWarehouseDepotsCached(workspaceId, 250),
        listWarehouseLocationsCached(workspaceId, 500),
      ]);
      setDepots(nextDepots);
      setLocations(nextLocations);
      setStructureLoaded(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar a estrutura dos depósitos.'
      );
    } finally {
      setLoadingStructure(false);
    }
  };

  const openAllocation = (row: WarehousePendingPhysicalAllocationRow) => {
    setSelected(row);
    void ensureStructure();
  };

  const completeAllocation = async () => {
    setSelected(null);
    setMessage('Reconciliação física registrada. Atualize a fila para conferir o estado canônico.');
    await refresh();
  };

  return (
    <>
      <section
        className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
        data-testid="warehouse-siscofis-pending-allocation"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <PackageOpen className="h-4 w-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.15em]">
                Marco Zero SISCOFIS · reconciliação legada
              </p>
            </div>
            <h3 className="mt-2 text-base font-black text-slate-900">
              Registros legados do Marco Zero que exigem reconciliação
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Esta fila mostra projeções históricas UNASSIGNED associadas ao Marco Zero SISCOFIS.
              Elas não são estoque físico disponível nem pendência de intake. A consulta é compatível
              com o legado, mas a conversão para LOCATION/SUBPOSITION fica bloqueada até reconciliação dedicada.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-[#00288e]">
              {rows.length} pendente(s)
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              Atualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs font-bold text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Consultando projeções legadas do Marco Zero SISCOFIS…
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-xs font-black text-emerald-800">Nenhum legado SISCOFIS exige reconciliação física.</p>
              <p className="mt-1 text-[10px] leading-4 text-emerald-700/80">
                Se o Marco Zero ainda não foi confirmado, os itens aparecerão aqui depois da confirmação.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                placeholder="Buscar por ficha ou material"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300"
              />
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[760px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="p-3">Nº Ficha</th>
                    <th className="p-3">Material</th>
                    <th className="p-3">Legado a reconciliar</th>
                    <th className="p-3">Referência</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr key={row.materialId} className="bg-white">
                      <td className="p-3 font-mono text-[10px] font-bold text-slate-600">
                        {row.sourceItemNumbers.length > 0
                          ? row.sourceItemNumbers.join(', ')
                          : '—'}
                      </td>
                      <td className="p-3">
                        <p className="font-black text-slate-800">{row.description}</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-blue-600">
                          Marco Zero SISCOFIS
                        </p>
                      </td>
                      <td className="p-3 font-black text-amber-700">{quantityLabel(row)}</td>
                      <td className="p-3 text-slate-500">
                        {row.referenceDate
                          ? new Date(row.referenceDate + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => openAllocation(row)}
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white hover:bg-[#001f70]"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRows.length === 0 && (
                <div className="px-4 py-6 text-center text-xs font-semibold text-slate-400">
                  Nenhum material corresponde à busca.
                </div>
              )}
            </div>
          </>
        )}

        {message && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            {message}
          </div>
        )}
      </section>

      {selected && (
        <SiscofisAllocationDialog
          workspaceId={workspaceId}
          row={selected}
          depots={depots}
          locations={locations}
          loadingStructure={loadingStructure}
          onClose={() => setSelected(null)}
          onComplete={completeAllocation}
        />
      )}
    </>
  );
}
