'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, ExternalLink, RefreshCw } from 'lucide-react';
import {
  estimateFirestoreOperationCosts,
  type FirestoreCostSummary,
} from '../../lib/firestoreCostEstimate.mjs';
import { getFirestoreBillingDayKey, shiftFirestoreBillingDayKey } from '../../lib/firestoreBillingDay';
import {
  loadGlobalUsageHistory,
  type GlobalUsageHistoryPoint,
  type UsageReportRange,
} from '../../lib/platformAdminUsageHistory';
import type { FirebaseGlobalUsageSnapshot } from '../../lib/platformCapacity';

type CostPanelProps = {
  globalUsage: FirebaseGlobalUsageSnapshot | null;
  globalUsageDataThrough: string | null;
};

const PRICE_SOURCE = 'https://cloud.google.com/firestore/enterprise/pricing';
const BILLING_SOURCE = 'https://console.cloud.google.com/billing';
const formatterBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 });
const formatterUSD = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 5, maximumFractionDigits: 6 });

function usdRate(value: string): number {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function priceLabel(summary: { usd: number | null; brl: number | null }, ready: boolean): string {
  if (!ready || summary.brl === null) return 'R$ —';
  return formatterBRL.format(summary.brl);
}

function CostCard({
  title, summary, ready, note,
}: {
  title: string;
  summary: FirestoreCostSummary | { usd: number | null; brl: number | null };
  ready: boolean;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-extrabold text-[#1b4b87]">{title}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-[#153960]">
        {priceLabel(summary, ready)}
      </p>
      <p className="mt-1 text-xs text-[#587694]">
        {summary.usd !== null ? formatterUSD.format(summary.usd) + ' · antes de conversão e tributos' : 'Sem dados suficientes'}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-[#647c9b]">{note}</p>
    </div>
  );
}

export function AdminFirestoreCostPanel({ globalUsage, globalUsageDataThrough }: CostPanelProps) {
  const [history, setHistory] = useState<GlobalUsageHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usdBrl, setUsdBrl] = useState('');
  // Tabela pública de referência: Iowa/us-central1, preço padrão sem descontos.
  // Região, edição, moeda do contrato e descontos REQUEREM verificação humana.
  const [readPrice, setReadPrice] = useState('0.05');
  const [writePrice, setWritePrice] = useState('0.26');
  const [realtimePrice, setRealtimePrice] = useState('0.30');
  const [applyFreeTier, setApplyFreeTier] = useState(false);

  const todayKey = getFirestoreBillingDayKey(new Date());
  const monthStart = todayKey.slice(0, 7) + '-01';
  const weekStart = shiftFirestoreBillingDayKey(todayKey, -6);
  const range = useMemo<UsageReportRange>(() => ({
    period: 'monthly',
    startDayKey: monthStart < weekStart ? monthStart : weekStart,
    endDayKey: todayKey,
    label: 'Custos estimados: últimas semanas',
  }), [monthStart, todayKey, weekStart]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Somente a consulta existente aos snapshots diários; sem listener,
      // polling, consulta por UG ou gravações adicionais.
      setHistory(await loadGlobalUsageHistory(range));
    } catch (error) {
      setHistory([]);
      setLoadError(error instanceof Error ? error.message : 'Histórico indisponível.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void refresh(); }, [refresh]);

  const prices = {
    read: usdRate(readPrice),
    realtime: usdRate(realtimePrice),
    write: usdRate(writePrice),
  };
  const pricesValid = Object.values(prices).every(Number.isFinite);
  const fx = usdRate(usdBrl);
  const fxValid = usdBrl.trim() !== '' && Number.isFinite(fx) && fx > 0;

  const projection = useMemo(() => {
    const points = history.map((point) => ({ ...point }));
    if (globalUsage) {
      points.push({
        dayKey: getFirestoreBillingDayKey(new Date(globalUsage.windowStartedAt)),
        billableReadUnits: globalUsage.billableReadUnits,
        billableRealtimeReadUnits: globalUsage.billableRealtimeReadUnits,
        billableWriteUnits: globalUsage.billableWriteUnits,
        readUnitsDailyLimit: globalUsage.billingReference.readUnitsDailyLimit,
        realtimeReadUnitsDailyLimit: globalUsage.billingReference.realtimeReadUnitsDailyLimit,
        writeUnitsDailyLimit: globalUsage.billingReference.writeUnitsDailyLimit,
        metricsComplete: true,
        documentReads: globalUsage.documentReads,
        documentWrites: globalUsage.documentWrites,
        documentDeletes: globalUsage.documentDeletes,
        readQuotaPercentage: 0,
        observedAt: globalUsage.windowEndedAt,
        dataThrough: globalUsageDataThrough,
      });
    }
    return estimateFirestoreOperationCosts({
      points,
      todayDayKey: todayKey,
      prices,
      usdToBrl: fxValid ? fx : null,
      applyFreeTier,
    });
  // Only re-evaluate on substantive changes; no new remote fetch.
  }, [
    history, globalUsage, globalUsageDataThrough, todayKey,
    readPrice, realtimePrice, writePrice, fx, fxValid, applyFreeTier,
  ]);

  const ready = pricesValid && fxValid;
  const incomplete = projection.week.missingDays > 0 || projection.monthToDate.missingDays > 0;

  return (
    <section className="space-y-4" data-testid="admin-firestore-cost-estimator">
      <header className="rounded-2xl border border-blue-200 bg-[#eff6ff] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-extrabold text-[#153960]">
              <Calculator className="h-4 w-4" /> Quanto custa o uso do Firestore?
            </p>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-[#3c5879]">
              Simulação parcial do consumo do banco inteiro, não é fatura.
              Usa Read Units, Write Units e atualizações em tempo real captadas pelo Google.
              O Google pode cobrar também armazenamento, rede, eventos, exclusões gerenciadas, backups e outros serviços.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#1b4b87] disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Atualizar histórico
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-blue-200 bg-white p-4">
        <p className="text-sm font-extrabold text-[#153960]">Configure os preços usados na simulação</p>
        <p className="mt-1 text-xs leading-5 text-[#587694]">
          Referência inicial: edição Enterprise, Iowa (us-central1), tabela pública em USD de 19/10/2026,
          sem descontos. <strong>Não identificamos automaticamente a edição, região, SKUs contratados nem o câmbio efetivo.</strong>
          Confirme e ajuste os valores antes de interpretar a estimativa.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            { id: 'firestore-fx', label: '1 dólar em reais', value: usdBrl, set: setUsdBrl, placeholder: 'Informe o câmbio' },
            { id: 'firestore-read-price', label: 'Read Units · USD / 1 milhão', value: readPrice, set: setReadPrice, placeholder: '0.05' },
            { id: 'firestore-write-price', label: 'Write Units · USD / 1 milhão', value: writePrice, set: setWritePrice, placeholder: '0.26' },
            { id: 'firestore-realtime-price', label: 'Tempo real · USD / 1 milhão', value: realtimePrice, set: setRealtimePrice, placeholder: '0.30' },
          ] as const).map((field) => (
            <label htmlFor={field.id} key={field.id} className="text-[11px] font-bold text-[#1b4b87]">
              {field.label}
              <input id={field.id} type="number" min="0" step="any" inputMode="decimal"
                value={field.value} placeholder={field.placeholder}
                onChange={(event) => field.set(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-blue-200 bg-[#f7fbff] px-3 py-2 text-sm text-[#153960]" />
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#3c5879]">
          <input type="checkbox" checked={applyFreeTier} onChange={(event) => setApplyFreeTier(event.target.checked)}
            className="mt-1 accent-[#1b4b87]" />
          <span><strong>Aplicar franquias gratuitas diárias.</strong> Ative somente se confirmou que este banco é elegível.
            Por segurança, elas ficam desativadas inicialmente. O modelo desconta cada franquia em cada dia, não no mês inteiro.</span>
        </label>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-[#1b4b87]">
          <a href={PRICE_SOURCE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
            Tabela oficial de preços <ExternalLink className="h-3 w-3" />
          </a>
          <a href={BILLING_SOURCE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
            Consultar cobrança oficial <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {!fxValid && <p className="text-xs font-bold text-amber-800">Informe o câmbio USD → BRL para calcular os valores em reais. Não usamos uma cotação fictícia.</p>}
      {!pricesValid && <p className="text-xs font-bold text-amber-800">Corrija as tarifas: todos os preços devem ser números não negativos.</p>}
      {loadError && <p className="text-xs text-rose-800">Falha ao carregar histórico: {loadError}. As janelas anteriores podem estar incompletas.</p>}
      {loading && <p className="text-xs text-[#587694]">Consultando snapshots diários existentes…</p>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CostCard title="Hoje (parcial)" summary={projection.today} ready={ready}
          note={projection.today.observedDays ? 'Até o último registro recebido do Google.' : 'Não há registro válido para o dia de cobrança atual.'} />
        <CostCard title="Últimos 7 dias" summary={projection.week} ready={ready}
          note={projection.week.observedDays + ' de 7 dias com dados; lacunas não são tratadas como consumo zero.'} />
        <CostCard title="Mês até agora" summary={projection.monthToDate} ready={ready}
          note={projection.monthToDate.observedDays + ' de ' + projection.monthToDate.expectedDays + ' dias com dados.'} />
        <CostCard title="Projeção do mês" summary={projection.forecast} ready={ready}
          note={projection.forecast.eligible
            ? 'Tendência baseada em dias registrados; hoje não foi extrapolado como dia completo.'
            : 'Sem projeção: exigidos 3 dias anteriores e cobertura de pelo menos 80% do período, além do dia atual.'} />
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
        {incomplete ? 'Histórico incompleto: os totais exibidos incluem apenas dias com medição válida. ' : ''}
        Referência diária: horário do Pacífico (America/Los_Angeles).
        Última informação do Google: {globalUsageDataThrough
          ? new Date(globalUsageDataThrough).toLocaleString('pt-BR')
          : 'não disponível'}.
        As tarifas são parâmetros editáveis; o cálculo não consulta preços, câmbio ou Cloud Billing automaticamente.
        Valores em reais não incluem impostos, créditos ou outros SKUs. Não existe custo financeiro medido por UG.
      </p>
    </section>
  );
}
