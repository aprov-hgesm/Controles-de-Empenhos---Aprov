'use client';

import { ArrowLeft, House } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { SectorWorkspaceContext } from '../../../lib/workspaceContext';

export function WarehouseMobileShell({
  children,
  workspaceContext,
}: {
  children: ReactNode;
  workspaceContext: SectorWorkspaceContext;
}) {
  return (
    <div
      className="min-h-dvh bg-slate-100 text-slate-950"
      data-testid="warehouse-mobile-shell"
    >
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/94 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-[#00288e]/70">
              EMPROVEX
            </p>
            <p className="truncate text-base font-black tracking-tight text-slate-950">
              Central Móvel
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
            Superfície móvel
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">
            Abra a Central Móvel em um celular
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            Esta interface é dedicada à operação física no depósito. A Central completa continua disponível no desktop.
          </p>
          <Link
            href="/adm-deposito"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#00288e] px-5 text-sm font-black text-white"
          >
            Ir para a Central de Depósitos
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl px-4 pb-28 pt-5 lg:hidden">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/96 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
        aria-label="Navegação da Central Móvel"
      >
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
          <Link
            href="/central-mobile"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-blue-50 text-sm font-black text-[#00288e]"
            data-testid="warehouse-mobile-nav-home"
          >
            <House className="h-5 w-5" aria-hidden="true" />
            Início
          </Link>
          <Link
            href="/adm-deposito"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-black text-slate-600"
            data-testid="warehouse-mobile-nav-desktop"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Central
          </Link>
        </div>
      </nav>
    </div>
  );
}
