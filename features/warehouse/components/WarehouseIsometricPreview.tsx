'use client';

import { useMemo } from 'react';
import { Box, PackageSearch, Search, Sparkles } from 'lucide-react';

import type { WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import type {
  WarehouseLocation,
  WarehouseLocationBalance,
} from '../../../lib/warehouse/location';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';

type Props = {
  logicalWidth: number;
  logicalHeight: number;
  objects: WarehouseDepotLayoutObject[];
  locations: WarehouseLocation[];
  balances: WarehouseLocationBalance[];
  materials: WarehouseMaterial[];
  selectedMaterialId: string;
  queryText: string;
  onQueryTextChange: (value: string) => void;
  onSelectedMaterialIdChange: (value: string) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isoPoint(
  x: number,
  y: number,
  logicalWidth: number,
  logicalHeight: number
): { left: number; top: number } {
  const nx = x / Math.max(1, logicalWidth);
  const ny = y / Math.max(1, logicalHeight);
  return {
    left: 50 + (nx - ny) * 42,
    top: 12 + (nx + ny) * 34,
  };
}

function visualHeight(kind: WarehouseDepotLayoutObject['kind']): number {
  if (kind === 'SHELF' || kind === 'RACK') return 68;
  if (kind === 'CABINET' || kind === 'REFRIGERATOR') return 62;
  if (kind === 'FREEZER' || kind === 'CHAMBER') return 52;
  if (kind === 'PALLET') return 24;
  if (kind === 'BENCH') return 34;
  if (kind === 'OTHER') return 16;
  return 30;
}

function objectFaceClass(kind: WarehouseDepotLayoutObject['kind']): string {
  if (kind === 'FREEZER' || kind === 'REFRIGERATOR' || kind === 'CHAMBER') {
    return 'border-cyan-300/90 bg-gradient-to-br from-white via-cyan-50 to-blue-100';
  }
  if (kind === 'PALLET') {
    return 'border-amber-500/70 bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300';
  }
  if (kind === 'SHELF' || kind === 'RACK') {
    return 'border-slate-400 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200';
  }
  if (kind === 'CABINET') {
    return 'border-slate-400 bg-gradient-to-br from-white via-slate-100 to-slate-300';
  }
  return 'border-blue-200 bg-gradient-to-br from-white via-blue-50 to-slate-100';
}

function boxesFor(quantity: number): number {
  if (quantity <= 0) return 0;
  if (quantity < 5) return 1;
  if (quantity < 20) return 2;
  return 3;
}

export function WarehouseIsometricPreview({
  logicalWidth,
  logicalHeight,
  objects,
  locations,
  balances,
  materials,
  selectedMaterialId,
  queryText,
  onQueryTextChange,
  onSelectedMaterialIdChange,
}: Props) {
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  );

  const materialMatches = useMemo(() => {
    const normalized = queryText.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return materials.slice(0, 8);
    return materials
      .filter((material) =>
        [material.id, material.description, ...(material.aliases || [])]
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(normalized)
      )
      .slice(0, 8);
  }, [materials, queryText]);

  const occupancyByLocal = useMemo(() => {
    const map = new Map<string, number>();
    for (const balance of balances) {
      if (balance.quantity <= 0 || balance.position.kind === 'UNASSIGNED') continue;
      const current = map.get(balance.position.locationId) || 0;
      map.set(balance.position.locationId, current + balance.quantity);
    }
    return map;
  }, [balances]);

  const selectedMaterialBalances = useMemo(
    () => balances.filter(
      (balance) =>
        balance.materialId === selectedMaterialId
        && balance.quantity > 0
        && balance.position.kind !== 'UNASSIGNED'
    ),
    [balances, selectedMaterialId]
  );

  const highlightedLocalIds = useMemo(
    () => new Set(
      selectedMaterialBalances
        .filter((balance) => balance.position.kind !== 'UNASSIGNED')
        .map((balance) => balance.position.locationId)
    ),
    [selectedMaterialBalances]
  );

  const highlightedSubpositionIds = useMemo(
    () => new Set(
      selectedMaterialBalances
        .filter(
          (balance): balance is WarehouseLocationBalance & {
            position: {
              kind: 'SUBPOSITION';
              depotId: string;
              locationId: string;
              subpositionId: string;
            };
          } => balance.position.kind === 'SUBPOSITION'
        )
        .map((balance) => balance.position.subpositionId)
    ),
    [selectedMaterialBalances]
  );

  const visibleObjects = useMemo(
    () => objects.filter((object) => object.kind !== 'WALL' && object.kind !== 'CORRIDOR'),
    [objects]
  );

  return (
    <section
      className="overflow-hidden rounded-2xl border border-blue-100 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5fb_52%,#e6edf5_100%)] shadow-sm"
      data-testid="warehouse-isometric-preview"
    >
      <div className="flex flex-col gap-3 border-b border-blue-100 bg-white/85 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#00288e]">
            <Sparkles className="h-3.5 w-3.5" /> Prévia 2.5D
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            A ocupação aparece somente onde existe saldo físico. A consulta ilumina o Local ou a Subposição correspondente.
          </p>
        </div>

        <div className="relative w-full sm:w-[330px]">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={queryText}
            onChange={(event) => {
              onQueryTextChange(event.target.value);
              onSelectedMaterialIdChange('');
            }}
            placeholder="Consultar item para localizar…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          {queryText.trim() && !selectedMaterialId && materialMatches.length > 0 && (
            <div className="absolute right-0 top-11 z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              {materialMatches.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => {
                    onSelectedMaterialIdChange(material.id);
                    onQueryTextChange(material.description);
                  }}
                  className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50"
                >
                  <span className="block truncate text-[11px] font-black text-slate-800">
                    {material.description}
                  </span>
                  <span className="block truncate font-mono text-[9px] text-slate-400">
                    {material.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative min-h-[560px] overflow-hidden px-4 pb-8 pt-5">
        <div
          className="absolute left-1/2 top-[48%] h-[68%] w-[72%] -translate-x-1/2 -translate-y-1/2 border border-slate-300 bg-white/90 shadow-[0_32px_60px_rgba(15,23,42,0.12)]"
          style={{
            transform: 'translate(-50%,-50%) rotateX(60deg) rotateZ(45deg)',
            transformOrigin: 'center',
          }}
        />

        <div className="pointer-events-none absolute left-[14%] top-[11%] h-[56%] w-[8px] origin-top -rotate-[45deg] rounded-full bg-slate-300/80 shadow-sm" />
        <div className="pointer-events-none absolute right-[14%] top-[11%] h-[56%] w-[8px] origin-top rotate-[45deg] rounded-full bg-slate-300/80 shadow-sm" />

        {visibleObjects
          .slice()
          .sort((a, b) => (a.x + a.y) - (b.x + b.y))
          .map((object) => {
            const centerX = object.x + object.width / 2;
            const centerY = object.y + object.height / 2;
            const point = isoPoint(centerX, centerY, logicalWidth, logicalHeight);
            const widthPct = clamp(object.width / Math.max(1, logicalWidth) * 34, 4, 18);
            const depthPct = clamp(object.height / Math.max(1, logicalHeight) * 22, 2.5, 13);
            const heightPx = visualHeight(object.kind);
            const locationId = object.warehouseLocationId || '';
            const occupiedQuantity = locationId ? occupancyByLocal.get(locationId) || 0 : 0;
            const boxCount = boxesFor(occupiedQuantity);
            const highlighted = Boolean(locationId && highlightedLocalIds.has(locationId));
            const local = locationId ? locationById.get(locationId) : null;
            const subpositions = local
              ? locations.filter(
                  (location) =>
                    location.kind === 'SUBPOSITION'
                    && location.parentLocationId === local.id
                    && location.status === 'active'
                )
              : [];
            const highlightedSubs = subpositions.filter((subposition) =>
              highlightedSubpositionIds.has(subposition.id)
            );

            return (
              <div
                key={object.id}
                className="absolute"
                style={{
                  left: point.left + '%',
                  top: point.top + '%',
                  width: widthPct + '%',
                  zIndex: Math.round(point.top * 10) + object.layer,
                  transform: 'translate(-50%,-72%)',
                }}
              >
                <div
                  className={
                    'relative rounded-md border shadow-[0_10px_18px_rgba(15,23,42,0.18)] transition-all duration-300 '
                    + objectFaceClass(object.kind)
                    + (highlighted
                      ? ' ring-4 ring-blue-400/70 shadow-[0_0_28px_rgba(37,99,235,0.55)]'
                      : '')
                  }
                  style={{
                    minHeight: Math.max(24, depthPct * 4.2) + heightPx,
                    transform: 'skewY(-4deg)',
                  }}
                  data-location-id={locationId}
                  data-occupied={boxCount > 0 ? 'true' : 'false'}
                  data-highlighted={highlighted ? 'true' : 'false'}
                >
                  <div className="absolute inset-x-2 top-2 truncate rounded bg-white/85 px-1.5 py-1 text-center text-[9px] font-black text-slate-700 shadow-sm">
                    {local?.code || object.label}
                  </div>

                  {(object.kind === 'SHELF' || object.kind === 'RACK') && (
                    <div className="absolute inset-x-2 bottom-3 top-9 grid grid-rows-3 gap-1">
                      {[0, 1, 2].map((row) => (
                        <div key={row} className="border-b border-slate-400/80 bg-white/35" />
                      ))}
                    </div>
                  )}

                  {boxCount > 0 && (
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-end gap-1">
                      {Array.from({ length: boxCount }, (_, index) => (
                        <div
                          key={index}
                          className="relative h-6 w-6 rounded-sm border border-amber-500/70 bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 shadow-sm"
                          style={{ transform: 'translateY(' + (index % 2 ? -5 : 0) + 'px)' }}
                        >
                          <Box className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-amber-700/60" />
                        </div>
                      ))}
                    </div>
                  )}

                  {highlightedSubs.length > 0 && (
                    <div className="absolute -right-2 top-8 space-y-1">
                      {highlightedSubs.slice(0, 4).map((subposition) => (
                        <div
                          key={subposition.id}
                          className="animate-pulse rounded-md border border-blue-300 bg-blue-600 px-1.5 py-1 text-[8px] font-black text-white shadow-[0_0_18px_rgba(37,99,235,0.55)]"
                        >
                          {subposition.code}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {visibleObjects.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-5 text-center shadow-sm">
              <PackageSearch className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-xs font-black text-slate-700">O croqui ainda não possui estruturas.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
