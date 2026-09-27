'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Barcode,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Copy,
  ListFilter,
  MapPin,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';

import type { WarehouseItemIntakeListItem } from '../../../lib/warehouse/intake';
import {
  listWarehouseItemIntakes,
  markWarehouseImmediateConsumptionPosted,
} from '../../../lib/warehouse/intakeRepository';
import type { WarehouseItemIntakeEffectiveStatus } from '../../../lib/warehouse/intakeState';
import {
  loadWarehouseInvoiceIntakeQueue,
  type WarehouseInvoiceIntakeQueueContext,
  type WarehouseInvoiceIntakeQueueRow,
} from '../../../lib/warehouse/intakeStateRepository';
import {
  allocateWarehousePendingItem,
  type AllocateWarehousePendingItemResult,
} from '../../../lib/warehouse/intakeAllocationRepository';
import type { WarehouseStockPosition } from '../../../lib/warehouse/location';
import {
  listWarehouseDepots,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import { WarehouseSiscofisOperational } from './WarehouseSiscofisOperational';
import { WarehouseImmediateConsumptionPanel } from './WarehouseImmediateConsumptionPanel';
import { WarehouseAllocatedItemsOperational } from './WarehouseAllocatedItemsOperational';
import {
  applyWarehouseImmediateConsumption,
  createWarehouseDestination,
  listWarehouseDestinations,
  type ApplyWarehouseImmediateConsumptionResult,
} from '../../../lib/warehouse/withdrawalRepository';
import type { WarehouseDestinationListItem } from '../../../lib/warehouse/withdrawal';

type RegistrationTab = 'invoices' | 'stored' | 'siscofis' | 'immediate';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return dateOnly[3] + '/' + dateOnly[2] + '/' + dateOnly[1];
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleDateString('pt-BR');
}

function formatQuantity(value: number, unitLabel: string): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
    + (unitLabel ? ' ' + unitLabel : '');
}

function intakeStatusLabel(status: WarehouseItemIntakeEffectiveStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pendente';
    case 'PARTIALLY_PROCESSED':
      return 'Parcialmente tratado';
    case 'PROCESSED':
      return 'Tratado';
    case 'RECONCILIATION_REQUIRED':
      return 'Reconciliação necessária';
  }
}

function intakeStatusClass(status: WarehouseItemIntakeEffectiveStatus): string {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-700';
    case 'PARTIALLY_PROCESSED':
      return 'bg-blue-100 text-blue-700';
    case 'PROCESSED':
      return 'bg-emerald-100 text-emerald-700';
    case 'RECONCILIATION_REQUIRED':
      return 'bg-rose-100 text-rose-700';
  }
}

function reconciliationMessage(row: WarehouseInvoiceIntakeQueueRow): string | null {
  switch (row.reconciliationReason) {
    case 'CANONICAL_QUANTITY_CHANGED':
      return 'A quantidade atual da NF diverge do estado logístico preservado. Nenhuma correção foi aplicada automaticamente.';
    case 'CANONICAL_SOURCE_MISSING':
      return 'A NF ou o item não está mais presente na fonte canônica consultada. O histórico warehouse foi preservado sem compensação automática.';
    case 'LEGACY_INVOICE_PROJECTION':
      return 'Existe projeção logística legada para este item, mas não há estado de tratamento compatível com o novo motor. Revisão será necessária antes de nova movimentação.';
    default:
      return null;
  }
}


function allocationErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code.includes('WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION')) {
    return 'A pendência foi alterada em outra tela. A operação não foi executada; atualize a fila antes de continuar.';
  }
  if (
    code.includes('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED')
    || code.includes('WAREHOUSE_ITEM_INTAKE_LEGACY_COMPLETED')
  ) {
    return 'O item exige reconciliação antes de uma nova alocação. Nenhum saldo foi movimentado.';
  }
  if (code.includes('WAREHOUSE_INTAKE_ALLOCATION_EXCEEDS_PENDING')) {
    return 'A quantidade informada supera a quantidade pendente atual.';
  }
  if (code.includes('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK')) {
    return 'A quantidade disponível em Sem localização não é suficiente. O item precisa ser reconciliado.';
  }
  if (
    code.includes('WAREHOUSE_POSITION_INACTIVE')
    || code.includes('WAREHOUSE_SUBPOSITION_INACTIVE')
    || code.includes('WAREHOUSE_POSITION_NOT_FOUND')
  ) {
    return 'O depósito, localização ou subposição deixou de estar disponível. Selecione uma posição ativa.';
  }
  if (code.includes('WAREHOUSE_INTAKE_LOT_CONFLICT')) {
    return 'Já existe atribuição deste lote nessa posição com dados diferentes. Revise lote e validade.';
  }
  if (code.includes('WAREHOUSE_BARCODE_MATERIAL_CONFLICT')) {
    return 'Este código de barras já está associado a outro material e não pode ser reutilizado.';
  }
  if (
    code.includes('WAREHOUSE_BARCODE_PRESENTATION_CONFLICT')
    || code.includes('WAREHOUSE_BARCODE_INACTIVE')
  ) {
    return 'O código de barras existente não é compatível com esta apresentação ou está inativo.';
  }
  if (code.includes('WAREHOUSE_IDEMPOTENCY_CONFLICT')) {
    return 'A tentativa anterior já possui uma operação com dados diferentes. Atualize a fila antes de repetir.';
  }
  if (code.includes('WAREHOUSE_INTAKE_LOT_REQUIRED')) {
    return 'Informe o lote para concluir a alocação.';
  }
  if (code.includes('WAREHOUSE_INTAKE_INVALID_EXPIRY')) {
    return 'Informe uma validade válida ou marque explicitamente Sem validade.';
  }
  return error instanceof Error
    ? error.message
    : 'Não foi possível confirmar a alocação.';
}

function allocationOperationStorageKey(
  workspaceId: string,
  intakeId: string
): string {
  return ['emprovex', 'warehouse', 'intake-allocation', workspaceId, intakeId].join(':');
}

