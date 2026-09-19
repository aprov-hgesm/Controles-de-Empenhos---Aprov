'use client';

import React from 'react';
import { Edit, Eye, FileDown, FileSpreadsheet, FileText, Package, Printer, Save, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Empenho, Invoice } from '../../../lib/types';
import { getInvoiceRecordKey } from '../../../lib/invoiceIdentity';
import { classRequiresTermoRecebimento, type EmpenhoClassDefinition } from '../../../lib/empenhoClasses';
import { RelatorioEmpenhoSelector } from './RelatorioEmpenhoSelector';
import {
  filterInvoicesByReportingPeriod,
  formatReportingPeriodLabel,
  isReportingPeriodValid,
  normalizeOperationalDate,
} from '../../../lib/reportingPeriod';

export interface RelatoriosViewContext {
  editingNSId: string | null;
  empenhoClasses: EmpenhoClassDefinition[];
  empenhos: Empenho[];
  formatDateOnly: any;
  handleDownloadTermoRecebimento: (...args: any[]) => any;
  handleGenerateEmpenhoReportPDF: (...args: any[]) => any;
  handleSaveNumeroNS: (...args: any[]) => any;
  invoices: Invoice[];
  relatoriosPregaoFilter: string;
  reportEndDate: string;
  reportSearch: string;
  reportStartDate: string;
  selectedReportInvoice: Invoice | null;
  setEditingNSId: (...args: any[]) => any;
  setRelatoriosPregaoFilter: (...args: any[]) => any;
  setReportEndDate: (...args: any[]) => any;
  setReportSearch: (...args: any[]) => any;
  setReportStartDate: (...args: any[]) => any;
  setSelectedReportInvoice: (...args: any[]) => any;
  setShowPdfModal: (...args: any[]) => any;
  setTempNSValue: (...args: any[]) => any;
  showPdfModal: boolean;
  tempNSValue: string;
  uniquePregaos: string[];
}

