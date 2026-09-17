'use client';

import React, { useRef, useState } from 'react';
import { EmpenhoDocumentActions } from '../../../components/EmpenhoDocumentActions';
import { InvoiceDocumentActions } from '../../../components/InvoiceDocumentActions';
import { TermoRecebimentoActions } from '../../../components/TermoRecebimentoActions';
import { MAX_INVOICE_PDF_BYTES } from '../../../lib/invoiceDocuments';
import { removeComissao } from '../../../lib/firebaseSync';
import { MILITARY_RANKS } from '../../empenhos/domain/empenhoHelpers';
import { AlertTriangle, ArrowUpDown, Calendar, Check, CheckCircle2, Clock, Edit, FileDown, FileText, Loader2, Package, Save, Search, Trash2, Upload, UserCheck, Users, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { Comissao, Empenho, Invoice } from '../../../lib/types';

interface NotasFiscaisViewContext {
  comissaoAux1Nome: any;
  comissaoAux1Posto: any;
  comissaoAux2Nome: any;
  comissaoAux2Posto: any;
  comissaoAux3Nome: any;
  comissaoAux3Posto: any;
  comissaoBoletimDate: any;
  comissaoBoletimNum: any;
  comissaoMes: any;
  comissaoPresNome: any;
  comissaoPresPosto: any;
  comissoes: Comissao[];
  editingInvoice: Invoice | null;
  empenhos: Empenho[];
  formatDateOnly: any;
  formatDateTime: any;
  handleDeleteAllComissoes: (...args: any[]) => any;
  handleDeleteAllInvoices: (...args: any[]) => any;
  handleDeleteInvoice: (...args: any[]) => any;
  handleDownloadTermoRecebimento: (...args: any[]) => any;
  handleTermoRecebimentoAction: (...args: any[]) => any;
  handleDownloadLiquidacaoConsolidada: (...args: any[]) => any;
  handleEditInvoice: (...args: any[]) => any;
  handleEmpenhoDocumentUploaded: (...args: any[]) => any;
  handleInvoiceDocumentUploaded: (...args: any[]) => any;
  handleMarkComissao: (...args: any[]) => any;
  handleMarkTesouraria: (...args: any[]) => any;
  handleUpdateInvoiceLocation: (...args: any[]) => any;
  handleSaveComissao: (...args: any[]) => any;
  handleSaveInvoice: (...args: any[]) => any;
  invoices: Invoice[];
  nfDate: any;
  nfEmpenhoFilter: any;
  nfMonthFilter: any;
  nfNumber: any;
  nfQuantities: Record<string, number>;
  nfSearch: any;
  nfSortOrder: 'recentes' | 'antigas';
  nfSubTab: 'acompanhar' | 'cadastrar' | 'comissao';
  nfTramitacaoFilter: 'Todos' | 'FaltaComissao' | 'FaltaTesouraria' | 'Concluidas';
  selectedNFCommitmentId: any;
  setActiveTab: (...args: any[]) => any;
  setComissaoAux1Nome: (...args: any[]) => any;
  setComissaoAux1Posto: (...args: any[]) => any;
  setComissaoAux2Nome: (...args: any[]) => any;
  setComissaoAux2Posto: (...args: any[]) => any;
  setComissaoAux3Nome: (...args: any[]) => any;
  setComissaoAux3Posto: (...args: any[]) => any;
  setComissaoBoletimDate: (...args: any[]) => any;
  setComissaoBoletimNum: (...args: any[]) => any;
  setComissaoMes: (...args: any[]) => any;
  setComissaoPresNome: (...args: any[]) => any;
  setComissaoPresPosto: (...args: any[]) => any;
  setComissoes: (...args: any[]) => any;
  setEditingEmpenhoId: (...args: any[]) => any;
  setEditingInvoice: (...args: any[]) => any;
  setNfDate: (...args: any[]) => any;
  setNfEmpenhoFilter: (...args: any[]) => any;
  setNfMonthFilter: (...args: any[]) => any;
  setNfNumber: (...args: any[]) => any;
  setNfQuantities: (...args: any[]) => any;
  setNfSearch: (...args: any[]) => any;
  setNfSortOrder: (...args: any[]) => any;
  setNfSubTab: (...args: any[]) => any;
  setNfTramitacaoFilter: (...args: any[]) => any;
  setSelectedNFCommitmentId: (...args: any[]) => any;
  showToast: (...args: any[]) => any;
  uniqueNfMonths: string[];
  user: any;
}

interface NotasFiscaisViewProps {
  context: NotasFiscaisViewContext;
}
/** Tela de Notas Fiscais extraída sem alterar regras de negócio ou persistência. */
export function NotasFiscaisView({ context }: NotasFiscaisViewProps) {
  const { comissaoAux1Nome, comissaoAux1Posto, comissaoAux2Nome, comissaoAux2Posto, comissaoAux3Nome, comissaoAux3Posto, comissaoBoletimDate, comissaoBoletimNum, comissaoMes, comissaoPresNome, comissaoPresPosto, comissoes, editingInvoice, empenhos, formatDateOnly, formatDateTime, handleDeleteAllComissoes, handleDeleteAllInvoices, handleDeleteInvoice, handleDownloadTermoRecebimento, handleTermoRecebimentoAction, handleDownloadLiquidacaoConsolidada, handleEditInvoice, handleEmpenhoDocumentUploaded, handleInvoiceDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleUpdateInvoiceLocation, handleSaveComissao, handleSaveInvoice, invoices, nfDate, nfEmpenhoFilter, nfMonthFilter, nfNumber, nfQuantities, nfSearch, nfSortOrder, nfSubTab, nfTramitacaoFilter, selectedNFCommitmentId, setActiveTab, setComissaoAux1Nome, setComissaoAux1Posto, setComissaoAux2Nome, setComissaoAux2Posto, setComissaoAux3Nome, setComissaoAux3Posto, setComissaoBoletimDate, setComissaoBoletimNum, setComissaoMes, setComissaoPresNome, setComissaoPresPosto, setComissoes, setEditingEmpenhoId, setEditingInvoice, setNfDate, setNfEmpenhoFilter, setNfMonthFilter, setNfNumber, setNfQuantities, setNfSearch, setNfSortOrder, setNfSubTab, setNfTramitacaoFilter, setSelectedNFCommitmentId, showToast, uniqueNfMonths, user } = context;
  const nfPdfInputRef = useRef<HTMLInputElement>(null);
  const [nfPdfFile, setNfPdfFile] = useState<File | null>(null);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [isSavingComissao, setIsSavingComissao] = useState(false);
  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);
  const [consolidatingInvoiceId, setConsolidatingInvoiceId] = useState<string | null>(null);
  const getInvoiceLocation = (invoice: Invoice): NonNullable<Invoice['localizacaoAtual']> =>
    invoice.localizacaoAtual || (invoice.tesourariaDate ? 'TESOURARIA' : invoice.comissaoDate ? 'COMISSAO' : 'APROVISIONAMENTO');

  const runInvoiceTransition = async (invoiceId: string, action: () => Promise<unknown> | unknown) => {
    if (processingInvoiceId !== null) return;
    setProcessingInvoiceId(invoiceId);
    try {
      await action();
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const saveComissaoWithFeedback = async () => {
    if (isSavingComissao) return;
    setIsSavingComissao(true);
    try {
      await handleSaveComissao();
    } finally {
      setIsSavingComissao(false);
    }
  };

  const handleNfPdfSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' || !file.name.toLocaleLowerCase('pt-BR').endsWith('.pdf')) {
      showToast('Selecione um arquivo PDF válido para a Nota Fiscal.', 'error');
      return;
    }
    if (file.size <= 0 || file.size > MAX_INVOICE_PDF_BYTES) {
      showToast('O PDF da Nota Fiscal deve possuir no máximo 10 MB.', 'error');
      return;
    }
    setNfPdfFile(file);
  };

  return (
            <div className="space-y-6">
              
              {/* Screen Header */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Notas Fiscais</h2>
                <p className="text-sm text-gray-500 font-medium font-semibold">Cadastre novas Notas Fiscais ou acompanhe a tramitação das notas já cadastradas</p>
              </div>

              {/* Sub-Tabs Toggle */}
              <div className="flex border-b border-gray-200 gap-6 flex-wrap">
                <button
                  onClick={() => setNfSubTab('acompanhar')}
                  className={`pb-3 font-bold text-sm transition-all relative ${
                    nfSubTab === 'acompanhar' 
                      ? 'text-[#00288e]' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Acompanhar Notas Cadastradas
                  {nfSubTab === 'acompanhar' && (
                    <motion.div layoutId="nfActiveSubTabBorder" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00288e]" />
                  )}
                </button>
                <button
                  onClick={() => { setNfPdfFile(null); setNfSubTab('cadastrar'); }}
                  className={`pb-3 font-bold text-sm transition-all relative ${
                    nfSubTab === 'cadastrar' 
                      ? 'text-[#00288e]' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Cadastrar Nova Nota Fiscal
                  {nfSubTab === 'cadastrar' && (
                    <motion.div layoutId="nfActiveSubTabBorder" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00288e]" />
                  )}
                </button>
                <button
                  onClick={() => setNfSubTab('comissao')}
                  className={`pb-3 font-bold text-sm transition-all relative ${
                    nfSubTab === 'comissao' 
                      ? 'text-[#00288e]' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Comissões de Recebimento
                  {nfSubTab === 'comissao' && (
                    <motion.div layoutId="nfActiveSubTabBorder" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00288e]" />
                  )}
                </button>
              </div>

              {/* Sub-Tab 1: Acompanhar Notas Cadastradas */}
              {nfSubTab === 'acompanhar' && (
                <div className="space-y-4">
                  {/* Search / Filter for Invoices */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    {/* Row 1: Search, Empenho, Mês, Apagar */}
                    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                      <div className="relative flex-1">
                        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar Nota Fiscal por nº, fornecedor ou empenho..."
                          value={nfSearch}
                          onChange={(e) => setNfSearch(e.target.value)}
                          className="w-full pl-12 pr-4 h-11 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition-all font-medium text-sm text-[#0b1c30] placeholder-gray-400 outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                        {/* Empenho Filter */}
                        <div className="flex-1 sm:flex-initial">
                          <select
                            value={nfEmpenhoFilter}
                            onChange={(e) => setNfEmpenhoFilter(e.target.value)}
                            className="w-full sm:w-auto h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-xs sm:text-sm text-[#0b1c30] shadow-sm min-w-[150px]"
                          >
                            <option value="Todos">Todos os Empenhos</option>
                            {Array.from(new Set([...empenhos.map(e => e.id), ...invoices.map(i => i.empenhoId)].filter(Boolean))).map(empId => (
                              <option key={empId} value={empId}>
                                NE {empId}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Month Filter */}
                        <div className="flex-1 sm:flex-initial">
                          <select
                            value={nfMonthFilter}
                            onChange={(e) => setNfMonthFilter(e.target.value)}
                            className="w-full sm:w-auto h-11 px-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-xs sm:text-sm text-[#0b1c30] shadow-sm min-w-[150px]"
                          >
                            <option value="Todos">Todos os Meses</option>
                            {uniqueNfMonths.map(monthStr => {
                              const [year, month] = monthStr.split('-');
                              const monthNames = [
                                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                              ];
                              const monthIdx = parseInt(month, 10) - 1;
                              const label = `${monthNames[monthIdx]} / ${year}`;
                              return (
                                <option key={monthStr} value={monthStr}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {invoices.length > 0 && (
                          <button
                            onClick={handleDeleteAllInvoices}
                            className="h-11 px-3.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm whitespace-nowrap"
                            title="Apagar todas as notas fiscais cadastradas"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden xl:inline">Apagar Todas</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Status Tramitação (Pills) + Ordenação */}
                    <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                      {/* Tramitação Status Pills */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mr-1 hidden sm:inline">Tramitação:</span>
                        
                        <button
                          type="button"
                          onClick={() => setNfTramitacaoFilter('Todos')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            nfTramitacaoFilter === 'Todos'
                              ? 'bg-[#00288e] text-white shadow-sm'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          }`}
                        >
                          <span>Todas</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            nfTramitacaoFilter === 'Todos' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {invoices.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNfTramitacaoFilter('FaltaComissao')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            nfTramitacaoFilter === 'FaltaComissao'
                              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Falta Enviar p/ Comissão</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            nfTramitacaoFilter === 'FaltaComissao' ? 'bg-white/30 text-white' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {invoices.filter(i => getInvoiceLocation(i) === 'APROVISIONAMENTO').length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNfTramitacaoFilter('FaltaTesouraria')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            nfTramitacaoFilter === 'FaltaTesouraria'
                              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/60'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Falta Enviar p/ Tesouraria</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            nfTramitacaoFilter === 'FaltaTesouraria' ? 'bg-white/30 text-white' : 'bg-indigo-200 text-indigo-900'
                          }`}>
                            {invoices.filter(i => getInvoiceLocation(i) === 'COMISSAO').length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNfTramitacaoFilter('Concluidas')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            nfTramitacaoFilter === 'Concluidas'
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Concluídas / Tesouraria</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            nfTramitacaoFilter === 'Concluidas' ? 'bg-white/30 text-white' : 'bg-emerald-200 text-emerald-900'
                          }`}>
                            {invoices.filter(i => getInvoiceLocation(i) === 'TESOURARIA').length}
                          </span>
                        </button>
                      </div>

                      {/* Ordenação Filter */}
                      <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
                          Ordenar:
                        </span>
                        <select
                          value={nfSortOrder}
                          onChange={(e) => setNfSortOrder(e.target.value as 'recentes' | 'antigas')}
                          className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white focus:bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-xs text-[#0b1c30] shadow-xs cursor-pointer"
                        >
                          <option value="recentes">Mais Recentes Primeiro (Mais novas)</option>
                          <option value="antigas">Mais Antigas Primeiro (Mais antigas)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* List of Invoices */}
                  <div className="space-y-4">
                    {(() => {
                      const filteredInvoices = invoices.filter(inv => {
                        const term = nfSearch.toLowerCase();
                        const matchesSearch = (
                          inv.id.toLowerCase().includes(term) ||
                          inv.supplier.toLowerCase().includes(term) ||
                          inv.empenhoId.toLowerCase().includes(term)
                        );

                        const matchesMonth = nfMonthFilter === 'Todos' || 
                          (inv.issueDate && inv.issueDate.startsWith(nfMonthFilter));

                        const matchesEmpenho = nfEmpenhoFilter === 'Todos' || inv.empenhoId === nfEmpenhoFilter;

                        let matchesTramitacao = true;
                        const currentLocation = getInvoiceLocation(inv);
                        if (nfTramitacaoFilter === 'FaltaComissao') {
                          matchesTramitacao = currentLocation === 'APROVISIONAMENTO';
                        } else if (nfTramitacaoFilter === 'FaltaTesouraria') {
                          matchesTramitacao = currentLocation === 'COMISSAO';
                        } else if (nfTramitacaoFilter === 'Concluidas') {
                          matchesTramitacao = currentLocation === 'TESOURARIA';
                        }

                        return matchesSearch && matchesMonth && matchesEmpenho && matchesTramitacao;
                      }).sort((a, b) => {
                        const getTimestamp = (inv: Invoice): number => {
                          const raw = inv.registeredAt || inv.issueDate;
                          if (!raw) return 0;
                          if (raw.includes('/') && raw.split('/').length === 3) {
                            const parts = raw.split('/');
                            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime() || 0;
                          }
                          const t = new Date(raw).getTime();
                          return isNaN(t) ? 0 : t;
                        };

                        const timeA = getTimestamp(a);
                        const timeB = getTimestamp(b);
                        if (timeA !== timeB) {
                          return nfSortOrder === 'recentes' ? timeB - timeA : timeA - timeB;
                        }
                        return nfSortOrder === 'recentes' 
                          ? b.id.localeCompare(a.id, undefined, { numeric: true }) 
                          : a.id.localeCompare(b.id, undefined, { numeric: true });
                      });

                      if (filteredInvoices.length === 0) {
                        return (
                          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
                            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-gray-400">Nenhuma Nota Fiscal encontrada.</p>
                            <button 
                              onClick={() => { setNfPdfFile(null); setNfSubTab('cadastrar'); }}
                              className="mt-3 text-[#00288e] text-xs font-bold hover:underline animate-pulse"
                            >
                              Lançar nova nota fiscal agora
                            </button>
                          </div>
                        );
                      }

                      return filteredInvoices.map((inv) => (
                        <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 hover:border-blue-100 transition-all">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-gray-50">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="bg-blue-50 text-[#00288e] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                  NF-e #{inv.id}
                                </span>
                                {inv.termoNumero && (
                                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Termo Nº {inv.termoNumero} ({formatDateOnly(inv.termoEmissaoDate || inv.registeredAt || inv.issueDate)})
                                  </span>
                                )}
                                <span className="text-gray-400 text-xs font-semibold">
                                  Empenho: <span className="font-bold text-gray-600">{inv.empenhoId}</span>
                                </span>
                              </div>
                              <h4 className="text-base font-bold text-[#0b1c30] mt-1">{inv.supplier}</h4>
                            </div>
                            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                              <div className="text-left sm:text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Valor Total</p>
                                <p className="text-lg font-extrabold text-[#00288e]">
                                  R$ {inv.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 border-l pl-3 border-gray-100">
                                <button
                                  onClick={() => { setNfPdfFile(null); handleEditInvoice(inv); }}
                                  className="p-2 text-[#00288e] hover:bg-blue-50 rounded-xl transition-all active:scale-95 border border-blue-50 hover:border-blue-100"
                                  title="Editar Nota Fiscal"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteInvoice(inv)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-95 border border-rose-50 hover:border-rose-100"
                                  title="Excluir Nota Fiscal"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                            <InvoiceDocumentActions
                              invoice={inv}
                              user={user}
                              onDocumentUploaded={handleInvoiceDocumentUploaded}
                              onNotify={showToast}
                            />
                            <EmpenhoDocumentActions
                              empenho={empenhos.find((emp) => emp.id === inv.empenhoId)}
                              user={user}
                              variant="panel"
                              onDocumentUploaded={handleEmpenhoDocumentUploaded}
                              onNotify={showToast}
                            />
                            <TermoRecebimentoActions
                              invoice={inv}
                              onAction={handleTermoRecebimentoAction}
                            />
                          </div>

                          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 block">Localização atual da Nota Fiscal</span>
                              <p className="text-xs text-gray-500 font-medium mt-0.5">Altere este campo quando a NF retornar da Comissão ou Tesouraria para correção. O histórico de datas permanece preservado.</p>
                            </div>
                            <select
                              value={getInvoiceLocation(inv)}
                              onChange={(event) => runInvoiceTransition(inv.id, () => handleUpdateInvoiceLocation(inv.id, event.target.value))}
                              disabled={processingInvoiceId !== null}
                              aria-busy={processingInvoiceId === inv.id}
                              className="h-10 px-3 rounded-xl border border-sky-200 bg-white text-xs font-extrabold text-sky-900 outline-none focus:ring-1 focus:ring-sky-500 min-w-[220px] disabled:opacity-60 disabled:cursor-wait"
                            >
                              <option value="APROVISIONAMENTO">Aprovisionamento</option>
                              <option value="COMISSAO">Comissão de Recebimento</option>
                              <option value="TESOURARIA">Tesouraria</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                            {/* 1. DATA DE CADASTRAMENTO */}
                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Calendar className="w-5 h-5" />
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 font-bold uppercase block">Cadastramento</span>
                                <span className="text-xs font-bold text-gray-700">
                                  {inv.registeredAt ? formatDateTime(inv.registeredAt) : formatDateTime(inv.issueDate)}
                                </span>
                              </div>
                            </div>

                            {/* 2. COMISSÃO DE RECEBIMENTO */}
                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${inv.comissaoDate ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                  <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Comissão de Recebimento</span>
                                  {inv.comissaoDate ? (
                                    <span className="text-xs font-bold text-emerald-700">
                                      Recebido: {formatDateTime(inv.comissaoDate)}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-amber-600">Aguardando Envio</span>
                                  )}
                                </div>
                              </div>
                              
                              {getInvoiceLocation(inv) === 'APROVISIONAMENTO' && (
                                <button
                                  onClick={() => runInvoiceTransition(inv.id, () => handleMarkComissao(inv.id))}
                                  disabled={processingInvoiceId !== null}
                                  aria-busy={processingInvoiceId === inv.id}
                                  className="mt-1 w-full py-1.5 bg-[#dde1ff] hover:bg-[#00288e] text-[#001453] hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
                                >
                                  {processingInvoiceId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  {processingInvoiceId === inv.id ? 'Enviando…' : 'Enviar p/ Comissão'}
                                </button>
                              )}
                            </div>

                            {/* 3. SETOR DE TESOURARIA */}
                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${inv.tesourariaDate ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                  <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Setor de Tesouraria (Fim)</span>
                                  {inv.tesourariaDate ? (
                                    <span className="text-xs font-bold text-purple-700">
                                      Pago/Finalizado: {formatDateTime(inv.tesourariaDate)}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-gray-400 font-medium">Pendente</span>
                                  )}
                                </div>
                              </div>

                              {getInvoiceLocation(inv) === 'COMISSAO' && (
                                <button
                                  onClick={() => runInvoiceTransition(inv.id, () => handleMarkTesouraria(inv.id))}
                                  disabled={getInvoiceLocation(inv) !== 'COMISSAO' || processingInvoiceId !== null}
                                  aria-busy={processingInvoiceId === inv.id}
                                  className={`mt-1 w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    getInvoiceLocation(inv) === 'COMISSAO'
                                      ? 'bg-[#00288e] hover:bg-[#1e40af] text-white shadow-sm' 
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  }`}
                                  title={getInvoiceLocation(inv) !== 'COMISSAO' ? "A NF precisa estar na Comissão de Recebimento antes do envio à Tesouraria" : ""}
                                >
                                  {processingInvoiceId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  {processingInvoiceId === inv.id ? 'Enviando…' : 'Enviar p/ Tesouraria'}
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Show invoice items inside for full details */}
                          <div className="bg-gray-50/30 rounded-xl p-3 border border-gray-100/50 mt-2">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Itens Conciliados</p>
                            <div className="space-y-1.5">
                              {inv.items.map((it, idx) => {
                                const targetEmp = empenhos.find(e => e.id === inv.empenhoId);
                                const targetItem = targetEmp?.items.find(i => i.id === it.itemId);
                                return (
                                  <div key={idx} className="flex justify-between text-xs text-gray-600 font-semibold">
                                    <span>{targetItem ? targetItem.name : `Item ID: ${it.itemId}`} × {it.quantity}</span>
                                    <span className="font-extrabold text-gray-700">R$ {it.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-[#001453] uppercase tracking-wider">Documento de Liquidação Consolidada</p>
                              <p className="text-xs text-gray-600 font-medium mt-1">Une, nesta ordem, Nota de Empenho + Nota Fiscal (quando houver) + Termo de Recebimento em um único PDF.</p>
                            </div>
                            <button
                              type="button"
                              disabled={consolidatingInvoiceId !== null}
                              onClick={async () => {
                                if (consolidatingInvoiceId) return;
                                setConsolidatingInvoiceId(inv.id);
                                try {
                                  await handleDownloadLiquidacaoConsolidada(inv);
                                } finally {
                                  setConsolidatingInvoiceId(null);
                                }
                              }}
                              className="h-11 px-5 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-wait whitespace-nowrap"
                            >
                              {consolidatingInvoiceId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                              {consolidatingInvoiceId === inv.id ? 'Consolidando PDFs…' : 'Gerar e Baixar Consolidado'}
                            </button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Cadastrar Nova Nota Fiscal */}
              {nfSubTab === 'cadastrar' && (
                <div className="space-y-6">
                  {editingInvoice && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
                      <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-900">Modo de Edição de Nota Fiscal</p>
                          <p className="text-xs font-semibold text-amber-700">Você está alterando os dados da Nota Fiscal nº {editingInvoice.id}.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingInvoice(null);
                          setNfPdfFile(null);
                          setNfNumber('');
                          setNfQuantities({});
                          setNfSubTab('acompanhar');
                          showToast('Edição cancelada.', 'info');
                        }}
                        className="px-4 py-2 bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                      >
                        Cancelar Edição
                      </button>
                    </div>
                  )}

                  {/* Step 1: Select Active Commitment */}
                  <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-[#00288e] uppercase tracking-wider flex items-center gap-1.5">
                      <Search className="w-4 h-4" /> 1. VINCULAR AO EMPENHO ATIVO
                    </h3>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pesquise e selecione a Nota de Empenho vinculada</label>
                      <select 
                        value={selectedNFCommitmentId}
                        onChange={(e) => setSelectedNFCommitmentId(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-bold text-sm text-[#0b1c30] shadow-sm"
                      >
                        {empenhos
                          .filter(emp => emp.status === 'Ativo' || emp.id === selectedNFCommitmentId)
                          .map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.id} - {emp.supplier} ({emp.description})
                            </option>
                          ))}
                      </select>
                    </div>
                  </section>

                  {/* Step 2: Invoice Metadata details */}
                  <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-[#00288e] uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> 2. DADOS DA NOTA FISCAL
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Número da Nota Fiscal (NF-e)</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 102938"
                          value={nfNumber}
                          onChange={(e) => setNfNumber(e.target.value)}
                          className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Data de Emissão da NF</label>
                        <input 
                          type="date" 
                          value={nfDate}
                          onChange={(e) => setNfDate(e.target.value)}
                          className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <input ref={nfPdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleNfPdfSelection} />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5"><FileText className="w-4 h-4" /> Documento — Nota Fiscal</p>
                          {nfPdfFile ? (
                            <p className="text-xs font-semibold text-gray-700 truncate mt-1">{nfPdfFile.name} • {(nfPdfFile.size / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB</p>
                          ) : editingInvoice?.notaFiscalPdf ? (
                            <p className="text-xs font-semibold text-gray-600 truncate mt-1">Atual: {editingInvoice.notaFiscalPdf.originalName}. Selecione outro PDF somente para substituir.</p>
                          ) : (
                            <p className="text-xs text-gray-500 font-medium mt-1">Opcional. Anexe o PDF digitalizado da NF; o arquivo ficará em armazenamento privado.</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {nfPdfFile && (
                            <button type="button" onClick={() => setNfPdfFile(null)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-100 bg-white text-rose-600 hover:bg-rose-50 text-xs font-bold">
                              <X className="w-3.5 h-3.5" /> Remover
                            </button>
                          )}
                          <button type="button" onClick={() => nfPdfInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold">
                            <Upload className="w-3.5 h-3.5" /> {nfPdfFile || editingInvoice?.notaFiscalPdf ? 'Selecionar outro PDF' : 'Anexar PDF'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Step 3: Items reconciliation table */}
                  <section className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider">
                        ITENS DO EMPENHO #{selectedNFCommitmentId}
                      </h3>
                      <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold text-xs">Pendente</span>
                    </div>

                    {/* Grid checklist of items */}
                    {(() => {
                      const targetEmpenho = empenhos.find(e => e.id === selectedNFCommitmentId);
                      if (!targetEmpenho || targetEmpenho.items.length === 0) {
                        return (
                          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
                            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-gray-400">Nenhum item cadastrado neste empenho.</p>
                            <button 
                              onClick={() => { setEditingEmpenhoId(selectedNFCommitmentId); setActiveTab('itens_empenho'); }}
                              className="mt-3 text-[#00288e] text-xs font-bold hover:underline"
                            >
                              Ir cadastrar itens no empenho
                            </button>
                          </div>
                        );
                      }

                      let grandTotal = 0;

                      return (
                        <div className="space-y-4 pb-32">
                          {targetEmpenho.items.map((item) => {
                            const oldItemQty = editingInvoice 
                              ? (editingInvoice.items.find(it => it.itemId === item.id)?.quantity || 0)
                              : 0;
                            const balance = item.quantity - item.received + oldItemQty;
                            const inputVal = nfQuantities[item.id] || 0;
                            const subtotal = inputVal * item.unitPrice;
                            grandTotal += subtotal;

                            return (
                              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-4 transition-all hover:border-blue-100">
                                <div className="flex justify-between items-start gap-4">
                                  <span className="font-bold text-sm text-gray-800 leading-tight line-clamp-2">{item.name}</span>
                                  <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">ID: {item.id}</span>
                                </div>

                                <div className="flex items-center gap-6 flex-wrap sm:flex-nowrap">
                                  <div className="flex flex-col min-w-[100px]">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Saldo do Empenho</span>
                                    <span className="text-lg font-extrabold text-[#0058be]">
                                      {balance.toLocaleString('pt-BR')} <span className="text-xs font-semibold text-gray-400">{item.unit}</span>
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-[150px]">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Qtd nesta NF</label>
                                    <input 
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={nfQuantities[item.id] === undefined || nfQuantities[item.id] === 0 ? '' : nfQuantities[item.id]}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                                        setNfQuantities({
                                          ...nfQuantities,
                                          [item.id]: val,
                                        });
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                          e.preventDefault();
                                        }
                                      }}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className={`w-full h-11 text-center font-bold text-lg rounded-xl focus:ring-2 outline-none transition-all ${
                                        inputVal > balance
                                          ? 'bg-rose-50 text-rose-700 border-rose-300 focus:ring-rose-200 focus:border-rose-500 border'
                                          : inputVal > 0 
                                            ? 'bg-[#dde1ff] text-[#001453] border-transparent focus:ring-[#00288e]' 
                                            : 'bg-gray-50 text-gray-700 border border-gray-100 focus:ring-blue-200'
                                      }`}
                                    />
                                    {inputVal > balance && (
                                      <p className="text-[10px] text-rose-600 font-bold mt-1 text-center animate-pulse">
                                        Excede o saldo disponível ({balance})
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs">
                                  <span className="text-gray-400 font-medium">Vlr. Unit: R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  <div className="text-right">
                                    <span className="text-[10px] text-gray-400 font-bold block">Subtotal</span>
                                    <span className="font-bold text-sm text-[#00288e]">
                                      R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Floating bottom footer specifically for the NF totals */}
                          <footer className="fixed bottom-0 left-0 lg:left-72 right-0 bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] p-4 z-40">
                            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Total da NF</span>
                                <span className="text-xl sm:text-2xl font-extrabold text-[#00288e]">
                                  R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <button 
                                onClick={async () => {
                                  if (isSavingInvoice) return;
                                  setIsSavingInvoice(true);
                                  try {
                                    const saved = await handleSaveInvoice(nfPdfFile);
                                    if (saved) setNfPdfFile(null);
                                  } finally {
                                    setIsSavingInvoice(false);
                                  }
                                }}
                                disabled={isSavingInvoice}
                                aria-busy={isSavingInvoice}
                                className="h-12 px-6 sm:px-8 bg-[#00288e] text-white rounded-full font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all duration-100 hover:bg-[#1e40af] flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                              >
                                {isSavingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isSavingInvoice ? 'Salvando e enviando PDF…' : 'Salvar Recebimento'}
                              </button>
                            </div>
                          </footer>

                        </div>
                      );
                    })()}
                  </section>
                </div>
              )}

              {/* Sub-Tab 3: Comissões de Recebimento */}
              {nfSubTab === 'comissao' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-24">
                  {/* Left Column: Register New Committee */}
                  <div className="xl:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#00288e]" /> Cadastrar Comissão de Recebimento
                      </h3>
                      <p className="text-xs text-gray-500 font-medium font-semibold">As comissões são nomeadas mensalmente por Boletim do HGeSM</p>
                    </div>

                    <div className="space-y-4">
                      {/* Month of reference */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mês da Comissão</label>
                        <input 
                          type="month"
                          value={comissaoMes}
                          onChange={(e) => setComissaoMes(e.target.value)}
                          className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                        />
                      </div>

                      {/* Bulletin details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Boletim Interno nº</label>
                          <input 
                            type="text"
                            placeholder="Ex: 145"
                            value={comissaoBoletimNum}
                            onChange={(e) => setComissaoBoletimNum(e.target.value)}
                            className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data do Boletim</label>
                          <input 
                            type="date"
                            value={comissaoBoletimDate}
                            onChange={(e) => setComissaoBoletimDate(e.target.value)}
                            className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#00288e] outline-none font-semibold text-sm text-[#0b1c30] transition-colors shadow-inner"
                          />
                        </div>
                      </div>

                      {/* President */}
                      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-100/30">
                          <UserCheck className="w-4 h-4 text-[#00288e]" />
                          <span className="text-xs font-extrabold text-[#00288e] uppercase tracking-wider">Presidente da Comissão</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Posto/Grad.</label>
                            <select
                              value={comissaoPresPosto}
                              onChange={(e) => setComissaoPresPosto(e.target.value)}
                              className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-white focus:border-[#00288e] outline-none font-bold text-xs text-[#0b1c30]"
                            >
                              {MILITARY_RANKS.map(rank => (
                                <option key={rank} value={rank}>{rank}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nome Completo</label>
                            <input 
                              type="text"
                              placeholder="Ex: Carlos Eduardo Souza Silva"
                              value={comissaoPresNome}
                              onChange={(e) => setComissaoPresNome(e.target.value)}
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:border-[#00288e] outline-none font-semibold text-xs text-[#0b1c30] shadow-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Auxiliaries */}
                      <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-100 space-y-4">
                        <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider block border-b border-gray-200/50 pb-2">
                          Membros Auxiliares (Três Auxiliares)
                        </span>

                        {/* Auxiliary 1 */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">1º Auxiliar</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                              <select
                                value={comissaoAux1Posto}
                                onChange={(e) => setComissaoAux1Posto(e.target.value)}
                                className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-white focus:border-[#00288e] outline-none font-bold text-xs text-[#0b1c30]"
                              >
                                {MILITARY_RANKS.map(rank => (
                                  <option key={rank} value={rank}>{rank}</option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <input 
                                type="text"
                                placeholder="Nome completo do 1º auxiliar"
                                value={comissaoAux1Nome}
                                onChange={(e) => setComissaoAux1Nome(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:border-[#00288e] outline-none font-semibold text-xs text-[#0b1c30] shadow-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Auxiliary 2 */}
                        <div className="space-y-1 pt-2 border-t border-gray-200/30">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">2º Auxiliar</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                              <select
                                value={comissaoAux2Posto}
                                onChange={(e) => setComissaoAux2Posto(e.target.value)}
                                className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-white focus:border-[#00288e] outline-none font-bold text-xs text-[#0b1c30]"
                              >
                                {MILITARY_RANKS.map(rank => (
                                  <option key={rank} value={rank}>{rank}</option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <input 
                                type="text"
                                placeholder="Nome completo do 2º auxiliar"
                                value={comissaoAux2Nome}
                                onChange={(e) => setComissaoAux2Nome(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:border-[#00288e] outline-none font-semibold text-xs text-[#0b1c30] shadow-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Auxiliary 3 */}
                        <div className="space-y-1 pt-2 border-t border-gray-200/30">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">3º Auxiliar</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                              <select
                                value={comissaoAux3Posto}
                                onChange={(e) => setComissaoAux3Posto(e.target.value)}
                                className="w-full h-10 px-2 rounded-lg border border-gray-200 bg-white focus:border-[#00288e] outline-none font-bold text-xs text-[#0b1c30]"
                              >
                                {MILITARY_RANKS.map(rank => (
                                  <option key={rank} value={rank}>{rank}</option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <input 
                                type="text"
                                placeholder="Nome completo do 3º auxiliar"
                                value={comissaoAux3Nome}
                                onChange={(e) => setComissaoAux3Nome(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg focus:border-[#00288e] outline-none font-semibold text-xs text-[#0b1c30] shadow-sm"
                              />
                            </div>
                          </div>
                        </div>

                      </div>

                      <button
                        onClick={saveComissaoWithFeedback}
                        disabled={isSavingComissao}
                        aria-busy={isSavingComissao}
                        className="w-full h-11 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                      >
                        {isSavingComissao ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSavingComissao ? 'Salvando Comissão…' : 'Salvar Comissão de Recebimento'}
                      </button>

                    </div>
                  </div>

                  {/* Right Column: List Existing Committees */}
                  <div className="xl:col-span-6 space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <div>
                        <h3 className="text-lg font-bold text-[#0b1c30] tracking-tight">Comissões Nomeadas</h3>
                        <p className="text-xs text-gray-500 font-medium">Histórico mensal de comissões ativas no HGeSM</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {comissoes.length > 0 && (
                          <button
                            onClick={handleDeleteAllComissoes}
                            className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] flex items-center gap-1.5 active:scale-95 transition-all shadow-sm cursor-pointer"
                            title="Apagar todas as comissões cadastradas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Apagar Todas
                          </button>
                        )}
                        <span className="bg-blue-50 text-[#00288e] text-xs font-bold px-3 py-1 rounded-full border border-blue-100">
                          {comissoes.length} {comissoes.length === 1 ? 'comissão' : 'comissões'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 overflow-y-auto max-h-[700px] pr-1">
                      {comissoes.length === 0 ? (
                        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
                          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-gray-400">Nenhuma comissão cadastrada.</p>
                        </div>
                      ) : (
                        comissoes.map((com) => {
                          const [year, month] = com.mesReferencia.split('-');
                          const monthNames = [
                            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                          ];
                          const monthName = monthNames[parseInt(month, 10) - 1] || com.mesReferencia;

                          return (
                            <div key={com.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 hover:border-blue-100 transition-all relative group">
                              <div className="flex justify-between items-start gap-4">
                                <div>
                                  <h4 className="text-base font-extrabold text-[#00288e]">
                                    {monthName} de {year}
                                  </h4>
                                  <p className="text-xs text-gray-400 font-semibold mt-0.5">
                                    Mês de Referência: <span className="font-bold text-gray-600">{com.mesReferencia}</span>
                                  </p>
                                </div>
                                <button
                                  onClick={async () => {
                                    if (confirm('Tem certeza que deseja excluir esta comissão?')) {
                                      if (user) {
                                        try {
                                          await removeComissao(user.uid, com.id);
                                        } catch (error) {
                                          showToast('Erro ao remover no Firebase. A comissão foi mantida.', 'error');
                                          return;
                                        }
                                      }
                                      const updated = comissoes.filter(c => c.id !== com.id);
                                      setComissoes(updated);
                                      showToast('Comissão excluída com sucesso!', 'info');
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200"
                                  title="Excluir Comissão"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-1">
                                <p className="font-bold text-[#0b1c30]">Nomeação por Boletim Interno</p>
                                <p className="font-medium text-gray-500">
                                  Boletim Interno nº <span className="font-bold text-gray-700">{com.boletimNumero}</span> do HGeSM de <span className="font-bold text-gray-700">
                                    {(() => {
                                      try {
                                        const [y, m, d] = com.boletimData.split('-');
                                        return `${d}/${m}/${y}`;
                                      } catch {
                                        return com.boletimData;
                                      }
                                    })()}
                                  </span>
                                </p>
                              </div>

                              <div className="space-y-2">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Membros Constituintes</div>
                                
                                {/* President item */}
                                <div className="flex items-center gap-3 bg-blue-50/40 p-2.5 rounded-lg border border-blue-50/80 text-xs">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 text-[#00288e] flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                    P
                                  </div>
                                  <div>
                                    <span className="font-bold text-gray-400 block text-[9px] uppercase tracking-wider">Presidente</span>
                                    <span className="font-extrabold text-[#00288e]">{com.presidente.postoGraduacao}</span> {com.presidente.nomeCompleto}
                                  </div>
                                </div>

                                {/* Auxiliaries list */}
                                <div className="grid grid-cols-1 gap-2">
                                  {com.auxiliares.map((aux, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-gray-50/40 p-2.5 rounded-lg border border-gray-100 text-xs">
                                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                        A{idx + 1}
                                      </div>
                                      <div>
                                        <span className="font-bold text-gray-400 block text-[9px] uppercase tracking-wider">{idx + 1}º Auxiliar</span>
                                        <span className="font-extrabold text-gray-700">{aux.postoGraduacao}</span> {aux.nomeCompleto}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
}
