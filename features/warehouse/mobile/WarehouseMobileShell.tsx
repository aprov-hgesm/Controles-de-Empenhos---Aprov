'use client';

import { ArrowLeft, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import type { SectorWorkspaceContext } from '../../../lib/workspaceContext';

export function WarehouseMobileShell({
  children,
  workspaceContext,
}: {
  children: ReactNode;
  workspaceContext: SectorWorkspaceContext;
}) {
  const pathname = usePathname();
  const isOperatorHome = pathname === '/operador-movel' || pathname === '/operador-movel/';

  return (
    <div
      className="min-h-dvh bg-slate-100 text-slate-950"
      data-testid="warehouse-mobile-shell"
    >
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/94 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-[#00288e]/70">
              EMPROVEX · CENTRAL DE DEPÓSITOS
            </p>
            <p className="truncate text-base font-black tracking-tight text-slate-950">
              Operador Móvel
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-right">
            <p className="font-mono text-[8px] font-black uppercase tracking-[0.16em] text-blue-700/70">
              UG
            </p>
            <p className="text-xs font-black text-[#00288e]">
              {workspaceContext.ug || '—'}
            </p>
          </div>
        </div>
      </header>

      <div className="hidden min-h-dvh items-center justify-center px-8 lg:flex">
        <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#00288e]/70">
            Central de Depósitos · versão móvel
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">
            Abra o Operador Móvel em um celular
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            Esta interface é dedicada à operação física no depósito. A Central completa continua disponível no desktop.
          </p>
          <Link
            href="/central-depositos"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#00288e] px-5 text-sm font-black text-white"
          >
            Ir para a Central de Depósitos
          </Link>
        </div>
      </div>

      <main className={`mx-auto w-full max-w-xl px-4 pt-5 lg:hidden ${isOperatorHome ? 'pb-8' : 'pb-28'}`}>
        {children}
      </main>

      {!isOperatorHome && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:hidden"
          aria-label="Retorno ao menu do Operador Móvel"
        >
          <div className="mx-auto max-w-xl">
            <Link
              href="/operador-movel"
              className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#00288e] px-4 py-3 text-white shadow-[0_10px_24px_-14px_rgba(0,40,142,0.7)] transition-colors active:bg-[#001b62] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00288e]"
              data-testid="warehouse-mobile-nav-home"
              aria-label="Voltar à lista de operações do Operador Móvel"
            >
              <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-black leading-5">Voltar às operações</span>
                <span className="text-[10px] font-semibold leading-4 text-blue-100">Menu do Operador Móvel</span>
              </span>
              <LayoutGrid className="ml-auto h-5 w-5 shrink-0 text-blue-100" aria-hidden="true" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
