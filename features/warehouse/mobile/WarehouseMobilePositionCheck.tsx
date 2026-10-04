'use client';

import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  PackageSearch,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';

import {
  resolveWarehouseStockPositionBarcode,
} from '../../../lib/warehouse/locationBarcodeResolver';
import type {
  WarehouseStockPositionResolveResult,
} from '../../../lib/warehouse/locationBarcode';
import { classifyWarehouseMobileLocationScan } from '../../../lib/warehouse/mobileLocationScan';
import { classifyWarehouseMobileProductScan } from '../../../lib/warehouse/mobileIntakeAllocation';
import {
  checkWarehouseMobileMaterialAtPosition,
  type WarehouseMobilePositionCheckResult,
} from '../../../lib/warehouse/mobilePositionCheck';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import { warehouseLotDisplayCode } from '../../../lib/warehouse/lot';
import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ResolvedPosition = Extract<
  WarehouseStockPositionResolveResult,
  { ok: true }
>['value'];

type PositionSelection = {
  code: string;
  value: ResolvedPosition;
};

function positionLabel(value: ResolvedPosition): string {
  if (value.position.kind === 'LOCATION') {
    return (
      value.depot.code
      + ' · '
      + (value.location?.code || value.position.locationId)
    );
  }
  if (value.position.kind === 'SUBPOSITION') {
    return (
      value.depot.code
      + ' · '
      + (value.parentLocation?.code || value.position.locationId)
      + ' · '
      + (value.location?.code || value.position.subpositionId)
    );
  }
  return 'Posição física inválida';
}

function formatQuantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function unitLabel(result: WarehouseMobilePositionCheckResult): string {
  return result.material.unit.label || result.material.unit.code.toUpperCase();
}

function expiryLabel(expiresOn: string | null): string {
  if (!expiresOn) return 'Validade não informada';
  const parts = expiresOn.split('-');
  return parts.length === 3
    ? parts[2] + '/' + parts[1] + '/' + parts[0]
    : expiresOn;
}

function locationError(error: string): string {
  if (error === 'DEPOT_NOT_STOCK_POSITION') {
    return 'Depósito não é posição de estoque. Leia um LOCAL ou SUBPOSIÇÃO.';
  }
  if (error === 'WORKSPACE_MISMATCH' || error === 'UG_MISMATCH') {
    return 'A etiqueta pertence a outro workspace/UG.';
  }
  if (error === 'ENTITY_INACTIVE') {
    return 'A posição está inativa.';
  }
  if (error === 'ENTITY_NOT_FOUND') {
    return 'A posição não existe mais.';
  }
  if (error === 'HIERARCHY_INVALID' || error === 'ENTITY_KIND_MISMATCH') {
    return 'A hierarquia física da posição é inválida.';
  }
  if (error === 'MALFORMED_LOCATION_CODE' || error === 'NOT_LOCATION_CODE') {
    return 'A etiqueta EPX1 está malformada ou não identifica uma posição.';
  }
  return 'A posição não pôde ser validada no cadastro autoritativo.';
}

function checkError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes('WAREHOUSE_MOBILE_POSITION_CHECK_BALANCE_LIMIT')) {
    return 'A quantidade de registros físicos deste material excede o limite seguro da conferência móvel. A comparação foi bloqueada para não apresentar resultado truncado.';
  }
  if (
    raw.includes('SCOPE_MISMATCH')
    || raw.includes('WORKSPACE_MISMATCH')
    || raw.includes('UG_MISMATCH')
  ) {
    return 'A conferência foi bloqueada porque workspace/UG não correspondem ao contexto operacional atual.';
  }
  if (
    raw.includes('PRODUCT_BARCODE_INVALID')
    || raw.includes('PRODUCT_NOT_FOUND')
    || raw.includes('PRODUCT_INACTIVE')
    || raw.includes('MATERIAL_NOT_FOUND')
    || raw.includes('MATERIAL_INACTIVE')
  ) {
    return 'O código comercial não está ativo e associado a um material canônico válido neste workspace/UG.';
  }
  if (
    raw.includes('INVALID_BALANCE')
    || raw.includes('INVALID_MATERIAL')
    || raw.includes('INVALID_BARCODE_ASSOCIATION')
    || raw.includes('DUPLICATE_')
    || raw.includes('CONCURRENT_POSITION_CHANGE')
    || raw.includes('ALTERNATIVE_POSITION_')
  ) {
    return 'Os dados físicos mudaram ou estão inconsistentes. A conferência foi interrompida sem apresentar conclusão parcial.';
  }
  if (raw.includes('AUTH_REQUIRED') || raw.includes('INVALID_CONTEXT')) {
    return 'A sessão operacional não está válida para esta conferência.';
  }

  return 'Falha ao ler a projeção física oficial. Nenhuma conclusão foi emitida; verifique a conexão e tente novamente.';
}

