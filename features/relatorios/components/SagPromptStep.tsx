'use client';

import React from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Landmark,
  XCircle,
} from 'lucide-react';

import { formatSupplierCnpj } from '../../../lib/invoiceIdentity';
import type { SupplierReport } from '../../../lib/supplierReporting';

export type SagPromptCopyState = 'idle' | 'copied' | 'error';

interface SagPromptStepProps {
  selectedSupplier: SupplierReport;
  normalizedUg: string | null;
  ugInvalid: boolean;
  ugMismatch: boolean;
  payloadUg: string | null;
  prompt: string;
  copyState: SagPromptCopyState;
  onCopyPrompt: () => void;
}

export function SagPromptStep({
  selectedSupplier,
  normalizedUg,
  ugInvalid,
  ugMismatch,
  payloadUg,
  prompt,
  copyState,
  onCopyPrompt,
}: SagPromptStepProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="bg-[#00288e] p-5 text-white">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-blue-200">
              Favorecido selecionado
            </p>
            <h4 className="mt-1 text-lg font-black">{selectedSupplier.supplierName}</h4>
            <p className="mt-1 font-mono text-xs font-bold text-blue-100">
              {formatSupplierCnpj(selectedSupplier.cnpj)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['NEs', selectedSupplier.empenhos.length],
              ['NFs', selectedSupplier.invoiceCount],
              ['Sem NS', selectedSupplier.invoicesWithoutNs],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-base font-black">{value}</span>
                <span className="text-[8px] font-extrabold uppercase tracking-wider text-blue-100">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-gray-100 lg:grid-cols-2">
        <div className="bg-white p-5">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
            <div>
              <p className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-[#00288e]">
                Etapa 2
              </p>
              <p className="text-sm font-black text-[#0b1c30]">Obter relatório no SAG</p>
            </div>
          </div>
          <p className="mt-3 text-xs font-medium leading-relaxed text-gray-500">
            No SAG, gere o relatório de NS do favorecido acima. Use o CNPJ selecionado como referência e
            preserve as observações do relatório, pois é nelas que a NF costuma aparecer explicitamente.
          </p>
          <a
            href="https://sag.eb.mil.br/"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-xs font-extrabold text-[#00288e] transition hover:bg-blue-100"
          >
            Abrir SAG
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <div className="bg-white p-5">
          <div className="flex items-center gap-2">
            <ClipboardCopy className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
            <div>
              <p className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-[#00288e]">
                Etapa 3
              </p>
              <p className="text-sm font-black text-[#0b1c30]">Prompt oficial do EMPROVEX</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
              UG da Organização Militar
            </span>
            <div className="mt-1 font-mono text-sm font-black text-[#00288e]">
              {normalizedUg || 'Não configurada'}
            </div>
            <p className="mt-1 text-[10px] font-semibold leading-relaxed text-gray-500">
              A UG vem automaticamente do cadastro do usuário/setor e compõe a identidade das NS.
            </p>
          </div>

          {ugInvalid ? (
            <p className="mt-1.5 text-[10px] font-semibold text-amber-700">
              A UG da unidade ainda não está configurada. O administrador deve vinculá-la ao cadastro antes de importar NS.
            </p>
          ) : ugMismatch ? (
            <p className="mt-1.5 text-[10px] font-semibold text-rose-700">
              O SAG informou a UG {payloadUg}, diferente da UG {normalizedUg} vinculada a este usuário. A importação foi bloqueada.
            </p>
          ) : null}

          <button
            type="button"
            onClick={onCopyPrompt}
            disabled={!prompt}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#001f70] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copyState === 'copied' ? (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Prompt copiado
              </>
            ) : copyState === 'error' ? (
              <>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Não foi possível copiar
              </>
            ) : (
              <>
                <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                Copiar Prompt
              </>
            )}
          </button>
          <p className="mt-2 text-[10px] font-medium leading-relaxed text-gray-400">
            Cole o prompt em uma IA externa, anexe o relatório obtido no SAG e copie somente o JSON retornado.
          </p>
        </div>
      </div>
    </section>
  );
}
