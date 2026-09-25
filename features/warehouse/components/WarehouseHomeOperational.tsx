'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Boxes,
  ChevronDown,
  Compass,
  Layers3,
  LocateFixed,
  MapPin,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  Warehouse,
} from 'lucide-react';

import { listWarehouseBalances } from '../../../lib/warehouse/ledgerRepository';
import {
  listWarehouseDepots,
  listWarehouseLocationBalances,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationBalanceListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  warehouseLocationIdForPosition,
  type WarehouseDepotLayout,
  type WarehouseDepotLayoutObject,
} from '../../../lib/warehouse/layout';
import { getActiveWarehouseDepotLayout } from '../../../lib/warehouse/layoutRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseBalance } from '../../../lib/warehouse/movement';
import {
  warehouseLotExpiryState,
  type WarehouseLot,
  type WarehouseLotExpiryState,
} from '../../../lib/warehouse/lot';
import { listWarehouseLots } from '../../../lib/warehouse/lotRepository';

type ViewMode = 'isometric' | 'top';

interface WarehouseHomeData {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  locationBalances: WarehouseLocationBalanceListItem[];
  balances: WarehouseBalance[];
}

const INITIAL_DATA: WarehouseHomeData = {
  loading: true,
  error: null,
  materials: [],
  depots: [],
  locations: [],
  locationBalances: [],
  balances: [],
};

const formatQuantity = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const expiryLabel: Record<WarehouseLotExpiryState, string> = {
  VALID: 'Válido',
  NEAR_EXPIRY: 'Próximo do vencimento',
  EXPIRED: 'Vencido',
  NO_EXPIRY: 'Sem validade informada',
  DEPLETED: 'Esgotado',
  INACTIVE: 'Inativo',
};

function unitLabel(material: WarehouseMaterial | null): string {
  if (!material) return 'un.';
  return material.unit.label || material.unit.code || 'un.';
}

function isPositionInDepot(
  item: WarehouseLocationBalanceListItem,
  depotId: string
): boolean {
  const { position } = item.balance;
  return position.kind !== 'UNASSIGNED' && position.depotId === depotId;
}

function objectVisualClass(
  object: WarehouseDepotLayoutObject,
  highlighted: boolean,
  dimmed: boolean
): string {
  const common =
    'absolute flex items-center justify-center overflow-hidden rounded-[10px] border text-center transition-all duration-300';

  if (highlighted) {
    return common +
      ' border-blue-600 bg-blue-500/25 text-blue-950 ring-4 ring-blue-500/15 shadow-[0_18px_32px_rgba(37,99,235,0.28)]';
  }

  if (dimmed) {
    return common +
      ' border-slate-200 bg-slate-100/70 text-slate-400 opacity-45';
  }

  if (object.kind === 'CORRIDOR' || object.kind === 'AREA' || object.kind === 'ZONE') {
    return common +
      ' border-slate-200/90 bg-slate-50/70 text-slate-500';
  }

  if (object.kind === 'CHAMBER' || object.kind === 'FREEZER') {
    return common +
      ' border-cyan-200 bg-cyan-50/95 text-cyan-950 shadow-[0_10px_24px_rgba(14,116,144,0.12)]';
  }

  return common +
    ' border-slate-300 bg-[linear-gradient(135deg,#ffffff_0%,#e8eef5_55%,#d9e2ec_100%)] text-slate-700 shadow-[10px_14px_20px_rgba(15,23,42,0.14)]';
}

