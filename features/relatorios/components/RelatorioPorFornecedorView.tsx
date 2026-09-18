'use client';

import { Building2, CircleAlert, FileText, ReceiptText } from 'lucide-react';
import type { Empenho, Invoice } from '../../../lib/types';
import { formatSupplierCnpj } from '../../../lib/invoiceIdentity';

interface RelatorioPorFornecedorViewProps {
  empenhos: Empenho[];
  invoices: Invoice[];
}

export function RelatorioPorFornecedorView({ empenhos, invoices }: RelatorioPorFornecedorViewProps) {
  const withCnpj = empenhos.filter((empenho) => Boolean(empenho.supplierCnpj));
  const withoutCnpj = empenhos.length - withCnpj.length;
  const uniqueSuppliers = new Set(withCnpj.map((empenho) => empenho.supplierCnpj)).size;
  const latest = withCnpj.slice(0, 3);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-[#00288e]">Relatório por Fornecedor</h3>
        <p className="text-sm font-medium text-gray-500">
          Estrutura preparada para consolidar múltiplos empenhos, pregões, NFs e NS pelo CNPJ do fornecedor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <Building2 className="mb-2 h-5 w-5 text-[#00288e]" aria-hidden="true" />
          <p className="text-2xl font-black text-[#0b1c30]">{uniqueSuppliers}</p>
          <p className="text-xs font-bold text-gray-500">CNPJs identificados</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <ReceiptText className="mb-2 h-5 w-5 text-emerald-600" aria-hidden="true" />
          <p className="text-2xl font-black text-[#0b1c30]">{withCnpj.length}</p>
          <p className="text-xs font-bold text-gray-500">Empenhos com CNPJ</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <CircleAlert className="mb-2 h-5 w-5 text-amber-600" aria-hidden="true" />
          <p className="text-2xl font-black text-[#0b1c30]">{withoutCnpj}</p>
          <p className="text-xs font-bold text-gray-500">Empenhos pendentes de CNPJ</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-[#0b1c30]">Base pronta para consolidação</p>
            <p className="text-xs font-medium text-gray-500">
              A busca, seleção por CNPJ e consolidação financeira serão implementadas no bloco específico de fornecedor.
            </p>
          </div>
          <FileText className="h-5 w-5 text-gray-300" aria-hidden="true" />
        </div>

        {latest.length > 0 ? (
          <div className="space-y-2">
            {latest.map((empenho) => (
              <div key={empenho.id} className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold text-gray-800">{empenho.supplier}</p>
                  <p className="font-mono text-[10px] font-bold text-gray-500">
                    {formatSupplierCnpj(empenho.supplierCnpj)}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-gray-400">
                  {invoices.filter((invoice) => invoice.empenhoId === empenho.id).length} NF(s)
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-xs font-semibold text-gray-400">
            Nenhum empenho com CNPJ cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
