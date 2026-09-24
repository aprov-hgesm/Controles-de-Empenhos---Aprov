'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, RefreshCw } from 'lucide-react';

import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import { listWarehouseMovements, type WarehouseMovementListItem } from '../../../lib/warehouse/ledgerRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';

export function WarehouseMovementsOperational({ workspaceId }: { workspaceId: string }) {
  const [materials, setMaterials] = useState<WarehouseMaterial[]>([]);
  const [movements, setMovements] = useState<WarehouseMovementListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [nextMaterials, nextMovements] = await Promise.all([
        listWarehouseMaterials(workspaceId, 250),
        listWarehouseMovements(workspaceId, 150),
      ]);
      setMaterials(nextMaterials);
      setMovements(nextMovements);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao consultar as movimentações.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials]
  );

  return (
    <div className="mt-6 space-y-4" data-testid="warehouse-movements-operational">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#00288e]">
            <ArrowLeftRight className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.12em]">Histórico de movimentações</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Ledger auditável do ADM Depósito. Consulta bounded dos movimentos mais recentes.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500">
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </div>

      {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{message}</div>}

      {loading && !movements.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Carregando movimentações…</div>
      ) : !movements.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-400">Nenhuma movimentação registrada.</div>
      ) : (
        <div className="space-y-2">
          {movements.map(({ movement, createdAt }) => {
            const material = materialById.get(movement.materialId);
            const source = movement.source;
            const sourceLabel =
              source?.kind === 'INVOICE'
                ? 'NF ' + source.invoiceId + ' · Empenho ' + source.empenhoId
                : source?.kind === 'LOCATION_TRANSFER'
                  ? 'Transferência interna'
                  : source?.kind === 'EXPRESS_OUTBOUND'
                    ? 'Saída expressa'
                    : source?.kind === 'PHYSICAL_INVENTORY'
                      ? 'Inventário físico'
                      : 'Movimento do ledger';

            return (
              <div key={movement.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-[9px] font-black text-[#00288e]">{movement.type}</span>
                    <span className="text-[10px] text-slate-400">{sourceLabel}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-black text-slate-800">{material?.description || movement.materialId}</p>
                  <p className="mt-1 font-mono text-[9px] text-slate-400">{createdAt ? new Date(createdAt).toLocaleString('pt-BR') : 'horário pendente'}</p>
                </div>
                <p className={movement.quantityDelta >= 0 ? 'text-lg font-black text-emerald-600' : 'text-lg font-black text-amber-600'}>
                  {movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
