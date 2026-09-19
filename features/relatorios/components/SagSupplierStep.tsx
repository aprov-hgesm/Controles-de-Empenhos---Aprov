'use client';

import React from 'react';
import { Building2, CheckCircle2, ChevronDown, ChevronUp, Search } from 'lucide-react';

import { formatSupplierCnpj } from '../../../lib/invoiceIdentity';
import type { SupplierReport } from '../../../lib/supplierReporting';

interface SagSupplierStepProps {
  supplierReports: SupplierReport[];
  filteredSuppliers: SupplierReport[];
  selectedSupplier: SupplierReport | null;
  selectedCnpj: string;
  supplierSearch: string;
  supplierPickerOpen: boolean;
  onSupplierSearchChange: (value: string) => void;
  onTogglePicker: () => void;
  onSelectSupplier: (cnpj: string) => void;
}

export function SagSupplierStep({
  supplierReports,
  filteredSuppliers,
  selectedSupplier,
  selectedCnpj,
  supplierSearch,
  supplierPickerOpen,
  onSupplierSearchChange,
  onTogglePicker,
  onSelectSupplier,
}: SagSupplierStepProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#00288e]">
            Etapa 1
          </p>
          <h4 className="mt-1 text-base font-black text-[#0b1c30]">Fornecedor / favorecido</h4>
          <p className="mt-1 text-xs font-medium text-gray-500">
            O CNPJ escolhido define o universo seguro da conciliação.
          </p>
        </div>
        {selectedSupplier ? (
          <button
            type="button"
            onClick={onTogglePicker}
            aria-expanded={supplierPickerOpen}
            className="inline-flex h-9 w-fit items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 text-[10px] font-extrabold text-[#00288e] transition hover:bg-blue-100"
          >
            {supplierPickerOpen ? 'Ocultar fornecedores' : 'Trocar fornecedor'}
            {supplierPickerOpen ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold text-[#00288e]">
            {supplierReports.length} fornecedor(es) disponíveis
          </span>
        )}
      </div>

      {selectedSupplier && !supplierPickerOpen ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#00288e] text-white">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-[#0b1c30]">{selectedSupplier.supplierName}</p>
              <p className="mt-0.5 font-mono text-[10px] font-bold text-blue-700">
                {formatSupplierCnpj(selectedSupplier.cnpj)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[9px] font-extrabold">
            <span className="rounded-md bg-white px-2 py-1 text-gray-500">
              {selectedSupplier.empenhos.length} NE(s)
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-gray-500">
              {selectedSupplier.invoiceCount} NF(s)
            </span>
            <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">
              {selectedSupplier.invoicesWithoutNs} sem NS
            </span>
          </div>
        </div>
      ) : null}

      {supplierPickerOpen || !selectedSupplier ? (
        <>
          <label className="relative mt-4 block">
            <span className="sr-only">Buscar fornecedor por razão social ou CNPJ</span>
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={supplierSearch}
              onChange={(event) => onSupplierSearchChange(event.target.value)}
              placeholder="Razão social ou CNPJ..."
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-3 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#00288e] focus:bg-white focus:ring-1 focus:ring-[#00288e]"
            />
          </label>

          {filteredSuppliers.length > 0 ? (
            <div className="mt-4 grid max-h-80 grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {filteredSuppliers.map((supplier) => {
                const selected = selectedCnpj === supplier.cnpj;
                return (
                  <button
                    key={supplier.cnpj}
                    type="button"
                    onClick={() => onSelectSupplier(supplier.cnpj)}
                    aria-pressed={selected}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      selected
                        ? 'border-[#00288e] bg-blue-50/70 shadow-md ring-1 ring-[#00288e]/10'
                        : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${
                          selected ? 'bg-[#00288e] text-white' : 'bg-blue-50 text-[#00288e]'
                        }`}
                      >
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {selected ? (
                        <CheckCircle2 className="h-4 w-4 flex-none text-[#00288e]" aria-hidden="true" />
                      ) : null}
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs font-extrabold leading-relaxed text-[#0b1c30]">
                      {supplier.supplierName}
                    </p>
                    <p className="mt-1 font-mono text-[10px] font-bold text-gray-500">
                      {formatSupplierCnpj(supplier.cnpj)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-extrabold">
                      <span className="rounded-md bg-gray-50 px-2 py-1 text-gray-500">
                        {supplier.empenhos.length} NE(s)
                      </span>
                      <span className="rounded-md bg-gray-50 px-2 py-1 text-gray-500">
                        {supplier.invoiceCount} NF(s)
                      </span>
                      <span
                        className={`rounded-md px-2 py-1 ${
                          supplier.invoicesWithoutNs > 0
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {supplier.invoicesWithoutNs} sem NS
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-8 text-center">
              <p className="text-sm font-extrabold text-gray-500">Nenhum fornecedor encontrado</p>
              <p className="mt-1 text-xs font-medium text-gray-400">
                Ajuste a busca ou cadastre o CNPJ dos empenhos pendentes.
              </p>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
