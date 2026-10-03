'use client';

import { Box, MapPin, PackageSearch } from 'lucide-react';

import type { WarehouseStockPositionResolveResult } from '../../../lib/warehouse/locationBarcode';
import {
  warehouseLotDisplayCode,
  warehouseLotOriginLabel,
} from '../../../lib/warehouse/lot';
import type { WarehouseMobilePhysicalQueryResult } from '../../../lib/warehouse/mobilePhysicalQuery';

type ResolvedPosition = Extract<
  WarehouseStockPositionResolveResult,
  { ok: true }
>['value'];

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 6,
  }).format(value);
}

function materialUnitLabel(
  code: string,
  label: string | null
): string {
  return label || code.toUpperCase();
}

function expiryLabel(expiresOn: string | null): string {
  if (!expiresOn) return 'Validade não informada';
  const [year, month, day] = expiresOn.split('-');
  return day && month && year
    ? `${day}/${month}/${year}`
    : expiresOn;
}

function resolvedLocal(resolved: ResolvedPosition) {
  return resolved.position.kind === 'SUBPOSITION'
    ? resolved.parentLocation
    : resolved.location;
}

export function WarehouseMobilePhysicalQueryResult({
  resolved,
  result,
}: {
  resolved: ResolvedPosition;
  result: WarehouseMobilePhysicalQueryResult;
}) {
  const local = resolvedLocal(resolved);
  const subposition = resolved.position.kind === 'SUBPOSITION'
    ? resolved.location
    : null;

  return (
    <div
      className="space-y-3"
      data-testid="warehouse-mobile-physical-query-result"
      data-query-listeners={result.metrics.listeners}
      data-query-cache={result.metrics.cache}
      data-query-reads-approx={result.metrics.totalReadsApprox}
      data-query-payload-bytes-approx={result.metrics.payloadBytesApprox}
    >
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
              POSIÇÃO
            </p>
            <p className="mt-1 text-sm font-black text-emerald-950">
              {resolved.depot.code} · {resolved.depot.name}
            </p>
            {local && (
              <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                Local: {local.code} · {local.name}
              </p>
            )}
            {subposition && (
              <p className="text-xs font-semibold leading-5 text-emerald-800">
                Subposição: {subposition.code} · {subposition.name}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.45)]">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#00288e]">
            <PackageSearch className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
              CONTEÚDO ESPERADO
            </p>
            <h3 className="mt-1 text-sm font-black text-slate-950">
              O que deveria estar aqui?
            </h3>
          </div>
        </div>

        {result.items.length === 0 ? (
          <div
            className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center"
            data-testid="warehouse-mobile-physical-query-empty"
          >
            <Box className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-black text-slate-700">
              Nenhum material registrado nesta posição.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {result.items.map(({ material, balance, lots }) => (
              <article
                key={material.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm font-black leading-5 text-slate-950">
                  {material.description}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-600">
                  {formatQuantity(balance.quantity)}{' '}
                  {materialUnitLabel(material.unit.code, material.unit.label)}
                </p>

                {lots.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {lots.map((lot) => (
                      <div
                        key={lot.id}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-slate-800">
                              Lote {warehouseLotDisplayCode(lot.code)}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold leading-4 text-slate-500">
                              {expiryLabel(lot.expiresOn)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">
                            {formatQuantity(lot.quantity)}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">
                          Origem: {warehouseLotOriginLabel(lot.origin)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] font-semibold leading-4 text-slate-500">
                    Sem lote ou validade registrados para este material nesta posição.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
