'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Check,
  Move,
  Settings2,
  Undo2,
} from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type { WarehouseDepotLayout } from '../../../lib/warehouse/layout';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import {
  listActiveWarehouseDepotLayouts,
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
import {
  getWarehouseLandingVisualLayout,
  normalizeWarehouseLandingVisualOverrides,
  saveWarehouseLandingVisualLayout,
  type WarehouseLandingVisualOverrides,
} from '../../../lib/warehouse/landingVisualLayoutRepository';
import {
  WAREHOUSE_BOX_VISUAL,
  WAREHOUSE_PALLET_VISUAL,
} from '../visualStyle';
import { WarehouseIsometricPreview } from './WarehouseIsometricPreview';
import {
  warehouseLandingIsoFrame,
  placeWarehouseLandingIsoFrame,
} from '../../../lib/warehouse/isometricCamera';
import styles from './WarehouseLandingOperational.module.css';

const EMPTY_MATERIALS: WarehouseMaterial[] = [];
const noopSceneControl = () => {};
const MemoWarehouseIsometricPreview = memo(WarehouseIsometricPreview);

const LazyIntakeBulkActionPanel = dynamic(
  () => import('./WarehouseItemRegistrationOperational')
    .then((module) => module.IntakeBulkActionPanel),
  { ssr: false }
);

interface LandingData {
  loading: boolean;
  error: string | null;
  depots: WarehouseDepotListItem[];
  layouts: WarehouseDepotLayoutListItem[];
  locations: WarehouseLocationListItem[];
  locationBalances: WarehouseLocationBalanceListItem[];
  pendingRows: WarehouseInvoiceIntakeQueueRow[];
  pendingAvailable: boolean;
  pendingLoading: boolean;
  locationsLoaded: boolean;
}

interface PendingInvoiceGroup {
  key: string;
  invoiceId: string;
  supplier: string;
  itemCount: number;
  itemNames: string[];
  rows: WarehouseInvoiceIntakeQueueRow[];
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
  pendingAvailable: false,
  pendingLoading: true,
  locationsLoaded: false,
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

function warehousePallet(
  key: string,
  x: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  visualRole = 'warehouse-pallet'
) {
  const deckBaseZ = Math.max(2, height * 0.55);
  const center = isoPoint(x + width / 2, y + depth / 2, 0);

  return (
    <g
      key={key}
      data-visual-role={visualRole}
      filter="url(#worldObjectShadow)"
      aria-hidden="true"
    >
      <ellipse
        cx={center.x}
        cy={center.y + Math.max(4, depth * 0.12)}
        rx={Math.max(14, width * 0.68)}
        ry={Math.max(5, depth * 0.22)}
        fill="#000817"
        opacity="0.18"
        filter="url(#worldSoftBlur)"
      />

      {[0.14, 0.5, 0.86].map((ratio) => {
        const p1 = isoPoint(x + width * ratio, y + depth * 0.08, deckBaseZ - 0.4);
        const p2 = isoPoint(x + width * ratio, y + depth * 0.92, deckBaseZ - 0.4);
        return (
          <line
            key={'pallet-runner-' + ratio}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={WAREHOUSE_PALLET_VISUAL.runnerFill}
            strokeWidth={Math.max(2, width * 0.055)}
            strokeLinecap="round"
            opacity="0.98"
          />
        );
      })}

      {Array.from({ length: 7 }, (_, index) => {
        const cellWidth = width / 7;
        const gap = Math.max(0.9, cellWidth * 0.18);
        const slatX = x + index * cellWidth + gap / 2;
        const slatWidth = Math.max(1.6, cellWidth - gap);
        const slatBottomZ = Math.max(deckBaseZ, height - Math.max(1.6, height * 0.22));
        const sa = isoPoint(slatX, y, height);
        const sb = isoPoint(slatX + slatWidth, y, height);
        const sc = isoPoint(slatX + slatWidth, y + depth, height);
        const sd = isoPoint(slatX, y + depth, height);
        const sdb = isoPoint(slatX, y + depth, slatBottomZ);
        const scb = isoPoint(slatX + slatWidth, y + depth, slatBottomZ);
        const sbb = isoPoint(slatX + slatWidth, y, slatBottomZ);

        return (
          <g key={'pallet-slat-' + index}>
            <polygon
              points={polygonPoints([sa, sb, sc, sd])}
              fill={index % 2 === 0
                ? WAREHOUSE_PALLET_VISUAL.topLight
                : WAREHOUSE_PALLET_VISUAL.topMid}
              stroke={WAREHOUSE_PALLET_VISUAL.frontStroke}
              strokeWidth="0.7"
            />
            <polygon
              points={polygonPoints([sd, sc, scb, sdb])}
              fill={WAREHOUSE_PALLET_VISUAL.frontFill}
              stroke={WAREHOUSE_PALLET_VISUAL.frontStroke}
              strokeWidth="0.6"
            />
            <polygon
              points={polygonPoints([sb, sc, scb, sbb])}
              fill={WAREHOUSE_PALLET_VISUAL.sideFill}
              stroke={WAREHOUSE_PALLET_VISUAL.sideStroke}
              strokeWidth="0.55"
            />
            <line
              x1={sa.x}
              y1={sa.y}
              x2={sb.x}
              y2={sb.y}
              stroke={WAREHOUSE_PALLET_VISUAL.highlight}
              strokeWidth="0.6"
              opacity="0.75"
            />
          </g>
        );
      })}
    </g>
  );
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
      current.rows.push(row);
      continue;
    }
    grouped.set(key, {
      key,
      invoiceId: row.invoiceId || 'NF sem número',
      supplier: row.supplier || 'Fornecedor não informado',
      itemCount: 1,
      itemNames: [row.itemName],
      rows: [row],
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

function applyVisualOverrides(
  placements: DepotPlacement[],
  overrides: WarehouseLandingVisualOverrides
): DepotPlacement[] {
  return placements.map((placement) => {
    const visual = overrides[placement.depot.id];
    if (!visual) return placement;

    const minX = 34;
    const minY = 72;
    const maxX = Math.max(minX, DEPOT_WORLD_WIDTH - placement.width - 34);
    const maxY = Math.max(minY, WORLD_HEIGHT - placement.height - 58);

    return {
      ...placement,
      x: Math.min(maxX, Math.max(minX, placement.x + visual.offsetX)),
      y: Math.min(maxY, Math.max(minY, placement.y + visual.offsetY)),
    };
  });
}

function svgPointerPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): IsoPoint | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function svgDeltaToWorld(deltaX: number, deltaY: number): IsoPoint {
  const projectedX = deltaX / ISO_HALF_WIDTH;
  const projectedY = deltaY / ISO_HALF_HEIGHT;
  return {
    x: WORLD_WIDTH * (projectedX + projectedY) / 2,
    y: WORLD_HEIGHT * (projectedY - projectedX) / 2,
  };
}

const DepotWorld = memo(function DepotWorld({
  placement,
  locations,
  balances,
  locationsLoaded,
  onOpen,
  editMode,
  selected,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  placement: DepotPlacement;
  locations: WarehouseLocation[];
  balances: WarehouseLocationBalance[];
  locationsLoaded: boolean;
  onOpen: (depotId: string) => void;
  editMode: boolean;
  selected: boolean;
  onSelect: (depotId: string) => void;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>, depotId: string) => void;
  onPointerMove: (event: ReactPointerEvent<SVGGElement>, depotId: string) => void;
  onPointerUp: (event: ReactPointerEvent<SVGGElement>, depotId: string) => void;
}) {
  const { depot, layout } = placement;
  const open = () => onOpen(depot.id);
  const sceneGeometry = useMemo(() => {
    if (!layout) return null;
    const center = isoPoint(
      placement.x + placement.width / 2,
      placement.y + placement.height / 2
    );
    // Use the same physical dimensions and source camera as the canonical
    // 3D renderer. All floors now share the map's single 24-degree inclination.
    const floorSpan =
      placement.width / WORLD_WIDTH * ISO_HALF_WIDTH
      + placement.height / WORLD_HEIGHT * ISO_HALF_WIDTH;
    return placeWarehouseLandingIsoFrame(
      warehouseLandingIsoFrame(layout.logicalWidth, layout.logicalHeight),
      center,
      floorSpan
    );
  }, [layout, placement.x, placement.y, placement.width, placement.height]);

  const [floorA, floorB, floorC, floorD] = sceneGeometry?.floorCorners || [
    isoPoint(placement.x - 9, placement.y - 9),
    isoPoint(placement.x + placement.width + 9, placement.y - 9),
    isoPoint(placement.x + placement.width + 9, placement.y + placement.height + 9),
    isoPoint(placement.x - 9, placement.y + placement.height + 9),
  ];
  const depotLocations = useMemo(
    () => locations.filter((location) => location.depotId === depot.id),
    [locations, depot.id]
  );
  const displayedObjects = useMemo(() => {
    if (!layout) return [];
    // Show valid croqui geometry immediately, before occupancy metadata arrives.
    if (!locationsLoaded) return layout.objects;
    const locationIds = new Set(depotLocations.map((location) => location.id));
    return layout.objects.filter(
      (object) => !object.warehouseLocationId || locationIds.has(object.warehouseLocationId)
    );
  }, [depotLocations, layout, locationsLoaded]);
  const depotBalances = useMemo(
    () => balances.filter(
      (balance) => balance.position.kind !== 'UNASSIGNED' && balance.position.depotId === depot.id
    ),
    [balances, depot.id]
  );
  return (
    <g
      className={[
        styles.depotGroup,
        editMode ? styles.depotEditable : '',
        selected ? styles.depotSelected : '',
      ].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      aria-label={editMode
        ? 'Selecionar e mover ' + depot.name
        : 'Abrir ' + depot.name + ' em Meus Depósitos'}
      data-testid={'warehouse-landing-depot-' + depot.id}
      onClick={() => editMode ? onSelect(depot.id) : open()}
      onPointerDown={(event) => editMode && onPointerDown(event, depot.id)}
      onPointerMove={(event) => editMode && onPointerMove(event, depot.id)}
      onPointerUp={(event) => editMode && onPointerUp(event, depot.id)}
      onPointerCancel={(event) => editMode && onPointerUp(event, depot.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (editMode) onSelect(depot.id);
          else open();
        }
      }}
    >
      {/* Preserve the SVG drag/click target without duplicating the scene's floor. */}
      <polygon
        className={styles.depotAura}
        points={polygonPoints([floorA, floorB, floorC, floorD])}
        fill="#f5f8fa"
        fillOpacity={layout ? "0.04" : "0.96"}
        stroke="#b8cad8"
        strokeOpacity={layout ? "0.3" : "0.92"}
        strokeWidth="1.15"
        filter="url(#depotFloorShadow)"
      />

      {layout && sceneGeometry ? (
        <foreignObject
          x={sceneGeometry.x}
          y={sceneGeometry.y}
          width={sceneGeometry.width}
          height={sceneGeometry.height}
          pointerEvents="none"
          data-camera-pose="aligned-floor"
          data-testid="warehouse-landing-canonical-scene"
          data-layout-id={layout.id}
          data-layout-version={layout.version}
        >
          <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
            <MemoWarehouseIsometricPreview
              logicalWidth={layout.logicalWidth}
              logicalHeight={layout.logicalHeight}
              objects={displayedObjects}
              locations={depotLocations}
              balances={depotBalances}
              materials={EMPTY_MATERIALS}
              selectedMaterialId=""
              queryText=""
              onQueryTextChange={noopSceneControl}
              onSelectedMaterialIdChange={noopSceneControl}
              sceneOnly
            />
          </div>
        </foreignObject>
      ) : (
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
});

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
  onActivate,
  onHover,
}: {
  x: number;
  y: number;
  group: PendingInvoiceGroup | null;
  onActivate?: (group: PendingInvoiceGroup) => void;
  onHover?: (group: PendingInvoiceGroup | null) => void;
}) {
  const palletWidth = 48;
  const palletDepth = 34;
  const palletHeight = 7;
  const boxCount = group ? Math.min(group.itemCount, 12) : 0;

  return (
    <g
      className={group ? styles.pendingPallet : styles.emptyPallet}
      data-pending={group ? 'true' : 'false'}
      data-testid={group ? 'warehouse-pending-invoice-pallet' : undefined}
      role={group ? 'button' : undefined}
      tabIndex={group ? 0 : undefined}
      aria-label={group
        ? 'NF ' + group.invoiceId + ', ' + group.itemCount + ' item(ns) pendente(s). Abrir alocação.'
        : undefined}
      onMouseEnter={() => group && onHover?.(group)}
      onMouseLeave={() => group && onHover?.(null)}
      onFocus={() => group && onHover?.(group)}
      onBlur={() => group && onHover?.(null)}
      onClick={() => group && onActivate?.(group)}
      onKeyDown={(event) => {
        if (!group || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onActivate?.(group);
      }}
    >
      {group && (
        <polygon
          points={polygonPoints([
            isoPoint(x - 8, y - 8, 0),
            isoPoint(x + palletWidth + 8, y - 8, 0),
            isoPoint(x + palletWidth + 8, y + palletDepth + 8, 0),
            isoPoint(x - 8, y + palletDepth + 8, 0),
          ])}
          fill="transparent"
          stroke="transparent"
          pointerEvents="all"
          aria-hidden="true"
        />
      )}
      {warehousePallet(
        'receiving-pallet-' + (group?.key || x + '-' + y),
        x,
        y,
        palletWidth,
        palletDepth,
        palletHeight,
        'receiving-warehouse-pallet'
      )}

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

function PendingPalletTooltip({
  x,
  y,
  group,
}: {
  x: number;
  y: number;
  group: PendingInvoiceGroup;
}) {
  const anchor = isoPoint(x + 53, y + 5, 68);
  const previewRows = group.rows.slice(0, 3);
  const tooltipWidth = 250;
  const tooltipHeight = 68 + previewRows.length * 17 + (group.rows.length > 3 ? 16 : 0);
  const tooltipX = Math.min(SVG_WIDTH - tooltipWidth - 18, anchor.x + 14);
  const tooltipY = Math.max(20, anchor.y - 18);

  return (
    <g
      className={styles.palletTooltip}
      transform={'translate(' + tooltipX + ' ' + tooltipY + ')'}
      pointerEvents="none"
      aria-hidden="true"
    >
      <rect
        x="0"
        y="0"
        width={tooltipWidth}
        height={tooltipHeight}
        rx="12"
        className={styles.palletTooltipBackdrop}
      />
      <text x="14" y="19" className={styles.palletTooltipTitle}>
        NF {group.invoiceId}
      </text>
      <text x="14" y="35" className={styles.palletTooltipMeta}>
        {group.supplier.slice(0, 42)}
      </text>
      <text x="14" y="51" className={styles.palletTooltipHint}>
        {group.itemCount} item(ns) pendente(s) · clique para alocar
      </text>
      {previewRows.map((row, index) => (
        <text
          key={row.key}
          x="14"
          y={70 + index * 17}
          className={styles.palletTooltipItem}
        >
          {row.itemName.slice(0, 34)}
          {' · '}
          {row.pendingQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          {' '}
          {row.unitLabel}
        </text>
      ))}
      {group.rows.length > 3 && (
        <text
          x="14"
          y={70 + previewRows.length * 17}
          className={styles.palletTooltipMore}
        >
          +{group.rows.length - 3} item(ns)
        </text>
      )}
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
  const [visualOverrides, setVisualOverrides] = useState<WarehouseLandingVisualOverrides>({});
  const [savedVisualOverrides, setSavedVisualOverrides] = useState<WarehouseLandingVisualOverrides>({});
  const [editMode, setEditMode] = useState(false);
  const [selectedVisualDepotId, setSelectedVisualDepotId] = useState('');
  const [savingVisual, setSavingVisual] = useState(false);
  const [visualMessage, setVisualMessage] = useState('');
  const [hoveredPendingKey, setHoveredPendingKey] = useState<string | null>(null);
  const [selectedPendingKey, setSelectedPendingKey] = useState<string | null>(null);
  const loadRequestRef = useRef(0);
  const lastWorkspaceRef = useRef('');
  const editModeRef = useRef(false);

  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  const dragRef = useRef<{
    depotId: string;
    pointerId: number;
    startPoint: IsoPoint;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const sameWorkspace = lastWorkspaceRef.current === workspaceId;
    lastWorkspaceRef.current = workspaceId;
    // During a refresh, preserve the current picture instead of flashing a skeleton.
    // When the workspace changes, never display data from the previous workspace.
    setData((current) => sameWorkspace
      ? { ...current, loading: !current.depots.length, error: null, pendingLoading: true }
      : { ...INITIAL_DATA }
    );
    if (!sameWorkspace) {
      setSavedVisualOverrides({});
      setVisualOverrides({});
    }

    // Start all reads concurrently, but don't let NF/stock details hold up the
    // first 3D paint. No additional Firestore queries are introduced.
    const stockReads = Promise.allSettled([
      listWarehouseLocations(workspaceId, 500),
      listWarehousePositiveLocationBalances(workspaceId, 500),
    ]);
    const queueRead = loadWarehouseInvoiceIntakeQueue(workspaceId).catch(() => null);

    try {
      const [depots, layouts, visualSettings] = await Promise.all([
        listWarehouseDepots(workspaceId, 250),
        listActiveWarehouseDepotLayouts(workspaceId, 250),
        getWarehouseLandingVisualLayout(workspaceId).catch(() => null),
      ]);
      if (requestId !== loadRequestRef.current) return;

      setData((current) => ({
        ...current,
        loading: false,
        error: null,
        depots,
        layouts,
      }));
      const overrides = visualSettings?.overrides || {};
      setSavedVisualOverrides(overrides);
      // Do not overwrite an active drag/edit session during an NF refresh.
      setVisualOverrides((current) => editModeRef.current ? current : overrides);

      // Stock data and receiving queue finish separately; neither holds the
      // other back. Keep a coherent scene even when a secondary query fails.
      await Promise.all([
        stockReads.then(([locationResult, balanceResult]) => {
          if (requestId !== loadRequestRef.current) return;
          const locations = locationResult.status === 'fulfilled' ? locationResult.value : [];
          const locationBalances = balanceResult.status === 'fulfilled' ? balanceResult.value : [];
          const detailsError = locationResult.status === 'rejected' || balanceResult.status === 'rejected';
          setData((current) => ({
            ...current,
            locations,
            locationsLoaded: locationResult.status === 'fulfilled',
            locationBalances,
            error: detailsError
              ? 'Alguns dados de localização ou saldo não puderam ser atualizados.'
              : current.error,
          }));
        }),
        queueRead.then((queue) => {
          if (requestId !== loadRequestRef.current) return;
          setData((current) => ({
            ...current,
            pendingRows: queue?.rows || [],
            pendingAvailable: Boolean(queue),
            pendingLoading: false,
          }));
        }),
      ]);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setData((current) => ({
        ...current,
        loading: false,
        pendingLoading: false,
        error: error instanceof Error
          ? error.message
          : 'Não foi possível montar o ambiente visual dos depósitos.',
      }));
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
    return () => { loadRequestRef.current += 1; };
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

  const basePlacements = useMemo(
    () => derivePlacements(activeDepots, activeLayoutByDepot),
    [activeDepots, activeLayoutByDepot]
  );

  const placements = useMemo(
    () => applyVisualOverrides(basePlacements, visualOverrides),
    [basePlacements, visualOverrides]
  );

  const activeLocations = useMemo(
    () => data.locations
      .map((item) => item.location)
      .filter((location) => location.status === 'active'),
    [data.locations]
  );

  const positiveLocationBalances = useMemo(
    () => data.locationBalances
      .map((item) => item.balance)
      .filter((balance): balance is WarehouseLocationBalance =>
        balance.quantity > 0 && balance.position.kind !== 'UNASSIGNED'
      ),
    [data.locationBalances]
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

  const selectedPendingGroup = useMemo(
    () => selectedPendingKey
      ? pendingGroups.find((group) => group.key === selectedPendingKey) || null
      : null,
    [pendingGroups, selectedPendingKey]
  );

  const updateVisual = useCallback((
    depotId: string,
    next: Partial<WarehouseLandingVisualOverrides[string]>
  ) => {
    setVisualOverrides((current) => {
      const base = current[depotId] || {
        offsetX: 0,
        offsetY: 0,
      };

      return normalizeWarehouseLandingVisualOverrides({
        ...current,
        [depotId]: {
          ...base,
          ...next,
        },
      });
    });
  }, []);

  const beginVisualEdit = () => {
    setVisualOverrides(savedVisualOverrides);
    setSelectedVisualDepotId((current) =>
      current && activeDepots.some((depot) => depot.id === current)
        ? current
        : activeDepots[0]?.id || ''
    );
    setVisualMessage('');
    setEditMode(true);
  };

  const cancelVisualEdit = () => {
    setVisualOverrides(savedVisualOverrides);
    setVisualMessage('');
    setEditMode(false);
    dragRef.current = null;
  };

  const saveVisualEdit = async () => {
    setSavingVisual(true);
    setVisualMessage('');
    try {
      const saved = await saveWarehouseLandingVisualLayout(workspaceId, visualOverrides);
      setSavedVisualOverrides(saved.overrides);
      setVisualOverrides(saved.overrides);
      setVisualMessage('Disposição visual salva.');
      setEditMode(false);
    } catch (error) {
      setVisualMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a disposição visual.'
      );
    } finally {
      setSavingVisual(false);
    }
  };

  const resetSelectedVisual = () => {
    if (!selectedVisualDepotId) return;
    setVisualOverrides((current) => {
      const next = { ...current };
      delete next[selectedVisualDepotId];
      return next;
    });
  };

  const handleDepotPointerDown = useCallback((
    event: ReactPointerEvent<SVGGElement>,
    depotId: string
  ) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const point = svgPointerPoint(svg, event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedVisualDepotId(depotId);
    const current = visualOverrides[depotId] || {
      offsetX: 0,
      offsetY: 0,
    };
    dragRef.current = {
      depotId,
      pointerId: event.pointerId,
      startPoint: point,
      startOffsetX: current.offsetX,
      startOffsetY: current.offsetY,
    };
  }, [visualOverrides]);

  const handleDepotPointerMove = useCallback((
    event: ReactPointerEvent<SVGGElement>,
    depotId: string
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.depotId !== depotId || drag.pointerId !== event.pointerId) return;

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const point = svgPointerPoint(svg, event.clientX, event.clientY);
    if (!point) return;

    const delta = svgDeltaToWorld(
      point.x - drag.startPoint.x,
      point.y - drag.startPoint.y
    );
    updateVisual(depotId, {
      offsetX: drag.startOffsetX + delta.x,
      offsetY: drag.startOffsetY + delta.y,
    });
  }, [updateVisual]);

  const handleDepotPointerUp = useCallback((
    event: ReactPointerEvent<SVGGElement>,
    depotId: string
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.depotId !== depotId || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }, []);

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

  const openDepot = useCallback((depotId: string) => {
    router.push('/central-depositos/meus-depositos?deposito=' + encodeURIComponent(depotId));
  }, [router]);

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
      aria-label="Início Central de Depósitos"
    >
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.texture} aria-hidden="true" />

      <div className={styles.sceneTitle}>
        <span>EMPROVEX · CENTRAL DE DEPÓSITOS</span>
        <strong>Ambiente logístico</strong>
        <small>
          {activeDepots.length} depósito(s)
          {' · '}
          {data.pendingLoading ? 'carregando pendências…' : data.pendingAvailable ? pendingGroups.length + ' NF(s) aguardando alocação' : 'pendências indisponíveis'}
        </small>
      </div>

      <div className={styles.layoutActions}>
        {!editMode ? (
          <button
            type="button"
            className={styles.layoutEditButton}
            onClick={beginVisualEdit}
            disabled={!activeDepots.length}
            data-testid="warehouse-landing-edit-layout"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Editar disposição
          </button>
        ) : (
          <div className={styles.layoutEditor} data-testid="warehouse-landing-layout-editor">
            <div className={styles.layoutEditorHead}>
              <span>
                <Move className="h-3.5 w-3.5" />
                Arraste os depósitos no plano
              </span>
              <select
                value={selectedVisualDepotId}
                onChange={(event) => setSelectedVisualDepotId(event.target.value)}
                className={styles.layoutSelect}
                aria-label="Depósito selecionado para personalização"
              >
                {activeDepots.map((depot) => (
                  <option key={depot.id} value={depot.id}>
                    {depot.code} · {depot.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.layoutControlRow}>
              <button
                type="button"
                onClick={resetSelectedVisual}
                title="Restaurar este depósito"
                aria-label="Restaurar posição do depósito"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Restaurar posição
              </button>
            </div>

            <div className={styles.layoutEditorFooter}>
              <button type="button" onClick={cancelVisualEdit} className={styles.layoutCancel}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveVisualEdit()}
                disabled={savingVisual}
                className={styles.layoutSave}
              >
                <Check className="h-3.5 w-3.5" />
                {savingVisual ? 'Salvando…' : 'Salvar disposição'}
              </button>
            </div>
          </div>
        )}
      </div>

      {visualMessage && (
        <div className={styles.layoutMessage} role="status">{visualMessage}</div>
      )}

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
              locations={activeLocations}
              balances={positiveLocationBalances}
              locationsLoaded={data.locationsLoaded}
              onOpen={openDepot}
              editMode={editMode}
              selected={selectedVisualDepotId === placement.depot.id}
              onSelect={setSelectedVisualDepotId}
              onPointerDown={handleDepotPointerDown}
              onPointerMove={handleDepotPointerMove}
              onPointerUp={handleDepotPointerUp}
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
              <g key={group?.key || 'empty-' + index}>
                <PalletWorld
                  x={px}
                  y={py}
                  group={group}
                  onHover={(pendingGroup) =>
                    setHoveredPendingKey(pendingGroup?.key || null)
                  }
                  onActivate={(pendingGroup) => {
                    if (editMode) return;
                    setHoveredPendingKey(null);
                    setSelectedPendingKey(pendingGroup.key);
                  }}
                />
                {group && hoveredPendingKey === group.key && !editMode && (
                  <PendingPalletTooltip
                    x={px}
                    y={py}
                    group={group}
                  />
                )}
              </g>
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
              {data.pendingLoading
                ? 'carregando notas fiscais…'
                : data.pendingAvailable
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
          <text>
            {editMode
              ? 'Modo de edição visual · arraste os depósitos para organizar o plano'
              : 'Clique em um depósito para entrar · passe sobre um palete de NF e clique para alocar'}
          </text>
        </g>
      </svg>

      {selectedPendingGroup && (
        <LazyIntakeBulkActionPanel
          workspaceId={workspaceId}
          subjectKind="invoice"
          subjectKey={selectedPendingGroup.key}
          subjectLabel={'NF ' + selectedPendingGroup.invoiceId}
          rows={selectedPendingGroup.rows}
          coverageLimited={false}
          onOpenDetailed={() => {
            router.push(
              '/central-depositos/cadastro-de-itens?aba=pendentes&nf='
                + encodeURIComponent(selectedPendingGroup.key)
            );
            setSelectedPendingKey(null);
          }}
          onClose={() => setSelectedPendingKey(null)}
          onComplete={async () => {
            await load();
          }}
        />
      )}
    </section>
  );
}
