'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, RefreshCw, X } from 'lucide-react';
import {
  warehouseLocationExpiry,
  warehouseLocationQuantity,
  type LocationContents,
} from '../../../lib/warehouse/locationContents';

export type WarehouseInspectionLotState = 'idle' | 'loading' | 'ready' | 'error';

function nearestExpiry(
  row: LocationContents['groups'][number]['rows'][number],
  lotState: WarehouseInspectionLotState
): string {
  if (lotState !== 'ready') return 'Validade: consultando…';
  const dates = [...new Set(
    row.lots.flatMap((lot) => lot.expiresOn ? [lot.expiresOn] : [])
  )].sort();
  if (!dates.length) return 'Validade: não informada';
  const summary = dates.slice(0, 2).map(warehouseLocationExpiry).join(', ')
    + (dates.length > 2 ? ' +' + (dates.length - 2) + ' outras' : '');
  const pending = row.quantityWithoutLot > 0.000001
    || row.lots.some((lot) => !lot.expiresOn);
  return 'Validades: ' + summary + (pending ? ' · pendências' : '');
}

export function WarehouseLocationContentsTooltip({
  contents,
  lotState,
}: {
  contents: LocationContents;
  lotState: WarehouseInspectionLotState;
}) {
  const count = contents.groups.reduce((sum, group) => sum + group.rows.length, 0);
  let shown = 0;

  return (
    <div
      data-testid="warehouse-location-hover-tooltip"
      className="pointer-events-none w-full rounded-2xl border border-blue-100 bg-white p-3 text-slate-800 shadow-sm"
    >
      <p className="text-xs font-black text-[#00288e]">
        {contents.location.code} · {contents.location.name}
      </p>
      <p className="mt-1 text-[10px] font-semibold text-slate-500">
        {contents.materialCount} material(is) · {contents.rowCount} registro(s) de saldo físico
      </p>
      <div className="mt-2 space-y-2">
        {count === 0 && (
          <p className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">Local sem itens com saldo positivo.</p>
        )}
        {contents.groups.map((group) => {
          const rows = group.rows.slice(0, Math.max(0, 5 - shown));
          shown += rows.length;
          if (!rows.length) return null;
          return (
            <div key={group.id}>
              <p className="mb-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black text-[#00288e]">
                {group.direct ? 'Sem prateleira' : 'Prateleira ' + group.code + ' · ' + group.name}
              </p>
              {rows.map((row) => (
                <div key={row.materialId} className="border-b border-slate-100 px-1 py-1.5 last:border-0">
                  <p className="text-[11px] font-semibold leading-4">{row.description}</p>
                  <p className="text-[10px] text-slate-500">
                    {warehouseLocationQuantity(row.quantity)} {row.unit} · {nearestExpiry(row, lotState)}
                  </p>
                </div>
              ))}
            </div>
          );
        })}
        {count > shown && <p className="text-[10px] font-bold text-slate-500">+{count - shown} registros · clique para ver todos</p>}
      </div>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-bold text-blue-700">
        Clique no local para detalhes e relatório PDF
      </p>
    </div>
  );
}

export function WarehouseLocationDetailsDialog({
  contents,
  depotName,
  lotState,
  lotError,
  complete,
  onRefresh,
  onClose,
}: {
  contents: LocationContents;
  depotName: string;
  lotState: WarehouseInspectionLotState;
  lotError: string | null;
  complete: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const generate = async () => {
    if (lotState !== 'ready' || !complete || generating) return;
    setGenerating(true);
    setReportError(null);
    try {
      const { downloadWarehouseLocationContentsPdf } = await import('../pdf/WarehouseLocationContentsPdf');
      await downloadWarehouseLocationContentsPdf({ contents, depotName, generatedAt: new Date() });
    } catch {
      setReportError('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const canExport = lotState === 'ready' && complete;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/65 px-3 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      data-testid="warehouse-location-details-overlay"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="warehouse-location-details-title"
        data-testid="warehouse-location-details-dialog"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800">{depotName} · Consulta do local</p>
            <h2 id="warehouse-location-details-title" className="mt-1 text-lg font-black text-slate-900">
              {contents.location.code} · {contents.location.name}
            </h2>
            <p className="text-xs text-slate-500">
              {contents.materialCount} material(is) · {contents.rowCount} registro(s) de saldo físico
            </p>
          </div>
          <button autoFocus type="button" aria-label="Fechar detalhes" onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {lotState === 'loading' && (
            <p className="mb-3 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">
              Consultando validades dos lotes…
            </p>
          )}
          {lotState === 'error' && (
            <p className="mb-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              Não foi possível consultar as validades. {lotError || 'Tente atualizar.'}
            </p>
          )}
          {!complete && (
            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              O limite de consulta foi atingido. A listagem pode estar incompleta; a emissão do relatório está bloqueada para evitar dados parciais.
            </p>
          )}
          {contents.hasLotDiscrepancy && (
            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              Há atribuição de lotes superior ao saldo físico em pelo menos um material. Conferir integridade logística.
            </p>
          )}

          {contents.groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Não há materiais com saldo positivo neste local.
            </p>
          ) : (
            <div className="space-y-4">
              {contents.groups.map((group) => (
                <div key={group.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <h3 className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-[#00288e]">
                    {group.direct ? 'Itens diretamente no local (sem prateleira)' : 'Prateleira ' + group.code + ' · ' + group.name}
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {group.rows.map((row) => (
                      <div key={row.materialId} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_155px]">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{row.description}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.materialId}</p>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            {lotState !== 'ready' && <p>Validade: aguardando consulta.</p>}
                            {lotState === 'ready' && row.lots.length === 0 && <p>Sem lote ou validade cadastrados.</p>}
                            {lotState === 'ready' && row.lots.map((lot) => (
                              <p key={lot.id}>
                                Lote {lot.code} · {warehouseLocationQuantity(lot.quantity)} {row.unit}
                                {' · Validade: '}{warehouseLocationExpiry(lot.expiresOn)}
                              </p>
                            ))}
                            {lotState === 'ready' && row.quantityWithoutLot > 0.000001 && (
                              <p className="font-semibold text-amber-700">
                                {warehouseLocationQuantity(row.quantityWithoutLot)} {row.unit} sem atribuição a lote/validade.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="self-start rounded-xl bg-slate-50 px-3 py-2 text-left sm:text-right">
                          <p className="text-[10px] font-bold uppercase text-slate-500">Saldo físico</p>
                          <p className="text-lg font-black text-slate-900">
                            {warehouseLocationQuantity(row.quantity)} <span className="text-xs">{row.unit}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {reportError && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{reportError}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <p className="max-w-lg text-[10px] text-slate-500">
            Consulta somente leitura. Quantidades derivam do saldo físico; lotes apenas detalham validades.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onRefresh} disabled={lotState === 'loading'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar consulta
            </button>
            <button type="button" onClick={() => void generate()} disabled={!canExport || generating}
              data-testid="warehouse-location-download-pdf"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#00288e] px-4 py-2 text-xs font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40">
              <Download className="h-3.5 w-3.5" /> {generating ? 'Gerando…' : 'Gerar relatório PDF'}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
