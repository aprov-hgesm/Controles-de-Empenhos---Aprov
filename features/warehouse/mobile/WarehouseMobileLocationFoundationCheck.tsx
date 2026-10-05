'use client';

import {
  LoaderCircle,
  MapPin,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import type { WarehouseStockPositionResolveResult } from '../../../lib/warehouse/locationBarcode';
import { resolveWarehouseStockPositionBarcode } from '../../../lib/warehouse/locationBarcodeResolver';
import { classifyWarehouseMobileLocationScan } from '../../../lib/warehouse/mobileLocationScan';
import {
  loadWarehouseMobilePhysicalPositionContents,
  type WarehouseMobilePhysicalQueryResult as WarehouseMobilePhysicalQueryData,
} from '../../../lib/warehouse/mobilePhysicalQuery';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import { WarehouseMobilePhysicalQueryResult } from './WarehouseMobilePhysicalQueryResult';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ResolvedPosition = Extract<
  WarehouseStockPositionResolveResult,
  { ok: true }
>['value'];

type ResolutionState =
  | { status: 'idle' }
  | { status: 'resolving'; code: string }
  | { status: 'loading'; code: string; resolved: ResolvedPosition }
  | {
      status: 'resolved';
      code: string;
      resolved: ResolvedPosition;
      contents: WarehouseMobilePhysicalQueryData;
    }
  | { status: 'error'; code: string; message: string };

function resolutionErrorMessage(error: string): string {
  if (error === 'DEPOT_NOT_STOCK_POSITION') {
    return 'A etiqueta identifica um depósito, mas depósito não é posição de estoque. Leia um local ou subposição.';
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
    return 'A hierarquia física da etiqueta não é válida no cadastro atual.';
  }
  return 'A posição não pôde ser validada. Confira a etiqueta e tente novamente.';
}

function physicalQueryErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const diagnostic = message.trim() || 'UNKNOWN_ERROR';

  if (
    message.includes('WAREHOUSE_MOBILE_PHYSICAL_QUERY_BALANCE_LIMIT')
    || message.includes('WAREHOUSE_MOBILE_PHYSICAL_QUERY_LOT_LIMIT')
  ) {
    return 'A posição possui registros acima do limite seguro desta consulta móvel. Diagnóstico: ' + diagnostic;
  }

  if (
    message.includes('WAREHOUSE_MOBILE_PHYSICAL_QUERY_SCOPE_MISMATCH')
    || message.includes('WORKSPACE_MISMATCH')
    || message.includes('UG_MISMATCH')
  ) {
    return 'A consulta foi bloqueada porque o workspace/UG atual não corresponde aos dados solicitados. Diagnóstico: ' + diagnostic;
  }

  if (
    message.includes('WAREHOUSE_MOBILE_PHYSICAL_QUERY_INVALID_')
    || message.includes('WAREHOUSE_MOBILE_PHYSICAL_QUERY_MATERIAL_NOT_FOUND')
    || message.includes('WAREHOUSE_MOBILE_PHYSICAL_QUERY_DUPLICATE_BALANCE')
  ) {
    return 'A distribuição física retornou dados inconsistentes. Diagnóstico: ' + diagnostic;
  }

  return 'Falha ao consultar o conteúdo esperado. Diagnóstico: ' + diagnostic;
}

export function WarehouseMobileLocationFoundationCheck() {
  const workspace = useWarehouseWorkspaceContext();
  const requestIdRef = useRef(0);
  const [resolution, setResolution] = useState<ResolutionState>({ status: 'idle' });

  const resolveValidatedLocation = useCallback((event: WarehouseMobileScanEvent) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!workspace.ug) {
      setResolution({
        status: 'error',
        code: event.value,
        message: 'A UG operacional não está resolvida. Reabra a Central e tente novamente.',
      });
      return;
    }

    const ug = workspace.ug;
    setResolution({ status: 'resolving', code: event.value });

    void (async () => {
      try {
        const result = await resolveWarehouseStockPositionBarcode({
          code: event.value,
          workspaceId: workspace.workspaceId,
          ug,
        });

        if (requestId !== requestIdRef.current) return;

        if (!result.ok) {
          setResolution({
            status: 'error',
            code: event.value,
            message: resolutionErrorMessage(result.error),
          });
          return;
        }

        setResolution({
          status: 'loading',
          code: event.value,
          resolved: result.value,
        });

        try {
          const contents = await loadWarehouseMobilePhysicalPositionContents({
            workspaceId: workspace.workspaceId,
            ug,
            position: result.value.position,
          });

          if (requestId !== requestIdRef.current) return;

          setResolution({
            status: 'resolved',
            code: event.value,
            resolved: result.value,
            contents,
          });
        } catch (error) {
          if (requestId !== requestIdRef.current) return;
          setResolution({
            status: 'error',
            code: event.value,
            message: physicalQueryErrorMessage(error),
          });
        }
      } catch {
        if (requestId !== requestIdRef.current) return;
        setResolution({
          status: 'error',
          code: event.value,
          message: 'Falha ao revalidar a posição. Verifique a conexão e tente novamente.',
        });
      }
    })();
  }, [workspace.workspaceId, workspace.ug]);

  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
          MOBILE-E · CONSULTA FÍSICA
        </p>
        <h2 className="mt-1 text-lg font-black text-slate-950">
          O que deveria estar aqui?
        </h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
          Leia uma posição para consultar a distribuição física oficial. Nenhum saldo ou movimento é alterado.
        </p>
      </div>

      <WarehouseMobileScanner
        expectation="EXPECT_LOCATION"
        identifyScan={classifyWarehouseMobileLocationScan}
        onScanCandidate={(event) => {
          if (!event.accepted) {
            requestIdRef.current += 1;
            setResolution({ status: 'idle' });
          }
        }}
        onValidatedScan={resolveValidatedLocation}
        title="LER POSIÇÃO"
      />

      {resolution.status === 'resolving' && (
        <div
          className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
          data-testid="warehouse-mobile-location-resolving"
        >
          <div className="flex items-center gap-3 text-blue-900">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            <div>
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em]">
                VALIDANDO
              </p>
              <p className="mt-1 text-sm font-bold">
                Revalidando posição no cadastro autoritativo…
              </p>
            </div>
          </div>
        </div>
      )}

      {resolution.status === 'loading' && (
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
          data-testid="warehouse-mobile-physical-query-loading"
        >
          <div className="flex items-center gap-3 text-emerald-900">
            <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em]">
                POSIÇÃO VALIDADA
              </p>
              <p className="mt-1 text-sm font-bold">
                Carregando conteúdo esperado…
              </p>
            </div>
          </div>
        </div>
      )}

      {resolution.status === 'resolved' && (
        <WarehouseMobilePhysicalQueryResult
          resolved={resolution.resolved}
          result={resolution.contents}
        />
      )}

      {resolution.status === 'error' && (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
          data-testid="warehouse-mobile-location-error"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-amber-950">Consulta não concluída</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                {resolution.message}
              </p>
              <p className="mt-2 break-all font-mono text-[9px] font-bold text-amber-700/80">
                {resolution.code}
              </p>
            </div>
          </div>
        </div>
      )}

      {resolution.status === 'idle' && (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-500">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          Leia uma etiqueta EPX1 de LOCAL ou SUBPOSIÇÃO.
        </div>
      )}
    </section>
  );
}
