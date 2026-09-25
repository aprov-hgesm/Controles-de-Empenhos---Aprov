'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Keyboard,
  PackageSearch,
  Plus,
  RefreshCw,
  ScanLine,
  Settings2,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';

import {
  findWarehouseBarcodeAssociation,
  type WarehouseBarcodeAssociation,
} from '../../../lib/warehouse/barcode';
import {
  listWarehouseBarcodes,
  saveWarehouseBarcodeAssociation,
  type WarehouseBarcodeListItem,
} from '../../../lib/warehouse/barcodeRepository';
import {
  deriveUnassignedQuantity,
  warehouseStockPositionKey,
  type WarehouseStockPosition,
} from '../../../lib/warehouse/location';
import {
  buildWarehousePositionLabel,
  listWarehouseDepots,
  listWarehouseLocationBalances,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationBalanceListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import { selectWarehouseFefoLot } from '../../../lib/warehouse/lot';
import {
  listWarehouseLots,
  type WarehouseLotListItem,
} from '../../../lib/warehouse/lotRepository';
import {
  warehouseMaterialUnitKey,
  type WarehouseMaterial,
  type WarehouseMaterialUnit,
} from '../../../lib/warehouse/material';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseBalance } from '../../../lib/warehouse/movement';
import { listWarehouseBalances } from '../../../lib/warehouse/ledgerRepository';
import {
  createWarehouseDestination,
  finalizeWarehouseMaterialWithdrawal,
  listWarehouseDestinations,
  setWarehouseDestinationStatus,
} from '../../../lib/warehouse/withdrawalRepository';
import {
  createWarehouseWithdrawalId,
  createWarehouseWithdrawalLineId,
  WAREHOUSE_WITHDRAWAL_MAX_LINES,
  type WarehouseDestinationListItem,
  type WarehouseWithdrawalLineInput,
} from '../../../lib/warehouse/withdrawal';
import { WarehouseConsumptionReports } from './WarehouseConsumptionReports';

type SurfaceTab = 'checkout' | 'reports';

interface CheckoutState {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  balances: WarehouseBalance[];
  barcodes: WarehouseBarcodeListItem[];
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  locationBalances: WarehouseLocationBalanceListItem[];
  lots: WarehouseLotListItem[];
  destinations: WarehouseDestinationListItem[];
}

interface CartLine extends WarehouseWithdrawalLineInput {
  factorToBaseUnit: number;
  availableAtPosition: number;
  availableBalance: number;
}

interface PresentationOption {
  key: string;
  unit: WarehouseMaterialUnit;
  factor: number;
  label: string;
}

interface PositionOption {
  key: string;
  position: WarehouseStockPosition;
  quantity: number;
  label: string;
}

interface PersistedDraft {
  withdrawalId: string;
  cart: CartLine[];
  destinationId: string;
  withdrawnBy: string;
  retryRequired: boolean;
}

function draftStorageKey(workspaceId: string): string {
  return 'emprovex:warehouse:material-withdrawal:v1:' + workspaceId;
}

