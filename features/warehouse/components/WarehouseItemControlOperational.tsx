'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BellRing,
  Boxes,
  ClipboardCheck,
  Gauge,
  ScanLine,
  Settings2,
  ShieldCheck,
  Truck,
} from 'lucide-react';

import { WarehouseStockOperational } from './WarehouseStockOperational';
import { WarehouseExpressOutbound } from './WarehouseExpressOutbound';
import { WarehouseMovementsOperational } from './WarehouseMovementsOperational';
import { WarehouseInventoryOperational } from './WarehouseInventoryOperational';
import { WarehouseDeliveriesOperational } from './WarehouseDeliveriesOperational';
import { WarehouseLogisticsAlerts } from './WarehouseLogisticsAlerts';
import { WarehouseLogisticsSettings } from './WarehouseLogisticsSettings';
import { WarehouseLogisticsDashboard } from './WarehouseLogisticsDashboard';
import { WarehouseSiscofisOperational } from './WarehouseSiscofisOperational';

type ControlTab =
  | 'summary'
  | 'stock'
  | 'outbound'
  | 'movements'
  | 'inventory'
  | 'deliveries'
  | 'alerts'
  | 'siscofis'
  | 'settings';

const CONTROL_TABS: Array<{ id: ControlTab; label: string; icon: typeof Boxes }> = [
  { id: 'summary', label: 'Resumo logístico', icon: Gauge },
  { id: 'stock', label: 'Estoque', icon: Boxes },
  { id: 'outbound', label: 'Saída de Material', icon: ScanLine },
  { id: 'movements', label: 'Movimentações', icon: Gauge },
  { id: 'inventory', label: 'Inventário', icon: ClipboardCheck },
  { id: 'deliveries', label: 'Entregas', icon: Truck },
  { id: 'alerts', label: 'Alertas', icon: BellRing },
  { id: 'siscofis', label: 'SISCOFIS', icon: ShieldCheck },
  { id: 'settings', label: 'Configurações', icon: Settings2 },
];

function normalizeRequestedTab(value: string | null): ControlTab {
  return CONTROL_TABS.some((item) => item.id === value) ? value as ControlTab : 'stock';
}

export function WarehouseItemControlOperational({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('aba');
  const [tab, setTab] = useState<ControlTab>(() => normalizeRequestedTab(requested));

  useEffect(() => {
    setTab(normalizeRequestedTab(requested));
  }, [requested]);

  return (
    <div className="mt-4 space-y-5" data-testid="warehouse-item-control-operational">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-1">
        {CONTROL_TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              className={active
                ? 'inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-[#00288e] shadow-sm'
                : 'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-700'}>
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'summary' && <WarehouseLogisticsDashboard workspaceId={workspaceId} />}
      {tab === 'stock' && <WarehouseStockOperational workspaceId={workspaceId} />}
      {tab === 'outbound' && <WarehouseExpressOutbound workspaceId={workspaceId} />}
      {tab === 'movements' && <WarehouseMovementsOperational workspaceId={workspaceId} />}
      {tab === 'inventory' && <WarehouseInventoryOperational workspaceId={workspaceId} />}
      {tab === 'deliveries' && <WarehouseDeliveriesOperational workspaceId={workspaceId} />}
      {tab === 'alerts' && <WarehouseLogisticsAlerts workspaceId={workspaceId} />}
      {tab === 'siscofis' && <WarehouseSiscofisOperational workspaceId={workspaceId} />}
      {tab === 'settings' && <WarehouseLogisticsSettings workspaceId={workspaceId} />}
    </div>
  );
}
