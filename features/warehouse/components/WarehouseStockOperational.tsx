'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ChevronRight,
  FileText,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  deriveUnassignedQuantity,
  warehouseStockPositionKey,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from '../../../lib/warehouse/location';
import {
  listWarehouseBarcodes,
  type WarehouseBarcodeListItem,
} from '../../../lib/warehouse/barcodeRepository';
import {
  buildWarehousePositionLabel,
  listWarehouseDepots,
  listWarehouseLocationBalances,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationBalanceListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  buildWarehouseLogisticsPendencies,
  selectWarehouseFefoLot,
  warehouseLotExpiryState,
  warehouseLotOriginLabel,
  WAREHOUSE_LOT_SCHEMA_VERSION,
  type WarehouseLot,
  type WarehouseLotOrigin,
} from '../../../lib/warehouse/lot';
import {
  createWarehouseLot,
  listWarehouseLots,
  updateWarehouseLot,
  type WarehouseLotListItem,
} from '../../../lib/warehouse/lotRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseBalance } from '../../../lib/warehouse/movement';
import {
  listWarehouseBalances,
  listWarehouseMovementsForMaterial,
  type WarehouseMovementListItem,
} from '../../../lib/warehouse/ledgerRepository';

interface WarehouseStockState {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  balances: WarehouseBalance[];
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  locationBalances: WarehouseLocationBalanceListItem[];
  lots: WarehouseLotListItem[];
  barcodes: WarehouseBarcodeListItem[];
}

interface MaterialSummary {
  material: WarehouseMaterial;
  balance: WarehouseBalance;
  locationBalances: WarehouseLocationBalance[];
  lots: WarehouseLot[];
  barcodes: string[];
  unassigned: number;
  distributed: number;
  locationLabels: string[];
  fefo: WarehouseLot | null;
  pendencies: ReturnType<typeof buildWarehouseLogisticsPendencies>;
  nearestExpiry: string | null;
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function numberLabel(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function dateLabel(value: string | null): string {
  if (!value) return 'não informada';
  const [year, month, day] = value.split('-');
  return day + '/' + month + '/' + year;
}

function lotStateLabel(lot: WarehouseLot): string {
  const state = warehouseLotExpiryState(lot);
  if (state === 'EXPIRED') return 'Vencido';
  if (state === 'NEAR_EXPIRY') return 'Próximo do vencimento';
  if (state === 'NO_EXPIRY') return 'Sem validade';
  if (state === 'DEPLETED') return 'Sem saldo atribuído';
  if (state === 'INACTIVE') return 'Inativo';
  return 'Válido';
}

function lotStateClass(lot: WarehouseLot): string {
  const state = warehouseLotExpiryState(lot);
  if (state === 'EXPIRED') return 'border-rose-300/15 bg-rose-400/[0.06] text-rose-200';
  if (state === 'NEAR_EXPIRY') return 'border-amber-300/15 bg-amber-400/[0.06] text-amber-200';
  if (state === 'VALID') return 'border-emerald-300/15 bg-emerald-400/[0.06] text-emerald-200';
  return 'border-white/[0.08] bg-white/[0.035] text-slate-400';
}

function logisticsMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_LOT_QUANTITY_EXCEEDS_LOCATION')) {
    return 'A quantidade do lote excede o saldo da posição selecionada.';
  }
  if (raw.includes('WAREHOUSE_LOT_QUANTITY_EXCEEDS_BALANCE')) {
    return 'A quantidade do lote excede o saldo oficial do material.';
  }
  if (raw.includes('WAREHOUSE_LOT_POSITION_WITHOUT_STOCK')) {
    return 'A posição selecionada não possui saldo desse material.';
  }
  if (raw.includes('WAREHOUSE_INVALID_LOT')) {
    return 'Os dados do lote não passaram pela validação do contrato logístico.';
  }
  return raw;
}

function positionFromKey(
  key: string,
  positions: Map<string, WarehouseStockPosition>
): WarehouseStockPosition {
  return positions.get(key) || { kind: 'UNASSIGNED' };
}

