'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WarehouseDepotLayout, WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import {
  listWarehouseDepotLayouts,
  type WarehouseDepotLayoutListItem,
} from '../../../lib/warehouse/layoutRepository';
import type { WarehouseDepot } from '../../../lib/warehouse/location';
import {
  listWarehouseDepots,
  type WarehouseDepotListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  loadWarehouseInvoiceIntakeQueue,
  type WarehouseInvoiceIntakeQueueRow,
} from '../../../lib/warehouse/intakeStateRepository';
import styles from './WarehouseLandingOperational.module.css';

interface LandingData {
  loading: boolean;
  error: string | null;
  depots: WarehouseDepotListItem[];
  layouts: WarehouseDepotLayoutListItem[];
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

function objectHeight(kind: WarehouseDepotLayoutObject['kind'], scale: number): number {
  const base = kind === 'SHELF'
    ? 90
    : kind === 'REFRIGERATOR'
      ? 92
      : kind === 'FREEZER' || kind === 'CHAMBER'
        ? 54
        : kind === 'PALLET'
          ? 12
          : kind === 'BENCH' || kind === 'CABINET'
            ? 44
            : kind === 'OTHER'
              ? 40
              : 28;
  return Math.max(7, base * Math.min(1.05, Math.max(0.48, scale)));
}

function objectPalette(kind: WarehouseDepotLayoutObject['kind']): {
  top: string;
  front: string;
  side: string;
  stroke: string;
  accent?: string;
} {
  if (kind === 'PALLET') {
    return {
      top: '#b9864d',
      front: '#79502d',
      side: '#5c3a21',
      stroke: '#d7ad79',
    };
  }
  if (kind === 'FREEZER' || kind === 'CHAMBER') {
    return {
      top: '#e3eef4',
      front: '#91aebc',
      side: '#698696',
      stroke: '#dcf4ff',
    };
  }
  if (kind === 'REFRIGERATOR') {
    return {
      top: '#edf2f4',
      front: '#a3b1b8',
      side: '#71828b',
      stroke: '#f8fbfc',
    };
  }
  if (kind === 'BENCH' || kind === 'CABINET') {
    return {
      top: '#dce5e9',
      front: '#889aa3',
      side: '#647681',
      stroke: '#eef5f7',
    };
  }
  if (kind === 'OTHER') {
    return {
      top: '#5d72a0',
      front: '#35466a',
      side: '#273550',
      stroke: '#92a8dc',
    };
  }
  return {
    top: '#175b8d',
    front: '#0e3f69',
    side: '#082d4f',
    stroke: '#61a9df',
    accent: '#ed8d21',
  };
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
  placement: DepotPlacement
) {
  const localScale = placement.scale;
  const x = placement.x + object.x * localScale;
  const y = placement.y + object.y * localScale;
  const width = Math.max(2.6, object.width * localScale);
  const height = Math.max(2.6, object.height * localScale);
  const z = objectHeight(object.kind, localScale);
  const a = isoPoint(x, y, 0);
  const b = isoPoint(x + width, y, 0);
  const c = isoPoint(x + width, y + height, 0);
  const d = isoPoint(x, y + height, 0);
  const at = isoPoint(x, y, z);
  const bt = isoPoint(x + width, y, z);
  const ct = isoPoint(x + width, y + height, z);
  const dt = isoPoint(x, y + height, z);
  const colors = objectPalette(object.kind);

  if (object.kind === 'WALL') {
    return (
      <g key={object.id} opacity="0.58">
        <polygon
          points={polygonPoints([d, c, ct, dt])}
          fill="#22365e"
          stroke="#6684c1"
          strokeOpacity="0.48"
          strokeWidth="0.9"
        />
      </g>
    );
  }

  if (object.kind === 'CORRIDOR') {
    return (
      <polygon
        key={object.id}
        points={polygonPoints([a, b, c, d])}
        fill="#5b78bc"
        fillOpacity="0.055"
        stroke="#7594d7"
        strokeOpacity="0.13"
        strokeWidth="0.75"
        strokeDasharray="4 5"
      />
    );
  }

  return (
    <g key={object.id} filter="url(#worldObjectShadow)">
      <polygon points={polygonPoints([d, c, ct, dt])} fill={colors.front} stroke={colors.stroke} strokeWidth="0.85" />
      <polygon points={polygonPoints([b, c, ct, bt])} fill={colors.side} stroke={colors.stroke} strokeWidth="0.85" />
      <polygon points={polygonPoints([at, bt, ct, dt])} fill={colors.top} stroke={colors.stroke} strokeWidth="0.95" />

      {object.kind === 'SHELF' && [0.28, 0.52, 0.76].map((ratio) => {
        const left = isoPoint(x, y + height, z * ratio);
        const right = isoPoint(x + width, y + height, z * ratio);
        return (
          <line
            key={ratio}
            x1={left.x}
            y1={left.y}
            x2={right.x}
            y2={right.y}
            stroke={colors.accent}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.92"
          />
        );
      })}
    </g>
  );
}

function DepotWorld({
  placement,
  onOpen,
}: {
  placement: DepotPlacement;
  onOpen: (depotId: string) => void;
}) {
  const { depot, layout } = placement;
  const floorA = isoPoint(placement.x - 9, placement.y - 9, 0);
  const floorB = isoPoint(placement.x + placement.width + 9, placement.y - 9, 0);
  const floorC = isoPoint(placement.x + placement.width + 9, placement.y + placement.height + 9, 0);
  const floorD = isoPoint(placement.x - 9, placement.y + placement.height + 9, 0);
  const labelPoint = isoPoint(
    placement.x + placement.width * 0.5,
    placement.y + placement.height + 17,
    0
  );

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
        fill="#335ba6"
        fillOpacity="0.055"
        stroke="#6f97e1"
        strokeOpacity="0.22"
        strokeWidth="1.05"
      />

      {layout
        ? layout.objects
            .slice()
            .sort((left, right) => {
              const leftDepth = (left.x + left.y) * placement.scale + left.layer * 0.001;
              const rightDepth = (right.x + right.y) * placement.scale + right.layer * 0.001;
              return leftDepth - rightDepth;
            })
            .map((object) => renderDepotObject(object, placement))
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

      <g className={styles.depotLabel} transform={'translate(' + labelPoint.x + ' ' + (labelPoint.y + 17) + ')'}>
        <text textAnchor="middle" className={styles.depotCode}>{depot.code}</text>
        <text y="15" textAnchor="middle" className={styles.depotName}>{depot.name}</text>
        {!layout && (
          <text y="29" textAnchor="middle" className={styles.depotStatus}>sem croqui ativo</text>
        )}
      </g>
    </g>
  );
}

function PalletWorld({
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
  const labelPoint = isoPoint(x + palletWidth / 2, y + palletDepth + 8, 0);

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
        const boxWidth = 14;
        const boxDepth = 11;
        const boxHeight = 14;
        const ba = isoPoint(bx, by, bz);
        const bb = isoPoint(bx + boxWidth, by, bz);
        const bc = isoPoint(bx + boxWidth, by + boxDepth, bz);
        const bd = isoPoint(bx, by + boxDepth, bz);
        const bat = isoPoint(bx, by, bz + boxHeight);
        const bbt = isoPoint(bx + boxWidth, by, bz + boxHeight);
        const bct = isoPoint(bx + boxWidth, by + boxDepth, bz + boxHeight);
        const bdt = isoPoint(bx, by + boxDepth, bz + boxHeight);
        return (
          <g key={boxIndex} filter="url(#worldObjectShadow)">
            <polygon points={polygonPoints([bd, bc, bct, bdt])} fill="#bf7834" stroke="#e1ad6b" strokeWidth="0.65" />
            <polygon points={polygonPoints([bb, bc, bct, bbt])} fill="#925528" stroke="#c98745" strokeWidth="0.65" />
            <polygon points={polygonPoints([bat, bbt, bct, bdt])} fill="#dda05a" stroke="#efc183" strokeWidth="0.7" />
          </g>
        );
      })}

      <g transform={'translate(' + labelPoint.x + ' ' + (labelPoint.y + 11) + ')'}>
        <text textAnchor="middle" className={styles.palletLabel}>
          {group ? group.invoiceId : 'P' + String(index + 1).padStart(2, '0')}
        </text>
        {group && (
          <text y="12" textAnchor="middle" className={styles.palletDetail}>
            {group.itemCount} item(ns)
          </text>
        )}
      </g>
    </g>
  );
}

