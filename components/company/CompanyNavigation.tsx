'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart3, Boxes, Building2, CalendarDays, ClipboardList, FileText, Home,
  LogOut, Package, ReceiptText, Settings2, ShoppingCart, Truck, Users, Wallet, X,
} from 'lucide-react';
import { COMPANY_SHELL_MODULES, companyShellHref } from '../../features/company/shell/navigation';

const icons = {
  home: Home, orders: ClipboardList, commitments: FileText, purchases: ShoppingCart,
  suppliers: Users, catalog: Package, schedule: CalendarDays, stock: Boxes,
  deliveries: Truck, invoices: ReceiptText, finance: Wallet,
  customers: Building2, reports: BarChart3, settings: Settings2,
} as const;

export function CompanyNavigation({
  companyName, mobileOpen, onClose, onSignOut, signingOut,
}: {
  companyName: string; mobileOpen: boolean; onClose: () => void;
  onSignOut: () => void; signingOut: boolean;
}) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onClose]);

  return <>
    {mobileOpen && <button type="button" aria-label="Fechar menu empresarial" onClick={onClose}
      className="fixed inset-0 z-30 bg-slate-950/65 lg:hidden" />}
    <aside ref={drawerRef} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined}
      aria-label="Navegação da empresa"
      className={`fixed inset-y-0 left-0 z-40 flex w-[282px] max-w-[88vw] flex-col border-r border-white/10 bg-[#09182f] text-slate-100 shadow-xl transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${mobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible'}`}>
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <img src="/emprovex-logo.png" alt="" aria-hidden="true" className="h-10 w-10 object-contain"/>
        <div className="min-w-0"><p className="font-montserrat text-lg font-extrabold tracking-wide">EMPROVEX</p>
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-blue-300">Empresas</p></div>
        <button ref={closeRef} type="button" aria-label="Fechar navegação" onClick={onClose}
          className="ml-auto rounded-lg p-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 lg:hidden"><X size={19}/></button>
      </div>
      <div className="mx-4 mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="flex items-center gap-2 text-xs text-blue-300"><Building2 size={14} aria-hidden="true"/> Workspace empresarial</p>
        <p className="mt-1 truncate text-sm font-semibold" title={companyName}>{companyName}</p>
      </div>
      <nav aria-label="Módulos empresariais" className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-5">
        {COMPANY_SHELL_MODULES.map((item, index) => {
          const href = companyShellHref(item.slug);
          const active = pathname === href || (pathname === '/empresa/logistica' && item.slug === 'entregas');
          const Icon = icons[item.icon as keyof typeof icons];
          const prev = COMPANY_SHELL_MODULES[index - 1];
          return <div key={item.slug || 'home'}>
            {(index === 0 || prev?.group !== item.group) &&
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.group}</p>}
            <a href={href} onClick={onClose} aria-current={active ? 'page' : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-300 ${active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={18} aria-hidden="true" className="shrink-0"/><span className="truncate">{item.label}</span>
              {item.kind === 'preparing' && <span className="sr-only">— Em preparação</span>}
            </a
          </div>;
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <button type="button" onClick={onSignOut} disabled={signingOut}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300 disabled:opacity-50">
          <LogOut size={17} aria-hidden="true"/>{signingOut ? 'Saindo...' : 'Sair da conta'}
        </button>
      </div>
    </aside>
  </>;
}
