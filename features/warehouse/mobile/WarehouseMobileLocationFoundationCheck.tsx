'use client';

import { MapPin, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { classifyWarehouseMobileLocationScan } from '../../../lib/warehouse/mobileLocationScan';
import { resolveWarehouseStockPositionBarcode } from '../../../lib/warehouse/locationBarcodeResolver';
import type { WarehouseStockPosition } from '../../../lib/warehouse/location';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ResolutionState =
  | { status: 'idle' }
  | { status: 'resolving'; code: string }
  | { status: 'resolved'; code: string; position: WarehouseStockPosition }
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

function positionDescription(position: WarehouseStockPosition): string {
  if (position.kind === 'LOCATION') {
    return 'Local ' + position.locationId;
  }
  if (position.kind === 'SUBPOSITION') {
    return 'Subposição ' + position.subpositionId + ' · local ' + position.locationId;
  }
  return 'Sem localização';
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

    setResolution({ status: 'resolving', code: event.value });

    void resolveWarehouseStockPositionBarcode({
      code: event.value,
      workspaceId: workspace.workspaceId,
      ug: workspace.ug,
    }).then((result) => {
      if (requestId !== requestIdRef.current) return;

      if (result.ok) {
        setResolution({
          status: 'resolved',
          code: event.value,
          position: result.value.position,
        });
        return;
      }

      setResolution({
        status: 'error',
        code: event.value,
        message: resolutionErrorMessage(result.error),
      });
    }).catch(() => {
      if (requestId !== requestIdRef.current) return;
      setResolution({
        status: 'error',
        code: event.value,
        message: 'Falha ao revalidar a posição. Verifique a conexão e tente novamente.',
      });
    });
  }, [workspace.workspaceId, workspace.ug]);

  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
          Integração 1
        </p>
        <h2 className="mt-1 text-lg font-black text-slate-950">
          Ler e validar posição
        </h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
          Leitura somente para conferência técnica. Nenhum saldo ou movimento é alterado.
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
        title="LER LOCAL"
      />

      {resolution.status === 'resolving' && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
          Revalidando posição no cadastro autoritativo…
        </div>
      )}

      {resolution.status === 'resolved' && (
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
          data-testid="warehouse-mobile-location-resolved"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-emerald-950">Posição validada</p>
              <p className="mt-1 break-words text-xs font-semibold leading-5 text-emerald-800">
                {positionDescription(resolution.position)}
              </p>
              <p className="mt-2 break-all font-mono text-[9px] font-bold text-emerald-700/80">
                {resolution.code}
              </p>
            </div>
          </div>
        </div>
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
              <p className="text-sm font-black text-amber-950">Posição recusada</p>
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
