'use client';

import { useMemo } from 'react';
import { PackageSearch, Search, Sparkles } from 'lucide-react';

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

type IsoPoint = { x: number; y: number };

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 760;
const ORIGIN_X = 600;
const ORIGIN_Y = 170;
const FLOOR_HALF_W = 470;
const FLOOR_HALF_H = 245;

function isoPoint(
  x: number,
  y: number,
  z: number,
  logicalWidth: number,
  logicalHeight: number
): IsoPoint {
  const nx = x / Math.max(1, logicalWidth);
  const ny = y / Math.max(1, logicalHeight);
  return {
    x: ORIGIN_X + (nx - ny) * FLOOR_HALF_W,
    y: ORIGIN_Y + (nx + ny) * FLOOR_HALF_H - z,
  };
}

function points(pointsList: IsoPoint[]): string {
  return pointsList.map((point) => point.x.toFixed(1) + ',' + point.y.toFixed(1)).join(' ');
}

function objectHeight(kind: WarehouseDepotLayoutObject['kind']): number {
  if (kind === 'SHELF' || kind === 'RACK') return 120;
  if (kind === 'CABINET' || kind === 'REFRIGERATOR') return 110;
  if (kind === 'FREEZER' || kind === 'CHAMBER') return 86;
  if (kind === 'PALLET') return 18;
  if (kind === 'BENCH') return 58;
  if (kind === 'OTHER') return 12;
  return 46;
}

function fillForKind(kind: WarehouseDepotLayoutObject['kind']): {
  top: string;
  left: string;
  right: string;
  stroke: string;
} {
  if (kind === 'PALLET') {
    return { top: '#d6a96d', left: '#b77d38', right: '#9b642d', stroke: '#8a5a2a' };
  }
  if (kind === 'FREEZER' || kind === 'REFRIGERATOR' || kind === 'CHAMBER') {
    return { top: '#f7fcff', left: '#d9edf7', right: '#c4dfef', stroke: '#7ca8c0' };
  }
  if (kind === 'SHELF' || kind === 'RACK') {
    return { top: '#f8fafc', left: '#dce4ec', right: '#cbd5e1', stroke: '#385b7a' };
  }
  if (kind === 'CABINET') {
    return { top: '#f8fafc', left: '#e2e8f0', right: '#cbd5e1', stroke: '#64748b' };
  }
  return { top: '#f7fbff', left: '#e6eef7', right: '#d8e4f0', stroke: '#8da8bf' };
}

function visualBoxes(quantity: number): number {
  if (quantity <= 0) return 0;
  if (quantity < 5) return 1;
  if (quantity < 20) return 2;
  if (quantity < 60) return 3;
  return 4;
}

