'use client';

import {
  Activity,
  BellRing,
  Boxes,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Home,
  Layers,
  LogOut,
  Package,
  ShieldCheck,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react';

import { AppShellSignature } from './chrome/AppShellSignature';

export type AppTab =
  | 'inicio'
  | 'painel'
  | 'empenhos'
  | 'itens'
  | 'nova_nf'
  | 'relatorios'
  | 'itens_empenho'
  | 'cronogramas'
  | 'avisos';

interface AppSidebarProps {
  activeTab: AppTab;
  open: boolean;
  userDisplayName: string;
  noticeCount?: number;
  onClose: () => void;
  onNavigate: (tab: AppTab) => void;
  onLogout: () => void | Promise<void>;
  warehouseModuleEnabled?: boolean;
  onOpenWarehouse?: () => void;
}

export function AppSidebar({
  activeTab,
  open,
  userDisplayName,
  noticeCount = 0,
  onClose,
  onNavigate,
  onLogout,
  warehouseModuleEnabled = false,
  onOpenWarehouse,
}: AppSidebarProps) {
  return (
    <>
      {open && (
        <div
          className="emprovex-sidebar-backdrop fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Menu principal"
        className={`
          emprovex-app-sidebar fixed top-16 left-0 h-[calc(100vh-4rem)] w-72 overflow-y-auto overscroll-contain py-6 z-40
          flex flex-col justify-between transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <AppShellSignature variant="sidebar" />

        <div className="emprovex-sidebar-mobile-toolbar relative z-[2] lg:hidden">
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-slate-500">
              EMPROVEX
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-200">Menu principal</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="emprovex-sidebar-mobile-close"
            aria-label="Fechar menu principal"
            title="Fechar menu principal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative z-[1] space-y-6">
          <section className="emprovex-sidebar-operator mx-4" aria-label="Operador conectado">
            <div className="emprovex-sidebar-operator__head">
              <div className="emprovex-sidebar-operator__identity">
                <div className="emprovex-sidebar-operator__avatar" aria-hidden="true">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400/75">
                    Operador
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-50">
                    {userDisplayName}
                  </p>
                </div>
              </div>

              <span className="emprovex-sidebar-operator__status-dot" aria-hidden="true" />
            </div>

            <div className="emprovex-sidebar-operator__access">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Acesso autorizado</span>
            </div>
          </section>

          <nav className="emprovex-sidebar-nav px-3" aria-label="Navegação principal">
            <div className="emprovex-sidebar-nav__label px-4 pb-2 font-mono text-[9px] font-bold uppercase tracking-[0.22em]">
              Navegação
            </div>

            <button
              onClick={() => onNavigate('inicio')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'inicio' ? 'true' : 'false'}
              aria-current={activeTab === 'inicio' ? 'page' : undefined}
            >
              <Home className="w-5 h-5" aria-hidden="true" />
              <span>Início</span>
            </button>

            <button
              onClick={() => onNavigate('painel')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'painel' ? 'true' : 'false'}
              aria-current={activeTab === 'painel' ? 'page' : undefined}
            >
              <Layers className="w-5 h-5" aria-hidden="true" />
              <span>Painel</span>
            </button>

            <button
              onClick={() => onNavigate('empenhos')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'empenhos' || activeTab === 'itens_empenho' ? 'true' : 'false'}
              aria-current={activeTab === 'empenhos' || activeTab === 'itens_empenho' ? 'page' : undefined}
            >
              <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
              <span>Empenhos</span>
            </button>

            <button
              onClick={() => onNavigate('itens')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'itens' ? 'true' : 'false'}
              aria-current={activeTab === 'itens' ? 'page' : undefined}
            >
              <Package className="w-5 h-5" aria-hidden="true" />
              <span>Consulta de Itens</span>
            </button>

            <button
              onClick={() => onNavigate('nova_nf')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'nova_nf' ? 'true' : 'false'}
              aria-current={activeTab === 'nova_nf' ? 'page' : undefined}
            >
              <FileText className="w-5 h-5" aria-hidden="true" />
              <span>Notas Fiscais</span>
            </button>

            <button
              data-testid="nav-avisos"
              onClick={() => onNavigate('avisos')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'avisos' ? 'true' : 'false'}
              aria-current={activeTab === 'avisos' ? 'page' : undefined}
            >
              <BellRing className="w-5 h-5" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>Central de Avisos</span>
                {noticeCount > 0 && (
                  <span
                    className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white"
                    aria-label={`${noticeCount} aviso(s) pendente(s)`}
                  >
                    {noticeCount > 99 ? '99+' : noticeCount}
                  </span>
                )}
              </span>
            </button>

            <button
              data-testid="nav-relatorios"
              onClick={() => onNavigate('relatorios')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'relatorios' ? 'true' : 'false'}
              aria-current={activeTab === 'relatorios' ? 'page' : undefined}
            >
              <TrendingUp className="w-5 h-5" aria-hidden="true" />
              <span>Relatórios</span>
            </button>

            <button
              onClick={() => onNavigate('cronogramas')}
              className="emprovex-sidebar-nav-item"
              data-active={activeTab === 'cronogramas' ? 'true' : 'false'}
              aria-current={activeTab === 'cronogramas' ? 'page' : undefined}
            >
              <CalendarDays className="w-5 h-5" aria-hidden="true" />
              <span>Cronogramas</span>
            </button>

            {warehouseModuleEnabled && onOpenWarehouse && (
              <button
                data-testid="nav-adm-deposito"
                onClick={onOpenWarehouse}
                className="emprovex-sidebar-nav-item"
              >
                <Boxes className="w-5 h-5" aria-hidden="true" />
                <span>ADM Depósito</span>
              </button>
            )}
          </nav>
        </div>

        <footer className="emprovex-sidebar-system relative z-[1] mx-4">
          <div className="emprovex-sidebar-system__label font-mono text-[9px] font-bold uppercase tracking-[0.22em]">
            Sistema
          </div>

          <div className="emprovex-sidebar-system__status">
            <div className="flex items-center gap-2.5">
              <span className="emprovex-sidebar-system__status-icon" aria-hidden="true">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-bold text-slate-100">Operacional</p>
                <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  Ambiente seguro
                </p>
              </div>
            </div>
            <span className="emprovex-sidebar-system__live-dot" aria-hidden="true" />
          </div>

          <button
            data-testid="logout"
            onClick={onLogout}
            className="emprovex-sidebar-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sair da conta</span>
          </button>

          <div className="emprovex-sidebar-system__meta">
            <span>EMPROVEX</span>
            <span aria-hidden="true">•</span>
            <span>v1.2.0</span>
            <span aria-hidden="true">•</span>
            <span>2026</span>
          </div>
        </footer>
      </aside>
    </>
  );
}
