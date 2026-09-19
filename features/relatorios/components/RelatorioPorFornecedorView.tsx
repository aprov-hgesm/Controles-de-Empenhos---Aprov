'use client';

import React from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  FileText,
  Landmark,
  ReceiptText,
  Search,
} from 'lucide-react';
import type { Empenho, Invoice } from '../../../lib/types';
import { formatSupplierCnpj } from '../../../lib/invoiceIdentity';
import { buildSupplierReports } from '../../../lib/supplierReporting';

interface RelatorioPorFornecedorViewProps {
  empenhos: Empenho[];
  invoices: Invoice[];
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(value?: string): string {
  if (!value) return '—';

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  return value;
}

function invoiceLocationLabel(invoice: Invoice): string {
  if (invoice.localizacaoAtual === 'TESOURARIA') return 'Tesouraria';
  if (invoice.localizacaoAtual === 'COMISSAO') return 'Comissão';
  return 'Aprovisionamento';
}

export function RelatorioPorFornecedorView({ empenhos, invoices }: RelatorioPorFornecedorViewProps) {
  const [search, setSearch] = React.useState('');
  const [selectedCnpj, setSelectedCnpj] = React.useState('');
  const [visibleCount, setVisibleCount] = React.useState(8);

  const supplierReports = React.useMemo(
    () => buildSupplierReports(empenhos, invoices),
    [empenhos, invoices]
  );

  const empenhosWithoutCnpj = React.useMemo(
    () => empenhos.filter((empenho) => !empenho.supplierCnpj).length,
    [empenhos]
  );

  const filteredSuppliers = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    if (!query) return supplierReports;

    const digits = query.replace(/\D/g, '');

    return supplierReports.filter((report) => {
      const names = [report.supplierName, ...report.aliases]
        .join(' ')
        .toLocaleLowerCase('pt-BR');

      return (
        names.includes(query) ||
        report.cnpj.includes(digits) ||
        formatSupplierCnpj(report.cnpj).toLocaleLowerCase('pt-BR').includes(query)
      );
    });
  }, [search, supplierReports]);

  React.useEffect(() => {
    setVisibleCount(8);
  }, [search]);

  React.useEffect(() => {
    if (selectedCnpj && !supplierReports.some((report) => report.cnpj === selectedCnpj)) {
      setSelectedCnpj('');
    }
  }, [selectedCnpj, supplierReports]);

  const selectedSupplier = supplierReports.find((report) => report.cnpj === selectedCnpj) || null;
  const visibleSuppliers = filteredSuppliers.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-[#00288e]">Relatório por Fornecedor</h3>
        <p className="text-sm font-medium text-gray-500">
          Consolidação de Pregões, Notas de Empenho, Notas Fiscais e NS usando o CNPJ como chave única do fornecedor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <Building2 className="mb-2 h-5 w-5 text-[#00288e]" aria-hidden="true" />
          <p className="text-2xl font-black text-[#0b1c30]">{supplierReports.length}</p>
          <p className="text-xs font-bold text-gray-500">Fornecedores identificados</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <ReceiptText className="mb-2 h-5 w-5 text-emerald-600" aria-hidden="true" />
          <p className="text-2xl font-black text-[#0b1c30]">
            {supplierReports.reduce((sum, report) => sum + report.empenhos.length, 0)}
          </p>
          <p className="text-xs font-bold text-gray-500">Empenhos consolidados</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <CircleAlert className="mb-2 h-5 w-5 text-amber-600" aria-hidden="true" />
          <p className="text-2xl font-black text-[#0b1c30]">{empenhosWithoutCnpj}</p>
          <p className="text-xs font-bold text-gray-500">Empenhos ainda sem CNPJ</p>
        </div>
      </div>

      {empenhosWithoutCnpj > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <CircleAlert className="mt-0.5 h-5 w-5 flex-none text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-xs font-extrabold text-amber-800">Base histórica parcialmente identificada</p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-amber-700">
              {empenhosWithoutCnpj} empenho(s) ainda não participam da consolidação por fornecedor porque não possuem CNPJ cadastrado.
              Informe o CNPJ na aba Empenhos para incluí-los automaticamente nesta visão.
            </p>
          </div>
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#00288e]">
              Selecionar fornecedor
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500">
              Pesquise pela razão social ou pelo CNPJ. A consolidação considera todos os empenhos associados ao CNPJ escolhido.
            </p>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
            {filteredSuppliers.length} fornecedor(es)
          </span>
        </div>

        <label className="relative block">
          <span className="sr-only">Pesquisar fornecedor por nome ou CNPJ</span>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Razão social ou CNPJ..."
            className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-3 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#00288e] focus:bg-white focus:ring-1 focus:ring-[#00288e]"
          />
        </label>

        {visibleSuppliers.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visibleSuppliers.map((report) => {
                const selected = selectedCnpj === report.cnpj;
                return (
                  <button
                    key={report.cnpj}
                    type="button"
                    onClick={() => setSelectedCnpj(report.cnpj)}
                    aria-pressed={selected}
                    className={`relative rounded-2xl border p-4 text-left transition-all ${
                      selected
                        ? 'border-[#00288e] bg-blue-50/70 shadow-md ring-1 ring-[#00288e]/10'
                        : 'border-gray-100 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`grid h-9 w-9 place-items-center rounded-xl ${
                        selected ? 'bg-[#00288e] text-white' : 'bg-blue-50 text-[#00288e]'
                      }`}>
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {selected && (
                        <CheckCircle2 className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
                      )}
                    </div>

                    <p className="mt-3 line-clamp-2 min-h-10 text-xs font-extrabold leading-relaxed text-[#0b1c30]">
                      {report.supplierName}
                    </p>
                    <p className="mt-1 font-mono text-[10px] font-bold text-gray-500">
                      {formatSupplierCnpj(report.cnpj)}
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                      <div className="rounded-lg bg-gray-50 px-1 py-2">
                        <span className="block text-sm font-black text-gray-700">{report.empenhos.length}</span>
                        <span className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">NEs</span>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-1 py-2">
                        <span className="block text-sm font-black text-gray-700">{report.pregoes.length}</span>
                        <span className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Pregões</span>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-1 py-2">
                        <span className="block text-sm font-black text-gray-700">{report.invoiceCount}</span>
                        <span className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">NFs</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[9px] font-bold text-gray-400">
                        <span>Cobertura de NS</span>
                        <span>{report.nsCoverage}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${report.nsCoverage}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredSuppliers.length > visibleCount && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + 8)}
                  className="h-10 rounded-xl border border-blue-100 bg-blue-50/60 px-5 text-xs font-extrabold text-[#00288e] transition hover:bg-blue-100"
                >
                  Mostrar mais fornecedores ({filteredSuppliers.length - visibleCount} restantes)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center">
            <p className="text-sm font-extrabold text-gray-500">Nenhum fornecedor encontrado</p>
            <p className="mt-1 text-xs font-medium text-gray-400">
              Ajuste a busca ou cadastre o CNPJ dos empenhos ainda pendentes.
            </p>
          </div>
        )}
      </section>

      {!selectedSupplier ? (
        <div className="rounded-2xl border border-dashed border-blue-100 bg-blue-50/30 px-6 py-10 text-center">
          <Building2 className="mx-auto h-7 w-7 text-blue-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-extrabold text-[#00288e]">Selecione um CNPJ acima</p>
          <p className="mx-auto mt-1 max-w-xl text-xs font-medium leading-relaxed text-gray-500">
            O EMPROVEX consolidará todos os Pregões, NEs, NFs e NS associados ao fornecedor escolhido.
          </p>
        </div>
      ) : (
        <section className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
            <div className="bg-[#00288e] p-5 text-white">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-blue-200">
                    Fornecedor consolidado
                  </p>
                  <h4 className="mt-1 text-lg font-black">{selectedSupplier.supplierName}</h4>
                  <p className="mt-1 font-mono text-xs font-bold text-blue-100">
                    {formatSupplierCnpj(selectedSupplier.cnpj)}
                  </p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider">
                  {selectedSupplier.pregoes.length} Pregão(ões) · {selectedSupplier.empenhos.length} NE(s)
                </span>
              </div>

              {selectedSupplier.aliases.length > 1 && (
                <p className="mt-3 text-[10px] font-medium leading-relaxed text-blue-100/85">
                  Outras grafias cadastradas para este CNPJ: {selectedSupplier.aliases.filter((name) => name !== selectedSupplier.supplierName).join(' · ')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4 lg:grid-cols-8">
              {[
                ['Empenhado', formatCurrency(selectedSupplier.totalCommitted)],
                ['Recebido', formatCurrency(selectedSupplier.totalReceived)],
                ['Saldo', formatCurrency(selectedSupplier.balance)],
                ['Empenhos', String(selectedSupplier.empenhos.length)],
                ['Pregões', String(selectedSupplier.pregoes.length)],
                ['Notas fiscais', String(selectedSupplier.invoiceCount)],
                ['Com NS', String(selectedSupplier.invoicesWithNs)],
                ['Sem NS', String(selectedSupplier.invoicesWithoutNs)],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-3 py-3.5">
                  <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">{label}</p>
                  <p className={`mt-1 font-black ${
                    label === 'Sem NS' && selectedSupplier.invoicesWithoutNs > 0
                      ? 'text-amber-600'
                      : 'text-[#0b1c30]'
                  }`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {selectedSupplier.pregoes.map((pregaoReport) => (
            <section key={pregaoReport.pregao} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-gray-100 bg-gray-50/70 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#00288e]">
                    <Landmark className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400">Pregão / Processo</p>
                    <p className="text-sm font-black text-[#0b1c30]">{pregaoReport.pregao}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[9px] font-bold">
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-gray-600">{pregaoReport.empenhos.length} NE(s)</span>
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-gray-600">{pregaoReport.invoiceCount} NF(s)</span>
                  <span className={`rounded-lg px-2.5 py-1.5 ${
                    pregaoReport.invoicesWithoutNs > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {pregaoReport.invoicesWithoutNs} NF(s) sem NS
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-px border-b border-gray-100 bg-gray-100 sm:grid-cols-3">
                <div className="bg-white px-4 py-3">
                  <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Empenhado no Pregão</p>
                  <p className="mt-1 text-sm font-black text-[#00288e]">{formatCurrency(pregaoReport.totalCommitted)}</p>
                </div>
                <div className="bg-white px-4 py-3">
                  <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Recebido</p>
                  <p className="mt-1 text-sm font-black text-emerald-600">{formatCurrency(pregaoReport.totalReceived)}</p>
                </div>
                <div className="bg-white px-4 py-3">
                  <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Saldo</p>
                  <p className="mt-1 text-sm font-black text-amber-600">{formatCurrency(pregaoReport.balance)}</p>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {pregaoReport.empenhos.map((empenhoReport) => (
                  <details
                    key={empenhoReport.empenho.id}
                    className="group overflow-hidden rounded-xl border border-gray-100 bg-white open:border-blue-100 open:shadow-sm"
                  >
                    <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 transition hover:bg-blue-50/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-black text-[#00288e]">
                            {empenhoReport.empenho.id}
                          </span>
                          {empenhoReport.empenho.classification && (
                            <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[9px] font-extrabold text-gray-500">
                              {empenhoReport.empenho.classification}
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-gray-400">
                            {empenhoReport.empenho.status}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-gray-600">
                          {empenhoReport.empenho.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 sm:flex-none">
                        <div>
                          <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Empenhado</p>
                          <p className="text-xs font-black text-[#00288e]">{formatCurrency(empenhoReport.totalCommitted)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Recebido</p>
                          <p className="text-xs font-black text-emerald-600">{formatCurrency(empenhoReport.totalReceived)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Saldo</p>
                          <p className="text-xs font-black text-amber-600">{formatCurrency(empenhoReport.balance)}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-[9px] font-extrabold text-gray-500">
                          {empenhoReport.invoices.length} NF(s)
                          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden="true" />
                        </span>
                      </div>
                    </summary>

                    <div className="border-t border-gray-100 bg-gray-50/40 p-4">
                      {empenhoReport.invoices.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 text-center text-xs font-semibold text-gray-400">
                          Nenhuma Nota Fiscal cadastrada neste empenho.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                          <table className="w-full min-w-[720px] text-left text-xs">
                            <thead>
                              <tr className="border-b border-gray-100 bg-gray-50 text-[9px] uppercase tracking-wider text-gray-500">
                                <th className="px-3 py-2.5 font-extrabold">Nota Fiscal</th>
                                <th className="px-3 py-2.5 font-extrabold">Emissão</th>
                                <th className="px-3 py-2.5 font-extrabold">NS</th>
                                <th className="px-3 py-2.5 font-extrabold">Localização</th>
                                <th className="px-3 py-2.5 text-right font-extrabold">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {empenhoReport.invoices.map((invoice) => (
                                <tr key={invoice.recordKey || `${invoice.empenhoId}-${invoice.id}`} className="hover:bg-gray-50/60">
                                  <td className="px-3 py-3 font-black text-[#00288e]">NF {invoice.id}</td>
                                  <td className="px-3 py-3 font-semibold text-gray-600">{formatDate(invoice.issueDate)}</td>
                                  <td className="px-3 py-3">
                                    {invoice.numeroNS ? (
                                      <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 font-mono text-[10px] font-bold text-indigo-700">
                                        {invoice.numeroNS}
                                      </span>
                                    ) : (
                                      <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                                        Pendente
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-[10px] font-bold text-gray-500">
                                    {invoiceLocationLabel(invoice)}
                                  </td>
                                  <td className="px-3 py-3 text-right font-black text-emerald-600">
                                    {formatCurrency(invoice.totalValue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg bg-white px-3 py-2">
                          <CircleDollarSign className="mb-1 h-3.5 w-3.5 text-[#00288e]" aria-hidden="true" />
                          <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Valor das NFs</p>
                          <p className="text-xs font-black text-[#0b1c30]">{formatCurrency(empenhoReport.totalReceived)}</p>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <FileText className="mb-1 h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
                          <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Notas fiscais</p>
                          <p className="text-xs font-black text-[#0b1c30]">{empenhoReport.invoices.length}</p>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <CheckCircle2 className="mb-1 h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                          <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Com NS</p>
                          <p className="text-xs font-black text-emerald-700">{empenhoReport.invoicesWithNs}</p>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <CircleAlert className="mb-1 h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                          <p className="text-[8px] font-extrabold uppercase tracking-wider text-gray-400">Sem NS</p>
                          <p className="text-xs font-black text-amber-700">{empenhoReport.invoicesWithoutNs}</p>
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
    </div>
  );
}
