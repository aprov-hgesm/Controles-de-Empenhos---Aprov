'use client';

import { useEffect, useRef } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  DatabaseBackup,
  Headset,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MonitorSmartphone,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import styles from './AdminCommandSidebar.module.css';

export type AdminCommandSectionId =
  | 'overview'
  | 'pending'
  | 'customers'
  | 'finance'
  | 'support'
  | 'workspaces'
  | 'usage'
  | 'sessions'
  | 'backups'
  | 'reports'
  | 'security'
  | 'audit'
  | 'settings';

type NavigationItem = {
  id: AdminCommandSectionId;
  label: string;
  detail: string;
  icon: LucideIcon;
};

type NavigationGroup = {
  heading: string;
  items: NavigationItem[];
};

export const ADMIN_COMMAND_NAVIGATION: NavigationGroup[] = [
  {
    heading: 'Central',
    items: [
      { id: 'overview', label: 'Visão geral', detail: 'Panorama da plataforma', icon: LayoutDashboard },
      { id: 'pending', label: 'Pendências', detail: 'Pontos de atenção', icon: Bell },
    ],
  },
  {
    heading: 'Negócio',
    items: [
      { id: 'customers', label: 'Clientes', detail: 'Diretório e relacionamento', icon: Users },
      { id: 'finance', label: 'Financeiro', detail: 'Assinaturas e ciclos', icon: WalletCards },
      { id: 'support', label: 'Atendimento', detail: 'Solicitações e histórico', icon: Headset },
    ],
  },
  {
    heading: 'Operação',
    items: [
      { id: 'workspaces', label: 'Workspaces', detail: 'Gestão administrativa', icon: Building2 },
      { id: 'usage', label: 'Consumo e cotas', detail: 'Firebase e limites', icon: Activity },
      { id: 'sessions', label: 'Sessões', detail: 'Acessos simultâneos', icon: MonitorSmartphone },
      { id: 'backups', label: 'Backups', detail: 'Recuperação e proteção', icon: DatabaseBackup },
    ],
  },
  {
    heading: 'Inteligência',
    items: [
      { id: 'reports', label: 'Indicadores', detail: 'Análises e evolução', icon: BarChart3 },
    ],
  },
  {
    heading: 'Governança',
    items: [
      { id: 'security', label: 'Segurança', detail: 'Controles de plataforma', icon: LockKeyhole },
      { id: 'audit', label: 'Auditoria', detail: 'Trilha administrativa', icon: ScrollText },
      { id: 'settings', label: 'Configurações', detail: 'Preferências de gestão', icon: Settings2 },
    ],
  },
];

export const ADMIN_COMMAND_IDS = ADMIN_COMMAND_NAVIGATION.flatMap(
  (group) => group.items.map((item) => item.id)
);

interface SidebarProps {
  activeId: AdminCommandSectionId;
  onNavigate: (section: AdminCommandSectionId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AdminCommandSidebar({
  activeId,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const previousMobileOpenRef = useRef(false);

  useEffect(() => {
    if (!mobileOpen) {
      previousMobileOpenRef.current = false;
      return;
    }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = mobileMenuRef.current;
    node?.querySelector<HTMLButtonElement>('button')?.focus();
    previousMobileOpenRef.current = true;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseMobile();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousMobileOpenRef.current) previousFocus?.focus();
    };
  }, [mobileOpen, onCloseMobile]);

  const renderPanel = (isMobile: boolean) => (
    <div
      className={
        'flex h-full min-h-0 flex-col overflow-hidden border-r border-[#284568] '
        + styles.sidebarPanel
        + (isMobile ? ' rounded-r-2xl shadow-[14px_0_60px_rgba(0,5,22,0.6)]' : '')
      }
    >
      <div className={'flex shrink-0 items-center justify-between border-b border-white/[0.09] px-4 py-4 ' + styles.sidebarHeader}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-300/20 bg-blue-400/[0.09] text-blue-200 shadow-[0_0_22px_rgba(37,99,235,0.09)]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black tracking-[0.10em] text-white">ADMINISTRAÇÃO</p>
            <p className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-300/85">
              EMPROVEX Command
            </p>
          </div>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            aria-label="Fechar menu administrativo"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav
        aria-label="Navegação administrativa"
        data-testid="admin2-sidebar-scroll"
        className={'min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 overscroll-contain ' + styles.sidebarScroll}
      >
        {ADMIN_COMMAND_NAVIGATION.map((group) => (
          <div key={group.heading} className="space-y-1.5">
            <p className="px-3 pb-1 font-mono text-[9px] font-bold uppercase tracking-[0.20em] text-[#7994ba]">
              {group.heading}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const selected = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={'admin2-nav-' + item.id}
                  data-active={selected ? 'true' : 'false'}
                  aria-current={selected ? 'page' : undefined}
                  aria-label={item.label}
                  onClick={() => {
                    onNavigate(item.id);
                    if (isMobile) onCloseMobile();
                  }}
                  className={
                    'group relative flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/80 '
                    + (selected
                      ? ' border-blue-300/30 bg-[#153765] text-white shadow-[inset_3px_0_0_#60a5fa,0_6px_20px_rgba(16,67,157,0.13)]'
                      : ' border-transparent text-[#9db1cd] hover:border-white/[0.09] hover:bg-white/[0.07] hover:text-white')
                  }
                >
                  <Icon className={'h-5 w-5 shrink-0 ' + (selected ? 'text-blue-200' : 'text-slate-500 group-hover:text-slate-200')} aria-hidden="true" />
                  <span className="min-w-0 truncate text-[13px] font-semibold">{item.label}</span>
                  {selected && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.09] bg-[#06152c]/85 px-4 py-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#254261] bg-[#0d2341]/75 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-100">Ambiente de prévia</p>
            <p className="mt-0.5 truncate text-[10px] text-[#91a9c9]">Dados demonstrativos</p>
          </div>
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]" aria-label="Prévia disponível" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        data-testid="admin2-sidebar-desktop"
        className="fixed bottom-0 left-0 top-[72px] z-20 hidden w-[288px] lg:block"
        aria-label="Barra lateral da Administração 2.0"
      >
        {renderPanel(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" data-testid="admin2-mobile-menu">
          <button
            type="button"
            className="absolute inset-0 bg-[#010612]/85 backdrop-blur-sm"
            aria-label="Fechar menu administrativo"
            onClick={onCloseMobile}
            tabIndex={-1}
          />
          <div
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu administrativo"
            className="absolute inset-y-0 left-0 w-[min(304px,calc(100vw-48px))] outline-none"
          >
            {renderPanel(true)}
          </div>
        </div>
      )}
    </>
  );
}

export function AdminCommandMobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir barra lateral administrativa"
      data-testid="admin2-mobile-open"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-blue-100 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:hidden"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
