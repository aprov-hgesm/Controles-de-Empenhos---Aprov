'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

import {
  listWarehouseSiscofisSnapshots,
  type WarehouseSiscofisSnapshot,
} from '../../../lib/warehouse/siscofisService';

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

export function WarehouseSiscofisHistoryReport({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [snapshots, setSnapshots] = useState<WarehouseSiscofisSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setSnapshots(await listWarehouseSiscofisSnapshots(workspaceId, 24));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o histórico SISCOFIS.'
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4" data-testid="warehouse-siscofis-history-report">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Histórico SISCOFIS
              </p>
            </div>
            <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-600">
              Consulta somente leitura dos Marcos Zero e snapshots já confirmados.
              A migração/importação continua exclusivamente em Alocação de Material,
              evitando duas superfícies para a mesma operação.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-[#00288e] hover:bg-blue-50 disabled:opacity-50"
            aria-label="Atualizar histórico SISCOFIS"
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

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[860px] w-full text-left text-xs">
          <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="p-3">Tipo</th>
              <th className="p-3">Data-base</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Itens</th>
              <th className="p-3">Movimentos</th>
              <th className="p-3">Status</th>
              <th className="p-3">Confirmação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id}>
                <td className="p-3">
                  <span className="rounded-lg bg-blue-50 px-2 py-1 font-black text-[#00288e]">
                    {snapshot.kind === 'MARCO_ZERO' ? 'Marco Zero' : 'Snapshot'}
                  </span>
                </td>
                <td className="p-3 font-bold text-slate-800">
                  {snapshot.referenceDate}
                </td>
                <td className="p-3 text-slate-600">{snapshot.sourceLabel}</td>
                <td className="p-3 font-black text-slate-800">{snapshot.rows.length}</td>
                <td className="p-3 font-black text-slate-800">{snapshot.movementIds.length}</td>
                <td className="p-3">
                  <span className={
                    snapshot.status === 'CONFIRMED'
                      ? 'rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-700'
                      : 'rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-800'
                  }>
                    {snapshot.status}
                  </span>
                </td>
                <td className="p-3 text-slate-500">{dateTime(snapshot.confirmedAt)}</td>
              </tr>
            ))}
            {!loading && snapshots.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm text-slate-400">
                  Nenhum snapshot SISCOFIS registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