interface RelatorioPorEmpenhoViewProps {
  context: RelatoriosViewContext;
}
/** Relatório operacional por empenho preservado do fluxo legado da aba Relatórios. */
export function RelatorioPorEmpenhoView({ context }: RelatorioPorEmpenhoViewProps) {
  const { editingNSId, empenhoClasses, empenhos, formatDateOnly, handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF, handleSaveNumeroNS, invoices, relatoriosPregaoFilter, reportEndDate, reportSearch, reportStartDate, selectedReportInvoice, setEditingNSId, setRelatoriosPregaoFilter, setReportEndDate, setReportSearch, setReportStartDate, setSelectedReportInvoice, setShowPdfModal, setTempNSValue, showPdfModal, tempNSValue, uniquePregaos } = context;

  const invoiceRequiresTR = (invoice: Invoice): boolean => {
    const empenho = empenhos.find((item) => item.id === invoice.empenhoId);
    return classRequiresTermoRecebimento(empenho?.classification, empenhoClasses);
  };

  const reportingPeriod = {
    startDate: reportStartDate || undefined,
    endDate: reportEndDate || undefined,
  };
  const reportingPeriodValid = isReportingPeriodValid(reportingPeriod);
  const reportingPeriodLabel = formatReportingPeriodLabel(reportingPeriod);
  const hasReportingPeriod = Boolean(reportStartDate || reportEndDate);

  return (
            <div className="space-y-6">

              <div>
                <h3 className="text-xl font-bold tracking-tight text-[#00288e]">Relatório por Empenho</h3>
                <p className="text-sm text-gray-500 font-medium">Conciliação detalhada de Notas Fiscais, NS, recebimentos e saldos do empenho selecionado.</p>
              </div>

              <RelatorioEmpenhoSelector
                empenhos={empenhos}
                invoices={invoices}
                empenhoClasses={empenhoClasses}
                selectedEmpenhoId={reportSearch}
                onSelectEmpenho={setReportSearch}
                pregaoFilter={relatoriosPregaoFilter}
                onPregaoFilterChange={setRelatoriosPregaoFilter}
                uniquePregaos={uniquePregaos}
              />

              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-1 pb-3">
                  <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#00288e]">
                    Recorte temporal das Notas Fiscais
                  </span>
                  <p className="text-[11px] font-medium text-gray-500">
                    O período filtra as NFs e os indicadores do intervalo. O saldo atual do empenho continua acumulado.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                      Período inicial
                    </label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(event) => setReportStartDate(event.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 outline-none focus:border-[#00288e]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                      Período final
                    </label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(event) => setReportEndDate(event.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 outline-none focus:border-[#00288e]"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <span className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${
                    reportingPeriodValid
                      ? 'bg-blue-50 text-[#00288e]'
                      : 'bg-rose-50 text-rose-700'
                  }`}>
                    {reportingPeriodLabel}
                  </span>
                  {!reportingPeriodValid && (
                    <span className="text-[10px] font-bold text-rose-600">
                      A data inicial não pode ser posterior à data final.
                    </span>
                  )}
                </div>
              </section>

              {/* Reconciliation Report Card */}
              {(() => {
                const emp = empenhos.find(e => e.id === reportSearch);
                if (!emp) {
                  return (
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
                      <p className="text-sm font-semibold text-gray-400">Selecione uma Nota de Empenho acima para gerar o relatório.</p>
                    </div>
                  );
                }

                const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                const empRequiresTR = classRequiresTermoRecebimento(emp.classification, empenhoClasses);

                const allLinkedInvoices = invoices.filter((inv) => inv.empenhoId === emp.id);
                const linkedInvoices = [...filterInvoicesByReportingPeriod(allLinkedInvoices, reportingPeriod)]
                  .sort((a, b) => normalizeOperationalDate(b.issueDate).localeCompare(normalizeOperationalDate(a.issueDate)));
                const totalReceivedNfe = allLinkedInvoices.reduce((sum, inv) => sum + inv.totalValue, 0);
                const periodReceivedNfe = linkedInvoices.reduce((sum, inv) => sum + inv.totalValue, 0);
                const totalPendingToReceive = Math.max(0, totalCommitted - totalReceivedNfe);
                const invoicesWithNs = linkedInvoices.filter((inv) => Boolean(inv.numeroNS)).length;
                const invoicesWithoutNs = linkedInvoices.length - invoicesWithNs;
                const nsCoverage = linkedInvoices.length > 0
                  ? Math.round((invoicesWithNs / linkedInvoices.length) * 100)
                  : 0;

                return (
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

                      {/* Card header banner */}
                      <div className="bg-[#00288e] text-white p-5 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-bold tracking-wider text-blue-100 uppercase">{emp.id} - DETALHAMENTO</p>
                          <h3 className="font-extrabold text-base sm:text-lg">{emp.description}</h3>
                        </div>
                        <span className="bg-white text-[#00288e] px-3 py-1 rounded-full font-bold text-xs tracking-wider uppercase">
                          {emp.status === 'Ativo' ? 'Em Andamento' : emp.status}
                        </span>
                      </div>

                      {/* Numeric summary block */}
                      <div className="p-5 border-b border-gray-50 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">VALOR TOTAL EMPENHADO</span>
                            <span className="text-xl sm:text-2xl font-black text-[#00288e]">
                              R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">TOTAL RECEBIDO (NF-e)</span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600">
                              R$ {totalReceivedNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">TOTAL A RECEBER</span>
                            <span className={`text-xl sm:text-2xl font-black ${totalPendingToReceive > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                              R$ {totalPendingToReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                              NFs {hasReportingPeriod ? 'NO PERÍODO' : 'CADASTRADAS'}
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-gray-700">
                              {linkedInvoices.length || 'Nenhuma'}
                            </span>
                            {hasReportingPeriod && (
                              <span className="mt-0.5 block text-[10px] font-semibold text-gray-400">
                                {allLinkedInvoices.length} NF(s) no empenho inteiro
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 lg:grid-cols-4">
                          <div className="rounded-xl bg-blue-50/60 px-3 py-2.5">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-500">Valor no recorte</span>
                            <span className="mt-0.5 block text-sm font-black text-[#00288e]">
                              R$ {periodReceivedNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="rounded-xl bg-emerald-50/60 px-3 py-2.5">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600">NFs com NS</span>
                            <span className="mt-0.5 block text-sm font-black text-emerald-700">{invoicesWithNs}</span>
                          </div>
                          <div className={`rounded-xl px-3 py-2.5 ${invoicesWithoutNs > 0 ? 'bg-amber-50/70' : 'bg-gray-50'}`}>
                            <span className={`text-[9px] font-extrabold uppercase tracking-wider ${invoicesWithoutNs > 0 ? 'text-amber-600' : 'text-gray-400'}`}>NFs sem NS</span>
                            <span className={`mt-0.5 block text-sm font-black ${invoicesWithoutNs > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{invoicesWithoutNs}</span>
                          </div>
                          <div className="rounded-xl bg-indigo-50/60 px-3 py-2.5">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-500">Cobertura de NS</span>
                            <span className="mt-0.5 block text-sm font-black text-indigo-700">{nsCoverage}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Items reconciliation lists matching image 1 */}
                      <div className="p-5 space-y-4">
                        <h4 className="font-extrabold text-sm text-gray-700 uppercase tracking-wider">Itens do Empenho</h4>

                        <div className="space-y-4">
                          {emp.items.length === 0 ? (
                            <p className="text-xs text-gray-500 italic py-2">Sem itens vinculados a esta Nota de Empenho.</p>
                          ) : (
                            emp.items.map((item) => {
                              const pct = item.quantity > 0 ? Math.round((item.received / item.quantity) * 100) : 0;
                              const balance = item.quantity - item.received;

                              // Visual variation of bars matching image 1 (Dipirona progress is red, others are blue)
                              const isAlertState = pct <= 30;

                              return (
                                <div key={item.id} className="space-y-1.5">
                                  <div className="flex justify-between items-start text-xs font-bold text-gray-700">
                                    <div>
                                      <p className="font-extrabold text-gray-800">{item.name}</p>
                                      <span className="text-[10px] text-gray-400 font-semibold font-mono">ID: {item.id}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className={`${isAlertState ? 'text-rose-600' : 'text-[#00288e]'}`}>{pct}%</span>
                                      <span className="text-gray-400 ml-2 font-normal">
                                        {balance === 0 ? 'Concluído' : `${balance.toLocaleString('pt-BR')} ${item.unit} rest.`}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-500 ${isAlertState ? 'bg-rose-600' : 'bg-[#00288e]'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Relatório de Notas Fiscais Cadastradas */}
                      <div className="p-5 border-t border-gray-100 bg-[#f8f9ff]/50 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-extrabold text-sm text-gray-700 uppercase tracking-wider flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#00288e]" /> {hasReportingPeriod ? 'Notas Fiscais no Período' : 'Notas Fiscais Cadastradas no Empenho'}
                          </h4>
                          <span className="text-xs bg-[#e5eeff] text-[#00288e] px-2.5 py-0.5 rounded-full font-bold">
                            {linkedInvoices.length} {linkedInvoices.length === 1 ? 'Nota' : 'Notas'}
                          </span>
                        </div>

                        {linkedInvoices.length === 0 ? (
                          <div className="p-6 bg-white rounded-xl text-center border border-dashed border-gray-200">
                            <p className="text-xs text-gray-500 font-medium">
                              {hasReportingPeriod
                                ? `Nenhuma nota fiscal emitida em ${reportingPeriodLabel}.`
                                : 'Nenhuma nota fiscal cadastrada para este empenho até o momento.'}
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
                            <table className="w-full text-left border-collapse text-xs sm:text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] uppercase tracking-wider">
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Número da NF</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Data de Emissão</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Data de Emissão do TR</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Data da Comissão</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Data da Tesouraria</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500">Número da NS</th>
                                  <th className="py-3 px-3.5 font-bold text-gray-500 text-right">Valor Total da NF</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {linkedInvoices.map((inv) => {
                                  const formattedIssueDate = formatDateOnly(inv.issueDate);
                                  const effectiveTrDate = inv.termoEmissaoDate || (inv.termoNumero ? (inv.registeredAt || inv.issueDate) : null);
                                  const formattedTrDate = effectiveTrDate ? formatDateOnly(effectiveTrDate) : null;
                                  const formattedComissaoDate = inv.comissaoDate
                                    ? formatDateOnly(inv.comissaoDate)
                                    : null;
                                  const formattedTesourariaDate = inv.tesourariaDate
                                    ? formatDateOnly(inv.tesourariaDate)
                                    : null;

                                  return (
                                    <tr key={getInvoiceRecordKey(inv)} className="hover:bg-gray-50/50 transition-colors">
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        <button
                                          id={`btn-report-nf-detail-${getInvoiceRecordKey(inv)}`}
                                          onClick={() => setSelectedReportInvoice(inv)}
                                          className="group inline-flex items-center gap-1.5 font-bold text-[#00288e] hover:text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 px-2.5 py-1 rounded-lg transition-all text-xs border border-blue-200/60 active:scale-95 shadow-xs"
                                          title="Clique para ver os itens detalhados desta Nota Fiscal"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-[#00288e] group-hover:scale-110 transition-transform" />
                                          <span>NF {inv.id}</span>
                                        </button>
                                      </td>
                                      <td className="py-3 px-3.5 text-gray-600 font-semibold whitespace-nowrap">
                                        {formattedIssueDate}
                                      </td>
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        {!empRequiresTR ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs border border-emerald-100">
                                            Dispensado
                                          </span>
                                        ) : effectiveTrDate ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs border border-emerald-100">
                                            {formattedTrDate} {inv.termoNumero ? `(TR Nº ${inv.termoNumero})` : ''}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 font-normal italic text-xs">Pendente</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        {!empRequiresTR ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs border border-emerald-100">
                                            Dispensada
                                          </span>
                                        ) : inv.comissaoDate ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-xs border border-blue-100">
                                            {formattedComissaoDate}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 font-normal italic text-xs">Pendente</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        {inv.tesourariaDate ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md text-xs border border-purple-100">
                                            {formattedTesourariaDate}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 font-normal italic text-xs">Pendente</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        {editingNSId === getInvoiceRecordKey(inv) ? (
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="text"
                                              id={`input-ns-${getInvoiceRecordKey(inv)}`}
                                              value={tempNSValue}
                                              onChange={(e) => setTempNSValue(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleSaveNumeroNS(getInvoiceRecordKey(inv), tempNSValue);
                                                } else if (e.key === 'Escape') {
                                                  setEditingNSId(null);
                                                  setTempNSValue('');
                                                }
                                              }}
                                              placeholder="Ex: 2026NS..."
                                              autoFocus
                                              className="w-32 sm:w-36 h-8 px-2 text-xs font-mono font-bold border border-[#00288e] rounded-lg bg-white text-gray-800 outline-none shadow-xs focus:ring-1 focus:ring-[#00288e]"
                                            />
                                            <button
                                              id={`btn-save-ns-${getInvoiceRecordKey(inv)}`}
                                              type="button"
                                              onClick={() => handleSaveNumeroNS(getInvoiceRecordKey(inv), tempNSValue)}
                                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg transition-all shadow-xs flex items-center justify-center"
                                              title="Salvar Número da NS"
                                            >
                                              <Save className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              id={`btn-cancel-ns-${getInvoiceRecordKey(inv)}`}
                                              type="button"
                                              onClick={() => {
                                                setEditingNSId(null);
                                                setTempNSValue('');
                                              }}
                                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all flex items-center justify-center"
                                              title="Cancelar"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            {inv.numeroNS ? (
                                              <span className="inline-flex items-center gap-1 font-mono font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md text-xs border border-indigo-100 shadow-2xs">
                                                {inv.numeroNS}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 font-normal italic text-xs">
                                                —
                                              </span>
                                            )}

                                            <div className="flex items-center gap-1">
                                              <button
                                                id={`btn-edit-ns-${getInvoiceRecordKey(inv)}`}
                                                type="button"
                                                onClick={() => {
                                                  setEditingNSId(getInvoiceRecordKey(inv));
                                                  setTempNSValue(inv.numeroNS || '');
                                                }}
                                                className="p-1 rounded-lg text-gray-400 hover:text-[#00288e] hover:bg-blue-50 transition-all active:scale-95 border border-transparent hover:border-blue-200/50"
                                                title={inv.numeroNS ? "Editar Número da NS" : "Informar Número da NS"}
                                              >
                                                <Edit className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                id={`btn-quick-save-ns-${getInvoiceRecordKey(inv)}`}
                                                type="button"
                                                onClick={() => {
                                                  setEditingNSId(getInvoiceRecordKey(inv));
                                                  setTempNSValue(inv.numeroNS || '');
                                                }}
                                                className="p-1 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all active:scale-95 border border-transparent hover:border-emerald-200/50"
                                                title="Editar e Salvar Número da NS"
                                              >
                                                <Save className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 px-3.5 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                                        R$ {inv.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Action button row */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        id="btn-download-report-pdf-main"
                        onClick={() => {
                          const emp = empenhos.find(e => e.id === reportSearch);
                          if (emp) handleGenerateEmpenhoReportPDF(emp, 'download', reportingPeriod);
                        }}
                        className="px-5 py-2.5 bg-[#00288e] hover:bg-[#001e6a] text-white active:scale-95 duration-100 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all"
                      >
                        <FileDown className="w-4 h-4" /> Baixar Relatório PDF
                      </button>
                      <button
                        id="btn-print-report-pdf-main"
                        onClick={() => {
                          const emp = empenhos.find(e => e.id === reportSearch);
                          if (emp) handleGenerateEmpenhoReportPDF(emp, 'print', reportingPeriod);
                        }}
                        className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 duration-100 rounded-xl font-bold text-xs sm:text-sm text-gray-700 flex items-center gap-2 shadow-xs transition-all"
                      >
                        <Printer className="w-4 h-4 text-[#00288e]" /> Imprimir / Visualizar PDF
                      </button>
                      <button
                        id="btn-preview-report-modal"
                        onClick={() => setShowPdfModal(true)}
                        className="px-4 py-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 duration-100 rounded-xl font-semibold text-xs sm:text-sm text-gray-600 flex items-center gap-2 transition-all"
                      >
                        <Eye className="w-4 h-4 text-gray-500" /> Prévia na Tela
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* PDF Print Mock modal overlay */}
              <AnimatePresence>
                {showPdfModal && (
                  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
                    >
                      <div className="bg-[#0b1c30] text-white p-4 flex justify-between items-center flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <Printer className="w-5 h-5 text-blue-400" />
                          <h3 className="font-bold text-sm">Visualização de Impressão de Relatório</h3>
                        </div>
                        <button onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-white">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Paper formatted printable report preview */}
                      <div className="p-8 space-y-6 overflow-y-auto bg-gray-50 flex-1 font-sans text-xs sm:text-sm text-gray-800">
                        <div className="bg-white p-8 border shadow-sm max-w-2xl mx-auto space-y-6">

                          {/* Print header */}
                          <div className="flex justify-between items-start border-b pb-4 border-gray-100">
                            <div>
                              <h2 className="text-base font-extrabold text-[#00288e] tracking-tight">CONTROLE DE EMPENHOS - APROV</h2>
                              <p className="text-[10px] text-gray-400 font-bold">Relatório Consolidado de Conciliação e Recebimento</p>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono">Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
                          </div>

                          {/* Print details */}
                          {(() => {
                            const emp = empenhos.find(e => e.id === reportSearch);
                            if (!emp) return null;
                            const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                            const empRequiresTR = classRequiresTermoRecebimento(emp.classification, empenhoClasses);
                            const allPdfInvoices = invoices.filter((inv) => inv.empenhoId === emp.id);
                            const pdfInvoices = filterInvoicesByReportingPeriod(allPdfInvoices, reportingPeriod);
                            const pdfTotalReceivedNfe = pdfInvoices.reduce((sum, inv) => sum + inv.totalValue, 0);
                            const pdfAccumulatedReceivedNfe = allPdfInvoices.reduce((sum, inv) => sum + inv.totalValue, 0);

                            return (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Código de Empenho (NE)</p>
                                    <p className="font-extrabold text-[#00288e]">{emp.id}</p>
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Fornecedor Contratado</p>
                                    <p className="font-extrabold text-gray-700">{emp.supplier}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Objeto do Contrato</p>
                                    <p className="font-semibold text-gray-600">{emp.description}</p>
                                  </div>
                                </div>

                                <div className="border-t border-b border-gray-100 py-3 grid grid-cols-3 gap-4">
                                  <div>
                                    <p className="font-bold text-gray-400 text-[9px]">VALOR TOTAL CONTRATADO</p>
                                    <p className="text-sm sm:text-base font-black text-gray-800">R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-400 text-[9px]">NF-e NO RECORTE</p>
                                    <p className="text-sm sm:text-base font-black text-emerald-600">R$ {pdfTotalReceivedNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-gray-400 text-[9px]">SALDO ATUAL</p>
                                    <p className="text-sm sm:text-base font-black text-amber-600">R$ {Math.max(0, totalCommitted - pdfAccumulatedReceivedNfe).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  </div>
                                </div>

                                {/* Items list */}
                                <div className="space-y-2">
                                  <p className="font-bold text-gray-500 uppercase text-[9px] tracking-wider">Status Físico dos Itens</p>
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b bg-gray-50">
                                        <th className="py-1 px-2 font-bold text-gray-600">ID / Item</th>
                                        <th className="py-1 px-2 font-bold text-gray-600 text-right">Contratado</th>
                                        <th className="py-1 px-2 font-bold text-gray-600 text-right">Conciliado</th>
                                        <th className="py-1 px-2 font-bold text-gray-600 text-right">Saldo Restante</th>
                                        <th className="py-1 px-2 font-bold text-gray-600 text-right">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {emp.items.map((item) => {
                                        const balance = item.quantity - item.received;
                                        return (
                                          <tr key={item.id}>
                                            <td className="py-2 px-2 font-medium">
                                              {item.name} <span className="text-[9px] text-gray-400 font-mono block">({item.id})</span>
                                            </td>
                                            <td className="py-2 px-2 text-right">{item.quantity.toLocaleString('pt-BR')} {item.unit}</td>
                                            <td className="py-2 px-2 text-right text-emerald-600 font-bold">{item.received.toLocaleString('pt-BR')} {item.unit}</td>
                                            <td className="py-2 px-2 text-right text-gray-500">{balance.toLocaleString('pt-BR')} {item.unit}</td>
                                            <td className="py-2 px-2 text-right font-bold text-[#00288e]">
                                              {balance === 0 ? 'CONCLUÍDO' : `${Math.round((item.received / item.quantity) * 100)}%`}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Invoices list */}
                                <div className="space-y-2 pt-4 border-t border-gray-100">
                                  <p className="font-bold text-gray-500 uppercase text-[9px] tracking-wider">Notas Fiscais Cadastradas</p>
                                  {pdfInvoices.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic py-2">Nenhuma nota fiscal cadastrada para este empenho até o momento.</p>
                                  ) : (
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b bg-gray-50 text-[10px]">
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Número da NF</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Data de Emissão</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Data de Emissão do TR</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Data da Comissão</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Data da Tesouraria</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600">Número da NS</th>
                                          <th className="py-1.5 px-2 font-bold text-gray-600 text-right">Valor Total da NF</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y text-[11px]">
                                        {pdfInvoices.map((inv) => {
                                          const formattedIssueDate = formatDateOnly(inv.issueDate);
                                          const effectiveTrDate = inv.termoEmissaoDate || (inv.termoNumero ? (inv.registeredAt || inv.issueDate) : null);
                                          const formattedTrDate = !empRequiresTR
                                            ? 'Dispensado'
                                            : effectiveTrDate
                                              ? `${formatDateOnly(effectiveTrDate)}${inv.termoNumero ? ` (TR Nº ${inv.termoNumero})` : ''}`
                                              : 'Pendente';
                                          const formattedComissaoDate = !empRequiresTR
                                            ? 'Dispensada'
                                            : inv.comissaoDate
                                              ? formatDateOnly(inv.comissaoDate)
                                              : 'Pendente';
                                          const formattedTesourariaDate = inv.tesourariaDate ? formatDateOnly(inv.tesourariaDate) : 'Pendente';
                                          const formattedNS = inv.numeroNS ? inv.numeroNS : '—';

                                          return (
                                            <tr key={getInvoiceRecordKey(inv)}>
                                              <td className="py-1.5 px-2">
                                                <button
                                                  onClick={() => setSelectedReportInvoice(inv)}
                                                  className="font-bold text-[#00288e] hover:underline"
                                                  title="Clique para ver os itens detalhados desta NF"
                                                >
                                                  NF {inv.id}
                                                </button>
                                              </td>
                                              <td className="py-1.5 px-2 text-gray-600">{formattedIssueDate}</td>
                                              <td className="py-1.5 px-2 text-gray-700">{formattedTrDate}</td>
                                              <td className="py-1.5 px-2 text-gray-700">{formattedComissaoDate}</td>
                                              <td className="py-1.5 px-2 text-gray-700">{formattedTesourariaDate}</td>
                                              <td className="py-1.5 px-2 font-mono font-bold text-indigo-900">{formattedNS}</td>
                                              <td className="py-1.5 px-2 text-right font-bold text-emerald-600">
                                                R$ {inv.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>

                              </div>
                            );
                          })()}

                        </div>
                      </div>

                      <div className="p-4 bg-gray-100 flex flex-wrap justify-between items-center gap-3 flex-shrink-0">
                        <button
                          id="btn-close-pdf-preview"
                          onClick={() => setShowPdfModal(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-300 transition-all"
                        >
                          Fechar
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            id="btn-download-pdf-from-preview"
                            onClick={() => {
                              const emp = empenhos.find(e => e.id === reportSearch);
                              if (emp) handleGenerateEmpenhoReportPDF(emp, 'download', reportingPeriod);
                            }}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <FileDown className="w-4 h-4" /> Baixar Arquivo PDF
                          </button>
                          <button
                            id="btn-print-pdf-from-preview"
                            onClick={() => {
                              const emp = empenhos.find(e => e.id === reportSearch);
                              if (emp) handleGenerateEmpenhoReportPDF(emp, 'print', reportingPeriod);
                            }}
                            className="px-4 py-2 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <Printer className="w-4 h-4" /> Imprimir Documento PDF
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Modal de Detalhamento dos Itens da Nota Fiscal */}
              <AnimatePresence>
                {selectedReportInvoice && (
                  <div
                    id="modal-nf-items-detail-overlay"
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
                  >
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 12 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 12 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden"
                    >
                      {/* Modal Header */}
                      <div className="bg-gradient-to-r from-[#00288e] to-[#001c66] text-white p-4 sm:p-5 flex justify-between items-center flex-shrink-0 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs flex items-center justify-center">
                            <FileSpreadsheet className="w-5 h-5 text-blue-200" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-base sm:text-lg tracking-tight">
                                Detalhamento da Nota Fiscal #{selectedReportInvoice.id}
                              </h3>
                              {selectedReportInvoice.termoNumero && (
                                <span className="bg-emerald-400/20 text-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                                  TR Nº {selectedReportInvoice.termoNumero}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                              Empenho: <span className="font-bold text-white">{selectedReportInvoice.empenhoId}</span> • Fornecedor: <span className="font-semibold text-blue-50">{selectedReportInvoice.supplier}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          id="btn-close-nf-modal"
                          onClick={() => setSelectedReportInvoice(null)}
                          className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                          title="Fechar janela"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-gray-50/50">

                        {/* Summary Metadata Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Emissão da NF</span>
                            <span className="text-xs font-bold text-gray-800">
                              {formatDateOnly(selectedReportInvoice.issueDate)}
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Cadastramento</span>
                            <span className="text-xs font-bold text-gray-800">
                              {selectedReportInvoice.registeredAt
                                ? formatDateOnly(selectedReportInvoice.registeredAt)
                                : formatDateOnly(selectedReportInvoice.issueDate)}
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Comissão Receb.</span>
                            {!invoiceRequiresTR(selectedReportInvoice) ? (
                              <span className="text-xs font-bold text-emerald-700">Dispensada pela classe</span>
                            ) : selectedReportInvoice.comissaoDate ? (
                              <span className="text-xs font-bold text-blue-700">
                                {formatDateOnly(selectedReportInvoice.comissaoDate)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-amber-600">Aguardando</span>
                            )}
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Tesouraria</span>
                            {selectedReportInvoice.tesourariaDate ? (
                              <span className="text-xs font-bold text-purple-700">
                                {formatDateOnly(selectedReportInvoice.tesourariaDate)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-gray-400">Pendente</span>
                            )}
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Número da NS (Liquidação)</span>
                            {selectedReportInvoice.numeroNS ? (
                              <span className="text-xs font-bold text-indigo-800 font-mono">
                                {selectedReportInvoice.numeroNS}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-gray-400 italic">Não informada</span>
                            )}
                          </div>
                        </div>

                        {/* Detailed items list */}
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-1.5">
                              <Package className="w-4 h-4 text-[#00288e]" />
                              <span className="font-extrabold text-gray-700 uppercase text-[11px] tracking-wider">
                                Itens Faturados nesta Nota Fiscal
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              {selectedReportInvoice.items.length} {selectedReportInvoice.items.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>

                          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-gray-50/90 border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                  <th className="py-3 px-3.5">Código</th>
                                  <th className="py-3 px-3.5">Descrição do Material</th>
                                  <th className="py-3 px-3.5 text-center">Und</th>
                                  <th className="py-3 px-3.5 text-right">Quantidade</th>
                                  <th className="py-3 px-3.5 text-right">Valor Unitário</th>
                                  <th className="py-3 px-3.5 text-right">Valor Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {(() => {
                                  const targetEmpenho = empenhos.find(e => e.id === selectedReportInvoice.empenhoId);
                                  return selectedReportInvoice.items.map((invItem, idx) => {
                                    const itemDef = targetEmpenho?.items.find(i => i.id === invItem.itemId);
                                    const itemName = itemDef?.name || `Item #${invItem.itemId}`;
                                    const itemUnit = itemDef?.unit || 'UN';
                                    const itemSubtotal = invItem.subtotal || (invItem.quantity * invItem.unitPrice);

                                    return (
                                      <tr key={invItem.itemId || idx} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="py-3 px-3.5 font-mono font-bold text-[#00288e] whitespace-nowrap">
                                          {invItem.itemId}
                                        </td>
                                        <td className="py-3 px-3.5 font-semibold text-gray-800">
                                          {itemName}
                                        </td>
                                        <td className="py-3 px-3.5 text-center font-medium text-gray-500 uppercase whitespace-nowrap">
                                          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                            {itemUnit}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3.5 text-right font-extrabold text-gray-800 whitespace-nowrap">
                                          {invItem.quantity.toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-3 px-3.5 text-right font-medium text-gray-600 whitespace-nowrap">
                                          R$ {invItem.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3 px-3.5 text-right font-black text-emerald-600 whitespace-nowrap">
                                          R$ {itemSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Financial summary highlight */}
                        <div className="bg-gradient-to-r from-blue-50/80 via-emerald-50/60 to-emerald-50 p-4 rounded-xl border border-emerald-200/70 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">
                              Resumo da Nota Fiscal #{selectedReportInvoice.id}
                            </span>
                            <span className="text-xs text-gray-600 font-medium">
                              Volume total de faturamento: <strong className="text-gray-800">{selectedReportInvoice.items.reduce((s, it) => s + it.quantity, 0).toLocaleString('pt-BR')}</strong> unidades distribuídas em <strong className="text-gray-800">{selectedReportInvoice.items.length}</strong> {selectedReportInvoice.items.length === 1 ? 'item' : 'itens'}.
                            </span>
                          </div>
                          <div className="text-left sm:text-right bg-white px-4 py-2 rounded-xl border border-emerald-200/80 shadow-xs flex-shrink-0">
                            <span className="text-[10px] text-emerald-700 font-black uppercase block tracking-wider">
                              Valor Total da Nota
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                              R$ {selectedReportInvoice.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                      </div>

                      {/* Modal Footer */}
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap justify-between items-center gap-3 flex-shrink-0">
                        {invoiceRequiresTR(selectedReportInvoice) ? (
                          <button
                            id="btn-download-tr-from-modal"
                            onClick={() => handleDownloadTermoRecebimento(selectedReportInvoice)}
                            className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-xs active:scale-95"
                          >
                            <FileDown className="w-4 h-4" /> Gerar Termo de Recebimento (PDF)
                          </button>
                        ) : (
                          <span className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold text-xs">
                            TR dispensado para esta classe
                          </span>
                        )}
                        <button
                          id="btn-close-nf-modal-footer"
                          onClick={() => setSelectedReportInvoice(null)}
                          className="px-6 py-2 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95"
                        >
                          Fechar
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </div>
          );
}
