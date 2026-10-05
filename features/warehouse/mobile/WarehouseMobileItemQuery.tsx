'use client';

import {
  ArrowLeft,
  Box,
  MapPin,
  PackageSearch,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';

import { getWarehouseBarcodeByCode } from '../../../lib/warehouse/barcodeRepository';
import {
  warehouseStockPositionKey,
  warehouseStockPositionsEqual,
} from '../../../lib/warehouse/location';
import { warehouseLotDisplayCode } from '../../../lib/warehouse/lot';
import { classifyWarehouseMobileProductScan } from '../../../lib/warehouse/mobileIntakeAllocation';
import {
  loadWarehouseMobileItemAvailability,
  type WarehouseMobileItemAvailability,
} from '../../../lib/warehouse/mobileOutboundRepository';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type QueryState =
  | { status: 'idle' }
  | { status: 'loading'; barcode: string }
  | {
      status: 'resolved';
      barcode: string;
      availability: WarehouseMobileItemAvailability;
    }
  | { status: 'error'; barcode: string; message: string };

function formatQuantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function unitLabel(
  availability: WarehouseMobileItemAvailability
): string {
  return (
    availability.material.unit.label
    || availability.material.unit.code.toUpperCase()
  );
}

function expiryLabel(expiresOn: string | null): string {
  if (!expiresOn) return 'Validade não informada';
  const [year, month, day] = expiresOn.split('-');
  return day && month && year ? day + '/' + month + '/' + year : expiresOn;
}

function queryError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_MATERIAL_NOT_FOUND')) {
    return 'O material associado ao código não existe mais.';
  }
  if (raw.includes('WAREHOUSE_BALANCE_NOT_FOUND')) {
    return 'O material não possui saldo agregado inicializado.';
  }
  if (raw.includes('LOCATION_LIMIT') || raw.includes('LOT_LIMIT')) {
    return 'A distribuição física excede o limite seguro da consulta móvel. Use a Central desktop.';
  }
  if (
    raw.includes('INVALID_')
    || raw.includes('POSITION_METADATA_MISSING')
    || raw.includes('POSITION_HIERARCHY_INVALID')
  ) {
    return 'A distribuição física possui inconsistência e não será apresentada parcialmente.';
  }
  return 'Não foi possível consultar o item. Verifique a conexão e tente novamente.';
}

