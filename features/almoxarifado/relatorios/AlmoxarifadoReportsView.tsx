'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { AlmoxFinancialSnapshot, AlmoxWarehouseSnapshot } from './reportModel';
import {
  buildAlmoxFinancialReport,
  buildAlmoxWarehouseReport,
  requireAlmoxReportScope,
} from './reportModel';
import { getCurrentOperationalScope } from '../../../lib/operationalPaths';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import {
  listWarehouseDepotsStrict,
  listWarehouseLocationsStrict,
  listWarehouseLocationBalances,
} from '../../../lib/warehouse/locationRepository';
import { listWarehouseLots } from '../../../lib/warehouse/lotRepository';
import { listWarehouseMovementsInPeriod } from '../../../lib/warehouse/ledgerRepository';

const WarehouseInventoryHistoryReport = dynamic(
  () => import('../../warehouse/components/WarehouseInventoryHistoryReport')
    .then((module) => module.WarehouseInventoryHistoryReport)
);
const WarehouseSiscofisHistoryReport = dynamic(
  () => import('../../warehouse/components/WarehouseSiscofisHistoryReport')
    .then((module) => module.WarehouseSiscofisHistoryReport)
);

type Tab = 'financeiro' | 'materiais' | 'movimentos' | 'inventarios' | 'siscofis';
type FinancialState =
  | { status: 'loading' | 'unavailable' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: AlmoxFinancialSnapshot };

export interface AlmoxarifadoReportsViewProps {
  /** Workspace derivado da sessão setorial; nunca um parâmetro de URL. */
  workspaceId: string;
  /** Fonte operacional do W6/W9, já consultada sob a mesma sessão/workspace. */
  financial?: FinancialState;
  mode?: 'normal' | 'essential';
}

const LIMITS: AlmoxWarehouseSnapshot['limits'] = {
  materials: 250,
  depots: 100,
  locations: 250,
  locationBalances: 500,
  lots: 150,
  movements: 100,
};
const TABS: { id: Tab; label: string }[] = [
  { id: 'financeiro', label: 'Empenhos e fornecedores' },
  { id: 'materiais', label: 'Materiais e posições' },
  { id: 'movimentos', label: 'Movimentações' },
  { id: 'inventarios', label: 'Inventários' },
  { id: 'siscofis', label: 'Histórico SISCOFIS' },
];
function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function count(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(value);
}
function dateLocal(now = new Date()): string {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
}
function csvCell(value: string | number) {
  const raw = String(value);
  // Evitar execução de fórmulas ao abrir CSV em programas de planilha.
  const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function downloadCsv(name: string, rows: (string | number)[][]) {
  if (!rows.length) return;
  const content = '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#00288e]">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{note}</p>
    </div>
  );
}
const tableHeader = 'px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-slate-500';
const tableCell = 'px-3 py-3 align-top text-xs text-slate-700';

