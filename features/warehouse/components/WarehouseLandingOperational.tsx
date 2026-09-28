'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WarehouseDepotLayout, WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import {
  listWarehouseDepotLayouts,
  type WarehouseDepotLayoutListItem,
} from '../../../lib/warehouse/layoutRepository';
import type {
  WarehouseDepot,
  WarehouseLocation,
  WarehouseLocationBalance,
} from '../../../lib/warehouse/location';
import {
  listWarehouseDepots,
  listWarehouseLocations,
  listWarehousePositiveLocationBalances,
  type WarehouseDepotListItem,
  type WarehouseLocationBalanceListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  loadWarehouseInvoiceIntakeQueue,
  type WarehouseInvoiceIntakeQueueRow,
} from '../../../lib/warehouse/intakeStateRepository';
import { WAREHOUSE_BOX_VISUAL } from '../visualStyle';
import styles from './WarehouseLandingOperational.module.css';

interface LandingData {
  loading: boolean;
  error: string | null;
  depots: WarehouseDepotListItem[];
  layouts: WarehouseDepotLayoutListItem[];
  locations: WarehouseLocationListItem[];
  locationBalances: WarehouseLocationBalanceListItem[];
  pendingRows: WarehouseInvoiceIntakeQueueRow[];
  pendingAvailable: boolean;
}

interface PendingInvoiceGroup {
  key: string;
  invoiceId: string;
  supplier: string;
  itemCount: number;
  itemNames: string[];
}

