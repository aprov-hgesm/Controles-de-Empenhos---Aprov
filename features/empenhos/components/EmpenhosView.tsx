'use client';

import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, Braces, Calendar, CalendarDays, Check, CheckCircle2, ChevronRight, Copy, Edit, Eye, FileDown, FileText, Package, Plus, Printer, Save, Search, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { EmpenhoDocumentActions } from '../../../components/EmpenhoDocumentActions';
import type { Empenho, Invoice, EmpenhoPdfDocument } from '../../../lib/types';
import type { User } from 'firebase/auth';
type Setter<T = any> = Dispatch<SetStateAction<T>>;

type NewEmpenhoForm = {
  id: string;
  supplier: string;
  description: string;
  pregao: string;
  date: string;
  classification: 'QR' | 'CALI' | 'PASA';
};

type NewItemForm = { id: string; name: string; unit: string; quantity: string; unitPrice: string };

interface EmpenhosViewContext {
  copiedPrompt: boolean;
  empenhos: Empenho[];
  empenhosClassFilter: string;
  empenhosFilter: 'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados';
  empenhosPregaoFilter: string;
  empenhosSearch: string;
  empenhosYearFilter: string;
  formatDateOnly: (dateStr?: string) => string;
  handleAddItemToEmpenho: (...args: any[]) => any;
  handleCopyPrompt: (...args: any[]) => any;
  handleCreateEmpenho: (...args: any[]) => any;
  handleDeleteItemFromEmpenho: (...args: any[]) => any;
  handleDownloadPromptPdf: (...args: any[]) => any;
  handleDownloadPromptTxt: (...args: any[]) => any;
  handleDownloadTermoRecebimento: (...args: any[]) => any;
  handleEmpenhoDocumentUploaded: (empenhoId: string, document: EmpenhoPdfDocument) => Promise<void>;
  handleUpdateEmpenhoPregao: (empenhoId: string, pregao: string) => Promise<void>;
  handleGenerateEmpenhoReportPDF: (...args: any[]) => any;
  handleProcessJson: (...args: any[]) => any;
  handleSaveReviewEmpenho: (...args: any[]) => any;
  handleSelectEmpenhoForCronograma: (...args: any[]) => any;
  invoices: Invoice[];
  jsonError: string | null;
  jsonInput: string;
  newEmpenhoForm: NewEmpenhoForm;
  newEmpenhoMode: 'manual' | 'json';
  newItemForm: NewItemForm;
  reviewEmpenho: any;
  selectedEmpenhoDetailId: string | null;
  setActiveTab: Setter<any>;
  setEditingEmpenhoId: Setter<string>;
  setEditingInvoice: Setter<Invoice | null>;
  setEmpenhosClassFilter: Setter<string>;
  setEmpenhosFilter: Setter<'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados'>;
  setEmpenhosPregaoFilter: Setter<string>;
  setEmpenhosSearch: Setter<string>;
  setEmpenhosYearFilter: Setter<string>;
  setEmpenhoToDelete: Setter<string | null>;
  setJsonError: Setter<string | null>;
  setJsonInput: Setter<string>;
  setNewEmpenhoForm: Setter<NewEmpenhoForm>;
  setNewEmpenhoMode: Setter<'manual' | 'json'>;
  setNewItemForm: Setter<NewItemForm>;
  setNfSubTab: Setter<any>;
  setReviewEmpenho: Setter<any>;
  setSelectedEmpenhoDetailId: Setter<string | null>;
  setSelectedNFCommitmentId: Setter<string>;
  setSelectedReportInvoice: Setter<Invoice | null>;
  setShowAddItemFormInDetail: Setter<boolean>;
  setShowConfirmSaveModal: Setter<boolean>;
  setShowNewEmpenhoModal: Setter<boolean>;
  showAddItemFormInDetail: boolean;
  showConfirmSaveModal: boolean;
  showNewEmpenhoModal: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  uniqueEmpenhoYears: string[];
  uniquePregaos: string[];
  user: User | null;
}

interface EmpenhosViewProps { context: EmpenhosViewContext; }

