'use client';

import React from 'react';
import { ArrowLeft, CalendarDays, CalendarRange, CheckCircle2, Download, Eye, FileSpreadsheet, Filter, Info, Loader2, Package, Plus, Printer, Save, Search, Sparkles, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { CronogramaEmpenho, CronogramaEntregaColuna, Empenho } from '../../../lib/types';

interface CronogramasViewContext {
  applyAllToFirstRemessa: any;
  applyCronogramaPreset: any;
  clearCronogramaDistribuicao: any;
  cronogramaColunas: CronogramaEntregaColuna[];
  cronogramaDistribuicao: { [itemId: string]: { [colunaId: string]: number } };
  cronogramaHorarioEntrega: string;
  cronogramaLocalEntrega: string;
  cronogramaObservacoes: string;
  cronogramaResponsavelCargo: string;
  cronogramaResponsavelNome: string;
  cronogramas: CronogramaEmpenho[];
  cronogramasClassFilter: string;
  cronogramasPregaoFilter: string;
  cronogramasSearch: string;
  cronogramasStatusFilter: 'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados';
  cronogramasYearFilter: string;
  empenhos: Empenho[];
  formatDateOnly: any;
  handleAddRemessa: (...args: any[]) => any;
  handleGenerateCronogramaPDF: (...args: any[]) => any;
  handleRemoveRemessa: (...args: any[]) => any;
  handleSaveCronograma: (...args: any[]) => any;
  handleSelectEmpenhoForCronograma: (...args: any[]) => any;
  isSavingCronograma: boolean;
  selectedCronogramaEmpenhoId: string | null;
  setCronogramaColunas: React.Dispatch<React.SetStateAction<CronogramaEntregaColuna[]>>;
  setCronogramaDistribuicao: React.Dispatch<React.SetStateAction<{ [itemId: string]: { [colunaId: string]: number } }>>;
  setCronogramaHorarioEntrega: (...args: any[]) => any;
  setCronogramaLocalEntrega: (...args: any[]) => any;
  setCronogramaObservacoes: (...args: any[]) => any;
  setCronogramaResponsavelCargo: (...args: any[]) => any;
  setCronogramaResponsavelNome: (...args: any[]) => any;
  setCronogramasClassFilter: (...args: any[]) => any;
  setCronogramasPregaoFilter: (...args: any[]) => any;
  setCronogramasSearch: (...args: any[]) => any;
  setCronogramasStatusFilter: (...args: any[]) => any;
  setCronogramasYearFilter: (...args: any[]) => any;
  setSelectedCronogramaEmpenhoId: (...args: any[]) => any;
  setShowCronogramaPreviewModal: (...args: any[]) => any;
  showCronogramaPreviewModal: boolean;
  uniqueEmpenhoYears: string[];
  uniquePregaos: string[];
}

interface CronogramasViewProps {
  context: CronogramasViewContext;
}
/** Tela de Cronogramas extraída sem alterar regras de negócio, persistência ou comportamento. */
export function CronogramasView({ context }: CronogramasViewProps) {
  const { applyAllToFirstRemessa, applyCronogramaPreset, clearCronogramaDistribuicao, cronogramaColunas, cronogramaDistribuicao, cronogramaHorarioEntrega, cronogramaLocalEntrega, cronogramaObservacoes, cronogramaResponsavelCargo, cronogramaResponsavelNome, cronogramas, cronogramasClassFilter, cronogramasPregaoFilter, cronogramasSearch, cronogramasStatusFilter, cronogramasYearFilter, empenhos, formatDateOnly, handleAddRemessa, handleGenerateCronogramaPDF, handleRemoveRemessa, handleSaveCronograma, handleSelectEmpenhoForCronograma, isSavingCronograma, selectedCronogramaEmpenhoId, setCronogramaColunas, setCronogramaDistribuicao, setCronogramaHorarioEntrega, setCronogramaLocalEntrega, setCronogramaObservacoes, setCronogramaResponsavelCargo, setCronogramaResponsavelNome, setCronogramasClassFilter, setCronogramasPregaoFilter, setCronogramasSearch, setCronogramasStatusFilter, setCronogramasYearFilter, setSelectedCronogramaEmpenhoId, setShowCronogramaPreviewModal, showCronogramaPreviewModal, uniqueEmpenhoYears, uniquePregaos } = context;
  return (
            <div id="view-cronogramas" className="w-full max-w-7xl mx-auto space-y-6 pb-24">
              
              {/* CASE 1: LIST OF EMPENHOS FOR CRONOGRAMAS */}
              {selectedCronogramaEmpenhoId === null ? (
                <div className="space-y-6">
                  
                  {/* Header Title & Subtitle */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-white/30 shadow-sm">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00288e]/10 flex items-center justify-center text-[#00288e]">
                          <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black tracking-tight text-[#0b1c30]">
                            Cronogramas de Entrega
                          </h2>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Planejamento e simulação física de entregas com base no saldo atualizado dos itens de cada empenho para envio às empresas fornecedoras.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Search and Filters Bar */}
                  <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      
                      {/* Search Bar */}
                      <div className="md:col-span-6 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Buscar por número do empenho, fornecedor ou objeto..."
                          value={cronogramasSearch}
                          onChange={(e) => setCronogramasSearch(e.target.value)}
                          className="w-full h-11 pl-10 pr-4 bg-white/80 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] transition-all"
                        />
                        {cronogramasSearch && (
                          <button
                            onClick={() => setCronogramasSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Filter: Pregão */}
                      <div className="md:col-span-2">
                        <select
                          value={cronogramasPregaoFilter}
                          onChange={(e) => setCronogramasPregaoFilter(e.target.value)}
                          className="w-full h-11 px-3 bg-white/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] transition-all cursor-pointer"
                        >
                          <option value="Todos">Todos os Pregões</option>
                          {uniquePregaos.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter: Ano */}
                      <div className="md:col-span-2">
                        <select
                          value={cronogramasYearFilter}
                          onChange={(e) => setCronogramasYearFilter(e.target.value)}
                          className="w-full h-11 px-3 bg-white/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] transition-all cursor-pointer"
                        >
                          <option value="Todos">Todos os Anos</option>
                          {uniqueEmpenhoYears.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter: Classe */}
                      <div className="md:col-span-2">
                        <select
                          value={cronogramasClassFilter}
                          onChange={(e) => setCronogramasClassFilter(e.target.value)}
                          className="w-full h-11 px-3 bg-white/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] transition-all cursor-pointer"
                        >
                          <option value="Todos">Todas as Classes</option>
                          <option value="QR">QR - Ração Operacional</option>
                          <option value="CALI">CALI - Alimentos</option>
                          <option value="PASA">PASA - Apoio de Saúde</option>
                        </select>
                      </div>

                    </div>

                    {/* Status Filter Chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2 flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5" /> Status do Saldo:
                      </span>
                      {[
                        { id: 'Todos', label: 'Todos os Empenhos' },
                        { id: 'Com Saldo', label: 'Com Saldo Disponível' },
                        { id: 'Ativos', label: 'Ativos' },
                        { id: 'Encerrados', label: 'Encerrados / 100% Entregues' },
                      ].map((chip) => (
                        <button
                          key={chip.id}
                          onClick={() => setCronogramasStatusFilter(chip.id as any)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            cronogramasStatusFilter === chip.id
                              ? 'bg-[#00288e] text-white shadow-sm'
                              : 'bg-white/80 text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Empenhos Grid for Cronogramas */}
                  {(() => {
                    const filtered = empenhos.filter(emp => {
                      // Text search
                      const matchesSearch = 
                        emp.id.toLowerCase().includes(cronogramasSearch.toLowerCase()) ||
                        emp.supplier.toLowerCase().includes(cronogramasSearch.toLowerCase()) ||
                        emp.description.toLowerCase().includes(cronogramasSearch.toLowerCase());
                      if (!matchesSearch) return false;

                      // Pregão filter
                      if (cronogramasPregaoFilter !== 'Todos' && emp.pregao !== cronogramasPregaoFilter) {
                        return false;
                      }

                      // Year filter
                      if (cronogramasYearFilter !== 'Todos') {
                        let empYear = '';
                        if (emp.date) {
                          const parts = emp.date.split('/');
                          if (parts.length === 3) empYear = parts[2];
                          else if (emp.date.includes('-')) empYear = emp.date.split('-')[0];
                        }
                        if (empYear !== cronogramasYearFilter) return false;
                      }

                      // Class filter
                      if (cronogramasClassFilter !== 'Todos' && emp.classification !== cronogramasClassFilter) {
                        return false;
                      }

                      // Status filter
                      const totalCommitted = emp.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);
                      const totalReceived = emp.items.reduce((s, it) => s + (it.received * it.unitPrice), 0);
                      const saldo = Math.max(0, totalCommitted - totalReceived);

                      if (cronogramasStatusFilter === 'Com Saldo' && saldo <= 0) return false;
                      if (cronogramasStatusFilter === 'Ativos' && emp.status !== 'Ativo') return false;
                      if (cronogramasStatusFilter === 'Encerrados' && emp.status !== 'Encerrado' && saldo > 0) return false;

                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/20 p-12 text-center space-y-3">
                          <Package className="w-12 h-12 text-gray-300 mx-auto" />
                          <h3 className="text-base font-bold text-gray-700">Nenhum empenho encontrado com os filtros selecionados</h3>
                          <p className="text-xs text-gray-500">Tente ajustar seus termos de busca ou filtros acima.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filtered.map(emp => {
                          const totalCommitted = emp.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);
                          const totalReceived = emp.items.reduce((s, it) => s + (it.received * it.unitPrice), 0);
                          const saldoDisponivel = Math.max(0, totalCommitted - totalReceived);
                          const percentExecuted = totalCommitted > 0 ? Math.min(100, Math.round((totalReceived / totalCommitted) * 100)) : 0;
                          const itemsComSaldo = emp.items.filter(it => (it.quantity - it.received) > 0).length;
                          const savedCrono = cronogramas.find(c => c.empenhoId === emp.id);

                          return (
                            <div 
                              key={emp.id}
                              className="bg-white/80 hover:bg-white backdrop-blur-md rounded-2xl border border-white/40 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                            >
                              {/* Card Header */}
                              <div className="p-5 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-1 bg-[#00288e]/10 text-[#00288e] font-extrabold text-xs rounded-lg tracking-wider">
                                        NE {emp.id}
                                      </span>
                                      {emp.classification && (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider ${
                                          emp.classification === 'QR' ? 'bg-amber-100 text-amber-800' :
                                          emp.classification === 'CALI' ? 'bg-emerald-100 text-emerald-800' :
                                          'bg-purple-100 text-purple-800'
                                        }`}>
                                          {emp.classification}
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="font-extrabold text-sm text-[#0b1c30] mt-2 line-clamp-1 group-hover:text-[#00288e] transition-colors">
                                      {emp.supplier}
                                    </h4>
                                  </div>

                                  {savedCrono ? (
                                    <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0">
                                      <CheckCircle2 className="w-3 h-3" /> Configurado
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg shrink-0">
                                      Pendente
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                  {emp.description}
                                </p>

                                {/* Meta details */}
                                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                                  <span>Pregão: <strong className="text-gray-700">{emp.pregao || '—'}</strong></span>
                                  <span>Emissão: <strong className="text-gray-700">{formatDateOnly(emp.date)}</strong></span>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-1.5 pt-2">
                                  <div className="flex justify-between text-[11px] font-semibold">
                                    <span className="text-gray-500">Execução:</span>
                                    <span className={percentExecuted === 100 ? 'text-emerald-600 font-bold' : 'text-[#00288e] font-bold'}>
                                      {percentExecuted}% entregue
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        percentExecuted === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'
                                      }`}
                                      style={{ width: `${percentExecuted}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Financial Metrics Grid */}
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 text-center">
                                  <div className="bg-gray-50 p-2 rounded-xl">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Empenhado</span>
                                    <span className="text-xs font-bold text-gray-800">
                                      R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                  <div className="bg-gray-50 p-2 rounded-xl">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Recebido</span>
                                    <span className="text-xs font-bold text-gray-700">
                                      R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                  <div className={`p-2 rounded-xl ${saldoDisponivel > 0 ? 'bg-emerald-50/70 border border-emerald-100' : 'bg-gray-50'}`}>
                                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Saldo Disp.</span>
                                    <span className={`text-xs font-extrabold ${saldoDisponivel > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                                      R$ {saldoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                </div>

                                {/* Items count badge */}
                                <div className="text-[11px] text-gray-500 flex items-center justify-between">
                                  <span>Total de itens: <strong>{emp.items.length}</strong></span>
                                  <span className="text-emerald-700 font-semibold">{itemsComSaldo} com saldo a entregar</span>
                                </div>
                              </div>

                              {/* Card Footer Actions */}
                              <div className="p-3 bg-gray-50/70 border-t border-gray-100 flex items-center gap-2">
                                <button
                                  onClick={() => handleSelectEmpenhoForCronograma(emp.id)}
                                  className="flex-1 py-2.5 px-4 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                                >
                                  <CalendarDays className="w-4 h-4" />
                                  {savedCrono ? 'Editar Cronograma' : 'Gerar Cronograma'}
                                </button>
                                {savedCrono && (
                                  <button
                                    onClick={() => handleGenerateCronogramaPDF(emp, 'print')}
                                    title="Imprimir PDF Rápido"
                                    className="p-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl transition-all cursor-pointer active:scale-95"
                                  >
                                    <Printer className="w-4 h-4 text-[#00288e]" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                </div>
              ) : (
                /* CASE 2: DETAIL / CRONOGRAMA SIMULATION & GENERATION VIEW */
                (() => {
                  const targetEmp = empenhos.find(e => e.id === selectedCronogramaEmpenhoId);
                  if (!targetEmp) return null;

                  const totalCommitted = targetEmp.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);
                  const totalReceived = targetEmp.items.reduce((s, it) => s + (it.received * it.unitPrice), 0);
                  const saldoDisponivelTotal = Math.max(0, totalCommitted - totalReceived);

                  // Total programado na simulação
                  const totalProgramadoGeral = targetEmp.items.reduce((acc, it) => {
                    const qProgramada = cronogramaColunas.reduce((sum, col) => sum + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
                    return acc + (qProgramada * it.unitPrice);
                  }, 0);

                  const saldoRestanteNaoProgramado = saldoDisponivelTotal - totalProgramadoGeral;
                  const percentualCobertura = saldoDisponivelTotal > 0 ? Math.round((totalProgramadoGeral / saldoDisponivelTotal) * 100) : 0;

                  return (
                    <div className="space-y-6">

                      {/* Top Action Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/30 shadow-sm">
                        <button
                          onClick={() => setSelectedCronogramaEmpenhoId(null)}
                          className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-[#00288e] transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" /> Voltar para Lista de Cronogramas
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setShowCronogramaPreviewModal(true)}
                            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <Eye className="w-4 h-4 text-blue-600" /> Prévia do Documento
                          </button>
                          <button
                            onClick={() => handleGenerateCronogramaPDF(targetEmp, 'print')}
                            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <Printer className="w-4 h-4 text-emerald-600" /> Imprimir
                          </button>
                          <button
                            onClick={() => handleGenerateCronogramaPDF(targetEmp, 'download')}
                            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <Download className="w-4 h-4 text-purple-600" /> Baixar PDF
                          </button>
                          <button
                            onClick={handleSaveCronograma}
                            disabled={isSavingCronograma}
                            aria-busy={isSavingCronograma}
                            className="px-4 py-2 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            {isSavingCronograma ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" /> Salvar Cronograma
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Header Card with Empenho Details & Simulation Notice */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-sm space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-3 py-1 bg-[#00288e] text-white font-extrabold text-sm rounded-xl tracking-wider shadow-sm">
                                NE {targetEmp.id}
                              </span>
                              {targetEmp.pregao && (
                                <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-bold text-xs rounded-lg border border-blue-100">
                                  Pregão: {targetEmp.pregao}
                                </span>
                              )}
                              {targetEmp.classification && (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-bold text-xs rounded-lg border border-amber-100">
                                  Classe: {targetEmp.classification}
                                </span>
                              )}
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 font-medium text-xs rounded-lg">
                                Emissão: {formatDateOnly(targetEmp.date)}
                              </span>
                            </div>

                            <h3 className="text-xl font-extrabold text-[#0b1c30]">
                              {targetEmp.supplier}
                            </h3>
                            <p className="text-xs text-gray-600 leading-relaxed max-w-4xl">
                              {targetEmp.description}
                            </p>
                          </div>
                        </div>

                        {/* Official Simulation Warning */}
                        <div className="bg-amber-50/80 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-start gap-3 text-xs leading-relaxed">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Simulação Operacional de Cronograma:</strong> A geração ou alteração deste cronograma é uma projeção física para envio à empresa fornecedora e <strong>NÃO altera o saldo oficial</strong> do empenho ou das notas fiscais. O saldo disponível abaixo é atualizado dinamicamente em tempo real conforme forem sendo cadastradas novas Notas Fiscais para este empenho.
                          </div>
                        </div>

                        {/* Financial Metrics Summary Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Total Disponível</span>
                            <span className="text-base font-extrabold text-slate-800">
                              R$ {saldoDisponivelTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-blue-50/70 border border-blue-100 p-3.5 rounded-xl">
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Total no Cronograma</span>
                            <span className="text-base font-extrabold text-[#00288e]">
                              R$ {totalProgramadoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className={`p-3.5 rounded-xl border ${
                            saldoRestanteNaoProgramado === 0 
                              ? 'bg-emerald-50/70 border-emerald-100' 
                              : saldoRestanteNaoProgramado > 0 
                              ? 'bg-amber-50/70 border-amber-100' 
                              : 'bg-rose-50/70 border-rose-100'
                          }`}>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Saldo Restante</span>
                            <span className={`text-base font-extrabold ${
                              saldoRestanteNaoProgramado === 0 
                                ? 'text-emerald-700' 
                                : saldoRestanteNaoProgramado > 0 
                                ? 'text-amber-700' 
                                : 'text-rose-700'
                            }`}>
                              R$ {saldoRestanteNaoProgramado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-purple-50/70 border border-purple-100 p-3.5 rounded-xl">
                            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">Cobertura do Saldo</span>
                            <span className="text-base font-extrabold text-purple-800">
                              {percentualCobertura}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 1: REMESSAS CONFIGURATION & PRESETS */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                          <div>
                            <h4 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                              <CalendarRange className="w-4 h-4 text-[#00288e]" /> 1. Configuração de Remessas e Datas de Entrega
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Defina o número de entregas parceladas e as datas estimadas para a empresa fornecedora.
                            </p>
                          </div>

                          {/* Quick Presets */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-gray-400 mr-1">Presets:</span>
                            <button
                              onClick={() => applyCronogramaPreset(1, 0)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              1x Única (100%)
                            </button>
                            <button
                              onClick={() => applyCronogramaPreset(2, 15)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              2x Quinzenais
                            </button>
                            <button
                              onClick={() => applyCronogramaPreset(3, 30)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              3x Mensais
                            </button>
                            <button
                              onClick={() => applyCronogramaPreset(4, 30)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              4x Mensais
                            </button>
                            <button
                              onClick={() => applyCronogramaPreset(6, 30)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              6x Mensais
                            </button>
                          </div>
                        </div>

                        {/* Remessas Cards Strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                          {cronogramaColunas.map((col, index) => (
                            <div 
                              key={col.id}
                              className="bg-gray-50/90 border border-gray-200/80 rounded-xl p-3 space-y-2.5 relative group hover:border-[#00288e]/40 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <input
                                  type="text"
                                  value={col.titulo}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCronogramaColunas(cronogramaColunas.map(c => c.id === col.id ? { ...c, titulo: val } : c));
                                  }}
                                  className="text-xs font-extrabold text-[#00288e] bg-transparent border-b border-transparent focus:border-[#00288e] focus:outline-none w-28"
                                />
                                {cronogramaColunas.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveRemessa(col.id)}
                                    title="Remover Remessa"
                                    className="text-gray-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Data Prevista:</label>
                                <input
                                  type="date"
                                  value={col.dataPrevista}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCronogramaColunas(cronogramaColunas.map(c => c.id === col.id ? { ...c, dataPrevista: val } : c));
                                  }}
                                  className="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00288e]"
                                />
                              </div>
                            </div>
                          ))}

                          {/* Add Remessa Button Card */}
                          <button
                            onClick={handleAddRemessa}
                            className="h-full min-h-[92px] border-2 border-dashed border-gray-200 hover:border-[#00288e] rounded-xl p-3 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#00288e] bg-white/40 hover:bg-blue-50/30 transition-all cursor-pointer group"
                          >
                            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold">+ Adicionar Remessa</span>
                          </button>
                        </div>

                        {/* Quick Distribution Helpers */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                          <span className="text-xs text-gray-500 font-medium">Ações automáticas para preenchimento:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => applyCronogramaPreset(cronogramaColunas.length)}
                              className="px-3 py-1.5 bg-blue-50 text-[#00288e] hover:bg-blue-100 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Distribuir Saldo Igualmente
                            </button>
                            <button
                              onClick={applyAllToFirstRemessa}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Alocar 100% na 1ª Remessa
                            </button>
                            <button
                              onClick={clearCronogramaDistribuicao}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Zerar Quantidades
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 2: INTERACTIVE ITEMS TABLE */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm overflow-hidden space-y-3">
                        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-[#00288e]" /> 2. Tabela de Quantidades por Item e Remessa de Entrega
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Preencha ou ajuste manualmente as quantidades a serem entregues pela empresa em cada remessa.
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                <th className="py-3 px-4 min-w-[200px]">Item / Descrição</th>
                                <th className="py-3 px-2 text-center w-14">Und</th>
                                <th className="py-3 px-2 text-center w-20">Empenhado</th>
                                <th className="py-3 px-2 text-center w-20">Já Recebido</th>
                                <th className="py-3 px-3 text-center w-28 bg-emerald-50 text-emerald-800 font-black">
                                  Saldo Atual Disp.
                                </th>
                                
                                {/* Dynamic Remessa Columns */}
                                {cronogramaColunas.map((col, idx) => (
                                  <th key={col.id} className="py-3 px-2 text-center min-w-[110px] bg-blue-50/60 text-[#00288e]">
                                    <div className="font-extrabold">{col.titulo}</div>
                                    <div className="text-[9px] font-medium text-gray-500 lowercase">{formatDateOnly(col.dataPrevista)}</div>
                                  </th>
                                ))}

                                <th className="py-3 px-2 text-center w-24">Total Prog.</th>
                                <th className="py-3 px-2 text-right w-24">Val. Unit.</th>
                                <th className="py-3 px-4 text-right w-28 font-bold">Total (R$)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                              {targetEmp.items.map((it, itemIndex) => {
                                const saldoDisponivel = Math.max(0, it.quantity - it.received);
                                const totalProgramadoItem = cronogramaColunas.reduce((sum, col) => {
                                  return sum + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0);
                                }, 0);
                                const saldoRestanteItem = saldoDisponivel - totalProgramadoItem;
                                const valorTotalProgItem = totalProgramadoItem * it.unitPrice;

                                const isExact = totalProgramadoItem === saldoDisponivel;
                                const isExceeded = totalProgramadoItem > saldoDisponivel;

                                return (
                                  <tr key={it.id} className="hover:bg-blue-50/20 transition-colors">
                                    {/* Description */}
                                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold text-gray-400">#{it.id}</span>
                                        <span className="text-xs font-bold text-gray-800">{it.name}</span>
                                      </div>
                                    </td>

                                    {/* Unit */}
                                    <td className="py-3.5 px-2 text-center text-gray-500 font-medium uppercase text-[11px]">
                                      {it.unit}
                                    </td>

                                    {/* Empenhado */}
                                    <td className="py-3.5 px-2 text-center font-medium text-gray-600">
                                      {it.quantity}
                                    </td>

                                    {/* Recebido */}
                                    <td className="py-3.5 px-2 text-center font-medium text-gray-500">
                                      {it.received}
                                    </td>

                                    {/* Saldo Disponível */}
                                    <td className="py-3.5 px-3 text-center bg-emerald-50/60 font-black text-emerald-700">
                                      {saldoDisponivel}
                                    </td>

                                    {/* Dynamic Inputs for each Remessa */}
                                    {cronogramaColunas.map((col) => {
                                      const currentVal = cronogramaDistribuicao[it.id]?.[col.id] ?? 0;

                                      return (
                                        <td key={col.id} className="py-2.5 px-2 text-center bg-blue-50/30">
                                          <input
                                            type="number"
                                            min="0"
                                            max={it.quantity * 2}
                                            value={currentVal === 0 ? '' : currentVal}
                                            placeholder="0"
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              const num = raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
                                              setCronogramaDistribuicao(prev => ({
                                                ...prev,
                                                [it.id]: {
                                                  ...(prev[it.id] || {}),
                                                  [col.id]: num
                                                }
                                              }));
                                            }}
                                            className={`w-20 h-8 px-2 text-center font-extrabold text-xs rounded-lg border focus:outline-none transition-all ${
                                              currentVal > 0 
                                                ? 'bg-white border-[#00288e] text-[#00288e] ring-1 ring-[#00288e]/20' 
                                                : 'bg-white/80 border-gray-200 text-gray-400 focus:border-[#00288e]'
                                            }`}
                                          />
                                        </td>
                                      );
                                    })}

                                    {/* Total Programado */}
                                    <td className="py-3.5 px-2 text-center">
                                      <div className="flex flex-col items-center">
                                        <span className={`font-black text-xs ${
                                          isExact ? 'text-emerald-700' : isExceeded ? 'text-rose-600' : 'text-blue-700'
                                        }`}>
                                          {totalProgramadoItem}
                                        </span>
                                        {isExact ? (
                                          <span className="text-[9px] font-bold text-emerald-600">100%</span>
                                        ) : isExceeded ? (
                                          <span className="text-[9px] font-bold text-rose-600">+{totalProgramadoItem - saldoDisponivel}</span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-amber-600">-{saldoRestanteItem}</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Unit Price */}
                                    <td className="py-3.5 px-2 text-right text-gray-500 font-medium text-xs">
                                      R$ {it.unitPrice.toFixed(2)}
                                    </td>

                                    {/* Total Price (R$) */}
                                    <td className="py-3.5 px-4 text-right font-extrabold text-gray-900 text-xs">
                                      R$ {valorTotalProgItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>

                            {/* Summary Footer */}
                            <tfoot>
                              <tr className="bg-gray-50/90 border-t-2 border-gray-200 font-extrabold text-xs text-gray-800">
                                <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px] text-gray-600">
                                  TOTAIS GERAIS DO CRONOGRAMA:
                                </td>

                                {/* Totais por remessa */}
                                {cronogramaColunas.map((col) => {
                                  const totalQtyCol = targetEmp.items.reduce((s, it) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
                                  const totalValCol = targetEmp.items.reduce((s, it) => s + ((Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0) * it.unitPrice), 0);

                                  return (
                                    <td key={col.id} className="py-3.5 px-2 text-center bg-blue-50/70 text-[#00288e]">
                                      <div className="font-black">{totalQtyCol} un</div>
                                      <div className="text-[10px] text-[#00288e]/80">R$ {totalValCol.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                    </td>
                                  );
                                })}

                                <td className="py-3.5 px-2 text-center font-black text-[#00288e]">
                                  {targetEmp.items.reduce((sum, it) => sum + cronogramaColunas.reduce((s, col) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0), 0)}
                                </td>
                                <td className="py-3.5 px-2 text-right text-gray-400">—</td>
                                <td className="py-3.5 px-4 text-right font-black text-[#00288e] text-sm">
                                  R$ {totalProgramadoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* SECTION 3: INSTRUCTIONS & SIGNATURE DETAILS */}
                      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-sm space-y-4">
                        <div>
                          <h4 className="text-sm font-extrabold text-[#0b1c30] flex items-center gap-2">
                            <Info className="w-4 h-4 text-[#00288e]" /> 3. Informações Complementares para o Fornecedor e Assinatura
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Estes dados sairão impressos no cabeçalho e rodapé do documento oficial em PDF enviado para a empresa.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Local de Entrega:</label>
                            <input
                              type="text"
                              value={cronogramaLocalEntrega}
                              onChange={(e) => setCronogramaLocalEntrega(e.target.value)}
                              placeholder="ex: Almoxarifado Geral / Seção de Aprovisionamento - HGeSM"
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Horário Autorizado de Recebimento:</label>
                            <input
                              type="text"
                              value={cronogramaHorarioEntrega}
                              onChange={(e) => setCronogramaHorarioEntrega(e.target.value)}
                              placeholder="ex: Segunda a Quinta: 08:00 às 11:30 e 13:30 às 16:30 | Sexta: 08:00 às 11:30"
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
                            />
                          </div>

                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Observações e Instruções para a Empresa Fornecedora:</label>
                            <textarea
                              rows={3}
                              value={cronogramaObservacoes}
                              onChange={(e) => setCronogramaObservacoes(e.target.value)}
                              placeholder="Insira diretrizes de entrega, exigências de temperatura, lotes e validade..."
                              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] leading-relaxed"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Nome do Responsável / Fiscal HGeSM:</label>
                            <input
                              type="text"
                              value={cronogramaResponsavelNome}
                              onChange={(e) => setCronogramaResponsavelNome(e.target.value)}
                              placeholder="Nome e Posto/Graduação do Encarregado"
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 block">Cargo / Função do Responsável:</label>
                            <input
                              type="text"
                              value={cronogramaResponsavelCargo}
                              onChange={(e) => setCronogramaResponsavelCargo(e.target.value)}
                              placeholder="ex: Fiscal de Contrato / Seção de Aprovisionamento - HGeSM"
                              className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Modal de Prévia do Cronograma */}
                      <AnimatePresence>
                        {showCronogramaPreviewModal && (
                          <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                            <motion.div
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.95, opacity: 0 }}
                              className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-4xl w-full overflow-hidden my-8"
                            >
                              {/* Modal Header */}
                              <div className="p-4 bg-[#00288e] text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Eye className="w-5 h-5 text-blue-200" />
                                  <h3 className="font-bold text-sm">Prévia de Impressão do Cronograma Oficial</h3>
                                </div>
                                <button
                                  onClick={() => setShowCronogramaPreviewModal(false)}
                                  className="text-blue-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>

                              {/* Document Sheet Preview */}
                              <div className="p-8 space-y-6 bg-slate-50 overflow-y-auto max-h-[75vh]">
                                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6 text-gray-800 font-sans">
                                  
                                  {/* Official Header */}
                                  <div className="text-center space-y-1 border-b border-gray-300 pb-4">
                                    <p className="text-xs font-extrabold text-[#00288e] tracking-widest uppercase">MINISTÉRIO DA DEFESA • EXÉRCITO BRASILEIRO</p>
                                    <p className="text-xs font-bold text-gray-700">HOSPITAL GERAL DE SANTA MARIA (HGeSM)</p>
                                    <p className="text-[11px] text-gray-500 font-medium">SEÇÃO DE APROVISIONAMENTO / LOGÍSTICA HOSPITALAR</p>
                                    <h2 className="text-sm font-black text-[#00288e] pt-2 uppercase tracking-wide">
                                      CRONOGRAMA DE ENTREGA DE MATERIAL / GÊNEROS (NE: {targetEmp.id})
                                    </h2>
                                  </div>

                                  {/* Contract Details */}
                                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div>
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Nota de Empenho:</span>
                                      <strong className="text-gray-900">{targetEmp.id}</strong>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Pregão:</span>
                                      <strong className="text-gray-900">{targetEmp.pregao || '—'}</strong>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Classe:</span>
                                      <strong className="text-gray-900">{targetEmp.classification || 'QR'}</strong>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Fornecedor:</span>
                                      <strong className="text-gray-900">{targetEmp.supplier}</strong>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Data Emissão NE:</span>
                                      <strong className="text-gray-900">{formatDateOnly(targetEmp.date)}</strong>
                                    </div>
                                    <div className="sm:col-span-3 pt-2 border-t border-gray-200 flex flex-wrap justify-between gap-2">
                                      <span>Total Empenhado: <strong>R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                                      <span>Já Faturado em NF: <strong>R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                                      <span className="text-emerald-700 font-black">Saldo Atual: R$ {saldoDisponivelTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                  </div>

                                  {/* Remessas Table in Preview */}
                                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs text-left border-collapse">
                                      <thead className="bg-[#00288e] text-white text-[10px] uppercase">
                                        <tr>
                                          <th className="p-2">Item</th>
                                          <th className="p-2 text-center">Und</th>
                                          <th className="p-2 text-center">Saldo Disp.</th>
                                          {cronogramaColunas.map(col => (
                                            <th key={col.id} className="p-2 text-center">
                                              {col.titulo} ({formatDateOnly(col.dataPrevista)})
                                            </th>
                                          ))}
                                          <th className="p-2 text-center">Total Prog.</th>
                                          <th className="p-2 text-right">Total (R$)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {targetEmp.items.map(it => {
                                          const saldo = Math.max(0, it.quantity - it.received);
                                          const prog = cronogramaColunas.reduce((s, col) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0);
                                          return (
                                            <tr key={it.id} className="hover:bg-gray-50">
                                              <td className="p-2 font-medium">{it.name}</td>
                                              <td className="p-2 text-center text-gray-500 uppercase">{it.unit}</td>
                                              <td className="p-2 text-center font-bold text-emerald-700">{saldo}</td>
                                              {cronogramaColunas.map(col => (
                                                <td key={col.id} className="p-2 text-center font-semibold">
                                                  {cronogramaDistribuicao[it.id]?.[col.id] || '—'}
                                                </td>
                                              ))}
                                              <td className="p-2 text-center font-bold text-[#00288e]">{prog}</td>
                                              <td className="p-2 text-right font-bold">R$ {(prog * it.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-gray-100 font-extrabold">
                                          <td colSpan={3} className="p-2 text-right uppercase text-[10px]">TOTAL:</td>
                                          {cronogramaColunas.map(col => (
                                            <td key={col.id} className="p-2 text-center text-[#00288e]">
                                              {targetEmp.items.reduce((s, it) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0)} un
                                            </td>
                                          ))}
                                          <td className="p-2 text-center text-[#00288e]">
                                            {targetEmp.items.reduce((sum, it) => sum + cronogramaColunas.reduce((s, col) => s + (Number(cronogramaDistribuicao[it.id]?.[col.id]) || 0), 0), 0)}
                                          </td>
                                          <td className="p-2 text-right text-[#00288e]">
                                            R$ {totalProgramadoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>

                                  {/* Instructions in Preview */}
                                  <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 text-xs space-y-1.5">
                                    <p><strong>Local de Entrega:</strong> {cronogramaLocalEntrega}</p>
                                    <p><strong>Horário de Recebimento:</strong> {cronogramaHorarioEntrega}</p>
                                    <p className="whitespace-pre-line"><strong>Observações:</strong> {cronogramaObservacoes}</p>
                                  </div>

                                  {/* Signatures in Preview */}
                                  <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-200 text-center text-xs">
                                    <div className="space-y-1">
                                      <div className="w-48 h-[1px] bg-gray-400 mx-auto mb-2" />
                                      <p className="font-bold text-gray-900">{cronogramaResponsavelNome || 'Encarregado do Aprovisionamento'}</p>
                                      <p className="text-[10px] text-gray-500">{cronogramaResponsavelCargo}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="w-48 h-[1px] bg-gray-400 mx-auto mb-2" />
                                      <p className="font-bold text-gray-900">DE ACORDO / CIÊNCIA DO FORNECEDOR</p>
                                      <p className="text-[10px] text-gray-500">{targetEmp.supplier}</p>
                                    </div>
                                  </div>

                                </div>
                              </div>

                              {/* Modal Footer */}
                              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                  onClick={() => setShowCronogramaPreviewModal(false)}
                                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-all cursor-pointer"
                                >
                                  Fechar
                                </button>
                                <button
                                  onClick={() => {
                                    setShowCronogramaPreviewModal(false);
                                    handleGenerateCronogramaPDF(targetEmp, 'print');
                                  }}
                                  className="px-4 py-2 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#001e6a] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <Printer className="w-4 h-4" /> Imprimir Documento Oficial
                                </button>
                              </div>
                            </motion.div>
                          </div>
                        )}
                      </AnimatePresence>

                    </div>
                  );
                })()
              )}

            </div>
          );
}
