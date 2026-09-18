'use client';

import { ArrowRight, ClipboardCopy, FileJson, Landmark, ShieldCheck } from 'lucide-react';
import type { Empenho, Invoice } from '../../../lib/types';

interface SagImportViewProps {
  empenhos: Empenho[];
  invoices: Invoice[];
}

export function SagImportView({ empenhos, invoices }: SagImportViewProps) {
  const cnpjReady = empenhos.filter((empenho) => Boolean(empenho.supplierCnpj)).length;
  const invoicesWithNs = invoices.filter((invoice) => Boolean(invoice.numeroNS)).length;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-[#00288e]">Importar NS — SAG</h3>
        <p className="text-sm font-medium text-gray-500">
          Estrutura do assistente manual para conciliar relatórios do SAG com NFs e empenhos do EMPROVEX.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {[
          ['1', 'Selecionar fornecedor', 'CNPJ delimita o universo da conciliação'],
          ['2', 'Obter relatório no SAG', 'Baixar o relatório de NS do favorecido'],
          ['3', 'Gerar JSON com IA', 'Usar o prompt padronizado do EMPROVEX'],
          ['4', 'Conferir e importar', 'Prévia obrigatória antes de qualquer gravação'],
        ].map(([step, title, text], index, all) => (
          <div key={step} className="relative rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <span className="mb-3 grid h-7 w-7 place-items-center rounded-lg bg-[#00288e] text-[10px] font-black text-white">
              {step}
            </span>
            <p className="text-xs font-extrabold text-gray-800">{title}</p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-500">{text}</p>
            {index < all.length - 1 && (
              <ArrowRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-blue-200 lg:block" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-[#00288e]" aria-hidden="true" />
            <p className="text-sm font-extrabold text-gray-800">Base preparada</p>
          </div>
          <p className="mt-2 text-xs font-medium leading-relaxed text-gray-500">
            {cnpjReady} empenho(s) possuem CNPJ e {invoicesWithNs} NF(s) já possuem número de NS cadastrado.
            O motor de conciliação ainda não é executado nesta etapa.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
          <div className="flex items-center gap-2 text-emerald-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <p className="text-sm font-extrabold">Importação continuará sob confirmação humana</p>
          </div>
          <p className="mt-2 text-xs font-medium leading-relaxed text-emerald-800/80">
            Nenhuma NS será gravada automaticamente. O fluxo final terá validação do JSON, conciliação e uma prévia explícita antes da confirmação.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 opacity-60" aria-label="Recursos planejados">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-bold text-gray-500">
          <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" /> Prompt padronizado
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-bold text-gray-500">
          <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> JSON SAG validado
        </span>
      </div>
    </div>
  );
}
