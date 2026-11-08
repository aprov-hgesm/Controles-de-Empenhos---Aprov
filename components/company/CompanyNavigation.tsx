'use client';

import { usePathname } from 'next/navigation';
import {
  Building2, CalendarDays, CircleDollarSign, ClipboardList, Home,
  LogOut, PackageCheck, Settings2, ShoppingCart, Truck, Users, X,
} from 'lucide-react';
import { COMPANY_MODULES } from '../../features/company/modules';

const ICONS = [
  Home, ClipboardList, Users, PackageCheck, ShoppingCart,
  CalendarDays, Truck, CircleDollarSign, Settings2,
] as const;

export function CompanyNavigation({
  companyName, mobileOpen, onClose, onSignOut, signingOut,
}: {
  companyName: string;
  mobileOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <button type="button" aria-label="Fechar menu" onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/65 lg:hidden" />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-white/10 bg-[#081529] text-slate-100 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
          <img src="/emprovex-logo.png" alt="Logo EMPROVEX" className="h-10 w-10 object-contain" />
          <div className="min-w-0">
            <p className="font-montserrat text-lg font-extrabold tracking-wide">EMPROVEX</p>
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-blue-300">Empresas</p>
          </div>
          <button type="button" aria-label="Fechar navegação" onClick={onClose} className="ml-auto lg:hidden"><X size={20} /></button>
        </header>

        <div className="mx-4 mt-5 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <p className="flex items-center gap-2 text-xs text-blue-300"><Building2 size={14} /> Workspace empresarial</p>
          <p className="mt-1 truncate text-sm font-semibold" title={companyName}>{companyName}</p>
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-3 pb-5" aria-label="Navegação empresarial">
          {COMPANY_MODULES.map((item, index) => {
            const href = item.slug ? '/empresa/' + item.slug : '/empresa';
            const active = pathname === href;
            const Icon = ICONS[index];
            return (
              <a key={item.slug || 'inicio'} href={href} onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                <Icon size={18} aria-hidden="true" /> {item.label}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button type="button" onClick={onSignOut} disabled={signingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50">
            <LogOut size={18} /> {signingOut ? 'Saindo...' : 'Sair da conta'}
          </button>
        </div>
      </aside>
    </>
  );
}