export function WarehouseStockOperational({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [state, setState] = useState<WarehouseStockState>({
    loading: true,
    error: null,
    materials: [],
    balances: [],
    depots: [],
    locations: [],
    locationBalances: [],
    lots: [],
    barcodes: [],
  });
  const [queryText, setQueryText] = useState('');
  const [depotFilter, setDepotFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [movements, setMovements] = useState<WarehouseMovementListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [locateOpen, setLocateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [editingLotId, setEditingLotId] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [lotExpiry, setLotExpiry] = useState('');
  const [lotQuantity, setLotQuantity] = useState('');
  const [lotPositionKey, setLotPositionKey] = useState('UNASSIGNED');
  const [lotOriginMovementId, setLotOriginMovementId] = useState('');

  const refresh = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [materials, balances, depots, locations, locationBalances, lots, barcodes] =
        await Promise.all([
          listWarehouseMaterials(workspaceId, 250),
          listWarehouseBalances(workspaceId, 250),
          listWarehouseDepots(workspaceId, 250),
          listWarehouseLocations(workspaceId, 500),
          listWarehouseLocationBalances(workspaceId, 500),
          listWarehouseLots(workspaceId, 500),
          listWarehouseBarcodes(workspaceId, 500),
        ]);
      setState({
        loading: false,
        error: null,
        materials,
        balances,
        depots,
        locations,
        locationBalances,
        lots,
        barcodes,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: logisticsMessage(error),
      }));
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  useEffect(() => {
    if (!selectedMaterialId) {
      setMovements([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    void listWarehouseMovementsForMaterial(workspaceId, selectedMaterialId, 50)
      .then((next) => {
        if (active) setMovements(next);
      })
      .catch((error) => {
        if (active) setMessage(logisticsMessage(error));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedMaterialId, workspaceId]);

  const materialById = useMemo(
    () => new Map(state.materials.map((material) => [material.id, material])),
    [state.materials]
  );

  const summaries = useMemo<MaterialSummary[]>(() => {
    return state.balances
      .map((balance) => {
        const material = materialById.get(balance.materialId);
        if (!material) return null;
        const locationBalances = state.locationBalances
          .filter((item) => item.balance.materialId === balance.materialId)
          .map((item) => item.balance);
        const physical = locationBalances.filter(
          (item) => item.position.kind !== 'UNASSIGNED'
        );
        let unassigned = 0;
        try {
          unassigned = Math.max(
            0,
            deriveUnassignedQuantity(balance.quantity, physical)
          );
        } catch {
          unassigned = 0;
        }
        const lots = state.lots
          .filter((item) => item.lot.materialId === balance.materialId)
          .map((item) => item.lot);
        const barcodes = state.barcodes
          .filter((item) => item.association.materialId === balance.materialId)
          .map((item) => item.association.barcode);
        const locationLabels = Array.from(
          new Set([
            ...physical
              .filter((item) => item.quantity > 0)
              .map((item) =>
                buildWarehousePositionLabel(
                  item.position,
                  state.depots,
                  state.locations
                )
              ),
            ...(unassigned > 0 ? ['Sem localização'] : []),
          ])
        );
        const fefo = selectWarehouseFefoLot(lots);
        const nearestExpiry =
          lots
            .filter((lot) => lot.status === 'active' && lot.quantity > 0 && lot.expiresOn)
            .map((lot) => lot.expiresOn as string)
            .sort()[0] || null;
        return {
          material,
          balance,
          locationBalances,
          lots,
          barcodes,
          unassigned,
          distributed: Math.max(0, balance.quantity - unassigned),
          locationLabels,
          fefo,
          nearestExpiry,
          pendencies: buildWarehouseLogisticsPendencies({
            materialId: material.id,
            totalQuantity: balance.quantity,
            locationBalances,
            lots,
          }),
        };
      })
      .filter((item): item is MaterialSummary => Boolean(item));
  }, [
    materialById,
    state.balances,
    state.barcodes,
    state.depots,
    state.locationBalances,
    state.locations,
    state.lots,
  ]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(queryText);
    return summaries.filter((summary) => {
      const locationRows = summary.locationBalances.filter(
        (item) => item.quantity > 0
      );
      if (
        depotFilter
        && !locationRows.some(
          (item) =>
            item.position.kind !== 'UNASSIGNED'
            && item.position.depotId === depotFilter
        )
      ) {
        return false;
      }
      if (
        locationFilter
        && !locationRows.some((item) => {
          if (item.position.kind === 'UNASSIGNED') return false;
          return (
            item.position.locationId === locationFilter
            || (item.position.kind === 'SUBPOSITION'
              && item.position.subpositionId === locationFilter)
          );
        })
      ) {
        return false;
      }
      if (expiryFilter) {
        const states = summary.lots.map((lot) => warehouseLotExpiryState(lot));
        if (expiryFilter === 'expired' && !states.includes('EXPIRED')) return false;
        if (expiryFilter === 'near' && !states.includes('NEAR_EXPIRY')) return false;
        if (expiryFilter === 'valid' && !states.includes('VALID')) return false;
        if (expiryFilter === 'missing' && !states.includes('NO_EXPIRY')) return false;
      }
      if (!q) return true;

      const origins = summary.lots.flatMap((lot) => [
        lot.origin.invoiceId || '',
        lot.origin.supplier || '',
        lot.origin.supplierCnpj || '',
      ]);
      const haystack = normalizeSearch(
        [
          summary.material.id,
          summary.material.description,
          ...summary.material.aliases,
          ...summary.barcodes,
          ...summary.locationLabels,
          ...summary.lots.flatMap((lot) => [
            lot.id,
            lot.code,
            lot.expiresOn || '',
          ]),
          ...origins,
        ].join(' ')
      );
      return haystack.includes(q);
    });
  }, [depotFilter, expiryFilter, locationFilter, queryText, summaries]);

  const selected = summaries.find(
    (item) => item.material.id === selectedMaterialId
  ) || null;

  const positions = useMemo(() => {
    const next = new Map<string, WarehouseStockPosition>();
    next.set('UNASSIGNED', { kind: 'UNASSIGNED' });
    if (!selected) return next;
    for (const item of selected.locationBalances) {
      if (item.quantity <= 0) continue;
      next.set(warehouseStockPositionKey(item.position), item.position);
    }
    return next;
  }, [selected]);

  useEffect(() => {
    if (!positions.has(lotPositionKey)) setLotPositionKey('UNASSIGNED');
  }, [lotPositionKey, positions]);

  const invoiceMovements = useMemo(
    () =>
      movements.filter(
        (item) => item.movement.source?.kind === 'INVOICE'
      ),
    [movements]
  );

  const resetLotForm = () => {
    setEditingLotId('');
    setLotCode('');
    setLotExpiry('');
    setLotQuantity('');
    setLotPositionKey('UNASSIGNED');
    setLotOriginMovementId('');
  };

  const editLot = (lot: WarehouseLot) => {
    setEditingLotId(lot.id);
    setLotCode(lot.code);
    setLotExpiry(lot.expiresOn || '');
    setLotQuantity(String(lot.quantity));
    setLotPositionKey(warehouseStockPositionKey(lot.position));
    setLotOriginMovementId(
      lot.origin.kind === 'INVOICE' ? lot.origin.movementId || '' : ''
    );
    setMessage(null);
  };

  const buildOrigin = (): WarehouseLotOrigin => {
    const movement = invoiceMovements.find(
      (item) => item.movement.id === lotOriginMovementId
    )?.movement;
    const source = movement?.source;
    if (movement && source?.kind === 'INVOICE') {
      return {
        kind: 'INVOICE',
        movementId: movement.id,
        invoiceRecordKey: source.invoiceRecordKey,
        invoiceId: source.invoiceId,
        supplier: source.supplier,
        supplierCnpj: source.supplierCnpj,
      };
    }
    return {
      kind: 'MANUAL_ENRICHMENT',
      movementId: null,
      invoiceRecordKey: null,
      invoiceId: null,
      supplier: null,
      supplierCnpj: null,
    };
  };

  const saveLot = async () => {
    if (!selected) return;
    const quantity = Number(lotQuantity.replace(',', '.'));
    if (!lotCode.trim() || !Number.isFinite(quantity) || quantity < 0) {
      setMessage('Informe código do lote e quantidade válida.');
      return;
    }

    setWorking(true);
    setMessage(null);
    try {
      const position = positionFromKey(lotPositionKey, positions);
      if (editingLotId) {
        await updateWarehouseLot(workspaceId, editingLotId, {
          code: lotCode,
          expiresOn: lotExpiry || null,
          quantity,
          position,
          origin: buildOrigin(),
        });
        setMessage('Lote atualizado sem alterar o saldo oficial.');
      } else {
        await createWarehouseLot(workspaceId, {
          materialId: selected.material.id,
          code: lotCode,
          expiresOn: lotExpiry || null,
          quantity,
          position,
          origin: buildOrigin(),
        });
        setMessage('Lote registrado como enriquecimento logístico do estoque existente.');
      }
      resetLotForm();
      await refresh();
    } catch (error) {
      setMessage(logisticsMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const selectedLocations = selected
    ? selected.locationBalances
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          key: warehouseStockPositionKey(item.position),
          label: buildWarehousePositionLabel(
            item.position,
            state.depots,
            state.locations
          ),
          quantity: item.quantity,
        }))
    : [];

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-stock-operational">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300/70">Saldo oficial</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">warehouse_balance_v1 continua sendo a autoridade do saldo agregado.</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.035] p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300/70">Enriquecimento</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{WAREHOUSE_LOT_SCHEMA_VERSION} adiciona lote, validade, origem e posição sem gerar movimento.</p>
        </div>
        <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.035] p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300/70">FEFO</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Recomendação operacional apenas. A retirada permanece uma ação posterior e auditável.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
        <div className="flex items-center gap-2 text-slate-300">
          <Search className="h-4 w-4 text-blue-200" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.12em]">Pesquisa operacional</p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_1fr_1fr_1fr_auto]">
          <input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            data-testid="warehouse-stock-search"
            aria-label="Pesquisar estoque"
            placeholder="Material, ID, lote, validade, NF, fornecedor ou localização"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-200 outline-none focus:border-blue-300/25"
          />
          <select
            value={depotFilter}
            onChange={(event) => {
              setDepotFilter(event.target.value);
              setLocationFilter('');
            }}
            aria-label="Filtrar por depósito"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-300"
          >
            <option value="">Todos os depósitos</option>
            {state.depots.map(({ depot }) => (
              <option key={depot.id} value={depot.id}>{depot.code} · {depot.name}</option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            aria-label="Filtrar por localização"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-300"
          >
            <option value="">Todas as localizações</option>
            {state.locations
              .filter(({ location }) => !depotFilter || location.depotId === depotFilter)
              .map(({ location }) => (
                <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
              ))}
          </select>
          <select
            value={expiryFilter}
            onChange={(event) => setExpiryFilter(event.target.value)}
            aria-label="Filtrar por validade"
            className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-300"
          >
            <option value="">Todas as validades</option>
            <option value="near">Próximo do vencimento</option>
            <option value="expired">Vencido</option>
            <option value="valid">Válido</option>
            <option value="missing">Sem validade informada</option>
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={state.loading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] px-3 text-slate-400 hover:text-slate-200"
            aria-label="Atualizar estoque"
          >
            <RefreshCw className={state.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
          </button>
        </div>
      </div>

      {state.loading ? (
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">Consultando estoque, distribuição física e lotes…</div>
      ) : state.error ? (
        <div className="rounded-2xl border border-rose-300/10 bg-rose-400/[0.04] p-5 text-sm text-rose-200">{state.error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5 text-sm text-slate-400">Nenhum material corresponde aos filtros informados.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((summary) => (
            <button
              type="button"
              key={summary.material.id}
              data-testid={'warehouse-stock-row-' + summary.material.id}
              onClick={() => {
                setSelectedMaterialId(summary.material.id);
                setLocateOpen(false);
                resetLotForm();
                setMessage(null);
              }}
              className="w-full rounded-2xl border border-white/[0.07] bg-black/10 p-4 text-left transition hover:border-blue-300/15 hover:bg-blue-400/[0.025]"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_0.55fr_0.65fr_0.65fr_minmax(0,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-200">{summary.material.description}</p>
                  <p className="mt-1 truncate font-mono text-[9px] text-slate-600">{summary.material.id}</p>
                  <p className="mt-1 truncate text-[9px] text-slate-600">
                    {summary.locationLabels.length > 0
                      ? summary.locationLabels.slice(0, 2).join(' · ')
                      : 'sem posição física materializada'}
                  </p>
                  {summary.lots.some((lot) => lot.origin.kind === 'INVOICE') && (
                    <p className="mt-1 truncate text-[9px] text-blue-300/55">
                      {warehouseLotOriginLabel(
                        summary.lots.find((lot) => lot.origin.kind === 'INVOICE')!
                          .origin
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Saldo total</p>
                  <p className="mt-1 text-base font-black text-emerald-200">
                    {numberLabel(summary.balance.quantity)}{' '}
                    <span className="text-[10px] font-bold text-emerald-200/55">
                      {summary.material.unit.label || summary.material.unit.code}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Distribuído</p>
                  <p className="mt-1 text-sm font-bold text-slate-300">{numberLabel(summary.distributed)}</p>
                  <p className="text-[9px] text-slate-600">{numberLabel(summary.unassigned)} sem localização</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Lotes</p>
                  <p className="mt-1 text-sm font-bold text-slate-300">{summary.lots.length}</p>
                  <p className="text-[9px] text-slate-600">próxima {dateLabel(summary.nearestExpiry)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">FEFO / pendências</p>
                  <p className="mt-1 truncate text-xs font-bold text-blue-200">
                    {summary.fefo ? summary.fefo.code + ' · ' + dateLabel(summary.fefo.expiresOn) : 'sem recomendação FEFO'}
                  </p>
                  <p className="mt-1 text-[9px] text-slate-600">{summary.pendencies.length} pendência(s) logística(s)</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-3xl border border-blue-300/12 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_32%),rgba(0,0,0,0.16)] p-5 sm:p-6" data-testid="warehouse-material-sheet">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300/65">Ficha do material</p>
              <h3 className="mt-2 text-xl font-black text-white">{selected.material.description}</h3>
              <p className="mt-1 font-mono text-[9px] text-slate-600">{selected.material.id} · {selected.material.unit.label || selected.material.unit.code}</p>
              <div data-testid="warehouse-material-barcodes" className="mt-2 flex flex-wrap gap-1.5">
                {selected.barcodes.length > 0 ? selected.barcodes.map((barcode) => (
                  <span key={barcode} className="rounded-md border border-blue-300/10 bg-blue-400/[0.04] px-2 py-1 font-mono text-[9px] text-blue-200/70">
                    {barcode}
                  </span>
                )) : (
                  <span className="text-[10px] text-slate-600">Nenhum código de barras associado.</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMaterialId('')}
              className="w-fit rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200"
            >
              Fechar ficha
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
              <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Saldo agregado</p>
              <p className="mt-2 text-2xl font-black text-emerald-200">{numberLabel(selected.balance.quantity)}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
              <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Distribuição física</p>
              <p className="mt-2 text-sm font-black text-slate-200">{numberLabel(selected.distributed)} localizado</p>
              <p className="mt-1 text-[10px] text-slate-600">{numberLabel(selected.unassigned)} sem localização</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
              <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Lotes rastreados</p>
              <p className="mt-2 text-2xl font-black text-slate-200">{selected.lots.length}</p>
            </div>
            <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-4" data-testid="warehouse-fefo-recommendation">
              <p className="text-[9px] uppercase tracking-[0.12em] text-blue-300/70">Recomendação FEFO</p>
              <p className="mt-2 text-sm font-black text-blue-100">{selected.fefo?.code || 'Sem lote elegível'}</p>
              <p className="mt-1 text-[10px] text-slate-500">{selected.fefo ? 'validade ' + dateLabel(selected.fefo.expiresOn) : 'nenhuma saída é executada automaticamente'}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-200" aria-hidden="true" />
                    <p className="text-xs font-black text-slate-300">Localização física</p>
                  </div>
                  <button
                    type="button"
                    data-testid="warehouse-locate-in-depot"
                    onClick={() => setLocateOpen((current) => !current)}
                    className="rounded-xl border border-blue-300/15 bg-blue-400/[0.06] px-3 py-2 text-xs font-bold text-blue-100"
                  >
                    Localizar no depósito
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {selectedLocations.length === 0 && selected.unassigned <= 0 ? (
                    <p className="text-xs text-slate-500">Nenhuma posição materializada.</p>
                  ) : (
                    <>
                      {selectedLocations.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                          <span className="text-xs font-bold text-slate-300">{item.label}</span>
                          <span className="text-xs text-slate-500">{numberLabel(item.quantity)}</span>
                        </div>
                      ))}
                      {selected.unassigned > 0 && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/10 bg-amber-400/[0.03] px-3 py-2">
                          <span className="text-xs font-bold text-amber-100/80">Sem localização</span>
                          <span className="text-xs text-amber-200/60">{numberLabel(selected.unassigned)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {locateOpen && (
                  <div className="mt-4 rounded-xl border border-blue-300/12 bg-blue-400/[0.04] p-3" data-testid="warehouse-location-highlight">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-blue-300/70">Contrato preparado para a FASE 9</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {selected.locationLabels.join(' · ') || 'Sem posição física definida'}. Os IDs técnicos de depósito/local/subposição já estão preservados; nenhum croqui foi antecipado.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4" data-testid="warehouse-lot-list">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-blue-200" aria-hidden="true" />
                  <p className="text-xs font-black text-slate-300">Lotes e validade</p>
                </div>
                {selected.lots.length === 0 ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">Nenhum lote foi enriquecido. Isso não bloqueia o saldo legado.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selected.lots
                      .slice()
                      .sort((a, b) => (a.expiresOn || '9999').localeCompare(b.expiresOn || '9999'))
                      .map((lot) => (
                        <div key={lot.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-black text-slate-200">{lot.code}</p>
                                <span className={'rounded-full border px-2 py-0.5 text-[9px] font-bold ' + lotStateClass(lot)}>{lotStateLabel(lot)}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-slate-500">validade {dateLabel(lot.expiresOn)} · qtd. {numberLabel(lot.quantity)}</p>
                              <p className="mt-1 text-[10px] text-slate-600">{buildWarehousePositionLabel(lot.position, state.depots, state.locations)} · {warehouseLotOriginLabel(lot.origin)}</p>
                            </div>
                            <button type="button" onClick={() => editLot(lot)} className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-200">Editar</button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.025] p-4" data-testid="warehouse-logistics-pendencies">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-200" aria-hidden="true" />
                  <p className="text-xs font-black text-amber-100/90">Pendências logísticas</p>
                </div>
                {selected.pendencies.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">Nenhuma pendência logística identificada nesta leitura.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selected.pendencies.map((item) => (
                      <div key={item.code} className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2">
                        <p className="text-xs font-bold text-slate-300">{item.title}</p>
                        <p className="mt-1 text-[10px] leading-5 text-slate-500">{item.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.025] p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                  <p className="text-xs font-black text-emerald-100/90">{editingLotId ? 'Editar enriquecimento do lote' : 'Enriquecer com lote'}</p>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">Esta ação não gera entrada, saída ou transferência de estoque. Ela apenas associa informação logística ao saldo já existente.</p>

                <div className="mt-4 grid gap-3">
                  <input
                    value={lotCode}
                    onChange={(event) => setLotCode(event.target.value)}
                    data-testid="warehouse-lot-create-code"
                    aria-label="Código do lote"
                    placeholder="Código do lote"
                    className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-200"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="date"
                      value={lotExpiry}
                      onChange={(event) => setLotExpiry(event.target.value)}
                      data-testid="warehouse-lot-create-expiry"
                      aria-label="Validade do lote"
                      className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-300"
                    />
                    <input
                      inputMode="decimal"
                      value={lotQuantity}
                      onChange={(event) => setLotQuantity(event.target.value)}
                      data-testid="warehouse-lot-create-quantity"
                      aria-label="Quantidade rastreada no lote"
                      placeholder="Quantidade"
                      className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-200"
                    />
                  </div>
                  <select
                    value={lotPositionKey}
                    onChange={(event) => setLotPositionKey(event.target.value)}
                    data-testid="warehouse-lot-create-position"
                    aria-label="Posição do lote"
                    className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-300"
                  >
                    {Array.from(positions.entries()).map(([key, position]) => (
                      <option key={key} value={key}>
                        {buildWarehousePositionLabel(position, state.depots, state.locations)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={lotOriginMovementId}
                    onChange={(event) => setLotOriginMovementId(event.target.value)}
                    aria-label="Origem documental do lote"
                    className="h-10 rounded-xl border border-white/[0.08] bg-[#01050d] px-3 text-xs text-slate-300"
                  >
                    <option value="">Origem manual / legado</option>
                    {invoiceMovements.map(({ movement }) => {
                      const source = movement.source?.kind === 'INVOICE' ? movement.source : null;
                      return (
                        <option key={movement.id} value={movement.id}>
                          NF {source?.invoiceId || '—'} · {source?.supplier || 'Fornecedor'}
                        </option>
                      );
                    })}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveLot()}
                      disabled={working}
                      data-testid="warehouse-lot-save"
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-500/85 px-4 text-xs font-black text-white transition hover:bg-emerald-400 disabled:opacity-40"
                    >
                      {working ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Boxes className="h-3.5 w-3.5" aria-hidden="true" />}
                      {editingLotId ? 'Salvar lote' : 'Registrar lote'}
                    </button>
                    {editingLotId && (
                      <button type="button" onClick={resetLotForm} className="h-9 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-slate-400">Cancelar edição</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-200" aria-hidden="true" />
                  <p className="text-xs font-black text-slate-300">Origem e histórico oficial</p>
                </div>
                <p className="mt-2 text-[10px] text-slate-600">Consulta sob demanda · até 50 movimentos do material</p>
                {historyLoading ? (
                  <p className="mt-3 text-xs text-slate-500">Carregando ledger…</p>
                ) : movements.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">Nenhum movimento encontrado no recorte consultado.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {movements.map(({ movement, createdAt }) => {
                      const source = movement.source;
                      const invoiceSource = source?.kind === 'INVOICE' ? source : null;
                      return (
                        <div key={movement.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-[9px] font-bold text-blue-200">{movement.type}</span>
                            <span className="text-[9px] text-slate-600">{createdAt ? new Date(createdAt).toLocaleString('pt-BR') : 'horário pendente'}</span>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {invoiceSource
                              ? 'NF ' + invoiceSource.invoiceId + ' · ' + invoiceSource.supplier
                              : movement.source?.kind === 'LOCATION_TRANSFER'
                                ? 'Transferência interna'
                                : movement.note || 'Movimento auditável'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs leading-5 text-slate-300" data-testid="warehouse-phase7-message">
              {message}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-3 text-[10px] leading-5 text-slate-600">
        <div className="flex items-center gap-2 text-slate-500"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /><span>Consultas bounded: 250 materiais/saldos, 500 posições/lotes e histórico por material somente quando a ficha é aberta.</span></div>
        <div className="mt-1 flex items-center gap-2 text-slate-500"><PackageSearch className="h-3.5 w-3.5" aria-hidden="true" /><span>Código de barras, scanner e saída expressa não fazem parte desta fase.</span></div>
      </div>
    </div>
  );
}
