'use client';

import { useEffect, useRef } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
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
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AdminCommandSidebar({
  activeId,
  onNavigate,
  collapsed,
  onToggleCollapsed,
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

  const renderPanel = (compact: boolean, isMobile: boolean) => (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-[#243954]/90 bg-[#071225]/95 shadow-[0_22px_75px_rgba(0,5,22,0.45)] backdrop-blur-xl"
      data-compact={compact && !isMobile ? 'true' : 'false'}
    >
      <div className={'flex shrink-0 items-center border-b border-white/[0.07] ' + (compact && !isMobile ? 'justify-center px-2 py-5' : 'justify-between px-4 py-4')}>
        <div className={'flex min-w-0 items-center ' + (compact && !isMobile ? 'justify-center' : 'gap-3')}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-300/20 bg-blue-400/[0.09] text-blue-200 shadow-[0_0_22px_rgba(37,99,235,0.09)]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          {(!compact || isMobile) && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-black tracking-[0.12em] text-white">EMPROVEX</p>
              <p className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-300/75">
                Command / Admin 2.0
              </p>
            </div>
          )}
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
        className={'min-h-0 flex-1 space-y-4 overflow-y-auto py-4 [scrollbar-color:#304966_transparent] [scrollbar-width:thin] ' + (compact && !isMobile ? 'px-2' : 'px-3')}
      >
        {ADMIN_COMMAND_NAVIGATION.map((group) => (
          <div key={group.heading} className="space-y-1.5">
            {compact && !isMobile ? (
              <div className="mx-auto h-px w-7 bg-white/10" aria-hidden="true" />
            ) : (
              <p className="px-3 pb-1 font-mono text-[9px] font-bold uppercase tracking-[0.20em] text-slate-500">
                {group.heading}
              </p>
            )}
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
                  title={compact && !isMobile ? item.label : undefined}
                  onClick={() => {
                    onNavigate(item.id);
                    if (isMobile) onCloseMobile();
                  }}
                  className={
                    'group relative flex w-full min-h-11 items-center rounded-xl border text-left transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/80 '
                    + (compact && !isMobile ? 'justify-center px-2' : 'gap-3 px-3')
                    + (selected
                      ? ' border-blue-300/25 bg-blue-500/15 text-blue-50 shadow-[inset_3px_0_0_rgba(147,197,253,0.85),0_0_22px_rgba(59,130,246,0.07)]'
                      : ' border-transparent text-slate-400 hover:border-white/[0.09] hover:bg-white/[0.05] hover:text-white')
                  }
                >
                  <Icon className={'h-[18px] w-[18px] shrink-0 ' + (selected ? 'text-blue-200' : 'text-slate-500 group-hover:text-slate-200')} aria-hidden="true" />
                  {(!compact || isMobile) && (
                    <span className="min-w-0 truncate text-[12px] font-semibold">{item.label}</span>
                  )}
                  {selected && (!compact || isMobile) && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={'shrink-0 border-t border-white/[0.07] ' + (compact && !isMobile ? 'px-2 py-3' : 'px-4 py-4')}>
        {compact && !isMobile ? (
          <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06]" title="Modo de demonstração">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-200">Ambiente de prévia</p>
              <p className="mt-1 text-[10px] text-slate-500">Sem dados reais ou operações</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
          </div>
        )}
      </div>

      {!isMobile && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          data-testid="admin2-sidebar-toggle"
          aria-label={compact ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          aria-expanded={!compact}
          className="flex h-11 shrink-0 items-center justify-center gap-2 border-t border-white/[0.07] text-[11px] font-bold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300"
        >
          {compact ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          {!compact && <span>Recolher menu</span>}
        </button>
      )}
    </div>
  );

  return (
    <>
      <aside
        data-testid="admin2-sidebar-desktop"
        className={'hidden shrink-0 transition-[width] duration-300 ease-out lg:sticky lg:top-[88px] lg:block lg:h-[calc(100dvh-112px)] motion-reduce:transition-none '
          + (collapsed ? 'lg:w-[80px]' : 'lg:w-[264px]')}
        aria-label="Barra lateral da Administração 2.0"
      >
        {renderPanel(collapsed, false)}
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
            className="absolute inset-y-3 left-3 w-[min(296px,calc(100vw-24px))] outline-none"
          >
            {renderPanel(false, true)}
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