interface DepotPlacement {
  depot: WarehouseDepot;
  layout: WarehouseDepotLayout | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

type IsoPoint = { x: number; y: number };

const INITIAL_DATA: LandingData = {
  loading: true,
  error: null,
  depots: [],
  layouts: [],
  locations: [],
  locationBalances: [],
  pendingRows: [],
  pendingAvailable: true,
};

const SVG_WIDTH = 1600;
const SVG_HEIGHT = 900;
const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 620;
const ISO_ORIGIN_X = 790;
const ISO_ORIGIN_Y = 94;
const ISO_HALF_WIDTH = 720;
const ISO_HALF_HEIGHT = 320;
const DEPOT_WORLD_WIDTH = 690;
const PALLET_YARD_X = 750;
const PALLET_YARD_Y = 92;
const PALLET_YARD_WIDTH = 205;
const PALLET_YARD_HEIGHT = 435;
const MAX_VISIBLE_PENDING_NFS = 8;
const MIN_PALLET_SLOTS = 5;

function isoPoint(x: number, y: number, z = 0): IsoPoint {
  const nx = x / WORLD_WIDTH;
  const ny = y / WORLD_HEIGHT;
  return {
    x: ISO_ORIGIN_X + (nx - ny) * ISO_HALF_WIDTH,
    y: ISO_ORIGIN_Y + (nx + ny) * ISO_HALF_HEIGHT - z,
  };
}

function polygonPoints(points: IsoPoint[]): string {
  return points.map((point) => point.x.toFixed(1) + ',' + point.y.toFixed(1)).join(' ');
}

function visualBoxes(quantity: number): number {
  if (quantity <= 0) return 0;
  if (quantity < 5) return 1;
  if (quantity < 20) return 2;
  if (quantity < 60) return 3;
  return 4;
}

function warehouseBox(
  key: string,
  x: number,
  y: number,
  z: number,
  width = 14,
  depth = 11,
  height = 14,
  visualRole = 'allocated-stock-box'
) {
  const a = isoPoint(x, y, z);
  const b = isoPoint(x + width, y, z);
  const c = isoPoint(x + width, y + depth, z);
  const d = isoPoint(x, y + depth, z);
  const at = isoPoint(x, y, z + height);
  const bt = isoPoint(x + width, y, z + height);
  const ct = isoPoint(x + width, y + depth, z + height);
  const dt = isoPoint(x, y + depth, z + height);

  return (
    <g
      key={key}
      filter="url(#worldObjectShadow)"
      data-visual-role={visualRole}
      aria-hidden="true"
    >
      <polygon
        points={polygonPoints([d, c, ct, dt])}
        fill={WAREHOUSE_BOX_VISUAL.frontFill}
        stroke={WAREHOUSE_BOX_VISUAL.frontStroke}
        strokeWidth="0.65"
      />
      <polygon
        points={polygonPoints([b, c, ct, bt])}
        fill={WAREHOUSE_BOX_VISUAL.sideFill}
        stroke={WAREHOUSE_BOX_VISUAL.sideStroke}
        strokeWidth="0.65"
      />
      <polygon
        points={polygonPoints([at, bt, ct, dt])}
        fill={WAREHOUSE_BOX_VISUAL.topFill}
        stroke={WAREHOUSE_BOX_VISUAL.topStroke}
        strokeWidth="0.7"
      />
    </g>
  );
}

function objectHeight(kind: WarehouseDepotLayoutObject['kind'], scale: number, subpositions = 0): number {
  const base = kind === 'SHELF' || kind === 'RACK'
    ? 112 + Math.min(7, subpositions) * 4
    : kind === 'REFRIGERATOR'
      ? 124
      : kind === 'FREEZER' || kind === 'CHAMBER'
        ? 72
        : kind === 'PALLET'
          ? 15
          : kind === 'BENCH' || kind === 'CABINET'
            ? 58
            : kind === 'WALL'
              ? 78
              : 34;
  return Math.max(8, base * Math.min(1.02, Math.max(0.48, scale)));
}

function buildPendingGroups(rows: WarehouseInvoiceIntakeQueueRow[]): PendingInvoiceGroup[] {
  const actionable = rows.filter(
    (row) =>
      (row.status === 'PENDING' || row.status === 'PARTIALLY_PROCESSED')
      && row.pendingQuantity > 0.000001
  );
  const grouped = new Map<string, PendingInvoiceGroup>();

  for (const row of actionable) {
    const key = row.invoiceRecordKey || row.invoiceId || row.key;
    const current = grouped.get(key);
    if (current) {
      current.itemCount += 1;
      current.itemNames.push(row.itemName);
      continue;
    }
    grouped.set(key, {
      key,
      invoiceId: row.invoiceId || 'NF sem número',
      supplier: row.supplier || 'Fornecedor não informado',
      itemCount: 1,
      itemNames: [row.itemName],
    });
  }

  return Array.from(grouped.values()).sort(
    (left, right) =>
      right.itemCount - left.itemCount
      || left.invoiceId.localeCompare(right.invoiceId, 'pt-BR', { numeric: true })
  );
}

function derivePlacements(
  depots: WarehouseDepot[],
  layoutByDepot: Map<string, WarehouseDepotLayout>
): DepotPlacement[] {
  if (!depots.length) return [];

  const columns = depots.length <= 2
    ? depots.length
    : depots.length <= 4
      ? 2
      : 3;
  const rows = Math.max(1, Math.ceil(depots.length / columns));
  const gapX = columns === 1 ? 0 : 26;
  const gapY = rows === 1 ? 0 : 30;
  const availableWidth = DEPOT_WORLD_WIDTH - 76;
  const availableHeight = 470;
  const cellWidth = (availableWidth - gapX * Math.max(0, columns - 1)) / columns;
  const cellHeight = (availableHeight - gapY * Math.max(0, rows - 1)) / rows;

  return depots.map((depot, index) => {
    const layout = layoutByDepot.get(depot.id) || null;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const logicalWidth = layout?.logicalWidth || 100;
    const logicalHeight = layout?.logicalHeight || 70;
    const targetWidth = cellWidth * 0.84;
    const targetHeight = cellHeight * 0.68;
    const scale = Math.min(targetWidth / logicalWidth, targetHeight / logicalHeight);
    const width = logicalWidth * scale;
    const height = logicalHeight * scale;
    const x = 48 + col * (cellWidth + gapX) + (cellWidth - width) / 2;
    const y = 76 + row * (cellHeight + gapY) + (cellHeight - height) / 2;

    return { depot, layout, x, y, width, height, scale };
  });
}

function renderDepotObject(
  object: WarehouseDepotLayoutObject,
  placement: DepotPlacement,
  subpositionsByParent: Map<string, WarehouseLocation[]>,
  occupancyByLocal: Map<string, number>,
  occupancyBySubposition: Map<string, number>
) {
  const localScale = placement.scale;
  const x = placement.x + object.x * localScale;
  const y = placement.y + object.y * localScale;
  const width = Math.max(2.6, object.width * localScale);
  const height = Math.max(2.6, object.height * localScale);
  const subpositions = object.warehouseLocationId
    ? subpositionsByParent.get(object.warehouseLocationId) || []
    : [];
  const z = objectHeight(object.kind, localScale, subpositions.length);
  const linkedPositionId = object.warehouseLocationId || '';
  const occupiedQuantity = linkedPositionId
    ? (occupancyByLocal.get(linkedPositionId) || occupancyBySubposition.get(linkedPositionId) || 0)
    : 0;
  const generalBoxCount = visualBoxes(occupiedQuantity);
  const a = isoPoint(x, y, 0);
  const b = isoPoint(x + width, y, 0);
  const c = isoPoint(x + width, y + height, 0);
  const d = isoPoint(x, y + height, 0);
  const at = isoPoint(x, y, z);
  const bt = isoPoint(x + width, y, z);
  const ct = isoPoint(x + width, y + height, z);
  const dt = isoPoint(x, y + height, z);

  if (object.kind === 'CORRIDOR' || object.kind === 'AREA' || object.kind === 'ZONE') {
    const zoneFill = object.kind === 'CORRIDOR' ? '#eef5fa' : '#e6f0f8';
    return (
      <g key={object.id} opacity="0.76">
        <polygon
          points={polygonPoints([a, b, c, d])}
          fill={zoneFill}
          fillOpacity={object.kind === 'CORRIDOR' ? '0.32' : '0.22'}
          stroke="#b8c9d9"
          strokeOpacity="0.72"
          strokeWidth="0.7"
          strokeDasharray={object.kind === 'CORRIDOR' ? '4 4' : undefined}
        />
      </g>
    );
  }

  if (object.kind === 'WALL') {
    return (
      <g key={object.id} opacity="0.9">
        <polygon points={polygonPoints([d, c, ct, dt])} fill="#e7eef3" stroke="#9bb0c1" strokeWidth="0.9" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="#c9d6df" stroke="#91a7b8" strokeWidth="0.8" />
        <line x1={dt.x} y1={dt.y} x2={ct.x} y2={ct.y} stroke="#ffffff" strokeWidth="1.2" opacity="0.9" />
      </g>
    );
  }

  if (object.kind === 'PALLET') {
    return (
      <g key={object.id} filter="url(#worldObjectShadow)">
        <polygon points={polygonPoints([d, c, ct, dt])} fill="#c4813c" stroke="#895426" strokeWidth="0.8" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="#ac6930" stroke="#75431e" strokeWidth="0.8" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#dfaa68" stroke="#93602e" strokeWidth="0.9" />
        {Array.from({ length: 6 }, (_, index) => {
          const ratio = (index + 0.5) / 6;
          const p1 = isoPoint(x + width * ratio, y, z + 0.5);
          const p2 = isoPoint(x + width * ratio, y + height, z + 0.5);
          return <line key={index} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#a06932" strokeWidth="0.7" />;
        })}
        {generalBoxCount > 0 && Array.from({ length: generalBoxCount }, (_, index) =>
          warehouseBox(
            'allocated-pallet-' + object.id + '-' + index,
            x + width * (0.22 + (index % 2) * 0.34),
            y + height * (0.25 + Math.floor(index / 2) * 0.11),
            z + 3 + Math.floor(index / 2) * 10,
            11,
            9,
            11
          )
        )}
      </g>
    );
  }

  if (object.kind === 'SHELF' || object.kind === 'RACK') {
    const levels = Math.max(2, Math.min(6, subpositions.length || 4));
    const frontBottomLeft = d;
    const frontBottomRight = c;
    const frontTopLeft = dt;
    const frontTopRight = ct;
    const backBottomLeft = a;
    const backBottomRight = b;
    const backTopLeft = at;
    const backTopRight = bt;

    return (
      <g key={object.id} filter="url(#worldObjectShadow)">
        {[backBottomLeft, backBottomRight].map((base, index) => {
          const top = [backTopLeft, backTopRight][index];
          return (
            <line
              key={'back-post-' + index}
              x1={base.x}
              y1={base.y}
              x2={top.x}
              y2={top.y}
              stroke="#123f66"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          );
        })}

        {Array.from({ length: levels }, (_, index) => {
          const ratio = (index + 1) / (levels + 0.34);
          const shelfZ = z * ratio;
          const p1 = isoPoint(x, y, shelfZ);
          const p2 = isoPoint(x + width, y, shelfZ);
          const p3 = isoPoint(x + width, y + height, shelfZ);
          const p4 = isoPoint(x, y + height, shelfZ);
          const frontLeft = isoPoint(x, y + height, shelfZ - 1.4);
          const frontRight = isoPoint(x + width, y + height, shelfZ - 1.4);
          const linkedSubposition = subpositions[index] || null;
          const levelQuantity = linkedSubposition
            ? occupancyBySubposition.get(linkedSubposition.id) || 0
            : 0;
          const levelBoxCount = visualBoxes(levelQuantity);
          return (
            <g key={'level-' + index}>
              <polygon
                points={polygonPoints([p1, p2, p3, p4])}
                fill="#edf2f5"
                stroke="#aab9c5"
                strokeWidth="0.55"
                opacity="0.98"
              />
              <line
                x1={frontLeft.x}
                y1={frontLeft.y}
                x2={frontRight.x}
                y2={frontRight.y}
                stroke="#f47f13"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {levelBoxCount > 0 && Array.from({ length: levelBoxCount }, (_, boxIndex) =>
                warehouseBox(
                  'allocated-shelf-' + object.id + '-' + index + '-' + boxIndex,
                  x + width * (0.22 + (boxIndex % 2) * 0.36),
                  y + height * 0.38,
                  shelfZ + 1 + Math.floor(boxIndex / 2) * 8,
                  9,
                  7,
                  9
                )
              )}
            </g>
          );
        })}

        {subpositions.length === 0 && generalBoxCount > 0 && Array.from({ length: generalBoxCount }, (_, index) => {
          const level = index % levels;
          const shelfZ = z * ((level + 1) / (levels + 0.34));
          return warehouseBox(
            'allocated-shelf-general-' + object.id + '-' + index,
            x + width * (0.24 + (index % 2) * 0.34),
            y + height * 0.38,
            shelfZ + 1,
            9,
            7,
            9
          );
        })}

        {[frontBottomLeft, frontBottomRight].map((base, index) => {
          const top = [frontTopLeft, frontTopRight][index];
          return (
            <g key={'front-post-' + index}>
              <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke="#0e3556" strokeWidth="4.2" strokeLinecap="round" />
              <line x1={base.x + 1.1} y1={base.y} x2={top.x + 1.1} y2={top.y} stroke="#7196b0" strokeWidth="0.8" opacity="0.75" />
            </g>
          );
        })}

      </g>
    );
  }

  if (object.kind === 'REFRIGERATOR') {
    const splitBottom = isoPoint(x + width / 2, y + height, 3);
    const splitTop = isoPoint(x + width / 2, y + height, z - 3);
    return (
      <g key={object.id} filter="url(#worldObjectShadow)">
        <polygon points={polygonPoints([d, c, ct, dt])} fill="#cbd4d8" stroke="#657985" strokeWidth="1" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="#9eafb8" stroke="#5b707c" strokeWidth="0.9" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#edf2f4" stroke="#82939d" strokeWidth="0.9" />
        <line x1={splitBottom.x} y1={splitBottom.y} x2={splitTop.x} y2={splitTop.y} stroke="#71838c" strokeWidth="1.3" />
        <line x1={dt.x + 3} y1={dt.y + 5} x2={d.x + 3} y2={d.y - 4} stroke="#ffffff" strokeWidth="1.4" opacity="0.55" />
        {generalBoxCount > 0 && Array.from({ length: Math.min(3, generalBoxCount) }, (_, index) =>
          warehouseBox(
            'allocated-fridge-' + object.id + '-' + index,
            x + width * (0.26 + index * 0.18),
            y + height * 0.74,
            z * (0.24 + (index % 2) * 0.18),
            8,
            6,
            8
          )
        )}
      </g>
    );
  }

  if (object.kind === 'FREEZER' || object.kind === 'CHAMBER') {
    return (
      <g key={object.id} filter="url(#worldObjectShadow)">
        <polygon points={polygonPoints([d, c, ct, dt])} fill="#b8cad5" stroke="#6c8798" strokeWidth="0.9" />
        <polygon points={polygonPoints([b, c, ct, bt])} fill="#91adbd" stroke="#648193" strokeWidth="0.9" />
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#f4f8fa" stroke="#809cac" strokeWidth="0.9" />
        <polygon
          points={polygonPoints([
            isoPoint(x + width * 0.09, y + height * 0.1, z + 1),
            isoPoint(x + width * 0.91, y + height * 0.1, z + 1),
            isoPoint(x + width * 0.91, y + height * 0.9, z + 1),
            isoPoint(x + width * 0.09, y + height * 0.9, z + 1),
          ])}
          fill="#d9f2fb"
          fillOpacity="0.64"
          stroke="#73a9bf"
          strokeWidth="0.7"
        />
        {generalBoxCount > 0 && Array.from({ length: Math.min(2, generalBoxCount) }, (_, index) =>
          warehouseBox(
            'allocated-freezer-' + object.id + '-' + index,
            x + width * (index ? 0.56 : 0.28),
            y + height * 0.42,
            z + 2,
            8,
            6,
            8
          )
        )}
      </g>
    );
  }

  if (object.kind === 'BENCH' || object.kind === 'CABINET') {
    const legPoints = [
      [x + width * 0.1, y + height * 0.12],
      [x + width * 0.9, y + height * 0.12],
      [x + width * 0.1, y + height * 0.88],
      [x + width * 0.9, y + height * 0.88],
    ];
    return (
      <g key={object.id} filter="url(#worldObjectShadow)">
        {legPoints.map(([lx, ly], index) => {
          const bottom = isoPoint(lx, ly, 2);
          const top = isoPoint(lx, ly, z - 2);
          return <line key={index} x1={bottom.x} y1={bottom.y} x2={top.x} y2={top.y} stroke="#536a78" strokeWidth="2.8" />;
        })}
        <polygon points={polygonPoints([at, bt, ct, dt])} fill="#e8eef1" stroke="#657b88" strokeWidth="1" />
        <polygon
          points={polygonPoints([
            isoPoint(x, y + height, z - 7),
            isoPoint(x + width, y + height, z - 7),
            ct,
            dt,
          ])}
          fill="#aebdc5"
          stroke="#667d8b"
          strokeWidth="0.85"
        />
        {generalBoxCount > 0 && warehouseBox(
          'allocated-bench-' + object.id,
          x + width * 0.42,
          y + height * 0.38,
          z + 1,
          10,
          8,
          10
        )}
      </g>
    );
  }

  return (
    <g key={object.id} filter="url(#worldObjectShadow)">
      <polygon points={polygonPoints([d, c, ct, dt])} fill="#dce6ec" stroke="#7e94a4" strokeWidth="0.9" />
      <polygon points={polygonPoints([b, c, ct, bt])} fill="#b7c7d1" stroke="#718899" strokeWidth="0.85" />
      <polygon points={polygonPoints([at, bt, ct, dt])} fill="#f4f7f9" stroke="#8fa3b1" strokeWidth="0.9" />
      {generalBoxCount > 0 && Array.from({ length: Math.min(2, generalBoxCount) }, (_, index) =>
        warehouseBox(
          'allocated-generic-' + object.id + '-' + index,
          x + width * (index ? 0.56 : 0.28),
          y + height * 0.4,
          z + 1,
          9,
          7,
          9
        )
      )}
    </g>
  );
}

function DepotWorld({
  placement,
  subpositionsByParent,
  occupancyByLocal,
  occupancyBySubposition,
  onOpen,
}: {
  placement: DepotPlacement;
  subpositionsByParent: Map<string, WarehouseLocation[]>;
  occupancyByLocal: Map<string, number>;
  occupancyBySubposition: Map<string, number>;
  onOpen: (depotId: string) => void;
}) {
  const { depot, layout } = placement;
  const floorA = isoPoint(placement.x - 9, placement.y - 9, 0);
  const floorB = isoPoint(placement.x + placement.width + 9, placement.y - 9, 0);
  const floorC = isoPoint(placement.x + placement.width + 9, placement.y + placement.height + 9, 0);
  const floorD = isoPoint(placement.x - 9, placement.y + placement.height + 9, 0);
  const open = () => onOpen(depot.id);

  return (
    <g
      className={styles.depotGroup}
      role="button"
      tabIndex={0}
      aria-label={'Abrir ' + depot.name + ' em Meus Depósitos'}
      data-testid={'warehouse-landing-depot-' + depot.id}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      <polygon
        className={styles.depotAura}
        points={polygonPoints([floorA, floorB, floorC, floorD])}
        fill="#f5f8fa"
        fillOpacity="0.96"
        stroke="#b8cad8"
        strokeOpacity="0.92"
        strokeWidth="1.15"
        filter="url(#depotFloorShadow)"
      />

      <g className={styles.depotFloorGrid} pointerEvents="none">
        {Array.from({ length: 5 }, (_, index) => {
          const ratio = (index + 1) / 6;
          const gx1 = isoPoint(
            placement.x - 7 + (placement.width + 14) * ratio,
            placement.y - 7,
            0.8
          );
          const gx2 = isoPoint(
            placement.x - 7 + (placement.width + 14) * ratio,
            placement.y + placement.height + 7,
            0.8
          );
          const gy1 = isoPoint(
            placement.x - 7,
            placement.y - 7 + (placement.height + 14) * ratio,
            0.8
          );
          const gy2 = isoPoint(
            placement.x + placement.width + 7,
            placement.y - 7 + (placement.height + 14) * ratio,
            0.8
          );
          return (
            <g key={index}>
              <line x1={gx1.x} y1={gx1.y} x2={gx2.x} y2={gx2.y} stroke="#c8d5de" strokeWidth="0.45" opacity="0.58" />
              <line x1={gy1.x} y1={gy1.y} x2={gy2.x} y2={gy2.y} stroke="#c8d5de" strokeWidth="0.45" opacity="0.58" />
            </g>
          );
        })}
      </g>

      {layout
        ? layout.objects
            .slice()
            .sort((left, right) => {
              const leftDepth = (left.x + left.y) * placement.scale + left.layer * 0.001;
              const rightDepth = (right.x + right.y) * placement.scale + right.layer * 0.001;
              return leftDepth - rightDepth;
            })
            .map((object) => renderDepotObject(
              object,
              placement,
              subpositionsByParent,
              occupancyByLocal,
              occupancyBySubposition
            ))
        : (
          <g opacity="0.58">
            <polygon
              points={polygonPoints([floorA, floorB, floorC, floorD])}
              fill="#0a1530"
              stroke="#6583bd"
              strokeOpacity="0.32"
              strokeDasharray="6 7"
            />
          </g>
        )}

    </g>
  );
}

function DepotWorldLabel({ placement }: { placement: DepotPlacement }) {
  const { depot, layout } = placement;
  const labelPoint = isoPoint(
    placement.x + placement.width * 0.5,
    placement.y + placement.height + 17,
    0
  );

  return (
    <g
      className={styles.depotLabel}
      transform={'translate(' + labelPoint.x + ' ' + (labelPoint.y + 17) + ')'}
    >
      <rect
        x="-68"
        y="-13"
        width="136"
        height={layout ? 34 : 46}
        rx="8"
        className={styles.textBackdrop}
      />
      <text textAnchor="middle" className={styles.depotCode}>{depot.code}</text>
      <text y="15" textAnchor="middle" className={styles.depotName}>{depot.name}</text>
      {!layout && (
        <text y="28" textAnchor="middle" className={styles.depotStatus}>sem croqui ativo</text>
      )}
    </g>
  );
}

function PalletWorld({
  x,
  y,
  group,
}: {
  x: number;
  y: number;
  group: PendingInvoiceGroup | null;
}) {
  const palletWidth = 48;
  const palletDepth = 34;
  const palletHeight = 7;
  const a = isoPoint(x, y, 0);
  const b = isoPoint(x + palletWidth, y, 0);
  const c = isoPoint(x + palletWidth, y + palletDepth, 0);
  const d = isoPoint(x, y + palletDepth, 0);
  const at = isoPoint(x, y, palletHeight);
  const bt = isoPoint(x + palletWidth, y, palletHeight);
  const ct = isoPoint(x + palletWidth, y + palletDepth, palletHeight);
  const dt = isoPoint(x, y + palletDepth, palletHeight);
  const boxCount = group ? Math.min(group.itemCount, 12) : 0;

  return (
    <g
      className={group ? styles.pendingPallet : styles.emptyPallet}
      data-pending={group ? 'true' : 'false'}
    >
      <ellipse
        cx={(d.x + c.x) / 2}
        cy={(d.y + c.y) / 2 + 10}
        rx="37"
        ry="10"
        fill="#000817"
        opacity="0.23"
        filter="url(#worldSoftBlur)"
      />

      <polygon points={polygonPoints([d, c, ct, dt])} fill="#704724" stroke="#a6733e" strokeWidth="0.85" />
      <polygon points={polygonPoints([b, c, ct, bt])} fill="#59361c" stroke="#986335" strokeWidth="0.85" />
      <polygon points={polygonPoints([at, bt, ct, dt])} fill="#a97239" stroke="#d5a36b" strokeWidth="1" />

      {[0.18, 0.38, 0.58, 0.78].map((ratio) => {
        const p1 = isoPoint(x + palletWidth * ratio, y, palletHeight + 0.7);
        const p2 = isoPoint(x + palletWidth * ratio, y + palletDepth, palletHeight + 0.7);
        return (
          <line
            key={ratio}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#6f431f"
            strokeWidth="1.3"
            opacity="0.9"
          />
        );
      })}

      {Array.from({ length: boxCount }, (_, boxIndex) => {
        const col = boxIndex % 3;
        const row = Math.floor(boxIndex / 3);
        const layer = Math.floor(row / 2);
        const localRow = row % 2;
        const bx = x + 8 + col * 15 + localRow * 3;
        const by = y + 8 + localRow * 13;
        const bz = palletHeight + 16 + layer * 18;
        return warehouseBox(
          'receiving-' + (group?.key || 'empty') + '-' + boxIndex,
          bx,
          by,
          bz,
          14,
          11,
          14,
          'receiving-stock-box'
        );
      })}

    </g>
  );
}

function PalletWorldLabel({
  x,
  y,
  group,
  index,
}: {
  x: number;
  y: number;
  group: PendingInvoiceGroup | null;
  index: number;
}) {
  const labelPoint = isoPoint(x + 24, y + 42, 0);
  const text = group ? group.invoiceId : 'P' + String(index + 1).padStart(2, '0');

  return (
    <g transform={'translate(' + labelPoint.x + ' ' + (labelPoint.y + 11) + ')'}>
      <rect
        x="-34"
        y="-10"
        width="68"
        height={group ? 25 : 15}
        rx="6"
        className={styles.textBackdropSoft}
      />
      <text textAnchor="middle" className={styles.palletLabel}>{text}</text>
      {group && (
        <text y="11" textAnchor="middle" className={styles.palletDetail}>
          {group.itemCount} item(ns)
        </text>
      )}
    </g>
  );
}

export function WarehouseLandingOperational({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [data, setData] = useState<LandingData>(INITIAL_DATA);

  const load = useCallback(async () => {
    setData((current) => ({ ...current, loading: true, error: null }));
    try {
      const [depots, layouts, locations, locationBalances, queue] = await Promise.all([
        listWarehouseDepots(workspaceId, 250),
        listWarehouseDepotLayouts(workspaceId, 150),
        listWarehouseLocations(workspaceId, 500),
        listWarehousePositiveLocationBalances(workspaceId, 500),
        loadWarehouseInvoiceIntakeQueue(workspaceId).catch(() => null),
      ]);

      setData({
        loading: false,
        error: null,
        depots,
        layouts,
        locations,
        locationBalances,
        pendingRows: queue?.rows || [],
        pendingAvailable: Boolean(queue),
      });
    } catch (error) {
      setData((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error
          ? error.message
          : 'Não foi possível montar o ambiente visual dos depósitos.',
      }));
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDepots = useMemo(
    () => data.depots
      .map((item) => item.depot)
      .filter((depot) => depot.status === 'active')
      .sort((left, right) =>
        (left.code + left.name).localeCompare(right.code + right.name, 'pt-BR', { numeric: true })
      ),
    [data.depots]
  );

  const activeLayoutByDepot = useMemo(() => {
    const map = new Map<string, WarehouseDepotLayout>();
    for (const item of data.layouts) {
      const depotId = item.layout.depotId;
      if (!depotId || item.layout.status !== 'active' || map.has(depotId)) continue;
      map.set(depotId, item.layout);
    }
    return map;
  }, [data.layouts]);

  const placements = useMemo(
    () => derivePlacements(activeDepots, activeLayoutByDepot),
    [activeDepots, activeLayoutByDepot]
  );

  const activeLocations = useMemo(
    () => data.locations
      .map((item) => item.location)
      .filter((location) => location.status === 'active'),
    [data.locations]
  );

  const subpositionsByParent = useMemo(() => {
    const map = new Map<string, WarehouseLocation[]>();
    for (const location of activeLocations) {
      if (location.kind !== 'SUBPOSITION' || !location.parentLocationId) continue;
      const current = map.get(location.parentLocationId) || [];
      current.push(location);
      map.set(location.parentLocationId, current);
    }
    for (const current of map.values()) {
      current.sort((left, right) =>
        left.code.localeCompare(right.code, 'pt-BR', { numeric: true })
      );
    }
    return map;
  }, [activeLocations]);

  const positiveLocationBalances = useMemo(
    () => data.locationBalances
      .map((item) => item.balance)
      .filter((balance): balance is WarehouseLocationBalance =>
        balance.quantity > 0 && balance.position.kind !== 'UNASSIGNED'
      ),
    [data.locationBalances]
  );

  const occupancyByLocal = useMemo(() => {
    const map = new Map<string, number>();
    for (const balance of positiveLocationBalances) {
      if (balance.position.kind === 'UNASSIGNED') continue;
      map.set(
        balance.position.locationId,
        (map.get(balance.position.locationId) || 0) + balance.quantity
      );
    }
    return map;
  }, [positiveLocationBalances]);

  const occupancyBySubposition = useMemo(() => {
    const map = new Map<string, number>();
    for (const balance of positiveLocationBalances) {
      if (balance.position.kind !== 'SUBPOSITION') continue;
      map.set(
        balance.position.subpositionId,
        (map.get(balance.position.subpositionId) || 0) + balance.quantity
      );
    }
    return map;
  }, [positiveLocationBalances]);

  const pendingGroups = useMemo(
    () => buildPendingGroups(data.pendingRows),
    [data.pendingRows]
  );

  const pendingItems = useMemo(
    () => pendingGroups.reduce((sum, group) => sum + group.itemCount, 0),
    [pendingGroups]
  );

  const visiblePendingGroups = pendingGroups.slice(0, MAX_VISIBLE_PENDING_NFS);
  const palletSlotCount = Math.max(
    MIN_PALLET_SLOTS,
    Math.min(MAX_VISIBLE_PENDING_NFS, visiblePendingGroups.length)
  );
  const palletGroups = Array.from(
    { length: palletSlotCount },
    (_, index) => visiblePendingGroups[index] || null
  );

  const worldFloor = [
    isoPoint(0, 0, 0),
    isoPoint(WORLD_WIDTH, 0, 0),
    isoPoint(WORLD_WIDTH, WORLD_HEIGHT, 0),
    isoPoint(0, WORLD_HEIGHT, 0),
  ];

  const yardFloor = [
    isoPoint(PALLET_YARD_X - 15, PALLET_YARD_Y - 22, 1),
    isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH + 15, PALLET_YARD_Y - 22, 1),
    isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH + 15, PALLET_YARD_Y + PALLET_YARD_HEIGHT + 18, 1),
    isoPoint(PALLET_YARD_X - 15, PALLET_YARD_Y + PALLET_YARD_HEIGHT + 18, 1),
  ];

  const openDepot = (depotId: string) => {
    router.push('/adm-deposito/meus-depositos?deposito=' + encodeURIComponent(depotId));
  };

  if (data.loading && !data.depots.length) {
    return (
      <section className={styles.scene} data-testid="warehouse-landing-operational">
        <div className={styles.loading}>
          <span className={styles.loadingMark} />
          <strong>Montando ambiente logístico</strong>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.scene}
      data-testid="warehouse-landing-operational"
      aria-label="Início ADM Depósito"
    >
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.texture} aria-hidden="true" />

      <div className={styles.sceneTitle}>
        <span>EMPROVEX · ADM DEPÓSITO</span>
        <strong>Ambiente logístico</strong>
        <small>
          {activeDepots.length} depósito(s)
          {' · '}
          {data.pendingAvailable ? pendingGroups.length + ' NF(s) aguardando alocação' : 'pendências indisponíveis'}
        </small>
      </div>

      {data.error && <div className={styles.error}>{data.error}</div>}

      <svg
        viewBox={'0 0 ' + SVG_WIDTH + ' ' + SVG_HEIGHT}
        className={styles.world}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Mundo digital 3D dos depósitos e área de recebimento"
      >
        <defs>
          <linearGradient id="worldFloor" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#0b1932" />
            <stop offset="50%" stopColor="#071225" />
            <stop offset="100%" stopColor="#040a16" />
          </linearGradient>
          <linearGradient id="yardFloor" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#10213f" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#071225" stopOpacity="0.42" />
          </linearGradient>
          <radialGradient id="worldHalo">
            <stop offset="0%" stopColor="#4a79e8" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#4a79e8" stopOpacity="0" />
          </radialGradient>
          <filter id="worldObjectShadow" x="-40%" y="-40%" width="180%" height="210%">
            <feDropShadow dx="0" dy="8" stdDeviation="5.5" floodColor="#000713" floodOpacity="0.36" />
          </filter>
          <filter id="depotFloorShadow" x="-30%" y="-35%" width="160%" height="185%">
            <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#000713" floodOpacity="0.28" />
          </filter>
          <filter id="worldSoftBlur" x="-60%" y="-120%" width="220%" height="340%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        <ellipse cx="820" cy="480" rx="690" ry="330" fill="url(#worldHalo)" />

        <polygon
          points={polygonPoints(worldFloor)}
          fill="url(#worldFloor)"
          stroke="#5674b1"
          strokeOpacity="0.32"
          strokeWidth="1.35"
          data-visual-role="world-floor"
        />

        <g data-visual-role="world-grid">
          {Array.from({ length: 18 }, (_, index) => {
            const ratio = index / 17;
            const x = WORLD_WIDTH * ratio;
            const a = isoPoint(x, 0, 0.6);
            const b = isoPoint(x, WORLD_HEIGHT, 0.6);
            return (
              <line
                key={'grid-x-' + index}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#6485cf"
                strokeOpacity={index % 3 === 0 ? '0.13' : '0.065'}
                strokeWidth={index % 3 === 0 ? '0.85' : '0.55'}
              />
            );
          })}
          {Array.from({ length: 14 }, (_, index) => {
            const ratio = index / 13;
            const y = WORLD_HEIGHT * ratio;
            const a = isoPoint(0, y, 0.6);
            const b = isoPoint(WORLD_WIDTH, y, 0.6);
            return (
              <line
                key={'grid-y-' + index}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#6485cf"
                strokeOpacity={index % 3 === 0 ? '0.13' : '0.065'}
                strokeWidth={index % 3 === 0 ? '0.85' : '0.55'}
              />
            );
          })}
        </g>

        <g data-visual-role="depots-world">
          {placements.map((placement) => (
            <DepotWorld
              key={placement.depot.id}
              placement={placement}
              subpositionsByParent={subpositionsByParent}
              occupancyByLocal={occupancyByLocal}
              occupancyBySubposition={occupancyBySubposition}
              onOpen={openDepot}
            />
          ))}
        </g>

        <g data-visual-role="receiving-yard">
          <polygon
            points={polygonPoints(yardFloor)}
            fill="url(#yardFloor)"
            stroke="#7793c9"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="7 8"
          />

          {palletGroups.map((group, index) => {
            const columns = 2;
            const col = index % columns;
            const row = Math.floor(index / columns);
            const px = PALLET_YARD_X + 18 + col * 94;
            const py = PALLET_YARD_Y + 40 + row * 92;
            return (
              <PalletWorld
                key={group?.key || 'empty-' + index}
                x={px}
                y={py}
                group={group}
              />
            );
          })}

        </g>

        <g data-visual-role="text-overlay" pointerEvents="none">
          {placements.map((placement) => (
            <DepotWorldLabel key={'label-' + placement.depot.id} placement={placement} />
          ))}

          {palletGroups.map((group, index) => {
            const columns = 2;
            const col = index % columns;
            const row = Math.floor(index / columns);
            const px = PALLET_YARD_X + 18 + col * 94;
            const py = PALLET_YARD_Y + 40 + row * 92;
            return (
              <PalletWorldLabel
                key={'label-' + (group?.key || 'empty-' + index)}
                x={px}
                y={py}
                group={group}
                index={index}
              />
            );
          })}

          <g transform={'translate(' + isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH / 2, PALLET_YARD_Y - 39, 0).x + ' ' + isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH / 2, PALLET_YARD_Y - 39, 0).y + ')'}>
            <rect x="-128" y="-15" width="256" height="35" rx="9" className={styles.yardTextBackdrop} />
            <text textAnchor="middle" className={styles.yardTitle}>RECEBIMENTO · AGUARDANDO ALOCAÇÃO</text>
            <text y="15" textAnchor="middle" className={styles.yardSubtitle}>
              {data.pendingAvailable
                ? pendingItems > 0
                  ? pendingItems + ' item(ns) · ' + pendingGroups.length + ' NF(s)'
                  : 'sem pendências · paletes livres'
                : 'leitura temporariamente indisponível'}
            </text>
          </g>

          {pendingGroups.length > MAX_VISIBLE_PENDING_NFS && (
            <g transform={'translate(' + isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH / 2, PALLET_YARD_Y + PALLET_YARD_HEIGHT - 4, 0).x + ' ' + isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH / 2, PALLET_YARD_Y + PALLET_YARD_HEIGHT - 4, 0).y + ')'}>
              <rect x="-76" y="-9" width="152" height="17" rx="6" className={styles.textBackdropSoft} />
              <text textAnchor="middle" className={styles.morePending}>
                +{pendingGroups.length - MAX_VISIBLE_PENDING_NFS} NF(s) além da área visível
              </text>
            </g>
          )}
        </g>

        {!activeDepots.length && (
          <g transform="translate(770 430)">
            <text textAnchor="middle" className={styles.emptyTitle}>NENHUM DEPÓSITO ATIVO</text>
            <text y="21" textAnchor="middle" className={styles.emptySubtitle}>
              Os croquis aparecerão aqui quando houver depósitos ativos.
            </text>
          </g>
        )}

        <g className={styles.sceneHint} transform="translate(116 822)">
          <text>Clique diretamente em um depósito para entrar em Meus Depósitos</text>
        </g>
      </svg>
    </section>
  );
}
