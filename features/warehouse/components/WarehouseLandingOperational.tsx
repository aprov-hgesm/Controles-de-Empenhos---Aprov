'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  PackageOpen,
  Sparkles,
  Warehouse,
} from 'lucide-react';

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

const INITIAL_DATA: LandingData = {
  loading: true,
  error: null,
  depots: [],
  layouts: [],
  pendingRows: [],
  pendingAvailable: true,
};

const VIEW_WIDTH = 520;
const VIEW_HEIGHT = 300;
const ORIGIN_X = 260;
const ORIGIN_Y = 62;
const FLOOR_HALF_W = 202;
const FLOOR_HALF_H = 102;
const PALLET_SLOTS = 6;

type IsoPoint = { x: number; y: number };

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

function points(list: IsoPoint[]): string {
  return list.map((point) => point.x.toFixed(1) + ',' + point.y.toFixed(1)).join(' ');
}

function objectHeight(kind: WarehouseDepotLayoutObject['kind']): number {
  if (kind === 'SHELF') return 72;
  if (kind === 'REFRIGERATOR') return 78;
  if (kind === 'FREEZER' || kind === 'CHAMBER') return 48;
  if (kind === 'PALLET') return 10;
  if (kind === 'BENCH' || kind === 'CABINET') return 38;
  if (kind === 'OTHER') return 30;
  return 24;
}

function palette(kind: WarehouseDepotLayoutObject['kind']): {
  top: string;
  front: string;
  side: string;
  stroke: string;
} {
  if (kind === 'PALLET') {
    return { top: '#b68148', front: '#80552f', side: '#684524', stroke: '#d4a76e' };
  }
  if (kind === 'FREEZER' || kind === 'CHAMBER') {
    return { top: '#dceaf4', front: '#8caec1', side: '#65889d', stroke: '#d9f1ff' };
  }
  if (kind === 'REFRIGERATOR') {
    return { top: '#edf2f4', front: '#9aaab3', side: '#6f818c', stroke: '#f8fbfc' };
  }
  if (kind === 'BENCH' || kind === 'CABINET') {
    return { top: '#dce4e8', front: '#8799a3', side: '#647783', stroke: '#eef5f7' };
  }
  if (kind === 'OTHER') {
    return { top: '#6076a5', front: '#35476e', side: '#273654', stroke: '#90a8df' };
  }
  return { top: '#1a5d8f', front: '#0f3e68', side: '#092e50', stroke: '#5ca7e1' };
}

