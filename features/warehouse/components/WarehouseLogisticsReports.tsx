'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, FileSpreadsheet, History, RefreshCw } from 'lucide-react';

import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import { listWarehouseMovementsInPeriod, type WarehouseMovementListItem } from '../../../lib/warehouse/ledgerRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseMovementType } from '../../../lib/warehouse/movement';
import { WAREHOUSE_MOVEMENT_TYPES } from '../../../lib/warehouse/movement';
const WarehouseStockOperational = dynamic(
  () => import('./WarehouseStockOperational').then((module) => module.WarehouseStockOperational)
);
const WarehouseConsumptionReports = dynamic(
  () => import('./WarehouseConsumptionReports').then((module) => module.WarehouseConsumptionReports)
);
const WarehouseInventoryHistoryReport = dynamic(
  () => import('./WarehouseInventoryHistoryReport').then((module) => module.WarehouseInventoryHistoryReport)
);
const WarehouseSiscofisHistoryReport = dynamic(
  () => import('./WarehouseSiscofisHistoryReport').then((module) => module.WarehouseSiscofisHistoryReport)
);

type ReportTab =
  | 'stock'
  | 'outbound'
  | 'immediate'
  | 'ledger'
  | 'inventory'
  | 'siscofis';

const REPORT_TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'stock', label: 'Saldo e validade' },
  { id: 'outbound', label: 'Saídas' },
  { id: 'immediate', label: 'Consumo imediato' },
  { id: 'ledger', label: 'Entradas e movimentos' },
  { id: 'inventory', label: 'Inventários' },
  { id: 'siscofis', label: 'SISCOFIS' },
];

const MOVEMENT_LABELS: Record<WarehouseMovementType, string> = {
  INITIAL_BALANCE: 'Saldo inicial',
  MANUAL_ENTRY: 'Entrada avulsa',
  INVOICE_ENTRY: 'Entrada por nota fiscal',
  OUTBOUND: 'Saída',
  OUTBOUND_RETURN: 'Devolução',
  TRANSFER: 'Transferência',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventário',
  INVOICE_CORRECTION: 'Correção de nota fiscal',
  REVERSAL: 'Estorno',
};

