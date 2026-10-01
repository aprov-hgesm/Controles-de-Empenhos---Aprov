'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  Gauge,
  History,
} from 'lucide-react';

import type { WarehouseItemControlCoreTab } from './WarehouseItemControlSummary';

const WarehouseItemControlSummary = dynamic(
  () => import('./WarehouseItemControlSummary').then((module) => module.WarehouseItemControlSummary)
);
const WarehouseStockOperational = dynamic(
  () => import('./WarehouseStockOperational').then((module) => module.WarehouseStockOperational)
);
const WarehouseMovementsOperational = dynamic(
  () => import('./WarehouseMovementsOperational').then((module) => module.WarehouseMovementsOperational)
);
const WarehouseInventoryOperational = dynamic(
  () => import('./WarehouseInventoryOperational').then((module) => module.WarehouseInventoryOperational)
);
const WarehouseLogisticsReports = dynamic(
  () => import('./WarehouseLogisticsReports').then((module) => module.WarehouseLogisticsReports)
);

type ControlTab =
  | 'summary'
  | WarehouseItemControlCoreTab;

const CONTROL_TABS: Array<{
  id: ControlTab;
  label: string;
  icon: typeof Boxes;
  description: string;
}> = [
  {
    id: 'summary',
    label: 'Resumo',
    icon: Gauge,
    description: 'Situação atual dos itens armazenados e principais pendências operacionais.',
  },
  {
    id: 'stock',
    label: 'Estoque',
    icon: Boxes,
    description: 'Saldos, posições físicas, validade, FEFO, códigos de barras e origem documental.',
  },
  {
    id: 'movements',
    label: 'Movimentações',
    icon: History,
    description: 'Histórico auditável do ledger oficial, sem recalcular saldo.',
  },
  {
    id: 'inventory',
    label: 'Inventário',
    icon: ClipboardCheck,
    description: 'Contagem física, divergências e ajustes confirmados de forma auditável.',
  },
  {
    id: 'reports',
    label: 'Relatórios',
    icon: FileSpreadsheet,
    description: 'Consultas derivadas de estoque, saídas, NF, inventários e SISCOFIS.',
  },
];

const LEGACY_TAB_MAP: Record<string, ControlTab> = {
  outbound: 'summary',
  deliveries: 'summary',
  alerts: 'summary',
  siscofis: 'reports',
  settings: 'summary',
};

function normalizeRequestedTab(value: string | null): ControlTab {
  if (!value) return 'summary';
  if (CONTROL_TABS.some((item) => item.id === value)) return value as ControlTab;
  return LEGACY_TAB_MAP[value] || 'summary';
}

export function WarehouseItemControlOperational({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('aba');
  const [tab, setTab] = useState<ControlTab>(() => normalizeRequestedTab(requested));

  useEffect(() => {
    setTab(normalizeRequestedTab(requested));
  }, [requested]);

  const activeTab = useMemo(
    () => CONTROL_TABS.find((item) => item.id === tab) || CONTROL_TABS[0],
    [tab]
  );

  return (
    <div className="mt-4 space-y-5" data-testid="warehouse-item-control-operational">
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]/65">
              ADM Depósito · ciclo do item armazenado
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-900">
              Controle de Materiais
            </h2>
            <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              Acompanhe o material depois da entrada e da alocação física. Esta área concentra
              consulta permanente de estoque, rastreabilidade, inventário e relatórios sem
              duplicar Alocação de Material, Saída de Material, Cronogramas ou configurações administrativas.
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 xl:max-w-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#00288e]/70">
              {activeTab.label}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-slate-600">
              {activeTab.description}
            </p>
          </div>
        </div>
      </section>

      <nav
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-1"
        aria-label="Seções de Controle de Materiais"
      >
        {CONTROL_TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(item.id)}
              className={active
                ? 'inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#00288e] px-3.5 py-2.5 text-xs font-black text-white shadow-sm'
                : 'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-[#00288e]'}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {tab === 'summary' && (
        <WarehouseItemControlSummary
          workspaceId={workspaceId}
          onOpenTab={(nextTab) => setTab(nextTab)}
        />
      )}
      {tab === 'stock' && <WarehouseStockOperational workspaceId={workspaceId} />}
      {tab === 'movements' && <WarehouseMovementsOperational workspaceId={workspaceId} />}
      {tab === 'inventory' && <WarehouseInventoryOperational workspaceId={workspaceId} />}
      {tab === 'reports' && <WarehouseLogisticsReports workspaceId={workspaceId} />}
    </div>
  );
}
