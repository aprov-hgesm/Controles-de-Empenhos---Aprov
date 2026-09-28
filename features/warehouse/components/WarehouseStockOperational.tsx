'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Barcode,
  Boxes,
  CalendarClock,
  ChevronRight,
  FileText,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  deriveUnassignedQuantity,
  warehouseStockPositionKey,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from '../../../lib/warehouse/location';
import type { WarehouseBarcodeAssociation } from '../../../lib/warehouse/barcode';
import {
  listWarehouseBarcodes,
  replaceWarehouseBarcodeAssociation,
  saveWarehouseBarcodeAssociation,
  type WarehouseBarcodeListItem,
} from '../../../lib/warehouse/barcodeRepository';
import {
  buildWarehousePositionLabel,
  createWarehouseTransferIdempotencyKey,
  listWarehouseDepots,
  listWarehouseLocationBalances,
  listWarehouseLocations,
  transferWarehouseStock,
  type WarehouseDepotListItem,
  type WarehouseLocationBalanceListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  buildWarehouseLogisticsPendencies,
  selectWarehouseFefoLot,
  warehouseLotExpiryState,
  warehouseLotOriginLabel,
  WAREHOUSE_LOT_SCHEMA_VERSION,
  type WarehouseLot,
  type WarehouseLotOrigin,
} from '../../../lib/warehouse/lot';
import {
  createWarehouseLot,
  listWarehouseLots,
  updateWarehouseLot,
  type WarehouseLotListItem,
} from '../../../lib/warehouse/lotRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseBalance } from '../../../lib/warehouse/movement';
import {
  listWarehousePositiveBalances,
  listWarehouseMovementsForMaterial,
  type WarehouseMovementListItem,
} from '../../../lib/warehouse/ledgerRepository';
import {
  compareWarehouseStockAvailability,
  hasWarehouseAvailableStock,
  matchesWarehouseExpiryState,
  type WarehouseStockExpiryFilter,
} from '../../../lib/warehouse/stockView';

interface WarehouseStockState {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  balances: WarehouseBalance[];
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  locationBalances: WarehouseLocationBalanceListItem[];
  lots: WarehouseLotListItem[];
  barcodes: WarehouseBarcodeListItem[];
}

