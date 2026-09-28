'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  CalendarClock,
  LocateFixed,
  MapPin,
  PackageSearch,
  RefreshCw,
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
import type { WarehouseDepotLayout } from '../../../lib/warehouse/layout';
import { getActiveWarehouseDepotLayout } from '../../../lib/warehouse/layoutRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseBalance } from '../../../lib/warehouse/movement';
import {
  selectWarehouseFefoLot,
  warehouseLotExpiryState,
  type WarehouseLot,
  type WarehouseLotExpiryState,
} from '../../../lib/warehouse/lot';
import { listWarehouseLots } from '../../../lib/warehouse/lotRepository';
import { WarehouseIsometricPreview } from './WarehouseIsometricPreview';
import styles from './WarehouseHomeOperational.module.css';

interface WarehouseHomeData {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  locationBalances: WarehouseLocationBalanceListItem[];
  balances: WarehouseBalance[];
}

interface ValidityRow {
  key: string;
  expiresOn: string | null;
  quantity: number;
  state: WarehouseLotExpiryState;
  fefo: boolean;
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

const expiryLabel: Record<WarehouseLotExpiryState, string> = {
  VALID: 'Válido',
  NEAR_EXPIRY: 'Próximo do vencimento',
  EXPIRED: 'Vencido',
  NO_EXPIRY: 'Sem validade',
  DEPLETED: 'Esgotado',
  INACTIVE: 'Inativo',
};

function formatQuantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function dateLabel(value: string | null): string {
  if (!value) return 'Não informada';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? match[3] + '/' + match[2] + '/' + match[1] : value;
}

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

function validityStateClass(state: WarehouseLotExpiryState): string {
  if (state === 'EXPIRED') return styles.stateExpired;
  if (state === 'NEAR_EXPIRY') return styles.stateNear;
  if (state === 'VALID') return styles.stateValid;
  return styles.stateNeutral;
}

export function WarehouseHomeOperational({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<WarehouseHomeData>(INITIAL_DATA);
  const [query, setQuery] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [lots, setLots] = useState<WarehouseLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [activeLayout, setActiveLayout] = useState<WarehouseDepotLayout | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(false);

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
        error: error instanceof Error
          ? error.message
          : 'Falha ao carregar a central visual do ADM Depósito.',
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

  const depotPhysicalBalances = useMemo(
    () => data.locationBalances.filter(
      (item) => item.balance.quantity > 0 && isPositionInDepot(item, selectedDepotId)
    ),
    [data.locationBalances, selectedDepotId]
  );

  const depotMaterialBalances = useMemo(
    () => depotPhysicalBalances.filter(
      (item) => Boolean(selectedMaterialId) && item.balance.materialId === selectedMaterialId
    ),
    [depotPhysicalBalances, selectedMaterialId]
  );

  const previewLocations = useMemo(
    () => data.locations
      .map((item) => item.location)
      .filter((location) => location.status === 'active' && location.depotId === selectedDepotId),
    [data.locations, selectedDepotId]
  );

  const previewBalances = useMemo(
    () => depotPhysicalBalances.map((item) => item.balance),
    [depotPhysicalBalances]
  );

  const representedLocationIds = useMemo(
    () => new Set(
      (activeLayout?.objects || [])
        .map((object) => object.warehouseLocationId)
        .filter(Boolean) as string[]
    ),
    [activeLayout]
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

    const primaryId = position.kind === 'SUBPOSITION'
      ? position.subpositionId
      : position.locationId;
    const location = data.locations.find(
      (candidate) => candidate.location.id === primaryId
    )?.location;
    const parent = position.kind === 'SUBPOSITION'
      ? data.locations.find(
          (candidate) => candidate.location.id === position.locationId
        )?.location
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
    };
  }).filter(Boolean) as Array<{
    id: string;
    label: string;
    name: string;
    quantity: number;
    represented: boolean;
  }>, [data.locations, depotMaterialBalances, representedLocationIds]);

  const depotLots = useMemo(
    () => lots
      .filter((lot) =>
        lot.status === 'active'
        && lot.quantity > 0
        && lot.position.kind !== 'UNASSIGNED'
        && lot.position.depotId === selectedDepotId
      )
      .sort((left, right) =>
        (left.expiresOn || '9999-12-31').localeCompare(right.expiresOn || '9999-12-31')
      ),
    [lots, selectedDepotId]
  );

  const fefoLot = useMemo(
    () => selectWarehouseFefoLot(depotLots),
    [depotLots]
  );

  const validityRows = useMemo<ValidityRow[]>(() => {
    const grouped = new Map<string, ValidityRow>();

    for (const lot of depotLots) {
      const key = lot.expiresOn || 'NO_EXPIRY';
      const current = grouped.get(key);
      const state = warehouseLotExpiryState(lot);

      if (current) {
        current.quantity += lot.quantity;
        current.fefo = current.fefo || lot.id === fefoLot?.id;
      } else {
        grouped.set(key, {
          key,
          expiresOn: lot.expiresOn,
          quantity: lot.quantity,
          state,
          fefo: lot.id === fefoLot?.id,
        });
      }
    }

    return Array.from(grouped.values()).sort((left, right) =>
      (left.expiresOn || '9999-12-31').localeCompare(right.expiresOn || '9999-12-31')
    );
  }, [depotLots, fefoLot]);

  const selectMaterial = (material: WarehouseMaterial) => {
    setSelectedMaterialId(material.id);
    setQuery(material.description);
  };

  if (data.loading && !data.depots.length) {
    return (
      <div className={styles.scene} data-testid="warehouse-home-operational">
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.texture} aria-hidden="true" />
        <div className="flex min-h-[620px] items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-300/70" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-blue-100/60">
              Preparando central visual
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      className={styles.scene}
      data-testid="warehouse-home-operational"
      aria-label="Início ADM Depósito"
    >
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.texture} aria-hidden="true" />
      <div className={styles.floorGrid} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTopLeft}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTopRight}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBottomLeft}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBottomRight}`} aria-hidden="true" />

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            <Sparkles className="h-3.5 w-3.5" />
            EMPROVEX · ADM DEPÓSITO · LOCALIZAÇÃO VISUAL
          </p>
          <h1 className={styles.title}>Encontre o material dentro do depósito.</h1>
          <p className={styles.subtitle}>
            Pesquise um item, selecione o depósito e veja imediatamente sua posição na Visão 3D,
            com saldo e validade. O Início consulta; as demais abas continuam responsáveis por
            alocação, saída, manutenção e estrutura física.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void reload()}
          disabled={data.loading}
          className={styles.refresh}
        >
          <RefreshCw className={data.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Atualizar
        </button>
      </header>

      {data.error && (
        <div className="relative z-10 mx-6 mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-100">
          {data.error}
        </div>
      )}

      <div className={styles.workspace}>
        <aside className={styles.side}>
          <div className={`${styles.glassCard} ${styles.searchCard}`}>
            <label className={styles.label}>Consultar material</label>
            <div className={styles.inputWrap}>
              <Search className={styles.inputIcon} />
              <input
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  if (!selectedMaterial || nextQuery !== selectedMaterial.description) {
                    setSelectedMaterialId('');
                  }
                }}
                placeholder="Descrição ou código interno"
                className={styles.input}
                data-testid="warehouse-home-material-search"
              />

              {query.trim() && !selectedMaterial && materialMatches.length > 0 && (
                <div className={styles.results}>
                  {materialMatches.map((material) => (
                    <button
                      key={material.id}
                      type="button"
                      onClick={() => selectMaterial(material)}
                      className={styles.resultButton}
                    >
                      <span className={styles.resultTitle}>{material.description}</span>
                      <span className={styles.resultMeta}>{material.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className={`${styles.label} mt-4 block`}>Depósito</label>
            <select
              value={selectedDepotId}
              onChange={(event) => setSelectedDepotId(event.target.value)}
              className={styles.select}
              data-testid="warehouse-home-depot-select"
            >
              {!activeDepots.length && <option value="">Nenhum depósito cadastrado</option>}
              {activeDepots.map(({ depot }) => (
                <option key={depot.id} value={depot.id}>
                  {depot.code} · {depot.name}
                </option>
              ))}
            </select>
          </div>

          {selectedMaterial ? (
            <div className={`${styles.glassCard} ${styles.itemCard}`}>
              <div className={styles.itemHeading}>
                <span className={styles.itemIcon}>
                  <Box className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className={styles.label}>Item localizado</p>
                  <h2 className={styles.itemTitle}>{selectedMaterial.description}</h2>
                  <p className={styles.itemMeta}>{selectedMaterial.id}</p>
                </div>
              </div>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <p className={styles.metricLabel}>Saldo total</p>
                  <p className={styles.metricValue}>{formatQuantity(totalQuantity)}</p>
                  <p className={styles.metricUnit}>{unitLabel(selectedMaterial)}</p>
                </div>
                <div className={`${styles.metric} ${styles.metricBlue}`}>
                  <p className={styles.metricLabel}>Neste depósito</p>
                  <p className={styles.metricValue}>{formatQuantity(depotQuantity)}</p>
                  <p className={styles.metricUnit}>{locationRows.length} posição(ões)</p>
                </div>
              </div>

              <div className={styles.sectionBlock}>
                <p className={styles.sectionTitle}>
                  <LocateFixed className="h-3.5 w-3.5" />
                  Localização física
                </p>
                <div className={styles.rowList}>
                  {locationRows.length ? locationRows.slice(0, 6).map((row) => (
                    <div key={row.id} className={styles.infoRow}>
                      <div className={styles.infoPrimary}>
                        <p className={styles.infoName}>{row.label}</p>
                        <p className={styles.infoSub}>
                          {row.name}
                          {!row.represented ? ' · fora da visão atual' : ''}
                        </p>
                      </div>
                      <p className={styles.infoValue}>{formatQuantity(row.quantity)}</p>
                    </div>
                  )) : (
                    <p className={styles.emptyText}>
                      Este item não possui saldo posicionado no depósito selecionado.
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.sectionBlock}>
                <p className={styles.sectionTitle}>
                  <CalendarClock className="h-3.5 w-3.5" />
                  Validade / FEFO
                </p>
                <div className={styles.rowList}>
                  {lotsLoading ? (
                    <p className={styles.emptyText}>Consultando validades…</p>
                  ) : validityRows.length ? validityRows.slice(0, 5).map((row) => (
                    <div key={row.key} className={styles.infoRow}>
                      <div className={styles.infoPrimary}>
                        <p className={styles.infoName}>{dateLabel(row.expiresOn)}</p>
                        <p className={styles.infoSub}>
                          {formatQuantity(row.quantity)} {unitLabel(selectedMaterial)}
                          {row.fefo ? ' · prioridade FEFO' : ''}
                        </p>
                      </div>
                      <span className={`${styles.state} ${validityStateClass(row.state)}`}>
                        {expiryLabel[row.state]}
                      </span>
                    </div>
                  )) : (
                    <p className={styles.emptyText}>
                      Nenhuma validade informada para o saldo deste depósito.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`${styles.glassCard} ${styles.emptyCard}`}>
              <PackageSearch className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>Pesquise um item para localizar</p>
              <p className={styles.emptyText}>
                A Visão 3D destacará a estrutura física correta sem criar outra fonte de estoque.
              </p>
            </div>
          )}
        </aside>

        <div className={styles.visual}>
          <div className={styles.visualFrame}>
            <div className={styles.visualHeader}>
              <div>
                <p className={styles.visualTitle}>
                  {selectedDepot ? selectedDepot.name : 'Visão do depósito'}
                </p>
                <p className={styles.visualMeta}>
                  Visão 3D oficial · leitura do croqui ativo e do saldo físico
                </p>
              </div>
              <span className={styles.liveBadge}>
                <i className={styles.liveDot} />
                consulta operacional
              </span>
            </div>

            <div className={styles.viewport}>
              {layoutLoading ? (
                <div className={styles.noLayout}>
                  <div className={styles.noLayoutInner}>
                    <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-300/60" />
                    <p className={styles.noLayoutTitle}>Carregando Visão 3D</p>
                  </div>
                </div>
              ) : activeLayout ? (
                <WarehouseIsometricPreview
                  logicalWidth={activeLayout.logicalWidth}
                  logicalHeight={activeLayout.logicalHeight}
                  objects={activeLayout.objects}
                  locations={previewLocations}
                  balances={previewBalances}
                  materials={data.materials}
                  selectedMaterialId={selectedMaterialId}
                  queryText={query}
                  onQueryTextChange={setQuery}
                  onSelectedMaterialIdChange={setSelectedMaterialId}
                  embedded
                />
              ) : (
                <div className={styles.noLayout}>
                  <div className={styles.noLayoutInner}>
                    <Warehouse className="mx-auto h-10 w-10 text-blue-200/30" />
                    <h3 className={styles.noLayoutTitle}>Visão 3D ainda não configurada</h3>
                    <p className={styles.noLayoutText}>
                      O depósito continua operando normalmente. Configure o croqui em Meus Depósitos
                      para transformar esta área no localizador visual do estoque.
                    </p>
                    <Link
                      href="/adm-deposito/meus-depositos?aba=croquis"
                      className={styles.configureLink}
                    >
                      <LocateFixed className="h-4 w-4" />
                      Configurar visão
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.statusBar}>
            <div className={styles.statusMain}>
              <MapPin className="h-3.5 w-3.5 text-blue-300/80" />
              {selectedMaterial
                ? locationRows.length
                  ? locationRows.length + ' posição(ões) física(s) encontrada(s) neste depósito'
                  : 'Material sem posição física neste depósito'
                : 'Selecione um material para acender sua localização na Visão 3D'}
            </div>
            <Link
              href="/adm-deposito/meus-depositos?aba=croquis"
              className={styles.editLink}
            >
              Editar estrutura em Meus Depósitos
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
