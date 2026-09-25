'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Barcode,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  MapPin,
  PackagePlus,
  RefreshCw,
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
import type { ApplyWarehouseImmediateConsumptionResult } from '../../../lib/warehouse/withdrawalRepository';

type RegistrationTab = 'invoices' | 'siscofis' | 'immediate';

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
  const [quantity, setQuantity] = useState(String(row.pendingQuantity));
  const [depotId, setDepotId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [subpositionId, setSubpositionId] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
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
    if (!lotCode.trim()) {
      setError('Informe o lote para concluir a alocação.');
      return;
    }
    if (!noExpiry && !expiresOn) {
      setError('Informe a validade ou marque explicitamente Sem validade.');
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
        expiresOn: noExpiry ? null : expiresOn,
        barcode: barcode.trim() || null,
        operationId,
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
                Lote
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

            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Validade
              </span>
              <input
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                disabled={noExpiry}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#00288e] disabled:bg-slate-100 disabled:text-slate-400"
              />
              <label className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={noExpiry}
                  onChange={(event) => {
                    setNoExpiry(event.target.checked);
                    if (event.target.checked) setExpiresOn('');
                  }}
                />
                Sem validade
              </label>
            </div>

            <label className="block lg:col-span-2">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                <Barcode className="h-3.5 w-3.5" />
                Código de barras — opcional
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
              <p><span className="font-black">Lote:</span> {lotCode.trim() || '—'}</p>
              <p>
                <span className="font-black">Validade:</span>{' '}
                {noExpiry ? 'Sem validade' : expiresOn ? formatDate(expiresOn) : '—'}
              </p>
              <p className="sm:col-span-2">
                <span className="font-black">Barcode:</span> {barcode.trim() || 'Não informado'}
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

function InvoiceRegistrationQueue({ workspaceId }: { workspaceId: string }) {
  const [context, setContext] =
    useState<WarehouseInvoiceIntakeQueueContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [allocationRow, setAllocationRow] =
    useState<WarehouseInvoiceIntakeQueueRow | null>(null);
  const [immediateRow, setImmediateRow] =
    useState<WarehouseInvoiceIntakeQueueRow | null>(null);

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
  const summary = useMemo(() => ({
    pending: rows.filter((row) => row.status === 'PENDING').length,
    partial: rows.filter((row) => row.status === 'PARTIALLY_PROCESSED').length,
    processed: rows.filter((row) => row.status === 'PROCESSED').length,
    reconciliation: rows.filter(
      (row) => row.status === 'RECONCILIATION_REQUIRED'
    ).length,
  }), [rows]);

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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-500">
            Itens de NF
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">{rows.length}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            lidos do EMPROVEX em modo somente leitura
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-600">
            Pendentes
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.pending}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">nenhuma quantidade tratada</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-white p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">
            Parciais
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.partial}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">ainda possuem saldo de tratamento</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600">
            Tratados
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.processed}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">pendência logística zerada</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-rose-600">
            Reconciliação
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.reconciliation}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">fonte canônica divergente ou legado</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <ClipboardList className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Fila de Notas Fiscais
              </p>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              Cada item recebido possui identidade logística estável. O motor distingue
              recebido, alocado, consumo imediato e pendente sem escrever de volta na NF.
            </p>
            <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-400">
              A ausência de documento warehouse representa o estado inicial Pendente.
              A persistência versionada começa quando houver tratamento logístico.
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

        {message && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-700">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">
            Consultando NFs e estados logísticos…
          </p>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Nenhum item de NF elegível encontrado na janela consultada.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((row) => {
              const reconciliation = reconciliationMessage(row);
              const canContinue =
                row.status === 'PENDING'
                || row.status === 'PARTIALLY_PROCESSED';

              return (
                <div
                  key={row.stateId}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              'rounded-full px-2 py-1 text-[9px] font-black uppercase '
                              + intakeStatusClass(row.status)
                            }
                          >
                            {intakeStatusLabel(row.status)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            NF {row.invoiceId} · {formatDate(row.issueDate)}
                          </span>
                          {!row.persisted && row.status === 'PENDING' && (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[8px] font-black uppercase text-slate-400">
                              estado inicial derivado
                            </span>
                          )}
                        </div>

                        <p className="mt-2 truncate text-sm font-black text-slate-800">
                          {row.itemName}
                        </p>
                        <div className="mt-2 grid gap-1 text-[10px] text-slate-500 sm:grid-cols-2">
                          <p>
                            <span className="font-black text-slate-600">Fornecedor:</span>{' '}
                            {row.supplier}
                          </p>
                          <p>
                            <span className="font-black text-slate-600">Empenho:</span>{' '}
                            {row.empenhoId}
                          </p>
                          <p>
                            <span className="font-black text-slate-600">Material:</span>{' '}
                            {row.itemName}
                          </p>
                          <p>
                            <span className="font-black text-slate-600">ID material:</span>{' '}
                            {row.materialId || 'a resolver'}
                          </p>
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
                            Alocar no depósito
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

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Recebido
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {formatQuantity(row.receivedQuantity, row.unitLabel)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Alocado
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {formatQuantity(row.allocatedQuantity, row.unitLabel)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Consumo imediato
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {formatQuantity(row.immediateConsumptionQuantity, row.unitLabel)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-amber-600">
                          Pendente
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-800">
                          {formatQuantity(row.pendingQuantity, row.unitLabel)}
                        </p>
                      </div>
                    </div>

                    {reconciliation && (
                      <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] leading-5 text-rose-700">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {reconciliation}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {context?.truncated && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A consulta atingiu um limite bounded. O motor não conclui sobre registros fora da janela carregada.
          </div>
        )}

        {context?.reconciliationCoverageLimited && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] leading-5 text-slate-600">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Como a janela canônica de NFs está limitada, ausência de NF fora dessa janela não é interpretada como exclusão.
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
    requested === 'siscofis'
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
      {tab === 'siscofis' && <WarehouseSiscofisOperational workspaceId={workspaceId} />}
      {tab === 'immediate' && <ImmediateConsumptionReport workspaceId={workspaceId} />}
    </div>
  );
}