function numberLabel(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function unitLabel(unit: WarehouseMaterialUnit): string {
  return unit.label || unit.code;
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function normalizedQuantity(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const mappings: Array<[string, string]> = [
    ['WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK', 'O saldo oficial mudou e não comporta uma das linhas. A retirada permaneceu não finalizada e pode ser retomada.'],
    ['WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK', 'A posição física perdeu saldo antes da finalização. A retirada não foi marcada como concluída.'],
    ['WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION', 'O lote selecionado já não possui quantidade suficiente.'],
    ['WAREHOUSE_BARCODE_CHANGED', 'A associação do código de barras mudou desde a leitura. Refaça a operação com os dados atuais.'],
    ['WAREHOUSE_DESTINATION_INACTIVE', 'O destino selecionado está inativo. Selecione um destino ativo.'],
    ['WAREHOUSE_WITHDRAWAL_LINE_LIMIT', 'A retirada excede o limite operacional de linhas. Finalize esta operação e inicie outra.'],
    ['WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT', 'A identidade desta retirada já está vinculada a outro conteúdo. Não altere uma operação parcialmente aplicada.'],
    ['WAREHOUSE_IDEMPOTENCY_CONFLICT', 'Uma tentativa anterior com a mesma identidade possui conteúdo divergente.'],
  ];
  for (const [code, label] of mappings) {
    if (raw.includes(code)) return label;
  }
  return raw || 'Não foi possível concluir a operação.';
}

function presentationOptions(material: WarehouseMaterial): PresentationOption[] {
  return [
    {
      key: warehouseMaterialUnitKey(material.unit),
      unit: material.unit,
      factor: 1,
      label: unitLabel(material.unit) + ' · unidade-base',
    },
    ...material.conversions.map((conversion) => ({
      key: warehouseMaterialUnitKey(conversion.presentation),
      unit: conversion.presentation,
      factor: conversion.factorToBaseUnit,
      label:
        unitLabel(conversion.presentation)
        + ' · 1 = '
        + numberLabel(conversion.factorToBaseUnit)
        + ' '
        + unitLabel(material.unit),
    })),
  ];
}

function positionOptionsFor(
  material: WarehouseMaterial,
  balance: WarehouseBalance | null,
  state: CheckoutState
): PositionOption[] {
  if (!balance) return [];
  const rows: PositionOption[] = state.locationBalances
    .filter((item) => item.balance.materialId === material.id && item.balance.quantity > 0)
    .map((item) => ({
      key: warehouseStockPositionKey(item.balance.position),
      position: item.balance.position,
      quantity: item.balance.quantity,
      label: buildWarehousePositionLabel(item.balance.position, state.depots, state.locations),
    }));

  if (!rows.some((row) => row.position.kind === 'UNASSIGNED')) {
    const physical = state.locationBalances
      .filter((item) => item.balance.materialId === material.id && item.balance.position.kind !== 'UNASSIGNED')
      .map((item) => item.balance);
    let unassigned = 0;
    try {
      unassigned = deriveUnassignedQuantity(balance.quantity, physical);
    } catch {
      unassigned = 0;
    }
    if (unassigned > 0) {
      rows.push({
        key: 'UNASSIGNED',
        position: { kind: 'UNASSIGNED' },
        quantity: unassigned,
        label: 'Sem localização',
      });
    }
  }
  return rows;
}

function readDraft(workspaceId: string): PersistedDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(draftStorageKey(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDraft;
    if (
      !parsed
      || typeof parsed.withdrawalId !== 'string'
      || !Array.isArray(parsed.cart)
      || typeof parsed.destinationId !== 'string'
      || typeof parsed.withdrawnBy !== 'string'
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function WarehouseMaterialWithdrawal({ workspaceId }: { workspaceId: string }) {
  const scannerRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const initialDraft = useMemo(() => readDraft(workspaceId), [workspaceId]);

  const [tab, setTab] = useState<SurfaceTab>('checkout');
  const [state, setState] = useState<CheckoutState>({
    loading: true,
    error: null,
    materials: [],
    balances: [],
    barcodes: [],
    depots: [],
    locations: [],
    locationBalances: [],
    lots: [],
    destinations: [],
  });
  const [cart, setCart] = useState<CartLine[]>(initialDraft?.cart || []);
  const [withdrawalId, setWithdrawalId] = useState(
    initialDraft?.withdrawalId || createWarehouseWithdrawalId()
  );
  const [destinationId, setDestinationId] = useState(initialDraft?.destinationId || '');
  const [withdrawnBy, setWithdrawnBy] = useState(initialDraft?.withdrawnBy || '');
  const [retryRequired, setRetryRequired] = useState(initialDraft?.retryRequired || false);
  const [reviewing, setReviewing] = useState(false);
  const [working, setWorking] = useState(false);
  const [scannerCode, setScannerCode] = useState('');
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [associationMaterialId, setAssociationMaterialId] = useState('');
  const [associationPresentationKey, setAssociationPresentationKey] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedBarcodeId, setSelectedBarcodeId] = useState('');
  const [selectedPresentationKey, setSelectedPresentationKey] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState('');
  const [positionKey, setPositionKey] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [newDestinationName, setNewDestinationName] = useState('');
  const [manageDestinations, setManageDestinations] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draft: PersistedDraft = {
      withdrawalId,
      cart,
      destinationId,
      withdrawnBy,
      retryRequired,
    };
    window.sessionStorage.setItem(draftStorageKey(workspaceId), JSON.stringify(draft));
  }, [cart, destinationId, retryRequired, withdrawalId, withdrawnBy, workspaceId]);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [materials, balances, barcodes, depots, locations, locationBalances, lots, destinations] =
        await Promise.all([
          listWarehouseMaterials(workspaceId, 250),
          listWarehouseBalances(workspaceId, 250),
          listWarehouseBarcodes(workspaceId, 500),
          listWarehouseDepots(workspaceId, 250),
          listWarehouseLocations(workspaceId, 500),
          listWarehouseLocationBalances(workspaceId, 500),
          listWarehouseLots(workspaceId, 500),
          listWarehouseDestinations(workspaceId, 250),
        ]);
      setState({
        loading: false,
        error: null,
        materials,
        balances,
        barcodes,
        depots,
        locations,
        locationBalances,
        lots,
        destinations,
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
    }
  }, [workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!state.loading && tab === 'checkout') scannerRef.current?.focus();
  }, [state.loading, tab]);

  const selectedMaterial = state.materials.find((material) => material.id === selectedMaterialId) || null;
  const selectedBalance = state.balances.find((balance) => balance.materialId === selectedMaterialId) || null;
  const selectedBarcode = state.barcodes.find((item) => item.association.id === selectedBarcodeId)?.association || null;
  const presentations = selectedMaterial ? presentationOptions(selectedMaterial) : [];
  const selectedPresentation = presentations.find((item) => item.key === selectedPresentationKey) || presentations[0] || null;
  const positionOptions = selectedMaterial ? positionOptionsFor(selectedMaterial, selectedBalance, state) : [];
  const selectedPosition = positionOptions.find((item) => item.key === positionKey) || null;
  const materialLots = state.lots
    .filter((item) => item.lot.materialId === selectedMaterialId)
    .map((item) => item.lot);
  const lotOptions = selectedPosition
    ? materialLots.filter((lot) =>
        lot.status === 'active'
        && lot.quantity > 0
        && warehouseStockPositionKey(lot.position) === warehouseStockPositionKey(selectedPosition.position)
      )
    : [];
  const fefo = selectWarehouseFefoLot(materialLots);
  const selectedLot = lotOptions.find((lot) => lot.id === selectedLotId) || null;

  const associationMaterial = state.materials.find((material) => material.id === associationMaterialId) || null;
  const associationPresentations = associationMaterial ? presentationOptions(associationMaterial) : [];

  const filteredMaterials = useMemo(() => {
    const q = normalizeSearch(materialSearch);
    return state.materials.filter((material) => {
      if (material.status !== 'active') return false;
      if (!q) return true;
      return normalizeSearch([material.id, material.description, ...material.aliases].join(' ')).includes(q);
    });
  }, [materialSearch, state.materials]);

  const activeDestinations = state.destinations.filter((item) => item.destination.status === 'active');

  const clearCurrentLine = () => {
    setScannerCode('');
    setUnknownBarcode('');
    setSelectedMaterialId('');
    setSelectedBarcodeId('');
    setSelectedPresentationKey('');
    setRequestedQuantity('');
    setPositionKey('');
    setSelectedLotId('');
    setTimeout(() => scannerRef.current?.focus(), 0);
  };

  const selectMaterial = (material: WarehouseMaterial, barcode: WarehouseBarcodeAssociation | null) => {
    const balance = state.balances.find((item) => item.materialId === material.id) || null;
    const positions = positionOptionsFor(material, balance, state);
    const lots = state.lots
      .filter((item) =>
        item.lot.materialId === material.id
        && item.lot.status === 'active'
        && item.lot.quantity > 0
      )
      .map((item) => item.lot);
    const suggested = selectWarehouseFefoLot(lots);
    const suggestedPositionKey = suggested ? warehouseStockPositionKey(suggested.position) : '';
    const position = positions.find((item) => item.key === suggestedPositionKey) || positions[0] || null;

    setSelectedMaterialId(material.id);
    setSelectedBarcodeId(barcode?.id || '');
    setSelectedPresentationKey(
      barcode ? warehouseMaterialUnitKey(barcode.presentation) : warehouseMaterialUnitKey(material.unit)
    );
    setRequestedQuantity('');
    setPositionKey(position?.key || '');
    setSelectedLotId(
      suggested && position && warehouseStockPositionKey(suggested.position) === position.key
        ? suggested.id
        : ''
    );
    setUnknownBarcode('');
    setMessageKind('info');
    setMessage(
      suggested
        ? 'Material reconhecido. O lote FEFO foi pré-selecionado como recomendação; ENTER/TAB confirma a linha no carrinho, sem baixar estoque.'
        : 'Material reconhecido. Informe a quantidade e pressione ENTER ou TAB.'
    );
    setTimeout(() => quantityRef.current?.focus(), 0);
  };

  const handleScan = () => {
    const raw = scannerCode.trim();
    if (!raw || working || retryRequired) return;
    const association = findWarehouseBarcodeAssociation(
      state.barcodes.map((item) => item.association),
      raw,
      { activeOnly: false }
    );
    setScannerCode('');
    if (!association) {
      setUnknownBarcode(raw);
      setAssociationMaterialId('');
      setAssociationPresentationKey('');
      setSelectedMaterialId('');
      setSelectedBarcodeId('');
      setMessageKind('info');
      setMessage('Código não cadastrado. Nenhum material será criado automaticamente; associe o código a um material canônico existente ou use a pesquisa manual.');
      return;
    }
    if (association.status !== 'active') {
      setMessageKind('error');
      setMessage('Este código de barras está inativo.');
      return;
    }
    const material = state.materials.find((item) => item.id === association.materialId);
    if (!material || material.status !== 'active') {
      setMessageKind('error');
      setMessage('O código aponta para material ausente ou inativo.');
      return;
    }
    selectMaterial(material, association);
  };

  const associateUnknownBarcode = async () => {
    if (!unknownBarcode || !associationMaterial || !associationPresentationKey || working) return;
    const option = associationPresentations.find((item) => item.key === associationPresentationKey);
    if (!option) return;
    setWorking(true);
    try {
      const association = await saveWarehouseBarcodeAssociation(workspaceId, {
        barcode: unknownBarcode,
        materialId: associationMaterial.id,
        presentation: option.unit,
      });
      setState((current) => ({
        ...current,
        barcodes: [
          ...current.barcodes.filter((item) => item.association.id !== association.id),
          { association, createdAt: null, updatedAt: null },
        ],
      }));
      selectMaterial(associationMaterial, association);
      setMessageKind('success');
      setMessage('Código associado ao material canônico. Informe a quantidade.');
    } catch (error) {
      setMessageKind('error');
      setMessage(errorMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const currentReservedAtPosition = (materialId: string, position: WarehouseStockPosition) =>
    cart
      .filter((line) =>
        line.materialId === materialId
        && warehouseStockPositionKey(line.position) === warehouseStockPositionKey(position)
      )
      .reduce((sum, line) => sum + line.baseQuantity, 0);

  const currentReservedLot = (lotId: string) =>
    cart.filter((line) => line.lotId === lotId).reduce((sum, line) => sum + line.baseQuantity, 0);

  const addCurrentLine = () => {
    if (retryRequired || !selectedMaterial || !selectedBalance || !selectedPresentation || !selectedPosition) return;
    if (cart.length >= WAREHOUSE_WITHDRAWAL_MAX_LINES) {
      setMessageKind('error');
      setMessage('Limite de ' + WAREHOUSE_WITHDRAWAL_MAX_LINES + ' linhas atingido. Finalize esta retirada antes de iniciar outra.');
      return;
    }
    const requested = Number(requestedQuantity);
    if (!Number.isFinite(requested) || requested <= 0) {
      setMessageKind('error');
      setMessage('Informe uma quantidade positiva.');
      quantityRef.current?.focus();
      return;
    }
    const baseQuantity = normalizedQuantity(requested * selectedPresentation.factor);
    if (baseQuantity <= 0) {
      setMessageKind('error');
      setMessage('A conversão da apresentação resultou em quantidade inválida.');
      return;
    }
    const reserved = currentReservedAtPosition(selectedMaterial.id, selectedPosition.position);
    if (reserved + baseQuantity > selectedPosition.quantity + 0.000001) {
      setMessageKind('error');
      setMessage(
        'As linhas do carrinho excedem o saldo exibido nesta posição. Disponível para novas linhas: '
          + numberLabel(Math.max(0, selectedPosition.quantity - reserved))
          + ' ' + unitLabel(selectedMaterial.unit) + '.'
      );
      return;
    }
    if (
      selectedLot
      && currentReservedLot(selectedLot.id) + baseQuantity > selectedLot.quantity + 0.000001
    ) {
      setMessageKind('error');
      setMessage('As linhas do carrinho excedem a quantidade disponível no lote.');
      return;
    }

    const line: CartLine = {
      lineId: createWarehouseWithdrawalLineId(),
      materialId: selectedMaterial.id,
      materialDescription: selectedMaterial.description,
      requestedQuantity: requested,
      presentation: selectedPresentation.unit,
      presentationLabel: unitLabel(selectedPresentation.unit),
      baseQuantity,
      unitLabel: unitLabel(selectedMaterial.unit),
      position: selectedPosition.position,
      positionLabel: selectedPosition.label,
      barcodeAssociation: selectedBarcode,
      barcode: selectedBarcode?.barcode || null,
      lotId: selectedLot?.id || null,
      lotCode: selectedLot?.code || null,
      factorToBaseUnit: selectedPresentation.factor,
      availableAtPosition: selectedPosition.quantity,
      availableBalance: selectedBalance.quantity,
    };
    setCart((current) => [...current, line]);
    setReviewing(false);
    setMessageKind('success');
    setMessage(selectedMaterial.description + ' adicionado ao carrinho. Nenhuma baixa foi realizada ainda.');
    clearCurrentLine();
  };

  const updateCartQuantity = (lineId: string, value: number) => {
    if (retryRequired || !Number.isFinite(value) || value <= 0) return;
    setCart((current) =>
      current.map((line) =>
        line.lineId === lineId
          ? { ...line, requestedQuantity: value, baseQuantity: normalizedQuantity(value * line.factorToBaseUnit) }
          : line
      )
    );
    setReviewing(false);
  };

  const cartIssues = useMemo(() => {
    const issues: string[] = [];
    const positionGroups = new Map<string, { total: number; available: number; unit: string }>();
    const lotGroups = new Map<string, { total: number; available: number; code: string }>();
    for (const line of cart) {
      const key = line.materialId + '|' + warehouseStockPositionKey(line.position);
      const group = positionGroups.get(key) || {
        total: 0,
        available: line.availableAtPosition,
        unit: line.unitLabel,
      };
      group.total += line.baseQuantity;
      positionGroups.set(key, group);
      if (line.lotId) {
        const lot = state.lots.find((item) => item.lot.id === line.lotId)?.lot;
        const lotGroup = lotGroups.get(line.lotId) || {
          total: 0,
          available: lot?.quantity || 0,
          code: line.lotCode || line.lotId,
        };
        lotGroup.total += line.baseQuantity;
        lotGroups.set(line.lotId, lotGroup);
      }
    }
    for (const group of positionGroups.values()) {
      if (group.total > group.available + 0.000001) {
        issues.push('Carrinho excede saldo de uma posição: ' + numberLabel(group.total) + ' > ' + numberLabel(group.available) + ' ' + group.unit + '.');
      }
    }
    for (const group of lotGroups.values()) {
      if (group.total > group.available + 0.000001) issues.push('Carrinho excede o lote ' + group.code + '.');
    }
    return issues;
  }, [cart, state.lots]);

  const createDestination = async () => {
    if (!newDestinationName.trim() || working) return;
    setWorking(true);
    try {
      const destination = await createWarehouseDestination(workspaceId, { name: newDestinationName });
      setState((current) => ({
        ...current,
        destinations: [
          ...current.destinations,
          { destination, createdAt: null, updatedAt: null },
        ].sort((a, b) => a.destination.name.localeCompare(b.destination.name, 'pt-BR')),
      }));
      setDestinationId(destination.id);
      setNewDestinationName('');
      setMessageKind('success');
      setMessage('Destino cadastrado e selecionado.');
    } catch (error) {
      setMessageKind('error');
      setMessage(errorMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const toggleDestination = async (item: WarehouseDestinationListItem) => {
    if (working) return;
    const next = item.destination.status === 'active' ? 'inactive' : 'active';
    setWorking(true);
    try {
      await setWarehouseDestinationStatus(workspaceId, item.destination.id, next);
      setState((current) => ({
        ...current,
        destinations: current.destinations.map((entry) =>
          entry.destination.id === item.destination.id
            ? { ...entry, destination: { ...entry.destination, status: next } }
            : entry
        ),
      }));
      if (next === 'inactive' && destinationId === item.destination.id) setDestinationId('');
      setMessageKind('success');
      setMessage(next === 'inactive' ? 'Destino inativado. O histórico permanece preservado.' : 'Destino reativado.');
    } catch (error) {
      setMessageKind('error');
      setMessage(errorMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const resetAfterSuccess = () => {
    setCart([]);
    setWithdrawnBy('');
    setRetryRequired(false);
    setReviewing(false);
    setWithdrawalId(createWarehouseWithdrawalId());
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(draftStorageKey(workspaceId));
  };

  const finalize = async () => {
    if (working || cart.length === 0 || !destinationId || !withdrawnBy.trim() || cartIssues.length > 0) return;
    setWorking(true);
    setMessage(null);
    try {
      const result = await finalizeWarehouseMaterialWithdrawal(workspaceId, {
        withdrawalId,
        destinationId,
        withdrawnBy,
        lines: cart,
      });
      if (result.withdrawal.status !== 'FINALIZED') throw new Error('WAREHOUSE_WITHDRAWAL_INCOMPLETE');
      setMessageKind('success');
      setMessage(
        'Saída finalizada com sucesso · ' + result.withdrawal.id + ' · '
          + result.withdrawal.expectedLineCount + ' linha(s).'
      );
      resetAfterSuccess();
      await refresh();
      setTimeout(() => scannerRef.current?.focus(), 0);
    } catch (error) {
      setRetryRequired(true);
      setReviewing(true);
      setMessageKind('error');
      setMessage(errorMessage(error) + ' O carrinho foi bloqueado para preservar a identidade e permitir retry seguro.');
      await refresh();
    } finally {
      setWorking(false);
    }
  };

  if (state.loading) {
    return (
      <div className="mt-6 flex min-h-[320px] items-center justify-center" data-testid="warehouse-material-withdrawal">
        <RefreshCw className="h-5 w-5 animate-spin text-blue-300" />
        <span className="ml-3 text-sm text-slate-400">Preparando terminal de saída…</span>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-material-withdrawal">
      <div data-testid="warehouse-express-outbound" className="hidden" />

      <div className="inline-flex rounded-2xl border border-white/[0.08] bg-black/20 p-1">
        <button type="button" onClick={() => setTab('checkout')}
          className={tab === 'checkout'
            ? 'rounded-xl bg-white/[0.09] px-4 py-2 text-xs font-black text-white shadow-sm'
            : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-300'}>
          Nova Saída
        </button>
        <button type="button" onClick={() => setTab('reports')}
          className={tab === 'reports'
            ? 'rounded-xl bg-white/[0.09] px-4 py-2 text-xs font-black text-white shadow-sm'
            : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-300'}>
          Relatórios
        </button>
      </div>

      {tab === 'reports' ? (
        <WarehouseConsumptionReports workspaceId={workspaceId} />
      ) : (
        <>
          <section className="overflow-hidden rounded-[24px] border border-blue-300/15 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.11),transparent_35%),linear-gradient(135deg,rgba(4,12,28,0.97),rgba(5,15,31,0.93))] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="border-b border-white/[0.06] p-5 xl:border-b-0 xl:border-r sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-blue-300/15 bg-blue-400/[0.08] p-3">
                    <ScanLine className="h-5 w-5 text-blue-200" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-blue-300/70">
                      terminal premium · scanner HID
                    </p>
                    <h3 className="mt-1 text-xl font-black text-white">SCAN → quantidade → TAB</h3>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                      Leitor USB e teclado usam o mesmo fluxo. Adicionar uma linha apenas prepara o carrinho; o estoque só muda em Finalizar saída.
                    </p>
                  </div>
                </div>

                <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); handleScan(); }}>
                  <input ref={scannerRef} data-testid="warehouse-scanner-input" value={scannerCode}
                    onChange={(event) => setScannerCode(event.target.value)} disabled={retryRequired}
                    autoComplete="off" placeholder="Leia ou digite o código de barras"
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 font-mono text-sm text-white outline-none transition focus:border-blue-300/45 focus:ring-2 focus:ring-blue-400/10 disabled:opacity-40" />
                  <button type="submit" disabled={!scannerCode.trim() || working || retryRequired}
                    className="rounded-2xl border border-blue-300/20 bg-blue-400/[0.1] px-4 text-xs font-black text-blue-100 disabled:opacity-40">
                    Identificar
                  </button>
                </form>

                <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    <PackageSearch className="h-4 w-4 text-slate-300" />
                    <p className="text-xs font-black text-white">Pesquisa manual</p>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)}
                      disabled={retryRequired} placeholder="Descrição, alias ou ID"
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-300/30 disabled:opacity-40" />
                    <select value={selectedMaterialId} disabled={retryRequired}
                      onChange={(event) => {
                        const material = state.materials.find((item) => item.id === event.target.value);
                        if (material) selectMaterial(material, null);
                        else clearCurrentLine();
                      }}
                      className="rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white disabled:opacity-40">
                      <option value="">Selecione um material…</option>
                      {filteredMaterials.map((material) => <option key={material.id} value={material.id}>{material.description}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {!selectedMaterial || !selectedBalance ? (
                  <div className="grid min-h-[260px] place-items-center text-center">
                    <div>
                      <ShoppingCart className="mx-auto h-8 w-8 text-slate-700" />
                      <p className="mt-3 text-sm font-bold text-slate-400">Aguardando material</p>
                      <p className="mt-1 text-[11px] text-slate-600">O foco retorna ao barcode após cada linha.</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">{selectedMaterial.description}</p>
                        <p className="mt-1 font-mono text-[9px] text-slate-600">{selectedMaterial.id}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.05] px-3 py-2 text-right">
                        <p className="text-[8px] uppercase tracking-wide text-slate-500">saldo oficial</p>
                        <p className="text-sm font-black text-emerald-200">
                          {numberLabel(selectedBalance.quantity)} {unitLabel(selectedMaterial.unit)}
                        </p>
                      </div>
                    </div>

                    {selectedBarcode && (
                      <p className="mt-3 rounded-xl border border-blue-300/10 bg-blue-400/[0.04] px-3 py-2 text-[10px] text-blue-100">
                        Barcode {selectedBarcode.barcode} · fator {numberLabel(selectedBarcode.factorToBaseUnit)}
                      </p>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Apresentação
                        <select value={selectedPresentation?.key || ''} disabled={Boolean(selectedBarcode)}
                          onChange={(event) => setSelectedPresentationKey(event.target.value)}
                          className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#071020] px-3 text-sm text-white disabled:opacity-60">
                          {presentations.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Quantidade
                        <input ref={quantityRef} data-testid="warehouse-outbound-quantity" value={requestedQuantity}
                          onChange={(event) => setRequestedQuantity(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === 'Tab') {
                              event.preventDefault();
                              addCurrentLine();
                            }
                          }}
                          inputMode="decimal" autoComplete="off" placeholder="Ex.: 3"
                          className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-blue-300/40 focus:ring-2 focus:ring-blue-400/10" />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Posição
                        <select value={positionKey} onChange={(event) => { setPositionKey(event.target.value); setSelectedLotId(''); }}
                          className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#071020] px-3 text-sm text-white">
                          {positionOptions.map((option) => (
                            <option key={option.key} value={option.key}>{option.label} · {numberLabel(option.quantity)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Lote / FEFO
                        <select value={selectedLotId} onChange={(event) => setSelectedLotId(event.target.value)}
                          className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#071020] px-3 text-sm text-white">
                          <option value="">Sem lote explícito</option>
                          {lotOptions.map((lot) => (
                            <option key={lot.id} value={lot.id}>
                              {lot.code} · {numberLabel(lot.quantity)}{lot.expiresOn ? ' · ' + lot.expiresOn : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {fefo && selectedLotId === fefo.id && (
                      <p className="mt-3 rounded-xl border border-amber-300/12 bg-amber-400/[0.035] px-3 py-2 text-[10px] text-amber-100">
                        FEFO recomendado: {fefo.code} · validade {fefo.expiresOn || 'não informada'}. A baixa só ocorrerá na finalização.
                      </p>
                    )}

                    <button data-testid="warehouse-outbound-submit" type="button" onClick={addCurrentLine}
                      disabled={!requestedQuantity || !selectedPosition || !selectedPresentation}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.09] px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-40">
                      <Plus className="h-4 w-4" /> Adicionar ao carrinho · ENTER/TAB
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {state.error && <div className="rounded-xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-200">{state.error}</div>}

          {message && (
            <div data-testid="warehouse-outbound-message"
              className={'rounded-xl border px-4 py-3 text-xs font-semibold '
                + (messageKind === 'success'
                  ? 'border-emerald-300/15 bg-emerald-400/[0.06] text-emerald-200'
                  : messageKind === 'error'
                    ? 'border-rose-300/15 bg-rose-400/[0.06] text-rose-200'
                    : 'border-blue-300/12 bg-blue-400/[0.04] text-blue-100')}>
              {message}
            </div>
          )}

          {unknownBarcode && !retryRequired && (
            <section className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.04] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-200" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">Código não cadastrado: {unknownBarcode}</p>
                  <p className="mt-1 text-[10px] leading-5 text-slate-400">
                    Associe somente a um material canônico já existente. O barcode nunca substitui materialId.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <select value={associationMaterialId}
                      onChange={(event) => {
                        setAssociationMaterialId(event.target.value);
                        const material = state.materials.find((item) => item.id === event.target.value);
                        setAssociationPresentationKey(material ? warehouseMaterialUnitKey(material.unit) : '');
                      }}
                      className="rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white">
                      <option value="">Material existente…</option>
                      {state.materials.filter((item) => item.status === 'active').map((item) => (
                        <option key={item.id} value={item.id}>{item.description}</option>
                      ))}
                    </select>
                    <select value={associationPresentationKey}
                      onChange={(event) => setAssociationPresentationKey(event.target.value)}
                      disabled={!associationMaterial}
                      className="rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white disabled:opacity-40">
                      <option value="">Apresentação…</option>
                      {associationPresentations.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => void associateUnknownBarcode()}
                    disabled={working || !associationMaterial || !associationPresentationKey}
                    className="mt-3 rounded-xl border border-amber-300/15 px-3 py-2 text-[10px] font-black text-amber-100 disabled:opacity-40">
                    Associar código
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
            <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-200" />
                    <h3 className="text-sm font-black text-white">Carrinho da saída</h3>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {cart.length} linha(s) · {new Set(cart.map((line) => line.materialId)).size} material(is) distinto(s)
                  </p>
                </div>
                {retryRequired && (
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/[0.06] px-2.5 py-1 text-[9px] font-black uppercase text-amber-100">
                    retry protegido
                  </span>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-white/[0.08] p-8 text-center text-xs text-slate-600">
                  Leia um material para iniciar a retirada.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {cart.map((line, index) => (
                    <article key={line.lineId} className="rounded-2xl border border-white/[0.07] bg-black/15 p-3.5">
                      <div className="flex gap-3">
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[10px] font-black text-slate-400">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-white">{line.materialDescription}</p>
                              <p className="mt-1 text-[10px] text-slate-500">
                                {line.presentationLabel}{line.barcode ? ' · barcode ' + line.barcode : ''}{line.lotCode ? ' · lote ' + line.lotCode : ''}
                              </p>
                              <p className="mt-1 text-[10px] text-slate-600">{line.positionLabel}</p>
                            </div>
                            <button type="button"
                              onClick={() => {
                                if (retryRequired) return;
                                setCart((current) => current.filter((item) => item.lineId !== line.lineId));
                                setReviewing(false);
                              }}
                              disabled={retryRequired}
                              className="rounded-lg border border-white/[0.08] p-2 text-slate-500 hover:text-rose-300 disabled:opacity-30"
                              aria-label="Remover linha">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <label className="text-[9px] uppercase tracking-wide text-slate-600">
                              Quantidade
                              <input type="number" step="any" min="0.000001" value={line.requestedQuantity}
                                disabled={retryRequired}
                                onChange={(event) => updateCartQuantity(line.lineId, Number(event.target.value))}
                                className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-2 text-xs font-bold text-white disabled:opacity-50" />
                            </label>
                            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                              <p className="text-[8px] uppercase tracking-wide text-slate-600">Unidade-base</p>
                              <p className="mt-1 text-xs font-black text-white">{numberLabel(line.baseQuantity)} {line.unitLabel}</p>
                            </div>
                            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                              <p className="text-[8px] uppercase tracking-wide text-slate-600">Saldo da posição</p>
                              <p className="mt-1 text-xs font-black text-emerald-200">{numberLabel(line.availableAtPosition)} {line.unitLabel}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {cartIssues.length > 0 && (
                <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-400/[0.05] px-4 py-3 text-[10px] leading-5 text-rose-200">
                  {cartIssues.join(' ')}
                </div>
              )}
            </div>

            <aside className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 sm:p-5">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">fechamento da retirada</p>
              <h3 className="mt-1 text-base font-black text-white">Destino e responsável</h3>

              <label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Destino obrigatório
                <select value={destinationId} disabled={retryRequired}
                  onChange={(event) => { setDestinationId(event.target.value); setReviewing(false); }}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#071020] px-3 text-sm text-white disabled:opacity-50">
                  <option value="">Selecione…</option>
                  {activeDestinations.map(({ destination }) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
                </select>
              </label>

              <div className="mt-2 flex gap-2">
                <input value={newDestinationName} onChange={(event) => setNewDestinationName(event.target.value)}
                  disabled={retryRequired} placeholder="Novo destino"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white disabled:opacity-40" />
                <button type="button" onClick={() => void createDestination()}
                  disabled={!newDestinationName.trim() || working || retryRequired}
                  className="rounded-xl border border-white/10 px-3 text-slate-300 disabled:opacity-40" aria-label="Cadastrar destino">
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setManageDestinations((value) => !value)}
                  className="rounded-xl border border-white/10 px-3 text-slate-400" aria-label="Gerenciar destinos">
                  <Settings2 className="h-4 w-4" />
                </button>
              </div>

              {manageDestinations && (
                <div className="mt-3 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/20 p-2">
                  {state.destinations.length === 0 ? (
                    <p className="p-2 text-[10px] text-slate-600">Nenhum destino cadastrado.</p>
                  ) : state.destinations.map((item) => (
                    <div key={item.destination.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                      <div>
                        <p className="text-[10px] font-bold text-slate-300">{item.destination.name}</p>
                        <p className="text-[8px] uppercase text-slate-600">{item.destination.status === 'active' ? 'Ativo' : 'Inativo'}</p>
                      </div>
                      <button type="button" onClick={() => void toggleDestination(item)}
                        disabled={working || retryRequired}
                        className="text-[9px] font-bold text-blue-200 disabled:opacity-40">
                        {item.destination.status === 'active' ? 'Inativar' : 'Reativar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Retirado por
                <input value={withdrawnBy}
                  onChange={(event) => { setWithdrawnBy(event.target.value); setReviewing(false); }}
                  disabled={retryRequired} placeholder="Ex.: Cb João da Silva"
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-blue-300/35 disabled:opacity-50" />
              </label>
              <p className="mt-2 text-[9px] leading-4 text-slate-600">
                O operador autenticado é registrado separadamente. “Retirado por” identifica quem recebeu fisicamente o material.
              </p>

              <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-3">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Identidade da saída</span><span>{cart.length}/{WAREHOUSE_WITHDRAWAL_MAX_LINES} linhas</span>
                </div>
                <p className="mt-2 break-all font-mono text-[9px] text-slate-400">{withdrawalId}</p>
              </div>

              {!reviewing ? (
                <button type="button" onClick={() => setReviewing(true)}
                  disabled={cart.length === 0 || !destinationId || !withdrawnBy.trim() || cartIssues.length > 0}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-400/[0.09] px-4 py-3 text-xs font-black text-blue-100 disabled:opacity-40">
                  Revisar saída <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.04] p-3">
                  <p className="text-xs font-black text-white">Saída de Material</p>
                  <p className="mt-2 text-[10px] leading-5 text-slate-400">
                    Destino: <strong className="text-white">{activeDestinations.find((item) => item.destination.id === destinationId)?.destination.name || '—'}</strong><br />
                    Retirado por: <strong className="text-white">{withdrawnBy}</strong><br />
                    Itens: <strong className="text-white">{cart.length}</strong>
                  </p>
                  <div className="mt-2 max-h-24 overflow-y-auto text-[9px] leading-5 text-slate-500">
                    {cart.slice(0, 12).map((line) => (
                      <p key={line.lineId}>{line.materialDescription} · {numberLabel(line.baseQuantity)} {line.unitLabel}</p>
                    ))}
                  </div>
                  <button type="button" onClick={() => void finalize()} disabled={working}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400/15 px-4 py-3 text-xs font-black text-emerald-100 disabled:opacity-50">
                    {working ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {retryRequired ? 'Retomar finalização' : 'Finalizar saída'}
                  </button>
                  {!retryRequired && (
                    <button type="button" onClick={() => setReviewing(false)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-[10px] font-bold text-slate-400">
                      <X className="h-3.5 w-3.5" /> Voltar ao carrinho
                    </button>
                  )}
                </div>
              )}
            </aside>
          </section>

          <p className="flex items-center gap-2 text-[10px] text-slate-600">
            <Keyboard className="h-3.5 w-3.5" />
            Operação comum sem mouse: barcode ENTER → quantidade ENTER/TAB → próximo barcode. A concorrência é validada novamente na baixa.
          </p>
        </>
      )}
    </div>
  );
}
