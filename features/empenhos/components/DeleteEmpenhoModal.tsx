'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Empenho } from '../../../lib/types';

interface DeleteEmpenhoModalProps {
  empenhoToDelete: string | null;
  empenhos: Empenho[];
  isDeletingEmpenho: boolean;
  onCancel: () => void;
  onConfirm: (empenhoId: string) => void;
}

/** Confirmação global de exclusão de empenho, sem responsabilidade de persistência. */
export function DeleteEmpenhoModal({ empenhoToDelete, empenhos, isDeletingEmpenho, onCancel, onConfirm }: DeleteEmpenhoModalProps) {
  return (
    <AnimatePresence>
      {empenhoToDelete && (() => {
        const targetEmp = empenhos.find(e => e.id === empenhoToDelete);
        const totalCommitted = targetEmp ? targetEmp.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) : 0;

        return (
          <div
            id="modal-confirm-delete-empenho-overlay"
            className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-rose-100 max-w-lg w-full overflow-hidden"
            >
              <div className="bg-rose-600 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base tracking-tight">Confirmar Exclusão de Empenho</h3>
                    <p className="text-xs text-rose-100 mt-0.5">Esta ação é permanente e irreversível</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-700 font-medium">
                  Você tem certeza que deseja excluir o empenho abaixo?
                </p>

                <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Número do Empenho:</span>
                    <span className="text-sm font-extrabold text-rose-800">{empenhoToDelete}</span>
                  </div>
                  {targetEmp && (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-semibold">Fornecedor:</span>
                        <span className="font-bold text-gray-800 text-right max-w-[240px] truncate">{targetEmp.supplier}</span>
                      </div>
                      {targetEmp.pregao && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500 font-semibold">Pregão:</span>
                          <span className="font-bold text-gray-800">{targetEmp.pregao}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-semibold">Qtd. de Itens:</span>
                        <span className="font-bold text-gray-800">{targetEmp.items.length} item(ns)</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-2 border-t border-rose-100">
                        <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Valor Total:</span>
                        <span className="font-extrabold text-gray-900">
                          R$ {totalCommitted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Atenção:</strong> Ao confirmar, este empenho e todos os registros e notas associadas a ele serão excluídos permanentemente.
                  </span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isDeletingEmpenho}
                  onClick={onCancel}
                  className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingEmpenho}
                  onClick={() => onConfirm(empenhoToDelete)}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isDeletingEmpenho ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Confirmar Exclusão
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </AnimatePresence>
  );
}
