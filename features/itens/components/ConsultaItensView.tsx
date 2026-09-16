'use client';

import React from 'react';
import { EmpenhoDocumentActions } from '../../../components/EmpenhoDocumentActions';
import { ChevronDown, ChevronUp, Info, Package, Search } from 'lucide-react';
import type { Empenho } from '../../../lib/types';

interface ConsultaItensViewContext {
  empenhos: Empenho[];
  expandedConsultaItem: string | null;
  handleEmpenhoDocumentUploaded: (...args: any[]) => any;
  itensSaldoFilter: 'Todos' | 'Com saldo' | 'Sem saldo';
  itensSearch: string;
  setActiveTab: (...args: any[]) => any;
  setExpandedConsultaItem: (...args: any[]) => any;
  setItensSaldoFilter: (...args: any[]) => any;
  setItensSearch: (...args: any[]) => any;
  setSelectedEmpenhoDetailId: (...args: any[]) => any;
  showToast: (...args: any[]) => any;
  user: any;
}

interface ConsultaItensViewProps {
  context: ConsultaItensViewContext;
}
/** Consulta consolidada de itens extraída sem alterar regras de negócio, dados ou persistência. */
export function ConsultaItensView({ context }: ConsultaItensViewProps) {
  const { empenhos, expandedConsultaItem, handleEmpenhoDocumentUploaded, itensSaldoFilter, itensSearch, setActiveTab, setExpandedConsultaItem, setItensSaldoFilter, setItensSearch, setSelectedEmpenhoDetailId, showToast, user } = context;
  return (() => {
            type ItemAssociation = {
              empenhoId: string;
              supplier: string;
              pregao?: string;
              itemId: string;
              quantity: number;
              received: number;
              balance: number;
              unitPrice: number;
              balanceValue: number;
            };

            type ConsolidatedItem = {
              key: string;
              name: string;
              unit: string;
              totalQuantity: number;
              totalReceived: number;
              totalBalance: number;
              totalCommittedValue: number;
              totalReceivedValue: number;
              totalBalanceValue: number;
              associations: ItemAssociation[];
            };

            const normalizeItemName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
            const consolidatedMap = new Map<string, ConsolidatedItem>();

            empenhos.forEach((emp) => {
              emp.items.forEach((item) => {
                const balance = Math.max(0, item.quantity - item.received);
                const key = `${normalizeItemName(item.name)}::${item.unit.trim().toLocaleLowerCase('pt-BR')}`;
                const association: ItemAssociation = {
                  empenhoId: emp.id,
                  supplier: emp.supplier,
                  pregao: emp.pregao,
                  itemId: item.id,
                  quantity: item.quantity,
                  received: item.received,
                  balance,
                  unitPrice: item.unitPrice,
                  balanceValue: balance * item.unitPrice,
                };
                const existing = consolidatedMap.get(key);

                if (existing) {
                  existing.totalQuantity += item.quantity;
                  existing.totalReceived += item.received;
                  existing.totalBalance += balance;
                  existing.totalCommittedValue += item.quantity * item.unitPrice;
                  existing.totalReceivedValue += item.received * item.unitPrice;
                  existing.totalBalanceValue += balance * item.unitPrice;
                  existing.associations.push(association);
                  return;
                }

                consolidatedMap.set(key, {
                  key,
                  name: item.name,
                  unit: item.unit,
                  totalQuantity: item.quantity,
                  totalReceived: item.received,
                  totalBalance: balance,
                  totalCommittedValue: item.quantity * item.unitPrice,
                  totalReceivedValue: item.received * item.unitPrice,
                  totalBalanceValue: balance * item.unitPrice,
                  associations: [association],
                });
              });
            });

            const consolidatedItems = Array.from(consolidatedMap.values()).sort((a, b) =>
              a.name.localeCompare(b.name, 'pt-BR')
            );
            const normalizedSearch = itensSearch.trim().toLocaleLowerCase('pt-BR');
            const filteredItems = consolidatedItems.filter((item) => {
              const matchesBalance = itensSaldoFilter === 'Todos'
                || (itensSaldoFilter === 'Com saldo' && item.totalBalance > 0)
                || (itensSaldoFilter === 'Sem saldo' && item.totalBalance === 0);
              const matchesSearch = !normalizedSearch
                || item.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
                || item.unit.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
                || item.associations.some((association) =>
                  association.empenhoId.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
                  || association.supplier.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
                  || association.pregao?.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
                );

              return matchesBalance && matchesSearch;
            });
            const itemsWithBalance = consolidatedItems.filter((item) => item.totalBalance > 0).length;
            const itemsWithoutBalance = consolidatedItems.length - itemsWithBalance;
            const totalBalanceValue = consolidatedItems.reduce((sum, item) => sum + item.totalBalanceValue, 0);

            return (
              <div id="view-itens" className="w-full max-w-7xl mx-auto space-y-6 pb-24">
                <div className="bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-white/30 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#00288e]/10 flex items-center justify-center text-[#00288e]">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-[#0b1c30]">Consulta de Itens</h2>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">
                        Consulte saldos consolidados, empenhos associados e fornecedores, inclusive itens sem saldo.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Itens distintos</span>
                    <p className="text-2xl font-black text-[#0b1c30] mt-1">{consolidatedItems.length}</p>
                    <p className="text-xs text-gray-500 font-medium mt-1">Descrições e unidades consolidadas</p>
                  </div>
                  <div className="bg-emerald-50/80 backdrop-blur-md p-5 rounded-2xl border border-emerald-200/70 shadow-sm">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Com saldo</span>
                    <p className="text-2xl font-black text-emerald-800 mt-1">{itemsWithBalance}</p>
                    <p className="text-xs text-emerald-700 font-medium mt-1">Disponíveis para novas entregas</p>
                  </div>
                  <div className="bg-gray-50/80 backdrop-blur-md p-5 rounded-2xl border border-gray-200/70 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sem saldo</span>
                    <p className="text-2xl font-black text-gray-700 mt-1">{itemsWithoutBalance}</p>
                    <p className="text-xs text-gray-500 font-medium mt-1">Totalmente recebidos</p>
                  </div>
                  <div className="bg-amber-50/80 backdrop-blur-md p-5 rounded-2xl border border-amber-200/70 shadow-sm">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Saldo financeiro</span>
                    <p className="text-xl font-black text-amber-800 mt-1">
                      R$ {totalBalanceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-amber-700 font-medium mt-1">Somatório dos saldos dos itens</p>
                  </div>
                </div>

                <section className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/30 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="search"
                          value={itensSearch}
                          onChange={(event) => setItensSearch(event.target.value)}
                          placeholder="Pesquisar por item, empenho, pregão ou fornecedor..."
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-[#0b1c30] outline-none focus:border-[#00288e] focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl overflow-x-auto">
                        {(['Todos', 'Com saldo', 'Sem saldo'] as const).map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setItensSaldoFilter(filter)}
                            className={`px-4 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                              itensSaldoFilter === filter
                                ? 'bg-white text-[#00288e] shadow-sm'
                                : 'text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-gray-500">
                        {filteredItems.length} {filteredItems.length === 1 ? 'item encontrado' : 'itens encontrados'}
                      </span>
                      {(itensSearch || itensSaldoFilter !== 'Todos') && (
                        <button
                          type="button"
                          onClick={() => { setItensSearch(''); setItensSaldoFilter('Todos'); }}
                          className="font-bold text-[#00288e] hover:underline"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredItems.length === 0 ? (
                    <div className="p-12 text-center">
                      <Package className="w-11 h-11 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-bold text-gray-600">Nenhum item encontrado.</p>
                      <p className="text-xs text-gray-400 mt-1">Ajuste a pesquisa ou o filtro de saldo.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/90 border-b border-gray-200 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                            <th className="p-3.5 pl-5">Item</th>
                            <th className="p-3.5 text-right">Empenhado</th>
                            <th className="p-3.5 text-right">Recebido</th>
                            <th className="p-3.5 text-right">Saldo</th>
                            <th className="p-3.5">Empenhos associados</th>
                            <th className="p-3.5">Fornecedores</th>
                            <th className="p-3.5 pr-5 text-center">Detalhes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredItems.map((item) => {
                            const isExpanded = expandedConsultaItem === item.key;
                            const suppliers = Array.from(new Set(item.associations.map((association) => association.supplier)));
                            const empenhoIds = Array.from(new Set(item.associations.map((association) => association.empenhoId)));

                            return (
                              <React.Fragment key={item.key}>
                                <tr className={`transition-colors ${isExpanded ? 'bg-blue-50/40' : 'hover:bg-blue-50/20'}`}>
                                  <td className="p-3.5 pl-5 max-w-sm">
                                    <p className="text-sm font-bold text-[#0b1c30] leading-snug">{item.name}</p>
                                    <span className="inline-flex mt-1 px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-extrabold text-gray-600 uppercase">
                                      {item.unit}
                                    </span>
                                  </td>
                                  <td className="p-3.5 text-right whitespace-nowrap">
                                    <p className="text-sm font-black text-gray-700">{item.totalQuantity.toLocaleString('pt-BR')} {item.unit}</p>
                                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                                      R$ {item.totalCommittedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </td>
                                  <td className="p-3.5 text-right whitespace-nowrap">
                                    <p className="text-sm font-black text-emerald-700">{item.totalReceived.toLocaleString('pt-BR')} {item.unit}</p>
                                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                                      R$ {item.totalReceivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </td>
                                  <td className="p-3.5 text-right whitespace-nowrap">
                                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black ${
                                      item.totalBalance > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      {item.totalBalance.toLocaleString('pt-BR')} {item.unit}
                                    </span>
                                    <p className={`text-[10px] font-bold mt-1 ${item.totalBalance > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                                      R$ {item.totalBalanceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </td>
                                  <td className="p-3.5 max-w-[210px]">
                                    <div className="flex flex-wrap gap-1">
                                      {empenhoIds.slice(0, 3).map((empenhoId) => (
                                        <span key={empenhoId} className="px-2 py-0.5 bg-blue-50 text-[#00288e] rounded-md text-[10px] font-extrabold">
                                          {empenhoId}
                                        </span>
                                      ))}
                                      {empenhoIds.length > 3 && (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[10px] font-bold">
                                          +{empenhoIds.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3.5 max-w-[240px]">
                                    <p className="text-xs font-semibold text-gray-700 line-clamp-2">
                                      {suppliers.join(' • ')}
                                    </p>
                                  </td>
                                  <td className="p-3.5 pr-5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedConsultaItem(isExpanded ? null : item.key)}
                                      aria-expanded={isExpanded}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#00288e] hover:bg-blue-50 hover:border-blue-200 transition-all"
                                    >
                                      {isExpanded ? 'Recolher' : 'Ver vínculos'}
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} className="p-0 bg-[#f8faff]">
                                      <div className="p-5 border-y border-blue-100">
                                        <div className="flex items-center gap-2 mb-3">
                                          <Info className="w-4 h-4 text-[#00288e]" />
                                          <h4 className="text-xs font-black text-[#0b1c30] uppercase tracking-wider">
                                            Composição por empenho
                                          </h4>
                                        </div>
                                        <div className="overflow-x-auto rounded-xl border border-blue-100 bg-white">
                                          <table className="w-full min-w-[820px] text-xs">
                                            <thead>
                                              <tr className="bg-blue-50/70 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                                <th className="p-3 text-left">Empenho</th>
                                                <th className="p-3 text-left">Fornecedor</th>
                                                <th className="p-3 text-left">Pregão</th>
                                                <th className="p-3 text-right">Empenhado</th>
                                                <th className="p-3 text-right">Recebido</th>
                                                <th className="p-3 text-right">Saldo</th>
                                                <th className="p-3 text-right">Vlr. unitário</th>
                                                <th className="p-3 text-right">Saldo financeiro</th>
                                                <th className="p-3 text-center">Documento NE</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                              {item.associations.map((association) => (
                                                <tr key={`${association.empenhoId}-${association.itemId}`} className="hover:bg-gray-50">
                                                  <td className="p-3">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setSelectedEmpenhoDetailId(association.empenhoId);
                                                        setActiveTab('empenhos');
                                                      }}
                                                      className="font-black text-[#00288e] hover:underline"
                                                      title="Abrir detalhes do empenho"
                                                    >
                                                      {association.empenhoId}
                                                    </button>
                                                  </td>
                                                  <td className="p-3 font-semibold text-gray-700">{association.supplier}</td>
                                                  <td className="p-3 text-gray-500 font-semibold">{association.pregao || '—'}</td>
                                                  <td className="p-3 text-right font-bold text-gray-700">{association.quantity.toLocaleString('pt-BR')} {item.unit}</td>
                                                  <td className="p-3 text-right font-bold text-emerald-700">{association.received.toLocaleString('pt-BR')} {item.unit}</td>
                                                  <td className={`p-3 text-right font-black ${association.balance > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                                                    {association.balance.toLocaleString('pt-BR')} {item.unit}
                                                  </td>
                                                  <td className="p-3 text-right font-semibold text-gray-600">
                                                    R$ {association.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="p-3 text-right font-black text-[#0b1c30]">
                                                    R$ {association.balanceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="p-3">
                                                    <div className="flex justify-center">
                                                      <EmpenhoDocumentActions
                                                        empenho={empenhos.find((emp) => emp.id === association.empenhoId)}
                                                        user={user}
                                                        variant="compact"
                                                        onDocumentUploaded={handleEmpenhoDocumentUploaded}
                                                        onNotify={showToast}
                                                      />
                                                    </div>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            );
          })();
}
