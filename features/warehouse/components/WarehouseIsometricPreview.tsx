'use client';

import { useMemo, useState } from 'react';
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
type CanonicalVisualKind = 'SHELF' | 'PALLET' | 'FREEZER' | 'REFRIGERATOR' | 'BENCH';
type PreviewView = 'front' | 'right' | 'back' | 'left';

const PREVIEW_VIEWS: ReadonlyArray<{ id: PreviewView; label: string }> = [
  { id: 'front', label: 'Frente' },
  { id: 'right', label: 'Direita' },
  { id: 'back', label: 'Trás' },
  { id: 'left', label: 'Esquerda' },
];

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 760;
const ORIGIN_X = 600;
const ORIGIN_Y = 160;
const FLOOR_HALF_W = 470;
const FLOOR_HALF_H = 245;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

function transformObjectForView(
  object: WarehouseDepotLayoutObject,
  logicalWidth: number,
  logicalHeight: number,
  view: PreviewView
): WarehouseDepotLayoutObject {
  if (view === 'front') return object;

  const widthBase = Math.max(1, logicalWidth);
  const heightBase = Math.max(1, logicalHeight);
  const nx = object.x / widthBase;
  const ny = object.y / heightBase;
  const nw = object.width / widthBase;
  const nh = object.height / heightBase;

  if (view === 'back') {
    return {
      ...object,
      x: (1 - nx - nw) * widthBase,
      y: (1 - ny - nh) * heightBase,
    };
  }

  if (view === 'right') {
    return {
      ...object,
      x: ny * widthBase,
      y: (1 - nx - nw) * heightBase,
      width: nh * widthBase,
      height: nw * heightBase,
    };
  }

  return {
    ...object,
    x: (1 - ny - nh) * widthBase,
    y: nx * heightBase,
    width: nh * widthBase,
    height: nw * heightBase,
  };
}

function canonicalKind(kind: WarehouseDepotLayoutObject['kind']): CanonicalVisualKind {
  if (kind === 'PALLET') return 'PALLET';
  if (kind === 'FREEZER' || kind === 'CHAMBER') return 'FREEZER';
  if (kind === 'REFRIGERATOR') return 'REFRIGERATOR';
  if (kind === 'BENCH' || kind === 'CABINET') return 'BENCH';
  return 'SHELF';
}

function objectHeight(kind: CanonicalVisualKind, subpositions: number): number {
  if (kind === 'SHELF') return 126 + clamp(subpositions, 0, 8) * 4.5;
  if (kind === 'REFRIGERATOR') return 138;
  if (kind === 'FREEZER') return 80;
  if (kind === 'PALLET') return 16;
  return 64;
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
      <ellipse cx="0" cy="24" rx="20" ry="7" fill="#0f172a" opacity="0.14" />
      <polygon
        points="-18,0 0,-10 18,0 0,10"
        fill={selected ? '#ffe8a8' : '#e7b26b'}
        stroke="#a96c31"
        strokeWidth="1.25"
      />
      <polygon points="-18,0 0,10 0,31 -18,21" fill="#c8813b" stroke="#965525" strokeWidth="1.25" />
      <polygon points="18,0 0,10 0,31 18,21" fill="#b56d31" stroke="#87491f" strokeWidth="1.25" />
      <line x1="0" y1="-10" x2="0" y2="10" stroke="#f8dcad" strokeWidth="1.5" />
      <rect x="-5.5" y="8" width="11" height="5" rx="1" fill="#fff4d8" opacity="0.96" />
      <line x1="-13" y1="17" x2="-4" y2="22" stroke="#a76830" strokeWidth="0.8" opacity="0.7" />
    </g>
  );
}

function renderLabel(
  center: IsoPoint,
  code: string,
  subtitle: string,
  detail: string | undefined,
  highlighted: boolean,
  labelOffsetX = 0,
  labelOffsetY = 0
) {
  const width = highlighted ? 132 : 68;
  const height = highlighted ? 52 : 24;
  const x = center.x + labelOffsetX;
  const y = center.y + labelOffsetY;

  return (
    <g transform={'translate(' + x + ' ' + y + ')'} pointerEvents="none">
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="-15"
        stroke={highlighted ? '#2563eb' : '#9fb0bf'}
        strokeWidth={highlighted ? 2 : 1}
        opacity={highlighted ? 1 : 0.65}
      />
      <circle cy="-15" r={highlighted ? 4 : 2.4} fill={highlighted ? '#2563eb' : '#94a3b8'} />
      <g transform="translate(0 -20)">
        <rect
          x={-width / 2}
          y={-height}
          width={width}
          height={height}
          rx={highlighted ? 10 : 7}
          fill={highlighted ? '#0f3b86' : '#ffffff'}
          stroke={highlighted ? '#7db6ff' : '#d7e0e8'}
          strokeWidth={highlighted ? 2 : 1}
          opacity={highlighted ? 0.99 : 0.94}
        />
        <text
          x="0"
          y={-height + 16}
          textAnchor="middle"
          fontSize={highlighted ? 11 : 9.5}
          fontWeight="900"
          fill={highlighted ? '#ffffff' : '#173a5e'}
        >
          {code}
        </text>
        {highlighted && (
          <>
            <text x="0" y={-height + 32} textAnchor="middle" fontSize="8.4" fontWeight="700" fill="#dbeafe">
              {subtitle}
            </text>
            {detail && (
              <text x="0" y={-height + 44} textAnchor="middle" fontSize="7.4" fontWeight="700" fill="#bfdbfe">
                {detail}
              </text>
            )}
          </>
        )}
      </g>
    </g>
  );
}

