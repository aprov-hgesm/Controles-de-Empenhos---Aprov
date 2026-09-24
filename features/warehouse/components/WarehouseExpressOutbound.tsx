'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Keyboard,
  PackageSearch,
  RefreshCw,
  ScanLine,
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
import { selectWarehouseFefoLot, type WarehouseLot } from '../../../lib/warehouse/lot';
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
  applyWarehouseExpressOutbound,
  createWarehouseOutboundIdempotencyKey,
} from '../../../lib/warehouse/outboundRepository';

interface ExpressState {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  balances: WarehouseBalance[];
  barcodes: WarehouseBarcodeListItem[];
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  locationBalances: WarehouseLocationBalanceListItem[];
  lots: WarehouseLotListItem[];
}

interface RecentOutbound {
  id: string;
  material: string;
  quantity: number;
  unit: string;
  previousBalance: number;
  nextBalance: number;
  lot: string | null;
  location: string;
  interfaceLabel: string;
  at: string;
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

function unitLabel(unit: WarehouseMaterialUnit): string {
  return unit.label || unit.code;
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const mappings: Array<[string, string]> = [
    ['WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK', 'Saldo oficial insuficiente para a saída solicitada.'],
    ['WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK', 'A localização escolhida não possui saldo suficiente.'],
    ['WAREHOUSE_OUTBOUND_INVALID_QUANTITY', 'Informe uma quantidade positiva e válida.'],
    ['WAREHOUSE_OUTBOUND_PRESENTATION_NOT_CONFIGURED', 'A apresentação escolhida não possui conversão canônica configurada.'],
    ['WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION', 'O lote escolhido não possui atribuição suficiente para esta saída.'],
    ['WAREHOUSE_OUTBOUND_LOT_POSITION_MISMATCH', 'O lote escolhido pertence a outra localização.'],
    ['WAREHOUSE_OUTBOUND_LOT_INACTIVE', 'O lote escolhido está inativo.'],
    ['WAREHOUSE_BARCODE_INACTIVE', 'Este código de barras está inativo.'],
    ['WAREHOUSE_BARCODE_ALREADY_LINKED', 'Este código de barras já está associado a outra identidade/apresentação.'],
    ['WAREHOUSE_BARCODE_PRESENTATION_NOT_CONFIGURED', 'A apresentação precisa existir no material canônico antes da associação.'],
    ['WAREHOUSE_MATERIAL_INACTIVE', 'O material está inativo e não pode gerar saída.'],
    ['WAREHOUSE_IDEMPOTENCY_CONFLICT', 'A operação conflitou com uma tentativa anterior. Recarregue os dados antes de prosseguir.'],
    ['WAREHOUSE_BARCODE_CHANGED', 'A associação do código mudou durante a operação. Refaça a leitura.'],
  ];
  for (const [code, message] of mappings) {
    if (raw.includes(code)) return message;
  }
  return raw;
}

function presentationOptions(material: WarehouseMaterial): Array<{
  key: string;
  unit: WarehouseMaterialUnit;
  factor: number;
  label: string;
}> {
  return [
    {
      key: warehouseMaterialUnitKey(material.unit),
      unit: material.unit,
      factor: 1,
      label: unitLabel(material.unit) + ' · 1 ' + unitLabel(material.unit),
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

export function WarehouseExpressOutbound({ workspaceId }: { workspaceId: string }) {
  const scannerRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ExpressState>({
    loading: true,
    error: null,
    materials: [],
    balances: [],
    barcodes: [],
    depots: [],
    locations: [],
    locationBalances: [],
    lots: [],
  });
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
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error' | 'info'>('info');
  const [working, setWorking] = useState(false);
  const [attemptKey, setAttemptKey] = useState(() => createWarehouseOutboundIdempotencyKey());
  const [recent, setRecent] = useState<RecentOutbound[]>([]);

  const refresh = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [
        materials,
        balances,
        barcodes,
        depots,
        locations,
        locationBalances,
        lots,
      ] = await Promise.all([
        listWarehouseMaterials(workspaceId, 250),
        listWarehouseBalances(workspaceId, 250),
        listWarehouseBarcodes(workspaceId, 500),
        listWarehouseDepots(workspaceId, 250),
        listWarehouseLocations(workspaceId, 500),
        listWarehouseLocationBalances(workspaceId, 500),
        listWarehouseLots(workspaceId, 500),
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
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: errorMessage(error),
      }));
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  useEffect(() => {
    if (!state.loading) scannerRef.current?.focus();
  }, [state.loading]);

  const selectedMaterial = state.materials.find(
    (material) => material.id === selectedMaterialId
  ) || null;
  const selectedBalance = state.balances.find(
    (balance) => balance.materialId === selectedMaterialId
  ) || null;
  const selectedBarcode = state.barcodes.find(
    (item) => item.association.id === selectedBarcodeId
  )?.association || null;

  const presentations = useMemo(
    () => selectedMaterial ? presentationOptions(selectedMaterial) : [],
    [selectedMaterial]
  );
  const selectedPresentation = presentations.find(
    (item) => item.key === selectedPresentationKey
  ) || presentations[0] || null;

  useEffect(() => {
    if (!selectedMaterial) {
      setSelectedPresentationKey('');
      return;
    }
    if (
      selectedBarcode
      && selectedBarcode.materialId === selectedMaterial.id
    ) {
      setSelectedPresentationKey(
        warehouseMaterialUnitKey(selectedBarcode.presentation)
      );
      return;
    }
    if (!presentations.some((item) => item.key === selectedPresentationKey)) {
      setSelectedPresentationKey(presentations[0]?.key || '');
    }
  }, [
    presentations,
    selectedBarcode,
    selectedMaterial,
    selectedPresentationKey,
  ]);

  const materialLots = useMemo(
    () => state.lots
      .filter((item) => item.lot.materialId === selectedMaterialId)
      .map((item) => item.lot),
    [selectedMaterialId, state.lots]
  );
  const fefo = useMemo(
    () => selectWarehouseFefoLot(materialLots),
    [materialLots]
  );

  const positionOptions = useMemo(() => {
    if (!selectedMaterial || !selectedBalance) return [] as Array<{
      key: string;
      position: WarehouseStockPosition;
      quantity: number;
      label: string;
    }>;

    const rows = state.locationBalances
      .filter(
        (item) =>
          item.balance.materialId === selectedMaterial.id
          && item.balance.quantity > 0
      )
      .map((item) => ({
        key: warehouseStockPositionKey(item.balance.position),
        position: item.balance.position,
        quantity: item.balance.quantity,
        label: buildWarehousePositionLabel(
          item.balance.position,
          state.depots,
          state.locations
        ),
      }));

    const hasUnassigned = rows.some((row) => row.position.kind === 'UNASSIGNED');
    if (!hasUnassigned) {
      const physical = state.locationBalances
        .filter(
          (item) =>
            item.balance.materialId === selectedMaterial.id
            && item.balance.position.kind !== 'UNASSIGNED'
        )
        .map((item) => item.balance);
      let unassigned = 0;
      try {
        unassigned = deriveUnassignedQuantity(selectedBalance.quantity, physical);
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
  }, [
    selectedBalance,
    selectedMaterial,
    state.depots,
    state.locationBalances,
    state.locations,
  ]);

  useEffect(() => {
    if (!positionOptions.length) {
      setPositionKey('');
      return;
    }
    if (!positionOptions.some((item) => item.key === positionKey)) {
      setPositionKey(positionOptions[0].key);
    }
  }, [positionKey, positionOptions]);

  const lotOptions = useMemo(() => {
    const position = positionOptions.find((item) => item.key === positionKey)?.position;
    if (!position) return [];
    return materialLots.filter(
      (lot) =>
        lot.status === 'active'
        && lot.quantity > 0
        && warehouseStockPositionKey(lot.position) === warehouseStockPositionKey(position)
    );
  }, [materialLots, positionKey, positionOptions]);

  useEffect(() => {
    if (selectedLotId && !lotOptions.some((lot) => lot.id === selectedLotId)) {
      setSelectedLotId('');
    }
  }, [lotOptions, selectedLotId]);

  const associationMaterial = state.materials.find(
    (material) => material.id === associationMaterialId
  ) || null;
  const associationPresentations = associationMaterial
    ? presentationOptions(associationMaterial)
    : [];

  useEffect(() => {
    if (!associationMaterial) {
      setAssociationPresentationKey('');
      return;
    }
    if (
      !associationPresentations.some(
        (item) => item.key === associationPresentationKey
      )
    ) {
      setAssociationPresentationKey(associationPresentations[0]?.key || '');
    }
  }, [
    associationMaterial,
    associationPresentationKey,
    associationPresentations,
  ]);

  const filteredMaterials = useMemo(() => {
    const q = normalizeSearch(materialSearch);
    if (!q) return state.materials.filter((material) => material.status === 'active');
    return state.materials.filter((material) => {
      const haystack = normalizeSearch(
        [material.id, material.description, ...material.aliases].join(' ')
      );
      return material.status === 'active' && haystack.includes(q);
    });
  }, [materialSearch, state.materials]);

  const baseImpact = selectedPresentation && requestedQuantity
    ? Number(requestedQuantity) * selectedPresentation.factor
    : 0;

  const selectMaterial = (
    materialId: string,
    barcode: WarehouseBarcodeAssociation | null
  ) => {
    setSelectedMaterialId(materialId);
    setSelectedBarcodeId(barcode?.id || '');
    setSelectedPresentationKey(
      barcode ? warehouseMaterialUnitKey(barcode.presentation) : ''
    );
    setRequestedQuantity('');
    setSelectedLotId('');
    setAttemptKey(createWarehouseOutboundIdempotencyKey());
    setMessage(null);
    setUnknownBarcode('');
  };

  const handleScan = async () => {
    const raw = scannerCode.trim();
    if (!raw || working) return;
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
      setMessage('Código desconhecido. Associe-o explicitamente a um material existente para continuar.');
      return;
    }
    if (association.status !== 'active') {
      setMessageKind('error');
      setMessage('Código de barras inativo. Nenhuma saída foi preparada.');
      scannerRef.current?.focus();
      return;
    }
    const material = state.materials.find(
      (candidate) => candidate.id === association.materialId
    );
    if (!material || material.status !== 'active') {
      setMessageKind('error');
      setMessage('O código aponta para um material ausente ou inativo.');
      scannerRef.current?.focus();
      return;
    }
    selectMaterial(material.id, association);
    setMessageKind('info');
    setMessage('Código reconhecido. Informe a quantidade da apresentação e pressione ENTER para confirmar.');
  };

  const handleAssociate = async () => {
    if (!unknownBarcode || !associationMaterial || working) return;
    const option = associationPresentations.find(
      (item) => item.key === associationPresentationKey
    );
    if (!option) return;
    setWorking(true);
    try {
      const association = await saveWarehouseBarcodeAssociation(workspaceId, {
        barcode: unknownBarcode,
        materialId: associationMaterial.id,
        presentation: option.unit,
      });
      await refresh();
      selectMaterial(association.materialId, association);
      setMessageKind('success');
      setMessage('Código associado ao material canônico. A operação pode prosseguir.');
    } catch (error) {
      setMessageKind('error');
      setMessage(errorMessage(error));
    } finally {
      setWorking(false);
    }
  };

  const useFefoSuggestion = () => {
    if (!fefo) return;
    const key = warehouseStockPositionKey(fefo.position);
    if (positionOptions.some((item) => item.key === key)) {
      setPositionKey(key);
      setSelectedLotId(fefo.id);
      setMessageKind('info');
      setMessage('Lote FEFO selecionado pelo operador. A recomendação não executou nenhuma baixa automaticamente.');
    }
  };

  const handleOutbound = async () => {
    if (
      !selectedMaterial
      || !selectedBalance
      || !selectedPresentation
      || !positionKey
      || working
    ) {
      return;
    }
    const quantity = Number(requestedQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessageKind('error');
      setMessage('Informe uma quantidade positiva.');
      return;
    }
    const position = positionOptions.find((item) => item.key === positionKey)?.position;
    if (!position) {
      setMessageKind('error');
      setMessage('Selecione uma localização com saldo.');
      return;
    }

    setWorking(true);
    try {
      const result = await applyWarehouseExpressOutbound(workspaceId, {
        materialId: selectedMaterial.id,
        requestedQuantity: quantity,
        presentation: selectedPresentation.unit,
        position,
        barcodeAssociation: selectedBarcode,
        lotId: selectedLotId || null,
        idempotencyKey: attemptKey,
        note: 'Saída expressa FASE 8',
      });
      const location = buildWarehousePositionLabel(
        position,
        state.depots,
        state.locations
      );
      setRecent((current) => [
        {
          id: result.movement.id,
          material: selectedMaterial.description,
          quantity: result.plan.baseQuantity,
          unit: unitLabel(selectedMaterial.unit),
          previousBalance: result.previousBalance.quantity,
          nextBalance: result.balance.quantity,
          lot: result.movement.source?.kind === 'EXPRESS_OUTBOUND'
            ? result.movement.source.lotCode
            : null,
          location,
          interfaceLabel: result.plan.interface === 'BARCODE_SCANNER'
            ? 'Scanner/código de barras'
            : 'Pesquisa manual',
          at: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 8));

      setMessageKind('success');
      setMessage(
        'Saída registrada: '
        + numberLabel(result.plan.baseQuantity)
        + ' '
        + unitLabel(selectedMaterial.unit)
        + '. Saldo '
        + numberLabel(result.previousBalance.quantity)
        + ' → '
        + numberLabel(result.balance.quantity)
        + '.'
      );
      setSelectedMaterialId('');
      setSelectedBarcodeId('');
      setRequestedQuantity('');
      setSelectedLotId('');
      setPositionKey('');
      setAttemptKey(createWarehouseOutboundIdempotencyKey());
      await refresh();
      scannerRef.current?.focus();
    } catch (error) {
      setMessageKind('error');
      setMessage(errorMessage(error));
      scannerRef.current?.focus();
    } finally {
      setWorking(false);
    }
  };

  if (state.loading) {
    return (
      <div className="mt-6 flex min-h-[320px] items-center justify-center" data-testid="warehouse-express-outbound">
        <RefreshCw className="h-5 w-5 animate-spin text-blue-300" aria-hidden="true" />
        <span className="ml-3 text-sm text-slate-400">Carregando operação de saída...</span>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5" data-testid="warehouse-express-outbound">
      <section className="rounded-2xl border border-blue-300/15 bg-blue-400/[0.045] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-blue-300/15 bg-blue-400/[0.08] p-2.5">
            <ScanLine className="h-5 w-5 text-blue-200" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300/70">
              scanner HID / teclado
            </p>
            <h3 className="mt-1 text-lg font-black text-white">SCAN → quantidade → ENTER</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              O campo permanece preparado para leitores USB que digitam o código e enviam ENTER. Digitação manual usa exatamente o mesmo fluxo.
            </p>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleScan();
              }}
            >
              <input
                ref={scannerRef}
                data-testid="warehouse-scanner-input"
                value={scannerCode}
                onChange={(event) => setScannerCode(event.target.value)}
                autoComplete="off"
                placeholder="Leia ou digite o código de barras"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-blue-300/40"
              />
              <button
                type="submit"
                disabled={working || !scannerCode.trim()}
                className="rounded-xl border border-blue-300/20 bg-blue-400/[0.1] px-4 py-3 text-xs font-bold text-blue-100 disabled:opacity-40"
              >
                Identificar
              </button>
            </form>
          </div>
        </div>
      </section>

      {state.error && (
        <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
          {state.error}
        </div>
      )}

      {message && (
        <div
          data-testid="warehouse-outbound-message"
          className={
            'rounded-2xl border p-4 text-sm '
            + (messageKind === 'success'
              ? 'border-emerald-300/15 bg-emerald-400/[0.06] text-emerald-200'
              : messageKind === 'error'
                ? 'border-rose-300/15 bg-rose-400/[0.06] text-rose-200'
                : 'border-amber-300/15 bg-amber-400/[0.05] text-amber-100')
          }
        >
          {message}
        </div>
      )}

      {unknownBarcode && (
        <section
          data-testid="warehouse-scanner-unknown"
          className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.04] p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white">Código não cadastrado: {unknownBarcode}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Nenhum material será criado automaticamente. Associe o código a um material canônico existente e a uma apresentação já configurada.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Material existente
                  <select
                    data-testid="warehouse-barcode-associate-material"
                    value={associationMaterialId}
                    onChange={(event) => setAssociationMaterialId(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">Selecione...</option>
                    {state.materials
                      .filter((material) => material.status === 'active')
                      .map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.description}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Apresentação / conversão
                  <select
                    data-testid="warehouse-barcode-associate-presentation"
                    value={associationPresentationKey}
                    onChange={(event) => setAssociationPresentationKey(event.target.value)}
                    disabled={!associationMaterial}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white disabled:opacity-50"
                  >
                    <option value="">Selecione...</option>
                    {associationPresentations.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                data-testid="warehouse-barcode-associate-save"
                disabled={
                  working
                  || !associationMaterial
                  || !associationPresentationKey
                }
                onClick={() => void handleAssociate()}
                className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/[0.08] px-4 py-2.5 text-xs font-bold text-amber-100 disabled:opacity-40"
              >
                Associar código e continuar
              </button>
            </div>
          </div>
        </section>
      )}

      {!unknownBarcode && (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <PackageSearch className="h-4 w-4 text-slate-300" aria-hidden="true" />
              <h3 className="font-bold text-white">Pesquisa manual</h3>
            </div>
            <input
              data-testid="warehouse-outbound-material-search"
              value={materialSearch}
              onChange={(event) => setMaterialSearch(event.target.value)}
              placeholder="Descrição, alias ou ID do material"
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-300/30"
            />
            <select
              data-testid="warehouse-outbound-material"
              value={selectedMaterialId}
              onChange={(event) => {
                const id = event.target.value;
                if (id) selectMaterial(id, null);
                else setSelectedMaterialId('');
              }}
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white"
            >
              <option value="">Selecione um material...</option>
              {filteredMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.description}
                </option>
              ))}
            </select>
            <p className="mt-3 flex items-center gap-2 text-[11px] leading-5 text-slate-500">
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              Pesquisa manual e scanner convergem para o mesmo ledger e as mesmas proteções.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
            {!selectedMaterial || !selectedBalance ? (
              <div className="grid min-h-[180px] place-items-center text-center text-sm text-slate-500">
                Leia um código ou selecione um material para preparar a saída.
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleOutbound();
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{selectedMaterial.description}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">{selectedMaterial.id}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.05] px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">saldo oficial</p>
                    <p data-testid="warehouse-outbound-balance" className="font-black text-emerald-200">
                      {numberLabel(selectedBalance.quantity)} {unitLabel(selectedMaterial.unit)}
                    </p>
                  </div>
                </div>

                {selectedBarcode && (
                  <div className="mt-4 rounded-xl border border-blue-300/10 bg-blue-400/[0.04] p-3 text-xs text-blue-100">
                    Código {selectedBarcode.barcode} · {unitLabel(selectedBarcode.presentation)} · fator {numberLabel(selectedBarcode.factorToBaseUnit)}
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-400">
                    Apresentação
                    <select
                      data-testid="warehouse-outbound-presentation"
                      value={selectedPresentationKey}
                      onChange={(event) => {
                        if (!selectedBarcode) setSelectedPresentationKey(event.target.value);
                      }}
                      disabled={Boolean(selectedBarcode)}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white disabled:opacity-70"
                    >
                      {presentations.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-400">
                    Quantidade da apresentação
                    <input
                      data-testid="warehouse-outbound-quantity"
                      value={requestedQuantity}
                      onChange={(event) => setRequestedQuantity(event.target.value)}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Ex.: 3"
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-300/30"
                    />
                  </label>
                </div>

                <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5 text-xs text-slate-400">
                  Impacto na unidade oficial:{' '}
                  <strong className="text-white">
                    {Number.isFinite(baseImpact) ? numberLabel(baseImpact) : '—'} {unitLabel(selectedMaterial.unit)}
                  </strong>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-400">
                    Localização de retirada
                    <select
                      data-testid="warehouse-outbound-position"
                      value={positionKey}
                      onChange={(event) => {
                        setPositionKey(event.target.value);
                        setSelectedLotId('');
                      }}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white"
                    >
                      {positionOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label} · {numberLabel(option.quantity)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-400">
                    Lote utilizado (opcional)
                    <select
                      data-testid="warehouse-outbound-lot"
                      value={selectedLotId}
                      onChange={(event) => setSelectedLotId(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071020] px-3 py-2.5 text-sm text-white"
                    >
                      <option value="">Sem lote explícito</option>
                      {lotOptions.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.code} · {numberLabel(lot.quantity)}
                          {lot.expiresOn ? ' · ' + lot.expiresOn : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div
                  data-testid="warehouse-outbound-fefo"
                  className="mt-4 rounded-xl border border-amber-300/12 bg-amber-400/[0.035] p-3"
                >
                  {fefo ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold text-amber-100">FEFO sugere {fefo.code}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Validade {fefo.expiresOn || 'não informada'} · recomendação apenas, sem baixa automática.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={useFefoSuggestion}
                        className="rounded-lg border border-amber-300/15 px-3 py-2 text-[11px] font-bold text-amber-100"
                      >
                        Usar lote recomendado
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Nenhum lote elegível para recomendação FEFO. A ausência de lote/validade não bloqueia a saída.
                    </p>
                  )}
                </div>

                <button
                  data-testid="warehouse-outbound-submit"
                  type="submit"
                  disabled={
                    working
                    || !requestedQuantity
                    || !positionKey
                    || !selectedPresentation
                  }
                  className="mt-4 w-full rounded-xl border border-emerald-300/20 bg-emerald-400/[0.09] px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/[0.13] disabled:opacity-40"
                >
                  {working ? 'Registrando...' : 'Confirmar saída · ENTER'}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      <section
        data-testid="warehouse-outbound-recent"
        className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">Operações recentes desta sessão</h3>
            <p className="mt-1 text-xs text-slate-500">
              Feedback rápido; o histórico oficial permanece no ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
            aria-label="Atualizar dados"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Nenhuma saída registrada nesta sessão.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {recent.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{item.material}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {numberLabel(item.quantity)} {item.unit} · saldo {numberLabel(item.previousBalance)} → {numberLabel(item.nextBalance)} · {item.location}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {item.interfaceLabel}{item.lot ? ' · lote ' + item.lot : ''} · {new Date(item.at).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