function WarehouseStructure({
  object,
  logicalWidth,
  logicalHeight,
  location,
  occupiedQuantity,
  highlighted,
  highlightedSubpositions,
}: {
  object: WarehouseDepotLayoutObject;
  logicalWidth: number;
  logicalHeight: number;
  location: WarehouseLocation | null;
  occupiedQuantity: number;
  highlighted: boolean;
  highlightedSubpositions: WarehouseLocation[];
}) {
  const z = objectHeight(object.kind);
  const a = isoPoint(object.x, object.y, 0, logicalWidth, logicalHeight);
  const b = isoPoint(object.x + object.width, object.y, 0, logicalWidth, logicalHeight);
  const c = isoPoint(object.x + object.width, object.y + object.height, 0, logicalWidth, logicalHeight);
  const d = isoPoint(object.x, object.y + object.height, 0, logicalWidth, logicalHeight);
  const at = isoPoint(object.x, object.y, z, logicalWidth, logicalHeight);
  const bt = isoPoint(object.x + object.width, object.y, z, logicalWidth, logicalHeight);
  const ct = isoPoint(object.x + object.width, object.y + object.height, z, logicalWidth, logicalHeight);
  const dt = isoPoint(object.x, object.y + object.height, z, logicalWidth, logicalHeight);
  const colors = fillForKind(object.kind);
  const boxCount = visualBoxes(occupiedQuantity);
  const center = isoPoint(
    object.x + object.width / 2,
    object.y + object.height / 2,
    z,
    logicalWidth,
    logicalHeight
  );

  if (object.kind === 'OTHER' && !object.warehouseLocationId) {
    return (
      <g data-visual-role="door">
        <polygon points={points([a, b, bt, at])} fill="#eef4fa" stroke="#8da8bf" strokeWidth="2" />
        <text
          x={(a.x + b.x) / 2}
          y={(a.y + b.y) / 2 - 8}
          textAnchor="middle"
          fontSize="11"
          fontWeight="800"
          fill="#36526b"
        >
          {object.label}
        </text>
      </g>
    );
  }

  const isShelf = object.kind === 'SHELF' || object.kind === 'RACK';

  return (
    <g
      data-location-id={object.warehouseLocationId || ''}
      data-occupied={boxCount > 0 ? 'true' : 'false'}
      data-highlighted={highlighted ? 'true' : 'false'}
      style={{ filter: highlighted ? 'url(#warehouseGlow)' : undefined }}
    >
      {highlighted && (
        <polygon
          points={points([a, b, c, d])}
          fill="#dbeafe"
          stroke="#2563eb"
          strokeWidth="5"
          opacity="0.9"
        />
      )}

      <polygon points={points([d, c, ct, dt])} fill={colors.left} stroke={colors.stroke} strokeWidth="2" />
      <polygon points={points([b, c, ct, bt])} fill={colors.right} stroke={colors.stroke} strokeWidth="2" />
      <polygon points={points([at, bt, ct, dt])} fill={colors.top} stroke={colors.stroke} strokeWidth="2" />

      {isShelf && (
        <>
          {[0.28, 0.56, 0.82].map((ratio) => {
            const shelfZ = z * ratio;
            const p1 = isoPoint(object.x, object.y, shelfZ, logicalWidth, logicalHeight);
            const p2 = isoPoint(object.x + object.width, object.y, shelfZ, logicalWidth, logicalHeight);
            const p3 = isoPoint(object.x + object.width, object.y + object.height, shelfZ, logicalWidth, logicalHeight);
            const p4 = isoPoint(object.x, object.y + object.height, shelfZ, logicalWidth, logicalHeight);
            return (
              <g key={ratio}>
                <polyline
                  points={points([p1, p2, p3, p4, p1])}
                  fill="none"
                  stroke="#f28c28"
                  strokeWidth="5"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
          {[a, b, c, d].map((base, index) => {
            const top = [at, bt, ct, dt][index];
            return (
              <line
                key={index}
                x1={base.x}
                y1={base.y}
                x2={top.x}
                y2={top.y}
                stroke="#294d6b"
                strokeWidth="4"
              />
            );
          })}
        </>
      )}

      {boxCount > 0 && Array.from({ length: boxCount }, (_, index) => {
        const spread = Math.max(18, Math.min(42, object.width / Math.max(1, logicalWidth) * 180));
        const dx = (index - (boxCount - 1) / 2) * spread;
        const boxY = center.y - 12 - (index % 2) * 15;
        return (
          <g key={index} transform={'translate(' + (center.x + dx) + ' ' + boxY + ')'}>
            <polygon points="-18,0 0,-10 18,0 0,10" fill="#eab676" stroke="#b97832" strokeWidth="1.5" />
            <polygon points="-18,0 0,10 0,31 -18,21" fill="#c9863f" stroke="#a8652d" strokeWidth="1.5" />
            <polygon points="18,0 0,10 0,31 18,21" fill="#b97535" stroke="#985a27" strokeWidth="1.5" />
            <line x1="0" y1="-10" x2="0" y2="10" stroke="#f7d7a9" strokeWidth="1.5" />
          </g>
        );
      })}

      <g transform={'translate(' + center.x + ' ' + (center.y - z - 14) + ')'}>
        <rect
          x="-42"
          y="-12"
          width="84"
          height="24"
          rx="7"
          fill={highlighted ? '#1d4ed8' : '#ffffff'}
          stroke={highlighted ? '#1d4ed8' : '#cbd5e1'}
          strokeWidth="1.5"
          opacity="0.96"
        />
        <text
          x="0"
          y="4"
          textAnchor="middle"
          fontSize="10"
          fontWeight="900"
          fill={highlighted ? '#ffffff' : '#334155'}
        >
          {location?.code || object.label}
        </text>
      </g>

      {highlightedSubpositions.length > 0 && highlightedSubpositions.slice(0, 4).map((subposition, index) => (
        <g
          key={subposition.id}
          transform={'translate(' + (center.x + 54) + ' ' + (center.y - z + index * 23) + ')'}
        >
          <rect
            x="0"
            y="-11"
            width="72"
            height="20"
            rx="6"
            fill="#2563eb"
            stroke="#93c5fd"
            strokeWidth="2"
          />
          <text x="36" y="3" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff">
            {subposition.code}
          </text>
        </g>
      ))}
    </g>
  );
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
      if (balance.quantity <= 0) continue;
      const position = balance.position;
      if (position.kind === 'UNASSIGNED') continue;
      map.set(position.locationId, (map.get(position.locationId) || 0) + balance.quantity);
    }
    return map;
  }, [balances]);

  const selectedMaterialBalances = useMemo(
    () => balances.filter((balance) => {
      if (balance.materialId !== selectedMaterialId || balance.quantity <= 0) return false;
      return balance.position.kind !== 'UNASSIGNED';
    }),
    [balances, selectedMaterialId]
  );

  const highlightedLocalIds = useMemo(
    () => new Set(
      selectedMaterialBalances.flatMap((balance) => {
        const position = balance.position;
        return position.kind === 'UNASSIGNED' ? [] : [position.locationId];
      })
    ),
    [selectedMaterialBalances]
  );

  const highlightedSubpositionIds = useMemo(
    () => new Set(
      selectedMaterialBalances.flatMap((balance) => {
        const position = balance.position;
        return position.kind === 'SUBPOSITION' ? [position.subpositionId] : [];
      })
    ),
    [selectedMaterialBalances]
  );

  const visibleObjects = useMemo(
    () =>
      objects
        .filter((object) => object.kind !== 'WALL' && object.kind !== 'CORRIDOR')
        .slice()
        .sort((left, right) => (left.x + left.y) - (right.x + right.y)),
    [objects]
  );

  const floor = [
    isoPoint(0, 0, 0, logicalWidth, logicalHeight),
    isoPoint(logicalWidth, 0, 0, logicalWidth, logicalHeight),
    isoPoint(logicalWidth, logicalHeight, 0, logicalWidth, logicalHeight),
    isoPoint(0, logicalHeight, 0, logicalWidth, logicalHeight),
  ];
  const wallHeight = 150;
  const backWallTop = [
    isoPoint(0, 0, wallHeight, logicalWidth, logicalHeight),
    isoPoint(logicalWidth, 0, wallHeight, logicalWidth, logicalHeight),
  ];
  const leftWallTop = [
    isoPoint(0, 0, wallHeight, logicalWidth, logicalHeight),
    isoPoint(0, logicalHeight, wallHeight, logicalWidth, logicalHeight),
  ];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
      data-testid="warehouse-isometric-preview"
    >
      <div className="flex flex-col gap-3 border-b border-blue-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#00288e]">
            <Sparkles className="h-3.5 w-3.5" /> Prévia 2.5D
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Estruturas isométricas derivadas do croqui. Caixas aparecem somente onde existe saldo físico.
          </p>
        </div>

        <div className="relative w-full sm:w-[360px]">
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

      <div className="relative min-h-[650px] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#ffffff_0%,#edf5fb_48%,#dce9f4_100%)]">
        {visibleObjects.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/90 px-6 py-5 text-center shadow-sm">
              <PackageSearch className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-xs font-black text-slate-700">O croqui ainda não possui estruturas.</p>
            </div>
          </div>
        ) : (
          <svg
            viewBox={'0 0 ' + VIEW_WIDTH + ' ' + VIEW_HEIGHT}
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label="Prévia isométrica 2.5D do depósito"
          >
            <defs>
              <linearGradient id="floorGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e8eff5" />
              </linearGradient>
              <linearGradient id="wallGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fbff" />
                <stop offset="100%" stopColor="#dce7f1" />
              </linearGradient>
              <filter id="warehouseShadow" x="-30%" y="-30%" width="160%" height="180%">
                <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#0f2740" floodOpacity="0.16" />
              </filter>
              <filter id="warehouseGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#2563eb" floodOpacity="0.95" />
              </filter>
              <pattern id="floorGrid" width="34" height="17" patternUnits="userSpaceOnUse" patternTransform="skewY(26)">
                <path d="M 34 0 L 0 0 0 17" fill="none" stroke="#cbd5e1" strokeWidth="0.7" opacity="0.45" />
              </pattern>
            </defs>

            <g filter="url(#warehouseShadow)">
              <polygon
                points={points([
                  floor[0],
                  floor[1],
                  backWallTop[1],
                  backWallTop[0],
                ])}
                fill="url(#wallGradient)"
                stroke="#b8c8d8"
                strokeWidth="2"
              />
              <polygon
                points={points([
                  floor[0],
                  floor[3],
                  leftWallTop[1],
                  leftWallTop[0],
                ])}
                fill="url(#wallGradient)"
                stroke="#b8c8d8"
                strokeWidth="2"
              />
              <polygon
                points={points(floor)}
                fill="url(#floorGradient)"
                stroke="#9fb2c5"
                strokeWidth="2.5"
              />
              <polygon points={points(floor)} fill="url(#floorGrid)" opacity="0.7" />
            </g>

            <g>
              {visibleObjects.map((object) => {
                const locationId = object.warehouseLocationId || '';
                const location = locationId ? locationById.get(locationId) || null : null;
                const occupiedQuantity = locationId ? occupancyByLocal.get(locationId) || 0 : 0;
                const highlighted = Boolean(locationId && highlightedLocalIds.has(locationId));
                const highlightedSubpositions = location
                  ? locations.filter(
                      (candidate) =>
                        candidate.kind === 'SUBPOSITION'
                        && candidate.parentLocationId === location.id
                        && candidate.status === 'active'
                        && highlightedSubpositionIds.has(candidate.id)
                    )
                  : [];

                return (
                  <WarehouseStructure
                    key={object.id}
                    object={object}
                    logicalWidth={logicalWidth}
                    logicalHeight={logicalHeight}
                    location={location}
                    occupiedQuantity={occupiedQuantity}
                    highlighted={highlighted}
                    highlightedSubpositions={highlightedSubpositions}
                  />
                );
              })}
            </g>
          </svg>
        )}
      </div>
    </section>
  );
}