interface MaterialSummary {
  material: WarehouseMaterial;
  balance: WarehouseBalance;
  locationBalances: WarehouseLocationBalance[];
  lots: WarehouseLot[];
  availableLots: WarehouseLot[];
  barcodes: string[];
  barcodeAssociations: WarehouseBarcodeAssociation[];
  unassigned: number;
  distributed: number;
  locationLabels: string[];
  fefo: WarehouseLot | null;
  pendencies: ReturnType<typeof buildWarehouseLogisticsPendencies>;
  nearestExpiry: string | null;
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function numberLabel(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function dateLabel(value: string | null): string {
  if (!value) return 'não informada';
  const [year, month, day] = value.split('-');
  return day + '/' + month + '/' + year;
}

function lotStateLabel(lot: WarehouseLot): string {
  const state = warehouseLotExpiryState(lot);
  if (state === 'EXPIRED') return 'Vencido';
  if (state === 'NEAR_EXPIRY') return 'Próximo do vencimento';
  if (state === 'NO_EXPIRY') return 'Sem validade';
  if (state === 'DEPLETED') return 'Sem saldo atribuído';
  if (state === 'INACTIVE') return 'Inativo';
  return 'Válido';
}

function lotStateClass(lot: WarehouseLot): string {
  const state = warehouseLotExpiryState(lot);
  if (state === 'EXPIRED') return 'border-rose-300/15 bg-rose-400/[0.06] text-rose-200';
  if (state === 'NEAR_EXPIRY') return 'border-amber-300/15 bg-amber-400/[0.06] text-amber-200';
  if (state === 'VALID') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function logisticsMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_LOT_QUANTITY_EXCEEDS_LOCATION')) {
    return 'A quantidade do lote excede o saldo da posição selecionada.';
  }
  if (raw.includes('WAREHOUSE_LOT_QUANTITY_EXCEEDS_BALANCE')) {
    return 'A quantidade do lote excede o saldo oficial do material.';
  }
  if (raw.includes('WAREHOUSE_LOT_POSITION_WITHOUT_STOCK')) {
    return 'A posição selecionada não possui saldo desse material.';
  }
  if (raw.includes('WAREHOUSE_INVALID_LOT')) {
    return 'Os dados do lote não passaram pela validação do contrato logístico.';
  }
  return raw;
}

function positionFromKey(
  key: string,
  positions: Map<string, WarehouseStockPosition>
): WarehouseStockPosition {
  return positions.get(key) || { kind: 'UNASSIGNED' };
}

export function WarehouseStockOperational({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [state, setState] = useState<WarehouseStockState>({
    loading: true,
    error: null,
    materials: [],
    balances: [],
    depots: [],
    locations: [],
    locationBalances: [],
    lots: [],
    barcodes: [],
  });
  const [queryText, setQueryText] = useState('');
  const [depotFilter, setDepotFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [expiryStatusFilter, setExpiryStatusFilter] =
    useState<WarehouseStockExpiryFilter>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [movements, setMovements] = useState<WarehouseMovementListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [locateOpen, setLocateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [editingLotId, setEditingLotId] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [lotExpiry, setLotExpiry] = useState('');
  const [lotQuantity, setLotQuantity] = useState('');
  const [lotPositionKey, setLotPositionKey] = useState('UNASSIGNED');
  const [lotOriginMovementId, setLotOriginMovementId] = useState('');

  const [barcodeDraft, setBarcodeDraft] = useState('');
  const [editingBarcodeId, setEditingBarcodeId] = useState('');
  const [relocateSourceKey, setRelocateSourceKey] = useState('');
  const [relocateDepotId, setRelocateDepotId] = useState('');
  const [relocateLocationId, setRelocateLocationId] = useState('');
  const [relocateSubpositionId, setRelocateSubpositionId] = useState('');

  const refresh = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [materials, balances, depots, locations, locationBalances, lots, barcodes] =
        await Promise.all([
          listWarehouseMaterials(workspaceId, 250),
          listWarehousePositiveBalances(workspaceId, 250),
          listWarehouseDepots(workspaceId, 250),
          listWarehouseLocations(workspaceId, 500),
          listWarehouseLocationBalances(workspaceId, 500),
          listWarehouseLots(workspaceId, 500),
          listWarehouseBarcodes(workspaceId, 500),
        ]);
      setState({
        loading: false,
        error: null,
        materials,
        balances,
        depots,
        locations,
        locationBalances,
        lots,
        barcodes,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: logisticsMessage(error),
      }));
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  useEffect(() => {
    setBarcodeDraft('');
    setEditingBarcodeId('');
    setRelocateSourceKey('');
    setRelocateDepotId('');
    setRelocateLocationId('');
    setRelocateSubpositionId('');
  }, [selectedMaterialId]);

  useEffect(() => {
    if (!selectedMaterialId) {
      setMovements([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    void listWarehouseMovementsForMaterial(workspaceId, selectedMaterialId, 50)
      .then((next) => {
        if (active) setMovements(next);
      })
      .catch((error) => {
        if (active) setMessage(logisticsMessage(error));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedMaterialId, workspaceId]);

  const materialById = useMemo(
    () => new Map(state.materials.map((material) => [material.id, material])),
    [state.materials]
  );

  const locationBalancesByMaterial = useMemo(() => {
    const index = new Map<string, typeof state.locationBalances>();
    for (const item of state.locationBalances) {
      const current = index.get(item.balance.materialId);
      if (current) current.push(item);
      else index.set(item.balance.materialId, [item]);
    }
    return index;
  }, [state.locationBalances]);

  const lotsByMaterial = useMemo(() => {
    const index = new Map<string, typeof state.lots>();
    for (const item of state.lots) {
      const current = index.get(item.lot.materialId);
      if (current) current.push(item);
      else index.set(item.lot.materialId, [item]);
    }
    return index;
  }, [state.lots]);

  const barcodesByMaterial = useMemo(() => {
    const index = new Map<string, typeof state.barcodes>();
    for (const item of state.barcodes) {
      const current = index.get(item.association.materialId);
      if (current) current.push(item);
      else index.set(item.association.materialId, [item]);
    }
    return index;
  }, [state.barcodes]);


  const activeDepots = useMemo(
    () => state.depots.filter(({ depot }) => depot.status === 'active'),
    [state.depots]
  );

  const activeDepotIds = useMemo(
    () => new Set(activeDepots.map(({ depot }) => depot.id)),
    [activeDepots]
  );

  const activeTopLevelLocations = useMemo(
    () => state.locations.filter(({ location }) =>
      location.status === 'active'
      && location.kind === 'LOCAL'
      && activeDepotIds.has(location.depotId)
    ),
    [activeDepotIds, state.locations]
  );

  const summaries = useMemo<MaterialSummary[]>(() => {
    return state.balances
      .filter((balance) => hasWarehouseAvailableStock(balance.quantity))
      .map((balance) => {
        const material = materialById.get(balance.materialId);
        if (!material) return null;
        const locationBalances = (locationBalancesByMaterial.get(balance.materialId) || [])
          .map((item) => item.balance);
        const physical = locationBalances.filter(
          (item) => item.position.kind !== 'UNASSIGNED'
        );
        let unassigned = 0;
        try {
          unassigned = Math.max(
            0,
            deriveUnassignedQuantity(balance.quantity, physical)
          );
        } catch {
          unassigned = 0;
        }
        const lots = (lotsByMaterial.get(balance.materialId) || [])
          .map((item) => item.lot);
        const availableLots = lots.filter(
          (lot) => lot.status === 'active' && lot.quantity > 0
        );
        const barcodeAssociations = (barcodesByMaterial.get(balance.materialId) || [])
          .map((item) => item.association);
        const barcodes = barcodeAssociations
          .filter((association) => association.status === 'active')
          .map((association) => association.barcode);
        const locationLabels = Array.from(
          new Set([
            ...physical
              .filter((item) => item.quantity > 0)
              .map((item) =>
                buildWarehousePositionLabel(
                  item.position,
                  state.depots,
                  state.locations
                )
              ),
            ...(unassigned > 0 ? ['Sem localização'] : []),
          ])
        );
        const fefo = selectWarehouseFefoLot(availableLots);
        const nearestExpiry =
          availableLots
            .filter((lot) => lot.expiresOn)
            .map((lot) => lot.expiresOn as string)
            .sort()[0] || null;
        return {
          material,
          balance,
          locationBalances,
          lots,
          availableLots,
          barcodes,
          barcodeAssociations,
          unassigned,
          distributed: Math.max(0, balance.quantity - unassigned),
          locationLabels,
          fefo,
          nearestExpiry,
          pendencies: buildWarehouseLogisticsPendencies({
            materialId: material.id,
            totalQuantity: balance.quantity,
            locationBalances,
            lots,
          }),
        };
      })
      .filter((item): item is MaterialSummary => Boolean(item));
  }, [
    barcodesByMaterial,
    locationBalancesByMaterial,
    lotsByMaterial,
    materialById,
    state.balances,
    state.depots,
    state.locations,
  ]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(queryText);
    return summaries.filter((summary) => {
      const locationRows = summary.locationBalances.filter(
        (item) => item.quantity > 0
      );
      if (
        depotFilter
        && !locationRows.some(
          (item) =>
            item.position.kind !== 'UNASSIGNED'
            && item.position.depotId === depotFilter
        )
      ) {
        return false;
      }
      if (
        locationFilter
        && !locationRows.some((item) =>
          item.position.kind !== 'UNASSIGNED'
          && item.position.locationId === locationFilter
        )
      ) {
        return false;
      }
      if (
        !matchesWarehouseExpiryState(
          summary.availableLots.map((lot) => warehouseLotExpiryState(lot)),
          expiryStatusFilter
        )
      ) {
        return false;
      }
      if (!q) return true;

      const origins = summary.lots.flatMap((lot) => [
        lot.origin.invoiceId || '',
        lot.origin.supplier || '',
        lot.origin.supplierCnpj || '',
      ]);
      const haystack = normalizeSearch(
        [
          summary.material.id,
          summary.material.description,
          ...summary.material.aliases,
          ...summary.barcodes,
          ...summary.locationLabels,
          ...summary.lots.flatMap((lot) => [
            lot.id,
            lot.code,
            lot.expiresOn || '',
          ]),
          ...origins,
        ].join(' ')
      );
      return haystack.includes(q);
    }).sort(compareWarehouseStockAvailability);
  }, [depotFilter, expiryStatusFilter, locationFilter, queryText, summaries]);

  const selected = summaries.find(
    (item) => item.material.id === selectedMaterialId
  ) || null;

  const positions = useMemo(() => {
    const next = new Map<string, WarehouseStockPosition>();
    next.set('UNASSIGNED', { kind: 'UNASSIGNED' });
    if (!selected) return next;
    for (const item of selected.locationBalances) {
      if (item.quantity <= 0) continue;
      next.set(warehouseStockPositionKey(item.position), item.position);
    }
    return next;
  }, [selected]);

  useEffect(() => {
    if (!positions.has(lotPositionKey)) setLotPositionKey('UNASSIGNED');
  }, [lotPositionKey, positions]);

  const invoiceMovements = useMemo(
    () =>
      movements.filter(
        (item) => item.movement.source?.kind === 'INVOICE'
      ),
    [movements]
  );

  const resetLotForm = () => {
    setEditingLotId('');
    setLotCode('');
    setLotExpiry('');
    setLotQuantity('');
    setLotPositionKey('UNASSIGNED');
    setLotOriginMovementId('');
  };

  const resetBarcodeForm = () => {
    setBarcodeDraft('');
    setEditingBarcodeId('');
  };

  const editBarcode = (association: WarehouseBarcodeAssociation) => {
    setEditingBarcodeId(association.id);
    setBarcodeDraft(association.barcode);
    setMessage(null);
  };

  const editLot = (lot: WarehouseLot) => {
    setEditingLotId(lot.id);
    setLotCode(lot.code);
    setLotExpiry(lot.expiresOn || '');
    setLotQuantity(String(lot.quantity));
    setLotPositionKey(warehouseStockPositionKey(lot.position));
    setLotOriginMovementId(
      lot.origin.kind === 'INVOICE' ? lot.origin.movementId || '' : ''
    );
    setMessage(null);
  };

  const buildOrigin = (): WarehouseLotOrigin => {
    const movement = invoiceMovements.find(
      (item) => item.movement.id === lotOriginMovementId
    )?.movement;
    const source = movement?.source;
    if (movement && source?.kind === 'INVOICE') {
      return {
        kind: 'INVOICE',
        movementId: movement.id,
        invoiceRecordKey: source.invoiceRecordKey,
        invoiceId: source.invoiceId,
        supplier: source.supplier,
        supplierCnpj: source.supplierCnpj,
      };
    }
    return {
      kind: 'MANUAL_ENRICHMENT',
      movementId: null,
      invoiceRecordKey: null,
      invoiceId: null,
      supplier: null,
      supplierCnpj: null,
    };
  };

  const saveLot = async () => {
    if (!selected) return;
    const quantity = Number(lotQuantity.replace(',', '.'));
    if (!lotCode.trim() || !Number.isFinite(quantity) || quantity < 0) {
      setMessage('Informe código do lote e quantidade válida.');
      return;
    }

    setWorking(true);
    setMessage(null);
    try {
      const position = positionFromKey(lotPositionKey, positions);
      if (editingLotId) {
        await updateWarehouseLot(workspaceId, editingLotId, {
          code: lotCode,
          expiresOn: lotExpiry || null,
          quantity,
          position,
          origin: buildOrigin(),
        });
        setMessage('Lote atualizado sem alterar o saldo oficial.');
      } else {
        await createWarehouseLot(workspaceId, {
          materialId: selected.material.id,
          code: lotCode,
          expiresOn: lotExpiry || null,
          quantity,
          position,
          origin: buildOrigin(),
        });
        setMessage('Lote registrado como enriquecimento logístico do estoque existente.');
      }
      resetLotForm();
      await refresh();
    } catch (error) {
      setMessage(logisticsMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const saveBarcode = async () => {
    if (!selected) return;
    const barcode = barcodeDraft.trim();
    if (!barcode) {
      setMessage('Informe o código de barras.');
      return;
    }

    setWorking(true);
    setMessage(null);
    try {
      if (editingBarcodeId) {
        await replaceWarehouseBarcodeAssociation(
          workspaceId,
          editingBarcodeId,
          barcode
        );
        setMessage('Código de barras atualizado com histórico preservado.');
      } else {
        await saveWarehouseBarcodeAssociation(workspaceId, {
          materialId: selected.material.id,
          barcode,
          presentation: selected.material.unit,
        });
        setMessage('Código de barras associado ao item.');
      }
      resetBarcodeForm();
      await refresh();
    } catch (error) {
      setMessage(logisticsMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const selectedLocations = selected
    ? selected.locationBalances
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          key: warehouseStockPositionKey(item.position),
          label: buildWarehousePositionLabel(
            item.position,
            state.depots,
            state.locations
          ),
          quantity: item.quantity,
          position: item.position,
        }))
    : [];

  const relocationSources = selected
    ? [
        ...selectedLocations,
        ...(selected.unassigned > 0
          ? [{
              key: 'UNASSIGNED',
              label: 'Sem localização',
              quantity: selected.unassigned,
              position: { kind: 'UNASSIGNED' } as WarehouseStockPosition,
            }]
          : []),
      ]
    : [];

  const relocationLocations = activeTopLevelLocations.filter(
    ({ location }) => location.depotId === relocateDepotId
  );

  const relocationSubpositions = state.locations.filter(({ location }) =>
    location.status === 'active'
    && location.kind === 'SUBPOSITION'
    && location.depotId === relocateDepotId
    && location.parentLocationId === relocateLocationId
  );

  const relocateSelectedStock = async () => {
    if (!selected) return;
    const source = relocationSources.find((item) => item.key === relocateSourceKey);
    if (!source) {
      setMessage('Selecione a localidade atual do saldo que será movimentado.');
      return;
    }
    if (!relocateDepotId || !relocateLocationId) {
      setMessage('Selecione o depósito e a localização de destino.');
      return;
    }

    const to: WarehouseStockPosition = relocateSubpositionId
      ? {
          kind: 'SUBPOSITION',
          depotId: relocateDepotId,
          locationId: relocateLocationId,
          subpositionId: relocateSubpositionId,
        }
      : {
          kind: 'LOCATION',
          depotId: relocateDepotId,
          locationId: relocateLocationId,
          subpositionId: null,
        };

    if (warehouseStockPositionKey(to) === source.key) {
      setMessage('A nova localidade precisa ser diferente da posição atual.');
      return;
    }

    const relocateLotIds = selected.availableLots
      .filter((lot) => warehouseStockPositionKey(lot.position) === source.key)
      .map((lot) => lot.id);

    setWorking(true);
    setMessage(null);
    try {
      await transferWarehouseStock(workspaceId, {
        materialId: selected.material.id,
        quantity: source.quantity,
        from: source.position,
        to,
        relocateLotIds,
        idempotencyKey: createWarehouseTransferIdempotencyKey(),
        note: 'Alteração de localidade pela ficha do material em Controle de Itens',
      });
      setRelocateSourceKey('');
      setRelocateDepotId('');
      setRelocateLocationId('');
      setRelocateSubpositionId('');
      setMessage(
        'Localidade atualizada. O saldo inteiro da posição e os lotes ativos vinculados foram realocados.'
      );
      await refresh();
    } catch (error) {
      setMessage(logisticsMessage(error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="warehouse-stock-operational">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#00288e]/70">Saldo disponível</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Somente materiais com saldo oficial maior que zero são exibidos nesta visão.</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">Enriquecimento</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{WAREHOUSE_LOT_SCHEMA_VERSION} adiciona lote, validade, origem e posição sem gerar movimento.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-amber-700">Prioridade por validade</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">A lista coloca primeiro o material com a menor validade ativa; itens sem validade ficam ao final.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-800">
          <Search className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.12em]">Pesquisa operacional</p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_1fr_1fr_1fr_auto]">
          <input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            data-testid="warehouse-stock-search"
            aria-label="Pesquisar estoque"
            placeholder="Material, ID, lote, validade, NF, fornecedor ou localização"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#00288e] focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={depotFilter}
            onChange={(event) => {
              setDepotFilter(event.target.value);
              setLocationFilter('');
            }}
            aria-label="Filtrar por depósito"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e]"
          >
            <option value="">Todos os depósitos</option>
            {activeDepots.map(({ depot }) => (
              <option key={depot.id} value={depot.id}>{depot.code} · {depot.name}</option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            aria-label="Filtrar por localização"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e]"
          >
            <option value="">Todas as localizações</option>
            {activeTopLevelLocations
              .filter(({ location }) => !depotFilter || location.depotId === depotFilter)
              .map(({ location }) => (
                <option key={location.id} value={location.id}>{location.code} · {location.name}</option>
              ))}
          </select>
          <select
            value={expiryStatusFilter}
            onChange={(event) =>
              setExpiryStatusFilter(event.target.value as WarehouseStockExpiryFilter)
            }
            aria-label="Filtrar por estado de validade"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e]"
          >
            <option value="">Todas as validades</option>
            <option value="NEAR_EXPIRY">Próximo do vencimento</option>
            <option value="EXPIRED">Vencido</option>
            <option value="VALID">Válido</option>
            <option value="NO_EXPIRY">Sem validade informada</option>
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={state.loading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-500 hover:border-blue-200 hover:text-[#00288e]"
            aria-label="Atualizar estoque"
          >
            <RefreshCw className={state.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
          </button>
        </div>
      </div>

      {state.loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Consultando estoque, distribuição física e lotes…</div>
      ) : state.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{state.error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Nenhum material corresponde aos filtros informados.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-[10px] font-bold text-slate-500">
              {filtered.length} material(is) com saldo disponível
            </p>
            <p className="text-[10px] font-bold text-[#00288e]">
              Ordem: menor validade primeiro
            </p>
          </div>
          {filtered.map((summary) => (
            <button
              type="button"
              key={summary.material.id}
              data-testid={'warehouse-stock-row-' + summary.material.id}
              onClick={() => {
                setSelectedMaterialId(summary.material.id);
                setLocateOpen(false);
                resetLotForm();
                setMessage(null);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-left transition hover:border-blue-300/15 hover:bg-blue-400/[0.025]"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_0.55fr_0.65fr_0.65fr_minmax(0,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{summary.material.description}</p>
                  <p className="mt-1 truncate font-mono text-[9px] text-slate-600">{summary.material.id}</p>
                  <p className="mt-1 truncate text-[9px] text-slate-600">
                    {summary.locationLabels.length > 0
                      ? summary.locationLabels.slice(0, 2).join(' · ')
                      : 'sem posição física materializada'}
                  </p>
                  {summary.lots.some((lot) => lot.origin.kind === 'INVOICE') && (
                    <p className="mt-1 truncate text-[9px] text-[#00288e]/65">
                      {warehouseLotOriginLabel(
                        summary.lots.find((lot) => lot.origin.kind === 'INVOICE')!
                          .origin
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Saldo total</p>
                  <p className="mt-1 text-base font-black text-emerald-700">
                    {numberLabel(summary.balance.quantity)}{' '}
                    <span className="text-[10px] font-bold text-emerald-600">
                      {summary.material.unit.label || summary.material.unit.code}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Distribuído</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{numberLabel(summary.distributed)}</p>
                  <p className="text-[9px] text-slate-600">{numberLabel(summary.unassigned)} sem localização</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Lotes</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{summary.availableLots.length}</p>
                  <p className="text-[9px] text-slate-600">próxima {dateLabel(summary.nearestExpiry)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">FEFO / pendências</p>
                  <p className="mt-1 truncate text-xs font-bold text-[#00288e]">
                    {summary.fefo ? summary.fefo.code + ' · ' + dateLabel(summary.fefo.expiresOn) : 'sem recomendação FEFO'}
                  </p>
                  <p className="mt-1 text-[9px] text-slate-600">{summary.pendencies.length} pendência(s) logística(s)</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6" data-testid="warehouse-material-sheet">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#00288e]/65">Ficha do material</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">{selected.material.description}</h3>
              <p className="mt-1 font-mono text-[9px] text-slate-600">{selected.material.id} · {selected.material.unit.label || selected.material.unit.code}</p>
              <div data-testid="warehouse-material-barcodes" className="mt-2 flex flex-wrap gap-1.5">
                {selected.barcodes.length > 0 ? selected.barcodes.map((barcode) => (
                  <span key={barcode} className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[9px] text-[#00288e]">
                    {barcode}
                  </span>
                )) : (
                  <span className="text-[10px] text-slate-600">Nenhum código de barras associado.</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMaterialId('')}
              className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-[#00288e]"
            >
              Fechar ficha
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Saldo agregado</p>
              <p className="mt-2 text-2xl font-black text-emerald-700">{numberLabel(selected.balance.quantity)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Distribuição física</p>
              <p className="mt-2 text-sm font-black text-slate-800">{numberLabel(selected.distributed)} localizado</p>
              <p className="mt-1 text-[10px] text-slate-600">{numberLabel(selected.unassigned)} sem localização</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Lotes rastreados</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{selected.lots.length}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4" data-testid="warehouse-fefo-recommendation">
              <p className="text-[9px] uppercase tracking-[0.12em] text-[#00288e]/70">Recomendação FEFO</p>
              <p className="mt-2 text-sm font-black text-[#00288e]">{selected.fefo?.code || 'Sem lote elegível'}</p>
              <p className="mt-1 text-[10px] text-slate-500">{selected.fefo ? 'validade ' + dateLabel(selected.fefo.expiresOn) : 'nenhuma saída é executada automaticamente'}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
                    <p className="text-xs font-black text-slate-800">Localização física</p>
                  </div>
                  <button
                    type="button"
                    data-testid="warehouse-locate-in-depot"
                    onClick={() => setLocateOpen((current) => !current)}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#00288e]"
                  >
                    Localizar no depósito
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {selectedLocations.length === 0 && selected.unassigned <= 0 ? (
                    <p className="text-xs text-slate-500">Nenhuma posição materializada.</p>
                  ) : (
                    <>
                      {selectedLocations.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <span className="text-xs font-bold text-slate-700">{item.label}</span>
                          <span className="text-xs text-slate-500">{numberLabel(item.quantity)}</span>
                        </div>
                      ))}
                      {selected.unassigned > 0 && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                          <span className="text-xs font-bold text-amber-800">Sem localização</span>
                          <span className="text-xs text-amber-700">{numberLabel(selected.unassigned)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4" data-testid="warehouse-item-relocation">
                  <div className="flex items-center gap-2 text-[#00288e]">
                    <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                    <p className="text-[10px] font-black uppercase tracking-[0.12em]">
                      Alterar localidade
                    </p>
                  </div>
                  <p className="mt-2 text-[10px] leading-5 text-slate-600">
                    Move integralmente o saldo da posição selecionada. O movimento é registrado
                    como TRANSFER e os lotes ativos daquela posição acompanham a nova localidade.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                        Localidade atual
                      </span>
                      <select
                        value={relocateSourceKey}
                        onChange={(event) => setRelocateSourceKey(event.target.value)}
                        data-testid="warehouse-relocate-source"
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e]"
                      >
                        <option value="">Selecione a posição atual</option>
                        {relocationSources.map((source) => (
                          <option key={source.key} value={source.key}>
                            {source.label} · {numberLabel(source.quantity)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                        Novo depósito
                      </span>
                      <select
                        value={relocateDepotId}
                        onChange={(event) => {
                          setRelocateDepotId(event.target.value);
                          setRelocateLocationId('');
                          setRelocateSubpositionId('');
                        }}
                        data-testid="warehouse-relocate-depot"
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e]"
                      >
                        <option value="">Selecione o depósito</option>
                        {activeDepots.map(({ depot }) => (
                          <option key={depot.id} value={depot.id}>
                            {depot.code} · {depot.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                        Nova localização
                      </span>
                      <select
                        value={relocateLocationId}
                        onChange={(event) => {
                          setRelocateLocationId(event.target.value);
                          setRelocateSubpositionId('');
                        }}
                        disabled={!relocateDepotId}
                        data-testid="warehouse-relocate-location"
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e] disabled:opacity-50"
                      >
                        <option value="">Selecione a localização</option>
                        {relocationLocations.map(({ location }) => (
                          <option key={location.id} value={location.id}>
                            {location.code} · {location.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="sm:col-span-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                        Subposição · opcional
                      </span>
                      <select
                        value={relocateSubpositionId}
                        onChange={(event) => setRelocateSubpositionId(event.target.value)}
                        disabled={!relocateLocationId}
                        data-testid="warehouse-relocate-subposition"
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e] disabled:opacity-50"
                      >
                        <option value="">Sem subposição específica</option>
                        {relocationSubpositions.map(({ location }) => (
                          <option key={location.id} value={location.id}>
                            {location.code} · {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => void relocateSelectedStock()}
                    disabled={working || !relocateSourceKey || !relocateDepotId || !relocateLocationId}
                    data-testid="warehouse-relocate-save"
                    className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm hover:bg-[#001f6f] disabled:opacity-40"
                  >
                    {working
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      : <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />}
                    Alterar localidade
                  </button>
                </div>

                {locateOpen && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3" data-testid="warehouse-location-highlight">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#00288e]/70">Contrato preparado para a FASE 9</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {selected.locationLabels.join(' · ') || 'Sem posição física definida'}. Os IDs técnicos de depósito/local/subposição já estão preservados; nenhum croqui foi antecipado.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="warehouse-lot-list">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
                  <p className="text-xs font-black text-slate-800">Lotes e validade</p>
                </div>
                {selected.lots.length === 0 ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">Nenhum lote foi enriquecido. Isso não bloqueia o saldo legado.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selected.lots
                      .slice()
                      .sort((a, b) => (a.expiresOn || '9999').localeCompare(b.expiresOn || '9999'))
                      .map((lot) => (
                        <div key={lot.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-black text-slate-800">{lot.code}</p>
                                <span className={'rounded-full border px-2 py-0.5 text-[9px] font-bold ' + lotStateClass(lot)}>{lotStateLabel(lot)}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-slate-500">validade {dateLabel(lot.expiresOn)} · qtd. {numberLabel(lot.quantity)}</p>
                              <p className="mt-1 text-[10px] text-slate-600">{buildWarehousePositionLabel(lot.position, state.depots, state.locations)} · {warehouseLotOriginLabel(lot.origin)}</p>
                            </div>
                            <button type="button" onClick={() => editLot(lot)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:border-blue-200 hover:text-[#00288e]">Editar</button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="warehouse-logistics-pendencies">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                  <p className="text-xs font-black text-amber-800">Pendências logísticas</p>
                </div>
                {selected.pendencies.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">Nenhuma pendência logística identificada nesta leitura.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selected.pendencies.map((item) => (
                      <div key={item.code} className="rounded-xl border border-amber-200 bg-white px-3 py-2">
                        <p className="text-xs font-bold text-slate-700">{item.title}</p>
                        <p className="mt-1 text-[10px] leading-5 text-slate-500">{item.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4" data-testid="warehouse-barcode-editor">
                <div className="flex items-center gap-2 text-[#00288e]">
                  <Barcode className="h-4 w-4" aria-hidden="true" />
                  <p className="text-xs font-black">Códigos de barras</p>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-slate-600">
                  Inclua um novo código ou substitua um código existente. Na edição, o código anterior
                  é inativado e preservado no histórico para não quebrar rastreabilidade.
                </p>

                <div className="mt-3 space-y-2">
                  {selected.barcodeAssociations
                    .filter((association) => association.status === 'active')
                    .map((association) => (
                      <div
                        key={association.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[10px] font-black text-slate-800">
                            {association.barcode}
                          </p>
                          <p className="mt-1 text-[9px] text-slate-500">
                            {association.presentation.label || association.presentation.code}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => editBarcode(association)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:border-blue-200 hover:text-[#00288e]"
                        >
                          Editar
                        </button>
                      </div>
                    ))}
                  {selected.barcodeAssociations.filter((association) => association.status === 'active').length === 0 && (
                    <p className="rounded-xl border border-dashed border-blue-200 bg-white px-3 py-3 text-[10px] text-slate-500">
                      Nenhum código de barras ativo.
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <input
                    value={barcodeDraft}
                    onChange={(event) => setBarcodeDraft(event.target.value)}
                    placeholder={editingBarcodeId ? 'Código de barras atualizado' : 'Adicionar código de barras'}
                    maxLength={128}
                    data-testid="warehouse-barcode-draft"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs font-bold text-slate-800 outline-none focus:border-[#00288e]"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveBarcode()}
                      disabled={working || !barcodeDraft.trim()}
                      data-testid="warehouse-barcode-save"
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white disabled:opacity-40"
                    >
                      {working
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : <Barcode className="h-3.5 w-3.5" aria-hidden="true" />}
                      {editingBarcodeId ? 'Salvar código' : 'Adicionar código'}
                    </button>
                    {editingBarcodeId && (
                      <button
                        type="button"
                        onClick={resetBarcodeForm}
                        disabled={working}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
                      >
                        Cancelar edição
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <p className="text-xs font-black text-emerald-800">{editingLotId ? 'Editar enriquecimento do lote' : 'Enriquecer com lote'}</p>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">Esta ação não gera entrada, saída ou transferência de estoque. Ela apenas associa informação logística ao saldo já existente.</p>

                <div className="mt-4 grid gap-3">
                  <input
                    value={lotCode}
                    onChange={(event) => setLotCode(event.target.value)}
                    data-testid="warehouse-lot-create-code"
                    aria-label="Código do lote"
                    placeholder="Código do lote"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#00288e]"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="date"
                      value={lotExpiry}
                      onChange={(event) => setLotExpiry(event.target.value)}
                      data-testid="warehouse-lot-create-expiry"
                      aria-label="Validade do lote"
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e]"
                    />
                    <input
                      inputMode="decimal"
                      value={lotQuantity}
                      onChange={(event) => setLotQuantity(event.target.value)}
                      data-testid="warehouse-lot-create-quantity"
                      aria-label="Quantidade rastreada no lote"
                      placeholder="Quantidade"
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#00288e]"
                    />
                  </div>
                  <select
                    value={lotPositionKey}
                    onChange={(event) => setLotPositionKey(event.target.value)}
                    data-testid="warehouse-lot-create-position"
                    aria-label="Posição do lote"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e]"
                  >
                    {Array.from(positions.entries()).map(([key, position]) => (
                      <option key={key} value={key}>
                        {buildWarehousePositionLabel(position, state.depots, state.locations)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={lotOriginMovementId}
                    onChange={(event) => setLotOriginMovementId(event.target.value)}
                    aria-label="Origem documental do lote"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#00288e]"
                  >
                    <option value="">Origem manual / legado</option>
                    {invoiceMovements.map(({ movement }) => {
                      const source = movement.source?.kind === 'INVOICE' ? movement.source : null;
                      return (
                        <option key={movement.id} value={movement.id}>
                          NF {source?.invoiceId || '—'} · {source?.supplier || 'Fornecedor'}
                        </option>
                      );
                    })}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveLot()}
                      disabled={working}
                      data-testid="warehouse-lot-save"
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-500/85 px-4 text-xs font-black text-white transition hover:bg-emerald-400 disabled:opacity-40"
                    >
                      {working ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Boxes className="h-3.5 w-3.5" aria-hidden="true" />}
                      {editingLotId ? 'Salvar lote' : 'Registrar lote'}
                    </button>
                    {editingLotId && (
                      <button type="button" onClick={resetLotForm} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600">Cancelar edição</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
                  <p className="text-xs font-black text-slate-800">Origem e histórico oficial</p>
                </div>
                <p className="mt-2 text-[10px] text-slate-600">Consulta sob demanda · até 50 movimentos do material</p>
                {historyLoading ? (
                  <p className="mt-3 text-xs text-slate-500">Carregando ledger…</p>
                ) : movements.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">Nenhum movimento encontrado no recorte consultado.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {movements.map(({ movement, createdAt }) => {
                      const source = movement.source;
                      const invoiceSource = source?.kind === 'INVOICE' ? source : null;
                      return (
                        <div key={movement.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-[9px] font-bold text-[#00288e]">{movement.type}</span>
                            <span className="text-[9px] text-slate-600">{createdAt ? new Date(createdAt).toLocaleString('pt-BR') : 'horário pendente'}</span>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {invoiceSource
                              ? 'NF ' + invoiceSource.invoiceId + ' · ' + invoiceSource.supplier
                              : movement.source?.kind === 'LOCATION_TRANSFER'
                                ? 'Transferência interna'
                                : movement.note || 'Movimento auditável'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-700" data-testid="warehouse-phase7-message">
              {message}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] leading-5 text-slate-500 shadow-sm">
        <div className="flex items-center gap-2 text-slate-500"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /><span>Consultas bounded: 250 materiais/saldos, 500 posições/lotes e histórico por material somente quando a ficha é aberta.</span></div>
        <div className="mt-1 flex items-center gap-2 text-slate-500"><PackageSearch className="h-3.5 w-3.5" aria-hidden="true" /><span>Código de barras e lotes enriquecem a consulta. A retirada física e a baixa de estoque são executadas exclusivamente na aba Saída de Material.</span></div>
      </div>
    </div>
  );
}