function contactShadow(
  object: WarehouseDepotLayoutObject,
  logicalWidth: number,
  logicalHeight: number,
  opacity = 0.18
) {
  const center = isoPoint(
    object.x + object.width / 2,
    object.y + object.height / 2,
    0,
    logicalWidth,
    logicalHeight
  );
  const rx = clamp(object.width / Math.max(1, logicalWidth) * 170, 18, 72);
  const ry = clamp(object.height / Math.max(1, logicalHeight) * 54, 7, 24);
  return (
    <ellipse
      cx={center.x}
      cy={center.y + 7}
      rx={rx}
      ry={ry}
      fill="#0f172a"
      opacity={opacity}
      filter="url(#softGroundShadow)"
    />
  );
}

function WarehouseStructure({
  object,
  logicalWidth,
  logicalHeight,
  location,
  subpositions,
  occupiedQuantity,
  occupiedSubpositions,
  highlighted,
  highlightedSubpositions,
  dimmed,
}: {
  object: WarehouseDepotLayoutObject;
  logicalWidth: number;
  logicalHeight: number;
  location: WarehouseLocation | null;
  subpositions: WarehouseLocation[];
  occupiedQuantity: number;
  occupiedSubpositions: Map<string, number>;
  highlighted: boolean;
  highlightedSubpositions: WarehouseLocation[];
  dimmed: boolean;
}) {
  const kind = canonicalKind(object.kind);
  const z = objectHeight(kind, subpositions.length);

  const a = isoPoint(object.x, object.y, 0, logicalWidth, logicalHeight);
  const b = isoPoint(object.x + object.width, object.y, 0, logicalWidth, logicalHeight);
  const c = isoPoint(object.x + object.width, object.y + object.height, 0, logicalWidth, logicalHeight);
  const d = isoPoint(object.x, object.y + object.height, 0, logicalWidth, logicalHeight);

  const at = isoPoint(object.x, object.y, z, logicalWidth, logicalHeight);
  const bt = isoPoint(object.x + object.width, object.y, z, logicalWidth, logicalHeight);
  const ct = isoPoint(object.x + object.width, object.y + object.height, z, logicalWidth, logicalHeight);
  const dt = isoPoint(object.x, object.y + object.height, z, logicalWidth, logicalHeight);

  const centerTop = isoPoint(
    object.x + object.width / 2,
    object.y + object.height / 2,
    z,
    logicalWidth,
    logicalHeight
  );

  const code = location?.code || object.label;
  const generalBoxCount = visualBoxes(occupiedQuantity);
  const highlightFilter = highlighted ? 'url(#warehouseGlowStrong)' : 'url(#warehouseObjectShadow)';
  const groupOpacity = dimmed ? 0.48 : 1;

  if (object.kind === 'OTHER' && !object.warehouseLocationId) {
    const doorTopA = isoPoint(object.x, object.y, 54, logicalWidth, logicalHeight);
    const doorTopB = isoPoint(object.x + object.width, object.y, 54, logicalWidth, logicalHeight);
    return (
      <g data-visual-role="door" opacity={groupOpacity}>
        {contactShadow(object, logicalWidth, logicalHeight, 0.12)}
        <polygon points={polygonPoints([a, b, doorTopB, doorTopA])} fill="url(#doorMetal)" stroke="#53748e" strokeWidth="2" />
        {Array.from({ length: 6 }, (_, index) => {
          const t = (index + 1) / 7;
          const p1 = isoPoint(object.x, object.y, 54 * t, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width, object.y, 54 * t, logicalWidth, logicalHeight);
          return <line key={index} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#8da7ba" strokeWidth="1" />;
        })}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#294e6a" strokeWidth="4" />
        <text
          x={(a.x + b.x) / 2}
          y={(a.y + b.y) / 2 - 10}
          textAnchor="middle"
          fontSize="10"
          fontWeight="900"
          fill="#29465d"
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
      strokeWidth="4.5"
      opacity="0.9"
    />
  ) : null;

  if (kind === 'PALLET') {
    const slatCount = 7;
    const runnerRatios = [0.13, 0.5, 0.87];

    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={generalBoxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        opacity={groupOpacity}
        filter={highlightFilter}
      >
        {contactShadow(object, logicalWidth, logicalHeight, 0.2)}
        {commonHighlight}

        <polygon points={polygonPoints([d, c, ct, dt])} fill="url(#palletSideDark)" stroke="#68431f" strokeWidth="1.4" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="url(#palletSide)" stroke="#5f3b1a" strokeWidth="1.4" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="url(#palletWood)" stroke="#855426" strokeWidth="1.6" />

        {Array.from({ length: slatCount }, (_, index) => {
          const ratio = (index + 0.5) / slatCount;
          const p1 = isoPoint(object.x + object.width * ratio, object.y, z + 0.5, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width * ratio, object.y + object.height, z + 0.5, logicalWidth, logicalHeight);
          return (
            <line
              key={'slat-' + index}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={index % 2 === 0 ? '#97622f' : '#aa7438'}
              strokeWidth="1.1"
              opacity="0.96"
            />
          );
        })}

        {runnerRatios.map((ratio) => {
          const p1 = isoPoint(object.x + object.width * ratio, object.y + object.height * 0.09, 4, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width * ratio, object.y + object.height * 0.91, 4, logicalWidth, logicalHeight);
          return (
            <line
              key={'runner-' + ratio}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#6c401c"
              strokeWidth="5.5"
              strokeLinecap="round"
              opacity="0.95"
            />
          );
        })}

        {runnerRatios.flatMap((rx) => [0.17, 0.5, 0.83].map((ry) => ({ rx, ry }))).map((block, index) => {
          const p = isoPoint(
            object.x + object.width * block.rx,
            object.y + object.height * block.ry,
            1.5,
            logicalWidth,
            logicalHeight
          );
          return (
            <rect
              key={'block-' + index}
              x={p.x - 5}
              y={p.y - 3}
              width="10"
              height="7"
              rx="1.4"
              fill="#62401f"
              stroke="#4b2e16"
              strokeWidth="0.8"
            />
          );
        })}

        {generalBoxCount > 0 && Array.from({ length: generalBoxCount }, (_, index) =>
          boxGroup(
            'pal-box-' + index,
            centerTop.x + (index - (generalBoxCount - 1) / 2) * 26,
            centerTop.y - 12 - (index % 2) * 14,
            0.88,
            highlighted
          )
        )}

        {renderLabel(
          centerTop,
          code,
          'Palete',
          subpositions.length ? subpositions.length + ' subposições' : 'Local aberto',
          highlighted,
          0,
          -8
        )}
      </g>
    );
  }

  if (kind === 'SHELF') {
    const levels = clamp(subpositions.length || 4, 2, 6);
    const rackStroke = '#123f66';
    const beam = '#f47f13';

    const frontBottomLeft = d;
    const frontBottomRight = c;
    const frontTopLeft = dt;
    const frontTopRight = ct;
    const backBottomLeft = a;
    const backBottomRight = b;
    const backTopLeft = at;
    const backTopRight = bt;

    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={generalBoxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        opacity={groupOpacity}
        filter={highlightFilter}
      >
        {contactShadow(object, logicalWidth, logicalHeight, 0.18)}
        {commonHighlight}

        {/* Camada traseira: deve ser pintada antes das prateleiras. */}
        {[backBottomLeft, backBottomRight].map((base, index) => {
          const top = [backTopLeft, backTopRight][index];
          return (
            <g key={'back-upright-' + index}>
              <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke="#0e3556" strokeWidth="6.6" />
              <line x1={base.x + 1.6} y1={base.y} x2={top.x + 1.6} y2={top.y} stroke="#4f7895" strokeWidth="1.3" opacity="0.88" />
              {Array.from({ length: 8 }, (_, holeIndex) => {
                const t = (holeIndex + 1) / 9;
                const hx = base.x + (top.x - base.x) * t;
                const hy = base.y + (top.y - base.y) * t;
                return <circle key={holeIndex} cx={hx} cy={hy} r="1.05" fill="#8ab0c9" opacity="0.72" />;
              })}
            </g>
          );
        })}

        {[backBottomLeft, backBottomRight].map((base, index) => (
          <g key={'back-foot-' + index}>
            <rect x={base.x - 6} y={base.y - 2} width="12" height="6" rx="1.8" fill="#f5ba25" stroke="#b97910" strokeWidth="1" opacity="0.72" />
            <rect x={base.x - 3} y={base.y - 12} width="6" height="10" rx="1.5" fill="#f2b31d" stroke="#c07d11" strokeWidth="0.8" opacity="0.62" />
          </g>
        ))}

        {[
          [frontBottomLeft, backBottomLeft, backTopLeft, frontTopLeft],
          [frontBottomRight, backBottomRight, backTopRight, frontTopRight],
        ].map((frame, side) => (
          <g key={'side-frame-' + side}>
            <line x1={frame[0].x} y1={frame[0].y} x2={frame[2].x} y2={frame[2].y} stroke="#426b89" strokeWidth="2" opacity="0.9" />
            <line x1={frame[1].x} y1={frame[1].y} x2={frame[3].x} y2={frame[3].y} stroke="#426b89" strokeWidth="2" opacity="0.9" />
            <line x1={frame[0].x} y1={frame[0].y} x2={frame[1].x} y2={frame[1].y} stroke="#254f70" strokeWidth="2.2" />
            <line x1={frame[2].x} y1={frame[2].y} x2={frame[3].x} y2={frame[3].y} stroke="#254f70" strokeWidth="2.2" />
          </g>
        ))}

        {Array.from({ length: levels }, (_, index) => {
          const ratio = (index + 1) / (levels + 0.35);
          const shelfZ = z * ratio;
          const p1 = isoPoint(object.x, object.y, shelfZ, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width, object.y, shelfZ, logicalWidth, logicalHeight);
          const p3 = isoPoint(object.x + object.width, object.y + object.height, shelfZ, logicalWidth, logicalHeight);
          const p4 = isoPoint(object.x, object.y + object.height, shelfZ, logicalWidth, logicalHeight);

          const frontBeamLeft = isoPoint(object.x, object.y + object.height, shelfZ - 2.5, logicalWidth, logicalHeight);
          const frontBeamRight = isoPoint(object.x + object.width, object.y + object.height, shelfZ - 2.5, logicalWidth, logicalHeight);
          const rearBeamLeft = isoPoint(object.x, object.y, shelfZ - 2.5, logicalWidth, logicalHeight);
          const rearBeamRight = isoPoint(object.x + object.width, object.y, shelfZ - 2.5, logicalWidth, logicalHeight);

          const linkedSubposition = subpositions[index] || null;
          const levelQuantity = linkedSubposition ? occupiedSubpositions.get(linkedSubposition.id) || 0 : 0;
          const levelHighlighted = linkedSubposition
            ? highlightedSubpositions.some((item) => item.id === linkedSubposition.id)
            : false;

          return (
            <g key={'level-' + index}>
              {levelHighlighted && (
                <polygon
                  points={polygonPoints([p1, p2, p3, p4])}
                  fill="#60a5fa"
                  stroke="#2563eb"
                  strokeWidth="2"
                  opacity="0.5"
                  filter="url(#subpositionGlow)"
                />
              )}
              <polygon
                points={polygonPoints([p1, p2, p3, p4])}
                fill="url(#rackDeck)"
                stroke="#9fb2c3"
                strokeWidth="0.8"
                opacity="0.96"
              />

              {Array.from({ length: 6 }, (_, deckIndex) => {
                const t = (deckIndex + 1) / 7;
                const dl = isoPoint(
                  object.x + object.width * t,
                  object.y + object.height * 0.04,
                  shelfZ + 0.8,
                  logicalWidth,
                  logicalHeight
                );
                const dr = isoPoint(
                  object.x + object.width * t,
                  object.y + object.height * 0.96,
                  shelfZ + 0.8,
                  logicalWidth,
                  logicalHeight
                );
                return (
                  <line
                    key={'deck-line-' + deckIndex}
                    x1={dl.x}
                    y1={dl.y}
                    x2={dr.x}
                    y2={dr.y}
                    stroke="#c4d0da"
                    strokeWidth="0.7"
                    opacity="0.82"
                  />
                );
              })}

              <line x1={frontBeamLeft.x} y1={frontBeamLeft.y} x2={frontBeamRight.x} y2={frontBeamRight.y} stroke={beam} strokeWidth="6.3" strokeLinecap="round" />
              <line x1={rearBeamLeft.x} y1={rearBeamLeft.y} x2={rearBeamRight.x} y2={rearBeamRight.y} stroke="#d86c0e" strokeWidth="4.5" strokeLinecap="round" opacity="0.92" />

              {levelQuantity > 0 && Array.from({ length: Math.min(2, visualBoxes(levelQuantity)) }, (_, boxIndex) => {
                const boxPoint = isoPoint(
                  object.x + object.width * (boxIndex === 0 ? 0.34 : 0.68),
                  object.y + object.height * 0.54,
                  shelfZ + 11,
                  logicalWidth,
                  logicalHeight
                );
                return boxGroup(
                  'rack-level-box-' + index + '-' + boxIndex,
                  boxPoint.x,
                  boxPoint.y,
                  0.72,
                  levelHighlighted || highlighted
                );
              })}
            </g>
          );
        })}

        {/* Camada frontal: pintada depois das prateleiras para oclusão isométrica correta. */}
        {[frontBottomLeft, frontBottomRight].map((base, index) => {
          const top = [frontTopLeft, frontTopRight][index];
          return (
            <g key={'front-upright-' + index}>
              <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke="#0e3556" strokeWidth="6.6" />
              <line x1={base.x + 1.6} y1={base.y} x2={top.x + 1.6} y2={top.y} stroke="#4f7895" strokeWidth="1.3" opacity="0.9" />
              {Array.from({ length: 8 }, (_, holeIndex) => {
                const t = (holeIndex + 1) / 9;
                const hx = base.x + (top.x - base.x) * t;
                const hy = base.y + (top.y - base.y) * t;
                return <circle key={holeIndex} cx={hx} cy={hy} r="1.05" fill="#8ab0c9" opacity="0.78" />;
              })}
            </g>
          );
        })}

        {[frontBottomLeft, frontBottomRight].map((base, index) => (
          <g key={'front-foot-' + index}>
            <rect x={base.x - 6} y={base.y - 2} width="12" height="6" rx="1.8" fill="#f5ba25" stroke="#b97910" strokeWidth="1" />
            <rect x={base.x - 3} y={base.y - 12} width="6" height="10" rx="1.5" fill="#f2b31d" stroke="#c07d11" strokeWidth="0.8" opacity="0.98" />
          </g>
        ))}

        {generalBoxCount > 0 && subpositions.length === 0 && Array.from({ length: generalBoxCount }, (_, index) => {
          const row = index % Math.max(1, levels);
          const shelfZ = z * ((row + 1) / (levels + 0.35)) + 11;
          const p = isoPoint(
            object.x + object.width * (0.3 + (index % 2) * 0.38),
            object.y + object.height * 0.56,
            shelfZ,
            logicalWidth,
            logicalHeight
          );
          return boxGroup('rack-box-' + index, p.x, p.y, 0.76, highlighted);
        })}

        {renderLabel(
          centerTop,
          code,
          'Estante industrial',
          levels + ' níveis',
          highlighted,
          0,
          -10
        )}
      </g>
    );
  }

  if (kind === 'FREEZER') {
    const innerA = isoPoint(object.x + object.width * 0.07, object.y + object.height * 0.08, z + 1.5, logicalWidth, logicalHeight);
    const innerB = isoPoint(object.x + object.width * 0.93, object.y + object.height * 0.08, z + 1.5, logicalWidth, logicalHeight);
    const innerC = isoPoint(object.x + object.width * 0.93, object.y + object.height * 0.92, z + 1.5, logicalWidth, logicalHeight);
    const innerD = isoPoint(object.x + object.width * 0.07, object.y + object.height * 0.92, z + 1.5, logicalWidth, logicalHeight);

    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={generalBoxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        opacity={groupOpacity}
        filter={highlightFilter}
      >
        {contactShadow(object, logicalWidth, logicalHeight, 0.2)}
        {commonHighlight}

        <polygon points={polygonPoints([d, c, ct, dt])} fill="url(#freezerFront)" stroke="#68889f" strokeWidth="1.9" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="url(#freezerSide)" stroke="#68889f" strokeWidth="1.9" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#f9fcfe" stroke="#7694a8" strokeWidth="1.8" />

        <polygon points={polygonPoints([innerA, innerB, innerC, innerD])} fill="url(#freezerGlass)" stroke="#5a9ab8" strokeWidth="1.5" opacity="0.92" />
        <line x1={innerA.x} y1={innerA.y} x2={innerC.x} y2={innerC.y} stroke="#e4faff" strokeWidth="1.4" opacity="0.86" />
        <line x1={innerB.x} y1={innerB.y} x2={innerD.x} y2={innerD.y} stroke="#e4faff" strokeWidth="1.4" opacity="0.86" />

        <rect x={centerTop.x - 18} y={centerTop.y + 31} width="36" height="7" rx="2.5" fill="#486478" stroke="#314b5e" strokeWidth="0.8" />
        <rect x={centerTop.x + 28} y={centerTop.y + 19} width="23" height="13" rx="3" fill="#163a57" stroke="#7296ad" strokeWidth="0.9" />
        <rect x={centerTop.x + 32} y={centerTop.y + 22} width="8" height="3" rx="1" fill="#62dcff" />

        {Array.from({ length: 6 }, (_, index) => (
          <line
            key={'vent-' + index}
            x1={centerTop.x - 45 + index * 8}
            y1={centerTop.y + 48}
            x2={centerTop.x - 40 + index * 8}
            y2={centerTop.y + 48}
            stroke="#7893a5"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        ))}

        {generalBoxCount > 0 && Array.from({ length: Math.min(2, generalBoxCount) }, (_, index) =>
          boxGroup('freezer-box-' + index, centerTop.x + (index ? 22 : -18), centerTop.y + 12, 0.6, highlighted)
        )}

        {renderLabel(
          centerTop,
          code,
          'Freezer industrial',
          subpositions.length ? subpositions.length + ' subposições' : 'Compartimento único',
          highlighted,
          0,
          -8
        )}
      </g>
    );
  }

  if (kind === 'REFRIGERATOR') {
    const frontBottomLeft = d;
    const frontBottomRight = c;
    const frontTopLeft = dt;
    const frontTopRight = ct;
    const doorSplitBottom = isoPoint(object.x + object.width / 2, object.y + object.height, 4, logicalWidth, logicalHeight);
    const doorSplitTop = isoPoint(object.x + object.width / 2, object.y + object.height, z - 4, logicalWidth, logicalHeight);

    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={generalBoxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        opacity={groupOpacity}
        filter={highlightFilter}
      >
        {contactShadow(object, logicalWidth, logicalHeight, 0.22)}
        {commonHighlight}

        <polygon points={polygonPoints([d, c, ct, dt])} fill="url(#fridgeFrame)" stroke="#597b93" strokeWidth="2" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="#c7dae6" stroke="#597b93" strokeWidth="1.8" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#fbfdff" stroke="#597b93" strokeWidth="1.8" />

        <polygon points={polygonPoints([frontBottomLeft, frontBottomRight, frontTopRight, frontTopLeft])} fill="url(#fridgeGlass)" stroke="#65a4c0" strokeWidth="1.2" opacity="0.84" />
        <line x1={doorSplitBottom.x} y1={doorSplitBottom.y} x2={doorSplitTop.x} y2={doorSplitTop.y} stroke="#eefaff" strokeWidth="3" opacity="0.98" />

        {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
          const p1 = isoPoint(object.x, object.y + object.height, z * ratio, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width, object.y + object.height, z * ratio, logicalWidth, logicalHeight);
          return (
            <g key={'fridge-shelf-' + ratio}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#e4f9ff" strokeWidth="2.2" opacity="0.97" />
              <line x1={p1.x} y1={p1.y + 2} x2={p2.x} y2={p2.y + 2} stroke="#5e9db8" strokeWidth="0.7" opacity="0.66" />
            </g>
          );
        })}

        <line x1={frontTopLeft.x + 8} y1={frontTopLeft.y + 14} x2={frontBottomLeft.x + 8} y2={frontBottomLeft.y - 8} stroke="#a8e8ff" strokeWidth="3.2" opacity="0.75" />
        <line x1={frontTopRight.x - 8} y1={frontTopRight.y + 14} x2={frontBottomRight.x - 8} y2={frontBottomRight.y - 8} stroke="#a8e8ff" strokeWidth="3.2" opacity="0.75" />

        <rect x={centerTop.x + 27} y={centerTop.y + 28} width="5" height="31" rx="2.5" fill="#4b697e" />
        <rect x={centerTop.x - 32} y={centerTop.y + 28} width="5" height="31" rx="2.5" fill="#4b697e" />

        <rect x={centerTop.x - 29} y={centerTop.y - 2} width="58" height="13" rx="3" fill="#173a55" stroke="#7194aa" strokeWidth="0.8" />
        <circle cx={centerTop.x - 17} cy={centerTop.y + 4.5} r="2.5" fill="#54ddff" />
        <rect x={centerTop.x - 8} y={centerTop.y + 2} width="18" height="5" rx="1.5" fill="#8be7ff" opacity="0.92" />

        {generalBoxCount > 0 && Array.from({ length: Math.min(3, generalBoxCount) }, (_, index) =>
          boxGroup(
            'fridge-box-' + index,
            centerTop.x + (index - 1) * 17,
            centerTop.y + 44 + (index % 2) * 14,
            0.5,
            highlighted
          )
        )}

        {renderLabel(
          centerTop,
          code,
          'Geladeira industrial',
          subpositions.length ? subpositions.length + ' subposições' : 'Compartimento único',
          highlighted,
          0,
          -10
        )}
      </g>
    );
  }

  if (kind === 'BENCH') {
    const lowerShelfZ = z * 0.28;
    const lowerA = isoPoint(object.x + object.width * 0.08, object.y + object.height * 0.12, lowerShelfZ, logicalWidth, logicalHeight);
    const lowerB = isoPoint(object.x + object.width * 0.92, object.y + object.height * 0.12, lowerShelfZ, logicalWidth, logicalHeight);
    const lowerC = isoPoint(object.x + object.width * 0.92, object.y + object.height * 0.88, lowerShelfZ, logicalWidth, logicalHeight);
    const lowerD = isoPoint(object.x + object.width * 0.08, object.y + object.height * 0.88, lowerShelfZ, logicalWidth, logicalHeight);
    const legPoints = [0.08, 0.92].flatMap((rx) => [0.12, 0.88].map((ry) => ({ rx, ry })));

    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={generalBoxCount > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        opacity={groupOpacity}
        filter={highlightFilter}
      >
        {contactShadow(object, logicalWidth, logicalHeight, 0.18)}
        {commonHighlight}

        <polygon points={polygonPoints([at, bt, ct, dt])} fill="url(#metalSheen)" stroke="#657d8e" strokeWidth="1.8" />
        <polygon
          points={polygonPoints([
            isoPoint(object.x, object.y + object.height, z - 8, logicalWidth, logicalHeight),
            isoPoint(object.x + object.width, object.y + object.height, z - 8, logicalWidth, logicalHeight),
            ct,
            dt,
          ])}
          fill="url(#benchFront)"
          stroke="#657d8e"
          strokeWidth="1.5"
        />

        <polygon points={polygonPoints([lowerA, lowerB, lowerC, lowerD])} fill="#c7d2da" stroke="#6d8393" strokeWidth="1.2" opacity="0.95" />

        {legPoints.map((leg, index) => {
          const bottom = isoPoint(object.x + object.width * leg.rx, object.y + object.height * leg.ry, 4, logicalWidth, logicalHeight);
          const top = isoPoint(object.x + object.width * leg.rx, object.y + object.height * leg.ry, z - 2, logicalWidth, logicalHeight);
          return (
            <g key={'bench-leg-' + index}>
              <line x1={bottom.x} y1={bottom.y} x2={top.x} y2={top.y} stroke="#5e7484" strokeWidth="5" />
              <circle cx={bottom.x} cy={bottom.y + 1} r="3.3" fill="#334b5c" />
            </g>
          );
        })}

        <line x1={at.x} y1={at.y} x2={bt.x} y2={bt.y} stroke="#ffffff" strokeWidth="2.6" opacity="0.95" />
        <line x1={dt.x} y1={dt.y} x2={ct.x} y2={ct.y} stroke="#90a4b3" strokeWidth="1.2" opacity="0.85" />

        {generalBoxCount > 0 && boxGroup('bench-box', centerTop.x, centerTop.y - 6, 0.68, highlighted)}

        {renderLabel(
          centerTop,
          code,
          'Mesa inox',
          subpositions.length ? subpositions.length + ' subposições' : 'Superfície única',
          highlighted,
          0,
          -8
        )}
      </g>
    );
  }

  return null;
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
  const [previewView, setPreviewView] = useState<PreviewView>('front');

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
    for (const current of map.values()) {
      current.sort((left, right) => left.code.localeCompare(right.code, 'pt-BR', { numeric: true }));
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

  const occupancyBySubposition = useMemo(() => {
    const map = new Map<string, number>();
    for (const balance of balances) {
      if (balance.quantity <= 0 || balance.position.kind !== 'SUBPOSITION') continue;
      map.set(
        balance.position.subpositionId,
        (map.get(balance.position.subpositionId) || 0) + balance.quantity
      );
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

  const hasActiveSelection = selectedMaterialId.length > 0 && highlightedLocalIds.size > 0;

  const visibleObjects = useMemo(
    () =>
      objects
        .filter((object) => object.kind !== 'WALL' && object.kind !== 'CORRIDOR')
        .map((object) => transformObjectForView(
          object,
          logicalWidth,
          logicalHeight,
          previewView
        ))
        .sort((left, right) => {
          const leftDepth = left.x + left.y + left.layer * 0.001;
          const rightDepth = right.x + right.y + right.layer * 0.001;
          return leftDepth - rightDepth;
        }),
    [logicalHeight, logicalWidth, objects, previewView]
  );

  const floor = [
    isoPoint(0, 0, 0, logicalWidth, logicalHeight),
    isoPoint(logicalWidth, 0, 0, logicalWidth, logicalHeight),
    isoPoint(logicalWidth, logicalHeight, 0, logicalWidth, logicalHeight),
    isoPoint(0, logicalHeight, 0, logicalWidth, logicalHeight),
  ];

  const wallHeight = 154;
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
            Biblioteca visual isométrica oficial do EMPROVEX. Ocupação e localização refletem o saldo físico.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-[520px]">
          <div
            className="flex flex-wrap items-center justify-end gap-1"
            data-testid="warehouse-isometric-view-controls"
            aria-label="Ângulos da prévia 2.5D"
          >
            <span className="mr-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
              Vista
            </span>
            {PREVIEW_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setPreviewView(view.id)}
                aria-pressed={previewView === view.id}
                data-testid={'warehouse-isometric-view-' + view.id}
                className={
                  previewView === view.id
                    ? 'rounded-lg border border-[#00288e] bg-[#00288e] px-2.5 py-1.5 text-[9px] font-black text-white shadow-sm'
                    : 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#00288e]'
                }
              >
                {view.label}
              </button>
            ))}
          </div>

          <div className="relative w-full">
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
      </div>

      <div className="relative min-h-[660px] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#ffffff_0%,#eef5fa_52%,#dce8f2_100%)]">
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
            aria-label={'Prévia isométrica 2.5D do depósito · vista ' + PREVIEW_VIEWS.find((view) => view.id === previewView)?.label}
          >
            <defs>
              <linearGradient id="floorGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e8eef4" />
              </linearGradient>
              <linearGradient id="wallGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbfdff" />
                <stop offset="100%" stopColor="#dbe6ef" />
              </linearGradient>
              <linearGradient id="rackDeck" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="52%" stopColor="#edf2f6" />
                <stop offset="100%" stopColor="#ccd8e1" />
              </linearGradient>
              <linearGradient id="palletWood" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e7bd79" />
                <stop offset="48%" stopColor="#cf9650" />
                <stop offset="100%" stopColor="#b67738" />
              </linearGradient>
              <linearGradient id="palletSide" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#99602d" />
                <stop offset="100%" stopColor="#6e421d" />
              </linearGradient>
              <linearGradient id="palletSideDark" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#895326" />
                <stop offset="100%" stopColor="#5a3417" />
              </linearGradient>
              <linearGradient id="freezerFront" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fbfdff" />
                <stop offset="58%" stopColor="#d7e4ec" />
                <stop offset="100%" stopColor="#b7cad7" />
              </linearGradient>
              <linearGradient id="freezerSide" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d6e4ec" />
                <stop offset="100%" stopColor="#9fb6c6" />
              </linearGradient>
              <linearGradient id="freezerGlass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e8fbff" stopOpacity="0.96" />
                <stop offset="55%" stopColor="#9bdcf2" stopOpacity="0.62" />
                <stop offset="100%" stopColor="#c7eff9" stopOpacity="0.88" />
              </linearGradient>
              <linearGradient id="fridgeFrame" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fbfdff" />
                <stop offset="60%" stopColor="#dce9f0" />
                <stop offset="100%" stopColor="#b7cad6" />
              </linearGradient>
              <linearGradient id="metalSheen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="42%" stopColor="#e8eef2" />
                <stop offset="100%" stopColor="#b7c7d2" />
              </linearGradient>
              <linearGradient id="benchFront" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#dfe7ec" />
                <stop offset="50%" stopColor="#bccbd5" />
                <stop offset="100%" stopColor="#98acba" />
              </linearGradient>
              <linearGradient id="fridgeGlass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#dff7ff" stopOpacity="0.94" />
                <stop offset="55%" stopColor="#86d6ee" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#b9edf9" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="doorMetal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f5f8fa" />
                <stop offset="100%" stopColor="#b8c7d2" />
              </linearGradient>

              <filter id="warehouseSceneShadow" x="-30%" y="-30%" width="160%" height="180%">
                <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#0f2740" floodOpacity="0.16" />
              </filter>
              <filter id="warehouseObjectShadow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#10273c" floodOpacity="0.24" />
              </filter>
              <filter id="warehouseGlowStrong" x="-80%" y="-80%" width="260%" height="260%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#60a5fa" floodOpacity="1" />
                <feDropShadow dx="0" dy="0" stdDeviation="14" floodColor="#2563eb" floodOpacity="0.72" />
              </filter>
              <filter id="subpositionGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#60a5fa" floodOpacity="0.95" />
              </filter>
              <filter id="softGroundShadow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="5" />
              </filter>

              <pattern id="floorGrid" width="34" height="17" patternUnits="userSpaceOnUse" patternTransform="skewY(26)">
                <path d="M 34 0 L 0 0 0 17" fill="none" stroke="#cbd5e1" strokeWidth="0.65" opacity="0.38" />
              </pattern>
            </defs>

            <g filter="url(#warehouseSceneShadow)">
              <polygon
                points={polygonPoints([floor[0], floor[1], backWallTop[1], backWallTop[0]])}
                fill="url(#wallGradient)"
                stroke="#b6c7d6"
                strokeWidth="2"
              />
              <polygon
                points={polygonPoints([floor[0], floor[3], leftWallTop[1], leftWallTop[0]])}
                fill="url(#wallGradient)"
                stroke="#b6c7d6"
                strokeWidth="2"
              />

              <line x1={backWallTop[0].x} y1={backWallTop[0].y} x2={backWallTop[1].x} y2={backWallTop[1].y} stroke="#ffffff" strokeWidth="2" opacity="0.78" />
              <line x1={leftWallTop[0].x} y1={leftWallTop[0].y} x2={leftWallTop[1].x} y2={leftWallTop[1].y} stroke="#ffffff" strokeWidth="2" opacity="0.78" />

              {[0.16, 0.5, 0.84].map((ratio) => {
                const p = isoPoint(logicalWidth * ratio, 0, wallHeight * 0.62, logicalWidth, logicalHeight);
                return (
                  <g key={'lamp-back-' + ratio}>
                    <rect x={p.x - 14} y={p.y - 6} width="28" height="8" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
                    <ellipse cx={p.x} cy={p.y + 4} rx="22" ry="7" fill="#fff7d6" opacity="0.38" />
                  </g>
                );
              })}

              {[0.22, 0.64].map((ratio) => {
                const p = isoPoint(0, logicalHeight * ratio, wallHeight * 0.58, logicalWidth, logicalHeight);
                return (
                  <g key={'lamp-left-' + ratio}>
                    <rect x={p.x - 12} y={p.y - 5} width="24" height="7" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
                    <ellipse cx={p.x} cy={p.y + 4} rx="19" ry="6" fill="#fff7d6" opacity="0.34" />
                  </g>
                );
              })}

              <polygon points={polygonPoints(floor)} fill="url(#floorGradient)" stroke="#9fb2c5" strokeWidth="2.5" />
              <polygon points={polygonPoints(floor)} fill="url(#floorGrid)" opacity="0.72" />

              <line x1={floor[0].x} y1={floor[0].y} x2={floor[1].x} y2={floor[1].y} stroke="#6e879b" strokeWidth="4" opacity="0.48" />
              <line x1={floor[0].x} y1={floor[0].y} x2={floor[3].x} y2={floor[3].y} stroke="#6e879b" strokeWidth="4" opacity="0.48" />

              <polyline
                points={polygonPoints([
                  isoPoint(logicalWidth * 0.05, logicalHeight * 0.86, 0.8, logicalWidth, logicalHeight),
                  isoPoint(logicalWidth * 0.38, logicalHeight * 0.86, 0.8, logicalWidth, logicalHeight),
                  isoPoint(logicalWidth * 0.38, logicalHeight * 0.68, 0.8, logicalWidth, logicalHeight),
                ])}
                fill="none"
                stroke="#f3c24b"
                strokeWidth="2.3"
                strokeDasharray="9 7"
                opacity="0.56"
              />
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
                    occupiedSubpositions={occupancyBySubposition}
                    highlighted={highlighted}
                    highlightedSubpositions={highlightedSubpositions}
                    dimmed={hasActiveSelection && !highlighted}
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
