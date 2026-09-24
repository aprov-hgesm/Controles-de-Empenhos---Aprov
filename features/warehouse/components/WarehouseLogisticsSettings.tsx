'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, SlidersHorizontal } from 'lucide-react';

import {
  getWarehouseLogisticsSettings,
  saveWarehouseLogisticsSettings,
} from '../../../lib/warehouse/logisticsRepository';
import { WAREHOUSE_DELIVERY_WARNING_DAYS } from '../../../lib/warehouse/logistics';
import { WAREHOUSE_EXPIRY_WARNING_DAYS } from '../../../lib/warehouse/lot';

export function WarehouseLogisticsSettings({ workspaceId }: { workspaceId: string }) {
  const [threshold, setThreshold] = useState('');
  const [savedThreshold, setSavedThreshold] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const settings = await getWarehouseLogisticsSettings(workspaceId);
      const value = settings?.lowStockThreshold ?? null;
      setSavedThreshold(value);
      setThreshold(value == null ? '' : String(value));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao ler os parâmetros logísticos.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    const normalized = threshold.trim();
    const value = normalized === '' ? null : Number(normalized.replace(',', '.'));
    if (value != null && (!Number.isFinite(value) || value <= 0)) {
      setMessage('Informe um mínimo positivo ou deixe o campo vazio para desativar a classificação.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const settings = await saveWarehouseLogisticsSettings(workspaceId, value);
      setSavedThreshold(settings.lowStockThreshold);
      setThreshold(settings.lowStockThreshold == null ? '' : String(settings.lowStockThreshold));
      setMessage('Parâmetro logístico salvo. Ele classifica alertas e não altera nenhum saldo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar o parâmetro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5" data-testid="warehouse-logistics-settings">
      <div className="flex items-center gap-2 text-slate-300">
        <SlidersHorizontal className="h-4 w-4" />
        <p className="text-sm font-black">Parâmetros de alertas logísticos</p>
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        O estoque mínimo não possui valor presumido. O parâmetro abaixo é explícito,
        auditável e serve somente para classificação de baixo estoque; jamais modifica
        warehouse balances.
      </p>

      <div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs text-slate-400">
          Estoque mínimo global
          <input
            data-testid="warehouse-low-stock-threshold"
            inputMode="decimal"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            placeholder="Não configurado"
            className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-slate-200 outline-none"
          />
        </label>
        <button
          type="button"
          data-testid="warehouse-logistics-settings-save"
          onClick={() => void save()}
          disabled={saving || loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.08] px-4 text-xs font-bold text-blue-100 disabled:opacity-40"
        >
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.05] px-3 py-2 text-[10px] text-slate-500">
          Baixo estoque: {savedThreshold == null ? 'desativado até configuração' : '≤ ' + savedThreshold}
        </div>
        <div className="rounded-xl border border-white/[0.05] px-3 py-2 text-[10px] text-slate-500">
          Entrega próxima: {WAREHOUSE_DELIVERY_WARNING_DAYS} dias
        </div>
        <div className="rounded-xl border border-white/[0.05] px-3 py-2 text-[10px] text-slate-500">
          Validade próxima: {WAREHOUSE_EXPIRY_WARNING_DAYS} dias (regra canônica da FASE 7)
        </div>
      </div>

      {message && (
        <p className="mt-3 text-xs leading-5 text-slate-400" data-testid="warehouse-logistics-settings-message">
          {message}
        </p>
      )}
    </div>
  );
}