export function WarehouseMobilePositionCheck() {
  const workspace = useWarehouseWorkspaceContext();
  const requestRef = useRef(0);
  const [position, setPosition] = useState<PositionSelection | null>(null);
  const [result, setResult] = useState<WarehouseMobilePositionCheckResult | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    requestRef.current += 1;
    setPosition(null);
    setResult(null);
    setWorking(false);
    setMessage(null);
  }, []);

  const scanPosition = useCallback((event: WarehouseMobileScanEvent) => {
    const requestId = ++requestRef.current;
    setWorking(true);
    setMessage(null);
    setResult(null);

    if (!workspace.ug) {
      setWorking(false);
      setMessage('A UG operacional não está resolvida. Reabra a Central e tente novamente.');
      return;
    }

    void resolveWarehouseStockPositionBarcode({
      code: event.value,
      workspaceId: workspace.workspaceId,
      ug: workspace.ug,
    }).then((resolved) => {
      if (requestId !== requestRef.current) return;
      if (!resolved.ok) {
        setMessage(locationError(resolved.error));
        setPosition(null);
        return;
      }
      setPosition({ code: event.value, value: resolved.value });
    }).catch(() => {
      if (requestId !== requestRef.current) return;
      setPosition(null);
      setMessage('Falha ao revalidar a posição. Verifique a conexão e tente novamente.');
    }).finally(() => {
      if (requestId === requestRef.current) setWorking(false);
    });
  }, [workspace.ug, workspace.workspaceId]);

  const scanProduct = useCallback((event: WarehouseMobileScanEvent) => {
    if (!position || !workspace.ug) return;

    const requestId = ++requestRef.current;
    setWorking(true);
    setMessage(null);
    setResult(null);

    void checkWarehouseMobileMaterialAtPosition({
      workspaceId: workspace.workspaceId,
      ug: workspace.ug,
      position: position.value.position,
      productBarcode: event.value,
    }).then((nextResult) => {
      if (requestId !== requestRef.current) return;
      setResult(nextResult);
    }).catch((error) => {
      if (requestId !== requestRef.current) return;
      setResult(null);
      setMessage(checkError(error));
    }).finally(() => {
      if (requestId === requestRef.current) setWorking(false);
    });
  }, [position, workspace.ug, workspace.workspaceId]);

  const transferQuery = result && position
    ? {
        contexto: 'conferencia',
        material: result.productBarcode,
        destino: position.code,
        ...(result.alternatives.length === 1
          ? { origem: result.alternatives[0].code }
          : {}),
      }
    : null;

  return (
    <div
      className="space-y-5"
      data-testid="warehouse-mobile-position-check"
      data-check-writes="0"
      data-check-listeners={result?.metrics.listeners ?? 0}
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
          MOBILE-H · CONFERÊNCIA FÍSICA/DIGITAL
        </p>
        <h1 className="mt-1 text-2xl font-black">Conferir posição</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-blue-100">
          Este material está registrado nesta posição?
        </p>
      </header>

      {message && (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900"
          data-testid="warehouse-mobile-position-check-error"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {message}
          </span>
        </div>
      )}

      {!position && (
        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">1 · LER POSIÇÃO</h2>
          <WarehouseMobileScanner
            expectation="EXPECT_LOCATION"
            identifyScan={classifyWarehouseMobileLocationScan}
            onValidatedScan={scanPosition}
            title="LER POSIÇÃO"
          />
        </section>
      )}

      {position && (
        <section
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
          data-testid="warehouse-mobile-position-check-position"
        >
          <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Posição validada
          </p>
          <p className="mt-2 text-sm font-black text-emerald-950">
            {positionLabel(position.value)}
          </p>
          <p className="mt-1 break-all font-mono text-[9px] font-semibold text-emerald-700">
            {position.code}
          </p>
        </section>
      )}

      {position && !result && (
        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">2 · LER MATERIAL</h2>
          <WarehouseMobileScanner
            expectation="EXPECT_PRODUCT"
            identifyScan={classifyWarehouseMobileProductScan}
            onValidatedScan={scanProduct}
            title="LER MATERIAL"
          />
          <button
            type="button"
            onClick={reset}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
          >
            Trocar posição
          </button>
        </section>
      )}

      {working && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 p-4 text-xs font-bold text-blue-900">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Revalidando projeção física oficial…
        </div>
      )}

      {result?.status === 'CORRECT' && result.current && (
        <section
          className="rounded-3xl border border-emerald-300 bg-emerald-50 p-5"
          data-testid="warehouse-mobile-position-check-correct"
          data-check-reads-approx={result.metrics.totalReadsApprox}
          data-check-queries={result.metrics.queries}
          data-check-payload-bytes-approx={result.metrics.payloadBytesApprox}
        >
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xl font-black text-emerald-950">CORRETO</p>
              <p className="mt-1 text-sm font-bold text-emerald-800">
                Material registrado nesta posição.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4">
            <p className="text-sm font-black text-slate-950">
              {result.material.description}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-600">
              {formatQuantity(result.current.balance.quantity)} {unitLabel(result)}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Posição: {position ? positionLabel(position.value) : '—'}
            </p>

            {result.current.lots.length > 0 && (
              <div className="mt-3 space-y-2">
                {result.current.lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <p className="font-black text-slate-800">
                      Lote {warehouseLotDisplayCode(lot.code)}
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-500">
                      {formatQuantity(lot.quantity)} · {expiryLabel(lot.expiresOn)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              requestRef.current += 1;
              setResult(null);
              setMessage(null);
            }}
            className="mt-4 min-h-12 w-full rounded-2xl bg-[#00288e] px-4 text-sm font-black text-white"
          >
            Conferir outro material
          </button>
        </section>
      )}

      {result?.status === 'INCORRECT' && (
        <section
          className="rounded-3xl border border-red-200 bg-red-50 p-5"
          data-testid="warehouse-mobile-position-check-incorrect"
          data-check-reads-approx={result.metrics.totalReadsApprox}
          data-check-queries={result.metrics.queries}
          data-check-payload-bytes-approx={result.metrics.payloadBytesApprox}
        >
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700">
              <TriangleAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xl font-black text-red-950">INCORRETO</p>
              <p className="mt-1 text-sm font-bold text-red-800">
                Material não registrado nesta posição.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-red-100 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-black text-slate-950">
              <PackageSearch className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
              {result.material.description}
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
              A projeção física oficial não contém saldo positivo deste material na posição lida.
            </p>
          </div>

          {result.alternatives.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-red-800">
                Posições oficiais registradas
              </p>
              <div className="mt-2 space-y-2">
                {result.alternatives.map((alternative) => (
                  <div
                    key={alternative.balance.id}
                    className="rounded-2xl border border-red-100 bg-white p-3"
                  >
                    <p className="text-xs font-black text-slate-900">
                      {positionLabel(alternative.resolved)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-600">
                      {formatQuantity(alternative.balance.quantity)} {unitLabel(result)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-red-200 bg-white p-4 text-xs font-bold leading-5 text-red-800">
              Não existe saldo físico positivo registrado para este material em outra posição física.
            </p>
          )}

          {transferQuery && (
            <Link
              href={{
                pathname: '/central-mobile/transferir',
                query: transferQuery,
              }}
              className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-[#00288e] px-4 text-sm font-black text-white"
              data-testid="warehouse-mobile-position-check-transfer-link"
            >
              Transferir material
            </Link>
          )}

          <p className="mt-3 text-[11px] font-semibold leading-5 text-red-700">
            A conferência não movimenta estoque. A transferência exige nova revalidação e confirmação no fluxo próprio.
          </p>
        </section>
      )}

      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-[11px] font-semibold leading-5 text-slate-500">
        Conferência detecta; Transferência corrige. Esta jornada é somente leitura, sem ledger, ajuste ou listener contínuo.
      </p>
    </div>
  );
}
