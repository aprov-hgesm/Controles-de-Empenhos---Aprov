'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardCheck, RefreshCw } from 'lucide-react';

import {
  listWarehouseInventoryItems,
  listWarehouseInventorySessions,
  type WarehouseInventoryItemRecord,
  type WarehouseInventorySessionRecord,
} from '../../../lib/warehouse/inventoryRepository';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseInventoryScope } from '../../../lib/warehouse/inventory';

function scopeLabel(scope: WarehouseInventoryScope): string {
  if (scope.kind === 'TOTAL') return 'Inventário total';
  if (scope.kind === 'DEPOT') return 'Depósito · ' + scope.depotId;
  if (scope.kind === 'LOCATION') return 'Local · ' + scope.locationId;
  return 'Subposição · ' + scope.subpositionId;
}

function statusClass(status: string): string {
  if (status === 'CONFIRMED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-600';
  if (status === 'RECONCILIATION_REQUIRED') return 'bg-rose-50 text-rose-700';
  if (status === 'REVIEW' || status === 'CONFIRMING') return 'bg-amber-50 text-amber-800';
  return 'bg-blue-50 text-[#00288e]';
}

function dateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? value
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(parsed));
}

export function WarehouseInventoryHistoryReport({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [sessions, setSessions] = useState<WarehouseInventorySessionRecord[]>([]);
  const [materials, setMaterials] = useState<WarehouseMaterial[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<WarehouseInventoryItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [nextSessions, nextMaterials] = await Promise.all([
        listWarehouseInventorySessions(workspaceId, 60),
        listWarehouseMaterials(workspaceId, 500),
      ]);
      setSessions(nextSessions);
      setMaterials(nextMaterials);
      if (selectedId && !nextSessions.some((item) => item.session.id === selectedId)) {
        setSelectedId(null);
        setItems([]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o histórico de inventários.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedId, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials]
  );

  const toggleSession = async (record: WarehouseInventorySessionRecord) => {
    if (selectedId === record.session.id) {
      setSelectedId(null);
      setItems([]);
      return;
    }

    setSelectedId(record.session.id);
    setItems([]);
    setItemsLoading(true);
    setMessage(null);
    try {
      setItems(await listWarehouseInventoryItems(workspaceId, record.session.id, 500));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os itens deste inventário.'
      );
    } finally {
      setItemsLoading(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="warehouse-inventory-history-report">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <ClipboardCheck className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Histórico de inventários
              </p>
            </div>
            <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-600">
              Consulta somente leitura das sessões já abertas. Contagem, revisão e ajustes
              permanecem exclusivamente na subaba Inventário do Controle de Itens.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-[#00288e] hover:bg-blue-50 disabled:opacity-50"
            aria-label="Atualizar histórico de inventários"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[940px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="p-3">Escopo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Itens</th>
                <th className="p-3">Divergências</th>
                <th className="p-3">Ajustados</th>
                <th className="p-3">Abertura</th>
                <th className="p-3">Confirmação</th>
                <th className="p-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((record) => (
                <tr key={record.session.id}>
                  <td className="p-3">
                    <p className="font-bold text-slate-800">{scopeLabel(record.session.scope)}</p>
                    <p className="mt-1 font-mono text-[9px] text-slate-400">{record.session.id}</p>
                  </td>
                  <td className="p-3">
                    <span className={'rounded-lg px-2 py-1 text-[9px] font-black ' + statusClass(record.session.status)}>
                      {record.session.status}
                    </span>
                  </td>
                  <td className="p-3 font-black text-slate-800">{record.session.itemCount}</td>
                  <td className="p-3 font-black text-amber-700">{record.session.reviewSummary?.divergentItems ?? '—'}</td>
                  <td className="p-3 font-black text-emerald-700">{record.session.reviewSummary?.adjustedItems ?? '—'}</td>
                  <td className="p-3 text-slate-500">{dateTime(record.createdAt)}</td>
                  <td className="p-3 text-slate-500">{dateTime(record.confirmedAt)}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => void toggleSession(record)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#00288e] hover:bg-blue-50"
                    >
                      {selectedId === record.session.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {selectedId === record.session.id ? 'Fechar' : 'Itens'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && sessions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-sm text-slate-400">
                    Nenhuma sessão de inventário registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedId && (
          <div className="border-t border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#00288e]">
              Itens do inventário selecionado
            </p>
            {itemsLoading ? (
              <p className="mt-3 text-xs text-slate-500">Carregando itens…</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-[780px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="p-3">Material</th>
                      <th className="p-3">Esperado</th>
                      <th className="p-3">Contado</th>
                      <th className="p-3">Diferença</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((record) => {
                      const material = materialById.get(record.item.materialId);
                      return (
                        <tr key={record.item.id}>
                          <td className="p-3">
                            <p className="font-bold text-slate-800">{material?.description || record.item.materialId}</p>
                            <p className="mt-1 font-mono text-[9px] text-slate-400">{record.item.locationBalanceId}</p>
                          </td>
                          <td className="p-3 font-black text-slate-700">{record.item.expectedQuantity.toLocaleString('pt-BR')}</td>
                          <td className="p-3 font-black text-slate-700">{record.item.countedQuantity == null ? '—' : record.item.countedQuantity.toLocaleString('pt-BR')}</td>
                          <td className="p-3 font-black text-slate-700">{record.item.difference == null ? '—' : record.item.difference.toLocaleString('pt-BR')}</td>
                          <td className="p-3"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-700">{record.item.status}</span></td>
                        </tr>
                      );
                    })}
                    {!items.length && (
                      <tr>
                        <td colSpan={5} className="p-5 text-center text-xs text-slate-400">
                          Nenhum item disponível nesta sessão.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
