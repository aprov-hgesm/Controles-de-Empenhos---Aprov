'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2, Coins, Filter, Layers, Search, X } from 'lucide-react';
import type { Empenho } from '../../../lib/types';

type DashboardClassFilter = 'TODAS' | 'QR' | 'CALI' | 'PASA';
type ActiveTab = 'painel' | 'empenhos' | 'itens' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas';
type NfSubTab = 'acompanhar' | 'cadastrar' | 'comissao';

interface DashboardViewProps {
  dashboardClassFilter: DashboardClassFilter;
  dashboardPregaoFilter: string;
  dashboardSearch: string;
  empenhos: Empenho[];
  getBalanceByClass: (classification: 'QR' | 'CALI' | 'PASA') => number;
  setActiveTab: Dispatch<SetStateAction<ActiveTab>>;
  setDashboardClassFilter: Dispatch<SetStateAction<DashboardClassFilter>>;
  setDashboardPregaoFilter: Dispatch<SetStateAction<string>>;
  setDashboardSearch: Dispatch<SetStateAction<string>>;
  setEditingEmpenhoId: Dispatch<SetStateAction<string>>;
  setNfSubTab: Dispatch<SetStateAction<NfSubTab>>;
  setSelectedNFCommitmentId: Dispatch<SetStateAction<string>>;
  uniquePregaos: string[];
}

/**
 * Dashboard operacional extraído do page.tsx sem alterar regras, cálculos ou interações.
 * Este componente recebe somente o estado e os callbacks necessários para a tela.
 */
