'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';

import type { WarehouseInvoiceIntakeQueueRow } from '../../../lib/warehouse/intakeStateRepository';
import {
  applyWarehouseImmediateConsumption,
  createWarehouseDestination,
  listWarehouseDestinations,
  type ApplyWarehouseImmediateConsumptionResult,
} from '../../../lib/warehouse/withdrawalRepository';
import type { WarehouseDestinationListItem } from '../../../lib/warehouse/withdrawal';

function operationStorageKey(workspaceId: string, intakeId: string): string {
  return 'emprovex:warehouse:immediate-consumption:' + workspaceId + ':' + intakeId;
}

function getOrCreateOperationId(workspaceId: string, intakeId: string): string {
  const key = operationStorageKey(workspaceId, intakeId);
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function clearOperationId(workspaceId: string, intakeId: string): void {
  window.sessionStorage.removeItem(operationStorageKey(workspaceId, intakeId));
}

function numberLabel(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function immediateErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const mappings: Array<[string, string]> = [
    ['WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION', 'A pendência foi alterada em outra tela. Nenhuma classificação duplicada foi aplicada; atualize a fila.'],
    ['WAREHOUSE_IMMEDIATE_CONSUMPTION_EXCEEDS_PENDING', 'A quantidade supera o pendente atual.'],
    ['WAREHOUSE_IMMEDIATE_CONSUMPTION_STOCK_MISMATCH', 'A projeção oficial em Sem localização não comporta esta parcela. O item precisa ser reconciliado.'],
    ['WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 'O item exige reconciliação antes do consumo imediato.'],
    ['WAREHOUSE_DESTINATION_INACTIVE', 'O destino selecionado está inativo.'],
    ['WAREHOUSE_IDEMPOTENCY_CONFLICT', 'A tentativa anterior com esta identidade possui conteúdo diferente. Atualize a fila antes de continuar.'],
  ];
  for (const [code, message] of mappings) {
    if (raw.includes(code)) return message;
  }
  return raw || 'Não foi possível confirmar o consumo imediato.';
}

export function WarehouseImmediateConsumptionPanel({
  workspaceId,
  row,
  onClose,
  onSuccess,
}: {
  workspaceId: string;
  row: WarehouseInvoiceIntakeQueueRow;
  onClose: () => void;
  onSuccess: (
    result: ApplyWarehouseImmediateConsumptionResult,
    quantity: number
  ) => Promise<void>;
}) {
  const [destinations, setDestinations] = useState<WarehouseDestinationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(String(row.pendingQuantity));
  const [destinationId, setDestinationId] = useState('');
  const [withdrawnBy, setWithdrawnBy] = useState('');
  const [newDestinationName, setNewDestinationName] = useState('');
  const [operationId, setOperationId] = useState('');

  useEffect(() => {
    let active = true;
    setOperationId(getOrCreateOperationId(workspaceId, row.stateId));
    listWarehouseDestinations(workspaceId, 250)
      .then((items) => {
        if (!active) return;
        setDestinations(items);
        const first = items.find((item) => item.destination.status === 'active');
        if (first) setDestinationId(first.destination.id);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(immediateErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [row.stateId, workspaceId]);

  const numericQuantity = Number(quantity);
  const validQuantity =
    Number.isFinite(numericQuantity)
    && numericQuantity > 0
    && numericQuantity <= row.pendingQuantity + 0.000001;
  const activeDestinations = destinations.filter(
    (item) => item.destination.status === 'active'
  );

  const addDestination = async () => {
    if (!newDestinationName.trim() || working) return;
    setWorking(true);
    setError(null);
    try {
      const destination = await createWarehouseDestination(workspaceId, {
        name: newDestinationName,
      });
      setDestinations((current) =>
        [
          ...current,
          { destination, createdAt: null, updatedAt: null },
        ].sort((a, b) =>
          a.destination.name.localeCompare(b.destination.name, 'pt-BR')
        )
      );
      setDestinationId(destination.id);
      setNewDestinationName('');
    } catch (createError) {
      setError(immediateErrorMessage(createError));
    } finally {
      setWorking(false);
    }
  };

  const confirm = async () => {
    setError(null);
    if (!validQuantity) {
      setError('Informe uma quantidade maior que zero e limitada ao pendente.');
      return;
    }
    if (!destinationId) {
      setError('Selecione um destino.');
      return;
    }
    if (!withdrawnBy.trim()) {
      setError('Informe quem recebeu/retirou o material.');
      return;
    }
    if (!operationId) {
      setError('A identidade da operação ainda não está pronta. Reabra a classificação.');
      return;
    }

    setWorking(true);
    try {
      const result = await applyWarehouseImmediateConsumption(workspaceId, {
        intakeId: row.stateId,
        invoiceRecordKey: row.invoiceRecordKey,
        invoiceId: row.invoiceId,
        empenhoId: row.empenhoId,
        itemId: row.itemId,
        materialId: row.materialId,
        description: row.itemName,
        unitLabel: row.unitLabel,
        supplier: row.supplier,
        receivedQuantity: row.receivedQuantity,
        expectedAllocatedQuantity: row.allocatedQuantity,
        expectedImmediateConsumptionQuantity: row.immediateConsumptionQuantity,
        effectiveStatus: row.status,
        quantity: numericQuantity,
        destinationId,
        withdrawnBy,
        operationId,
      });
      clearOperationId(workspaceId, row.stateId);
      await onSuccess(result, numericQuantity);
    } catch (submitError) {
      setError(immediateErrorMessage(submitError));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-violet-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-violet-100 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.12),transparent_42%),linear-gradient(135deg,#fbf9ff,#ffffff)] px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-violet-700">
              <Sparkles className="h-4 w-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em]">
                Módulo 4 · consumo imediato
              </p>
            </div>
            <h3 className="mt-1 text-lg font-black text-slate-900">
              Classificar consumo imediato
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
              A parcela não será alocada em depósito. O ledger retira a quantidade da
              projeção UNASSIGNED e o intake avança na mesma transação, evitando dupla baixa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">{row.itemName}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              NF {row.invoiceId} · Empenho {row.empenhoId} · {row.supplier}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {[
                ['Recebido', row.receivedQuantity],
                ['Alocado', row.allocatedQuantity],
                ['Consumo imediato', row.immediateConsumptionQuantity],
                ['Pendente', row.pendingQuantity],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-xs font-black text-slate-800">
                    {numberLabel(Number(value))} {row.unitLabel}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-5 text-rose-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Quantidade de consumo imediato
              <input
                type="number"
                min="0.000001"
                max={row.pendingQuantity}
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-400"
              />
              <span className="mt-1 block text-[9px] font-normal normal-case text-slate-400">
                Máximo pendente: {numberLabel(row.pendingQuantity)} {row.unitLabel}
              </span>
            </label>

            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Destino
              <select
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
                disabled={loading}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-400 disabled:opacity-50"
              >
                <option value="">
                  {loading ? 'Carregando…' : 'Selecione um destino'}
                </option>
                {activeDestinations.map(({ destination }) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Recebido / retirado por
              <input
                value={withdrawnBy}
                onChange={(event) => setWithdrawnBy(event.target.value)}
                placeholder="Ex.: Cb João da Silva"
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-400"
              />
            </label>

            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Novo destino
              </p>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={newDestinationName}
                  onChange={(event) => setNewDestinationName(event.target.value)}
                  placeholder="Cadastrar destino"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => void addDestination()}
                  disabled={working || !newDestinationName.trim()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[10px] font-black text-violet-700 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Cadastrar
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-[10px] leading-5 text-slate-600">
            <strong className="text-violet-800">Efeito quantitativo:</strong>{' '}
            consumo imediato soma à classificação do intake e reduz o pendente. A quantidade
            já projetada pela NF em UNASSIGNED é retirada pelo OUTBOUND oficial na mesma
            transação; não haverá alocação física, lote ou segunda saída posterior para o
            mesmo fato.
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={
                working
                || loading
                || !validQuantity
                || !destinationId
                || !withdrawnBy.trim()
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-black text-white disabled:opacity-50"
            >
              {working ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirmar consumo imediato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
