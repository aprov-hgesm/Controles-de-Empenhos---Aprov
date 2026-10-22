'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PackageSearch, Search, Sparkles } from 'lucide-react';

import type { WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import { warehouseApplianceFrontForView, type WarehouseApplianceFace } from '../../../lib/warehouse/applianceOrientation';
import { WarehouseColdAppliance3D } from './WarehouseColdAppliance3D';
import {
  fitWarehouseIsometricScene,
  transformWarehouseIsoRectForView,
  warehouseIsoRoomDimensions,
  type WarehouseIsoPoint,
  type WarehouseIsoView,
  warehouseLandingIsoFrame,
} from '../../../lib/warehouse/isometricCamera';
import type {
  WarehouseDepot,
  WarehouseLocation,
  WarehouseLocationBalance,
} from '../../../lib/warehouse/location';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseLot } from '../../../lib/warehouse/lot';
import {
  warehouseVisualExpiryMap,
  warehouseVisualStackSlots,
  type WarehouseVisualExpiry,
} from '../../../lib/warehouse/stockVisual';
import { deriveWarehouseLocationContents } from '../../../lib/warehouse/locationContents';
import {
  WarehouseLocationContentsTooltip,
  WarehouseLocationDetailsDialog,
  type WarehouseInspectionLotState,
} from './WarehouseLocationInspection';
import { WarehouseGlobalMaterialSearch } from './WarehouseGlobalMaterialSearch';
import {
  WAREHOUSE_BOX_VISUAL,
  WAREHOUSE_PALLET_VISUAL,
  WAREHOUSE_RACK_VISUAL,
} from '../visualStyle';

type Props = {
  logicalWidth: number;
  logicalHeight: number;
  objects: WarehouseDepotLayoutObject[];
  locations: WarehouseLocation[];
  balances: WarehouseLocationBalance[];
  materials: WarehouseMaterial[];
  workspaceId?: string;
  onMaterialUpdated?: (material: WarehouseMaterial) => void;
  lots?: WarehouseLot[];
  selectedMaterialId: string;
  queryText: string;
  onQueryTextChange: (value: string) => void;
  onSelectedMaterialIdChange: (value: string) => void;
  embedded?: boolean;
  /** Read-only scene for the unified landing SVG; reuses the official 3D renderer. */
  sceneOnly?: boolean;
  depotId?: string;
  depotName?: string;
  inspectionLots?: WarehouseLot[];
  inspectionLotState?: WarehouseInspectionLotState;
  inspectionError?: string | null;
  inspectionComplete?: boolean;
  inspectionAvailable?: boolean;
  onInspectLocation?: () => void;
  onRefreshInspection?: () => void;
  globalDepots?: WarehouseDepot[];
  globalLocations?: WarehouseLocation[];
  globalBalances?: WarehouseLocationBalance[];
  globalLoaded?: boolean;
  globalComplete?: boolean;
  focusedLocationId?: string | null;
  onNavigateToGlobalLocation?: (depotId: string, locationId: string) => void;
};

type IsoPoint = { x: number; y: number };
type CanonicalVisualKind = 'SHELF' | 'PALLET' | 'FREEZER' | 'REFRIGERATOR' | 'BENCH';
type PreviewView = WarehouseIsoView;

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
  // Usa a mesma escala para os dois eixos. Normalizar X pela largura e Y pela
  // profundidade faria qualquer depósito ocupar sempre um "quadrado" isométrico,
  // independentemente da proporção física (ex.: 12000×2400).
  const scaleBase = Math.max(1, logicalWidth, logicalHeight);
  const nx = x / scaleBase;
  const ny = y / scaleBase;
  return {
    x: ORIGIN_X + (nx - ny) * FLOOR_HALF_W,
    y: ORIGIN_Y + (nx + ny) * FLOOR_HALF_H - z,
  };
}

