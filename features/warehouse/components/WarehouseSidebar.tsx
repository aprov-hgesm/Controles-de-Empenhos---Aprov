'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowLeft,
  Boxes,
  ClipboardPlus,
  LayoutDashboard,
  LogOut,
  Warehouse,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';

import { AppShellSignature } from '../../../components/layout/chrome/AppShellSignature';
import { WAREHOUSE_SECTIONS, type WarehouseSectionId } from '../navigation';

const SECTION_ICONS: Record<WarehouseSectionId, LucideIcon> = {
  overview: LayoutDashboard,
  registration: ClipboardPlus,
  depots: Warehouse,
  control: Boxes,
};

interface WarehouseSidebarProps {
  activeSection: WarehouseSectionId;
  open: boolean;
  userDisplayName: string;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}

export function WarehouseSidebar({
  activeSection,
  open,
  userDisplayName,
  onClose,
  onLogout,
}: WarehouseSidebarProps) {
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
            <p className="mt-0.5 text-[11px] font-bold text-slate-200">ADM Depósito</p>
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

          <nav className="emprovex-sidebar-nav px-3" aria-label="Navegação do ADM Depósito">
            <div className="emprovex-sidebar-nav__label px-4 pb-2 font-mono text-[9px] font-bold uppercase tracking-[0.22em]">
              ADM Depósito
            </div>

            <Link
              href="/"
              className="emprovex-sidebar-nav-item"
              onClick={onClose}
              data-testid="warehouse-back-emprovex"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              <span>Voltar ao EMPROVEX</span>
            </Link>

            <div className="mx-4 my-3 h-px bg-white/[0.06]" aria-hidden="true" />

            {WAREHOUSE_SECTIONS.map((item) => {
              const Icon = SECTION_ICONS[item.id];
              const active = item.id === activeSection;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className="emprovex-sidebar-nav-item"
                  data-active={active ? 'true' : 'false'}
                  aria-current={active ? 'page' : undefined}
                  data-testid={'warehouse-nav-' + item.id}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
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
                  ADM Depósito
                </p>
              </div>
            </div>
            <span className="emprovex-sidebar-system__live-dot" aria-hidden="true" />
          </div>

          <button
            type="button"
            data-testid="warehouse-logout"
            onClick={onLogout}
            className="emprovex-sidebar-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sair da conta</span>
          </button>

          <div className="emprovex-sidebar-system__meta">
            <span>EMPROVEX</span>
            <span aria-hidden="true">•</span>
            <span>ADM Depósito</span>
            <span aria-hidden="true">•</span>
            <span>2026</span>
          </div>
        </footer>
      </aside>
    </>
  );
}