function dateInput(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function csvCell(value: string | number): string {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

function movementSourceLabel(item: WarehouseMovementListItem): string {
  const source = item.movement.source;
  if (source?.kind === 'INVOICE') return 'NF ' + source.invoiceId + ' · ' + source.supplier;
  if (source?.kind === 'MANUAL_ENTRY') return 'Entrada avulsa · ' + source.provenance;
  if (source?.kind === 'LOCATION_TRANSFER') return 'Transferência interna';
  if (source?.kind === 'EXPRESS_OUTBOUND') return 'Saída de material';
  if (source?.kind === 'OUTBOUND_RETURN') return 'Devolução de saída';
  if (source?.kind === 'PHYSICAL_INVENTORY') return 'Inventário físico';
  return 'Ledger';
}

function LedgerAndInvoiceReport({ workspaceId }: { workspaceId: string }) {
  const [materials, setMaterials] = useState<WarehouseMaterial[]>([]);
  const [movements, setMovements] = useState<WarehouseMovementListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => dateInput(30));
  const [endDate, setEndDate] = useState(() => dateInput(0));
  const [typeFilter, setTypeFilter] = useState<'ALL' | WarehouseMovementType>('ALL');
  const [materialFilter, setMaterialFilter] = useState('');
  const [invoiceOnly, setInvoiceOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const startAt = new Date(startDate + 'T00:00:00');
      const endAt = new Date(endDate + 'T23:59:59.999');
      const [nextMaterials, nextMovements] = await Promise.all([
        listWarehouseMaterials(workspaceId, 250),
        listWarehouseMovementsInPeriod(workspaceId, startAt, endAt, 500),
      ]);
      setMaterials(nextMaterials);
      setMovements(nextMovements);
      if (nextMovements.length >= 500) {
        setMessage('O período selecionado atingiu o limite de 500 movimentos. Reduza o intervalo para uma consulta completa.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials]
  );

  const filtered = useMemo(() => {
    const start = startDate ? new Date(startDate + 'T00:00:00').getTime() : Number.NEGATIVE_INFINITY;
    const end = endDate ? new Date(endDate + 'T23:59:59.999').getTime() : Number.POSITIVE_INFINITY;
    const q = materialFilter.trim().toLocaleLowerCase('pt-BR');

    return movements.filter((item) => {
      const timestamp = item.createdAt ? Date.parse(item.createdAt) : 0;
      if (item.createdAt && (timestamp < start || timestamp > end)) return false;
      if (typeFilter !== 'ALL' && item.movement.type !== typeFilter) return false;
      if (invoiceOnly && item.movement.source?.kind !== 'INVOICE') return false;
      if (q) {
        const material = materialById.get(item.movement.materialId);
        const haystack = [item.movement.materialId, material?.description || '', movementSourceLabel(item)]
          .join(' ')
          .toLocaleLowerCase('pt-BR');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [endDate, invoiceOnly, materialById, materialFilter, movements, startDate, typeFilter]);

  useEffect(() => {
    setVisibleCount(30);
  }, [startDate, endDate, typeFilter, materialFilter, invoiceOnly]);

  const exportCsv = () => {
    const rows = filtered.map((item) => {
      const material = materialById.get(item.movement.materialId);
      const source = item.movement.source;
      return [
        item.createdAt || '',
        item.movement.type,
        material?.description || item.movement.materialId,
        item.movement.quantityDelta,
        source?.kind === 'INVOICE' ? source.invoiceId : '',
        source?.kind === 'INVOICE' ? source.supplier : '',
        source?.kind === 'INVOICE' ? source.empenhoId : '',
        movementSourceLabel(item),
        item.movement.id,
      ];
    });
    const header = ['Data/Hora', 'Tipo', 'Material', 'Quantidade', 'NF', 'Fornecedor', 'Empenho', 'Origem', 'Movimento'];
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'emprovex-movimentacoes-' + startDate + '-a-' + endDate + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="warehouse-logistics-ledger-report">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#00288e]">
              <History className="h-4 w-4" />
              <h2 className="text-base font-black">Histórico de movimentações</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Veja o que entrou, saiu ou foi transferido. Use os filtros e abra um registro para conferir sua origem e referência.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600">
              <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Atualizar
            </button>
            <button type="button" onClick={exportCsv} disabled={!filtered.length} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-[#00288e] disabled:opacity-40">
              <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Início
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700" />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Fim
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700" />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tipo
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'ALL' | WarehouseMovementType)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option value="ALL">Todos os tipos</option>
              {WAREHOUSE_MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{MOVEMENT_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Material / origem
            <input value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} placeholder="Descrição, ID, NF, fornecedor" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700" />
          </label>
          <label className="flex h-10 items-center gap-2 self-end rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={invoiceOnly} onChange={(e) => setInvoiceOnly(e.target.checked)} />
            Somente entradas por NF
          </label>
        </div>
      </section>

      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{message}</div>}

      <section className="space-y-2" data-testid="warehouse-movement-report-list">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-sm font-bold text-slate-700">
            {loading ? 'Consultando movimentos…' : filtered.length + ' movimentação(ões) encontrada(s)'}
          </p>
          <span className="text-xs text-slate-500">Clique em um registro para ver os detalhes</span>
        </div>
        {!loading && filtered.slice(0, visibleCount).map((item) => {
          const material = materialById.get(item.movement.materialId);
          const source = item.movement.source;
          const reference = source?.kind === 'INVOICE'
            ? 'NF ' + source.invoiceId + ' · Empenho ' + source.empenhoId
            : source?.kind === 'MANUAL_ENTRY'
              ? source.reference || 'Sem referência adicional'
              : item.movement.id;
          const quantity = item.movement.quantityDelta;
          return (
            <details key={item.movement.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200"
              data-testid="warehouse-movement-report-item">
              <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">{material?.description || 'Material não encontrado no cadastro'}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {MOVEMENT_LABELS[item.movement.type]} · {item.createdAt
                      ? new Date(item.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                      : 'Data não informada'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-4">
                  <p className={'text-base font-black ' + (quantity < 0 ? 'text-rose-700' : 'text-emerald-700')}>
                    {quantity > 0 ? '+' : ''}{quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00288e]">
                    Detalhes <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </span>
                </div>
              </summary>
              <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-slate-500">Origem da movimentação</p>
                  <p className="mt-1 break-words text-slate-800">{movementSourceLabel(item)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">Documento ou referência</p>
                  <p className="mt-1 break-words text-slate-800">{reference}</p>
                </div>
                {source?.kind === 'INVOICE' && (
                  <div>
                    <p className="text-xs font-bold text-slate-500">Fornecedor</p>
                    <p className="mt-1 break-words text-slate-800">{source.supplier}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-slate-500">Identificador do registro</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-600">{item.movement.id}</p>
                </div>
              </div>
            </details>
          );
        })}
        {!loading && filtered.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Nenhuma movimentação encontrada. Tente outro período ou ajuste os filtros.
          </p>
        )}
        {!loading && filtered.length > visibleCount && (
          <button type="button" onClick={() => setVisibleCount((count) => count + 30)}
            data-testid="warehouse-movement-show-more"
            className="min-h-11 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-[#00288e]">
            Mostrar mais movimentações ({filtered.length - visibleCount} restantes)
          </button>
        )}
      </section>
    </div>
  );
}

export function WarehouseLogisticsReports({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<ReportTab>('stock');

  return (
    <div className="space-y-5" data-testid="warehouse-logistics-reports">
      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#00288e]">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Relatórios de materiais</h2>
            <p className="mt-1 text-sm text-slate-600">
              Escolha o que deseja consultar. Toque nos registros para abrir os detalhes.
            </p>
          </div>
        </div>
        <nav className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3" aria-label="Tipo de relatório">
          {REPORT_TABS.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
              data-testid={'warehouse-report-tab-' + item.id}
              className={tab === item.id
                ? 'min-h-11 rounded-xl bg-[#00288e] px-3 py-2 text-left text-xs font-black text-white shadow-sm'
                : 'min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-blue-50'}>
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      {tab === 'stock' && <WarehouseStockOperational workspaceId={workspaceId} />}
      {tab === 'outbound' && (
        <WarehouseConsumptionReports
          workspaceId={workspaceId}
          fixedOrigin="STOCK_OUTBOUND"
        />
      )}
      {tab === 'immediate' && (
        <WarehouseConsumptionReports
          workspaceId={workspaceId}
          fixedOrigin="IMMEDIATE_CONSUMPTION"
        />
      )}
      {tab === 'ledger' && <LedgerAndInvoiceReport workspaceId={workspaceId} />}
      {tab === 'inventory' && <WarehouseInventoryHistoryReport workspaceId={workspaceId} />}
      {tab === 'siscofis' && <WarehouseSiscofisHistoryReport workspaceId={workspaceId} />}
    </div>
  );
}
