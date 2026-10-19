import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  estimateFirestoreDailyUsd,
  estimateFirestoreOperationCosts,
} from '../lib/firestoreCostEstimate.mjs';

const prices = { read: 0.05, write: 0.26, realtime: 0.30 };
const point = (dayKey, reads = 100_000, writes = 80_000, realtime = 60_000) => ({
  dayKey,
  billableReadUnits: reads,
  billableWriteUnits: writes,
  billableRealtimeReadUnits: realtime,
  readUnitsDailyLimit: 50_000,
  writeUnitsDailyLimit: 40_000,
  realtimeReadUnitsDailyLimit: 50_000,
  metricsComplete: true,
});

test('tarifas Enterprise: três métricas faturáveis independentes, sem contagens de documentos', () => {
  assert.equal(estimateFirestoreDailyUsd(point('2026-10-19'), prices, false), 0.0438);
  assert.ok(Math.abs(estimateFirestoreDailyUsd(point('2026-10-19'), prices, true) - 0.0159) < 1e-12);
});

test('limites gratuitos por dia não são acumulados entre dias', () => {
  const p = [point('2026-10-18', 30_000, 0, 0), point('2026-10-19', 70_000, 0, 0)];
  const v = estimateFirestoreOperationCosts({
    points: p, todayDayKey: '2026-10-19', prices, applyFreeTier: true, usdToBrl: 5,
  });
  assert.ok(Math.abs(v.week.usd - 0.001) < 1e-12);
  assert.ok(Math.abs(v.week.brl - 0.005) < 1e-12);
  assert.equal(v.week.observedDays, 2);
  assert.equal(v.week.missingDays, 5);
});

test('franquia não pode ser estimada sem limite diário confiável', () => {
  assert.equal(estimateFirestoreDailyUsd({
    ...point('2026-10-19'), writeUnitsDailyLimit: undefined,
  }, prices, true), null);
});

test('histórico incompleto, ausente e duplicado não é interpretado como zero', () => {
  const result = estimateFirestoreOperationCosts({
    points: [
      point('2026-10-18'),
      { ...point('2026-10-19'), metricsComplete: false },
      point('2026-10-18', 200_000, 0, 0),
    ],
    todayDayKey: '2026-10-19', prices, usdToBrl: null,
  });
  assert.equal(result.today.usd, null);
  assert.equal(result.monthToDate.observedDays, 1);
  assert.equal(result.monthToDate.missingDays, 18);
  assert.equal(result.forecast.usd, null);
  assert.equal(result.week.brl, null);
});

test('não permite dia impossível ou dados de preço inválidos', () => {
  assert.equal(estimateFirestoreDailyUsd(point('2026-10-19', -1), prices), null);
  assert.equal(estimateFirestoreDailyUsd(point('2026-10-19'), { ...prices, read: -2 }), null);
  assert.throws(() => estimateFirestoreOperationCosts({
    todayDayKey: '2026-02-30', points: [], prices,
  }), /inválido/);
});

test('projeção exige pelo menos 3 dias passados e cobertura de 80%', () => {
  const observed = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((day) =>
    point(day, 1_000_000, 0, 0));
  const result = estimateFirestoreOperationCosts({
    todayDayKey: '2026-10-05',
    points: [...observed, point('2026-10-05', 0, 0, 0)],
    prices, usdToBrl: 5,
  });
  assert.equal(result.forecast.eligible, true);
  assert.ok(Math.abs(result.forecast.usd - (30 * 0.05)) < 1e-12);
  assert.ok(Math.abs(result.forecast.brl - (30 * 0.25)) < 1e-12);
  const insufficient = estimateFirestoreOperationCosts({
    todayDayKey: '2026-10-07', points: [...observed, point('2026-10-07')], prices,
  });
  assert.equal(insufficient.forecast.eligible, false);
});

test('não acrescenta listeners nem gravações para custo; mantém PR sem integração produtiva', () => {
  const view = readFileSync(new URL('../components/admin/AdminFirestoreCostPanel.tsx', import.meta.url), 'utf8');
  const hub = readFileSync(new URL('../components/admin/AdminConsumptionHub.tsx', import.meta.url), 'utf8');
  assert.match(view, /loadGlobalUsageHistory\(range\)/);
  assert.doesNotMatch(view, /onSnapshot|getDoc\(|getDocs\(|setDoc\(|updateDoc\(|addDoc\(|fetch\(/);
  assert.match(hub, /activeTab === 'cost'/);
  assert.match(view, /Consultar cobrança oficial/);
  assert.match(view, /Não existe custo financeiro medido por UG/);
});