function DepotMiniature({
  depot,
  layout,
}: {
  depot: WarehouseDepot;
  layout: WarehouseDepotLayout | null;
}) {
  const logicalWidth = layout?.logicalWidth || 100;
  const logicalHeight = layout?.logicalHeight || 70;
  const floor = [
    isoPoint(0, 0, 0, logicalWidth, logicalHeight),
    isoPoint(logicalWidth, 0, 0, logicalWidth, logicalHeight),
    isoPoint(logicalWidth, logicalHeight, 0, logicalWidth, logicalHeight),
    isoPoint(0, logicalHeight, 0, logicalWidth, logicalHeight),
  ];

  const visualObjects = (layout?.objects || [])
    .filter((object) => object.kind !== 'WALL' && object.kind !== 'CORRIDOR')
    .slice()
    .sort((left, right) => (left.x + left.y + left.layer * 0.001) - (right.x + right.y + right.layer * 0.001));

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className={styles.depotSvg}
      role="img"
      aria-label={`Croqui 3D do depósito ${depot.name}`}
    >
      <defs>
        <linearGradient id={`landing-floor-${depot.id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#0d1d37" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#07101f" stopOpacity="0.92" />
        </linearGradient>
        <filter id={`landing-shadow-${depot.id}`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="9" stdDeviation="7" floodColor="#00081b" floodOpacity="0.46" />
        </filter>
      </defs>

      <polygon
        points={points(floor)}
        fill={`url(#landing-floor-${depot.id})`}
        stroke="#5d7ab8"
        strokeOpacity="0.58"
        strokeWidth="1.5"
      />

      {Array.from({ length: 7 }, (_, index) => {
        const ratio = (index + 1) / 8;
        const a = isoPoint(logicalWidth * ratio, 0, 0, logicalWidth, logicalHeight);
        const b = isoPoint(logicalWidth * ratio, logicalHeight, 0, logicalWidth, logicalHeight);
        const c = isoPoint(0, logicalHeight * ratio, 0, logicalWidth, logicalHeight);
        const d = isoPoint(logicalWidth, logicalHeight * ratio, 0, logicalWidth, logicalHeight);
        return (
          <g key={index} stroke="#7392cf" strokeOpacity="0.15" strokeWidth="0.7">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
          </g>
        );
      })}

      {visualObjects.map((object) => {
        const z = objectHeight(object.kind);
        const a = isoPoint(object.x, object.y, 0, logicalWidth, logicalHeight);
        const b = isoPoint(object.x + object.width, object.y, 0, logicalWidth, logicalHeight);
        const c = isoPoint(object.x + object.width, object.y + object.height, 0, logicalWidth, logicalHeight);
        const d = isoPoint(object.x, object.y + object.height, 0, logicalWidth, logicalHeight);
        const at = isoPoint(object.x, object.y, z, logicalWidth, logicalHeight);
        const bt = isoPoint(object.x + object.width, object.y, z, logicalWidth, logicalHeight);
        const ct = isoPoint(object.x + object.width, object.y + object.height, z, logicalWidth, logicalHeight);
        const dt = isoPoint(object.x, object.y + object.height, z, logicalWidth, logicalHeight);
        const colors = palette(object.kind);

        return (
          <g key={object.id} filter={`url(#landing-shadow-${depot.id})`}>
            <polygon points={points([d, c, ct, dt])} fill={colors.front} stroke={colors.stroke} strokeWidth="1" />
            <polygon points={points([b, c, ct, bt])} fill={colors.side} stroke={colors.stroke} strokeWidth="1" />
            <polygon points={points([at, bt, ct, dt])} fill={colors.top} stroke={colors.stroke} strokeWidth="1.05" />
            {object.kind === 'SHELF' && [0.28, 0.52, 0.76].map((ratio) => {
              const l = isoPoint(object.x, object.y + object.height, z * ratio, logicalWidth, logicalHeight);
              const r = isoPoint(object.x + object.width, object.y + object.height, z * ratio, logicalWidth, logicalHeight);
              return (
                <line
                  key={ratio}
                  x1={l.x}
                  y1={l.y}
                  x2={r.x}
                  y2={r.y}
                  stroke="#f4a52c"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );
      })}

      {!layout && (
        <g>
          <text x="260" y="154" textAnchor="middle" fill="#8ea7d7" fontSize="13" fontWeight="800">
            Croqui ainda não publicado
          </text>
          <text x="260" y="175" textAnchor="middle" fill="#63769d" fontSize="10">
            O depósito permanece acessível em Meus Depósitos
          </text>
        </g>
      )}
    </svg>
  );
}

function buildPendingGroups(rows: WarehouseInvoiceIntakeQueueRow[]): PendingInvoiceGroup[] {
  const actionable = rows.filter(
    (row) =>
      (row.status === 'PENDING' || row.status === 'PARTIALLY_PROCESSED')
      && row.pendingQuantity > 0.000001
  );
  const groups = new Map<string, PendingInvoiceGroup>();

  for (const row of actionable) {
    const key = row.invoiceRecordKey || row.invoiceId || row.key;
    const current = groups.get(key);
    if (current) {
      current.itemCount += 1;
      current.itemNames.push(row.itemName);
      continue;
    }
    groups.set(key, {
      key,
      invoiceId: row.invoiceId || 'NF sem número',
      supplier: row.supplier || 'Fornecedor não informado',
      itemCount: 1,
      itemNames: [row.itemName],
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => right.itemCount - left.itemCount || left.invoiceId.localeCompare(right.invoiceId, 'pt-BR'));
}

function PalletVisual({
  group,
  index,
}: {
  group: PendingInvoiceGroup | null;
  index: number;
}) {
  const boxCount = group ? Math.min(9, group.itemCount) : 0;
  const hiddenItems = group ? Math.max(0, group.itemCount - boxCount) : 0;

  return (
    <div
      className={styles.palletSlot}
      data-pending={group ? 'true' : 'false'}
      title={group ? group.itemNames.join(' · ') : 'Palete disponível'}
    >
      <div className={styles.palletVisual} aria-hidden="true">
        <div className={styles.palletShadow} />
        <div className={styles.palletDeck}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={styles.palletFeet}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.boxStack}>
          {Array.from({ length: boxCount }, (_, boxIndex) => (
            <span
              key={boxIndex}
              className={styles.pendingBox}
              style={{
                left: 18 + (boxIndex % 3) * 29 + '%',
                bottom: 23 + Math.floor(boxIndex / 3) * 20 + 'px',
                zIndex: boxIndex + 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className={styles.palletMeta}>
        <span className={styles.palletIndex}>P{String(index + 1).padStart(2, '0')}</span>
        {group ? (
          <>
            <strong>{group.invoiceId}</strong>
            <span>{group.itemCount} item(ns) pendente(s){hiddenItems ? ` · +${hiddenItems} na pilha` : ''}</span>
          </>
        ) : (
          <>
            <strong>Palete livre</strong>
            <span>Sem item pendente</span>
          </>
        )}
      </div>
    </div>
  );
}

export function WarehouseLandingOperational({ workspaceId }: { workspaceId: string }) {
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
        error: error instanceof Error ? error.message : 'Não foi possível montar a visão geral dos depósitos.',
      }));
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDepots = useMemo(
    () => data.depots.filter((item) => item.depot.status === 'active'),
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

  const pendingGroups = useMemo(
    () => buildPendingGroups(data.pendingRows),
    [data.pendingRows]
  );

  const pendingItems = useMemo(
    () => pendingGroups.reduce((sum, group) => sum + group.itemCount, 0),
    [pendingGroups]
  );

  const visiblePalletGroups = useMemo(
    () => Array.from({ length: PALLET_SLOTS }, (_, index) => pendingGroups[index] || null),
    [pendingGroups]
  );

  if (data.loading && !data.depots.length) {
    return (
      <section className={styles.scene} data-testid="warehouse-landing-operational">
        <div className={styles.ambientGlow} aria-hidden="true" />
        <div className={styles.perspectiveGrid} aria-hidden="true" />
        <div className={styles.loading}>
          <Warehouse className="h-8 w-8 text-blue-200/40" />
          <span>Montando visão geral dos depósitos</span>
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
      <div className={styles.perspectiveGrid} aria-hidden="true" />

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            <Sparkles className="h-3.5 w-3.5" />
            EMPROVEX · ADM DEPÓSITO
          </p>
          <h1 className={styles.title}>Visão geral dos depósitos.</h1>
          <p className={styles.subtitle}>
            Todos os depósitos da unidade em uma única cena. Selecione um deles para abrir sua
            Visão 3D completa em Meus Depósitos.
          </p>
        </div>

        <div className={styles.summary}>
          <div>
            <span>Depósitos</span>
            <strong>{activeDepots.length}</strong>
          </div>
          <div>
            <span>NFs pendentes</span>
            <strong>{data.pendingAvailable ? pendingGroups.length : '—'}</strong>
          </div>
          <div>
            <span>Itens aguardando alocação</span>
            <strong>{data.pendingAvailable ? pendingItems : '—'}</strong>
          </div>
        </div>
      </header>

      {data.error && (
        <div className={styles.error}>{data.error}</div>
      )}

      <div className={styles.stage}>
        <div className={styles.depotField}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.sectionEyebrow}>Mapa estrutural</span>
              <h2>Depósitos cadastrados</h2>
            </div>
            <span className={styles.sectionHint}>Clique no depósito para abrir</span>
          </div>

          {activeDepots.length ? (
            <div className={styles.depotGrid}>
              {activeDepots.map(({ depot }) => {
                const layout = activeLayoutByDepot.get(depot.id) || null;
                return (
                  <Link
                    key={depot.id}
                    href={`/adm-deposito/meus-depositos?deposito=${encodeURIComponent(depot.id)}`}
                    className={styles.depotCard}
                    data-testid={'warehouse-landing-depot-' + depot.id}
                  >
                    <div className={styles.depotChrome}>
                      <span>{depot.code}</span>
                      <span>{layout ? 'Visão 3D ativa' : 'Sem croqui ativo'}</span>
                    </div>
                    <DepotMiniature depot={depot} layout={layout} />
                    <div className={styles.depotCaption}>
                      <div>
                        <strong>{depot.name}</strong>
                        <span>{layout ? layout.name : 'Estrutura disponível para configuração'}</span>
                      </div>
                      <span className={styles.openMark}>↗</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyDepots}>
              <Warehouse className="h-9 w-9" />
              <strong>Nenhum depósito ativo cadastrado</strong>
              <span>Quando houver depósitos ativos, eles serão projetados lado a lado nesta cena.</span>
            </div>
          )}
        </div>

        <aside className={styles.pendingYard} aria-label="Pendências de alocação">
          <div className={styles.pendingHeader}>
            <div>
              <span className={styles.sectionEyebrow}>Área de recebimento</span>
              <h2>Paletes aguardando alocação</h2>
            </div>
            {pendingGroups.length > PALLET_SLOTS && (
              <span className={styles.overflowBadge}>+{pendingGroups.length - PALLET_SLOTS} NFs</span>
            )}
          </div>

          <div className={styles.pendingIntro}>
            <PackageOpen className="h-4 w-4" />
            {data.pendingAvailable
              ? pendingItems > 0
                ? `${pendingItems} item(ns) de ${pendingGroups.length} NF(s) aguardam posição física.`
                : 'Nenhum item aguarda alocação. Os paletes permanecem livres.'
              : 'A leitura das pendências está temporariamente indisponível.'}
          </div>

          <div className={styles.palletGrid}>
            {visiblePalletGroups.map((group, index) => (
              <PalletVisual key={group?.key || 'empty-' + index} group={group} index={index} />
            ))}
          </div>

          <div className={styles.pendingLegend}>
            <span><i className={styles.legendBox} /> Caixa = item pendente</span>
            <span><i className={styles.legendPallet} /> Palete = NF em espera</span>
          </div>
        </aside>
      </div>

      <footer className={styles.footer}>
        <span><Boxes className="h-3.5 w-3.5" /> Leitura consultiva, sem operações nesta tela.</span>
        <span>Geometria derivada dos croquis oficiais do ADM Depósito.</span>
      </footer>
    </section>
  );
}