function getOrCreateAllocationOperationId(
  workspaceId: string,
  intakeId: string
): string {
  const key = allocationOperationStorageKey(workspaceId, intakeId);
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function clearAllocationOperationId(
  workspaceId: string,
  intakeId: string
): void {
  window.sessionStorage.removeItem(
    allocationOperationStorageKey(workspaceId, intakeId)
  );
}

interface InvoiceDefaultDestination {
  depotId: string;
  locationId: string;
  subpositionId: string;
}

function invoiceDestinationStorageKey(
  workspaceId: string,
  invoiceRecordKey: string
): string {
  return ['emprovex', 'warehouse', 'invoice-destination', workspaceId, invoiceRecordKey].join(':');
}

function readInvoiceDefaultDestination(
  workspaceId: string,
  invoiceRecordKey: string
): InvoiceDefaultDestination {
  try {
    const raw = window.sessionStorage.getItem(
      invoiceDestinationStorageKey(workspaceId, invoiceRecordKey)
    );
    if (!raw) return { depotId: '', locationId: '', subpositionId: '' };
    const parsed = JSON.parse(raw) as Partial<InvoiceDefaultDestination>;
    return {
      depotId: typeof parsed.depotId === 'string' ? parsed.depotId : '',
      locationId: typeof parsed.locationId === 'string' ? parsed.locationId : '',
      subpositionId: typeof parsed.subpositionId === 'string' ? parsed.subpositionId : '',
    };
  } catch {
    return { depotId: '', locationId: '', subpositionId: '' };
  }
}

function saveInvoiceDefaultDestination(
  workspaceId: string,
  invoiceRecordKey: string,
  destination: InvoiceDefaultDestination
): void {
  window.sessionStorage.setItem(
    invoiceDestinationStorageKey(workspaceId, invoiceRecordKey),
    JSON.stringify(destination)
  );
}

function AllocationPanel({
  workspaceId,
  row,
  onClose,
  onSuccess,
}: {
  workspaceId: string;
  row: WarehouseInvoiceIntakeQueueRow;
  onClose: () => void;
  onSuccess: (
    result: AllocateWarehousePendingItemResult,
    quantity: number
  ) => Promise<void>;
}) {
  const [depots, setDepots] = useState<WarehouseDepotListItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationListItem[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultDestination = readInvoiceDefaultDestination(
    workspaceId,
    row.invoiceRecordKey
  );
  const [quantity, setQuantity] = useState(String(row.pendingQuantity));
  const [depotId, setDepotId] = useState(defaultDestination.depotId);
  const [locationId, setLocationId] = useState(defaultDestination.locationId);
  const [subpositionId, setSubpositionId] = useState(defaultDestination.subpositionId);
  const [lotCode, setLotCode] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [barcodeRead, setBarcodeRead] = useState(false);
  const [operationId, setOperationId] = useState('');

  useEffect(() => {
    let active = true;
    setOperationId(getOrCreateAllocationOperationId(workspaceId, row.stateId));
    setLoadingStructure(true);
    setError(null);
    Promise.all([
      listWarehouseDepots(workspaceId, 250),
      listWarehouseLocations(workspaceId, 500),
    ])
      .then(([depotItems, locationItems]) => {
        if (!active) return;
        setDepots(depotItems.filter((item) => item.depot.status === 'active'));
        setLocations(
          locationItems.filter((item) => item.location.status === 'active')
        );
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Falha ao carregar depósitos e localizações.'
        );
      })
      .finally(() => {
        if (active) setLoadingStructure(false);
      });

    return () => {
      active = false;
    };
  }, [workspaceId, row.stateId]);

  const localOptions = useMemo(
    () => locations.filter(
      (item) =>
        item.location.kind === 'LOCAL'
        && item.location.depotId === depotId
    ),
    [locations, depotId]
  );
  const subpositionOptions = useMemo(
    () => locations.filter(
      (item) =>
        item.location.kind === 'SUBPOSITION'
        && item.location.depotId === depotId
        && item.location.parentLocationId === locationId
    ),
    [locations, depotId, locationId]
  );

  const selectedDepot = depots.find((item) => item.depot.id === depotId)?.depot;
  const selectedLocation = localOptions.find(
    (item) => item.location.id === locationId
  )?.location;
  const selectedSubposition = subpositionOptions.find(
    (item) => item.location.id === subpositionId
  )?.location;

  const numericQuantity = Number(quantity);
  const validQuantity =
    Number.isFinite(numericQuantity)
    && numericQuantity > 0
    && numericQuantity <= row.pendingQuantity + 0.000001;

  const buildPosition = (): WarehouseStockPosition | null => {
    if (!depotId || !locationId) return null;
    if (subpositionId) {
      return {
        kind: 'SUBPOSITION',
        depotId,
        locationId,
        subpositionId,
      };
    }
    return {
      kind: 'LOCATION',
      depotId,
      locationId,
      subpositionId: null,
    };
  };

  const confirmAllocation = async () => {
    setError(null);
    const position = buildPosition();
    if (!validQuantity) {
      setError('Informe uma quantidade maior que zero e limitada ao pendente.');
      return;
    }
    if (!position) {
      setError('Selecione um depósito e uma localização ativos.');
      return;
    }
    if (!operationId) {
      setError('A identidade da operação ainda não está pronta. Reabra a alocação.');
      return;
    }

    setWorking(true);
    try {
      const result = await allocateWarehousePendingItem(workspaceId, {
        intakeId: row.stateId,
        invoiceRecordKey: row.invoiceRecordKey,
        invoiceId: row.invoiceId,
        empenhoId: row.empenhoId,
        itemId: row.itemId,
        materialId: row.materialId,
        description: row.itemName,
        unitLabel: row.unitLabel,
        supplier: row.supplier,
        receivedQuantity: row.receivedQuantity,
        expectedAllocatedQuantity: row.allocatedQuantity,
        expectedImmediateConsumptionQuantity: row.immediateConsumptionQuantity,
        effectiveStatus: row.status,
        quantity: numericQuantity,
        position,
        lotCode: lotCode.trim(),
        expiresOn: expiresOn || null,
        barcode: barcode.trim() || null,
        operationId,
      });
      saveInvoiceDefaultDestination(workspaceId, row.invoiceRecordKey, {
        depotId,
        locationId,
        subpositionId,
      });
      clearAllocationOperationId(workspaceId, row.stateId);
      await onSuccess(result, numericQuantity);
    } catch (allocationError) {
      setError(allocationErrorMessage(allocationError));
    } finally {
      setWorking(false);
    }
  };

  const positionLabel = [
    selectedDepot?.name || selectedDepot?.code,
    selectedLocation?.name || selectedLocation?.code,
    selectedSubposition?.name || selectedSubposition?.code,
  ].filter(Boolean).join(' → ');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Alocar item no depósito"
    >
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <PackagePlus className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Alocar no depósito
              </p>
            </div>
            <p className="mt-1 text-sm font-black text-slate-900">
              {row.itemName}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              NF {row.invoiceId} · Empenho {row.empenhoId} · {row.supplier}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Recebido', row.receivedQuantity],
              ['Já alocado', row.allocatedQuantity],
              ['Consumo imediato', row.immediateConsumptionQuantity],
              ['Pendente', row.pendingQuantity],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-sm font-black text-slate-800">
                  {formatQuantity(Number(value), row.unitLabel)}
                </p>
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-5 text-rose-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-[10px] leading-5 text-slate-600">
            <span className="font-black text-[#00288e]">Destino padrão da NF:</span>{' '}
            o depósito/localização escolhido neste item será lembrado para os demais itens da NF {row.invoiceId}.
            Se um item precisar ir para outro local, basta alterar o destino antes de confirmar.
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Quantidade a alocar
              </span>
              <input
                type="number"
                min="0.000001"
                max={row.pendingQuantity}
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
              />
              <span className="mt-1 block text-[9px] text-slate-400">
                Máximo: {formatQuantity(row.pendingQuantity, row.unitLabel)}
              </span>
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Depósito
              </span>
              <select
                value={depotId}
                onChange={(event) => {
                  setDepotId(event.target.value);
                  setLocationId('');
                  setSubpositionId('');
                }}
                disabled={loadingStructure}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e] disabled:opacity-50"
              >
                <option value="">
                  {loadingStructure ? 'Carregando…' : 'Selecione um depósito'}
                </option>
                {depots.map(({ depot }) => (
                  <option key={depot.id} value={depot.id}>
                    {depot.code} · {depot.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Localização
              </span>
              <select
                value={locationId}
                onChange={(event) => {
                  setLocationId(event.target.value);
                  setSubpositionId('');
                }}
                disabled={!depotId || loadingStructure}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e] disabled:opacity-50"
              >
                <option value="">Selecione a localização</option>
                {localOptions.map(({ location }) => (
                  <option key={location.id} value={location.id}>
                    {location.code} · {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Nível / Subposição
              </span>
              <select
                value={subpositionId}
                onChange={(event) => setSubpositionId(event.target.value)}
                disabled={!locationId || loadingStructure}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e] disabled:opacity-50"
              >
                <option value="">Sem subposição específica</option>
                {subpositionOptions.map(({ location }) => (
                  <option key={location.id} value={location.id}>
                    {location.code} · {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Lote · opcional
              </span>
              <input
                type="text"
                maxLength={80}
                value={lotCode}
                onChange={(event) => setLotCode(event.target.value)}
                placeholder="Ex.: LT-2026-09"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Validade · opcional
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[8px] text-rose-700">
                  pendência vermelha se ausente
                </span>
              </span>
              <input
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
              />
              <span className="mt-1 block text-[9px] text-slate-400">
                Pode ser preenchida depois pela edição do item armazenado.
              </span>
            </label>

            <label className="block lg:col-span-2">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                <Barcode className="h-3.5 w-3.5" />
                Código de barras — opcional
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] text-amber-700">
                  pendência amarela se ausente
                </span>
              </span>
              <input
                type="text"
                maxLength={128}
                value={barcode}
                onChange={(event) => {
                  setBarcode(event.target.value);
                  setBarcodeRead(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    setBarcodeRead(Boolean(event.currentTarget.value.trim()));
                  }
                }}
                autoComplete="off"
                placeholder="Digite ou leia com scanner USB e pressione ENTER"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
              />
              <span className="mt-1 block text-[9px] text-slate-400">
                Scanner USB HID é tratado como teclado.
                {barcodeRead ? ' Código capturado e pronto para confirmação.' : ''}
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-[#00288e]">
              <MapPin className="h-4 w-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.12em]">
                Resumo antes da confirmação
              </p>
            </div>
            <p className="mt-3 text-sm font-black text-slate-900">
              Alocar {validQuantity ? formatQuantity(numericQuantity, row.unitLabel) : '—'} de {row.itemName}
            </p>
            <div className="mt-2 grid gap-1 text-[10px] leading-5 text-slate-600 sm:grid-cols-2">
              <p><span className="font-black">NF:</span> {row.invoiceId}</p>
              <p><span className="font-black">Posição:</span> {positionLabel || '—'}</p>
              <p><span className="font-black">Lote:</span> {lotCode.trim() || 'Não informado'}</p>
              <p>
                <span className="font-black">Validade:</span>{' '}
                {expiresOn ? formatDate(expiresOn) : 'Não informada · pendência vermelha'}
              </p>
              <p className="sm:col-span-2">
                <span className="font-black">Barcode:</span>{' '}
                {barcode.trim() || 'Não informado · pendência amarela'}
              </p>
            </div>
          </div>

          {!loadingStructure && depots.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
              Nenhum depósito ativo está disponível. Crie ou reative uma estrutura em Meus Depósitos antes de alocar.
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirmAllocation()}
              disabled={working || loadingStructure || depots.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white disabled:opacity-50"
            >
              {working ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirmar alocação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type InvoiceQueueStatusFilter =
  | 'actionable'
  | 'all'
  | 'processed'
  | 'reconciliation';

type PregaoBulkMode = 'storage' | 'immediate';

interface WarehouseInvoiceQueueGroup {
  key: string;
  invoiceRecordKey: string;
  invoiceId: string;
  issueDate: string | null;
  registeredAt: string | null;
  supplier: string;
  empenhoId: string;
  pregao: string | null;
  rows: WarehouseInvoiceIntakeQueueRow[];
  totalItems: number;
  processedItems: number;
  actionableItems: number;
  reconciliationItems: number;
}

function normalizeQueueSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function invoiceGroupStatus(
  group: WarehouseInvoiceQueueGroup
): WarehouseItemIntakeEffectiveStatus {
  if (group.reconciliationItems > 0) return 'RECONCILIATION_REQUIRED';
  if (group.processedItems === group.totalItems) return 'PROCESSED';
  if (group.processedItems > 0 || group.rows.some(
    (row) => row.status === 'PARTIALLY_PROCESSED'
  )) {
    return 'PARTIALLY_PROCESSED';
  }
  return 'PENDING';
}

function bulkOperationStorageKey(
  workspaceId: string,
  subjectKey: string,
  mode: PregaoBulkMode,
  intakeId: string
): string {
  return [
    'emprovex',
    'warehouse',
    'intake-bulk',
    workspaceId,
    subjectKey,
    mode,
    intakeId,
  ].join(':');
}

function getOrCreateBulkOperationId(
  workspaceId: string,
  subjectKey: string,
  mode: PregaoBulkMode,
  intakeId: string
): string {
  const key = bulkOperationStorageKey(
    workspaceId,
    subjectKey,
    mode,
    intakeId
  );
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function clearBulkOperationId(
  workspaceId: string,
  subjectKey: string,
  mode: PregaoBulkMode,
  intakeId: string
): void {
  window.sessionStorage.removeItem(
    bulkOperationStorageKey(
      workspaceId,
      subjectKey,
      mode,
      intakeId
    )
  );
}

function immediateConsumptionErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const mappings: Array<[string, string]> = [
    [
      'WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION',
      'A pendência foi alterada em outra tela.',
    ],
    [
      'WAREHOUSE_IMMEDIATE_CONSUMPTION_EXCEEDS_PENDING',
      'A quantidade supera o pendente atual.',
    ],
    [
      'WAREHOUSE_IMMEDIATE_CONSUMPTION_STOCK_MISMATCH',
      'A projeção de estoque não comporta esta parcela.',
    ],
    [
      'WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED',
      'O item exige reconciliação antes do consumo imediato.',
    ],
    [
      'WAREHOUSE_DESTINATION_INACTIVE',
      'O destino selecionado está inativo.',
    ],
    [
      'WAREHOUSE_IDEMPOTENCY_CONFLICT',
      'Existe uma tentativa anterior incompatível para este item.',
    ],
  ];
  for (const [code, message] of mappings) {
    if (raw.includes(code)) return message;
  }
  return raw || 'Não foi possível confirmar o consumo imediato.';
}

function IntakeBulkActionPanel({
  workspaceId,
  subjectKind,
  subjectKey,
  subjectLabel,
  rows,
  coverageLimited,
  onClose,
  onComplete,
}: {
  workspaceId: string;
  subjectKind: 'pregao' | 'invoice';
  subjectKey: string;
  subjectLabel: string;
  rows: WarehouseInvoiceIntakeQueueRow[];
  coverageLimited: boolean;
  onClose: () => void;
  onComplete: (
    successful: number,
    failures: Array<{ row: WarehouseInvoiceIntakeQueueRow; message: string }>
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<PregaoBulkMode>('storage');
  const [depots, setDepots] = useState<WarehouseDepotListItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationListItem[]>([]);
  const [destinations, setDestinations] =
    useState<WarehouseDestinationListItem[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(true);
  const [depotId, setDepotId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [subpositionId, setSubpositionId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [newDestinationName, setNewDestinationName] = useState('');
  const [creatingDestination, setCreatingDestination] = useState(false);
  const [withdrawnBy, setWithdrawnBy] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<
    Array<{ row: WarehouseInvoiceIntakeQueueRow; message: string }>
  >([]);

  const eligibleRows = useMemo(
    () => rows.filter(
      (row) =>
        (row.status === 'PENDING' || row.status === 'PARTIALLY_PROCESSED')
        && row.pendingQuantity > 0.000001
    ),
    [rows]
  );
  const invoiceCount = useMemo(
    () => new Set(eligibleRows.map((row) => row.invoiceRecordKey)).size,
    [eligibleRows]
  );

  useEffect(() => {
    let active = true;
    setLoadingStructure(true);
    Promise.all([
      listWarehouseDepots(workspaceId, 250),
      listWarehouseLocations(workspaceId, 500),
      listWarehouseDestinations(workspaceId, 250),
    ])
      .then(([depotItems, locationItems, destinationItems]) => {
        if (!active) return;
        setDepots(
          depotItems.filter((item) => item.depot.status === 'active')
        );
        setLocations(
          locationItems.filter((item) => item.location.status === 'active')
        );
        setDestinations(
          destinationItems.filter(
            (item) => item.destination.status === 'active'
          )
        );
        const firstDestination = destinationItems.find(
          (item) => item.destination.status === 'active'
        );
        if (firstDestination) {
          setDestinationId(firstDestination.destination.id);
        }
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar os destinos.'
        );
      })
      .finally(() => {
        if (active) setLoadingStructure(false);
      });

    return () => {
      active = false;
    };
  }, [workspaceId]);

  const localOptions = useMemo(
    () => locations.filter(
      (item) =>
        item.location.kind === 'LOCAL'
        && item.location.depotId === depotId
    ),
    [locations, depotId]
  );
  const subpositionOptions = useMemo(
    () => locations.filter(
      (item) =>
        item.location.kind === 'SUBPOSITION'
        && item.location.depotId === depotId
        && item.location.parentLocationId === locationId
    ),
    [locations, depotId, locationId]
  );

  const buildPosition = (): WarehouseStockPosition | null => {
    if (!depotId || !locationId) return null;
    if (subpositionId) {
      return {
        kind: 'SUBPOSITION',
        depotId,
        locationId,
        subpositionId,
      };
    }
    return {
      kind: 'LOCATION',
      depotId,
      locationId,
      subpositionId: null,
    };
  };

  const addDestination = async () => {
    const name = newDestinationName.trim();
    if (!name || working || creatingDestination) return;

    setCreatingDestination(true);
    setError(null);
    try {
      const destination = await createWarehouseDestination(workspaceId, {
        name,
      });
      setDestinations((currentItems) =>
        [
          ...currentItems.filter(
            (item) => item.destination.id !== destination.id
          ),
          {
            destination,
            createdAt: null,
            updatedAt: null,
          },
        ].sort((left, right) =>
          left.destination.name.localeCompare(
            right.destination.name,
            'pt-BR'
          )
        )
      );
      setDestinationId(destination.id);
      setNewDestinationName('');
    } catch (createError) {
      setError(
        immediateConsumptionErrorMessage(createError)
        || 'Não foi possível cadastrar o destino operacional.'
      );
    } finally {
      setCreatingDestination(false);
    }
  };

  const runBulk = async () => {
    setError(null);
    setFailures([]);

    if (coverageLimited) {
      setError(
        'A fila canônica atingiu o limite de consulta. Para não deixar NFs do Pregão de fora, a ação em lote foi bloqueada até a cobertura estar completa.'
      );
      return;
    }
    if (!eligibleRows.length) {
      setError(
        subjectKind === 'pregao'
          ? 'Não há itens pendentes neste Pregão.'
          : 'Não há itens pendentes nesta NF.'
      );
      return;
    }
    if (!confirmed) {
      setError('Confirme a ação em lote antes de continuar.');
      return;
    }

    const position = mode === 'storage' ? buildPosition() : null;
    if (mode === 'storage' && !position) {
      setError('Selecione depósito e localização.');
      return;
    }
    if (mode === 'immediate' && !destinationId) {
      setError('Selecione o destino do consumo imediato.');
      return;
    }
    if (mode === 'immediate' && !withdrawnBy.trim()) {
      setError('Informe quem recebeu/retirou os materiais.');
      return;
    }

    setWorking(true);
    setProgress({ completed: 0, total: eligibleRows.length });
    const failed: Array<{
      row: WarehouseInvoiceIntakeQueueRow;
      message: string;
    }> = [];
    let successful = 0;

    for (let index = 0; index < eligibleRows.length; index += 1) {
      const row = eligibleRows[index];
      const operationId = getOrCreateBulkOperationId(
        workspaceId,
        subjectKey,
        mode,
        row.stateId
      );

      try {
        if (mode === 'storage' && position) {
          await allocateWarehousePendingItem(workspaceId, {
            intakeId: row.stateId,
            invoiceRecordKey: row.invoiceRecordKey,
            invoiceId: row.invoiceId,
            empenhoId: row.empenhoId,
            itemId: row.itemId,
            materialId: row.materialId,
            description: row.itemName,
            unitLabel: row.unitLabel,
            supplier: row.supplier,
            receivedQuantity: row.receivedQuantity,
            expectedAllocatedQuantity: row.allocatedQuantity,
            expectedImmediateConsumptionQuantity:
              row.immediateConsumptionQuantity,
            effectiveStatus: row.status,
            quantity: row.pendingQuantity,
            position,
            lotCode: '',
            expiresOn: null,
            barcode: null,
            operationId,
          });
          saveInvoiceDefaultDestination(
            workspaceId,
            row.invoiceRecordKey,
            {
              depotId,
              locationId,
              subpositionId,
            }
          );
        } else {
          await applyWarehouseImmediateConsumption(workspaceId, {
            intakeId: row.stateId,
            invoiceRecordKey: row.invoiceRecordKey,
            invoiceId: row.invoiceId,
            empenhoId: row.empenhoId,
            itemId: row.itemId,
            materialId: row.materialId,
            description: row.itemName,
            unitLabel: row.unitLabel,
            supplier: row.supplier,
            receivedQuantity: row.receivedQuantity,
            expectedAllocatedQuantity: row.allocatedQuantity,
            expectedImmediateConsumptionQuantity:
              row.immediateConsumptionQuantity,
            effectiveStatus: row.status,
            quantity: row.pendingQuantity,
            destinationId,
            withdrawnBy: withdrawnBy.trim(),
            operationId,
          });
        }

        clearBulkOperationId(
          workspaceId,
          subjectKey,
          mode,
          row.stateId
        );
        successful += 1;
      } catch (bulkError) {
        failed.push({
          row,
          message:
            mode === 'storage'
              ? allocationErrorMessage(bulkError)
              : immediateConsumptionErrorMessage(bulkError),
        });
      } finally {
        setProgress({
          completed: index + 1,
          total: eligibleRows.length,
        });
      }
    }

    setFailures(failed);
    setWorking(false);
    await onComplete(successful, failed);
    if (failed.length === 0) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={'Encaminhar ' + subjectLabel}
    >
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <Send className="h-4 w-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em]">
                Encaminhamento em lote
              </p>
            </div>
            <h3 className="mt-1 text-lg font-black text-slate-900">
              {subjectLabel}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {subjectKind === 'pregao'
                ? invoiceCount + ' NF(s) · '
                : ''}
              {eligibleRows.length} item(ns) com quantidade pendente
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {coverageLimited && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-5 text-rose-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              A consulta de NFs está limitada. O EMPROVEX não executará uma ação chamada
              “todas as NFs do Pregão” sem garantir que todas estão carregadas.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-5 text-rose-700">
              {error}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('storage')}
              disabled={working}
              className={
                mode === 'storage'
                  ? 'rounded-2xl border-2 border-[#00288e] bg-blue-50 p-4 text-left'
                  : 'rounded-2xl border border-slate-200 bg-white p-4 text-left'
              }
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#00288e]" />
                <span className="text-xs font-black text-slate-900">
                  Mesmo local de armazenamento
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                {subjectKind === 'pregao'
                  ? 'Todos os itens pendentes das NFs do Pregão serão alocados no mesmo depósito/localização.'
                  : 'Todos os itens pendentes desta NF serão alocados no mesmo depósito/localização.'}
                {' '}Depois, itens específicos ainda poderão ser movimentados.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('immediate')}
              disabled={working}
              className={
                mode === 'immediate'
                  ? 'rounded-2xl border-2 border-violet-600 bg-violet-50 p-4 text-left'
                  : 'rounded-2xl border border-slate-200 bg-white p-4 text-left'
              }
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-700" />
                <span className="text-xs font-black text-slate-900">
                  Consumo imediato
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                Todo o pendente será classificado como consumo imediato para o mesmo
                destino operacional, sem alocação física no depósito.
              </p>
            </button>
          </div>

          {mode === 'storage' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Depósito
                </span>
                <select
                  value={depotId}
                  onChange={(event) => {
                    setDepotId(event.target.value);
                    setLocationId('');
                    setSubpositionId('');
                  }}
                  disabled={working || loadingStructure}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#00288e] disabled:opacity-50"
                >
                  <option value="">
                    {loadingStructure ? 'Carregando…' : 'Selecione'}
                  </option>
                  {depots.map(({ depot }) => (
                    <option key={depot.id} value={depot.id}>
                      {depot.code} · {depot.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Localização
                </span>
                <select
                  value={locationId}
                  onChange={(event) => {
                    setLocationId(event.target.value);
                    setSubpositionId('');
                  }}
                  disabled={working || !depotId || loadingStructure}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#00288e] disabled:opacity-50"
                >
                  <option value="">Selecione</option>
                  {localOptions.map(({ location }) => (
                    <option key={location.id} value={location.id}>
                      {location.code} · {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Subposição · opcional
                </span>
                <select
                  value={subpositionId}
                  onChange={(event) => setSubpositionId(event.target.value)}
                  disabled={working || !locationId || loadingStructure}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#00288e] disabled:opacity-50"
                >
                  <option value="">Sem subposição</option>
                  {subpositionOptions.map(({ location }) => (
                    <option key={location.id} value={location.id}>
                      {location.code} · {location.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Destino operacional
                  </span>
                  <select
                    value={destinationId}
                    onChange={(event) => setDestinationId(event.target.value)}
                    disabled={working || creatingDestination || loadingStructure}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500 disabled:opacity-50"
                  >
                    <option value="">
                      {loadingStructure
                        ? 'Carregando…'
                        : destinations.length
                          ? 'Selecione'
                          : 'Nenhum destino cadastrado'}
                    </option>
                    {destinations.map(({ destination }) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Recebido / retirado por
                  </span>
                  <input
                    value={withdrawnBy}
                    onChange={(event) => setWithdrawnBy(event.target.value)}
                    placeholder="Ex.: Cb João da Silva"
                    disabled={working}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-violet-700">
                  Novo destino operacional
                </p>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">
                  Cadastre aqui destinos como Cozinha, Padaria, Copa ou outro setor de consumo.
                  O novo destino será selecionado automaticamente.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={newDestinationName}
                    onChange={(event) => setNewDestinationName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void addDestination();
                      }
                    }}
                    placeholder="Ex.: Cozinha"
                    disabled={working || creatingDestination}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => void addDestination()}
                    disabled={
                      working
                      || creatingDestination
                      || !newDestinationName.trim()
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-xs font-black text-violet-700 disabled:opacity-40"
                  >
                    {creatingDestination ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Cadastrar destino
                  </button>
                </div>
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-slate-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={working || coverageLimited}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Confirmo o encaminhamento de <strong>{eligibleRows.length} item(ns)</strong>{' '}
              {subjectKind === 'pregao' ? (
                <>pertencentes a <strong>{invoiceCount} NF(s)</strong> do {subjectLabel}.</>
              ) : (
                <>da <strong>{subjectLabel}</strong>.</>
              )}
              {' '}A execução é atômica por item; se algum item falhar, os anteriores não serão
              revertidos e o EMPROVEX apresentará a lista de falhas.
            </span>
          </label>

          {working && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black text-[#00288e]">
                  Processando {subjectKind === 'pregao' ? 'Pregão' : 'NF'}…
                </span>
                <span className="text-xs font-black text-slate-700">
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-[#00288e] transition-all"
                  style={{
                    width:
                      progress.total > 0
                        ? ((progress.completed / progress.total) * 100) + '%'
                        : '0%',
                  }}
                />
              </div>
            </div>
          )}

          {failures.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-black text-rose-800">
                {failures.length} item(ns) não foram concluídos
              </p>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {failures.map(({ row, message }) => (
                  <div
                    key={row.stateId}
                    className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-[10px] leading-5 text-slate-600"
                  >
                    <strong className="text-slate-800">
                      NF {row.invoiceId} · {row.itemName}
                    </strong>
                    <br />
                    {message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-40"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => void runBulk()}
              disabled={
                working
                || loadingStructure
                || coverageLimited
                || !confirmed
                || eligibleRows.length === 0
              }
              className={
                'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black text-white disabled:opacity-40 '
                + (mode === 'storage' ? 'bg-[#00288e]' : 'bg-violet-700')
              }
            >
              {working ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Encaminhar {subjectKind === 'pregao' ? 'Pregão' : 'NF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceRegistrationQueue({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] =
    useState<WarehouseInvoiceIntakeQueueContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [allocationRow, setAllocationRow] =
    useState<WarehouseInvoiceIntakeQueueRow | null>(null);
  const [immediateRow, setImmediateRow] =
    useState<WarehouseInvoiceIntakeQueueRow | null>(null);
  const [search, setSearch] = useState('');
  const [pregaoFilter, setPregaoFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] =
    useState<InvoiceQueueStatusFilter>('actionable');
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkPregao, setBulkPregao] = useState<string | null>(null);
  const [bulkInvoiceKey, setBulkInvoiceKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setContext(await loadWarehouseInvoiceIntakeQueue(workspaceId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Falha ao consultar as pendências das Notas Fiscais.'
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = context?.rows || [];

  const invoiceGroups = useMemo<WarehouseInvoiceQueueGroup[]>(() => {
    const grouped = new Map<string, WarehouseInvoiceIntakeQueueRow[]>();
    for (const row of rows) {
      const existing = grouped.get(row.invoiceRecordKey) || [];
      existing.push(row);
      grouped.set(row.invoiceRecordKey, existing);
    }

    return Array.from(grouped.entries())
      .map(([invoiceRecordKey, groupRows]) => {
        const first = groupRows[0];
        const processedItems = groupRows.filter(
          (row) => row.status === 'PROCESSED'
        ).length;
        const reconciliationItems = groupRows.filter(
          (row) => row.status === 'RECONCILIATION_REQUIRED'
        ).length;
        const actionableItems = groupRows.filter(
          (row) =>
            row.status === 'PENDING'
            || row.status === 'PARTIALLY_PROCESSED'
        ).length;

        return {
          key: invoiceRecordKey,
          invoiceRecordKey,
          invoiceId: first.invoiceId,
          issueDate: first.issueDate,
          registeredAt: first.registeredAt,
          supplier: first.supplier,
          empenhoId: first.empenhoId,
          pregao: first.pregao,
          rows: groupRows.slice().sort((left, right) =>
            left.itemName.localeCompare(right.itemName, 'pt-BR')
          ),
          totalItems: groupRows.length,
          processedItems,
          actionableItems,
          reconciliationItems,
        };
      })
      .sort((left, right) =>
        (right.registeredAt || right.issueDate || '').localeCompare(
          left.registeredAt || left.issueDate || ''
        )
      );
  }, [rows]);

  const pregaoOptions = useMemo(
    () => Array.from(
      new Set(
        invoiceGroups
          .map((group) => group.pregao?.trim() || '')
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [invoiceGroups]
  );

  const filteredGroups = useMemo(() => {
    const query = normalizeQueueSearch(search);

    return invoiceGroups.filter((group) => {
      if (
        pregaoFilter !== 'ALL'
        && (
          pregaoFilter === 'NONE'
            ? Boolean(group.pregao)
            : group.pregao !== pregaoFilter
        )
      ) {
        return false;
      }

      const status = invoiceGroupStatus(group);
      if (
        statusFilter === 'actionable'
        && group.actionableItems === 0
        && group.reconciliationItems === 0
      ) {
        return false;
      }
      if (statusFilter === 'processed' && status !== 'PROCESSED') {
        return false;
      }
      if (
        statusFilter === 'reconciliation'
        && group.reconciliationItems === 0
      ) {
        return false;
      }

      if (!query) return true;
      return normalizeQueueSearch([
        group.invoiceId,
        group.supplier,
        group.empenhoId,
        group.pregao || '',
        ...group.rows.map((row) => row.itemName),
      ].join(' ')).includes(query);
    });
  }, [invoiceGroups, pregaoFilter, search, statusFilter]);

  const summary = useMemo(() => ({
    invoices: invoiceGroups.length,
    pregaos: pregaoOptions.length,
    actionableInvoices: invoiceGroups.filter(
      (group) => group.actionableItems > 0
    ).length,
    pendingItems: rows.filter(
      (row) =>
        row.status === 'PENDING'
        || row.status === 'PARTIALLY_PROCESSED'
    ).length,
    reconciliationInvoices: invoiceGroups.filter(
      (group) => group.reconciliationItems > 0
    ).length,
  }), [invoiceGroups, pregaoOptions.length, rows]);

  const selectedPregaoRows = useMemo(
    () => bulkPregao
      ? rows.filter((row) => row.pregao === bulkPregao)
      : [],
    [bulkPregao, rows]
  );

  const selectedInvoiceGroup = useMemo(
    () => bulkInvoiceKey
      ? invoiceGroups.find((group) => group.invoiceRecordKey === bulkInvoiceKey) || null
      : null,
    [bulkInvoiceKey, invoiceGroups]
  );

  const toggleInvoice = (key: string) => {
    setExpandedInvoices((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openImmediateAction = (row: WarehouseInvoiceIntakeQueueRow) => {
    if (row.status === 'RECONCILIATION_REQUIRED') {
      setMessage(
        'Este item exige reconciliação antes de qualquer nova classificação logística.'
      );
      return;
    }
    setImmediateRow(row);
  };

  const handleAllocationSuccess = async (
    result: AllocateWarehousePendingItemResult,
    quantity: number
  ) => {
    setAllocationRow(null);
    await refresh();
    setMessage(
      'Alocação confirmada: '
      + formatQuantity(quantity, result.intake.unitLabel)
      + '. Novo pendente: '
      + formatQuantity(result.intake.pendingQuantity, result.intake.unitLabel)
      + '.'
    );
  };

  const handleImmediateSuccess = async (
    result: ApplyWarehouseImmediateConsumptionResult,
    quantity: number
  ) => {
    setImmediateRow(null);
    await refresh();
    setMessage(
      'Consumo imediato confirmado: '
      + formatQuantity(quantity, result.intake.unitLabel)
      + '. Novo pendente: '
      + formatQuantity(result.intake.pendingQuantity, result.intake.unitLabel)
      + '. O registro já integra o relatório operacional SISCOFIS.'
    );
  };

  const handleBulkComplete = async (
    subjectLabel: string,
    successful: number,
    bulkFailures: Array<{
      row: WarehouseInvoiceIntakeQueueRow;
      message: string;
    }>
  ) => {
    await refresh();
    setMessage(
      successful
        + ' item(ns) de ' + subjectLabel + ' concluído(s)'
        + (
          bulkFailures.length
            ? '; ' + bulkFailures.length + ' falharam e permanecem pendentes.'
            : ' sem falhas.'
        )
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Notas Fiscais', summary.invoices, 'NFs carregadas na fila'],
          ['NFs a tratar', summary.actionableInvoices, 'possuem item pendente'],
          ['Itens pendentes', summary.pendingItems, 'visíveis apenas ao detalhar a NF'],
          ['Pregões', summary.pregaos, 'para filtro e encaminhamento em lote'],
          ['Reconciliação', summary.reconciliationInvoices, 'NFs que exigem revisão'],
        ].map(([label, value, description], index) => (
          <div
            key={String(label)}
            className={
              'rounded-2xl border p-4 '
              + (
                index === 4
                  ? 'border-rose-200 bg-rose-50'
                  : index === 1
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-blue-200 bg-white'
              )
            }
          >
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {value}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {description}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <ClipboardList className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Notas Fiscais para alocação
              </p>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              A visualização principal é por NF. Abra somente a nota que deseja tratar;
              os itens aparecem dentro do detalhamento e mantêm suas operações individuais.
            </p>
            {context?.cutoffAt && (
              <p className="mt-1 text-[9px] font-semibold text-slate-400">
                Corte logístico preservado: {new Date(context.cutoffAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Atualizar
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.7fr)_minmax(170px,0.6fr)_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar NF, fornecedor, empenho, pregão ou item"
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#00288e]"
            />
          </label>

          <label className="relative block">
            <ListFilter className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <select
              value={pregaoFilter}
              onChange={(event) => setPregaoFilter(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
              aria-label="Filtrar por Pregão"
            >
              <option value="ALL">Todos os Pregões</option>
              {pregaoOptions.map((pregao) => (
                <option key={pregao} value={pregao}>
                  Pregão {pregao}
                </option>
              ))}
              <option value="NONE">Sem Pregão</option>
            </select>
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as InvoiceQueueStatusFilter)
            }
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e]"
            aria-label="Filtrar por situação"
          >
            <option value="actionable">A tratar</option>
            <option value="all">Todas as situações</option>
            <option value="processed">Tratadas</option>
            <option value="reconciliation">Reconciliação</option>
          </select>

          <button
            type="button"
            onClick={() => {
              if (pregaoFilter !== 'ALL' && pregaoFilter !== 'NONE') {
                setBulkPregao(pregaoFilter);
              }
            }}
            disabled={
              pregaoFilter === 'ALL'
              || pregaoFilter === 'NONE'
              || loading
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
            title={
              pregaoFilter === 'ALL'
                ? 'Selecione um Pregão específico para habilitar'
                : undefined
            }
          >
            <Send className="h-4 w-4" />
            Encaminhar Pregão
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>
            {filteredGroups.length} NF(s) exibida(s) · {rows.length} item(ns) carregado(s)
          </span>
          {pregaoFilter !== 'ALL' && pregaoFilter !== 'NONE' && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-black text-[#00288e]">
              Pregão {pregaoFilter}
            </span>
          )}
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-700">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">
            Consultando NFs e estados logísticos…
          </p>
        ) : invoiceGroups.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Nenhuma NF elegível encontrada na janela consultada.
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Nenhuma NF corresponde aos filtros atuais.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {filteredGroups.map((group) => {
              const expanded = expandedInvoices.has(group.key);
              const status = invoiceGroupStatus(group);
              const progress = group.totalItems > 0
                ? Math.round((group.processedItems / group.totalItems) * 100)
                : 0;

              return (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60"
                >
                  <div className="p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              'rounded-full px-2 py-1 text-[9px] font-black uppercase '
                              + intakeStatusClass(status)
                            }
                          >
                            {intakeStatusLabel(status)}
                          </span>
                          {group.pregao && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-[#00288e]">
                              Pregão {group.pregao}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-slate-400">
                            {formatDate(group.issueDate)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                          <h3 className="text-base font-black text-slate-900">
                            NF {group.invoiceId}
                          </h3>
                          <span className="truncate text-xs font-semibold text-slate-500">
                            {group.supplier}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-500">
                          <span>
                            <strong className="text-slate-700">Empenho:</strong>{' '}
                            {group.empenhoId}
                          </span>
                          <span>
                            <strong className="text-slate-700">Itens:</strong>{' '}
                            {group.totalItems}
                          </span>
                          <span>
                            <strong className="text-slate-700">A tratar:</strong>{' '}
                            {group.actionableItems}
                          </span>
                          {group.reconciliationItems > 0 && (
                            <span className="font-black text-rose-600">
                              {group.reconciliationItems} em reconciliação
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 sm:min-w-56">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wide text-slate-400">
                          <span>Itens concluídos</span>
                          <span>{group.processedItems}/{group.totalItems}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: progress + '%' }}
                          />
                        </div>
                        {group.actionableItems > 0 && (
                          <button
                            type="button"
                            onClick={() => setBulkInvoiceKey(group.invoiceRecordKey)}
                            className="mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Encaminhar NF
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleInvoice(group.key)}
                          aria-expanded={expanded}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-[#00288e]"
                        >
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {expanded ? 'Ocultar itens' : 'Detalhar NF'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-slate-200 bg-white p-4">
                      <div className="space-y-3">
                        {group.rows.map((row) => {
                          const reconciliation = reconciliationMessage(row);
                          const canContinue =
                            row.status === 'PENDING'
                            || row.status === 'PARTIALLY_PROCESSED';

                          return (
                            <div
                              key={row.stateId}
                              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                            >
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={
                                        'rounded-full px-2 py-1 text-[8px] font-black uppercase '
                                        + intakeStatusClass(row.status)
                                      }
                                    >
                                      {intakeStatusLabel(row.status)}
                                    </span>
                                    {!row.persisted && row.status === 'PENDING' && (
                                      <span className="text-[8px] font-bold text-slate-400">
                                        estado inicial
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-sm font-black text-slate-800">
                                    {row.itemName}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
                                    <span>
                                      Recebido:{' '}
                                      <strong>{formatQuantity(row.receivedQuantity, row.unitLabel)}</strong>
                                    </span>
                                    <span>
                                      Alocado:{' '}
                                      <strong>{formatQuantity(row.allocatedQuantity, row.unitLabel)}</strong>
                                    </span>
                                    <span>
                                      Consumo imediato:{' '}
                                      <strong>{formatQuantity(row.immediateConsumptionQuantity, row.unitLabel)}</strong>
                                    </span>
                                    <span className="text-amber-700">
                                      Pendente:{' '}
                                      <strong>{formatQuantity(row.pendingQuantity, row.unitLabel)}</strong>
                                    </span>
                                  </div>
                                </div>

                                {canContinue && (
                                  <div className="flex shrink-0 flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setAllocationRow(row)}
                                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white"
                                    >
                                      <PackagePlus className="h-3.5 w-3.5" />
                                      Alocar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openImmediateAction(row)}
                                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[10px] font-black text-violet-700"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                      Consumo imediato
                                    </button>
                                  </div>
                                )}
                              </div>

                              {reconciliation && (
                                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] leading-5 text-rose-700">
                                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  {reconciliation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {context?.truncated && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Parte da consulta auxiliar atingiu o limite de segurança. A visualização
            continua disponível. O encaminhamento por Pregão só será bloqueado se a
            cobertura de NFs ou de empenhos/Pregões estiver realmente incompleta.
          </div>
        )}
      </div>

      {allocationRow && (
        <AllocationPanel
          workspaceId={workspaceId}
          row={allocationRow}
          onClose={() => setAllocationRow(null)}
          onSuccess={handleAllocationSuccess}
        />
      )}

      {immediateRow && (
        <WarehouseImmediateConsumptionPanel
          workspaceId={workspaceId}
          row={immediateRow}
          onClose={() => setImmediateRow(null)}
          onSuccess={handleImmediateSuccess}
        />
      )}

      {bulkPregao && (
        <IntakeBulkActionPanel
          workspaceId={workspaceId}
          subjectKind="pregao"
          subjectKey={'pregao:' + bulkPregao}
          subjectLabel={'Pregão ' + bulkPregao}
          rows={selectedPregaoRows}
          coverageLimited={Boolean(context?.pregaoCoverageLimited)}
          onClose={() => setBulkPregao(null)}
          onComplete={(successful, failures) =>
            handleBulkComplete('Pregão ' + bulkPregao, successful, failures)
          }
        />
      )}

      {selectedInvoiceGroup && (
        <IntakeBulkActionPanel
          workspaceId={workspaceId}
          subjectKind="invoice"
          subjectKey={'invoice:' + selectedInvoiceGroup.invoiceRecordKey}
          subjectLabel={'NF ' + selectedInvoiceGroup.invoiceId}
          rows={selectedInvoiceGroup.rows}
          coverageLimited={false}
          onClose={() => setBulkInvoiceKey(null)}
          onComplete={(successful, failures) =>
            handleBulkComplete(
              'NF ' + selectedInvoiceGroup.invoiceId,
              successful,
              failures
            )
          }
        />
      )}
    </div>
  );
}

function ImmediateConsumptionReport({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<WarehouseItemIntakeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listWarehouseItemIntakes(workspaceId, 500);
      setItems(all.filter((entry) => entry.intake.mode === 'IMMEDIATE_CONSUMPTION'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pending = items.filter((entry) => entry.intake.siscofisStatus === 'PENDING');

  const copyReport = async () => {
    const lines = [
      'EMPROVEX · ADM Depósito · Consumo imediato para lançamento no SISCOFIS',
      '',
      ...pending.map(({ intake }) =>
        [
          'NF ' + intake.invoiceId,
          'Empenho ' + intake.empenhoId,
          intake.description,
          intake.quantity.toLocaleString('pt-BR') + ' ' + intake.unitLabel,
        ].join(' · ')
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setMessage('Relatório pendente copiado.');
    } catch {
      setMessage('Não foi possível copiar o relatório automaticamente.');
    }
  };

  const markPosted = async (id: string) => {
    setWorkingId(id);
    setMessage(null);
    try {
      await markWarehouseImmediateConsumptionPosted(workspaceId, id);
      setMessage('Item marcado como lançado no SISCOFIS.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao atualizar o registro.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-700">
              <ClipboardCheck className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Histórico legado de consumo imediato
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Esta subaba preserva registros do contrato legado. Novas classificações e a
              fila operacional SISCOFIS são consolidadas em Controle de Itens → Saída de
              Material → Relatórios.
            </p>
          </div>
          <button
            type="button"
            onClick={copyReport}
            disabled={!pending.length}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-xs font-black text-violet-700 disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar pendências
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-black uppercase text-slate-400">Pendentes</p>
            <p className="mt-1 text-xl font-black text-slate-900">{pending.length}</p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-black uppercase text-slate-400">Já lançados</p>
            <p className="mt-1 text-xl font-black text-slate-900">{items.length - pending.length}</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-slate-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Carregando relatório…
        </div>
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-400">
          Nenhum item classificado como consumo imediato.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(({ intake, createdAt }) => (
            <div
              key={intake.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      intake.siscofisStatus === 'PENDING'
                        ? 'rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700'
                        : 'rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700'
                    }
                  >
                    {intake.siscofisStatus === 'PENDING' ? 'A lançar' : 'Lançado'}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    NF {intake.invoiceId} · {createdAt ? new Date(createdAt).toLocaleString('pt-BR') : 'registro atual'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-slate-800">{intake.description}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Empenho {intake.empenhoId} · {intake.quantity.toLocaleString('pt-BR')} {intake.unitLabel}
                </p>
              </div>
              {intake.siscofisStatus === 'PENDING' && (
                <button
                  type="button"
                  disabled={workingId === intake.id}
                  onClick={() => void markPosted(intake.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00288e] px-3 text-[10px] font-black text-white disabled:opacity-50"
                >
                  {workingId === intake.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Marcar como lançado
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WarehouseItemRegistrationOperational({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('aba');
  const requestedTab: RegistrationTab =
    requested === 'itens-armazenados'
      ? 'stored'
      : requested === 'siscofis'
        ? 'siscofis'
        : requested === 'consumo-imediato'
          ? 'immediate'
          : 'invoices';
  const [tab, setTab] = useState<RegistrationTab>(requestedTab);

  useEffect(() => {
    setTab(requestedTab);
  }, [requestedTab]);

  return (
    <div className="mt-4 space-y-5" data-testid="warehouse-registration-operational">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('invoices')}
          className={
            tab === 'invoices'
              ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm'
              : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'
          }
        >
          Notas Fiscais pendentes
        </button>
        <button
          type="button"
          onClick={() => setTab('stored')}
          className={
            tab === 'stored'
              ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm'
              : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'
          }
        >
          Itens armazenados
        </button>
        <button
          type="button"
          onClick={() => setTab('siscofis')}
          className={
            tab === 'siscofis'
              ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm'
              : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'
          }
        >
          Migração SISCOFIS
        </button>
        <button
          type="button"
          onClick={() => setTab('immediate')}
          className={
            tab === 'immediate'
              ? 'rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm'
              : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500'
          }
        >
          Histórico legado / SISCOFIS
        </button>
      </div>

      {tab === 'invoices' && <InvoiceRegistrationQueue workspaceId={workspaceId} />}
      {tab === 'stored' && <WarehouseAllocatedItemsOperational workspaceId={workspaceId} />}
      {tab === 'siscofis' && <WarehouseSiscofisOperational workspaceId={workspaceId} />}
      {tab === 'immediate' && <ImmediateConsumptionReport workspaceId={workspaceId} />}
    </div>
  );
}