export function WarehouseLandingOperational({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [data, setData] = useState<LandingData>(INITIAL_DATA);

  const load = useCallback(async () => {
    setData((current) => ({ ...current, loading: true, error: null }));
    try {
      const [depots, layouts, queue] = await Promise.all([
        listWarehouseDepots(workspaceId, 250),
        listWarehouseDepotLayouts(workspaceId, 150),
        loadWarehouseInvoiceIntakeQueue(workspaceId).catch(() => null),
      ]);

      setData({
        loading: false,
        error: null,
        depots,
        layouts,
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
            <feDropShadow dx="0" dy="8" stdDeviation="5.5" floodColor="#000713" floodOpacity="0.45" />
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

          <g transform={'translate(' + isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH / 2, PALLET_YARD_Y - 39, 0).x + ' ' + isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH / 2, PALLET_YARD_Y - 39, 0).y + ')'}>
            <text textAnchor="middle" className={styles.yardTitle}>RECEBIMENTO · AGUARDANDO ALOCAÇÃO</text>
            <text y="15" textAnchor="middle" className={styles.yardSubtitle}>
              {data.pendingAvailable
                ? pendingItems > 0
                  ? pendingItems + ' item(ns) · ' + pendingGroups.length + ' NF(s)'
                  : 'sem pendências · paletes livres'
                : 'leitura temporariamente indisponível'}
            </text>
          </g>

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
                index={index}
              />
            );
          })}

          {pendingGroups.length > MAX_VISIBLE_PENDING_NFS && (
            <g transform={'translate(' + isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH / 2, PALLET_YARD_Y + PALLET_YARD_HEIGHT - 4, 0).x + ' ' + isoPoint(PALLET_YARD_X + PALLET_YARD_WIDTH / 2, PALLET_YARD_Y + PALLET_YARD_HEIGHT - 4, 0).y + ')'}>
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
