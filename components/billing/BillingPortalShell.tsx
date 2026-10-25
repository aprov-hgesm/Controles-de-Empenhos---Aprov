'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowUpRight, CalendarClock, ChevronRight, CreditCard,
  Home, Landmark, Menu, ShieldCheck, WalletCards, X,
} from 'lucide-react';

import { AppShellSignature } from '../layout/chrome/AppShellSignature';

/**
 * A dedicated surface for the /regularizacao route using the EMPROVEX shell
 * proportions and navigation tokens. The operational AppSidebar is NOT mounted
 * twice (it requires home page's operational state).
 */
export function BillingPortalShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);

  const navItem = 'flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

  return (
    <div data-testid="billing-platform-shell" data-hydrated={hydrated ? 'true' : 'false'} className="min-h-screen bg-[#f6f8fc] text-[#142338]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-slate-800 bg-[#06162b] px-4 text-slate-100 shadow-[0_3px_20px_rgba(6,22,43,0.12)] sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            data-testid="billing-mobile-menu"
            className="rounded-lg border border-white/15 p-2 text-slate-200 lg:hidden"
            aria-label="Abrir navegação"
            aria-expanded={drawerOpen}
            aria-controls="billing-portal-sidebar"
            disabled={!hydrated}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-cyan-200">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <span className="truncate font-mono text-xs font-black tracking-[0.19em]">EMPROVEX</span>
          <span className="hidden h-5 w-px bg-white/15 sm:block" />
          <span className="hidden text-xs font-semibold text-slate-300 sm:block">Central de assinaturas</span>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar à plataforma</span>
          <span className="sm:hidden">Voltar</span>
        </Link>
      </header>

      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
          aria-label="Fechar menu lateral"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        id="billing-portal-sidebar"
        aria-label="Navegação da assinatura"
        data-testid="billing-fixed-sidebar"
        className={`emprovex-app-sidebar fixed bottom-0 left-0 top-16 z-40 flex w-72 flex-col justify-between overflow-y-auto border-r border-slate-700/40 bg-[#06162b] py-5 text-slate-100 shadow-xl transition-transform duration-200 ease-out lg:translate-x-0 lg:shadow-none ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <AppShellSignature variant="sidebar" />
        <div className="relative z-[2] flex flex-col gap-7">
          <div className="px-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.20em] text-slate-400">Minha conta</p>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Fechar menu" className="rounded-lg p-1 text-slate-300 lg:hidden">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.055] px-4 py-3">
              <p className="text-xs font-bold text-slate-100">Plano Completo</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Situação comercial vinculada ao seu workspace</p>
            </div>
          </div>

          <nav className="space-y-1 px-3" aria-label="Seções da assinatura">
            <p className="px-3 pb-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Assinatura e pagamentos</p>
            <a href="#visao-geral" onClick={() => setDrawerOpen(false)} aria-current="page"
              className={navItem + ' border border-cyan-300/20 bg-cyan-400/10 text-cyan-100'}>
              <CreditCard className="h-[18px] w-[18px]" />
              <span className="flex-1">Minha assinatura</span>
              <ChevronRight className="h-4 w-4 opacity-75" />
            </a>
            <a href="#historico-financeiro" onClick={() => setDrawerOpen(false)}
              className={navItem + ' text-slate-300 hover:bg-white/[0.07] hover:text-white'}>
              <CalendarClock className="h-[18px] w-[18px]" /> Histórico financeiro
            </a>
            <a href="#precos" onClick={() => setDrawerOpen(false)}
              className={navItem + ' text-slate-300 hover:bg-white/[0.07] hover:text-white'}>
              <Landmark className="h-[18px] w-[18px]" /> Plano e valores
            </a>
            <a href="#formas-pagamento" onClick={() => setDrawerOpen(false)}
              className={navItem + ' text-slate-300 hover:bg-white/[0.07] hover:text-white'}>
              <WalletCards className="h-[18px] w-[18px]" /> Formas de pagamento
            </a>
          </nav>
          <div className="px-3">
            <p className="px-3 pb-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Plataforma</p>
            <Link href="/" className={navItem + ' text-slate-300 hover:bg-white/[0.07] hover:text-white'}>
              <Home className="h-[18px] w-[18px]" /> Voltar ao EMPROVEX
              <ArrowUpRight className="ml-auto h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="relative z-[2] mt-8 border-t border-white/10 px-6 pt-5">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Pagamentos tratados de forma segura
          </div>
        </div>
      </aside>

      <div className="min-w-0 pt-16 lg:pl-72">
        <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1536px] px-4 pb-12 pt-6 sm:px-7 sm:pt-8 xl:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