function polygonPoints(pointsList: IsoPoint[]): string {
  return pointsList.map((point) => point.x.toFixed(1) + ',' + point.y.toFixed(1)).join(' ');
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

/** Arte 3D da embalagem: volume e posição são definidos pelo motor existente. */
function boxGroup(
  key: string,
  x: number,
  y: number,
  scale = 1,
  selected = false,
  expiry: WarehouseVisualExpiry = 'normal'
) {
  const normal = expiry === 'normal';
  return (
    <g
      key={key}
      transform={'translate(' + x + ' ' + y + ') scale(' + scale + ')'}
      data-visual-role="warehouse-stock-box"
      data-selected={selected ? 'true' : 'false'}
      data-expiry-state={expiry}
      opacity={selected ? 1 : 0.98}
    >
      {/* Sombra de apoio sem filtro por caixa, para manter baixo custo no SVG. */}
      <ellipse cx="0" cy="22.2" rx="13" ry="3.2" fill="#29303a" opacity="0.16" />
      <polygon
        points="-14,0 0,-8 14,0 0,8"
        fill={normal ? 'url(#r362BoxTop)' : expiry === 'near' ? '#fef08a' : '#fecaca'}
        stroke={expiry === 'near' ? '#ca8a04' : expiry === 'expired' ? '#b91c1c' : WAREHOUSE_BOX_VISUAL.topStroke}
        strokeWidth="0.7"
      />
      <polygon
        points="-14,0 0,8 0,22 -14,14"
        fill={normal ? 'url(#r362BoxFront)' : expiry === 'near' ? '#facc15' : '#f87171'}
        stroke={expiry === 'near' ? '#a16207' : expiry === 'expired' ? '#b91c1c' : WAREHOUSE_BOX_VISUAL.frontStroke}
        strokeWidth="0.65"
      />
      <polygon
        points="14,0 0,8 0,22 14,14"
        fill={normal ? 'url(#r362BoxSide)' : expiry === 'near' ? '#eab308' : '#dc2626'}
        stroke={expiry === 'near' ? '#a16207' : expiry === 'expired' ? '#991b1b' : WAREHOUSE_BOX_VISUAL.sideStroke}
        strokeWidth="0.65"
      />
      {/* Fita e reflexos delicados seguem o mesmo cubo nas quatro câmeras. */}
      <polygon points="-2.5,-6.5 1.6,-7.1 5.4,4.6 1.5,6.6" fill="#fff1d0" opacity="0.64" />
      <path d="M -13.3 0 L 0 -7.1 L 13.3 0" fill="none" stroke="#fff4da" strokeWidth="0.9" opacity="0.77" />
      <path d="M -13.1 1 L -13.1 13.4 L -0.8 20.9" fill="none" stroke="#fce0ab" strokeWidth="0.72" opacity="0.55" />
      <path d="M 13.2 1 L 13.2 13.3 L 0.7 20.9" fill="none" stroke="#4d2c1e" strokeWidth="0.7" opacity="0.21" />
    </g>
  );
}

/**
 * Render each box on a real support level. Second-tier boxes stay immediately
 * above the first tier, instead of floating at arbitrary screen offsets.
 */
function stockBoxesOnSurface(
  key: string,
  object: WarehouseDepotLayoutObject,
  supportZ: number,
  quantity: number,
  logicalWidth: number,
  logicalHeight: number,
  scale: number,
  selected: boolean,
  expiry: WarehouseVisualExpiry,
  maximum = 8
) {
  const boxHeight = 22 * scale;
  return warehouseVisualStackSlots(quantity, maximum).map((slot, index) => {
    const topZ = supportZ + (slot.layer + 1) * boxHeight;
    const position = isoPoint(
      object.x + object.width * slot.u,
      object.y + object.height * slot.v,
      topZ,
      logicalWidth,
      logicalHeight
    );
    return boxGroup(key + '-' + index, position.x, position.y, scale, selected, expiry);
  });
}

function rackBeamPrism({
  key,
  x,
  y,
  width,
  depth,
  z,
  height,
  logicalWidth,
  logicalHeight,
  rear = false,
  side = false,
}: {
  key: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  z: number;
  height: number;
  logicalWidth: number;
  logicalHeight: number;
  rear?: boolean;
  side?: boolean;
}) {
  const a = isoPoint(x, y, z, logicalWidth, logicalHeight);
  const b = isoPoint(x + width, y, z, logicalWidth, logicalHeight);
  const c = isoPoint(x + width, y + depth, z, logicalWidth, logicalHeight);
  const d = isoPoint(x, y + depth, z, logicalWidth, logicalHeight);
  const at = isoPoint(x, y, z + height, logicalWidth, logicalHeight);
  const bt = isoPoint(x + width, y, z + height, logicalWidth, logicalHeight);
  const ct = isoPoint(x + width, y + depth, z + height, logicalWidth, logicalHeight);
  const dt = isoPoint(x, y + depth, z + height, logicalWidth, logicalHeight);
  const frontFill = rear
    ? WAREHOUSE_RACK_VISUAL.rearBeamFront
    : side
      ? WAREHOUSE_RACK_VISUAL.beamSide
      : WAREHOUSE_RACK_VISUAL.beamFront;
  const topFill = rear
    ? WAREHOUSE_RACK_VISUAL.rearBeamTop
    : WAREHOUSE_RACK_VISUAL.beamTop;

  return (
    <g key={key} data-visual-role={side ? 'rack-side-beam' : rear ? 'rack-rear-beam' : 'rack-front-beam'}>
      <polygon
        points={polygonPoints([d, c, ct, dt])}
        fill={rear || side ? frontFill : 'url(#r362RackBeam)'}
        stroke={WAREHOUSE_RACK_VISUAL.beamStroke}
        strokeWidth="0.55"
      />
      <polygon
        points={polygonPoints([b, c, ct, bt])}
        fill={WAREHOUSE_RACK_VISUAL.beamSide}
        stroke={WAREHOUSE_RACK_VISUAL.beamStroke}
        strokeWidth="0.5"
      />
      <polygon
        points={polygonPoints([at, bt, ct, dt])}
        fill={topFill}
        stroke={WAREHOUSE_RACK_VISUAL.beamStroke}
        strokeWidth="0.85"
      />
      <line x1={dt.x} y1={dt.y} x2={ct.x} y2={ct.y}
        stroke="#ffe0ad" strokeWidth="0.95" opacity="0.74" />
      <line x1={c.x} y1={c.y} x2={ct.x} y2={ct.y}
        stroke="#713f20" strokeWidth="0.65" opacity="0.27" />
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
          opacity={highlighted ? 0.99 : 0.97}
        />
        <line x1={-width / 2 + 7} x2={width / 2 - 7} y1={-height + 2.3} y2={-height + 2.3}
          stroke={highlighted ? '#a5d2ff' : '#ffffff'} strokeWidth="1.1" opacity="0.9" />
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
      fill="#122538"
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
  expiry,
  expiryBySubposition,
  expiryByBaseLocation,
  highlighted,
  highlightedSubpositions,
  dimmed,
  applianceFront,
  showLabels,
}: {
  object: WarehouseDepotLayoutObject;
  logicalWidth: number;
  logicalHeight: number;
  location: WarehouseLocation | null;
  subpositions: WarehouseLocation[];
  occupiedQuantity: number;
  occupiedSubpositions: Map<string, number>;
  expiry: WarehouseVisualExpiry;
  expiryBySubposition: Map<string, WarehouseVisualExpiry>;
  expiryByBaseLocation: Map<string, WarehouseVisualExpiry>;
  highlighted: boolean;
  highlightedSubpositions: WarehouseLocation[];
  dimmed: boolean;
  applianceFront: WarehouseApplianceFace;
  showLabels: boolean;
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
  // A seleção azul prevalece sobre a sinalização suave de validade.
  const highlightFilter = highlighted
    ? 'url(#warehouseGlowStrong)'
    : expiry === 'near'
      ? 'url(#warehouseExpirySoftGlow)'
      : 'url(#warehouseObjectShadow)';
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
        {showLabels && (
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
        )}
      </g>
    );
  }

  const commonHighlight = highlighted || expiry === 'near' ? (
    <polygon
      points={polygonPoints([a, b, c, d])}
      fill={highlighted ? '#dbeafe' : '#fef3c7'}
      stroke={highlighted ? '#2563eb' : '#eab308'}
      strokeWidth={highlighted ? 4.5 : 2.4}
      opacity={highlighted ? 0.9 : 0.6}
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
        data-visual-role="warehouse-pallet"
        opacity={groupOpacity}
        filter={highlightFilter}
      >
        {contactShadow(object, logicalWidth, logicalHeight, 0.2)}
        {commonHighlight}

        {Array.from({ length: slatCount }, (_, index) => {
          const cellWidth = object.width / slatCount;
          const gap = Math.max(1.2, cellWidth * 0.18);
          const slatX = object.x + index * cellWidth + gap / 2;
          const slatWidth = Math.max(2, cellWidth - gap);
          const slatBottomZ = z - 3.2;
          const sa = isoPoint(slatX, object.y, z, logicalWidth, logicalHeight);
          const sb = isoPoint(slatX + slatWidth, object.y, z, logicalWidth, logicalHeight);
          const sc = isoPoint(slatX + slatWidth, object.y + object.height, z, logicalWidth, logicalHeight);
          const sd = isoPoint(slatX, object.y + object.height, z, logicalWidth, logicalHeight);
          const sdb = isoPoint(slatX, object.y + object.height, slatBottomZ, logicalWidth, logicalHeight);
          const scb = isoPoint(slatX + slatWidth, object.y + object.height, slatBottomZ, logicalWidth, logicalHeight);
          const sbb = isoPoint(slatX + slatWidth, object.y, slatBottomZ, logicalWidth, logicalHeight);

          return (
            <g key={'slat-' + index}>
              <polygon
                points={polygonPoints([sa, sb, sc, sd])}
                fill="url(#palletWood)"
                stroke={WAREHOUSE_PALLET_VISUAL.frontStroke}
                strokeWidth="1"
              />
              <polygon
                points={polygonPoints([sd, sc, scb, sdb])}
                fill={WAREHOUSE_PALLET_VISUAL.frontFill}
                stroke={WAREHOUSE_PALLET_VISUAL.frontStroke}
                strokeWidth="0.85"
              />
              <polygon
                points={polygonPoints([sb, sc, scb, sbb])}
                fill={WAREHOUSE_PALLET_VISUAL.sideFill}
                stroke={WAREHOUSE_PALLET_VISUAL.sideStroke}
                strokeWidth="0.75"
              />
              <line
                x1={sa.x}
                y1={sa.y}
                x2={sb.x}
                y2={sb.y}
                stroke={WAREHOUSE_PALLET_VISUAL.highlight}
                strokeWidth="0.95"
                opacity="0.78"
              />
              <line x1={sa.x} y1={sa.y} x2={sd.x} y2={sd.y}
                stroke="#fff0ce" strokeWidth="0.6" opacity="0.36" />
              <line x1={sb.x} y1={sb.y} x2={sc.x} y2={sc.y}
                stroke="#684223" strokeWidth="0.55" opacity="0.30" />
            </g>
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
              stroke={WAREHOUSE_PALLET_VISUAL.runnerFill}
              strokeWidth="6.2"
              strokeLinecap="round"
              opacity="0.95"
            />
          );
        })}

        {stockBoxesOnSurface(
          'pal-box', object, z, occupiedQuantity,
          logicalWidth, logicalHeight, 0.88, highlighted, expiry
        )}

        {showLabels && renderLabel(
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
    const levels = clamp(subpositions.length || 4, 2, 8);
    // Preserve physical clearance between decks even with eight levels.
    const rackBoxScale = Math.min(0.60, z / ((levels + 0.35) * 48));
    const subpositionTotal = subpositions.reduce(
      (sum, item) => sum + (occupiedSubpositions.get(item.id) || 0), 0
    );
    const baseQuantity = Math.max(0, occupiedQuantity - subpositionTotal);
    const beamDepth = clamp(object.height * 0.065, 2.6, 7.2);
    const sideBeamWidth = clamp(object.width * 0.022, 1.8, 4.6);
    const beamHeight = 3.35;

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
              <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={WAREHOUSE_RACK_VISUAL.postDark} strokeWidth="6.6" />
              <line x1={base.x + 1.6} y1={base.y} x2={top.x + 1.6} y2={top.y} stroke={WAREHOUSE_RACK_VISUAL.postHighlight} strokeWidth="1.3" opacity="0.88" />
              {Array.from({ length: 8 }, (_, holeIndex) => {
                const t = (holeIndex + 1) / 9;
                const hx = base.x + (top.x - base.x) * t;
                const hy = base.y + (top.y - base.y) * t;
                return <circle key={holeIndex} cx={hx} cy={hy} r="1.05" fill={WAREHOUSE_RACK_VISUAL.postHighlight} opacity="0.72" />;
              })}
            </g>
          );
        })}

        {[backBottomLeft, backBottomRight].map((base, index) => (
          <g key={'back-foot-' + index}>
            <rect x={base.x - 6} y={base.y - 2} width="12" height="6" rx="1.8" fill={WAREHOUSE_RACK_VISUAL.postMain} stroke={WAREHOUSE_RACK_VISUAL.postDark} strokeWidth="1" opacity="0.72" />
            <rect x={base.x - 3} y={base.y - 12} width="6" height="10" rx="1.5" fill={WAREHOUSE_RACK_VISUAL.postMain} stroke={WAREHOUSE_RACK_VISUAL.postDark} strokeWidth="0.8" opacity="0.62" />
          </g>
        ))}

        {[
          [frontBottomLeft, backBottomLeft, backTopLeft, frontTopLeft],
          [frontBottomRight, backBottomRight, backTopRight, frontTopRight],
        ].map((frame, side) => (
          <g key={'side-frame-' + side}>
            <line x1={frame[0].x} y1={frame[0].y} x2={frame[2].x} y2={frame[2].y} stroke={WAREHOUSE_RACK_VISUAL.postHighlight} strokeWidth="2" opacity="0.9" />
            <line x1={frame[1].x} y1={frame[1].y} x2={frame[3].x} y2={frame[3].y} stroke={WAREHOUSE_RACK_VISUAL.postHighlight} strokeWidth="2" opacity="0.9" />
            <line x1={frame[0].x} y1={frame[0].y} x2={frame[1].x} y2={frame[1].y} stroke={WAREHOUSE_RACK_VISUAL.frameStroke} strokeWidth="2.2" />
            <line x1={frame[2].x} y1={frame[2].y} x2={frame[3].x} y2={frame[3].y} stroke={WAREHOUSE_RACK_VISUAL.frameStroke} strokeWidth="2.2" />
          </g>
        ))}

        {Array.from({ length: levels }, (_, index) => {
          const ratio = (index + 1) / (levels + 0.35);
          const shelfZ = z * ratio;
          const p1 = isoPoint(object.x, object.y, shelfZ, logicalWidth, logicalHeight);
          const p2 = isoPoint(object.x + object.width, object.y, shelfZ, logicalWidth, logicalHeight);
          const p3 = isoPoint(object.x + object.width, object.y + object.height, shelfZ, logicalWidth, logicalHeight);
          const p4 = isoPoint(object.x, object.y + object.height, shelfZ, logicalWidth, logicalHeight);

          const linkedSubposition = subpositions[index] || null;
          const levelQuantity = (linkedSubposition ? occupiedSubpositions.get(linkedSubposition.id) || 0 : 0)
            + (index === 0 ? baseQuantity : 0);
          const baseExpiry = index === 0
            ? expiryByBaseLocation.get(object.warehouseLocationId || '') || 'normal'
            : 'normal';
          const childExpiry = linkedSubposition
            ? expiryBySubposition.get(linkedSubposition.id) || 'normal'
            : 'normal';
          const levelExpiry = baseExpiry === 'expired' || childExpiry === 'expired'
            ? 'expired' : baseExpiry === 'near' || childExpiry === 'near' ? 'near' : 'normal';
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
                stroke={WAREHOUSE_RACK_VISUAL.deckStroke}
                strokeWidth="0.8"
                opacity="0.98"
              />
              <line x1={p4.x} y1={p4.y} x2={p3.x} y2={p3.y}
                stroke="#8fa3b3" strokeWidth="1.35" opacity="0.7" />

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
                    stroke={WAREHOUSE_RACK_VISUAL.deckLine}
                    strokeWidth="0.7"
                    opacity="0.82"
                  />
                );
              })}

              {rackBeamPrism({
                key: 'rear-beam-' + index,
                x: object.x,
                y: object.y,
                width: object.width,
                depth: beamDepth,
                z: shelfZ - beamHeight,
                height: beamHeight,
                logicalWidth,
                logicalHeight,
                rear: true,
              })}
              {rackBeamPrism({
                key: 'left-side-beam-' + index,
                x: object.x,
                y: object.y,
                width: sideBeamWidth,
                depth: object.height,
                z: shelfZ - beamHeight,
                height: beamHeight * 0.82,
                logicalWidth,
                logicalHeight,
                side: true,
              })}
              {rackBeamPrism({
                key: 'right-side-beam-' + index,
                x: object.x + object.width - sideBeamWidth,
                y: object.y,
                width: sideBeamWidth,
                depth: object.height,
                z: shelfZ - beamHeight,
                height: beamHeight * 0.82,
                logicalWidth,
                logicalHeight,
                side: true,
              })}

              {stockBoxesOnSurface(
                'rack-level-box-' + index, object, shelfZ, levelQuantity,
                logicalWidth, logicalHeight, rackBoxScale, levelHighlighted || highlighted,
                levelExpiry, 6
              )}
              {rackBeamPrism({
                key: 'front-beam-' + index,
                x: object.x,
                y: object.y + object.height - beamDepth,
                width: object.width,
                depth: beamDepth,
                z: shelfZ - beamHeight,
                height: beamHeight,
                logicalWidth,
                logicalHeight,
              })}
            </g>
          );
        })}

        {/* Camada frontal: pintada depois das prateleiras para oclusão isométrica correta. */}
        {[frontBottomLeft, frontBottomRight].map((base, index) => {
          const top = [frontTopLeft, frontTopRight][index];
          return (
            <g key={'front-upright-' + index}>
              <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke={WAREHOUSE_RACK_VISUAL.postDark} strokeWidth="6.6" />
              <line x1={base.x + 1.6} y1={base.y} x2={top.x + 1.6} y2={top.y} stroke={WAREHOUSE_RACK_VISUAL.postHighlight} strokeWidth="1.3" opacity="0.9" />
              {Array.from({ length: 8 }, (_, holeIndex) => {
                const t = (holeIndex + 1) / 9;
                const hx = base.x + (top.x - base.x) * t;
                const hy = base.y + (top.y - base.y) * t;
                return <circle key={holeIndex} cx={hx} cy={hy} r="1.05" fill={WAREHOUSE_RACK_VISUAL.postHighlight} opacity="0.78" />;
              })}
            </g>
          );
        })}

        {[frontBottomLeft, frontBottomRight].map((base, index) => (
          <g key={'front-foot-' + index}>
            <rect x={base.x - 6} y={base.y - 2} width="12" height="6" rx="1.8" fill={WAREHOUSE_RACK_VISUAL.postMain} stroke={WAREHOUSE_RACK_VISUAL.postDark} strokeWidth="1" />
            <rect x={base.x - 3} y={base.y - 12} width="6" height="10" rx="1.5" fill={WAREHOUSE_RACK_VISUAL.postMain} stroke={WAREHOUSE_RACK_VISUAL.postDark} strokeWidth="0.8" opacity="0.98" />
          </g>
        ))}



        {showLabels && renderLabel(
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

  if (kind === 'FREEZER' || kind === 'REFRIGERATOR') {
    return (
      <g
        data-location-id={object.warehouseLocationId || ''}
        data-occupied={occupiedQuantity > 0 ? 'true' : 'false'}
        data-highlighted={highlighted ? 'true' : 'false'}
        opacity={groupOpacity}
        filter={highlightFilter}
      >
        {contactShadow(object, logicalWidth, logicalHeight, kind === 'FREEZER' ? 0.22 : 0.25)}
        {commonHighlight}
        <WarehouseColdAppliance3D
          object={object}
          z={z}
          kind={kind}
          front={applianceFront}
          project={(px, py, pz) => isoPoint(px, py, pz, logicalWidth, logicalHeight)}
          occupied={occupiedQuantity > 0}
          expiry={expiry}
        />
        {showLabels && renderLabel(
          centerTop,
          code,
          kind === 'FREEZER' ? 'Freezer industrial' : 'Geladeira industrial',
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

        <polygon points={polygonPoints([at, bt, ct, dt])} fill="url(#metalSheen)" stroke="#4f6878" strokeWidth="2.4" />
        <polygon
          points={polygonPoints([
            isoPoint(object.x, object.y + object.height, z - 9, logicalWidth, logicalHeight),
            isoPoint(object.x + object.width, object.y + object.height, z - 9, logicalWidth, logicalHeight),
            ct,
            dt,
          ])}
          fill="url(#benchFront)"
          stroke="#536d7d"
          strokeWidth="2"
        />
        <polygon
          points={polygonPoints([
            isoPoint(object.x + object.width, object.y, z - 9, logicalWidth, logicalHeight),
            isoPoint(object.x + object.width, object.y + object.height, z - 9, logicalWidth, logicalHeight),
            ct,
            bt,
          ])}
          fill="#aebdc7"
          stroke="#5a7180"
          strokeWidth="1.7"
          opacity="0.96"
        />

        <polygon points={polygonPoints([lowerA, lowerB, lowerC, lowerD])} fill="url(#benchLowerShelf)" stroke="#5d7482" strokeWidth="1.55" opacity="0.98" />

        {legPoints.map((leg, index) => {
          const bottom = isoPoint(object.x + object.width * leg.rx, object.y + object.height * leg.ry, 4, logicalWidth, logicalHeight);
          const top = isoPoint(object.x + object.width * leg.rx, object.y + object.height * leg.ry, z - 2, logicalWidth, logicalHeight);
          return (
            <g key={'bench-leg-' + index}>
              <line x1={bottom.x} y1={bottom.y} x2={top.x} y2={top.y} stroke="#405766" strokeWidth="6.4" strokeLinecap="round" />
              <line x1={bottom.x + 1.4} y1={bottom.y - 1} x2={top.x + 1.4} y2={top.y - 1} stroke="#b9c7cf" strokeWidth="1.35" opacity="0.9" />
              <ellipse cx={bottom.x} cy={bottom.y + 2} rx="5" ry="2.8" fill="#2f4350" />
              <ellipse cx={bottom.x} cy={bottom.y + 1.2} rx="3.2" ry="1.5" fill="#899aa4" opacity="0.72" />
            </g>
          );
        })}

        <line x1={at.x} y1={at.y} x2={bt.x} y2={bt.y} stroke="#ffffff" strokeWidth="3.2" opacity="0.96" />
        <line x1={bt.x} y1={bt.y} x2={ct.x} y2={ct.y} stroke="#708795" strokeWidth="2.1" opacity="0.9" />
        <line x1={dt.x} y1={dt.y} x2={ct.x} y2={ct.y} stroke="#4f6878" strokeWidth="2.5" opacity="0.96" />
        <line x1={at.x} y1={at.y} x2={dt.x} y2={dt.y} stroke="#7d929f" strokeWidth="1.8" opacity="0.9" />

        {stockBoxesOnSurface(
          'bench-box', object, z, occupiedQuantity,
          logicalWidth, logicalHeight, 0.68, highlighted, expiry, 6
        )}

        {showLabels && renderLabel(
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
  workspaceId,
  onMaterialUpdated,
  lots = [],
  selectedMaterialId,
  queryText,
  onQueryTextChange,
  onSelectedMaterialIdChange,
  embedded = false,
  sceneOnly = false,
  depotId = '',
  depotName = 'Depósito',
  inspectionLots = [],
  inspectionLotState = 'idle',
  inspectionError = null,
  inspectionComplete = false,
  inspectionAvailable = true,
  onInspectLocation,
  onRefreshInspection,
  globalDepots,
  globalLocations,
  globalBalances,
  globalLoaded = true,
  globalComplete = true,
  focusedLocationId = null,
  onNavigateToGlobalLocation,
}: Props) {
  const [previewView, setPreviewView] = useState<PreviewView>('front');
  const [viewTransitioning, setViewTransitioning] = useState(false);
  const [hoveredObject, setHoveredObject] = useState<{
    objectId: string; locationId: string;
  } | null>(null);
  // O painel mantém o último local consultado mesmo quando o cursor sai do SVG.
  // O highlight continua limitado ao hover ativo para não dar falsa seleção.
  const [inspectedLocationId, setInspectedLocationId] = useState<string | null>(null);
  const [detailLocationId, setDetailLocationId] = useState<string | null>(null);
  const onInspectLocationRef = useRef(onInspectLocation);
  const [currentDay, setCurrentDay] = useState(() => new Date());

  // Reavalia o calendário quando o usuário volta à aba após uma virada de dia.
  useEffect(() => {
    const refreshDay = () => setCurrentDay(new Date());
    document.addEventListener('visibilitychange', refreshDay);
    return () => document.removeEventListener('visibilitychange', refreshDay);
  }, []);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const changePreviewView = (nextView: PreviewView) => {
    setHoveredObject(null);
    if (nextView === previewView || viewTransitioning) return;

    setViewTransitioning(true);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

    transitionTimerRef.current = setTimeout(() => {
      setPreviewView(nextView);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setViewTransitioning(false));
      });
    }, 110);
  };

  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  );

  const hoveredContents = useMemo(
    () => inspectedLocationId
      ? deriveWarehouseLocationContents(
        inspectedLocationId, locations, balances, materials, inspectionLots
      )
      : null,
    [inspectedLocationId, locations, balances, materials, inspectionLots]
  );
  const detailContents = useMemo(
    () => detailLocationId
      ? deriveWarehouseLocationContents(
        detailLocationId, locations, balances, materials, inspectionLots
      )
      : null,
    [detailLocationId, locations, balances, materials, inspectionLots]
  );

  useEffect(() => {
    setHoveredObject(null);
    setInspectedLocationId(null);
    setDetailLocationId(null);
  }, [depotId]);

  useEffect(() => {
    onInspectLocationRef.current = onInspectLocation;
  }, [onInspectLocation]);

  // Prioriza a abertura da janela: consulta remota apenas depois do
  // primeiro paint do dialog, sem repintar a cena 3D no pointer-enter.
  useEffect(() => {
    if (!detailLocationId) return;
    let nextFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      nextFrame = window.requestAnimationFrame(() => {
        onInspectLocationRef.current?.();
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (nextFrame) window.cancelAnimationFrame(nextFrame);
    };
  }, [detailLocationId]);

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

  const availableMaterialIds = useMemo(() => {
    const ids = new Set<string>();
    for (const balance of balances) {
      if (balance.quantity <= 0 || balance.position.kind === 'UNASSIGNED') continue;
      ids.add(balance.materialId);
    }
    return ids;
  }, [balances]);

  const materialMatches = useMemo(() => {
    const availableMaterials = materials.filter((material) =>
      availableMaterialIds.has(material.id)
    );
    const normalized = queryText.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return availableMaterials.slice(0, 8);
    return availableMaterials
      .filter((material) =>
        [material.id, material.description, ...(material.aliases || [])]
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(normalized)
      )
      .slice(0, 8);
  }, [availableMaterialIds, materials, queryText]);

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

  const expiryVisual = useMemo(
    () => warehouseVisualExpiryMap(balances, lots, currentDay),
    [balances, lots, currentDay]
  );

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
        .map((object) => ({
          ...transformWarehouseIsoRectForView(
            object,
            logicalWidth,
            logicalHeight,
            previewView
          ),
          // Physical door normal is derived BEFORE rotating the room.
          applianceFront: warehouseApplianceFrontForView(object.width, object.height, previewView),
        }))
        .sort((left, right) => {
          // Painter's order follows the furthest occupied floor corner, not the
          // object's origin. A long pallet must not paint over the foreground
          // face of a freezer whose footprint is actually closer to camera.
          const leftDepth = left.x + left.width + left.y + left.height;
          const rightDepth = right.x + right.width + right.y + right.height;
          return leftDepth - rightDepth || left.layer - right.layer || left.id.localeCompare(right.id);
        }),
    [logicalHeight, logicalWidth, objects, previewView]
  );

  const { width: viewLogicalWidth, height: viewLogicalHeight } = warehouseIsoRoomDimensions(
    logicalWidth,
    logicalHeight,
    previewView
  );

  const floor = [
    isoPoint(0, 0, 0, viewLogicalWidth, viewLogicalHeight),
    isoPoint(viewLogicalWidth, 0, 0, viewLogicalWidth, viewLogicalHeight),
    isoPoint(viewLogicalWidth, viewLogicalHeight, 0, viewLogicalWidth, viewLogicalHeight),
    isoPoint(0, viewLogicalHeight, 0, viewLogicalWidth, viewLogicalHeight),
  ];

  const wallHeight = 154;
  const backWallTop = [
    isoPoint(0, 0, wallHeight, viewLogicalWidth, viewLogicalHeight),
    isoPoint(viewLogicalWidth, 0, wallHeight, viewLogicalWidth, viewLogicalHeight),
  ];
  const leftWallTop = [
    isoPoint(0, 0, wallHeight, viewLogicalWidth, viewLogicalHeight),
    isoPoint(0, viewLogicalHeight, wallHeight, viewLogicalWidth, viewLogicalHeight),
  ];

  // A câmera SVG deriva da geometria projetada, nunca de offsets fixos.
  // Inclui piso, paredes, volumes e espaço reservado para etiquetas e caixas.
  // A vista altera visibleObjects: o enquadramento se recalcula automaticamente.
  const cameraViewBox = useMemo(() => {
    // Início uses a fixed floor-anchored camera, independent of object/label
    // count. The normal detailed preview keeps its existing dynamic fit.
    if (sceneOnly) {
      return warehouseLandingIsoFrame(viewLogicalWidth, viewLogicalHeight).viewBox;
    }
    const roomPoints: WarehouseIsoPoint[] = [
      isoPoint(0, 0, 0, viewLogicalWidth, viewLogicalHeight),
      isoPoint(viewLogicalWidth, 0, 0, viewLogicalWidth, viewLogicalHeight),
      isoPoint(viewLogicalWidth, viewLogicalHeight, 0, viewLogicalWidth, viewLogicalHeight),
      isoPoint(0, viewLogicalHeight, 0, viewLogicalWidth, viewLogicalHeight),
      isoPoint(0, 0, wallHeight, viewLogicalWidth, viewLogicalHeight),
      isoPoint(viewLogicalWidth, 0, wallHeight, viewLogicalWidth, viewLogicalHeight),
      isoPoint(0, viewLogicalHeight, wallHeight, viewLogicalWidth, viewLogicalHeight),
    ];

    for (const object of visibleObjects) {
      const kind = canonicalKind(object.kind);
      const location = object.warehouseLocationId
        ? locationById.get(object.warehouseLocationId)
        : null;
      const subpositions = location ? subpositionsByParent.get(location.id) || [] : [];
      const height = object.kind === 'OTHER' && !object.warehouseLocationId
        ? 54
        : objectHeight(kind, subpositions.length);

      for (const x of [object.x, object.x + object.width]) {
        for (const y of [object.y, object.y + object.height]) {
          roomPoints.push(isoPoint(x, y, 0, viewLogicalWidth, viewLogicalHeight));
          roomPoints.push(isoPoint(x, y, height, viewLogicalWidth, viewLogicalHeight));
        }
      }

      // A etiqueta selecionada pode ser maior; reservar o espaço no fit
      // evita cortes durante a pesquisa, sem alterar a projeção da estrutura.
      if (object.kind !== 'OTHER' || object.warehouseLocationId) {
        const label = isoPoint(
          object.x + object.width / 2,
          object.y + object.height / 2,
          height,
          viewLogicalWidth,
          viewLogicalHeight
        );
        const highlighted = object.warehouseLocationId
          ? highlightedLocalIds.has(object.warehouseLocationId)
          : false;
        const labelHalfWidth = highlighted ? 82 : 47;
        const labelTop = highlighted ? 108 : 80;
        roomPoints.push(
          { x: label.x - labelHalfWidth, y: label.y - labelTop },
          { x: label.x + labelHalfWidth, y: label.y + 36 }
        );
      }
    }

    const viewWidth = embedded ? VIEW_WIDTH - 110 : VIEW_WIDTH;
    const viewHeight = embedded ? VIEW_HEIGHT - 95 : VIEW_HEIGHT;
    return fitWarehouseIsometricScene(roomPoints, {
      width: viewWidth,
      height: viewHeight,
      padding: embedded ? 62 : 72,
      maxZoom: 1.28,
    });
  }, [
    embedded, sceneOnly, viewLogicalWidth, viewLogicalHeight, visibleObjects,
    locationById, subpositionsByParent, highlightedLocalIds,
  ]);

  return (
    <section
      className={
        sceneOnly
          ? 'relative h-full w-full overflow-hidden border-0 bg-transparent'
          : embedded
          ? 'overflow-hidden rounded-[22px] border border-white/10 bg-[#061023] shadow-[0_28px_70px_rgba(0,8,28,0.32)]'
          : 'overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm'
      }
      data-testid={sceneOnly ? "warehouse-isometric-scene-only" : "warehouse-isometric-preview"}
      data-scene-only={sceneOnly ? "true" : "false"}
      data-embedded={embedded ? 'true' : 'false'}
    >
      <div
        className={
          sceneOnly
            ? 'hidden'
            : embedded
            ? 'flex flex-col gap-3 border-b border-white/10 bg-[#07101f]/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
            : 'flex flex-col gap-3 border-b border-blue-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
        }
      >
        <div>
          <p
            className={
              embedded
                ? 'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-blue-200/80'
                : 'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#00288e]'
            }
          >
            <Sparkles className="h-3.5 w-3.5" /> {embedded ? 'Visão 3D' : 'Prévia 3D'}
          </p>
          <p
            data-testid={hoveredContents ? 'warehouse-location-hover-status' : undefined}
            aria-live="polite"
            className={
              embedded
                ? 'mt-1 text-[10px] font-semibold text-slate-400'
                : 'mt-1 text-xs font-semibold text-slate-500'
            }
          >
            {hoveredContents
              ? hoveredContents.location.code + ' · '
                + (hoveredContents.rowCount === 0
                  ? 'Local vazio · saldo físico 0'
                  : hoveredContents.materialCount + ' material(is) · consulte os detalhes abaixo')
              : onInspectLocation
                ? inspectionAvailable
                  ? 'Passe o cursor em um local para consultar os itens; clique para detalhes e PDF.'
                  : 'Carregando saldos físicos do depósito para habilitar a inspeção…'
                : 'Visualização em perspectiva oficial do EMPROVEX. Ocupação e localização refletem o saldo físico.'}
          </p>
        </div>

        <div className={embedded ? 'flex flex-col gap-2' : 'flex w-full flex-col gap-2 sm:w-[520px]'}>
          <div
            className="flex flex-wrap items-center justify-end gap-1"
            data-testid="warehouse-isometric-view-controls"
            aria-label="Ângulos da prévia 3D"
          >
            <span
              className={
                embedded
                  ? 'mr-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500'
                  : 'mr-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400'
              }
            >
              Vista
            </span>
            {PREVIEW_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => changePreviewView(view.id)}
                aria-pressed={previewView === view.id}
                data-testid={'warehouse-isometric-view-' + view.id}
                className={
                  previewView === view.id
                    ? 'rounded-lg border border-blue-400/50 bg-blue-500/20 px-2.5 py-1.5 text-[9px] font-black text-blue-100 shadow-sm'
                    : embedded
                      ? 'rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[9px] font-bold text-slate-400 transition hover:border-blue-300/30 hover:bg-blue-400/10 hover:text-blue-100'
                      : 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#00288e]'
                }
              >
                {view.label}
              </button>
            ))}
          </div>

          {!embedded && (
            globalDepots && globalLocations && globalBalances && onNavigateToGlobalLocation
              ? (
                <WarehouseGlobalMaterialSearch
                  depots={globalDepots}
                  locations={globalLocations}
                  balances={globalBalances}
                  materials={materials}
                  loaded={globalLoaded}
                  complete={globalComplete}
                  queryText={queryText}
                  selectedMaterialId={selectedMaterialId}
                  onQueryTextChange={onQueryTextChange}
                  onSelectedMaterialIdChange={onSelectedMaterialIdChange}
                  onNavigateToLocation={(position) =>
                    onNavigateToGlobalLocation(position.depotId, position.locationId)
                  }
                />
              ) : (
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
            )
          )}
        </div>
      </div>

        <div className={sceneOnly
          ? 'hidden'
          : embedded
          ? 'flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/10 bg-[#07101f] px-4 py-2 text-[10px] font-semibold text-slate-300'
          : 'flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-semibold text-slate-600'
        } data-testid="warehouse-stock-expiry-legend">
          <span>Caixas = representação da ocupação física</span>
          <span><span className="mr-1 text-amber-500" aria-hidden="true">■</span> Vence em até 14 dias</span>
          <span><span className="mr-1 text-red-500" aria-hidden="true">■</span> Vencido</span>
          <span><span className="mr-1 text-slate-200" aria-hidden="true">◆</span> Brilho branco = equipamento ocupado</span>
        </div>

      <div className={
        sceneOnly
          ? 'relative h-full w-full min-h-0 overflow-hidden bg-transparent'
          : embedded
          ? 'relative min-h-[650px] overflow-hidden bg-[radial-gradient(circle_at_50%_8%,#fbfdff_0%,#eaf2f8_48%,#cfdeea_100%)]'
          : 'relative min-h-[660px] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#ffffff_0%,#eef5fa_52%,#dce8f2_100%)]'
      }>
        {visibleObjects.length === 0 && !sceneOnly ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/90 px-6 py-5 text-center shadow-sm">
              <PackageSearch className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-xs font-black text-slate-700">O croqui ainda não possui estruturas.</p>
            </div>
          </div>
        ) : (
          <svg
            viewBox={[cameraViewBox.x, cameraViewBox.y, cameraViewBox.width, cameraViewBox.height].join(' ')}
            preserveAspectRatio={sceneOnly ? 'none' : 'xMidYMid meet'}
            pointerEvents={sceneOnly ? 'none' : undefined}
            data-camera-fit={sceneOnly ? 'aligned-floor' : 'bounds'}
            className={
              sceneOnly ? 'absolute inset-0 h-full w-full' :
              'absolute inset-0 h-full w-full origin-center transition-[opacity,transform,filter] duration-200 ease-out '
              + (viewTransitioning
                ? 'scale-[0.992] opacity-20 blur-[1px]'
                : 'scale-100 opacity-100 blur-0')
            }
            role="img"
            aria-label={'Prévia 3D do depósito · vista ' + PREVIEW_VIEWS.find((view) => view.id === previewView)?.label}
          >
            <defs>
              <radialGradient id="r362FloorBloom" cx="32%" cy="24%" r="84%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.56" />
                <stop offset="52%" stopColor="#e0ebf5" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#5c758a" stopOpacity="0.12" />
              </radialGradient>
              <linearGradient id="floorGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f9fafb" />
                <stop offset="48%" stopColor="#e3e9ec" />
                <stop offset="100%" stopColor="#cbd5da" />
              </linearGradient>
              <linearGradient id="wallGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fcfdfd" />
                <stop offset="55%" stopColor="#e8edf0" />
                <stop offset="100%" stopColor="#bac8d0" />
              </linearGradient>
              <linearGradient id="r362BoxTop" x1="0" y1="0" x2="0.9" y2="1">
                <stop offset="0%" stopColor="#f4d4a1" />
                <stop offset="48%" stopColor={WAREHOUSE_BOX_VISUAL.topFill} />
                <stop offset="100%" stopColor="#ca8749" />
              </linearGradient>
              <linearGradient id="r362BoxFront" x1="0" y1="0" x2="1" y2="0.85">
                <stop offset="0%" stopColor="#dfa467" />
                <stop offset="100%" stopColor={WAREHOUSE_BOX_VISUAL.frontFill} />
              </linearGradient>
              <linearGradient id="r362BoxSide" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={WAREHOUSE_BOX_VISUAL.sideFill} />
                <stop offset="100%" stopColor="#784023" />
              </linearGradient>
              <linearGradient id="r362RackBeam" x1="0" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#ffa85d" />
                <stop offset="55%" stopColor={WAREHOUSE_RACK_VISUAL.beamFront} />
                <stop offset="100%" stopColor="#c15e1d" />
              </linearGradient>
              <linearGradient id="rackDeck" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={WAREHOUSE_RACK_VISUAL.deckTop} />
                <stop offset="52%" stopColor={WAREHOUSE_RACK_VISUAL.deckMid} />
                <stop offset="100%" stopColor={WAREHOUSE_RACK_VISUAL.deckDark} />
              </linearGradient>
              <linearGradient id="palletWood" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={WAREHOUSE_PALLET_VISUAL.topLight} />
                <stop offset="48%" stopColor={WAREHOUSE_PALLET_VISUAL.topMid} />
                <stop offset="100%" stopColor={WAREHOUSE_PALLET_VISUAL.topDark} />
              </linearGradient>
              <linearGradient id="palletSide" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={WAREHOUSE_PALLET_VISUAL.frontFill} />
                <stop offset="100%" stopColor={WAREHOUSE_PALLET_VISUAL.sideFill} />
              </linearGradient>
              <linearGradient id="palletSideDark" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={WAREHOUSE_PALLET_VISUAL.sideFill} />
                <stop offset="100%" stopColor={WAREHOUSE_PALLET_VISUAL.runnerFill} />
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
              <linearGradient id="fridgeStainlessDoor" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#eef2f3" />
                <stop offset="18%" stopColor="#cfd6d9" />
                <stop offset="43%" stopColor="#f8fafb" />
                <stop offset="68%" stopColor="#b8c1c5" />
                <stop offset="100%" stopColor="#e2e7e9" />
              </linearGradient>
              <linearGradient id="fridgeStainlessSide" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d2d9dc" />
                <stop offset="52%" stopColor="#adb8bd" />
                <stop offset="100%" stopColor="#8f9da4" />
              </linearGradient>
              <linearGradient id="fridgeStainlessTop" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="48%" stopColor="#e3e8ea" />
                <stop offset="100%" stopColor="#bcc5c9" />
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
              <linearGradient id="benchLowerShelf" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#edf2f4" />
                <stop offset="55%" stopColor="#c4d0d6" />
                <stop offset="100%" stopColor="#98aab4" />
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
              <filter id="warehouseExpirySoftGlow" x="-65%" y="-65%" width="230%" height="230%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#eab308" floodOpacity="0.62" />
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#facc15" floodOpacity="0.26" />
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

              <pattern id="floorGrid" width="72" height="36" patternUnits="userSpaceOnUse" patternTransform="skewY(26)">
                <path d="M 72 0 L 0 0 0 36" fill="none" stroke="#8798a3" strokeWidth="0.85" opacity="0.32" />
                <path d="M 0 2 H 72" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.38" />
              </pattern>
              <linearGradient id="floorSoftSheen" x1="0" y1="0" x2="0.9" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
                <stop offset="58%" stopColor="#ffffff" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#637888" stopOpacity="0.10" />
              </linearGradient>
              <linearGradient id="wallPanelSheen" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.29" />
                <stop offset="65%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="100%" stopColor="#50687b" stopOpacity="0.13" />
              </linearGradient>
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

              <polygon points={polygonPoints([floor[0], floor[1], backWallTop[1], backWallTop[0]])} fill="url(#wallPanelSheen)" />
              <polygon points={polygonPoints([floor[0], floor[3], leftWallTop[1], leftWallTop[0]])} fill="url(#wallPanelSheen)" />
              {/* Subtle panel joints follow the wall's physical axes in every camera view. */}
              {[0.25, 0.5, 0.75].map((ratio) => {
                const a = isoPoint(viewLogicalWidth * ratio, 0, 0, viewLogicalWidth, viewLogicalHeight);
                const b = isoPoint(viewLogicalWidth * ratio, 0, wallHeight, viewLogicalWidth, viewLogicalHeight);
                const c = isoPoint(0, viewLogicalHeight * ratio, 0, viewLogicalWidth, viewLogicalHeight);
                const d = isoPoint(0, viewLogicalHeight * ratio, wallHeight, viewLogicalWidth, viewLogicalHeight);
                return <g key={'panel-' + ratio} stroke="#8b9dab" strokeWidth="0.85" opacity="0.24">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
                </g>;
              })}
              <line x1={backWallTop[0].x} y1={backWallTop[0].y} x2={backWallTop[1].x} y2={backWallTop[1].y} stroke="#ffffff" strokeWidth="2" opacity="0.78" />
              <line x1={leftWallTop[0].x} y1={leftWallTop[0].y} x2={leftWallTop[1].x} y2={leftWallTop[1].y} stroke="#ffffff" strokeWidth="2" opacity="0.78" />

              {[0.16, 0.5, 0.84].map((ratio) => {
                const p = isoPoint(viewLogicalWidth * ratio, 0, wallHeight * 0.62, viewLogicalWidth, viewLogicalHeight);
                return (
                  <g key={'lamp-back-' + ratio}>
                    <rect x={p.x - 14} y={p.y - 6} width="28" height="8" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
                    <ellipse cx={p.x} cy={p.y + 4} rx="22" ry="7" fill="#fff7d6" opacity="0.38" />
                  </g>
                );
              })}

              {[0.22, 0.64].map((ratio) => {
                const p = isoPoint(0, viewLogicalHeight * ratio, wallHeight * 0.58, viewLogicalWidth, viewLogicalHeight);
                return (
                  <g key={'lamp-left-' + ratio}>
                    <rect x={p.x - 12} y={p.y - 5} width="24" height="7" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
                    <ellipse cx={p.x} cy={p.y + 4} rx="19" ry="6" fill="#fff7d6" opacity="0.34" />
                  </g>
                );
              })}

              <polygon points={polygonPoints(floor)} fill="url(#floorGradient)" stroke="#9fb2c5" strokeWidth="2.5" />
              <polygon points={polygonPoints(floor)} fill="url(#r362FloorBloom)" />
              <polygon points={polygonPoints(floor)} fill="url(#floorGrid)" opacity="0.67" />
              <polygon points={polygonPoints(floor)} fill="url(#floorSoftSheen)" />

              <line x1={floor[0].x} y1={floor[0].y} x2={floor[1].x} y2={floor[1].y} stroke="#6e879b" strokeWidth="4" opacity="0.48" />
              <line x1={floor[0].x} y1={floor[0].y} x2={floor[3].x} y2={floor[3].y} stroke="#6e879b" strokeWidth="4" opacity="0.48" />

              <polyline
                points={polygonPoints([
                  isoPoint(viewLogicalWidth * 0.05, viewLogicalHeight * 0.86, 0.8, viewLogicalWidth, viewLogicalHeight),
                  isoPoint(viewLogicalWidth * 0.38, viewLogicalHeight * 0.86, 0.8, viewLogicalWidth, viewLogicalHeight),
                  isoPoint(viewLogicalWidth * 0.38, viewLogicalHeight * 0.68, 0.8, viewLogicalWidth, viewLogicalHeight),
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
                const highlighted = Boolean(locationId && (highlightedLocalIds.has(locationId) || focusedLocationId === locationId));
                const expiry = expiryVisual.byLocation.get(locationId) || 'normal';
                const highlightedSubpositions = subpositions.filter((candidate) =>
                  highlightedSubpositionIds.has(candidate.id)
                );

                const interactive = Boolean(onInspectLocation && inspectionAvailable && location?.kind === 'LOCAL');
                const hovered = hoveredObject?.objectId === object.id;
                const handleOpen = () => {
                  if (!interactive || !locationId) return;
                  setHoveredObject(null);
                  setDetailLocationId(locationId);
                };
                const handlePointer = (event: ReactPointerEvent<SVGGElement>) => {
                  if (!interactive || !locationId || event.pointerType === 'touch') return;
                  setHoveredObject((current) =>
                    current?.objectId === object.id ? current : { objectId: object.id, locationId }
                  );
                  setInspectedLocationId(locationId);
                };

                return (
                  <g
                    key={object.id}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={interactive ? 'Consultar ' + location?.name + ': pressione Enter para detalhes' : undefined}
                    data-testid={interactive ? 'warehouse-location-interactive' : undefined}
                    data-hovered={hovered ? 'true' : 'false'}
                    className={interactive
                      ? 'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
                      : undefined}
                    // O foco automatico do SVG no clique desenhava um retangulo preto
                    // entre o pointer-down e a abertura do dialog. Prevenir somente o
                    // foco por mouse; Tab/Enter/Espaco continuam acessiveis.
                    onMouseDown={(event) => {
                      if (interactive && event.button === 0) event.preventDefault();
                    }}
                    onPointerEnter={(event) => {
                      if (!interactive) return;
                      handlePointer(event);
                    }}
                    onPointerLeave={() => setHoveredObject((current) =>
                      current?.objectId === object.id ? null : current
                    )}
                    onFocus={() => {
                      if (!interactive) return;
                      setHoveredObject({ objectId: object.id, locationId });
                      setInspectedLocationId(locationId);
                    }}
                    onBlur={() => setHoveredObject(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOpen();
                      }
                    }}
                    onClick={handleOpen}
                    style={{
                      cursor: interactive ? 'pointer' : undefined,
                      transition: 'filter 160ms ease, opacity 160ms ease',
                      filter: hovered ? 'drop-shadow(0 0 9px rgba(37,99,235,0.85))' : undefined,
                    }}
                  >
                    <WarehouseStructure
                    object={object}
                    logicalWidth={viewLogicalWidth}
                    logicalHeight={viewLogicalHeight}
                    location={location}
                    subpositions={subpositions}
                    occupiedQuantity={occupiedQuantity}
                    occupiedSubpositions={occupancyBySubposition}
                    expiry={expiry}
                    expiryBySubposition={expiryVisual.bySubposition}
                    expiryByBaseLocation={expiryVisual.byBaseLocation}
                    highlighted={highlighted}
                    highlightedSubpositions={highlightedSubpositions}
                    dimmed={hasActiveSelection && !highlighted}
                    applianceFront={object.applianceFront}
                    showLabels={!sceneOnly}
                  />
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        {inspectionLotState === 'ready' && !inspectionComplete && onInspectLocation && (
          <p className="absolute bottom-3 right-3 max-w-[240px] rounded-lg bg-amber-50/95 p-2 text-[10px] font-medium text-amber-900 shadow-sm">
            Consulta parcial: alguns lotes e suas validades podem não estar visíveis.
          </p>
        )}
      </div>
      {onInspectLocation && (
        <div data-testid="warehouse-location-inspection-dock"
          className="h-[212px] overflow-y-auto border-t border-blue-100 bg-slate-50/95 px-3 py-3 sm:px-4">
          {hoveredContents && !detailLocationId && !viewTransitioning ? (
            <WarehouseLocationContentsTooltip
              contents={hoveredContents}
              lotState={inspectionLotState}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-500">
              Passe o cursor ou use Tab sobre um local para consultar a organização dos materiais aqui, sem encobrir o croqui. Clique no local para detalhes e PDF.
            </p>
          )}
        </div>
      )}
      {detailContents && onRefreshInspection && (
        <WarehouseLocationDetailsDialog
          contents={detailContents}
          depotName={depotName}
          workspaceId={workspaceId}
          materials={materials}
          onMaterialUpdated={onMaterialUpdated}
          lotState={inspectionLotState}
          lotError={inspectionError}
          complete={inspectionComplete}
          onRefresh={onRefreshInspection}
          onClose={() => setDetailLocationId(null)}
        />
      )}
    </section>
  );
}
