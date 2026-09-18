'use client';

import {
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Layers,
  LogOut,
  Package,
  TrendingUp,
} from 'lucide-react';

export type AppTab =
  | 'painel'
  | 'empenhos'
  | 'itens'
  | 'nova_nf'
  | 'relatorios'
  | 'itens_empenho'
  | 'cronogramas';

interface AppSidebarProps {
  activeTab: AppTab;
  open: boolean;
  userDisplayName: string;
  onClose: () => void;
  onNavigate: (tab: AppTab) => void;
  onLogout: () => void | Promise<void>;
}

export function AppSidebar({
  activeTab,
  open,
  userDisplayName,
  onClose,
  onNavigate,
  onLogout,
}: AppSidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-white/60 backdrop-blur-md border-r border-white/20 py-6 z-40
          flex flex-col justify-between transition-transform duration-300 ease-out shadow-sm lg:shadow-none
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="space-y-6">
          <div className="mx-4 px-4 py-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/40 shadow-xs">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usuário Conectado</p>
            <p className="font-bold text-sm text-[#0b1c30] truncate mt-0.5">
              {userDisplayName}
            </p>
          </div>

          <nav className="space-y-1.5 px-3">
            <button
              onClick={() => onNavigate('painel')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                activeTab === 'painel'
                  ? 'bg-[#e5eeff] text-[#00288e]'
                  : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
              }`}
            >
              <Layers className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigate('empenhos')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                activeTab === 'empenhos' || activeTab === 'itens_empenho'
                  ? 'bg-[#e5eeff] text-[#00288e]'
                  : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>Empenhos</span>
            </button>

            <button
              onClick={() => onNavigate('itens')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                activeTab === 'itens'
                  ? 'bg-[#e5eeff] text-[#00288e]'
                  : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
              }`}
            >
              <Package className="w-5 h-5" />
              <span>Consulta de Itens</span>
            </button>

            <button
              onClick={() => onNavigate('nova_nf')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                activeTab === 'nova_nf'
                  ? 'bg-[#e5eeff] text-[#00288e]'
                  : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Notas Fiscais</span>
            </button>

            <button
              onClick={() => onNavigate('relatorios')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                activeTab === 'relatorios'
                  ? 'bg-[#e5eeff] text-[#00288e]'
                  : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span>Relatórios</span>
            </button>

            <button
              onClick={() => onNavigate('cronogramas')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                activeTab === 'cronogramas'
                  ? 'bg-[#e5eeff] text-[#00288e]'
                  : 'text-gray-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span>Cronogramas</span>
            </button>
          </nav>
        </div>

        <div className="px-6 border-t border-gray-100 pt-4 space-y-3">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da Conta</span>
          </button>
          <div className="text-[10px] font-semibold text-gray-400">
            v1.2.0 © 2026 Sistema Logístico
          </div>
        </div>
      </aside>
    </>
  );
}
