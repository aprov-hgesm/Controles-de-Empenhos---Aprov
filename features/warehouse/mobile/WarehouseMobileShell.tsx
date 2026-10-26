'use client';

import { ArrowLeft, LayoutGrid, Warehouse } from 'lucide-react';
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
      className="min-h-dvh bg-[linear-gradient(180deg,#f5f8fc_0%,#eef3f9_100%)] text-slate-950"
      data-testid="warehouse-mobile-shell"
    >
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_8px_25px_-24px_rgba(0,28,75,0.35)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[#071f48] text-white shadow-[0_9px_24px_-16px_rgba(0,30,86,0.8)]" aria-hidden="true">
              <Warehouse className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#365783]">
                EMPROVEX · Central de Depósitos
              </p>
              <p className="mt-0.5 truncate text-[17px] font-extrabold leading-5 tracking-[-0.025em] text-[#112541]">
                Operador Móvel
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-[#d9e5f3] bg-[#f4f8fd] px-2.5 py-1.5 text-right" aria-label={'Unidade gestora ' + (workspaceContext.ug || 'não identificada')}>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-[#55739c]">
              UG
            </p>
            <p className="text-[12px] font-extrabold tracking-[-0.01em] text-[#00288e]">
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
          <a
            href="/central-depositos"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#00288e] px-5 text-sm font-black text-white"
          >
            Ir para a Central de Depósitos
          </a
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
            <a
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
            </a
          </div>
        </nav>
      )}
    </div>
  );
}