export function WarehouseMobileItemQuery() {
  const workspace = useWarehouseWorkspaceContext();
  const requestRef = useRef(0);
  const [state, setState] = useState<QueryState>({ status: 'idle' });

  const reset = useCallback(() => {
    requestRef.current += 1;
    setState({ status: 'idle' });
  }, []);

  const scanItem = useCallback((event: WarehouseMobileScanEvent) => {
    if (!workspace.ug) {
      setState({
        status: 'error',
        barcode: event.value,
        message: 'A UG operacional não está resolvida. Reabra a Central e tente novamente.',
      });
      return;
    }

    const requestId = ++requestRef.current;
    setState({ status: 'loading', barcode: event.value });

    void (async () => {
      const association = await getWarehouseBarcodeByCode(
        workspace.workspaceId,
        event.value
      );
      if (!association) throw new Error('WAREHOUSE_MOBILE_ITEM_QUERY_BARCODE_NOT_FOUND');
      if (association.status !== 'active') {
        throw new Error('WAREHOUSE_MOBILE_ITEM_QUERY_BARCODE_INACTIVE');
      }
      if (association.ug !== workspace.ug) {
        throw new Error('WAREHOUSE_MOBILE_ITEM_QUERY_SCOPE_MISMATCH');
      }

      const availability = await loadWarehouseMobileItemAvailability(
        workspace.workspaceId,
        association.materialId
      );

      if (requestId !== requestRef.current) return;
      setState({
        status: 'resolved',
        barcode: event.value,
        availability,
      });
    })().catch((error) => {
      if (requestId !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      let message = queryError(error);
      if (raw.includes('BARCODE_NOT_FOUND')) {
        message = 'Código comercial não encontrado neste workspace.';
      } else if (raw.includes('BARCODE_INACTIVE')) {
        message = 'O código comercial está inativo.';
      } else if (raw.includes('SCOPE_MISMATCH')) {
        message = 'O código comercial pertence a outra UG.';
      }
      setState({
        status: 'error',
        barcode: event.value,
        message,
      });
    });
  }, [workspace.ug, workspace.workspaceId]);

  const rows = useMemo(() => {
    if (state.status !== 'resolved') return [];

    const labels = new Map(
      state.availability.positionLabels.map((item) => [item.key, item.label])
    );

    return state.availability.locationBalances
      .filter(
        (balance) =>
          balance.quantity > 0
          && balance.position.kind !== 'UNASSIGNED'
      )
      .map((balance) => {
        const lots = state.availability.lots.filter(
          (lot) =>
            lot.quantity > 0
            && warehouseStockPositionsEqual(lot.position, balance.position)
        );
        const key = warehouseStockPositionKey(balance.position);
        return {
          key,
          label: labels.get(key) || key,
          balance,
          lots,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [state]);

  const distributedQuantity = useMemo(
    () => rows.reduce((total, row) => total + row.balance.quantity, 0),
    [rows]
  );

  return (
    <div
      className="space-y-5"
      data-testid="warehouse-mobile-item-query"
      data-query-writes="0"
      data-query-listeners={0}
    >
      <header className="rounded-3xl bg-[#00288e] p-5 text-white">
        <Link
          href="/central-mobile"
          className="inline-flex items-center gap-2 text-xs font-black text-blue-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Central Móvel
        </Link>
        <p className="mt-4 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-blue-200">
          CONSULTA · SOMENTE LEITURA
        </p>
        <h1 className="mt-1 text-2xl font-black">Consultar item</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-blue-100">
          Leia o código do item para ver onde ele está e quanto existe em cada posição.
        </p>
      </header>

      {state.status === 'error' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p>{state.message}</p>
              <p className="mt-2 break-all font-mono text-[9px] text-amber-700">
                {state.barcode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-3 min-h-11 w-full rounded-2xl border border-amber-300 bg-white px-4 text-xs font-black text-amber-900"
          >
            Tentar outro item
          </button>
        </div>
      )}

      {(state.status === 'idle' || state.status === 'error') && (
        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">LER ITEM</h2>
          <WarehouseMobileScanner
            expectation="EXPECT_PRODUCT"
            identifyScan={classifyWarehouseMobileProductScan}
            onValidatedScan={scanItem}
            title="LER ITEM"
          />
        </section>
      )}

      {state.status === 'loading' && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 p-4 text-xs font-bold text-blue-900">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Consultando distribuição física oficial…
        </div>
      )}

      {state.status === 'resolved' && (
        <>
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <PackageSearch className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  ITEM
                </p>
                <p className="mt-1 text-sm font-black text-emerald-950">
                  {state.availability.material.description}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  Saldo agregado: {formatQuantity(state.availability.balance.quantity)}{' '}
                  {unitLabel(state.availability)}
                </p>
                <p className="mt-1 break-all font-mono text-[9px] font-semibold text-emerald-700">
                  {state.barcode}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#00288e]">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                  DISTRIBUIÇÃO FÍSICA
                </p>
                <h2 className="mt-1 text-sm font-black text-slate-950">
                  Onde este item está?
                </h2>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <Box className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-black text-slate-700">
                  Nenhum saldo físico positivo em posição ativa.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {rows.map((row) => (
                  <article
                    key={row.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-black text-slate-950">
                      {row.label}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-600">
                      {formatQuantity(row.balance.quantity)}{' '}
                      {unitLabel(state.availability)}
                    </p>

                    {row.lots.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {row.lots.map((lot) => (
                          <div
                            key={lot.id}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <p className="text-[11px] font-black text-slate-800">
                              Lote {warehouseLotDisplayCode(lot.code)}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                              {formatQuantity(lot.quantity)} · {expiryLabel(lot.expiresOn)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {Math.abs(
              state.availability.balance.quantity - distributedQuantity
            ) > 0.000001 && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-5 text-amber-900">
                Saldo agregado e soma das posições ativas não coincidem. A consulta não altera dados; revise a distribuição na Central desktop se necessário.
              </p>
            )}
          </section>

          <button
            type="button"
            onClick={reset}
            className="min-h-12 w-full rounded-2xl bg-[#00288e] px-4 text-sm font-black text-white"
          >
            Consultar outro item
          </button>
        </>
      )}

      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-[11px] font-semibold leading-5 text-slate-500">
        Consulta de item é somente leitura. Ela reutiliza a mesma distribuição física usada pela Saída de Material e não movimenta estoque.
      </p>
    </div>
  );
}
