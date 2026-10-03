'use client';

import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getWarehouseBarcodeByCode } from '../../../lib/warehouse/barcodeRepository';
import { deriveWarehouseMaterialIdForEmpenhoItem } from '../../../lib/warehouse/invoiceIntegration';
import { allocateWarehousePendingItemFast } from '../../../lib/warehouse/intakeActionClient';
import {
  loadWarehouseInvoiceIntakeQueue,
  type WarehouseInvoiceIntakeQueueContext,
  type WarehouseInvoiceIntakeQueueRow,
} from '../../../lib/warehouse/intakeStateRepository';
import { resolveWarehouseStockPositionBarcode } from '../../../lib/warehouse/locationBarcodeResolver';
import { classifyWarehouseMobileLocationScan } from '../../../lib/warehouse/mobileLocationScan';
import {
  classifyWarehouseMobileProductScan,
  createWarehouseMobileAllocationOperationId,
  normalizeWarehouseMobileAllocationQuantity,
  shouldRefreshWarehouseMobileAllocationAfterError,
  warehouseMobileBarcodeDisposition,
} from '../../../lib/warehouse/mobileIntakeAllocation';
import type { WarehouseStockPosition } from '../../../lib/warehouse/location';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { warehouseAllocationErrorMessage } from '../components/warehouseIntakePresentation';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ProductResolution =
  | { status: 'idle' }
  | { status: 'resolving'; code: string }
  | { status: 'known'; code: string }
  | { status: 'unknown'; code: string; confirmed: boolean }
  | { status: 'blocked'; code: string; message: string };

type PositionResolution =
  | { status: 'idle' }
  | { status: 'resolving'; code: string }
  | {
      status: 'resolved';
      code: string;
      position: WarehouseStockPosition;
      label: string;
    }
  | { status: 'error'; code: string; message: string };

function formatQuantity(value: number, unitLabel: string): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 6,
  }).format(value) + ' ' + unitLabel;
}

function positionErrorMessage(error: string): string {
  if (error === 'DEPOT_NOT_STOCK_POSITION') {
    return 'A etiqueta identifica um depósito. Leia um LOCAL ou uma SUBPOSIÇÃO.';
  }
  if (error === 'WORKSPACE_MISMATCH' || error === 'UG_MISMATCH') {
    return 'A etiqueta não pertence ao workspace/UG atual.';
  }
  if (error === 'ENTITY_INACTIVE') {
    return 'A posição existe, mas está inativa.';
  }
  if (error === 'ENTITY_NOT_FOUND') {
    return 'A posição não existe mais no cadastro autoritativo.';
  }
  if (error === 'HIERARCHY_INVALID' || error === 'ENTITY_KIND_MISMATCH') {
    return 'A hierarquia física da etiqueta não é válida.';
  }
  return 'A posição não pôde ser revalidada. Confira a etiqueta e a conexão.';
}

function stepClass(active: boolean): string {
  return active
    ? 'border-blue-200 bg-blue-50 text-[#00288e]'
    : 'border-slate-200 bg-slate-50 text-slate-500';
}

