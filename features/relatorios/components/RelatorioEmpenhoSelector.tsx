'use client';

import React from 'react';
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { Empenho, Invoice } from '../../../lib/types';
import { formatSupplierCnpj } from '../../../lib/invoiceIdentity';
import type { EmpenhoClassDefinition } from '../../../lib/empenhoClasses';

type SelectorStatus = 'Todos' | 'Ativos' | 'ComSaldo' | 'Encerrados' | 'PendentesNS';

interface RelatorioEmpenhoSelectorProps {
  empenhos: Empenho[];
  invoices: Invoice[];
  empenhoClasses: EmpenhoClassDefinition[];
  selectedEmpenhoId: string;
  onSelectEmpenho: (empenhoId: string) => void;
  pregaoFilter: string;
  onPregaoFilterChange: (value: string) => void;
  uniquePregaos: string[];
}

function getEmpenhoYear(empenho: Empenho): string {
  const idMatch = empenho.id.match(/^(\d{4})NE/i);
  if (idMatch?.[1]) return idMatch[1];

  if (empenho.date?.includes('/')) {
    const parts = empenho.date.split('/');
    if (parts.length === 3) return parts[2];
  }

  if (empenho.date?.includes('-')) {
    return empenho.date.split('-')[0] || '';
  }

  return '';
}

