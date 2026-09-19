'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  X,
} from 'lucide-react';

import { formatSupplierCnpj } from '../../../lib/invoiceIdentity';
import type { SagNsApplicationPreviewItem } from '../../../lib/sagNsApplicationPreview';
import type { SupplierReport } from '../../../lib/supplierReporting';

interface SagApplyConfirmationDialogProps {
  open: boolean;
  selectedSupplier: SupplierReport | null;
  previewChanges: SagNsApplicationPreviewItem[];
  applyConfirmed: boolean;
  isApplying: boolean;
  applyError: string;
  onConfirmedChange: (confirmed: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function SagApplyConfirmationDialog({
  open,
  selectedSupplier,
  previewChanges,
  applyConfirmed,
  isApplying,
  applyError,
  onConfirmedChange,
  onClose,
  onConfirm,
}: SagApplyConfirmationDialogProps) {
  if (!open || !selectedSupplier) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sag-import-confirmation-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-blue-100 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
          <div>
            <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#00288e]">
              Bloco 11 · confirmação humana
            </p>
            <h4 id="sag-import-confirmation-title" className="mt-1 text-lg font-black text-[#0b1c30]">
              Confirmar importação das NS
            </h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-gray-500">
              Confira as alterações abaixo. Ao confirmar, o EMPROVEX revalidará o lote e executará uma única transação atômica.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            aria-label="Fechar confirmação"
            className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-xs font-black text-[#00288e]">{selectedSupplier.supplierName}</p>
            <p className="mt-1 font-mono text-[10px] font-bold text-blue-700">
              {formatSupplierCnpj(selectedSupplier.cnpj)}
            </p>
            <p className="mt-2 text-[10px] font-semibold leading-relaxed text-blue-800/80">
              {previewChanges.length} alteração(ões) serão submetidas à revalidação. Itens ignorados ou já cadastrados não geram escrita.
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
            <div className="divide-y divide-gray-100">
              {previewChanges.map((item) => (
                <div key={`${item.invoiceRecordKey}-${item.ns}`} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-black text-[#0b1c30]">
                      NF {item.invoiceId} · <span className="font-mono text-[10px] text-gray-500">{item.empenhoId}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                      <span className="rounded-md bg-gray-50 px-2 py-1 text-gray-500">Sem NS</span>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
                      <span className="rounded-md bg-emerald-50 px-2 py-1 font-mono text-emerald-700">
                        {item.proposedNs}
                      </span>
                    </div>
                  </div>
                  {item.warnings.length > 0 ? (
                    <span className="w-fit rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[9px] font-extrabold text-amber-700">
                      {item.warnings.length} alerta(s)
                    </span>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-700" aria-hidden="true" />
              <p className="text-[10px] font-semibold leading-relaxed text-amber-800">
                Se qualquer NF, NE, CNPJ ou NS tiver mudado desde esta prévia, a transação será cancelada integralmente. Nenhuma parte do lote será gravada.
              </p>
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <input
              type="checkbox"
              checked={applyConfirmed}
              onChange={(event) => onConfirmedChange(event.target.checked)}
              disabled={isApplying}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#00288e] focus:ring-[#00288e]"
            />
            <span className="text-xs font-semibold leading-relaxed text-gray-700">
              Conferi as NFs, as NEs e as NS propostas acima e autorizo a gravação somente dessas correspondências seguras.
            </span>
          </label>

          {applyError ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert">
              <p className="text-xs font-black text-rose-800">Importação não realizada</p>
              <p className="mt-1 text-[10px] font-semibold leading-relaxed text-rose-700">{applyError}</p>
              <p className="mt-1 text-[9px] font-medium text-rose-600">
                Revise a prévia atualizada antes de tentar novamente.
              </p>
            </div>
          ) : null}

          <div className="sticky bottom-0 mt-5 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-gray-100 bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="h-10 rounded-xl border border-gray-200 px-4 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!applyConfirmed || isApplying || previewChanges.length === 0}
              aria-busy={isApplying}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#001f70] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {isApplying
                ? 'Revalidando e gravando…'
                : `Confirmar e gravar ${previewChanges.length} NS`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
