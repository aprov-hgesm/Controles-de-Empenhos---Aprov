'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  MapPin,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';

import { listWarehouseInventorySessions } from '../../../lib/warehouse/inventoryRepository';
import { listWarehouseBalances, listWarehouseMovements } from '../../../lib/warehouse/ledgerRepository';
import { listWarehouseLocationBalances } from '../../../lib/warehouse/locationRepository';
import { warehouseLotExpiryState } from '../../../lib/warehouse/lot';
import { listWarehouseLots } from '../../../lib/warehouse/lotRepository';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseInventorySession } from '../../../lib/warehouse/inventory';
import type { WarehouseMovementListItem } from '../../../lib/warehouse/ledgerRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';

export type WarehouseItemControlCoreTab =
  | 'stock'
  | 'movements'
  | 'inventory'
  | 'reports';

type SummaryState = {
  loading: boolean;
  error: string | null;
  materials: WarehouseMaterial[];
  balances: Awaited<ReturnType<typeof listWarehouseBalances>>;
  locationBalances: Awaited<ReturnType<typeof listWarehouseLocationBalances>>;
  lots: Awaited<ReturnType<typeof listWarehouseLots>>;
  inventories: WarehouseInventorySession[];
  movements: WarehouseMovementListItem[];
};

const INITIAL_STATE: SummaryState = {
  loading: true,
  error: null,
  materials: [],
  balances: [],
  locationBalances: [],
  lots: [],
  inventories: [],
  movements: [],
};

function movementLabel(item: WarehouseMovementListItem): string {
  const source = item.movement.source;
  if (source?.kind === 'INVOICE') return 'Entrada por NF ' + source.invoiceId;
  if (source?.kind === 'LOCATION_TRANSFER') return 'Transferência entre posições';
  if (source?.kind === 'EXPRESS_OUTBOUND') return 'Saída de material';
  if (source?.kind === 'PHYSICAL_INVENTORY') return 'Ajuste de inventário';
  return item.movement.type;
}

function MetricButton({
  icon: Icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: typeof Boxes;
  label: string;
  value: string | number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <Icon className="h-4 w-4 text-[#00288e]" />
      </div>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p>
    </button>
  );
}

export function WarehouseItemControlSummary({
  workspaceId,
  onOpenTab,
}: {
  workspaceId: string;
  onOpenTab: (tab: WarehouseItemControlCoreTab) => void;
}) {
  const [state, setState] = useState<SummaryState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [
        materials,
        balances,
        locationBalances,
        lots,
        inventories,
        movements,
      ] = await Promise.all([
        listWarehouseMaterials(workspaceId, 250),
        listWarehouseBalances(workspaceId, 250),
        listWarehouseLocationBalances(workspaceId, 500),
        listWarehouseLots(workspaceId, 500),
        listWarehouseInventorySessions(workspaceId, 24),
        listWarehouseMovements(workspaceId, 40),
      ]);

      setState({
        loading: false,
        error: null,
        materials,
        balances,
        locationBalances,
        lots,
        inventories: inventories.map((item) => item.session),
        movements,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Falha ao carregar o resumo de Controle de Itens.',
      }));
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const materialById = useMemo(
    () => new Map(state.materials.map((material) => [material.id, material])),
    [state.materials]
  );

  const metrics = useMemo(() => {
    const materialsWithStock = state.balances.filter((balance) => balance.quantity > 0).length;

    const unassignedMaterialIds = new Set(
      state.locationBalances
        .filter((item) =>
          item.balance.quantity > 0
          && item.balance.position.kind === 'UNASSIGNED'
        )
        .map((item) => item.balance.materialId)
    );

    let expiredLots = 0;
    let nearExpiryLots = 0;
    for (const item of state.lots) {
      const status = warehouseLotExpiryState(item.lot);
      if (status === 'EXPIRED') expiredLots += 1;
      if (status === 'NEAR_EXPIRY') nearExpiryLots += 1;
    }

    const openInventories = state.inventories.filter((session) =>
      !['CONFIRMED', 'CANCELLED'].includes(session.status)
    ).length;

    return {
      materialsWithStock,
      unassigned: unassignedMaterialIds.size,
      expiredLots,
      nearExpiryLots,
      openInventories,
    };
  }, [state.balances, state.inventories, state.locationBalances, state.lots]);

  return (
    <div className="space-y-5" data-testid="warehouse-item-control-summary">
      <section className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#00288e]">
            <Boxes className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.14em]">
              Situação atual dos itens
            </p>
          </div>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-600">
            Consulta consolidada do estoque já incorporado ao ADM Depósito. Esta superfície
            não cadastra NF, não aloca material e não executa saída: ela acompanha saldo,
            posição física, lotes, movimentações, inventários e relatórios derivados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={state.loading}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-[#00288e] hover:bg-blue-50 disabled:opacity-50"
          aria-label="Atualizar resumo de Controle de Itens"
        >
          <RefreshCw className={state.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </section>

      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {state.error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricButton
          icon={Boxes}
          label="Materiais com saldo"
          value={state.loading ? '…' : metrics.materialsWithStock}
          detail="Saldo agregado positivo no estoque oficial."
          onClick={() => onOpenTab('stock')}
        />
        <MetricButton
          icon={MapPin}
          label="Sem posição física"
          value={state.loading ? '…' : metrics.unassigned}
          detail="Materiais ainda com quantidade em UNASSIGNED."
          onClick={() => onOpenTab('stock')}
        />
        <MetricButton
          icon={TriangleAlert}
          label="Lotes vencidos"
          value={state.loading ? '…' : metrics.expiredLots}
          detail="Lotes ativos com quantidade positiva e validade vencida."
          onClick={() => onOpenTab('stock')}
        />
        <MetricButton
          icon={TriangleAlert}
          label="Próximos do vencimento"
          value={state.loading ? '…' : metrics.nearExpiryLots}
          detail="Janela oficial de alerta de validade do ADM."
          onClick={() => onOpenTab('stock')}
        />
        <MetricButton
          icon={ClipboardCheck}
          label="Inventários em andamento"
          value={state.loading ? '…' : metrics.openInventories}
          detail="Sessões ainda não confirmadas nem canceladas."
          onClick={() => onOpenTab('inventory')}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[#00288e]">
                <History className="h-4 w-4" />
                <p className="text-xs font-black uppercase tracking-[0.12em]">
                  Movimentações recentes
                </p>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Últimos registros bounded do ledger oficial.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenTab('movements')}
              className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-black text-[#00288e]"
            >
              Ver histórico
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {state.movements.slice(0, 6).map((item) => {
              const material = materialById.get(item.movement.materialId);
              return (
                <div
                  key={item.movement.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-800">
                      {material?.description || item.movement.materialId}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {movementLabel(item)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={item.movement.quantityDelta >= 0
                      ? 'text-xs font-black text-emerald-700'
                      : 'text-xs font-black text-amber-700'}
                    >
                      {item.movement.quantityDelta > 0 ? '+' : ''}
                      {item.movement.quantityDelta.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>
              );
            })}
            {!state.loading && state.movements.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-400">
                Nenhuma movimentação registrada.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[#00288e]">
            <FileSpreadsheet className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.12em]">
              Consultas e relatórios
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Estoque, saídas/consumo, movimentações por NF, inventários e histórico
            SISCOFIS permanecem derivados das fontes oficiais, sem criar saldo paralelo.
          </p>
          <button
            type="button"
            onClick={() => onOpenTab('reports')}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm hover:bg-[#001f6f]"
          >
            Abrir relatórios
          </button>
        </div>
      </section>
    </div>
  );
}