export function RelatorioEmpenhoSelector({
  empenhos,
  invoices,
  empenhoClasses,
  selectedEmpenhoId,
  onSelectEmpenho,
  pregaoFilter,
  onPregaoFilterChange,
  uniquePregaos,
}: RelatorioEmpenhoSelectorProps) {
  const [search, setSearch] = React.useState('');
  const [yearFilter, setYearFilter] = React.useState('Todos');
  const [classFilter, setClassFilter] = React.useState('Todos');
  const [statusFilter, setStatusFilter] = React.useState<SelectorStatus>('Todos');
  const [visibleCount, setVisibleCount] = React.useState(9);

  const years = React.useMemo(
    () => Array.from(new Set(empenhos.map(getEmpenhoYear).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [empenhos]
  );

  const filteredEmpenhos = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

    return empenhos.filter((empenho) => {
      const linkedInvoices = invoices.filter((invoice) => invoice.empenhoId === empenho.id);
      const totalCommitted = empenho.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const totalReceived = linkedInvoices.reduce((sum, invoice) => sum + invoice.totalValue, 0);
      const balance = Math.max(0, totalCommitted - totalReceived);
      const invoicesWithoutNs = linkedInvoices.filter((invoice) => !invoice.numeroNS).length;

      const searchable = [
        empenho.id,
        empenho.supplier,
        empenho.supplierCnpj,
        empenho.description,
        empenho.pregao,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');

      const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
      const matchesPregao = pregaoFilter === 'Todos' || empenho.pregao === pregaoFilter;
      const matchesYear = yearFilter === 'Todos' || getEmpenhoYear(empenho) === yearFilter;
      const matchesClass = classFilter === 'Todos' || empenho.classification === classFilter;

      let matchesStatus = true;
      if (statusFilter === 'Ativos') {
        matchesStatus = empenho.status === 'Ativo';
      } else if (statusFilter === 'ComSaldo') {
        matchesStatus = balance > 0.009;
      } else if (statusFilter === 'Encerrados') {
        matchesStatus = empenho.status === 'Encerrado' || (totalCommitted > 0 && balance <= 0.009);
      } else if (statusFilter === 'PendentesNS') {
        matchesStatus = invoicesWithoutNs > 0;
      }

      return matchesSearch && matchesPregao && matchesYear && matchesClass && matchesStatus;
    });
  }, [
    classFilter,
    empenhos,
    invoices,
    pregaoFilter,
    search,
    statusFilter,
    yearFilter,
  ]);

  React.useEffect(() => {
    setVisibleCount(9);
  }, [search, pregaoFilter, yearFilter, classFilter, statusFilter]);

  const visibleEmpenhos = filteredEmpenhos.slice(0, visibleCount);

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-[#00288e]">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em]">
              Localizar empenho
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-gray-500">
            Pesquise e escolha visualmente a NE que servirá de base para o relatório detalhado.
          </p>
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
          {filteredEmpenhos.length} de {empenhos.length} empenho(s)
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,1.6fr)_repeat(4,minmax(135px,0.7fr))]">
        <label className="relative block">
          <span className="sr-only">Pesquisar empenho</span>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="NE, fornecedor, CNPJ, objeto ou pregão..."
            className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-3 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#00288e] focus:bg-white focus:ring-1 focus:ring-[#00288e]"
          />
        </label>

        <select
          aria-label="Filtrar empenhos por pregão"
          value={pregaoFilter}
          onChange={(event) => onPregaoFilterChange(event.target.value)}
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 outline-none focus:border-[#00288e]"
        >
          <option value="Todos">Todos os Pregões</option>
          {uniquePregaos.map((pregao) => (
            <option key={pregao} value={pregao}>{pregao}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar empenhos por ano"
          value={yearFilter}
          onChange={(event) => setYearFilter(event.target.value)}
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 outline-none focus:border-[#00288e]"
        >
          <option value="Todos">Todos os Anos</option>
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar empenhos por classe"
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 outline-none focus:border-[#00288e]"
        >
          <option value="Todos">Todas as Classes</option>
          {empenhoClasses.map((definition) => (
            <option key={definition.code} value={definition.code}>{definition.code}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar empenhos por situação"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as SelectorStatus)}
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 outline-none focus:border-[#00288e]"
        >
          <option value="Todos">Todas as Situações</option>
          <option value="Ativos">Ativos</option>
          <option value="ComSaldo">Com saldo</option>
          <option value="Encerrados">Encerrados</option>
          <option value="PendentesNS">Com NF sem NS</option>
        </select>
      </div>

      {visibleEmpenhos.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleEmpenhos.map((empenho) => {
              const linkedInvoices = invoices.filter((invoice) => invoice.empenhoId === empenho.id);
              const totalCommitted = empenho.items.reduce(
                (sum, item) => sum + item.quantity * item.unitPrice,
                0
              );
              const totalReceived = linkedInvoices.reduce(
                (sum, invoice) => sum + invoice.totalValue,
                0
              );
              const balance = Math.max(0, totalCommitted - totalReceived);
              const invoicesWithNs = linkedInvoices.filter((invoice) => Boolean(invoice.numeroNS)).length;
              const nsCoverage = linkedInvoices.length > 0
                ? Math.round((invoicesWithNs / linkedInvoices.length) * 100)
                : 0;
              const selected = selectedEmpenhoId === empenho.id;

              return (
                <button
                  key={empenho.id}
                  type="button"
                  onClick={() => onSelectEmpenho(empenho.id)}
                  aria-pressed={selected}
                  className={`group relative flex min-h-[250px] flex-col justify-between rounded-2xl border p-4 text-left transition-all sm:p-5 ${
                    selected
                      ? 'border-[#00288e] bg-blue-50/70 shadow-md ring-1 ring-[#00288e]/10'
                      : 'border-gray-100 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black tracking-wide ${
                          selected ? 'bg-[#00288e] text-white' : 'bg-blue-50 text-[#00288e]'
                        }`}>
                          {empenho.id}
                        </span>
                        {empenho.classification && (
                          <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-gray-600">
                            {empenho.classification}
                          </span>
                        )}
                      </div>
                      {selected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#00288e] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Selecionado
                        </span>
                      )}
                    </div>

                    <p className="mt-3 line-clamp-1 text-sm font-extrabold text-[#0b1c30]">
                      {empenho.supplier}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-gray-400">
                      {empenho.supplierCnpj && (
                        <span>{formatSupplierCnpj(empenho.supplierCnpj)}</span>
                      )}
                      <span>{empenho.pregao || 'Sem Pregão'}</span>
                    </div>

                    <p className="mt-3 line-clamp-2 min-h-10 text-[11px] font-medium leading-relaxed text-gray-500">
                      {empenho.description}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-gray-50 px-3 py-2">
                        <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                          <CircleDollarSign className="h-3 w-3" aria-hidden="true" />
                          Empenhado
                        </span>
                        <span className="mt-0.5 block text-xs font-black text-[#00288e]">
                          R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-2">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">
                          Saldo
                        </span>
                        <span className={`mt-0.5 block text-xs font-black ${
                          balance > 0.009 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                        {linkedInvoices.length} NF(s)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                        {invoicesWithNs} com NS
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${nsCoverage}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-1 text-[9px] font-bold text-gray-400">
                      Cobertura de NS: {nsCoverage}%
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredEmpenhos.length > visibleCount && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((current) => current + 9)}
                className="h-10 rounded-xl border border-blue-100 bg-blue-50/60 px-5 text-xs font-extrabold text-[#00288e] transition hover:bg-blue-100"
              >
                Mostrar mais empenhos ({filteredEmpenhos.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center">
          <p className="text-sm font-extrabold text-gray-500">Nenhum empenho encontrado</p>
          <p className="mt-1 text-xs font-medium text-gray-400">
            Ajuste a busca ou os filtros para ampliar os resultados.
          </p>
        </div>
      )}
    </section>
  );
}
