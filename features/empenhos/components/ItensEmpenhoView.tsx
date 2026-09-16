'use client';

import React from 'react';
import { ArrowLeft, Info, Package, Plus, Save, Trash2 } from 'lucide-react';
import type { Empenho } from '../../../lib/types';

interface ItensEmpenhoViewContext {
  editingEmpenhoId: string;
  empenhos: Empenho[];
  handleAddItemToEmpenho: (...args: any[]) => any;
  handleDeleteItemFromEmpenho: (...args: any[]) => any;
  handleFinishEmpenhoRegistry: (...args: any[]) => any;
  newItemForm: { id: string; name: string; unit: string; quantity: string; unitPrice: string };
  setActiveTab: (...args: any[]) => any;
  setEmpenhoToDelete: (...args: any[]) => any;
  setNewItemForm: (...args: any[]) => any;
}

interface ItensEmpenhoViewProps {
  context: ItensEmpenhoViewContext;
}
/** Gerenciamento físico dos itens de um empenho, extraído sem alterar regras de negócio ou persistência. */
export function ItensEmpenhoView({ context }: ItensEmpenhoViewProps) {
  const { editingEmpenhoId, empenhos, handleAddItemToEmpenho, handleDeleteItemFromEmpenho, handleFinishEmpenhoRegistry, newItemForm, setActiveTab, setEmpenhoToDelete, setNewItemForm } = context;
  return (
            <div className="space-y-6">
              
              {/* Screen Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveTab('empenhos')}
                    className="p-1.5 hover:bg-blue-50 text-[#00288e] rounded-lg transition-all"
                    title="Voltar para a lista de empenhos"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Itens do Empenho</h2>
                      <span className="px-2.5 py-0.5 bg-blue-100 text-[#00288e] font-extrabold text-xs rounded-full">
                        {editingEmpenhoId}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Controle e cadastro físico de itens para a dotação: {editingEmpenhoId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setEmpenhoToDelete(editingEmpenhoId)}
                    className="px-4 h-11 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm cursor-pointer"
                    title="Excluir este empenho do sistema"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Empenho
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Add Item Form (lg:col-span-5) */}
                <section className="lg:col-span-5 flex flex-col gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wider">Adicionar Novo Item</h3>
                    
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Nº Item</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={newItemForm.id}
                          className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 h-11 font-bold text-sm text-gray-500 outline-none text-center"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Unidade de Medida</label>
                        <select 
                          value={newItemForm.unit}
                          onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 bg-white h-11 px-3 text-sm font-bold text-[#0b1c30] outline-none"
                        >
                          <option value="kg">Quilograma (kg)</option>
                          <option value="un">Unidade (un)</option>
                          <option value="fardo">Fardo (fardo)</option>
                          <option value="cx">Caixa (cx)</option>
                          <option value="lt">Litro (lt)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descrição do Item</label>
                      <textarea 
                        placeholder="Ex: Legume processado, tipo mandioca..."
                        value={newItemForm.name}
                        onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 focus:border-[#00288e] p-3 text-sm font-semibold text-[#0b1c30] outline-none min-h-[80px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Qtd Empenhada</label>
                        <input 
                          type="number" 
                          placeholder="0,00"
                          value={newItemForm.quantity}
                          onChange={(e) => setNewItemForm({ ...newItemForm, quantity: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 focus:border-[#00288e] px-3 h-12 text-sm font-bold text-[#0b1c30]"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Valor Unitário (R$)</label>
                        <input 
                          type="number" 
                          placeholder="0,00"
                          value={newItemForm.unitPrice}
                          onChange={(e) => setNewItemForm({ ...newItemForm, unitPrice: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 focus:border-[#00288e] px-3 h-12 text-sm font-bold text-[#0b1c30]"
                        />
                      </div>
                    </div>

                    {/* Quick multiplication calculation state view */}
                    {(() => {
                      const q = parseFloat(newItemForm.quantity) || 0;
                      const p = parseFloat(newItemForm.unitPrice) || 0;
                      const sub = q * p;
                      return (
                        <div className="bg-[#e5eeff] p-4 rounded-xl flex justify-between items-center border border-blue-100">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total do Item</span>
                          <span className="text-base font-extrabold text-[#00288e]">
                            R$ {sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })()}

                    <button 
                      onClick={handleAddItemToEmpenho}
                      className="w-full h-12 bg-[#00288e] text-white rounded-full font-bold text-sm shadow-md hover:bg-[#1e40af] transition-all flex items-center justify-center gap-1.5 active:scale-95 duration-100"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Item
                    </button>
                  </div>

                  {/* Operational Insight Card banner (as in screenshot 3) */}
                  <div className="bg-[#dde1ff] text-[#001453] p-4 rounded-2xl flex items-start gap-3 shadow-sm border border-blue-100">
                    <Info className="w-5 h-5 text-[#00288e] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">Saldo de Orçamento</p>
                      <p className="text-xs font-medium mt-1 leading-snug">
                        O valor total deste empenho consome 12% da dotação orçamentária vigente para esta categoria de insumos de saúde.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Right Side: Added Items List (lg:col-span-7) */}
                <section className="lg:col-span-7 space-y-4">
                  {(() => {
                    const empObj = empenhos.find(e => e.id === editingEmpenhoId);
                    if (!empObj) return null;

                    const totalCommitted = empObj.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                          <h3 className="font-bold text-sm text-gray-700">Itens Adicionados ({empObj.items.length})</h3>
                          <span className="text-xs text-gray-400 font-semibold">Visualizando dados consolidados</span>
                        </div>

                        {/* List of items */}
                        {empObj.items.length === 0 ? (
                          <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-gray-500">Nenhum item adicionado ainda.</p>
                            <p className="text-xs text-gray-400 mt-1">Preencha o formulário ao lado para compor a dotação.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {empObj.items.map((item, index) => {
                              const total = item.quantity * item.unitPrice;
                              return (
                                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between gap-4 shadow-sm hover:border-[#dde1ff] transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-[#eff4ff] w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-blue-100/50 flex-shrink-0">
                                      <span className="text-[9px] font-bold text-gray-400">Nº</span>
                                      <span className="font-black text-xs text-[#00288e]">{String(index + 1).padStart(3, '0')}</span>
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">{item.name}</h4>
                                      <p className="text-xs text-gray-500 font-semibold mt-0.5">
                                        {item.quantity.toLocaleString('pt-BR')} {item.unit} × R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total</p>
                                      <p className="font-extrabold text-[#0b1c30]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <button 
                                      onClick={() => handleDeleteItemFromEmpenho(item.id)}
                                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Floating bottom save receipt specifically for compiling commitment items */}
                        <footer className="fixed bottom-0 left-0 lg:left-72 right-0 bg-[#e5eeff] border-t border-blue-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
                          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Total do Empenho</span>
                              <span className="text-lg sm:text-xl font-extrabold text-[#00288e]">
                                R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setEmpenhoToDelete(editingEmpenhoId)}
                                className="px-4 h-12 flex items-center justify-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-xs sm:text-sm hover:bg-rose-100 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" /> Excluir Empenho
                              </button>
                              <button 
                                onClick={handleFinishEmpenhoRegistry}
                                className="px-6 h-12 flex items-center justify-center gap-2 bg-[#00288e] text-white rounded-full font-bold text-xs sm:text-sm shadow-md active:scale-95 duration-100 hover:bg-[#1e40af] transition-all cursor-pointer"
                              >
                                <Save className="w-4 h-4" /> Finalizar Cadastro
                              </button>
                            </div>
                          </div>
                        </footer>

                      </div>
                    );
                  })()}
                </section>

              </div>

            </div>
          );
}