function DepotCanvas({
  layout,
  highlightedLocationIds,
  fefoLocationIds,
  searchActive,
  mode,
  rotation,
  selectedStructureId,
  onSelectStructure,
}: {
  layout: WarehouseDepotLayout;
  highlightedLocationIds: Set<string>;
  fefoLocationIds: Set<string>;
  searchActive: boolean;
  mode: ViewMode;
  rotation: number;
  selectedStructureId: string;
  onSelectStructure: (objectId: string) => void;
}) {
  const objects = useMemo(
    () => layout.objects
      .filter((object) => object.kind !== 'WALL')
      .slice()
      .sort((left, right) => left.layer - right.layer || left.id.localeCompare(right.id)),
    [layout]
  );

  const floorTransform = mode === 'top'
    ? `perspective(1600px) rotateX(0deg) rotateZ(${rotation}deg) scale(0.88)`
    : `perspective(1500px) rotateX(56deg) rotateZ(${rotation}deg) scale(0.79)`;

  return (
    <div
      className="relative min-h-[520px] overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_50%_18%,rgba(59,130,246,0.06),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] sm:min-h-[610px]"
      data-testid="warehouse-home-canvas"
    >
      <div className="absolute inset-x-0 top-5 flex justify-center">
        <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 shadow-sm">
          {mode === 'top' ? 'Vista superior' : 'Perspectiva isométrica'} · {((rotation % 360) + 360) % 360}°
        </div>
      </div>

      <div className="absolute inset-8 top-16 flex items-center justify-center sm:inset-12 sm:top-20">
        <div
          className="relative h-[76%] w-[88%] origin-center rounded-[28px] border-2 border-slate-300/80 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(145deg,#ffffff,#f1f5f9)] shadow-[0_40px_80px_-30px_rgba(15,23,42,0.28)] transition-transform duration-500 ease-out"
          style={{
            transform: floorTransform,
            transformStyle: 'preserve-3d',
            backgroundSize: '28px 28px,28px 28px,auto',
          }}
          aria-label={'Croqui ' + layout.name}
        >
          <div className="pointer-events-none absolute inset-3 rounded-[20px] border border-dashed border-slate-300/70" />

          {objects.map((object) => {
            const highlighted = Boolean(
              object.warehouseLocationId &&
              highlightedLocationIds.has(object.warehouseLocationId)
            );
            const fefoPriority = Boolean(
              object.warehouseLocationId &&
              fefoLocationIds.has(object.warehouseLocationId)
            );
            const selected = object.id === selectedStructureId;
            const dimmed = searchActive && Boolean(object.warehouseLocationId) && !highlighted;
            const raised = (
              object.kind === 'RACK' ||
              object.kind === 'SHELF' ||
              object.kind === 'CABINET' ||
              object.kind === 'CHAMBER' ||
              object.kind === 'FREEZER' ||
              object.kind === 'REFRIGERATOR' ||
              object.kind === 'PALLET'
            );
            const objectDepth = raised ? Math.max(8, Math.min(34, object.elevation * 3 + 10)) : 1;

            return (
              <button
                type="button"
                key={object.id}
                onClick={() => onSelectStructure(object.id)}
                data-testid={'warehouse-home-object-' + object.id}
                data-location-id={object.warehouseLocationId || ''}
                data-highlighted={highlighted ? 'true' : 'false'}
                className={objectVisualClass(object, highlighted, dimmed) + (selected ? ' outline outline-2 outline-offset-2 outline-slate-500/50' : '')}
                style={{
                  left: (object.x / layout.logicalWidth * 100) + '%',
                  top: (object.y / layout.logicalHeight * 100) + '%',
                  width: (object.width / layout.logicalWidth * 100) + '%',
                  height: (object.height / layout.logicalHeight * 100) + '%',
                  zIndex: object.layer + 2,
                  transform:
                    'rotate(' + object.rotation + 'deg) translateZ(' + objectDepth + 'px)',
                  transformStyle: 'preserve-3d',
                  boxShadow: highlighted
                    ? '0 18px 34px rgba(37,99,235,0.28)'
                    : raised
                      ? '10px 14px 20px rgba(15,23,42,0.14)'
                      : undefined,
                }}
                title={object.label}
              >
                <span className="max-w-full truncate px-2 text-[9px] font-black sm:text-[10px]">
                  {object.label}
                </span>
                {highlighted && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_0_5px_rgba(37,99,235,0.14)]" />
                )}
                {fefoPriority && (
                  <span
                    className="absolute left-1.5 top-1.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-amber-700"
                    title="Prioridade FEFO"
                  >
                    FEFO
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/88 px-3 py-2.5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
          <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-slate-100" />
          Estrutura cadastrada
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
          <span className="h-2.5 w-2.5 rounded-sm border border-blue-600 bg-blue-500/30" />
          Localização do item
        </div>
      </div>
    </div>
  );
}

export function WarehouseHomeOperational({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<WarehouseHomeData>(INITIAL_DATA);
  const [query, setQuery] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [lots, setLots] = useState<WarehouseLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('isometric');
  const [rotation, setRotation] = useState(0);
  const [activeLayout, setActiveLayout] = useState<WarehouseDepotLayout | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [selectedStructureId, setSelectedStructureId] = useState('');

  const reload = useCallback(async () => {
    setData((current) => ({ ...current, loading: true, error: null }));
    try {
      const [materials, depots, locations, locationBalances, balances] =
        await Promise.all([
          listWarehouseMaterials(workspaceId, 250),
          listWarehouseDepots(workspaceId, 250),
          listWarehouseLocations(workspaceId, 500),
          listWarehouseLocationBalances(workspaceId, 500),
          listWarehouseBalances(workspaceId, 250),
        ]);

      setData({
        loading: false,
        error: null,
        materials,
        depots,
        locations,
        locationBalances,
        balances,
      });

      const activeDepots = depots.filter((item) => item.depot.status === 'active');
      setSelectedDepotId((current) => {
        if (current && activeDepots.some((item) => item.depot.id === current)) return current;
        return activeDepots[0]?.depot.id || '';
      });
    } catch (error) {
      setData((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Falha ao carregar o Início do ADM Depósito.',
      }));
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let active = true;
    if (!selectedMaterialId) {
      setLots([]);
      setLotsLoading(false);
      return;
    }

    setLotsLoading(true);
    void listWarehouseLots(workspaceId, 500, selectedMaterialId)
      .then((items) => {
        if (active) setLots(items.map((item) => item.lot));
      })
      .catch(() => {
        if (active) setLots([]);
      })
      .finally(() => {
        if (active) setLotsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedMaterialId, workspaceId]);

  const activeDepots = useMemo(
    () => data.depots.filter((item) => item.depot.status === 'active'),
    [data.depots]
  );

  const selectedDepot = useMemo(
    () => activeDepots.find((item) => item.depot.id === selectedDepotId)?.depot || null,
    [activeDepots, selectedDepotId]
  );

  const selectedMaterial = useMemo(
    () => data.materials.find((material) => material.id === selectedMaterialId) || null,
    [data.materials, selectedMaterialId]
  );

  const materialMatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return [];
    return data.materials
      .filter((material) =>
        [material.description, material.id, ...material.aliases]
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(normalized)
      )
      .slice(0, 8);
  }, [data.materials, query]);

  useEffect(() => {
    let active = true;
    setSelectedStructureId('');
    if (!selectedDepotId) {
      setActiveLayout(null);
      setLayoutLoading(false);
      return;
    }

    setLayoutLoading(true);
    void getActiveWarehouseDepotLayout(workspaceId, selectedDepotId)
      .then((item) => {
        if (active) setActiveLayout(item?.layout || null);
      })
      .catch(() => {
        if (active) setActiveLayout(null);
      })
      .finally(() => {
        if (active) setLayoutLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDepotId, workspaceId]);

  const selectedLayout = activeLayout;

  const depotMaterialBalances = useMemo(
    () => data.locationBalances.filter(
      (item) =>
        Boolean(selectedMaterialId) &&
        item.balance.materialId === selectedMaterialId &&
        item.balance.quantity > 0 &&
        isPositionInDepot(item, selectedDepotId)
    ),
    [data.locationBalances, selectedDepotId, selectedMaterialId]
  );

  const highlightedLocationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of depotMaterialBalances) {
      const position = item.balance.position;
      const primary = warehouseLocationIdForPosition(position);
      if (primary) ids.add(primary);
      if (position.kind === 'SUBPOSITION') ids.add(position.locationId);
    }
    return ids;
  }, [depotMaterialBalances]);

  const representedLocationIds = useMemo(
    () => new Set(
      (selectedLayout?.objects || [])
        .map((object) => object.warehouseLocationId)
        .filter(Boolean) as string[]
    ),
    [selectedLayout]
  );

  const totalQuantity = useMemo(
    () => data.balances.find((balance) => balance.materialId === selectedMaterialId)?.quantity || 0,
    [data.balances, selectedMaterialId]
  );

  const depotQuantity = useMemo(
    () => depotMaterialBalances.reduce((sum, item) => sum + item.balance.quantity, 0),
    [depotMaterialBalances]
  );

  const locationRows = useMemo(() => depotMaterialBalances.map((item) => {
    const position = item.balance.position;
    if (position.kind === 'UNASSIGNED') return null;
    const primaryId = position.kind === 'SUBPOSITION' ? position.subpositionId : position.locationId;
    const location = data.locations.find((candidate) => candidate.location.id === primaryId)?.location;
    const parent = position.kind === 'SUBPOSITION'
      ? data.locations.find((candidate) => candidate.location.id === position.locationId)?.location
      : null;

    const visualIds = position.kind === 'SUBPOSITION'
      ? [position.subpositionId, position.locationId]
      : [position.locationId];

    return {
      id: item.balance.id,
      label: position.kind === 'SUBPOSITION'
        ? [parent?.code, location?.code].filter(Boolean).join(' → ')
        : location?.code || primaryId,
      name: location?.name || 'Localização cadastrada',
      quantity: item.balance.quantity,
      represented: visualIds.some((id) => representedLocationIds.has(id)),
      visualIds,
    };
  }).filter(Boolean) as Array<{
    id: string;
    label: string;
    name: string;
    quantity: number;
    represented: boolean;
    visualIds: string[];
  }>, [
    data.locations,
    depotMaterialBalances,
    representedLocationIds,
  ]);

  const depotLots = useMemo(
    () => lots
      .filter((lot) =>
        lot.status === 'active' &&
        lot.quantity > 0 &&
        lot.position.kind !== 'UNASSIGNED' &&
        lot.position.depotId === selectedDepotId
      )
      .sort((left, right) => (left.expiresOn || '9999-12-31').localeCompare(right.expiresOn || '9999-12-31')),
    [lots, selectedDepotId]
  );

  const fefoLot = useMemo(
    () => depotLots.find((lot) => Boolean(lot.expiresOn)) || null,
    [depotLots]
  );

  const fefoLocationIds = useMemo(() => {
    const ids = new Set<string>();
    if (!fefoLot) return ids;
    const primary = warehouseLocationIdForPosition(fefoLot.position);
    if (primary) ids.add(primary);
    if (fefoLot.position.kind === 'SUBPOSITION') ids.add(fefoLot.position.locationId);
    return ids;
  }, [fefoLot]);

  const selectedStructure = useMemo(
    () => selectedLayout?.objects.find((object) => object.id === selectedStructureId) || null,
    [selectedLayout, selectedStructureId]
  );

  const selectedStructureRows = useMemo(() => {
    if (!selectedStructure?.warehouseLocationId) return [];
    return locationRows.filter((row) => row.visualIds.includes(selectedStructure.warehouseLocationId!));
  }, [locationRows, selectedStructure]);

  const selectMaterial = (material: WarehouseMaterial) => {
    setSelectedMaterialId(material.id);
    setQuery(material.description);
  };

  if (data.loading && !data.depots.length) {
    return (
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">
        Carregando a visão operacional do depósito…
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-5" data-testid="warehouse-home-operational">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_22px_70px_-45px_rgba(15,23,42,0.38)]">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#00288e]/55">
                <Sparkles className="h-3.5 w-3.5" />
                Central visual do depósito
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Localize. Identifique. Encontre.
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                Consulte o material e veja onde ele está armazenado, com saldo, lotes,
                validade e destaque direto no croqui do depósito selecionado.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void reload()}
              disabled={data.loading}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-[#00288e]"
            >
              <RefreshCw className={data.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Atualizar
            </button>
          </div>
        </div>

        {data.error && (
          <div className="mx-5 mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 sm:mx-7">
            {data.error}
          </div>
        )}

        <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Consulta de itens
              </label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    const nextQuery = event.target.value;
                    setQuery(nextQuery);
                    if (!selectedMaterial || nextQuery !== selectedMaterial.description) {
                      setSelectedMaterialId('');
                    }
                  }}
                  placeholder="Nome, descrição ou código"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                  data-testid="warehouse-home-material-search"
                />

                {query.trim() && !selectedMaterial && materialMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-[48px] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    {materialMatches.map((material) => (
                      <button
                        key={material.id}
                        type="button"
                        onClick={() => selectMaterial(material)}
                        className="block w-full border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-blue-50"
                      >
                        <p className="truncate text-xs font-black text-slate-800">{material.description}</p>
                        <p className="mt-1 truncate font-mono text-[9px] text-slate-400">{material.id}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Depósito
              </label>
              <div className="relative mt-2">
                <Warehouse className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <select
                  value={selectedDepotId}
                  onChange={(event) => setSelectedDepotId(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                  data-testid="warehouse-home-depot-select"
                >
                  {!activeDepots.length && <option value="">Nenhum depósito cadastrado</option>}
                  {activeDepots.map(({ depot }) => (
                    <option key={depot.id} value={depot.id}>
                      {depot.code} · {depot.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {selectedMaterial ? (
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#00288e]">
                    <Box className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Item localizado</p>
                    <h3 className="mt-1 text-sm font-black leading-5 text-slate-900">{selectedMaterial.description}</h3>
                    <p className="mt-1 font-mono text-[9px] text-slate-400">{selectedMaterial.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Saldo total</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{formatQuantity(totalQuantity)}</p>
                    <p className="text-[9px] font-bold text-slate-400">{unitLabel(selectedMaterial)}</p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-500">Neste depósito</p>
                    <p className="mt-1 text-xl font-black text-[#00288e]">{formatQuantity(depotQuantity)}</p>
                    <p className="text-[9px] font-bold text-blue-400">{locationRows.length} posição(ões)</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <LocateFixed className="h-3.5 w-3.5" />
                    Localizações
                  </div>
                  <div className="mt-2 space-y-2">
                    {locationRows.length ? locationRows.map((row) => (
                      <div key={row.id} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-slate-700">{row.label}</p>
                            <p className="mt-0.5 truncate text-[9px] text-slate-400">{row.name}</p>
                            {!row.represented && (
                              <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-amber-600">
                                Ainda não representada no croqui
                              </p>
                            )}
                          </div>
                          <p className="shrink-0 text-xs font-black text-[#00288e]">{formatQuantity(row.quantity)}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-[10px] leading-4 text-slate-400">
                        O item não possui saldo posicionado neste depósito.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <Layers3 className="h-3.5 w-3.5" />
                    Lotes e validade
                  </div>
                  <div className="mt-2 space-y-2">
                    {lotsLoading ? (
                      <p className="text-[10px] text-slate-400">Consultando lotes…</p>
                    ) : depotLots.length ? depotLots.slice(0, 6).map((lot) => {
                      const state = warehouseLotExpiryState(lot);
                      return (
                        <div key={lot.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-slate-700">Lote {lot.code}</p>
                              <p className="mt-1 text-[9px] font-semibold text-slate-400">
                                {lot.expiresOn ? 'Validade ' + new Date(lot.expiresOn + 'T00:00:00').toLocaleDateString('pt-BR') : 'Validade não informada'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-slate-700">{formatQuantity(lot.quantity)}</p>
                              <p className={state === 'EXPIRED' ? 'mt-1 text-[8px] font-black uppercase text-rose-500' : state === 'NEAR_EXPIRY' ? 'mt-1 text-[8px] font-black uppercase text-amber-500' : 'mt-1 text-[8px] font-black uppercase text-emerald-500'}>
                                {expiryLabel[state]}
                              </p>
                              {fefoLot?.id === lot.id && (
                                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-amber-600">
                                  Prioridade FEFO
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-[10px] leading-4 text-slate-400">
                        Nenhum lote ativo vinculado a este item no depósito selecionado.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-5 text-center">
                <PackageSearch className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-3 text-xs font-black text-slate-600">Consulte um item</p>
                <p className="mt-1 text-[10px] leading-5 text-slate-400">
                  A ficha logística aparecerá aqui e o croqui destacará automaticamente a posição física.
                </p>
              </div>
            )}
          </aside>

          <div className="min-w-0">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-[#00288e]" />
                  <p className="text-xs font-black text-slate-800">
                    {selectedDepot ? selectedDepot.name : 'Croqui do depósito'}
                  </p>
                </div>
                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  Planta 2.5D sem paredes · os limites físicos são representados pelo piso.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((value) => value - 90)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-[#00288e]"
                  title="Girar para a esquerda"
                  aria-label="Girar croqui para a esquerda"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((value) => value + 90)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-[#00288e]"
                  title="Girar para a direita"
                  aria-label="Girar croqui para a direita"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode((value) => value === 'top' ? 'isometric' : 'top')}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 shadow-sm hover:text-[#00288e]"
                >
                  {viewMode === 'top' ? <Compass className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  {viewMode === 'top' ? 'Isométrica' : 'Ver de cima'}
                </button>
              </div>
            </div>

            {layoutLoading ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-400">
                Carregando o croqui ativo deste depósito…
              </div>
            ) : selectedLayout ? (
              <DepotCanvas
                layout={selectedLayout}
                highlightedLocationIds={highlightedLocationIds}
                fefoLocationIds={fefoLocationIds}
                searchActive={Boolean(selectedMaterial)}
                mode={viewMode}
                rotation={rotation}
                selectedStructureId={selectedStructureId}
                onSelectStructure={setSelectedStructureId}
              />
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center">
                <div className="max-w-md">
                  <Warehouse className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-4 text-base font-black text-slate-700">Croqui ainda não configurado</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    O depósito pode ser utilizado normalmente. Quando um croqui for cadastrado,
                    esta área passa a representar as posições físicas e os itens encontrados.
                  </p>
                  <Link
                    href="/adm-deposito/meus-depositos?aba=croquis"
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-lg shadow-blue-900/15"
                  >
                    <LocateFixed className="h-4 w-4" />
                    Configurar croqui
                  </Link>
                </div>
              </div>
            )}

            {selectedStructure && selectedMaterial && (
              <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/55 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-500">
                      Estrutura selecionada
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-800">{selectedStructure.label}</p>
                  </div>
                  {selectedStructure.warehouseLocationId && (
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 font-mono text-[9px] font-bold text-blue-700">
                      {selectedStructure.warehouseLocationId}
                    </span>
                  )}
                </div>
                {selectedStructureRows.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selectedStructureRows.map((row) => (
                      <div key={row.id} className="rounded-xl border border-blue-100 bg-white px-3 py-2.5">
                        <p className="text-[10px] font-black text-slate-700">{row.label}</p>
                        <p className="mt-1 text-[9px] text-slate-400">{row.name}</p>
                        <p className="mt-2 text-xs font-black text-[#00288e]">
                          {formatQuantity(row.quantity)} {unitLabel(selectedMaterial)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-500">
                    Esta estrutura não contém saldo do material pesquisado.
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-[#00288e]" />
                {selectedMaterial
                  ? highlightedLocationIds.size
                    ? highlightedLocationIds.size + ' posição(ões) destacada(s) no croqui'
                    : 'Item sem posição visual neste depósito'
                  : 'Pesquise um item para destacar sua localização'}
              </div>
              <Link
                href="/adm-deposito/meus-depositos?aba=croquis"
                className="text-[10px] font-black uppercase tracking-[0.12em] text-[#00288e] hover:underline"
              >
                Editar visão do depósito
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