/** Tela de cadastro e detalhe de empenhos extraída sem alterar comportamento. */
export function EmpenhosView({ context }: EmpenhosViewProps) {
  const { copiedPrompt, empenhos, empenhosClassFilter, empenhosFilter, empenhosPregaoFilter, empenhosSearch, empenhosYearFilter, formatDateOnly, handleAddItemToEmpenho, handleCopyPrompt, handleCreateEmpenho, handleDeleteItemFromEmpenho, handleDownloadPromptPdf, handleDownloadPromptTxt, handleDownloadTermoRecebimento, handleEmpenhoDocumentUploaded, handleUpdateEmpenhoPregao, handleGenerateEmpenhoReportPDF, handleProcessJson, handleSaveReviewEmpenho, handleSelectEmpenhoForCronograma, invoices, jsonError, jsonInput, newEmpenhoForm, newEmpenhoMode, newItemForm, reviewEmpenho, selectedEmpenhoDetailId, setActiveTab, setEditingEmpenhoId, setEditingInvoice, setEmpenhosClassFilter, setEmpenhosFilter, setEmpenhosPregaoFilter, setEmpenhosSearch, setEmpenhosYearFilter, setEmpenhoToDelete, setJsonError, setJsonInput, setNewEmpenhoForm, setNewEmpenhoMode, setNewItemForm, setNfSubTab, setReviewEmpenho, setSelectedEmpenhoDetailId, setSelectedNFCommitmentId, setSelectedReportInvoice, setShowAddItemFormInDetail, setShowConfirmSaveModal, setShowNewEmpenhoModal, showAddItemFormInDetail, showConfirmSaveModal, showNewEmpenhoModal, showToast, uniqueEmpenhoYears, uniquePregaos, user } = context;
  const [editingPregaoEmpenhoId, setEditingPregaoEmpenhoId] = React.useState<string | null>(null);
  const [pregaoDraft, setPregaoDraft] = React.useState('');
  const [savingPregao, setSavingPregao] = React.useState(false);

  return (
            <div className="space-y-6">
              
              {!selectedEmpenhoDetailId ? (
                <>
                  {/* Screen Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Cadastro de Empenhos</h2>
                      <p className="text-sm text-gray-500 font-medium">Controle de faturamento, saldos orçamentários e contratos</p>
                    </div>
                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <button 
                        onClick={() => setShowNewEmpenhoModal(true)}
                        className="px-5 h-12 bg-[#00288e] text-white font-bold text-sm rounded-xl hover:bg-[#1e40af] transition-all shadow-md active:scale-95 duration-150 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-5 h-5" /> Novo Empenho
                      </button>
                    </div>
                  </div>

                  {/* Filtering & Search Row */}
                  <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
                    <div className="relative flex-1">
                      <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Filtrar por número ou fornecedor..."
                        value={empenhosSearch}
                        onChange={(e) => setEmpenhosSearch(e.target.value)}
                        className="w-full pl-12 pr-4 h-12 rounded-xl border border-white/30 bg-white/40 backdrop-blur-sm focus:bg-white/60 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition-all font-medium text-sm text-[#0b1c30] placeholder-gray-400 outline-none"
                      />
                    </div>

                    {/* Pregão Filter Select Dropdown */}
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Pregão:</span>
                      <select
                        value={empenhosPregaoFilter}
                        onChange={(e) => setEmpenhosPregaoFilter(e.target.value)}
                        className="w-full h-12 px-3 border border-white/30 rounded-xl bg-white/40 backdrop-blur-sm text-xs font-bold text-gray-700 outline-none focus:bg-white/60 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                      >
                        <option value="Todos">Todos os Pregões</option>
                        {uniquePregaos.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Ano Filter Select Dropdown */}
                    <div className="flex items-center gap-2 min-w-[150px]">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ano:</span>
                      <select
                        value={empenhosYearFilter}
                        onChange={(e) => setEmpenhosYearFilter(e.target.value)}
                        className="w-full h-12 px-3 border border-white/30 rounded-xl bg-white/40 backdrop-blur-sm text-xs font-bold text-gray-700 outline-none focus:bg-white/60 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                      >
                        <option value="Todos">Todos os Anos</option>
                        {uniqueEmpenhoYears.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    {/* Classe Filter Select Dropdown */}
                    <div className="flex items-center gap-2 min-w-[150px]">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Classe:</span>
                      <select
                        value={empenhosClassFilter}
                        onChange={(e) => setEmpenhosClassFilter(e.target.value)}
                        className="w-full h-12 px-3 border border-white/30 rounded-xl bg-white/40 backdrop-blur-sm text-xs font-bold text-gray-700 outline-none focus:bg-white/60 focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                      >
                        <option value="Todos">Todas as Classes</option>
                        <option value="QR">QR</option>
                        <option value="CALI">CALI</option>
                        <option value="PASA">PASA</option>
                      </select>
                    </div>
                    
                    {/* Filter chip buttons wrapper */}
                    <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                      {(['Todos', 'Com Saldo', 'Ativos', 'Encerrados'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setEmpenhosFilter(filter)}
                          className={`px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all backdrop-blur-sm cursor-pointer ${
                            empenhosFilter === filter 
                              ? 'bg-[#00288e] text-white shadow-sm' 
                              : 'bg-white/40 text-gray-600 hover:bg-white/60 border border-white/20'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid of Commitments with Cronogramas-style visual cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {empenhos
                      .filter(emp => {
                        const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                        const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                        const saldo = Math.max(0, totalCommitted - totalReceived);

                        const matchesSearch = emp.id.toLowerCase().includes(empenhosSearch.toLowerCase()) || 
                                              emp.supplier.toLowerCase().includes(empenhosSearch.toLowerCase()) ||
                                              emp.description.toLowerCase().includes(empenhosSearch.toLowerCase());
                        
                        let matchesFilter = true;
                        if (empenhosFilter === 'Com Saldo') {
                          matchesFilter = saldo > 0;
                        } else if (empenhosFilter === 'Ativos') {
                          matchesFilter = emp.status === 'Ativo';
                        } else if (empenhosFilter === 'Encerrados') {
                          matchesFilter = emp.status === 'Encerrado' || (totalCommitted > 0 && saldo <= 0);
                        }

                        const matchesPregao = empenhosPregaoFilter === 'Todos' || emp.pregao === empenhosPregaoFilter;
                        
                        let empYear = '';
                        if (emp.date) {
                          const parts = emp.date.split('/');
                          if (parts.length === 3) {
                            empYear = parts[2];
                          } else if (emp.date.includes('-')) {
                            empYear = emp.date.split('-')[0];
                          }
                        }
                        const matchesYear = empenhosYearFilter === 'Todos' || empYear === empenhosYearFilter;
                        const matchesClass = empenhosClassFilter === 'Todos' || emp.classification === empenhosClassFilter;

                        return matchesSearch && matchesFilter && matchesPregao && matchesYear && matchesClass;
                      })
                      .map((emp) => {
                        const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                        const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                        const saldoDisponivel = Math.max(0, totalCommitted - totalReceived);
                        const progressPercentage = totalCommitted > 0 ? Math.min(100, Math.round((totalReceived / totalCommitted) * 100)) : 0;
                        const itemsComSaldo = emp.items.filter(i => (i.quantity - i.received) > 0).length;
                        const empInvoices = invoices.filter(inv => inv.empenhoId === emp.id);

                        return (
                          <div 
                            key={emp.id}
                            onClick={() => { 
                              setSelectedEmpenhoDetailId(emp.id); 
                              setEditingEmpenhoId(emp.id); 
                            }}
                            className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-sm hover:shadow-lg transition-all cursor-pointer group hover:border-[#00288e]/30 hover:bg-white/90 flex flex-col justify-between"
                          >
                            <div>
                              {/* Card Header */}
                              <div className="flex justify-between items-start mb-2.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2.5 py-1 bg-[#00288e]/10 text-[#00288e] font-extrabold text-xs rounded-lg tracking-wider">
                                    NE {emp.id}
                                  </span>
                                  {emp.classification && (
                                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider ${
                                      emp.classification === 'QR' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' :
                                      emp.classification === 'CALI' ? 'bg-purple-50 text-purple-700 border border-purple-200/60' :
                                      'bg-teal-50 text-teal-700 border border-teal-200/60'
                                    }`}>
                                      {emp.classification}
                                    </span>
                                  )}
                                  {emp.pregao && (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-semibold">
                                      Pregão: {emp.pregao}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                                    emp.status === 'Ativo' ? 'bg-blue-50 text-[#00288e]' :
                                    emp.status === 'Encerrado' ? 'bg-gray-100 text-gray-500' :
                                    'bg-amber-50 text-amber-800'
                                  }`}>
                                    {emp.status}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEmpenhoToDelete(emp.id);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                                    title={`Excluir empenho ${emp.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Supplier & Description */}
                              <h4 className="font-extrabold text-sm text-[#0b1c30] mt-2 line-clamp-1 group-hover:text-[#00288e] transition-colors">
                                {emp.supplier}
                              </h4>
                              <p className="text-xs text-gray-500 font-medium line-clamp-2 mt-0.5 leading-relaxed">
                                {emp.description}
                              </p>

                              {/* Date Row */}
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mt-3 mb-3">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                <span>Emitido em {formatDateOnly(emp.date)}</span>
                              </div>

                              {/* Progress bar */}
                              <div className="space-y-1 mb-4 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-gray-500">Execução:</span>
                                  <span className={progressPercentage === 100 ? 'text-emerald-700' : 'text-[#00288e]'}>
                                    {progressPercentage}% entregue
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 rounded-full ${
                                      progressPercentage === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'
                                    }`}
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                              </div>

                              {/* 3 Macro Financial Values (similar to Cronogramas) */}
                              <div className="grid grid-cols-3 gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100/80 mb-3 text-center">
                                <div className="text-left">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Empenhado</span>
                                  <span className="font-black text-xs text-[#0b1c30] block mt-0.5">
                                    R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="text-center">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Recebido</span>
                                  <span className="font-black text-xs text-emerald-600 block mt-0.5">
                                    R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Saldo Disp.</span>
                                  <span className={`font-black text-xs block mt-0.5 ${saldoDisponivel > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                    R$ {saldoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Footer Info & Quick Action Button */}
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-gray-400">
                                {emp.items.length} {emp.items.length === 1 ? 'item' : 'itens'} • {empInvoices.length} {empInvoices.length === 1 ? 'NF' : 'NFs'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmpenhoDetailId(emp.id);
                                  setEditingEmpenhoId(emp.id);
                                }}
                                className="flex items-center gap-1 text-xs font-bold text-[#00288e] hover:text-[#1e40af] group-hover:underline cursor-pointer"
                              >
                                <span>Ver Detalhes</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {/* Empty State visual card */}
                    <div 
                      onClick={() => setShowNewEmpenhoModal(true)}
                      className="bg-[#eff4ff]/20 rounded-2xl border-2 border-dashed border-blue-200/50 flex flex-col items-center justify-center p-6 text-center hover:bg-[#e5eeff]/30 transition-all cursor-pointer min-h-[220px]"
                    >
                      <div className="w-12 h-12 bg-blue-50 text-[#00288e] rounded-full flex items-center justify-center mb-3 shadow-inner">
                        <Plus className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-[#00288e] text-sm">Criar Novo Empenho</h4>
                      <p className="text-xs text-gray-500 font-semibold mt-1 max-w-[200px]">Cadastre novas contratações orçamentárias do hospital</p>
                    </div>
                  </div>
                </>
              ) : (
                /* DETAIL VIEW FOR THE SELECTED EMPENHO */
                (() => {
                  const targetEmp = empenhos.find(e => e.id === selectedEmpenhoDetailId);
                  if (!targetEmp) {
                    return (
                      <div className="p-12 text-center bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="font-bold text-gray-700">Empenho não encontrado.</p>
                        <button
                          onClick={() => setSelectedEmpenhoDetailId(null)}
                          className="mt-4 px-4 py-2 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#1e40af] transition-all cursor-pointer"
                        >
                          Voltar para Todos os Empenhos
                        </button>
                      </div>
                    );
                  }

                  const totalCommitted = targetEmp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                  const totalReceived = targetEmp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                  const saldoDisponivel = Math.max(0, totalCommitted - totalReceived);
                  const percentExecuted = totalCommitted > 0 ? Math.min(100, Math.round((totalReceived / totalCommitted) * 100)) : 0;
                  const itemsComSaldo = targetEmp.items.filter(i => (i.quantity - i.received) > 0).length;
                  const targetInvoices = invoices.filter(inv => inv.empenhoId === targetEmp.id);
                  const totalInvoicesValue = targetInvoices.reduce((sum, inv) => sum + inv.totalValue, 0);

                  return (
                    <div className="space-y-6 animate-fadeIn">
                      {/* Top Return Button */}
                      <button
                        onClick={() => setSelectedEmpenhoDetailId(null)}
                        className="flex items-center gap-2 text-xs font-bold text-[#00288e] hover:text-[#1e40af] bg-white/70 hover:bg-white px-3.5 py-2 rounded-xl border border-white/40 shadow-xs transition-all cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Voltar para Lista de Empenhos</span>
                      </button>

                      {/* Header Card */}
                      <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white/40 shadow-md">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-3 py-1 bg-[#00288e] text-white font-black text-sm rounded-xl tracking-wider shadow-xs">
                                NE {targetEmp.id}
                              </span>
                              {targetEmp.classification && (
                                <span className={`px-2.5 py-1 text-xs font-extrabold rounded-lg uppercase tracking-wider ${
                                  targetEmp.classification === 'QR' ? 'bg-indigo-100 text-indigo-800' :
                                  targetEmp.classification === 'CALI' ? 'bg-purple-100 text-purple-800' :
                                  'bg-teal-100 text-teal-800'
                                }`}>
                                  Classe: {targetEmp.classification}
                                </span>
                              )}
                              <span className={`px-2.5 py-1 text-xs font-extrabold rounded-lg ${
                                targetEmp.status === 'Ativo' ? 'bg-blue-100 text-[#00288e]' :
                                targetEmp.status === 'Encerrado' ? 'bg-gray-100 text-gray-600' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {targetEmp.status}
                              </span>
                              {targetEmp.pregao && (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded-lg text-xs font-bold">
                                  Pregão: {targetEmp.pregao}
                                </span>
                              )}
                              <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                Emitido em: {formatDateOnly(targetEmp.date)}
                              </span>
                            </div>

                            <h3 className="text-xl sm:text-2xl font-black text-[#0b1c30] mt-3">
                              {targetEmp.supplier}
                            </h3>
                            <p className="text-sm text-gray-600 font-medium mt-1 leading-relaxed">
                              {targetEmp.description}
                            </p>

                            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 max-w-xl">
                              {editingPregaoEmpenhoId === targetEmp.id ? (
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                  <div className="flex-1">
                                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 block mb-1">Pregão relacionado à Nota de Empenho</label>
                                    <input
                                      value={pregaoDraft}
                                      onChange={(event) => setPregaoDraft(event.target.value)}
                                      placeholder="Ex.: 90013/2025"
                                      className="w-full h-9 px-3 rounded-lg border border-emerald-200 bg-white text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div className="flex gap-2 sm:pt-4">
                                    <button
                                      type="button"
                                      disabled={savingPregao}
                                      onClick={async () => {
                                        if (savingPregao) return;
                                        setSavingPregao(true);
                                        try {
                                          await handleUpdateEmpenhoPregao(targetEmp.id, pregaoDraft);
                                          setEditingPregaoEmpenhoId(null);
                                        } finally {
                                          setSavingPregao(false);
                                        }
                                      }}
                                      className="h-9 px-3 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-60"
                                    >
                                      Salvar Pregão
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPregaoEmpenhoId(null)}
                                      className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-bold hover:bg-gray-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 block">Pregão relacionado</span>
                                    <span className="text-xs font-bold text-gray-800">{targetEmp.pregao || 'Sem Pregão'}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPregaoDraft(targetEmp.pregao === 'Sem Pregão' ? '' : (targetEmp.pregao || ''));
                                      setEditingPregaoEmpenhoId(targetEmp.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 bg-white text-emerald-800 text-xs font-bold hover:bg-emerald-100"
                                  >
                                    <Edit className="w-3.5 h-3.5" /> Alterar Pregão
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Action Buttons on Detail Header */}
                          <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
                            <button
                              onClick={() => {
                                setSelectedNFCommitmentId(targetEmp.id);
                                setActiveTab('nova_nf');
                                setNfSubTab('cadastrar');
                              }}
                              className="px-4 py-2.5 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#1e40af] transition-all shadow-sm active:scale-95 duration-150 flex items-center gap-2 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Lançar NF</span>
                            </button>

                            <button
                              onClick={() => {
                                handleSelectEmpenhoForCronograma(targetEmp.id);
                                setActiveTab('cronogramas');
                              }}
                              className="px-4 py-2.5 bg-blue-50 text-[#00288e] hover:bg-blue-100 border border-blue-200/60 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                            >
                              <CalendarDays className="w-4 h-4" />
                              <span>Cronograma</span>
                            </button>

                            <button
                              onClick={() => handleGenerateEmpenhoReportPDF(targetEmp, 'print')}
                              className="px-4 py-2.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                              title="Imprimir Relatório do Empenho"
                            >
                              <Printer className="w-4 h-4 text-gray-500" />
                              <span>Imprimir</span>
                            </button>

                            <button
                              onClick={() => setEmpenhoToDelete(targetEmp.id)}
                              className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
                              title="Excluir este empenho"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <EmpenhoDocumentActions
                        empenho={targetEmp}
                        user={user}
                        onDocumentUploaded={handleEmpenhoDocumentUploaded}
                        onNotify={showToast}
                      />

                      {/* 4 Financial Macro Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Card 1: Total Empenhado */}
                        <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                              Valor Total Empenhado
                            </span>
                            <h4 className="text-2xl font-black text-[#0b1c30] mt-1">
                              R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h4>
                          </div>
                          <p className="text-[11px] font-semibold text-gray-500 mt-3 pt-2 border-t border-gray-100">
                            Base Contratual Total (100%)
                          </p>
                        </div>

                        {/* Card 2: Total Recebido */}
                        <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                              Total Recebido (NF-e)
                            </span>
                            <h4 className="text-2xl font-black text-emerald-600 mt-1">
                              R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h4>
                          </div>
                          <p className="text-[11px] font-semibold text-emerald-700 mt-3 pt-2 border-t border-emerald-50">
                            {targetInvoices.length} {targetInvoices.length === 1 ? 'nota fiscal conciliada' : 'notas fiscais conciliadas'}
                          </p>
                        </div>

                        {/* Card 3: Saldo Disponível */}
                        <div className="bg-emerald-50/80 backdrop-blur-md p-5 rounded-2xl border border-emerald-200/80 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                              Saldo Disponível
                            </span>
                            <h4 className="text-2xl font-black text-emerald-900 mt-1">
                              R$ {saldoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h4>
                          </div>
                          <p className="text-[11px] font-semibold text-emerald-700 mt-3 pt-2 border-t border-emerald-100">
                            {itemsComSaldo} {itemsComSaldo === 1 ? 'item com saldo pendente' : 'itens com saldo pendente'}
                          </p>
                        </div>

                        {/* Card 4: Execução do Contrato */}
                        <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Execução Físico-Financeira
                              </span>
                              <span className={`text-xs font-black ${percentExecuted === 100 ? 'text-emerald-600' : 'text-[#00288e]'}`}>
                                {percentExecuted}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-3">
                              <div 
                                className={`h-full transition-all duration-500 rounded-full ${
                                  percentExecuted === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'
                                }`}
                                style={{ width: `${percentExecuted}%` }}
                              />
                            </div>
                          </div>
                          <p className="text-[11px] font-semibold text-gray-500 mt-3 pt-2 border-t border-gray-100">
                            {percentExecuted === 100 ? 'Contrato 100% Executado' : 'Em fase de fornecimento'}
                          </p>
                        </div>
                      </div>

                      {/* SECTION 1: SALDO E CONTROLE DOS ITENS DO EMPENHO */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm overflow-hidden">
                        {/* Section Header */}
                        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/50 to-white">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-[#00288e] flex items-center justify-center font-bold">
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-black text-base text-[#0b1c30]">
                                Saldo por Itens do Empenho
                              </h4>
                              <p className="text-xs text-gray-500 font-medium">
                                Acompanhamento quantitativo e financeiro item a item ({targetEmp.items.length} {targetEmp.items.length === 1 ? 'item cadastrado' : 'itens cadastrados'})
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingEmpenhoId(targetEmp.id);
                                setShowAddItemFormInDetail(!showAddItemFormInDetail);
                              }}
                              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                showAddItemFormInDetail 
                                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                                  : 'bg-[#00288e] text-white hover:bg-[#1e40af]'
                              }`}
                            >
                              <Plus className="w-4 h-4" />
                              <span>{showAddItemFormInDetail ? 'Fechar Formulário' : '+ Adicionar Item'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Add Item Form (Expandable) */}
                        {showAddItemFormInDetail && (
                          <div className="p-5 bg-blue-50/40 border-b border-blue-100 space-y-4 animate-fadeIn">
                            <h5 className="font-extrabold text-xs text-[#00288e] uppercase tracking-wider">
                              Cadastrar Novo Item ao Empenho {targetEmp.id}
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-1">Nº / Código Item</label>
                                <input
                                  type="text"
                                  placeholder="0001"
                                  value={newItemForm.id}
                                  onChange={(e) => setNewItemForm({ ...newItemForm, id: e.target.value })}
                                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold outline-none focus:border-[#00288e]"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-500 mb-1">Descrição do Material</label>
                                <input
                                  type="text"
                                  placeholder="Ex: Arroz Tipo 1 5kg"
                                  value={newItemForm.name}
                                  onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold outline-none focus:border-[#00288e]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-1">Unidade</label>
                                <select
                                  value={newItemForm.unit}
                                  onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold outline-none focus:border-[#00288e]"
                                >
                                  <option value="kg">kg (Quilograma)</option>
                                  <option value="un">un (Unidade)</option>
                                  <option value="fardo">fardo</option>
                                  <option value="cx">cx (Caixa)</option>
                                  <option value="lt">lt (Litro)</option>
                                  <option value="pct">pct (Pacote)</option>
                                  <option value="saco">saco</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-1">Qtd Empenhada</label>
                                <input
                                  type="number"
                                  placeholder="100"
                                  value={newItemForm.quantity}
                                  onChange={(e) => setNewItemForm({ ...newItemForm, quantity: e.target.value })}
                                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold outline-none focus:border-[#00288e]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-1">Valor Unitário (R$)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="10.50"
                                  value={newItemForm.unitPrice}
                                  onChange={(e) => setNewItemForm({ ...newItemForm, unitPrice: e.target.value })}
                                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold outline-none focus:border-[#00288e]"
                                />
                              </div>
                              <div className="sm:col-span-2 md:col-span-3 flex items-center justify-between gap-3 pt-2">
                                <div className="text-xs font-bold text-gray-600">
                                  Subtotal Previsto:{' '}
                                  <span className="text-[#00288e] font-black text-sm">
                                    R$ {((parseFloat(newItemForm.quantity) || 0) * (parseFloat(newItemForm.unitPrice) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAddItemToEmpenho}
                                  className="px-5 py-2.5 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#1e40af] transition-all shadow-sm cursor-pointer flex items-center gap-2"
                                >
                                  <Save className="w-4 h-4" />
                                  <span>Salvar Item no Empenho</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Items Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-gray-50/80 border-b border-gray-200/80 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                <th className="p-3.5 pl-5">Item / Cód.</th>
                                <th className="p-3.5">Descrição do Material</th>
                                <th className="p-3.5 text-center">Und</th>
                                <th className="p-3.5 text-right">Qtd Empenhada</th>
                                <th className="p-3.5 text-right">Qtd Recebida</th>
                                <th className="p-3.5 text-right">Saldo Físico</th>
                                <th className="p-3.5 text-right">Valor Unit.</th>
                                <th className="p-3.5 text-right">Total Empenhado</th>
                                <th className="p-3.5 text-right">Saldo Financeiro</th>
                                <th className="p-3.5 text-center">Execução</th>
                                <th className="p-3.5 pr-5 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium">
                              {targetEmp.items.map((item, idx) => {
                                const itemTotal = item.quantity * item.unitPrice;
                                const itemReceivedTotal = item.received * item.unitPrice;
                                const saldoFisico = Math.max(0, item.quantity - item.received);
                                const saldoFinanceiro = Math.max(0, itemTotal - itemReceivedTotal);
                                const percentItem = item.quantity > 0 ? Math.min(100, Math.round((item.received / item.quantity) * 100)) : 0;

                                return (
                                  <tr key={item.id || idx} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="p-3.5 pl-5">
                                      <span className="font-bold text-[#00288e] bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                                        {item.id || `#${idx + 1}`}
                                      </span>
                                    </td>
                                    <td className="p-3.5 font-bold text-[#0b1c30]">
                                      {item.name}
                                    </td>
                                    <td className="p-3.5 text-center">
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-bold rounded text-[10px] uppercase">
                                        {item.unit}
                                      </span>
                                    </td>
                                    <td className="p-3.5 text-right font-bold text-gray-700">
                                      {item.quantity.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="p-3.5 text-right font-bold text-emerald-600">
                                      {item.received.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="p-3.5 text-right">
                                      <span className={`px-2 py-0.5 rounded font-black text-xs ${
                                        saldoFisico > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200/60' : 'bg-emerald-50 text-emerald-700'
                                      }`}>
                                        {saldoFisico.toLocaleString('pt-BR')}
                                      </span>
                                    </td>
                                    <td className="p-3.5 text-right text-gray-600 font-semibold">
                                      R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3.5 text-right font-bold text-[#0b1c30]">
                                      R$ {itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3.5 text-right font-black text-amber-700">
                                      R$ {saldoFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3.5 text-center">
                                      <div className="flex flex-col items-center gap-1 min-w-[70px]">
                                        <span className={`text-[10px] font-extrabold ${percentItem === 100 ? 'text-emerald-600' : 'text-[#00288e]'}`}>
                                          {percentItem}%
                                        </span>
                                        <div className="w-12 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full ${percentItem === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'}`}
                                            style={{ width: `${percentItem}%` }}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3.5 pr-5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingEmpenhoId(targetEmp.id);
                                          handleDeleteItemFromEmpenho(item.id);
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                        title="Excluir item do empenho"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-50 font-black text-xs text-[#0b1c30] border-t-2 border-gray-200">
                                <td colSpan={3} className="p-3.5 pl-5 uppercase tracking-wider text-gray-500 text-[10px]">
                                  Totais Gerais ({targetEmp.items.length} itens)
                                </td>
                                <td className="p-3.5 text-right font-bold text-gray-700">
                                  {targetEmp.items.reduce((s, i) => s + i.quantity, 0).toLocaleString('pt-BR')}
                                </td>
                                <td className="p-3.5 text-right font-bold text-emerald-600">
                                  {targetEmp.items.reduce((s, i) => s + i.received, 0).toLocaleString('pt-BR')}
                                </td>
                                <td className="p-3.5 text-right font-black text-amber-700">
                                  {targetEmp.items.reduce((s, i) => s + Math.max(0, i.quantity - i.received), 0).toLocaleString('pt-BR')}
                                </td>
                                <td className="p-3.5 text-right text-gray-400">—</td>
                                <td className="p-3.5 text-right font-black text-[#0b1c30]">
                                  R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3.5 text-right font-black text-amber-700">
                                  R$ {saldoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td colSpan={2} className="p-3.5 text-center text-emerald-700 font-extrabold">
                                  {percentExecuted}% entregue
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* SECTION 2: NOTAS FISCAIS CADASTRADAS PARA ESTE EMPENHO */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm overflow-hidden">
                        {/* Section Header */}
                        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/40 to-white">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-black text-base text-[#0b1c30]">
                                Notas Fiscais Cadastradas para este Empenho
                              </h4>
                              <p className="text-xs text-gray-500 font-medium">
                                Total de {targetInvoices.length} {targetInvoices.length === 1 ? 'nota fiscal vinculada' : 'notas fiscais vinculadas'} a este empenho
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedNFCommitmentId(targetEmp.id);
                                setActiveTab('nova_nf');
                                setNfSubTab('cadastrar');
                              }}
                              className="px-4 py-2 bg-[#00288e] text-white text-xs font-bold rounded-xl hover:bg-[#1e40af] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Plus className="w-4 h-4" />
                              <span>+ Lançar Nota Fiscal</span>
                            </button>
                          </div>
                        </div>

                        {/* Invoices List or Empty State */}
                        {targetInvoices.length === 0 ? (
                          <div className="p-8 text-center bg-gray-50/50">
                            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-gray-500">Nenhuma Nota Fiscal cadastrada para este empenho até o momento.</p>
                            <button
                              onClick={() => {
                                setSelectedNFCommitmentId(targetEmp.id);
                                setActiveTab('nova_nf');
                                setNfSubTab('cadastrar');
                              }}
                              className="mt-3 px-4 py-2 bg-blue-50 text-[#00288e] hover:bg-blue-100 text-xs font-bold rounded-xl transition-all cursor-pointer"
                            >
                              + Cadastrar 1ª Nota Fiscal
                            </button>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-200/80 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                  <th className="p-3.5 pl-5">Número NF</th>
                                  <th className="p-3.5">Emissão</th>
                                  <th className="p-3.5">Data do TR</th>
                                  <th className="p-3.5">Comissão</th>
                                  <th className="p-3.5">Tesouraria</th>
                                  <th className="p-3.5">Nº da NS</th>
                                  <th className="p-3.5 text-right">Valor da NF</th>
                                  <th className="p-3.5 pr-5 text-center">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 font-medium">
                                {targetInvoices.map((inv) => (
                                  <tr key={inv.id} className="hover:bg-emerald-50/30 transition-colors">
                                    <td className="p-3.5 pl-5">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedReportInvoice(inv)}
                                        className="font-black text-[#00288e] hover:underline flex items-center gap-1.5 cursor-pointer"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                                        <span>NF #{inv.id}</span>
                                      </button>
                                    </td>
                                    <td className="p-3.5 text-gray-600 font-semibold">
                                      {formatDateOnly(inv.issueDate)}
                                    </td>
                                    <td className="p-3.5">
                                      {inv.termoEmissaoDate ? (
                                        <div className="flex items-center gap-1">
                                          <span className="font-bold text-gray-700">{formatDateOnly(inv.dataRecebimentoTermo)}</span>
                                          {inv.termoNumero && (
                                            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded">
                                              TR #{inv.termoNumero}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400 italic text-[11px]">Pendente</span>
                                      )}
                                    </td>
                                    <td className="p-3.5">
                                      {inv.dataComissao ? (
                                        <span className="font-bold text-gray-700">{formatDateOnly(inv.dataComissao)}</span>
                                      ) : (
                                        <span className="text-amber-600 font-semibold text-[11px]">Falta Enviar</span>
                                      )}
                                    </td>
                                    <td className="p-3.5">
                                      {inv.dataTesouraria ? (
                                        <span className="font-bold text-gray-700">{formatDateOnly(inv.dataTesouraria)}</span>
                                      ) : (
                                        <span className="text-amber-600 font-semibold text-[11px]">Falta Enviar</span>
                                      )}
                                    </td>
                                    <td className="p-3.5">
                                      {inv.nsLiquidacao ? (
                                        <span className="px-2 py-0.5 bg-blue-50 text-[#00288e] font-bold rounded text-[11px]">
                                          {inv.nsLiquidacao}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 italic text-[11px]">Não inf.</span>
                                      )}
                                    </td>
                                    <td className="p-3.5 text-right font-black text-[#0b1c30]">
                                      R$ {inv.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3.5 pr-5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedReportInvoice(inv)}
                                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                                          title="Ver Itens da Nota Fiscal"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDownloadTermoRecebimento(inv)}
                                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                                          title="Baixar Termo de Recebimento"
                                        >
                                          <FileDown className="w-4 h-4" />
                                        </button>
                                        <EmpenhoDocumentActions
                                          empenho={targetEmp}
                                          user={user}
                                          variant="compact"
                                          onDocumentUploaded={handleEmpenhoDocumentUploaded}
                                          onNotify={showToast}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingInvoice(inv);
                                            setSelectedNFCommitmentId(targetEmp.id);
                                            setActiveTab('nova_nf');
                                            setNfSubTab('cadastrar');
                                          }}
                                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                                          title="Editar Nota Fiscal"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-50 font-black text-xs text-[#0b1c30] border-t border-gray-200">
                                  <td colSpan={6} className="p-3.5 pl-5 uppercase tracking-wider text-gray-500 text-[10px]">
                                    Total de Notas Fiscais Lançadas ({targetInvoices.length})
                                  </td>
                                  <td className="p-3.5 text-right font-black text-emerald-600">
                                    R$ {totalInvoicesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3.5 text-center text-gray-400">—</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}

              {/* New Empenho Modal Dialog Overlay */}
              <AnimatePresence>
                {showNewEmpenhoModal && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className={`bg-white rounded-2xl shadow-xl border border-gray-100 w-full overflow-hidden transition-all duration-300 my-8 ${
                        reviewEmpenho ? 'max-w-5xl' : 'max-w-xl'
                      }`}
                    >
                      {/* Modal Header */}
                      <div className="bg-[#00288e] text-white p-5 flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-base tracking-tight">
                            {reviewEmpenho ? 'Revisão do Empenho Importado' : 'Adicionar Novo Empenho'}
                          </h3>
                          <p className="text-xs text-blue-200 mt-0.5">
                            {reviewEmpenho ? 'Revise e edite os dados extraídos antes de confirmar o salvamento' : 'Escolha um modo de cadastro para iniciar'}
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            setShowNewEmpenhoModal(false);
                            setReviewEmpenho(null);
                            setJsonInput('');
                            setJsonError(null);
                          }} 
                          className="text-blue-100 hover:text-white transition-all p-1 hover:bg-white/10 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Mode selection buttons - Only shown when not actively reviewing an imported JSON */}
                      {!reviewEmpenho && (
                        <div className="flex border-b border-gray-100 p-3 bg-gray-50/50 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewEmpenhoMode('manual');
                              setJsonError(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                              newEmpenhoMode === 'manual'
                                ? 'bg-[#00288e] text-white shadow-sm'
                                : 'bg-transparent text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            Cadastro Manual
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewEmpenhoMode('json');
                              setJsonError(null);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                              newEmpenhoMode === 'json'
                                ? 'bg-[#00288e] text-white shadow-sm'
                                : 'bg-transparent text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            <Braces className="w-3.5 h-3.5" /> Importar via JSON
                          </button>
                        </div>
                      )}

                      {/* MODE 1: MANUAL REGISTRATION */}
                      {newEmpenhoMode === 'manual' && !reviewEmpenho && (
                        <form onSubmit={handleCreateEmpenho} className="p-5 space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Código do Empenho (NE)</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: 2026NE0044"
                              value={newEmpenhoForm.id}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, id: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data de Emissão do Empenho</label>
                            <input 
                              type="date" 
                              required
                              value={newEmpenhoForm.date}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, date: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Fornecedor / Razão Social</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: MedTech Distribuidora Ltda"
                              value={newEmpenhoForm.supplier}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, supplier: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descrição sumária do Contrato</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: Medicamentos de Alta Densidade e Insumos"
                              value={newEmpenhoForm.description}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, description: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Pregão Relacionado</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: 01/2025"
                              value={newEmpenhoForm.pregao}
                              onChange={(e) => setNewEmpenhoForm({ ...newEmpenhoForm, pregao: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-semibold text-sm text-[#0b1c30]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Classificação do Empenho</label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['QR', 'CALI', 'PASA'] as const).map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setNewEmpenhoForm({ ...newEmpenhoForm, classification: type })}
                                  className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center border transition-all ${
                                    newEmpenhoForm.classification === type
                                      ? 'bg-[#00288e] text-white border-[#00288e] shadow-sm'
                                      : 'bg-white/40 text-gray-600 border-white/20 hover:bg-white/60 backdrop-blur-sm'
                                  }`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                            <button 
                              type="button"
                              onClick={() => setShowNewEmpenhoModal(false)}
                              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="submit"
                              className="px-4 py-2 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all shadow-sm"
                            >
                              Prosseguir
                            </button>
                          </div>
                        </form>
                      )}

                      {/* MODE 2: JSON IMPORT INPUT */}
                      {newEmpenhoMode === 'json' && !reviewEmpenho && (
                        <div className="p-5 space-y-4">
                          {/* PROMPT DOWNLOAD & INSTRUCTIONS CARD */}
                          <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 border border-blue-100 rounded-2xl p-4 space-y-3 shadow-xs">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#00288e] text-white rounded-xl shadow-xs shrink-0">
                                  <FileText className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-[#00288e] uppercase tracking-wider">
                                    Prompt para IA (Claude, ChatGPT ou Gemini)
                                  </h4>
                                  <p className="text-[11px] text-gray-600 font-medium">
                                    Baixe o prompt padronizado em <strong>TXT</strong> ou <strong>PDF</strong> para enviar junto ao PDF do Empenho para a IA converter em JSON.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100/80">
                              <button
                                type="button"
                                onClick={handleDownloadPromptTxt}
                                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 hover:border-blue-300"
                                title="Baixar o arquivo prompt_extracao_empenho.txt"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Baixar Prompt (.TXT)</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={handleDownloadPromptPdf}
                                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 hover:border-rose-300"
                                title="Baixar o arquivo prompt_extracao_empenho.pdf"
                              >
                                <FileDown className="w-3.5 h-3.5 text-rose-600" />
                                <span>Baixar Prompt (.PDF)</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleCopyPrompt}
                                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 hover:border-emerald-300 sm:ml-auto"
                                title="Copiar texto do prompt para a área de transferência"
                              >
                                {copiedPrompt ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700 font-bold">Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-gray-600" />
                                    <span>Copiar Prompt</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Cole aqui o JSON retornado pela IA
                              </label>
                              <span className="text-[11px] text-gray-400 font-mono">
                                Formato JSON
                              </span>
                            </div>
                            <textarea
                              rows={10}
                              value={jsonInput}
                              onChange={(e) => setJsonInput(e.target.value)}
                              placeholder={`Cole aqui o resultado JSON gerado pela IA...\n\n{\n  "numero_empenho": "2025NE124",\n  "data_emissao": "2025-08-27",\n  "tipo_empenho": "Global",\n  "valor_total": 12043.80,\n  "fornecedor": {\n    "razao_social": "JULIANO LUCIO FRANCISCATTO DO AMARAL & CIA LT",\n    "cnpj": "02.483.088/0001-75"\n  },\n  "itens": [\n    {\n      "num_item": "001",\n      "codigo_item": "00002",\n      "descricao": "LEGUME PROCESSADO, TIPO MANDIOCA...",\n      "unidade": "kg",\n      "quantidade": 430,\n      "valor_unitario": 6.90,\n      "valor_total_item": 2967.00\n    }\n  ]\n}`}
                              className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none font-mono text-xs text-[#0b1c30] bg-gray-50/50 resize-y"
                            />
                          </div>

                          {jsonError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5">
                              <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-500" />
                              <span>{jsonError}</span>
                            </div>
                          )}

                          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewEmpenhoModal(false);
                                setJsonInput('');
                                setJsonError(null);
                              }}
                              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleProcessJson}
                              className="px-5 py-2.5 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all shadow-sm flex items-center gap-1.5"
                            >
                              <Braces className="w-4 h-4" /> Processar JSON
                            </button>
                          </div>
                        </div>
                      )}

                      {/* MODE 2 SUB-VIEW: JSON REVIEW & EDIT SCREEN */}
                      {reviewEmpenho && (
                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                          
                          {/* Top-level Metadata Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Número do Empenho</label>
                              <input
                                type="text"
                                value={reviewEmpenho.id}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, id: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data de Emissão</label>
                              <input
                                type="text"
                                value={reviewEmpenho.date}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, date: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                                placeholder="DD/MM/AAAA"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Classificação do Empenho</label>
                              <div className="grid grid-cols-3 gap-1">
                                {(['QR', 'CALI', 'PASA'] as const).map((type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setReviewEmpenho({ ...reviewEmpenho, classification: type })}
                                    className={`py-1.5 rounded-lg font-bold text-[10px] border transition-all ${
                                      reviewEmpenho.classification === type
                                        ? 'bg-[#00288e] text-white border-[#00288e]'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fornecedor / Razão Social</label>
                              <input
                                type="text"
                                value={reviewEmpenho.supplier}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, supplier: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">CNPJ do Fornecedor</label>
                              <input
                                type="text"
                                value={reviewEmpenho.cnpj || ''}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, cnpj: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                                placeholder="00.000.000/0000-00"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Descrição Sumária do Contrato</label>
                              <input
                                type="text"
                                value={reviewEmpenho.description}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, description: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                                placeholder="Ex: Aquisição de Insumos Gerais"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pregão Relacionado</label>
                              <input
                                type="text"
                                value={reviewEmpenho.pregao}
                                onChange={(e) => setReviewEmpenho({ ...reviewEmpenho, pregao: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-xs font-bold text-[#0b1c30] focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                                placeholder="Ex: 12/2025"
                              />
                            </div>
                          </div>

                          {/* Alert for Divergence */}
                          {reviewEmpenho && typeof reviewEmpenho.valorTotalDeclarado === 'number' && reviewEmpenho.valorTotalDeclarado > 0 && (
                            (() => {
                              const calculatedTotal = reviewEmpenho.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
                              const isTotalDivergent = Math.abs(reviewEmpenho.valorTotalDeclarado - calculatedTotal) > 0.05;
                              if (isTotalDivergent) {
                                return (
                                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5">
                                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500" />
                                    <span>
                                      O valor total declarado (R$ {reviewEmpenho.valorTotalDeclarado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere da soma calculada dos itens (R$ {calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Revise antes de salvar.
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()
                          )}

                          {/* Items Section */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className="text-sm font-bold text-[#0b1c30] uppercase tracking-wider">Itens do Empenho ({reviewEmpenho.items.length})</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItem = {
                                    id: `ITEM-${Math.floor(Math.random() * 10000)}`,
                                    name: '',
                                    unit: 'UN',
                                    quantity: 1,
                                    unitPrice: 0,
                                    received: 0,
                                  };
                                  setReviewEmpenho({
                                    ...reviewEmpenho,
                                    items: [...reviewEmpenho.items, newItem],
                                  });
                                }}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#00288e] rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" /> Adicionar Item
                              </button>
                            </div>

                            {/* Scrollable table container */}
                            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-3 w-32">Cód. Item</th>
                                    <th className="p-3">Descrição</th>
                                    <th className="p-3 w-16">Unidade</th>
                                    <th className="p-3 w-20">Quantidade</th>
                                    <th className="p-3 w-28">V. Unitário (R$)</th>
                                    <th className="p-3 w-28 text-right">V. Total (R$)</th>
                                    <th className="p-3 w-16 text-center">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {reviewEmpenho.items.map((item: any, idx: number) => {
                                    const totalRow = item.quantity * item.unitPrice;
                                    return (
                                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={item.id}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].id = e.target.value;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] font-semibold text-gray-700"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].name = e.target.value;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] font-semibold text-gray-700"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={item.unit}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].unit = e.target.value;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] text-center font-bold text-gray-500"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="number"
                                            step="any"
                                            value={item.quantity}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].quantity = parseFloat(e.target.value) || 0;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] text-center font-bold text-gray-700"
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="number"
                                            step="any"
                                            value={item.unitPrice}
                                            onChange={(e) => {
                                              const updatedItems = [...reviewEmpenho.items];
                                              updatedItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#00288e] text-right font-bold text-gray-700"
                                          />
                                        </td>
                                        <td className="p-3 text-xs font-bold text-gray-700 text-right">
                                          R$ {totalRow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 text-center">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updatedItems = reviewEmpenho.items.filter((_: any, i: number) => i !== idx);
                                              setReviewEmpenho({ ...reviewEmpenho, items: updatedItems });
                                            }}
                                            className="text-rose-600 hover:text-rose-800 font-extrabold text-xs p-1 hover:bg-rose-50 rounded-lg"
                                          >
                                            Excluir
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-gray-50/80 font-bold border-t border-gray-100 text-xs text-gray-700">
                                    <td colSpan={5} className="p-3 text-right text-gray-500">Valor Total da Lista:</td>
                                    <td className="p-3 text-right text-sm text-[#00288e] font-extrabold">
                                      R$ {reviewEmpenho.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>

                          {/* Review footer buttons */}
                          <div className="pt-5 border-t border-gray-100 flex justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewEmpenho(null);
                                setJsonError(null);
                              }}
                              className="px-4 py-2.5 bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold text-xs rounded-xl flex items-center gap-1 transition-all"
                            >
                              <ArrowLeft className="w-4 h-4" /> Voltar
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowConfirmSaveModal(true)}
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <Check className="w-4 h-4" /> Confirmar e Salvar Empenho
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Sub-modal: Confirm JSON Save Resumo */}
              <AnimatePresence>
                {showConfirmSaveModal && reviewEmpenho && (
                  <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden"
                    >
                      <div className="bg-emerald-600 text-white p-5 flex justify-between items-center">
                        <h3 className="font-bold text-base tracking-tight flex items-center gap-1.5">
                          <CheckCircle2 className="w-5 h-5" /> Confirmar Cadastro
                        </h3>
                        <button 
                          onClick={() => setShowConfirmSaveModal(false)}
                          className="text-emerald-100 hover:text-white transition-all p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="p-5 space-y-4 text-sm text-[#0b1c30]">
                        <p className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Resumo do Novo Empenho</p>
                        
                        <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-bold text-xs">Número NE:</span>
                            <span className="font-extrabold text-gray-800">{reviewEmpenho.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-bold text-xs">Fornecedor:</span>
                            <span className="font-extrabold text-gray-800 text-right max-w-[200px] truncate">{reviewEmpenho.supplier}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-bold text-xs">Total de Itens:</span>
                            <span className="font-extrabold text-gray-800">{reviewEmpenho.items.length}</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                            <span className="text-gray-500 font-extrabold text-xs">Valor Total:</span>
                            <span className="font-black text-emerald-600">
                              R$ {reviewEmpenho.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                          Deseja confirmar o cadastro desta Nota de Empenho com as especificações acima? Esta ação persistirá os dados e atualizará o painel de faturamentos de forma definitiva.
                        </p>
                      </div>

                      <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowConfirmSaveModal(false)}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-xl font-bold text-xs transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveReviewEmpenho}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1"
                        >
                          Salvar Empenho
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </div>
          );
}
