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
          emprovex-app-sidebar fixed top-16 left-0 h-[calc(100vh-4rem)] w-72 overflow-y-auto overscroll-contain py-6 z-40
          flex flex-col justify-between transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="relative z-[1] space-y-6">
          <div className="mx-4 px-4 py-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/40 shadow-xs">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usuário Conectado</p>
            <p className="font-bold text-sm text-[#0b1c30] truncate mt-0.5">
              {userDisplayName}
            </p>
          </div>

          <nav className="emprovex-sidebar-nav px-3" aria-label="Navegação principal">
            <div className="emprovex-sidebar-nav__label px-4 pb-2 font-mono text-[9px] font-bold uppercase tracking-[0.22em]">
              Navegação
            </div>

            <button
              onClick={() => onNavigate('painel')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'painel' ? 'true' : 'false'}
              aria-current={activeTab === 'painel' ? 'page' : undefined}
            >
              <Layers className="w-5 h-5" />
              <span>Painel</span>
            </button>

            <button
              onClick={() => onNavigate('empenhos')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'empenhos' || activeTab === 'itens_empenho' ? 'true' : 'false'}
              aria-current={activeTab === 'empenhos' || activeTab === 'itens_empenho' ? 'page' : undefined}
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>Empenhos</span>
            </button>

            <button
              onClick={() => onNavigate('itens')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'itens' ? 'true' : 'false'}
              aria-current={activeTab === 'itens' ? 'page' : undefined}
            >
              <Package className="w-5 h-5" />
              <span>Consulta de Itens</span>
            </button>

            <button
              onClick={() => onNavigate('nova_nf')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'nova_nf' ? 'true' : 'false'}
              aria-current={activeTab === 'nova_nf' ? 'page' : undefined}
            >
              <FileText className="w-5 h-5" />
              <span>Notas Fiscais</span>
            </button>

            <button
              onClick={() => onNavigate('relatorios')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'relatorios' ? 'true' : 'false'}
              aria-current={activeTab === 'relatorios' ? 'page' : undefined}
            >
              <TrendingUp className="w-5 h-5" />
              <span>Relatórios</span>
            </button>

            <button
              onClick={() => onNavigate('cronogramas')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'cronogramas' ? 'true' : 'false'}
              aria-current={activeTab === 'cronogramas' ? 'page' : undefined}
            >
              <CalendarDays className="w-5 h-5" />
              <span>Cronogramas</span>
            </button>
          </nav>
        </div>

        <div className="relative z-[1] px-6 border-t border-white/[0.08] pt-4 space-y-3">
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
