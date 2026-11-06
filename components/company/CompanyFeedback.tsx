'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, Check, Clock3, SearchX } from 'lucide-react';
import type { CompanySectionGroup } from '../../features/company/shell/navigation';

export function CompanyStatus() {
  return <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"><Clock3 size={13} aria-hidden="true"/>Em preparação</span>;
}
export function CompanyEmptyState({ title = 'Nenhum resultado encontrado', description = 'Tente outra busca ou categoria.' }: { title?: string; description?: string }) {
  return <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
    <SearchX size={26} className="mx-auto text-slate-400" aria-hidden="true" />
    <h2 className="mt-3 font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-600">{description}</p>
  </div>;
}
export function CompanyLoadingState({ label = 'Validando informações...' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm">
    <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700 motion-reduce:animate-none"/>{label}
  </div>;
}
export function CompanyErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
    <p className="flex items-center gap-2 font-bold"><AlertCircle size={18} aria-hidden="true"/>Não foi possível continuar</p>
    <p className="mt-2 text-sm">{message}</p>
    {onRetry && <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold underline focus-visible:outline-2 focus-visible:outline-blue-700">Tentar novamente</button>}
  </div>;
}
export function CompanyFeedback({ children }: { children: ReactNode }) {
  return <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><Check size={18} aria-hidden="true"/>{children}</div>;
}
export function CompanyConfirmDialog({ open, title, description, onCancel, onConfirm }: { open: boolean; title: string; description: string; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [open, onCancel]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4">
    <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="company-confirm-title" aria-describedby="company-confirm-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h2 id="company-confirm-title" className="text-lg font-bold">{title}</h2><p id="company-confirm-description" className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button ref={cancelRef} onClick={onCancel} type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Cancelar</button>
        <button onClick={onConfirm} type="button" className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Confirmar</button>
      </div>
    </div>
  </div>;
}

export function CompanySearchFilters({ query, onQueryChange, group, onGroupChange }: { query: string; onQueryChange: (value: string) => void; group: CompanySectionGroup | 'Todos'; onGroupChange: (value: CompanySectionGroup | 'Todos') => void }) {
  return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
    <label className="text-xs font-semibold text-slate-600">Buscar módulos
      <input type="search" value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Nome ou descrição" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600"/>
    </label>
    <label className="text-xs font-semibold text-slate-600">Categoria
      <select value={group} onChange={(e) => onGroupChange(e.target.value as CompanySectionGroup | 'Todos')} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        <option value="Todos">Todas</option><option value="Operação">Operação</option><option value="Relacionamento">Relacionamento</option><option value="Gestão">Gestão</option>
      </select>
    </label>
  </div>;
}
