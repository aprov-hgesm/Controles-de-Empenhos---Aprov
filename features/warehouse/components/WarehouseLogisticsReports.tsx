'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, FileSpreadsheet, History, PackageSearch, RefreshCw, ShieldCheck } from 'lucide-react';

import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import { listWarehouseMovements, type WarehouseMovementListItem } from '../../../lib/warehouse/ledgerRepository';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseMovementType } from '../../../lib/warehouse/movement';
import { WAREHOUSE_MOVEMENT_TYPES } from '../../../lib/warehouse/movement';
import { WarehouseStockOperational } from './WarehouseStockOperational';
import { WarehouseConsumptionReports } from './WarehouseConsumptionReports';
import { WarehouseInventoryOperational } from './WarehouseInventoryOperational';
import { WarehouseSiscofisOperational } from './WarehouseSiscofisOperational';

type ReportTab = 'stock' | 'consumption' | 'ledger' | 'inventory' | 'siscofis';

const REPORT_TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'stock', label: 'Estoque, locais e validade' },
  { id: 'consumption', label: 'Consumo e saídas' },
  { id: 'ledger', label: 'Movimentações e entradas por NF' },
  { id: 'inventory', label: 'Inventários' },
  { id: 'siscofis', label: 'SISCOFIS' },
];

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
  if (source?.kind === 'LOCATION_TRANSFER') return 'Transferência interna';
  if (source?.kind === 'EXPRESS_OUTBOUND') return 'Saída de material';
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
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [nextMaterials, nextMovements] = await Promise.all([
        listWarehouseMaterials(workspaceId, 250),
        listWarehouseMovements(workspaceId, 250),
      ]);
      setMaterials(nextMaterials);
      setMovements(nextMovements);
      if (nextMovements.length >= 250) {
        setMessage('A consulta atingiu o limite bounded de 250 movimentos. Refine o período/filtros para análise operacional.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o relatório.');
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
              <p className="text-xs font-black uppercase tracking-[0.12em]">Movimentações e entradas por NF</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Leitura bounded do ledger oficial. Entradas por NF são filtradas pela origem INVOICE e nunca escrevem de volta na Nota Fiscal.
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
              <option value="ALL">Todos</option>
              {WAREHOUSE_MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
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

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[980px] w-full text-left text-xs">
          <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.12em] text-slate-500">
            <tr><th className="p-3">Data/Hora</th><th className="p-3">Tipo</th><th className="p-3">Material</th><th className="p-3">Quantidade</th><th className="p-3">Origem</th><th className="p-3">Referência</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const material = materialById.get(item.movement.materialId);
              const source = item.movement.source;
              const reference = source?.kind === 'INVOICE'
                ? 'NF ' + source.invoiceId + ' · Empenho ' + source.empenhoId
                : item.movement.id;
              return (
                <tr key={item.movement.id}>
                  <td className="p-3 text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '—'}</td>
                  <td className="p-3"><span className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-[9px] font-black text-[#00288e]">{item.movement.type}</span></td>
                  <td className="p-3 font-bold text-slate-800">{material?.description || item.movement.materialId}</td>
                  <td className="p-3 font-black text-slate-700">{item.movement.quantityDelta.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
                  <td className="p-3 text-slate-500">{movementSourceLabel(item)}</td>
                  <td className="p-3 font-mono text-[9px] text-slate-400">{reference}</td>
                </tr>
              );
            })}
            {!loading && !filtered.length && <tr><td colSpan={6} className="p-6 text-center text-sm text-slate-400">Nenhum movimento encontrado nos filtros selecionados.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function WarehouseLogisticsReports({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<ReportTab>('stock');

  return (
    <div className="space-y-5" data-testid="warehouse-logistics-reports">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#00288e]"><FileSpreadsheet className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#00288e]">Relatórios logísticos</p>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
              Camada de consulta derivada das fontes oficiais. Nenhum relatório possui autoridade quantitativa, nenhum saldo é recalculado pelo ledger e as leituras só montam a superfície selecionada.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {REPORT_TABS.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              className={tab === item.id ? 'shrink-0 rounded-lg bg-white px-3 py-2 text-[11px] font-black text-[#00288e] shadow-sm' : 'shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-500'}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> bounded</span>
          <span className="inline-flex items-center gap-1"><PackageSearch className="h-3.5 w-3.5" /> joins em memória</span>
          <span className="inline-flex items-center gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> fontes oficiais</span>
        </div>
      </section>

      {tab === 'stock' && <WarehouseStockOperational workspaceId={workspaceId} />}
      {tab === 'consumption' && <WarehouseConsumptionReports workspaceId={workspaceId} />}
      {tab === 'ledger' && <LedgerAndInvoiceReport workspaceId={workspaceId} />}
      {tab === 'inventory' && <WarehouseInventoryOperational workspaceId={workspaceId} />}
      {tab === 'siscofis' && <WarehouseSiscofisOperational workspaceId={workspaceId} />}
    </div>
  );
}