export function WarehouseMobileIntakeAllocation() {
  const workspace = useWarehouseWorkspaceContext();
  const productRequestIdRef = useRef(0);
  const positionRequestIdRef = useRef(0);

  const [queue, setQueue] = useState<WarehouseInvoiceIntakeQueueContext | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<WarehouseInvoiceIntakeQueueRow | null>(null);
  const [quantity, setQuantity] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [productResolution, setProductResolution] = useState<ProductResolution>({ status: 'idle' });
  const [positionResolution, setPositionResolution] = useState<PositionResolution>({ status: 'idle' });
  const [operationId, setOperationId] = useState('');
  const [working, setWorking] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  const renewOperationId = useCallback(() => {
    setOperationId(createWarehouseMobileAllocationOperationId());
  }, []);

  const reloadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const next = await loadWarehouseInvoiceIntakeQueue(workspace.workspaceId);
      setQueue(next);
    } catch (error) {
      setQueueError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar as NFs pendentes.'
      );
    } finally {
      setLoadingQueue(false);
    }
  }, [workspace.workspaceId]);

  useEffect(() => {
    void reloadQueue();
  }, [reloadQueue]);

  const actionableRows = useMemo(
    () => (queue?.rows || []).filter(
      (row) =>
        row.pendingQuantity > 0.000001
        && row.status !== 'PROCESSED'
        && row.status !== 'RECONCILIATION_REQUIRED'
    ),
    [queue]
  );

  const blockedCount = useMemo(
    () => (queue?.rows || []).filter(
      (row) => row.status === 'RECONCILIATION_REQUIRED'
    ).length,
    [queue]
  );

  const invoiceGroups = useMemo(() => {
    const groups = new Map<string, WarehouseInvoiceIntakeQueueRow[]>();
    for (const row of actionableRows) {
      const current = groups.get(row.invoiceRecordKey) || [];
      current.push(row);
      groups.set(row.invoiceRecordKey, current);
    }
    return Array.from(groups.entries()).map(([key, rows]) => ({
      key,
      invoiceId: rows[0]?.invoiceId || '—',
      supplier: rows[0]?.supplier || 'Fornecedor não informado',
      empenhoId: rows[0]?.empenhoId || '—',
      rows,
    }));
  }, [actionableRows]);

  const resetDraftForRow = useCallback((row: WarehouseInvoiceIntakeQueueRow) => {
    productRequestIdRef.current += 1;
    positionRequestIdRef.current += 1;
    setSelectedRow(row);
    setQuantity(String(row.pendingQuantity));
    setLotCode('');
    setExpiresOn('');
    setProductResolution({ status: 'idle' });
    setPositionResolution({ status: 'idle' });
    setOperationId(createWarehouseMobileAllocationOperationId());
    setAllocationError(null);
  }, []);

  const selectRow = (row: WarehouseInvoiceIntakeQueueRow) => {
    setLastSuccess(null);
    resetDraftForRow(row);
  };

  const numericQuantity = selectedRow
    ? normalizeWarehouseMobileAllocationQuantity(quantity, selectedRow.pendingQuantity)
    : null;

  const productReady =
    productResolution.status === 'known'
    || (
      productResolution.status === 'unknown'
      && productResolution.confirmed
    );

  const productBarcode = productResolution.status === 'known'
    || productResolution.status === 'unknown'
    ? productResolution.code
    : null;

  const resolveProduct = useCallback((event: WarehouseMobileScanEvent) => {
    if (!selectedRow) return;
    const requestId = productRequestIdRef.current + 1;
    productRequestIdRef.current = requestId;
    renewOperationId();
    setAllocationError(null);
    setProductResolution({ status: 'resolving', code: event.value });

    void (async () => {
      const expectedMaterialId = selectedRow.materialId
        || await deriveWarehouseMaterialIdForEmpenhoItem(
          workspace.workspaceId,
          selectedRow.empenhoId,
          selectedRow.itemId
        );
      const association = await getWarehouseBarcodeByCode(
        workspace.workspaceId,
        event.value
      );
      if (requestId !== productRequestIdRef.current) return;

      const disposition = warehouseMobileBarcodeDisposition(
        association,
        expectedMaterialId
      );
      if (disposition === 'CONFLICT') {
        setProductResolution({
          status: 'blocked',
          code: event.value,
          message: 'Este código já pertence a outro material. A associação não pode ser alterada nesta operação.',
        });
        return;
      }
      if (disposition === 'INACTIVE') {
        setProductResolution({
          status: 'blocked',
          code: event.value,
          message: 'Este código existe, mas está inativo. Regularize o cadastro antes de alocar.',
        });
        return;
      }
      if (disposition === 'UNKNOWN') {
        setProductResolution({
          status: 'unknown',
          code: event.value,
          confirmed: false,
        });
        return;
      }
      setProductResolution({ status: 'known', code: event.value });
    })().catch(() => {
      if (requestId !== productRequestIdRef.current) return;
      setProductResolution({
        status: 'blocked',
        code: event.value,
        message: 'Falha ao consultar o barcode autoritativo. Verifique a conexão e tente novamente.',
      });
    });
  }, [renewOperationId, selectedRow, workspace.workspaceId]);

  const resolvePosition = useCallback((event: WarehouseMobileScanEvent) => {
    const requestId = positionRequestIdRef.current + 1;
    positionRequestIdRef.current = requestId;
    renewOperationId();
    setAllocationError(null);

    if (!workspace.ug) {
      setPositionResolution({
        status: 'error',
        code: event.value,
        message: 'A UG operacional não está resolvida. Reabra a Central e tente novamente.',
      });
      return;
    }

    setPositionResolution({ status: 'resolving', code: event.value });
    void resolveWarehouseStockPositionBarcode({
      code: event.value,
      workspaceId: workspace.workspaceId,
      ug: workspace.ug,
    }).then((result) => {
      if (requestId !== positionRequestIdRef.current) return;
      if (!result.ok) {
        setPositionResolution({
          status: 'error',
          code: event.value,
          message: positionErrorMessage(result.error),
        });
        return;
      }

      const labels = [
        [result.value.depot.code, result.value.depot.name].filter(Boolean).join(' · '),
        result.value.parentLocation
          ? [result.value.parentLocation.code, result.value.parentLocation.name].filter(Boolean).join(' · ')
          : null,
        result.value.location
          ? [result.value.location.code, result.value.location.name].filter(Boolean).join(' · ')
          : null,
      ].filter((value): value is string => Boolean(value));

      setPositionResolution({
        status: 'resolved',
        code: event.value,
        position: result.value.position,
        label: labels.join(' → '),
      });
    }).catch(() => {
      if (requestId !== positionRequestIdRef.current) return;
      setPositionResolution({
        status: 'error',
        code: event.value,
        message: 'Falha ao revalidar a posição. Verifique a conexão e tente novamente.',
      });
    });
  }, [renewOperationId, workspace.ug, workspace.workspaceId]);

  const confirmAllocation = async () => {
    if (
      !selectedRow
      || numericQuantity === null
      || !productReady
      || !productBarcode
      || positionResolution.status !== 'resolved'
      || !operationId
    ) {
      setAllocationError('Complete quantidade, leitura do material e leitura do local antes de confirmar.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setAllocationError(
        'Sem conexão. O rascunho foi mantido e nenhuma operação foi considerada concluída.'
      );
      return;
    }

    setWorking(true);
    setAllocationError(null);

    try {
      const result = await allocateWarehousePendingItemFast(
        workspace.workspaceId,
        {
          intakeId: selectedRow.stateId,
          invoiceRecordKey: selectedRow.invoiceRecordKey,
          invoiceId: selectedRow.invoiceId,
          empenhoId: selectedRow.empenhoId,
          itemId: selectedRow.itemId,
          materialId: selectedRow.materialId,
          description: selectedRow.itemName,
          unitLabel: selectedRow.unitLabel,
          supplier: selectedRow.supplier,
          receivedQuantity: selectedRow.receivedQuantity,
          expectedAllocatedQuantity: selectedRow.allocatedQuantity,
          expectedImmediateConsumptionQuantity:
            selectedRow.immediateConsumptionQuantity,
          effectiveStatus: selectedRow.status,
          quantity: numericQuantity,
          position: positionResolution.position,
          lotCode: lotCode.trim(),
          expiresOn: expiresOn || null,
          barcode: productBarcode,
          operationId,
        }
      );

      const updatedRow: WarehouseInvoiceIntakeQueueRow = {
        ...selectedRow,
        materialId: result.intake.materialId,
        allocatedQuantity: result.intake.allocatedQuantity,
        immediateConsumptionQuantity: result.intake.immediateConsumptionQuantity,
        pendingQuantity: result.intake.pendingQuantity,
        status: result.intake.status,
        persisted: true,
        source: 'STATE_V2',
        reconciliationReason: null,
      };

      setQueue((current) => current
        ? {
            ...current,
            rows: current.rows.map((row) =>
              row.stateId === updatedRow.stateId ? updatedRow : row
            ),
          }
        : current
      );

      const actionLabel = result.applied
        ? 'Alocação confirmada'
        : 'Confirmação já registrada anteriormente';

      if (updatedRow.pendingQuantity > 0.000001) {
        setLastSuccess(
          actionLabel
          + '. Restam '
          + formatQuantity(updatedRow.pendingQuantity, updatedRow.unitLabel)
          + ' para este item.'
        );
        resetDraftForRow(updatedRow);
      } else {
        setLastSuccess(actionLabel + '. Item totalmente tratado.');
        setSelectedRow(null);
        setQuantity('');
        setLotCode('');
        setExpiresOn('');
        setProductResolution({ status: 'idle' });
        setPositionResolution({ status: 'idle' });
        setOperationId('');
      }
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Falha de conexão. O rascunho foi preservado; confirme novamente somente após reconectar.'
        : warehouseAllocationErrorMessage(error);
      setAllocationError(message);

      if (shouldRefreshWarehouseMobileAllocationAfterError(error)) {
        await reloadQueue();
        setSelectedRow(null);
        setLastSuccess(
          'O estado autoritativo mudou. A fila foi recarregada; selecione o item novamente antes de continuar.'
        );
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="warehouse-mobile-intake-allocation">
      <section className="rounded-3xl bg-[linear-gradient(135deg,#03102a_0%,#00288e_100%)] px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-blue-200">
              MOBILE-C · ALLOCATE oficial
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight">
              Alocar recebimento
            </h1>
            <p className="mt-2 text-xs font-semibold leading-5 text-blue-100/90">
              NF → item → quantidade → material → validade → local → revisão.
            </p>
          </div>
          <Link
            href="/central-mobile"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10"
            aria-label="Voltar ao início da Central Móvel"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {lastSuccess && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-5 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          {lastSuccess}
        </div>
      )}

      {!selectedRow ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                Passo 1
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-950">
                NF e item pendentes
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void reloadQueue()}
              disabled={loadingQueue}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={loadingQueue ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Atualizar
            </button>
          </div>

          {queueError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold leading-5 text-rose-800">
              {queueError}
            </div>
          )}

          {blockedCount > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-900">
              {blockedCount} item(ns) exigem reconciliação e não podem ser alocados pelo fluxo móvel.
            </div>
          )}

          {loadingQueue && !queue ? (
            <div className="flex min-h-36 items-center justify-center rounded-3xl border border-slate-200 bg-white">
              <LoaderCircle className="h-6 w-6 animate-spin text-[#00288e]" />
            </div>
          ) : invoiceGroups.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center">
              <PackageCheck className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-3 text-sm font-black text-slate-900">
                Nenhum item pendente para alocação
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                A lista é carregada sob demanda e não mantém listener permanente.
              </p>
            </div>
          ) : (
            invoiceGroups.map((group) => (
              <div
                key={group.key}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-black text-slate-900">NF {group.invoiceId}</p>
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                    Empenho {group.empenhoId} · {group.supplier}
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.rows.map((row) => (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => selectRow(row)}
                      className="flex min-h-20 w-full items-center justify-between gap-4 px-4 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-black leading-5 text-slate-900">
                          {row.itemName}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">
                          Item {row.itemId} · pendente {formatQuantity(row.pendingQuantity, row.unitLabel)}
                        </p>
                      </div>
                      <ClipboardList className="h-5 w-5 shrink-0 text-[#00288e]" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => {
              productRequestIdRef.current += 1;
              positionRequestIdRef.current += 1;
              setSelectedRow(null);
              setAllocationError(null);
            }}
            disabled={working}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Trocar NF/item
          </button>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-[#00288e]/70">
              NF {selectedRow.invoiceId} · item {selectedRow.itemId}
            </p>
            <p className="mt-2 text-base font-black leading-6 text-slate-950">
              {selectedRow.itemName}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Pendente atual: {formatQuantity(selectedRow.pendingQuantity, selectedRow.unitLabel)}
            </p>
          </div>

          {allocationError && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold leading-5 text-rose-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {allocationError}
            </div>
          )}

          <div className="grid grid-cols-5 gap-1">
            {[
              ['1', true],
              ['2', numericQuantity !== null],
              ['3', productReady],
              ['4', productReady],
              ['5', positionResolution.status === 'resolved'],
            ].map(([label, active]) => (
              <div
                key={String(label)}
                className={'rounded-xl border px-2 py-2 text-center text-[9px] font-black ' + stepClass(Boolean(active))}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              1 · Quantidade
            </p>
            <input
              type="number"
              min="0.000001"
              max={selectedRow.pendingQuantity}
              step="any"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                renewOperationId();
                setAllocationError(null);
              }}
              className="mt-3 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-base font-black text-slate-900 outline-none focus:border-[#00288e]"
            />
            <p className="mt-2 text-[10px] font-semibold text-slate-500">
              Máximo: {formatQuantity(selectedRow.pendingQuantity, selectedRow.unitLabel)}
            </p>
            {numericQuantity === null && (
              <p className="mt-2 text-xs font-bold text-amber-700">
                Informe quantidade maior que zero e limitada ao pendente atual.
              </p>
            )}
          </div>

          {numericQuantity !== null && (
            <div className="space-y-3">
              <div className="px-1">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  2 · LER MATERIAL
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Barcode conhecido deve pertencer a este material. Barcode desconhecido exige associação explícita.
                </p>
              </div>
              <WarehouseMobileScanner
                expectation="EXPECT_PRODUCT"
                identifyScan={classifyWarehouseMobileProductScan}
                onValidatedScan={resolveProduct}
                title="LER MATERIAL"
              />

              {productResolution.status === 'resolving' && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-900">
                  Consultando associação do barcode…
                </div>
              )}
              {productResolution.status === 'known' && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-sm font-black text-emerald-950">Material validado</p>
                    <p className="mt-1 break-all font-mono text-[10px] font-bold text-emerald-800">
                      {productResolution.code}
                    </p>
                  </div>
                </div>
              )}
              {productResolution.status === 'unknown' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-950">
                    Barcode ainda não cadastrado
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                    A associação só será gravada atomicamente pelo ALLOCATE oficial se a alocação for confirmada.
                  </p>
                  <button
                    type="button"
                    onClick={() => setProductResolution({
                      ...productResolution,
                      confirmed: true,
                    })}
                    disabled={productResolution.confirmed}
                    className="mt-3 min-h-11 w-full rounded-2xl bg-amber-900 px-4 text-xs font-black text-white disabled:opacity-55"
                  >
                    {productResolution.confirmed
                      ? 'Associação autorizada'
                      : 'Associar este código ao material do item'}
                  </button>
                </div>
              )}
              {productResolution.status === 'blocked' && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-black text-rose-950">Barcode recusado</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-rose-800">
                    {productResolution.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {productReady && (
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                3 · Lote / validade
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                O lote técnico é criado/reutilizado pelo ALLOCATE oficial. Informe a validade quando aplicável.
              </p>
              <label className="mt-3 block">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Lote · opcional
                </span>
                <input
                  type="text"
                  maxLength={80}
                  value={lotCode}
                  onChange={(event) => {
                    setLotCode(event.target.value);
                    renewOperationId();
                    setAllocationError(null);
                  }}
                  placeholder="Ex.: LOTE-2026-10"
                  autoComplete="off"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-900 outline-none focus:border-[#00288e]"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Validade · opcional
                </span>
                <input
                  type="date"
                  value={expiresOn}
                onChange={(event) => {
                  setExpiresOn(event.target.value);
                  renewOperationId();
                  setAllocationError(null);
                }}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-900 outline-none focus:border-[#00288e]"
                />
              </label>
              <p className="mt-2 text-[10px] font-semibold text-slate-500">
                Lote vazio usa a referência técnica oficial. Sem validade informada é permitido pelo contrato vigente.
              </p>
            </div>
          )}

          {productReady && (
            <div className="space-y-3">
              <div className="px-1">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  4 · LER LOCAL
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Apenas LOCAL ou SUBPOSIÇÃO ativos do workspace/UG atual são aceitos.
                </p>
              </div>
              <WarehouseMobileScanner
                expectation="EXPECT_LOCATION"
                identifyScan={classifyWarehouseMobileLocationScan}
                onValidatedScan={resolvePosition}
                title="LER LOCAL"
              />

              {positionResolution.status === 'resolving' && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-900">
                  Revalidando posição no cadastro autoritativo…
                </div>
              )}
              {positionResolution.status === 'resolved' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-black text-emerald-950">Posição validada</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                    {positionResolution.label}
                  </p>
                </div>
              )}
              {positionResolution.status === 'error' && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-black text-rose-950">Posição recusada</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-rose-800">
                    {positionResolution.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {positionResolution.status === 'resolved' && productReady && numericQuantity !== null && (
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#00288e]">
                5 · Revisar e confirmar
              </p>
              <div className="mt-3 space-y-2 text-xs font-semibold leading-5 text-slate-700">
                <p><span className="font-black">NF:</span> {selectedRow.invoiceId}</p>
                <p><span className="font-black">Item:</span> {selectedRow.itemName}</p>
                <p><span className="font-black">Quantidade:</span> {formatQuantity(numericQuantity, selectedRow.unitLabel)}</p>
                <p className="break-all"><span className="font-black">Material lido:</span> {productBarcode}</p>
                <p><span className="font-black">Lote:</span> {lotCode.trim() || 'Referência técnica automática'}</p>
                <p><span className="font-black">Validade:</span> {expiresOn || 'Não informada'}</p>
                <p><span className="font-black">Posição:</span> {positionResolution.label}</p>
              </div>
              <button
                type="button"
                onClick={() => void confirmAllocation()}
                disabled={working}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#00288e] px-4 text-sm font-black text-white disabled:opacity-50"
              >
                {working
                  ? <LoaderCircle className="h-5 w-5 animate-spin" />
                  : <CheckCircle2 className="h-5 w-5" />}
                CONFIRMAR ALOCAÇÃO
              </button>
              <p className="mt-2 text-[10px] font-semibold leading-4 text-blue-900/70">
                O backend revalida pendência, material, posição, lote, barcode e idempotência no commit.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
