'use client';

import type { ReactNode } from 'react';

export type WarehouseCroquiMode = 'view' | 'edit';

interface DepotOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export function WarehouseDepotSelector({
  depots,
  value,
  onChange,
}: {
  depots: DepotOption[];
  value: string;
  onChange: (depotId: string) => void;
}) {
  const activeDepots = depots.filter((depot) => depot.status === 'active');

  return (
    <section
      className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"
      data-testid="warehouse-croqui-selector-region"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200/70">
            Meus Depósitos
          </p>
          <h2 className="mt-1 text-lg font-black text-white">Croquis</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Selecione o depósito antes de consultar materiais ou editar a representação visual.
          </p>
        </div>

        <label className="min-w-0">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">
            Depósito atual
          </span>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#08101f] px-3 text-xs font-bold text-slate-200"
            aria-label="Selecionar depósito do croqui"
          >
            {!activeDepots.length && <option value="">Nenhum depósito ativo</option>}
            {activeDepots.map((depot) => (
              <option key={depot.id} value={depot.id}>
                {depot.code} · {depot.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export function WarehouseCroquiModeSwitch({
  mode,
  onChange,
}: {
  mode: WarehouseCroquiMode;
  onChange: (mode: WarehouseCroquiMode) => void;
}) {
  return (
    <div
      className="grid gap-2 rounded-2xl border border-white/[0.07] bg-black/10 p-2 sm:grid-cols-2"
      data-testid="warehouse-croqui-mode-switch"
    >
      <button
        type="button"
        onClick={() => onChange('view')}
        aria-pressed={mode === 'view'}
        className={
          mode === 'view'
            ? 'rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08] px-4 py-3 text-xs font-black text-emerald-100'
            : 'rounded-xl border border-transparent px-4 py-3 text-xs font-bold text-slate-500 hover:border-white/[0.06] hover:text-slate-300'
        }
      >
        Visualizar / Localizar
      </button>
      <button
        type="button"
        data-testid="warehouse-layout-toggle-edit"
        onClick={() => onChange('edit')}
        aria-pressed={mode === 'edit'}
        className={
          mode === 'edit'
            ? 'rounded-xl border border-blue-300/15 bg-blue-400/[0.08] px-4 py-3 text-xs font-black text-blue-100'
            : 'rounded-xl border border-transparent px-4 py-3 text-xs font-bold text-slate-500 hover:border-white/[0.06] hover:text-slate-300'
        }
      >
        Editar Croqui
      </button>
    </div>
  );
}

export function WarehouseCroquiViewMode({ children }: { children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-4" data-testid="warehouse-croqui-view-mode">
      {children}
    </section>
  );
}

export function WarehouseCroquiEditMode({ children }: { children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-4" data-testid="warehouse-croqui-edit-mode">
      {children}
    </section>
  );
}

export function WarehouseCroquiMainRegion({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0" data-testid="warehouse-croqui-main-region">
      {children}
    </div>
  );
}
