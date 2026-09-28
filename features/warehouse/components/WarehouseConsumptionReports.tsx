'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  Download,
  Filter,
  Printer,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

import {
  listWarehouseConsumptionReport,
  returnWarehouseStockOutbound,
  setWarehouseConsumptionSiscofisStatus,
} from '../../../lib/warehouse/withdrawalRepository';
import type {
  WarehouseConsumptionOrigin,
  WarehouseConsumptionRecord,
  WarehouseSiscofisOperationalStatus,
} from '../../../lib/warehouse/withdrawal';

type PeriodPreset = 'daily' | 'weekly' | 'fortnight' | 'monthly' | 'custom';
type OriginFilter = 'ALL' | WarehouseConsumptionOrigin;

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function dateAtStart(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function dateAtEnd(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function presetRange(preset: Exclude<PeriodPreset, 'custom'>, now = new Date()) {
  const start = new Date(now);
  const end = new Date(now);

  if (preset === 'daily') {
    return { start: localDateInput(start), end: localDateInput(end) };
  }

  if (preset === 'weekly') {
    const weekday = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - weekday);
    end.setDate(start.getDate() + 6);
    return { start: localDateInput(start), end: localDateInput(end) };
  }

  if (preset === 'fortnight') {
    if (now.getDate() <= 15) {
      start.setDate(1);
      end.setDate(15);
    } else {
      start.setDate(16);
      end.setMonth(now.getMonth() + 1, 0);
    }
    return { start: localDateInput(start), end: localDateInput(end) };
  }

  start.setDate(1);
  end.setMonth(now.getMonth() + 1, 0);
  return { start: localDateInput(start), end: localDateInput(end) };
}

function numberLabel(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function dateTimeLabel(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString('pt-BR')
    : value;
}

function originLabel(origin: WarehouseConsumptionOrigin): string {
  return origin === 'STOCK_OUTBOUND' ? 'Saída de estoque' : 'Consumo imediato';
}

function siscofisLabel(status: WarehouseSiscofisOperationalStatus): string {
  if (status === 'PENDING') return 'Pendente';
  if (status === 'PREPARED') return 'Preparado';
  return 'Solicitado/Lançado';
}

function effectiveQuantity(record: WarehouseConsumptionRecord): number {
  if (record.origin !== 'STOCK_OUTBOUND') return record.quantity;
  return Math.max(0, record.quantity - record.returnedQuantity);
}

function unitTotals(records: WarehouseConsumptionRecord[]): string {
  const totals = new Map<string, number>();
  for (const record of records) {
    totals.set(
      record.unitLabel,
      (totals.get(record.unitLabel) || 0) + effectiveQuantity(record)
    );
  }
  return Array.from(totals.entries())
    .map(([unit, total]) => numberLabel(total) + ' ' + unit)
    .join(' · ');
}

function csvCell(value: string | number): string {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

export function WarehouseConsumptionReports({
  workspaceId,
  fixedOrigin,
}: {
  workspaceId: string;
  fixedOrigin?: WarehouseConsumptionOrigin;
}) {
  const initialPreset: Exclude<PeriodPreset, 'custom'> =
    fixedOrigin === 'STOCK_OUTBOUND' ? 'monthly' : 'daily';
  const initial = presetRange(initialPreset);
  const [preset, setPreset] = useState<PeriodPreset>(initialPreset);
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [records, setRecords] = useState<WarehouseConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [originFilter, setOriginFilter] = useState<OriginFilter>(fixedOrigin || 'ALL');
  const effectiveOriginFilter: OriginFilter = fixedOrigin || originFilter;
  const [destinationFilter, setDestinationFilter] = useState('ALL');
  const [withdrawnFilter, setWithdrawnFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [returningRecordId, setReturningRecordId] = useState<string | null>(null);
  const [returnQuantity, setReturnQuantity] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnOperationId, setReturnOperationId] = useState(() => crypto.randomUUID());
  const initialOutboundLoadDone = useRef(false);

  const applyPreset = (next: PeriodPreset) => {
    setPreset(next);
    if (next === 'custom') return;
    const range = presetRange(next);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const generate = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await listWarehouseConsumptionReport(workspaceId, {
        startAt: dateAtStart(startDate),
        endAt: dateAtEnd(endDate),
        maxResults: 250,
        includeLegacy: fixedOrigin !== 'IMMEDIATE_CONSUMPTION',
      });
      const scopedRecords = fixedOrigin
        ? result.records.filter((record) => record.origin === fixedOrigin)
        : result.records;
      setRecords(scopedRecords);
      setMessage(
        scopedRecords.length
          ? 'Relatório atualizado com ' + scopedRecords.length + ' registro(s).'
          : fixedOrigin === 'STOCK_OUTBOUND'
            ? 'Nenhuma saída encontrada no período selecionado.'
            : fixedOrigin === 'IMMEDIATE_CONSUMPTION'
              ? 'Nenhum consumo imediato encontrado no período selecionado.'
              : 'Nenhum consumo encontrado no período selecionado.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [endDate, fixedOrigin, startDate, workspaceId]);

  useEffect(() => {
    if (
      fixedOrigin === 'STOCK_OUTBOUND'
      && !initialOutboundLoadDone.current
    ) {
      initialOutboundLoadDone.current = true;
      void generate();
    }
  }, [fixedOrigin, generate]);

  const destinations = useMemo(
    () => Array.from(new Set(records.map((record) => record.destinationName))).sort(
      (a, b) => a.localeCompare(b, 'pt-BR')
    ),
    [records]
  );

  const filtered = useMemo(() => {
    const withdrawn = withdrawnFilter.trim().toLocaleLowerCase('pt-BR');
    return records.filter((record) => {
      if (effectiveOriginFilter !== 'ALL' && record.origin !== effectiveOriginFilter) return false;
      if (destinationFilter !== 'ALL' && record.destinationName !== destinationFilter) return false;
      if (withdrawn && !record.withdrawnBy.toLocaleLowerCase('pt-BR').includes(withdrawn)) return false;
      return true;
    });
  }, [destinationFilter, effectiveOriginFilter, records, withdrawnFilter]);

  const materialGroups = useMemo(() => {
    const groups = new Map<string, { description: string; unit: string; quantity: number; rows: number }>();
    for (const record of filtered) {
      const key = (
        record.materialId
        || 'immediate:' + record.materialDescription.toLocaleLowerCase('pt-BR')
      ) + '|' + record.unitLabel;
      const current = groups.get(key) || {
        description: record.materialDescription,
        unit: record.unitLabel,
        quantity: 0,
        rows: 0,
      };
      current.quantity += effectiveQuantity(record);
      current.rows += 1;
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.description.localeCompare(b.description, 'pt-BR')
    );
  }, [filtered]);

  const destinationGroups = useMemo(() => {
    const groups = new Map<string, WarehouseConsumptionRecord[]>();
    for (const record of filtered) {
      const current = groups.get(record.destinationName) || [];
      current.push(record);
      groups.set(record.destinationName, current);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [filtered]);

  const withdrawnGroups = useMemo(() => {
    const groups = new Map<string, WarehouseConsumptionRecord[]>();
    for (const record of filtered) {
      const current = groups.get(record.withdrawnBy) || [];
      current.push(record);
      groups.set(record.withdrawnBy, current);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [filtered]);

  const dayGroups = useMemo(() => {
    const groups = new Map<string, WarehouseConsumptionRecord[]>();
    for (const record of filtered) {
      const day = record.occurredAt
        ? new Date(record.occurredAt).toLocaleDateString('pt-BR')
        : 'Sem data';
      const current = groups.get(day) || [];
      current.push(record);
      groups.set(day, current);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const copyReport = async () => {
    const lines = [
      fixedOrigin === 'STOCK_OUTBOUND'
        ? 'EMPROVEX · ADM Depósito · Registro de Saídas'
        : fixedOrigin === 'IMMEDIATE_CONSUMPTION'
          ? 'EMPROVEX · ADM Depósito · Relatórios de Consumo Imediato'
          : 'EMPROVEX · ADM Depósito · Relatório para fundamentação SISCOFIS',
      'Período: ' + startDate + ' a ' + endDate,
      'Origem: ' + (effectiveOriginFilter === 'ALL' ? 'Todas' : originLabel(effectiveOriginFilter)),
      '',
      'CONSOLIDADO POR MATERIAL',
      ...materialGroups.map((item) =>
        item.description + ' — ' + numberLabel(item.quantity) + ' ' + item.unit
      ),
      '',
      'DETALHAMENTO',
      ...filtered.map((record) =>
        [
          dateTimeLabel(record.occurredAt),
          originLabel(record.origin),
          record.materialDescription,
          numberLabel(effectiveQuantity(record)) + ' ' + record.unitLabel
            + (record.returnedQuantity > 0
              ? ' líquido (' + numberLabel(record.returnedQuantity) + ' devolvido)'
              : ''),
          record.destinationName,
          record.withdrawnBy,
          record.withdrawalId || record.intakeId || record.movementId,
        ].join(' · ')
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setMessage('Relatório copiado para a área de transferência.');
    } catch {
      setMessage('Não foi possível copiar automaticamente.');
    }
  };

  const exportCsv = () => {
    const header = [
      'Data/Hora', 'Origem', 'Material', 'Quantidade original', 'Devolvido',
      'Quantidade líquida', 'Unidade', 'Destino', 'Retirado/Recebido por',
      'Saída/Intake', 'Movimento', 'Barcode', 'Lote', 'SISCOFIS',
    ];
    const body = filtered.map((record) => [
      record.occurredAt || '',
      originLabel(record.origin),
      record.materialDescription,
      record.quantity,
      record.returnedQuantity,
      effectiveQuantity(record),
      record.unitLabel,
      record.destinationName,
      record.withdrawnBy,
      record.withdrawalId || record.intakeId || '',
      record.movementId || '',
      record.barcode || '',
      record.lotCode || '',
      record.legacy ? 'Legado' : siscofisLabel(record.siscofisStatus),
    ]);
    const csv = [header, ...body].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = (
      fixedOrigin === 'STOCK_OUTBOUND'
        ? 'emprovex-saidas-'
        : fixedOrigin === 'IMMEDIATE_CONSUMPTION'
          ? 'emprovex-consumo-imediato-'
          : 'emprovex-consumo-'
    ) + startDate + '-a-' + endDate + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const beginReturn = (record: WarehouseConsumptionRecord) => {
    const remaining = effectiveQuantity(record);
    setReturningRecordId(record.id);
    setReturnQuantity(String(remaining));
    setReturnReason('');
    setReturnOperationId(crypto.randomUUID());
    setMessage(null);
  };

  const cancelReturn = () => {
    setReturningRecordId(null);
    setReturnQuantity('');
    setReturnReason('');
    setReturnOperationId(crypto.randomUUID());
  };

  const submitReturn = async (record: WarehouseConsumptionRecord) => {
    const quantity = Number(returnQuantity.replace(',', '.'));
    const remaining = effectiveQuantity(record);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remaining + 0.000001) {
      setMessage('Informe uma quantidade devolvida maior que zero e limitada ao saldo ainda retirado.');
      return;
    }
    if (!returnReason.trim()) {
      setMessage('Informe o motivo do cancelamento/devolução.');
      return;
    }

    setWorkingId(record.id);
    setMessage(null);
    try {
      const result = await returnWarehouseStockOutbound(workspaceId, {
        consumptionId: record.id,
        quantity,
        reason: returnReason,
        operationId: returnOperationId,
      });
      cancelReturn();
      await generate();
      setMessage(
        'Devolução registrada. '
        + numberLabel(quantity)
        + ' '
        + record.unitLabel
        + ' retornou ao estoque.'
        + (result.warnings.length
          ? ''
          : ' O material foi reposicionado na posição original.')
        + (record.siscofisStatus === 'POSTED'
          ? ' A saída já estava marcada como lançada no SISCOFIS; faça também a correção administrativa correspondente.'
          : '')
        + (result.warnings.length ? ' ' + result.warnings.join(' ') : '')
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível devolver o material ao estoque.'
      );
    } finally {
      setWorkingId(null);
    }
  };

  const updateSiscofis = async (
    record: WarehouseConsumptionRecord,
    status: WarehouseSiscofisOperationalStatus
  ) => {
    if (record.legacy) return;
    setWorkingId(record.id);
    setMessage(null);
    try {
      await setWarehouseConsumptionSiscofisStatus(workspaceId, record.id, status);
      setRecords((current) =>
        current.map((item) => item.id === record.id ? { ...item, siscofisStatus: status } : item)
      );
      setMessage('Estado SISCOFIS atualizado de forma auditável.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao atualizar o estado SISCOFIS.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div
      className="space-y-5"
      data-testid="warehouse-consumption-reports"
      data-origin={fixedOrigin || 'ALL'}
    >
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#00288e]/70">
              {fixedOrigin === 'STOCK_OUTBOUND'
                ? 'saída de material · base SISCOFIS'
                : fixedOrigin === 'IMMEDIATE_CONSUMPTION'
                  ? 'consumo imediato · base SISCOFIS'
                  : 'consumo operacional · base SISCOFIS'}
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-900">
              {fixedOrigin === 'STOCK_OUTBOUND'
                ? 'Registro de Saídas'
                : fixedOrigin === 'IMMEDIATE_CONSUMPTION'
                  ? 'Relatórios de Consumo Imediato'
                  : 'Relatórios de Saída e Consumo'}
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
              {fixedOrigin === 'STOCK_OUTBOUND'
                ? 'Retiradas efetivamente baixadas do estoque, já carregadas automaticamente no mês atual. Cancelamentos/devoluções preservam o histórico e devolvem apenas a quantidade informada ao estoque.'
                : fixedOrigin === 'IMMEDIATE_CONSUMPTION'
                  ? 'Somente materiais classificados como consumo imediato no recebimento, sem misturar com retiradas posteriores do estoque.'
                  : 'Consolidação auditável sem substituir o ledger. Saídas de estoque e consumos imediatos podem ser separados ou analisados juntos.'}
            </p>
          </div>
          <button type="button" onClick={() => void generate()} disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm hover:bg-[#001f6f] disabled:opacity-50">
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Gerar relatório
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ['daily', 'Diário'],
            ['weekly', 'Semanal'],
            ['fortnight', 'Quinzenal'],
            ['monthly', 'Mensal'],
            ['custom', 'Período personalizado'],
          ] as Array<[PeriodPreset, string]>).map(([id, label]) => (
            <button key={id} type="button" onClick={() => applyPreset(id)}
              className={preset === id
                ? 'rounded-xl bg-[#00288e] px-3 py-2 text-[11px] font-black text-white shadow-sm'
                : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-blue-50 hover:text-[#00288e]'}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Início
            <input type="date" value={startDate} onChange={(event) => { setPreset('custom'); setStartDate(event.target.value); }}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#00288e]" />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Fim
            <input type="date" value={endDate} onChange={(event) => { setPreset('custom'); setEndDate(event.target.value); }}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#00288e]" />
          </label>
          {!fixedOrigin && (
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Origem
              <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value as OriginFilter)}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#00288e]">
                <option value="ALL">Todos</option>
                <option value="STOCK_OUTBOUND">Saída de estoque</option>
                <option value="IMMEDIATE_CONSUMPTION">Consumo imediato</option>
              </select>
            </label>
          )}
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Destino
            <select value={destinationFilter} onChange={(event) => setDestinationFilter(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#00288e]">
              <option value="ALL">Todos os destinos</option>
              {destinations.map((destination) => <option key={destination} value={destination}>{destination}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Retirante
            <input value={withdrawnFilter} onChange={(event) => setWithdrawnFilter(event.target.value)}
              placeholder="Filtrar por nome"
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#00288e]" />
          </label>
        </div>
        <p className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Semanal = segunda a domingo · Quinzenal = 1–15 ou 16–último dia · Mensal = mês-calendário. Em Saídas, o mês atual abre automaticamente.
        </p>
      </section>

      {message && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-[#00288e]">{message}</div>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(fixedOrigin
          ? [
              ['Registros', filtered.length],
              ['Materiais', materialGroups.length],
              ['Destinos', destinationGroups.length],
              ['Retirantes/recebedores', withdrawnGroups.length],
            ]
          : [
              ['Registros', filtered.length],
              ['Materiais', materialGroups.length],
              ['Saídas de estoque', filtered.filter((item) => item.origin === 'STOCK_OUTBOUND').length],
              ['Consumo imediato', filtered.filter((item) => item.origin === 'IMMEDIATE_CONSUMPTION').length],
            ]
        ).map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md">
          <h4 className="text-sm font-black text-slate-900">Consolidado por material</h4>
          <div className="mt-3 space-y-2">
            {materialGroups.length === 0 ? <p className="text-xs text-slate-600">Sem dados no filtro atual.</p> : materialGroups.map((item) => (
              <div key={item.description + item.unit} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <div><p className="text-xs font-bold text-slate-800">{item.description}</p><p className="text-[10px] text-slate-500">{item.rows} registro(s)</p></div>
                <p className="text-sm font-black text-[#00288e]">{numberLabel(item.quantity)} {item.unit}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md">
          <h4 className="text-sm font-black text-slate-900">Consolidado por destino</h4>
          <div className="mt-3 space-y-2">
            {destinationGroups.length === 0 ? <p className="text-xs text-slate-600">Sem dados no filtro atual.</p> : destinationGroups.map(([destination, items]) => (
              <div key={destination} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-800">{destination}</p>
                  <p className="text-[10px] font-bold text-slate-400">{items.length} registro(s)</p>
                </div>
                <p className="mt-1 text-[10px] text-[#00288e]">{unitTotals(items)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md">
          <h4 className="text-sm font-black text-slate-900">Por retirante/recebedor</h4>
          <div className="mt-3 space-y-2">
            {withdrawnGroups.map(([name, items]) => (
              <div key={name} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <p className="text-xs font-bold text-slate-800">{name}</p>
                <p className="mt-1 text-[10px] text-slate-500">{items.length} registro(s) · {unitTotals(items)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md">
          <h4 className="text-sm font-black text-slate-900">Por dia</h4>
          <div className="mt-3 space-y-2">
            {dayGroups.map(([day, items]) => (
              <div key={day} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <p className="text-xs font-bold text-slate-800">{day}</p>
                <p className="mt-1 text-[10px] text-slate-500">{items.length} registro(s) · {unitTotals(items)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-900">Detalhamento auditável</h4>
            <p className="mt-1 text-[10px] text-slate-500">Uma projeção por movimento evita dupla contabilização. Registros legados permanecem identificados.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyReport()} disabled={!filtered.length}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:border-blue-200 hover:text-[#00288e] disabled:opacity-40">
              <Clipboard className="h-3.5 w-3.5" /> Copiar
            </button>
            <button type="button" onClick={exportCsv} disabled={!filtered.length}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:border-blue-200 hover:text-[#00288e] disabled:opacity-40">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button type="button" onClick={() => window.print()} disabled={!filtered.length}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:border-blue-200 hover:text-[#00288e] disabled:opacity-40">
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[9px] uppercase tracking-wide text-slate-500">
                {['Data/hora','Origem','Material','Quantidade','Destino','Retirante','Situação','SISCOFIS'].map((label) =>
                  <th key={label} className="px-2 py-2">{label}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 text-slate-700">
                  <td className="px-2 py-3 whitespace-nowrap">{dateTimeLabel(record.occurredAt)}</td>
                  <td className="px-2 py-3">{originLabel(record.origin)}</td>
                  <td className="px-2 py-3">
                    <p className="font-bold text-slate-900">{record.materialDescription}</p>
                    <p className="mt-1 font-mono text-[9px] text-slate-600">{record.materialId || 'sem entrada em estoque'}</p>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <p className="font-bold text-slate-800">
                      {numberLabel(effectiveQuantity(record))} {record.unitLabel}
                    </p>
                    {record.returnedQuantity > 0 && (
                      <p className="mt-1 text-[9px] text-amber-700">
                        original {numberLabel(record.quantity)} · devolvido {numberLabel(record.returnedQuantity)}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-3">{record.destinationName}</td>
                  <td className="px-2 py-3">{record.withdrawnBy}</td>
                  <td className="px-2 py-3 align-top">
                    {record.origin !== 'STOCK_OUTBOUND' ? (
                      <span className="text-[9px] text-slate-400">—</span>
                    ) : record.legacy ? (
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[9px] font-black text-slate-600">Legado</span>
                    ) : effectiveQuantity(record) <= 0.000001 ? (
                      <div>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">
                          Cancelada / devolvida
                        </span>
                        {record.lastReturnReason && (
                          <p className="mt-1 max-w-52 text-[9px] leading-4 text-slate-500">{record.lastReturnReason}</p>
                        )}
                      </div>
                    ) : returningRecordId === record.id ? (
                      <div className="w-64 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
                        <p className="text-[9px] font-black uppercase text-amber-800">
                          Cancelar / devolver ao estoque
                        </p>
                        <label className="block text-[9px] font-bold text-slate-600">
                          Quantidade devolvida
                          <input
                            value={returnQuantity}
                            onChange={(event) => setReturnQuantity(event.target.value)}
                            className="mt-1 h-8 w-full rounded-lg border border-amber-200 bg-white px-2 text-xs font-bold text-slate-800"
                          />
                        </label>
                        <label className="block text-[9px] font-bold text-slate-600">
                          Motivo
                          <input
                            value={returnReason}
                            onChange={(event) => setReturnReason(event.target.value)}
                            maxLength={180}
                            placeholder="Ex.: saída cancelada, material devolvido"
                            className="mt-1 h-8 w-full rounded-lg border border-amber-200 bg-white px-2 text-xs text-slate-800"
                          />
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={workingId === record.id}
                            onClick={() => void submitReturn(record)}
                            className="flex-1 rounded-lg bg-amber-600 px-2 py-1.5 text-[9px] font-black text-white disabled:opacity-50"
                          >
                            Confirmar devolução
                          </button>
                          <button
                            type="button"
                            disabled={workingId === record.id}
                            onClick={cancelReturn}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-600"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">
                          {record.returnedQuantity > 0 ? 'Devolução parcial' : 'Ativa'}
                        </span>
                        <button
                          type="button"
                          onClick={() => beginReturn(record)}
                          className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-800"
                        >
                          <RotateCcw className="h-3 w-3" /> Cancelar / devolver
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {record.legacy ? (
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[9px] font-black text-slate-600">Legado</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-[#00288e]">
                          {siscofisLabel(record.siscofisStatus)}
                        </span>
                        {record.siscofisStatus === 'PENDING' && (
                          <button type="button" disabled={workingId === record.id}
                            onClick={() => void updateSiscofis(record, 'PREPARED')}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 hover:text-[#00288e] disabled:opacity-40">
                            Preparar
                          </button>
                        )}
                        {record.siscofisStatus !== 'POSTED' && (
                          <button type="button" disabled={workingId === record.id}
                            onClick={() => void updateSiscofis(record, 'POSTED')}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 disabled:opacity-40">
                            <CheckCircle2 className="h-3 w-3" /> Lançado
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
