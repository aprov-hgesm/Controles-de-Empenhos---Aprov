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
const ORIGIN_Y = 165;
const FLOOR_HALF_W = 472;
const FLOOR_HALF_H = 246;

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

function polygonPoints(pointsList: IsoPoint[]): string {
  return pointsList.map((point) => point.x.toFixed(1) + ',' + point.y.toFixed(1)).join(' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function objectHeight(kind: WarehouseDepotLayoutObject['kind'], subpositions: number): number {
  if (kind === 'SHELF' || kind === 'RACK') return 112 + clamp(subpositions, 0, 8) * 5;
  if (kind === 'REFRIGERATOR') return 122;
  if (kind === 'FREEZER' || kind === 'CHAMBER') return 82;
  if (kind === 'PALLET') return 16;
  if (kind === 'BENCH') return 58;
  return 46;
}

function visualBoxes(quantity: number): number {
  if (quantity <= 0) return 0;
  if (quantity < 5) return 1;
  if (quantity < 20) return 2;
  if (quantity < 60) return 3;
  return 4;
}

function boxGroup(
  key: string,
  x: number,
  y: number,
  scale = 1,
  selected = false
) {
  return (
    <g key={key} transform={'translate(' + x + ' ' + y + ') scale(' + scale + ')'}>
      <polygon
        points="-17,0 0,-10 17,0 0,10"
        fill={selected ? '#ffe6a7' : '#e7b36d'}
        stroke="#ad6e2f"
        strokeWidth="1.3"
      />
      <polygon points="-17,0 0,10 0,30 -17,20" fill="#c9843f" stroke="#9c5d28" strokeWidth="1.3" />
      <polygon points="17,0 0,10 0,30 17,20" fill="#b97335" stroke="#8f5123" strokeWidth="1.3" />
      <line x1="0" y1="-10" x2="0" y2="10" stroke="#f6d6a7" strokeWidth="1.4" />
      <rect x="-5" y="8" width="10" height="5" rx="1" fill="#fff5db" opacity="0.95" />
    </g>
  );
}

function renderLabel(
  center: IsoPoint,
  code: string,
  subtitle: string,
  highlighted: boolean,
  detail?: string
) {
  const width = detail ? 112 : 90;
  const height = detail ? 48 : 30;
  return (
    <g transform={'translate(' + center.x + ' ' + center.y + ')'}>
      <line x1="0" y1="0" x2="0" y2="-18" stroke={highlighted ? '#2563eb' : '#94a3b8'} strokeWidth="1.5" />
      <circle cy="-18" r="3.5" fill={highlighted ? '#2563eb' : '#94a3b8'} />
      <g transform="translate(0 -24)">
        <rect
          x={-width / 2}
          y={-height}
          width={width}
          height={height}
          rx="9"
          fill={highlighted ? '#123a88' : '#ffffff'}
          stroke={highlighted ? '#60a5fa' : '#cbd5e1'}
          strokeWidth={highlighted ? 2 : 1.2}
          opacity="0.98"
        />
        <text x="0" y={-height + 15} textAnchor="middle" fontSize="11" fontWeight="900" fill={highlighted ? '#ffffff' : '#1e3a5f'}>
          {code}
        </text>
        <text x="0" y={-height + 29} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={highlighted ? '#dbeafe' : '#64748b'}>
          {subtitle}
        </text>
        {detail && (
          <text x="0" y={-height + 41} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={highlighted ? '#bfdbfe' : '#94a3b8'}>
            {detail}
          </text>
        )}
      </g>
    </g>
  );
}

function WarehouseStructure({
  object,
  logicalWidth,
  logicalHeight,
  location,
  subpositions,
  occupiedQuantity,
  highlighted,
  highlightedSubpositions,
}: {
  object: WarehouseDepotLayoutObject;
  logicalWidth: number;
  logicalHeight: number;
  location: WarehouseLocation | null;
  subpositions: WarehouseLocation[];
  occupiedQuantity: number;
  highlighted: boolean;
  highlightedSubpositions: WarehouseLocation[];
}) {
  const z = objectHeight(object.kind, subpositions.length);
  const a = isoPoint(object.x, object.y, 0, logicalWidth, logicalHeight);
  const b = isoPoint(object.x + object.width, object.y, 0, logicalWidth, logicalHeight);
  const c = isoPoint(object.x + object.width, object.y + object.height, 0, logicalWidth, logicalHeight);
  const d = isoPoint(object.x, object.y + object.height, 0, logicalWidth, logicalHeight);
  const at = isoPoint(object.x, object.y, z, logicalWidth, logicalHeight);
  const bt = isoPoint(object.x + object.width, object.y, z, logicalWidth, logicalHeight);
  const ct = isoPoint(object.x + object.width, object.y + object.height, z, logicalWidth, logicalHeight);
  const dt = isoPoint(object.x, object.y + object.height, z, logicalWidth, logicalHeight);
  const centerTop = isoPoint(object.x + object.width / 2, object.y + object.height / 2, z, logicalWidth, logicalHeight);
  const boxCount = visualBoxes(occupiedQuantity);
  const code = location?.code || object.label;
  const highlightFilter = highlighted ? 'url(#warehouseGlowStrong)' : 'url(#warehouseObjectShadow)';

  if (object.kind === 'OTHER' && !object.warehouseLocationId) {
    return (
      <g data-visual-role="door">
        <polygon points={polygonPoints([a, b, bt, at])} fill="#e9f0f7" stroke="#6f8ca5" strokeWidth="2" />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#365b78" strokeWidth="4" />
        <text
          x={(a.x + b.x) / 2}
          y={(a.y + b.y) / 2 - 9}
          textAnchor="middle"
          fontSize="10"
          fontWeight="900"
          fill="#36526b"
        >
          {object.label}
        </text>
      </g>
    );
  }

  const commonHighlight = highlighted ? (
    <polygon
      points={polygonPoints([a, b, c, d])}
      fill="#dbeafe"
      stroke="#2563eb"
      strokeWidth="5"
      opacity="0.9"
    />
  ) : null;

  if (object.kind === 'PALLET') {
    const slatCount = 6;
    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={boxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        filter={highlightFilter}
      >
        {commonHighlight}
        <polygon points={polygonPoints([d, c, ct, dt])} fill="#8b5a2b" stroke="#68421e" strokeWidth="1.4" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="#77491f" stroke="#5d3817" strokeWidth="1.4" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#d5a563" stroke="#8c5a2b" strokeWidth="1.7" />
        {Array.from({ length: slatCount }, (_, index) => {
          const ratio = (index + 0.5) / slatCount;
          const p1 = isoPoint(object.x + object.width * ratio, object.y, z + 0.4, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width * ratio, object.y + object.height, z + 0.4, logicalWidth, logicalHeight);
          return <line key={index} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#9f6d35" strokeWidth="1.1" />;
        })}
        {[0.18, 0.5, 0.82].map((ratio) => {
          const foot = isoPoint(object.x + object.width * ratio, object.y + object.height * 0.55, 0, logicalWidth, logicalHeight);
          return <rect key={ratio} x={foot.x - 5} y={foot.y - 1} width="10" height="7" rx="1" fill="#6f431d" />;
        })}
        {boxCount > 0 && Array.from({ length: boxCount }, (_, index) =>
          boxGroup(
            'pal-box-' + index,
            centerTop.x + (index - (boxCount - 1) / 2) * 28,
            centerTop.y - 10 - (index % 2) * 14,
            0.9,
            highlighted
          )
        )}
        {renderLabel(centerTop, code, 'Palete', subpositions.length ? subpositions.length + ' subposições' : 'Local aberto', highlighted)}
      </g>
    );
  }

  if (object.kind === 'SHELF' || object.kind === 'RACK') {
    const levels = clamp(subpositions.length || 4, 2, 6);
    const rackStroke = '#173f67';
    const beam = '#f28a1a';
    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={boxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        filter={highlightFilter}
      >
        {commonHighlight}
        {[a, b, c, d].map((base, index) => {
          const top = [at, bt, ct, dt][index];
          return <line key={'post-' + index} x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={rackStroke} strokeWidth="4.2" />;
        })}
        {[0, 1].map((side) => {
          const lowerA = side === 0 ? a : b;
          const lowerB = side === 0 ? d : c;
          const upperA = side === 0 ? at : bt;
          const upperB = side === 0 ? dt : ct;
          return (
            <g key={'brace-' + side} opacity="0.75">
              <line x1={lowerA.x} y1={lowerA.y} x2={upperB.x} y2={upperB.y} stroke="#345f83" strokeWidth="1.7" />
              <line x1={lowerB.x} y1={lowerB.y} x2={upperA.x} y2={upperA.y} stroke="#345f83" strokeWidth="1.7" />
            </g>
          );
        })}
        {Array.from({ length: levels }, (_, index) => {
          const ratio = (index + 1) / (levels + 0.4);
          const shelfZ = z * ratio;
          const p1 = isoPoint(object.x, object.y, shelfZ, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width, object.y, shelfZ, logicalWidth, logicalHeight);
          const p3 = isoPoint(object.x + object.width, object.y + object.height, shelfZ, logicalWidth, logicalHeight);
          const p4 = isoPoint(object.x, object.y + object.height, shelfZ, logicalWidth, logicalHeight);
          return (
            <g key={'level-' + index}>
              <polygon points={polygonPoints([p1, p2, p3, p4])} fill="#eef3f7" stroke="#8ea5b7" strokeWidth="1.1" opacity="0.96" />
              <polyline points={polygonPoints([p1, p2, p3, p4])} fill="none" stroke={beam} strokeWidth="4.5" strokeLinejoin="round" />
            </g>
          );
        })}
        {boxCount > 0 && Array.from({ length: boxCount }, (_, index) => {
          const row = index % Math.max(1, levels);
          const shelfZ = z * ((row + 1) / (levels + 0.4)) + 12;
          const p = isoPoint(
            object.x + object.width * (0.3 + (index % 2) * 0.36),
            object.y + object.height * 0.52,
            shelfZ,
            logicalWidth,
            logicalHeight
          );
          return boxGroup('rack-box-' + index, p.x, p.y, 0.82, highlighted);
        })}
        {renderLabel(centerTop, code, object.kind === 'RACK' ? 'Rack industrial' : 'Estante industrial', levels + ' níveis', highlighted)}
        {highlightedSubpositions.length > 0 && highlightedSubpositions.slice(0, 5).map((subposition, index) => {
          const y = centerTop.y + 20 + index * 19;
          return (
            <g key={subposition.id} transform={'translate(' + (centerTop.x + 56) + ' ' + y + ')'}>
              <rect x="0" y="-10" width="72" height="18" rx="6" fill="#2563eb" stroke="#bfdbfe" strokeWidth="1.5" />
              <text x="36" y="3" textAnchor="middle" fontSize="8.2" fontWeight="900" fill="#ffffff">
                {subposition.code}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  if (object.kind === 'FREEZER' || object.kind === 'CHAMBER') {
    const lidZ = z;
    const innerA = isoPoint(object.x + object.width * 0.08, object.y + object.height * 0.08, lidZ + 1, logicalWidth, logicalHeight);
    const innerB = isoPoint(object.x + object.width * 0.92, object.y + object.height * 0.08, lidZ + 1, logicalWidth, logicalHeight);
    const innerC = isoPoint(object.x + object.width * 0.92, object.y + object.height * 0.92, lidZ + 1, logicalWidth, logicalHeight);
    const innerD = isoPoint(object.x + object.width * 0.08, object.y + object.height * 0.92, lidZ + 1, logicalWidth, logicalHeight);
    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={boxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        filter={highlightFilter}
      >
        {commonHighlight}
        <polygon points={polygonPoints([d, c, ct, dt])} fill="#d8e6ef" stroke="#7897aa" strokeWidth="1.8" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="#c4d8e5" stroke="#7897aa" strokeWidth="1.8" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#eef7fb" stroke="#7897aa" strokeWidth="1.8" />
        <polygon points={polygonPoints([innerA, innerB, innerC, innerD])} fill="#bde7f8" stroke="#6ea6bf" strokeWidth="1.4" opacity="0.75" />
        <line x1={innerA.x} y1={innerA.y} x2={innerC.x} y2={innerC.y} stroke="#8cc9df" strokeWidth="1" opacity="0.8" />
        <line x1={innerB.x} y1={innerB.y} x2={innerD.x} y2={innerD.y} stroke="#8cc9df" strokeWidth="1" opacity="0.8" />
        <rect x={centerTop.x - 13} y={centerTop.y + 30} width="26" height="7" rx="2" fill="#55758d" opacity="0.9" />
        <g transform={'translate(' + (centerTop.x + 30) + ' ' + (centerTop.y + 18) + ')'}>
          <circle r="7" fill="#eaf5fb" stroke="#6f91aa" strokeWidth="1.4" />
          <path d="M0 -5 L2 -1 L6 0 L2 1 L0 5 L-2 1 L-6 0 L-2 -1 Z" fill="#70b8d8" />
        </g>
        {boxCount > 0 && Array.from({ length: Math.min(2, boxCount) }, (_, index) =>
          boxGroup('freezer-box-' + index, centerTop.x + (index ? 22 : -16), centerTop.y + 10, 0.64, highlighted)
        )}
        {renderLabel(centerTop, code, 'Freezer industrial', subpositions.length ? subpositions.length + ' subposições' : 'Compartimento único', highlighted)}
      </g>
    );
  }

  if (object.kind === 'REFRIGERATOR') {
    const doorMidBottom = isoPoint(object.x + object.width / 2, object.y + object.height, 4, logicalWidth, logicalHeight);
    const doorMidTop = isoPoint(object.x + object.width / 2, object.y + object.height, z - 4, logicalWidth, logicalHeight);
    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={boxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        filter={highlightFilter}
      >
        {commonHighlight}
        <polygon points={polygonPoints([d, c, ct, dt])} fill="#e6f3f9" stroke="#658aa3" strokeWidth="1.8" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="#cce5ef" stroke="#658aa3" strokeWidth="1.8" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#f8fcff" stroke="#658aa3" strokeWidth="1.8" />
        <polygon points={polygonPoints([d, c, ct, dt])} fill="url(#fridgeGlass)" stroke="#6aa7c2" strokeWidth="1.1" opacity="0.72" />
        <line x1={doorMidBottom.x} y1={doorMidBottom.y} x2={doorMidTop.x} y2={doorMidTop.y} stroke="#ffffff" strokeWidth="2.4" opacity="0.9" />
        {[0.25, 0.5, 0.75].map((ratio) => {
          const p1 = isoPoint(object.x, object.y + object.height, z * ratio, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width, object.y + object.height, z * ratio, logicalWidth, logicalHeight);
          return <line key={ratio} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#bce6f5" strokeWidth="1.5" />;
        })}
        <rect x={centerTop.x + 30} y={centerTop.y + 26} width="6" height="28" rx="3" fill="#54738a" />
        <circle cx={centerTop.x - 32} cy={centerTop.y + 24} r="5" fill="#86d2f1" stroke="#4f8aa6" strokeWidth="1" />
        {boxCount > 0 && Array.from({ length: Math.min(2, boxCount) }, (_, index) =>
          boxGroup('fridge-box-' + index, centerTop.x + (index ? 18 : -18), centerTop.y + 34 + index * 15, 0.55, highlighted)
        )}
        {renderLabel(centerTop, code, 'Geladeira industrial', subpositions.length ? subpositions.length + ' subposições' : 'Compartimento único', highlighted)}
      </g>
    );
  }

  if (object.kind === 'BENCH') {
    const topZ = z;
    const legZ = 4;
    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={boxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        filter={highlightFilter}
      >
        {commonHighlight}
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#f4f7f9" stroke="#70889a" strokeWidth="1.8" />
        <polygon
          points={polygonPoints([
            isoPoint(object.x, object.y + object.height, topZ - 8, logicalWidth, logicalHeight),
            isoPoint(object.x + object.width, object.y + object.height, topZ - 8, logicalWidth, logicalHeight),
            ct,
            dt,
          ])}
          fill="#cfd9e0"
          stroke="#70889a"
          strokeWidth="1.5"
        />
        {[0.08, 0.92].flatMap((rx) => [0.12, 0.88].map((ry) => ({ rx, ry }))).map((leg, index) => {
          const bottom = isoPoint(object.x + object.width * leg.rx, object.y + object.height * leg.ry, legZ, logicalWidth, logicalHeight);
          const top = isoPoint(object.x + object.width * leg.rx, object.y + object.height * leg.ry, topZ - 2, logicalWidth, logicalHeight);
          return <line key={index} x1={bottom.x} y1={bottom.y} x2={top.x} y2={top.y} stroke="#6c7f8d" strokeWidth="4" />;
        })}
        <line x1={at.x} y1={at.y} x2={bt.x} y2={bt.y} stroke="#ffffff" strokeWidth="2.2" opacity="0.9" />
        {boxCount > 0 && boxGroup('bench-box', centerTop.x, centerTop.y - 4, 0.7, highlighted)}
        {renderLabel(centerTop, code, 'Mesa inox', subpositions.length ? subpositions.length + ' subposições' : 'Superfície única', highlighted)}
      </g>
    );
  }

  return (
    <g filter={highlightFilter}>
      {commonHighlight}
      <polygon points={polygonPoints([d, c, ct, dt])} fill="#dbe6ee" stroke="#8299aa" strokeWidth="1.5" />
      <polygon points={polygonPoints([b, c, ct, bt])} fill="#cbd9e4" stroke="#8299aa" strokeWidth="1.5" />
      <polygon points={polygonPoints([at, bt, ct, dt])} fill="#f7fafc" stroke="#8299aa" strokeWidth="1.5" />
      {renderLabel(centerTop, code, 'Local', subpositions.length ? subpositions.length + ' subposições' : undefined, highlighted)}
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

  const subpositionsByParent = useMemo(() => {
    const map = new Map<string, WarehouseLocation[]>();
    for (const location of locations) {
      if (location.kind !== 'SUBPOSITION' || !location.parentLocationId || location.status !== 'active') continue;
      const current = map.get(location.parentLocationId) || [];
      current.push(location);
      map.set(location.parentLocationId, current);
    }
    return map;
  }, [locations]);

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
            Visualização premium do depósito. A ocupação aparece somente onde existe saldo físico.
          </p>
        </div>

        <div className="relative w-full sm:w-[370px]">
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

      <div className="relative min-h-[650px] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#ffffff_0%,#eef5fa_50%,#dbe8f3_100%)]">
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
                <stop offset="100%" stopColor="#e8eef4" />
              </linearGradient>
              <linearGradient id="wallGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f9fcff" />
                <stop offset="100%" stopColor="#dbe6ef" />
              </linearGradient>
              <linearGradient id="fridgeGlass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#dff7ff" stopOpacity="0.92" />
                <stop offset="55%" stopColor="#86d6ee" stopOpacity="0.48" />
                <stop offset="100%" stopColor="#b9edf9" stopOpacity="0.78" />
              </linearGradient>
              <filter id="warehouseSceneShadow" x="-30%" y="-30%" width="160%" height="180%">
                <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#0f2740" floodOpacity="0.17" />
              </filter>
              <filter id="warehouseObjectShadow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#10273c" floodOpacity="0.25" />
              </filter>
              <filter id="warehouseGlowStrong" x="-80%" y="-80%" width="260%" height="260%">
                <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#60a5fa" floodOpacity="1" />
                <feDropShadow dx="0" dy="0" stdDeviation="14" floodColor="#2563eb" floodOpacity="0.72" />
              </filter>
              <pattern id="floorGrid" width="34" height="17" patternUnits="userSpaceOnUse" patternTransform="skewY(26)">
                <path d="M 34 0 L 0 0 0 17" fill="none" stroke="#cbd5e1" strokeWidth="0.7" opacity="0.44" />
              </pattern>
            </defs>

            <g filter="url(#warehouseSceneShadow)">
              <polygon
                points={polygonPoints([floor[0], floor[1], backWallTop[1], backWallTop[0]])}
                fill="url(#wallGradient)"
                stroke="#b8c8d8"
                strokeWidth="2"
              />
              <polygon
                points={polygonPoints([floor[0], floor[3], leftWallTop[1], leftWallTop[0]])}
                fill="url(#wallGradient)"
                stroke="#b8c8d8"
                strokeWidth="2"
              />

              {[0.16, 0.5, 0.84].map((ratio) => {
                const p = isoPoint(logicalWidth * ratio, 0, wallHeight * 0.62, logicalWidth, logicalHeight);
                return (
                  <g key={'lamp-back-' + ratio}>
                    <rect x={p.x - 14} y={p.y - 6} width="28" height="8" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
                    <ellipse cx={p.x} cy={p.y + 4} rx="22" ry="7" fill="#fff7d6" opacity="0.42" />
                  </g>
                );
              })}

              {[0.22, 0.64].map((ratio) => {
                const p = isoPoint(0, logicalHeight * ratio, wallHeight * 0.58, logicalWidth, logicalHeight);
                return (
                  <g key={'lamp-left-' + ratio}>
                    <rect x={p.x - 12} y={p.y - 5} width="24" height="7" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
                    <ellipse cx={p.x} cy={p.y + 4} rx="19" ry="6" fill="#fff7d6" opacity="0.38" />
                  </g>
                );
              })}

              <polygon points={polygonPoints(floor)} fill="url(#floorGradient)" stroke="#9fb2c5" strokeWidth="2.5" />
              <polygon points={polygonPoints(floor)} fill="url(#floorGrid)" opacity="0.75" />
            </g>

            <g>
              {visibleObjects.map((object) => {
                const locationId = object.warehouseLocationId || '';
                const location = locationId ? locationById.get(locationId) || null : null;
                const subpositions = location ? subpositionsByParent.get(location.id) || [] : [];
                const occupiedQuantity = locationId ? occupancyByLocal.get(locationId) || 0 : 0;
                const highlighted = Boolean(locationId && highlightedLocalIds.has(locationId));
                const highlightedSubpositions = subpositions.filter((candidate) =>
                  highlightedSubpositionIds.has(candidate.id)
                );

                return (
                  <WarehouseStructure
                    key={object.id}
                    object={object}
                    logicalWidth={logicalWidth}
                    logicalHeight={logicalHeight}
                    location={location}
                    subpositions={subpositions}
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