export function AlmoxarifadoReportsView({
  workspaceId, financial = { status: 'unavailable' }, mode = 'normal',
}: AlmoxarifadoReportsViewProps) {
  const [scopeState, setScopeState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [tab, setTab] = useState<Tab>('financeiro');
  const [financialTab, setFinancialTab] = useState<'empenho' | 'fornecedor'>('empenho');
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [warehouse, setWarehouse] = useState<AlmoxWarehouseSnapshot | null>(null);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    requestRef.current += 1;
    setWarehouse(null);
    setWarehouseError(null);
    setWarehouseLoading(false);
    setScopeState('checking');
    try {
      requireAlmoxReportScope(workspaceId, getCurrentOperationalScope().workspaceId);
      setScopeState('allowed');
    } catch {
      setScopeState('denied');
    }
  }, [workspaceId]);

  const loadWarehouse = useCallback(async () => {
    const requestId = ++requestRef.current;
    setWarehouseLoading(true);
    setWarehouseError(null);
    try {
      requireAlmoxReportScope(workspaceId, getCurrentOperationalScope().workspaceId);
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      const [materials, depots, locations, locationBalances, lots, movements] = await Promise.all([
        listWarehouseMaterials(workspaceId, LIMITS.materials),
        listWarehouseDepotsStrict(workspaceId, LIMITS.depots),
        listWarehouseLocationsStrict(workspaceId, LIMITS.locations),
        listWarehouseLocationBalances(workspaceId, LIMITS.locationBalances),
        listWarehouseLots(workspaceId, LIMITS.lots),
        listWarehouseMovementsInPeriod(workspaceId, start, end, LIMITS.movements),
      ]);
      requireAlmoxReportScope(workspaceId, getCurrentOperationalScope().workspaceId);
      const next: AlmoxWarehouseSnapshot = {
        workspaceId, materials, depots, locations, locationBalances, lots, movements, limits: LIMITS,
      };
      // Validar todas as entidades antes de exibir: nunca transformar erro em "zero".
      buildAlmoxWarehouseReport(workspaceId, next, dateLocal());
      if (requestRef.current === requestId) setWarehouse(next);
    } catch (error) {
      if (requestRef.current === requestId) {
        setWarehouse(null);
        setWarehouseError(error instanceof Error ? error.message : 'Falha na consulta logística.');
      }
    } finally {
      if (requestRef.current === requestId) setWarehouseLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (scopeState === 'allowed' && (tab === 'materiais' || tab === 'movimentos')
      && !warehouse && !warehouseError && !warehouseLoading) {
      void loadWarehouse();
    }
  }, [tab, scopeState, warehouse, warehouseError, warehouseLoading, loadWarehouse]);

  const finance = useMemo(() => {
    if (scopeState !== 'allowed' || financial.status !== 'ready') return null;
    try {
      return buildAlmoxFinancialReport(workspaceId, financial.snapshot);
    } catch {
      return null;
    }
  }, [scopeState, financial, workspaceId]);
  const logistic = useMemo(() => warehouse && warehouse.workspaceId === workspaceId
    ? buildAlmoxWarehouseReport(workspaceId, warehouse, dateLocal()) : null,
  [warehouse, workspaceId]);

  const filteredEmpenhos = useMemo(() => (finance?.byEmpenho || []).filter((row) =>
    (!year || row.year === year) &&
    (!search || (row.id + ' ' + row.supplier).toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')))),
  [finance, year, search]);
  const filteredSuppliers = useMemo(() => (finance?.suppliers || []).filter((row) =>
    !search || (row.supplierName + ' ' + row.cnpj).toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR'))),
  [finance, search]);
  const filteredPositions = useMemo(() => (logistic?.positions || []).filter((row) =>
    !search || (row.material + ' ' + row.depot + ' ' + row.location)
      .toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),
  [logistic, search]);

  if (scopeState !== 'allowed') {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        {scopeState === 'checking' ? 'Validando o workspace da sessão…'
          : 'Acesso negado: sessão e workspace do relatório não correspondem.'}
      </section>
    );
  }

  return (
    <div className="space-y-5" data-testid="almox-w8-reports" data-visual-mode={mode}>
      <header>
        <h2 className="text-2xl font-black text-[#00288e]">Relatórios do Almoxarifado</h2>
        <p className="mt-1 text-sm text-slate-600">
          Consultas financeiras e logísticas do workspace ativo. A informação do SISCOFIS é auxiliar;
          este painel não registra baixas nem substitui lançamentos oficiais.
        </p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Relatórios do Almoxarifado">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => { setTab(item.id); setSearch(''); }}
            aria-pressed={tab === item.id}
            className={tab === item.id
              ? 'rounded-xl bg-[#00288e] px-4 py-2 text-xs font-bold text-white'
              : 'rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50'}>
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'financeiro' && (
        <section className="space-y-4">
          {financial.status === 'loading' && <p role="status" className="text-sm text-slate-600">Carregando dados financeiros…</p>}
          {financial.status === 'error' && <p role="alert" className="text-sm text-rose-700">{financial.message}</p>}
          {financial.status === 'unavailable' && <p className="text-sm text-slate-600">Os dados financeiros ainda não foram conectados pelo portal. Nenhum valor estimado será mostrado.</p>}
          {financial.status === 'ready' && !finance && (
            <p role="alert" className="text-sm text-rose-700">Fonte financeira rejeitada: workspace incompatível.</p>
          )}
          {finance && (
            <>
              {!finance.complete && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Recorte financeiro parcial: os totais abaixo representam apenas os registros carregados.
                </p>
              )}
              {finance.unmatchedInvoiceCount > 0 && (
                <p className="text-xs text-amber-700">
                  {finance.unmatchedInvoiceCount} NF(s) sem empenho presente no recorte; excluídas da soma.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Empenhos" value={count(finance.empenhoCount)} note="Registros do recorte" />
                <Metric label="Valor empenhado" value={money(finance.committedValue)} note="Soma quantidade × valor unitário da NE" />
                <Metric label="Valor de NFs" value={money(finance.invoiceValue)} note="Valores de NFs cadastradas; não significa liquidação" />
                <Metric label="Saldo calculado" value={money(finance.balanceValue)} note="Saldo monetário por NE com piso zero; não é estoque" />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-bold text-slate-600">
                  Exibição
                  <select value={financialTab} onChange={(e) => { setFinancialTab(e.target.value as 'empenho' | 'fornecedor'); setSearch(''); }}
                    className="mt-1 block rounded-lg border border-slate-200 bg-white p-2">
                    <option value="empenho">Por empenho</option><option value="fornecedor">Por fornecedor</option>
                  </select>
                </label>
                {financialTab === 'empenho' && (
                  <label className="text-xs font-bold text-slate-600">
                    Exercício
                    <select value={year} onChange={(e) => setYear(e.target.value)}
                      className="mt-1 block rounded-lg border border-slate-200 bg-white p-2">
                      <option value="">Todos os exercícios carregados</option>
                      {finance.years.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                )}
                <label className="grow text-xs font-bold text-slate-600">
                  Pesquisa
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Empenho, fornecedor ou CNPJ"
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2" />
                </label>
                <button type="button" onClick={() => {
                  const header = ['Identificação', 'Fornecedor', 'Valor empenhado (R$)', 'Valor NFs (R$)', 'Saldo (R$)', 'NFs'];
                  const data = financialTab === 'empenho'
                    ? filteredEmpenhos.map((r) => [r.id, r.supplier, r.committedValue, r.invoiceValue, r.balanceValue, r.invoiceCount])
                    : filteredSuppliers.map((r) => [r.cnpj, r.supplierName, r.totalCommitted, r.totalReceived, r.balance, r.invoiceCount]);
                  downloadCsv('almox-relatorio-' + financialTab + '.csv', [header, ...data]);
                }} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#00288e]">
                  Exportar CSV do recorte
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-[760px] w-full text-left">
                  <thead className="bg-slate-50"><tr>
                    {(financialTab === 'empenho'
                      ? ['Empenho', 'Fornecedor', 'Exercício', 'Itens', 'NFs', 'Empenhado', 'NFs (valor)', 'Saldo monetário']
                      : ['CNPJ', 'Fornecedor', 'Empenhos', 'NFs', 'Empenhado', 'NFs (valor)', 'Saldo monetário']
                    ).map((col) => <th key={col} className={tableHeader}>{col}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {financialTab === 'empenho' ? filteredEmpenhos.slice(0, 100).map((r) => (
                      <tr key={r.id}>
                        <td className={tableCell}>{r.id}</td><td className={tableCell}>{r.supplier}</td>
                        <td className={tableCell}>{r.year}</td><td className={tableCell}>{count(r.itemCount)}</td>
                        <td className={tableCell}>{count(r.invoiceCount)}</td>
                        <td className={tableCell}>{money(r.committedValue)}</td>
                        <td className={tableCell}>{money(r.invoiceValue)}</td>
                        <td className={tableCell}>{money(r.balanceValue)}</td>
                      </tr>
                    )) : filteredSuppliers.slice(0, 100).map((r) => (
                      <tr key={r.cnpj}>
                        <td className={tableCell}>{r.cnpj}</td><td className={tableCell}>{r.supplierName}</td>
                        <td className={tableCell}>{count(r.empenhos.length)}</td>
                        <td className={tableCell}>{count(r.invoiceCount)}</td>
                        <td className={tableCell}>{money(r.totalCommitted)}</td>
                        <td className={tableCell}>{money(r.totalReceived)}</td>
                        <td className={tableCell}>{money(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {financialTab === 'empenho' && filteredEmpenhos.length > 100 && <p className="p-3 text-xs text-amber-700">Exibindo 100 empenhos; refine a pesquisa ou exporte o recorte completo.</p>}
                {financialTab === 'fornecedor' && filteredSuppliers.length > 100 && <p className="p-3 text-xs text-amber-700">Exibindo 100 fornecedores; refine a pesquisa ou exporte o recorte completo.</p>}
                {((financialTab === 'empenho' && !filteredEmpenhos.length) || (financialTab === 'fornecedor' && !filteredSuppliers.length)) && (
                  <p className="p-5 text-center text-sm text-slate-500">Nenhum registro no recorte informado.</p>
                )}
              </div>
              {finance.missingCnpjCount > 0 && (
                <p className="text-xs text-amber-700">{finance.missingCnpjCount} empenho(s) sem CNPJ não entram no agrupamento por fornecedor.</p>
              )}
            </>
          )}
        </section>
      )}

      {(tab === 'materiais' || tab === 'movimentos') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">Leitura sob demanda, sem atualização contínua. Movimentos: últimos 30 dias.</p>
            <button type="button" disabled={warehouseLoading} onClick={() => void loadWarehouse()}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#00288e] disabled:opacity-50">
              {warehouseLoading ? 'Consultando…' : 'Atualizar'}
            </button>
          </div>
          {warehouseLoading && <p role="status" className="text-sm text-slate-600">Consultando dados logísticos do workspace…</p>}
          {warehouseError && <p role="alert" className="text-sm text-rose-700">Não foi possível consultar: {warehouseError}</p>}
          {logistic && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Materiais ativos" value={count(logistic.materialCount) + (logistic.truncated.materials ? '+' : '')}
                  note="Catálogo consultado; não é quantidade em estoque" />
                <Metric label="Depósitos ativos" value={count(logistic.depotCount) + (logistic.truncated.depots ? '+' : '')}
                  note="Estruturas cadastradas" />
                <Metric label="Locais ativos" value={count(logistic.locationCount) + (logistic.truncated.locations ? '+' : '')}
                  note="Inclui subposições cadastradas" />
                <Metric label="Posições positivas" value={count(logistic.positionCount) + (logistic.truncated.locationBalances ? '+' : '')}
                  note="Posições físicas; unidades não somadas" />
                <Metric label="Movimentos consultados" value={count(logistic.movementCount) + (logistic.truncated.movements ? '+' : '')}
                  note="Recorte dos últimos 30 dias" />
                <Metric label="Posições sem local" value={count(logistic.unassignedPositionCount)}
                  note="Somente posições positivas consultadas" />
                <Metric label="Lotes vencidos" value={count(logistic.expiredLotCount) + (logistic.truncated.lots ? '+' : '')}
                  note="Validades registradas, não autorizações SISCOFIS" />
              </div>
              {Object.values(logistic.truncated).some(Boolean) && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Uma ou mais consultas atingiram o limite de registros. Indicadores com + são mínimos
                  sobre o recorte retornado; refine/consulte os relatórios originais para cobertura ampliada.
                </p>
              )}
              {tab === 'materiais' ? (
                <>
                  <label className="block text-xs font-bold text-slate-600">Filtrar material, depósito ou local
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2"
                      placeholder="Descrição ou localização" />
                  </label>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-[700px] w-full"><thead className="bg-slate-50"><tr>
                      {['Material', 'Depósito', 'Local', 'Quantidade-base', 'Unidade'].map((v) =>
                        <th key={v} className={tableHeader}>{v}</th>)}
                    </tr></thead><tbody className="divide-y divide-slate-100">
                      {filteredPositions.slice(0, 100).map((r) => (
                        <tr key={r.id}><td className={tableCell}>{r.material}</td>
                          <td className={tableCell}>{r.depot}</td><td className={tableCell}>{r.location}</td>
                          <td className={tableCell}>{count(r.quantity)}</td><td className={tableCell}>{r.unit}</td>
                        </tr>
                      ))}
                    </tbody></table>
                    {!filteredPositions.length && <p className="p-5 text-center text-sm text-slate-500">Sem posições positivas no recorte.</p>}
                    {filteredPositions.length > 100 && <p className="p-3 text-xs text-amber-700">Exibindo 100 posições. Refine a pesquisa.</p>}
                  </div>
                  {logistic.expiring.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="font-bold text-[#00288e]">Validades cadastradas</h3>
                      <p className="mt-2 text-xs text-slate-600">
                        {logistic.expiring.slice(0, 30).map((lot) => lot.material + ': ' + lot.expiresOn
                          + (lot.expired ? ' (vencido)' : '')).join(' · ')}
                      </p>
                      {logistic.expiring.length > 30 && <p className="mt-2 text-xs text-amber-700">Exibindo apenas 30 lotes.</p>}
                    </div>
                  )}
                </>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-[700px] w-full"><thead className="bg-slate-50"><tr>
                    {['Data', 'Material', 'Tipo', 'Quantidade-base', 'Identificador'].map((v) =>
                      <th key={v} className={tableHeader}>{v}</th>)}
                  </tr></thead><tbody className="divide-y divide-slate-100">
                    {logistic.movements.slice(0, 100).map((r) => (
                      <tr key={r.movement.id}>
                        <td className={tableCell}>{r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : 'Não informada'}</td>
                        <td className={tableCell}>{r.movement.materialId}</td>
                        <td className={tableCell}>{r.movement.type}</td>
                        <td className={tableCell}>{count(r.movement.quantityDelta)}</td>
                        <td className={tableCell}>{r.movement.id}</td>
                      </tr>
                    ))}
                  </tbody></table>
                  {!logistic.movements.length && <p className="p-5 text-center text-sm text-slate-500">Nenhum movimento no período consultado.</p>}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {tab === 'inventarios' && <WarehouseInventoryHistoryReport workspaceId={workspaceId} />}
      {tab === 'siscofis' && <WarehouseSiscofisHistoryReport workspaceId={workspaceId} />}
    </div>
  );
}