export function DashboardView({
  dashboardClassFilter,
  dashboardPregaoFilter,
  dashboardSearch,
  empenhos,
  getBalanceByClass,
  setActiveTab,
  setDashboardClassFilter,
  setDashboardPregaoFilter,
  setDashboardSearch,
  setEditingEmpenhoId,
  setNfSubTab,
  setSelectedNFCommitmentId,
  uniquePregaos,
}: DashboardViewProps) {
  return (() => {
            // Compute macro totals
            const totalGeralEmpenhado = empenhos.reduce((sum, emp) => {
              return sum + emp.items.reduce((iSum, it) => iSum + it.quantity * it.unitPrice, 0);
            }, 0);

            const totalGeralLiquidado = empenhos.reduce((sum, emp) => {
              return sum + emp.items.reduce((iSum, it) => iSum + it.received * it.unitPrice, 0);
            }, 0);

            const totalGeralSaldo = Math.max(0, totalGeralEmpenhado - totalGeralLiquidado);
            const totalGeralPctExec = totalGeralEmpenhado > 0 ? Math.round((totalGeralLiquidado / totalGeralEmpenhado) * 100) : 0;

            // Class definitions
            const classesConfig: {
              key: 'QR' | 'CALI' | 'PASA';
              name: string;
              description: string;
              borderClass: string;
              badgeBg: string;
              badgeText: string;
              progressColor: string;
              accentText: string;
            }[] = [
              {
                key: 'QR',
                name: 'Classe QR',
                description: 'Quadro de Rancho / Subsistência e Alimentação Geral',
                borderClass: 'border-blue-200',
                badgeBg: 'bg-blue-50',
                badgeText: 'text-blue-800',
                progressColor: 'bg-[#00288e]',
                accentText: 'text-[#00288e]',
              },
              {
                key: 'CALI',
                name: 'Classe CALI',
                description: 'Cálculo de Alimentação / Insumos e Materiais de Apoio',
                borderClass: 'border-amber-200',
                badgeBg: 'bg-amber-50',
                badgeText: 'text-amber-800',
                progressColor: 'bg-amber-600',
                accentText: 'text-amber-700',
              },
              {
                key: 'PASA',
                name: 'Classe PASA',
                description: 'Plano de Apoio / Alimentação e Serviços Especializados',
                borderClass: 'border-emerald-200',
                badgeBg: 'bg-emerald-50',
                badgeText: 'text-emerald-800',
                progressColor: 'bg-emerald-600',
                accentText: 'text-emerald-700',
              },
            ];

            const displayedClasses = dashboardClassFilter === 'TODAS'
              ? classesConfig
              : classesConfig.filter(c => c.key === dashboardClassFilter);

            return (
              <div className="space-y-6">
                
                {/* Header do Painel */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#00288e] flex items-center gap-2.5">
                      <Coins className="w-7 h-7 text-[#00288e]" /> Saldo Restante por Classe
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">
                      Detalhamento financeiro em dinheiro (R$), valor contratado e liquidação por classificação
                    </p>
                  </div>

                  {/* Filtro por Pregão no Header */}
                  <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/40 shadow-2xs">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <label className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Pregão:</label>
                    <select
                      id="dashboard-pregao-select"
                      value={dashboardPregaoFilter}
                      onChange={(e) => setDashboardPregaoFilter(e.target.value)}
                      className="text-xs font-bold text-[#00288e] bg-transparent outline-none cursor-pointer pr-2"
                    >
                      <option value="Todos">Todos os Pregões</option>
                      {uniquePregaos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filtro Rápido de Abas de Classes */}
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200/70 pb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Filtrar Classe:</span>
                  <button
                    id="filter-class-todas"
                    onClick={() => setDashboardClassFilter('TODAS')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      dashboardClassFilter === 'TODAS'
                        ? 'bg-[#00288e] text-white shadow-xs'
                        : 'bg-white/60 text-gray-600 border border-gray-200 hover:bg-white'
                    }`}
                  >
                    Todas as Classes (Consolidado)
                  </button>
                  {classesConfig.map((cls) => {
                    const stats = getBalanceByClass(cls.key);
                    return (
                      <button
                        key={cls.key}
                        id={`filter-class-${cls.key.toLowerCase()}`}
                        onClick={() => setDashboardClassFilter(cls.key)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          dashboardClassFilter === cls.key
                            ? 'bg-[#00288e] text-white shadow-xs'
                            : 'bg-white/60 text-gray-600 border border-gray-200 hover:bg-white'
                        }`}
                      >
                        <span>{cls.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          dashboardClassFilter === cls.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700 font-bold'
                        }`}>
                          R$ {stats.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Resumo Macro Geral (Consolidado em Dinheiro) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Saldo Restante Geral */}
                  <div className="bg-gradient-to-br from-blue-900 to-[#00288e] text-white p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute right-[-10px] bottom-[-15px] opacity-10 text-white select-none pointer-events-none">
                      <Coins className="w-32 h-32" />
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                        Saldo Total Restante
                      </span>
                      <span className="text-xs font-bold text-blue-200">{totalGeralPctExec}% liquidado</span>
                    </div>
                    <div className="mt-3">
                      <p className="text-3xl font-black tracking-tight text-white">
                        R$ {totalGeralSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-blue-200 font-medium mt-0.5">Disponível para faturamento em todas as classes</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/15 flex justify-between text-xs text-blue-100">
                      <span>Total de Empenhos: <strong>{empenhos.length}</strong></span>
                      <span>Ativos: <strong>{empenhos.filter(e => e.status === 'Ativo').length}</strong></span>
                    </div>
                  </div>

                  {/* Total Empenhado Geral */}
                  <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        Total Geral Contratado
                      </span>
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">Empenhado</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-black text-gray-800">
                        R$ {totalGeralEmpenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-400 font-medium">Soma de todos os contratos e pregões</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 font-medium">
                      Base de 100% do orçamento vinculado
                    </div>
                  </div>

                  {/* Total Liquidado Geral */}
                  <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        Total Liquidado / NF-e
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">Recebido</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-black text-emerald-600">
                        R$ {totalGeralLiquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-400 font-medium">Faturamento conciliado via Termo de Recebimento</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {totalGeralPctExec}% do total contratado
                    </div>
                  </div>
                </div>

                {/* Cards de Saldo por Classe (Grandes Destaques) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#00288e]" /> Visão Comparativa por Classe
                    </h3>
                    <span className="text-xs text-gray-400 font-medium">Valores calculados em tempo real</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {classesConfig.map((cls) => {
                      const classEmpenhos = empenhos.filter(emp => (emp.classification || 'QR') === cls.key);
                      const classCommitted = classEmpenhos.reduce((sum, emp) => {
                        return sum + emp.items.reduce((iSum, it) => iSum + it.quantity * it.unitPrice, 0);
                      }, 0);
                      const classReceived = classEmpenhos.reduce((sum, emp) => {
                        return sum + emp.items.reduce((iSum, it) => iSum + it.received * it.unitPrice, 0);
                      }, 0);
                      const classBalance = Math.max(0, classCommitted - classReceived);
                      const classPct = classCommitted > 0 ? Math.round((classReceived / classCommitted) * 100) : 0;
                      const activeCount = classEmpenhos.filter(e => e.status === 'Ativo').length;

                      const isSelected = dashboardClassFilter === cls.key;

                      return (
                        <div 
                          key={cls.key}
                          onClick={() => setDashboardClassFilter(isSelected ? 'TODAS' : cls.key)}
                          className={`bg-white/70 backdrop-blur-md rounded-2xl border p-5 shadow-xs transition-all cursor-pointer hover:shadow-md relative overflow-hidden group ${
                            isSelected ? `${cls.borderClass} ring-2 ring-offset-1 ring-[#00288e]` : 'border-white/40 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${cls.badgeBg} ${cls.badgeText}`}>
                                {cls.name}
                              </span>
                              <span className="text-[10px] text-gray-400 font-semibold">{classEmpenhos.length} NEs</span>
                            </div>
                            <Coins className={`w-4 h-4 ${cls.accentText}`} />
                          </div>

                          {/* Saldo Restante em Destaque */}
                          <div className="mb-4">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Saldo Restante Disponível</span>
                            <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                              R$ {classBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>

                          {/* Métricas Secundárias */}
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 text-xs mb-3">
                            <div>
                              <span className="text-[10px] text-gray-400 font-semibold block uppercase">Empenhado</span>
                              <span className="font-bold text-gray-700">R$ {classCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 font-semibold block uppercase">Liquidado (NF-e)</span>
                              <span className="font-bold text-emerald-600">R$ {classReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          {/* Barra de Progresso Financeiro */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-gray-500">
                              <span>Execução: {classPct}%</span>
                              <span className="text-[10px] text-gray-400">{activeCount} ativos</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${cls.progressColor}`}
                                style={{ width: `${classPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-3 pt-2 text-center">
                            <span className={`text-[10px] font-bold ${cls.accentText} group-hover:underline`}>
                              {isSelected ? 'Mostrando detalhamento abaixo' : 'Clique para filtrar esta classe'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detalhamento Individual dos Empenhos por Classe */}
                <div className="space-y-6 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-lg text-[#00288e] tracking-tight">Detalhamento Financeiro dos Empenhos por Classe</h3>
                      <p className="text-xs text-gray-500 font-medium">Lista analítica com conciliação monetária nota a nota</p>
                    </div>

                    {/* Campo de Busca Rápida */}
                    <div className="relative min-w-[240px]">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        placeholder="Buscar por NE ou Fornecedor..."
                        value={dashboardSearch}
                        onChange={(e) => setDashboardSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] outline-none"
                      />
                      {dashboardSearch && (
                        <button onClick={() => setDashboardSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Itera sobre as classes a exibir */}
                  {displayedClasses.map((cls) => {
                    const rawClassEmpenhos = empenhos.filter(emp => (emp.classification || 'QR') === cls.key);
                    
                    const filteredClassEmpenhos = rawClassEmpenhos.filter(emp => {
                      const matchesPregao = dashboardPregaoFilter === 'Todos' || emp.pregao === dashboardPregaoFilter;
                      const matchesSearch = !dashboardSearch || 
                        emp.id.toLowerCase().includes(dashboardSearch.toLowerCase()) || 
                        emp.supplier.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
                        emp.description.toLowerCase().includes(dashboardSearch.toLowerCase());
                      return matchesPregao && matchesSearch;
                    });

                    const subtotalEmpenhado = filteredClassEmpenhos.reduce((sum, emp) => {
                      return sum + emp.items.reduce((iSum, it) => iSum + it.quantity * it.unitPrice, 0);
                    }, 0);

                    const subtotalLiquidado = filteredClassEmpenhos.reduce((sum, emp) => {
                      return sum + emp.items.reduce((iSum, it) => iSum + it.received * it.unitPrice, 0);
                    }, 0);

                    const subtotalSaldo = Math.max(0, subtotalEmpenhado - subtotalLiquidado);
                    const subtotalPct = subtotalEmpenhado > 0 ? Math.round((subtotalLiquidado / subtotalEmpenhado) * 100) : 0;

                    return (
                      <div 
                        key={cls.key}
                        className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/40 p-5 shadow-xs space-y-4"
                      >
                        {/* Header da Classe */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100 pb-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${cls.badgeBg} ${cls.badgeText}`}>
                              {cls.name}
                            </span>
                            <div>
                              <h4 className="font-bold text-sm text-gray-800">{cls.description}</h4>
                              <p className="text-xs text-gray-400 font-medium">
                                {filteredClassEmpenhos.length} {filteredClassEmpenhos.length === 1 ? 'empenho listado' : 'empenhos listados'}
                              </p>
                            </div>
                          </div>

                          {/* Resumo da Classe no Cabeçalho */}
                          <div className="flex items-center gap-4 bg-gray-50/80 px-3.5 py-1.5 rounded-xl border border-gray-100 text-xs">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Empenhado</span>
                              <span className="font-bold text-gray-700">R$ {subtotalEmpenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="h-6 w-px bg-gray-200" />
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Liquidado</span>
                              <span className="font-bold text-emerald-600">R$ {subtotalLiquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="h-6 w-px bg-gray-200" />
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase block">Saldo Restante</span>
                              <span className={`font-black ${cls.accentText}`}>R$ {subtotalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Tabela de Empenhos da Classe */}
                        {filteredClassEmpenhos.length === 0 ? (
                          <div className="text-center py-6 text-xs text-gray-500 font-medium bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            Nenhum empenho encontrado para {cls.name} com os filtros aplicados.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                            <table className="w-full text-left border-collapse text-xs sm:text-sm">
                              <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[11px] uppercase tracking-wider">
                                  <th className="py-2.5 px-3.5 font-bold">Nota de Empenho</th>
                                  <th className="py-2.5 px-3 font-bold">Fornecedor / Objeto</th>
                                  <th className="py-2.5 px-3 font-bold text-right">Valor Empenhado</th>
                                  <th className="py-2.5 px-3 font-bold text-right">Valor Liquidado</th>
                                  <th className="py-2.5 px-3.5 font-bold text-right">Saldo Restante (R$)</th>
                                  <th className="py-2.5 px-3 font-bold text-center">Execução</th>
                                  <th className="py-2.5 px-3 font-bold text-center">Status</th>
                                  <th className="py-2.5 px-3 font-bold text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {filteredClassEmpenhos.map((emp) => {
                                  const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                                  const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
                                  const balance = Math.max(0, totalCommitted - totalReceived);
                                  const pct = totalCommitted > 0 ? Math.round((totalReceived / totalCommitted) * 100) : 0;

                                  return (
                                    <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                                      {/* NE e Pregão */}
                                      <td className="py-3 px-3.5 whitespace-nowrap">
                                        <span className="font-bold text-[#00288e] block">{emp.id}</span>
                                        <span className="text-[10px] text-gray-400 block font-medium">
                                          {emp.pregao ? `Pregão: ${emp.pregao}` : 'Sem pregão'} • {emp.date}
                                        </span>
                                      </td>

                                      {/* Fornecedor & Objeto */}
                                      <td className="py-3 px-3 max-w-[220px]">
                                        <p className="font-bold text-gray-800 truncate" title={emp.supplier}>{emp.supplier}</p>
                                        <p className="text-[11px] text-gray-500 truncate" title={emp.description}>{emp.description}</p>
                                      </td>

                                      {/* Valor Empenhado */}
                                      <td className="py-3 px-3 text-right font-medium text-gray-700 whitespace-nowrap">
                                        R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>

                                      {/* Valor Liquidado */}
                                      <td className="py-3 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                        R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>

                                      {/* Saldo Restante */}
                                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                        <span className="font-black text-[#00288e] text-sm block">
                                          R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </td>

                                      {/* Execução */}
                                      <td className="py-3 px-3 text-center whitespace-nowrap">
                                        <span className="text-xs font-bold text-gray-700 block">{pct}%</span>
                                        <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden mx-auto mt-0.5">
                                          <div 
                                            className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-[#00288e]'}`}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </td>

                                      {/* Status */}
                                      <td className="py-3 px-3 text-center whitespace-nowrap">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                          emp.status === 'Ativo' ? 'bg-blue-50 text-[#00288e]' :
                                          emp.status === 'Encerrado' ? 'bg-gray-100 text-gray-600' :
                                          'bg-amber-100 text-amber-800'
                                        }`}>
                                          {emp.status}
                                        </span>
                                      </td>

                                      {/* Ações */}
                                      <td className="py-3 px-3 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            id={`btn-view-items-${emp.id}`}
                                            onClick={() => { setEditingEmpenhoId(emp.id); setActiveTab('itens_empenho'); }}
                                            className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 hover:text-[#00288e] hover:border-blue-300 rounded-lg text-xs font-bold transition-all"
                                            title="Ver itens do empenho"
                                          >
                                            Itens
                                          </button>
                                          <button
                                            id={`btn-launch-nf-${emp.id}`}
                                            onClick={() => { setSelectedNFCommitmentId(emp.id); setActiveTab('nova_nf'); setNfSubTab('cadastrar'); }}
                                            className="px-2.5 py-1 bg-[#00288e] text-white hover:bg-[#1e40af] rounded-lg text-xs font-bold transition-all shadow-2xs"
                                            title="Lançar Nota Fiscal"
                                          >
                                            + NF
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              {/* Rodapé da tabela com totais da classe */}
                              <tfoot>
                                <tr className="bg-gray-50/90 font-bold text-xs border-t border-gray-200">
                                  <td colSpan={2} className="py-2.5 px-3.5 text-gray-600">
                                    Subtotal {cls.name} ({filteredClassEmpenhos.length} empenhos)
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-800">
                                    R$ {subtotalEmpenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-emerald-700">
                                    R$ {subtotalLiquidado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-black text-[#00288e] text-sm">
                                    R$ {subtotalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-gray-600">
                                    {subtotalPct}%
                                  </td>
                                  <td colSpan={2} className="py-2.5 px-3 text-right text-[11px] text-gray-400 font-normal">
                                    Saldo disponível em conta
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })();
}
