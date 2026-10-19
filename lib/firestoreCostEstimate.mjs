/**
 * FIRESTORE-COST-R1: simulador local, sem acesso a Cloud Billing.
 * Unidade de preço: USD por 1.000.000 unidades faturáveis Enterprise.
 * Nunca distribua franquia diária entre dias ou UGs.
 */
const MILLION = 1_000_000;

function validNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function utcDay(dayKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return NaN;
  const millis = Date.parse(dayKey + 'T00:00:00Z');
  return Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === dayKey
    ? millis : NaN;
}

function shift(dayKey, days) {
  return new Date(utcDay(dayKey) + days * 86400000).toISOString().slice(0, 10);
}

function daySpan(from, to) {
  return Math.round((utcDay(to) - utcDay(from)) / 86400000) + 1;
}

/** Valores ausentes ou incompletos não significam zero. */
export function estimateFirestoreDailyUsd(point, prices, applyFreeTier = false) {
  if (!point || point.metricsComplete === false) return null;
  const keys = ['billableReadUnits', 'billableRealtimeReadUnits', 'billableWriteUnits'];
  if (!keys.every((key) => validNonNegative(point[key]))) return null;
  if (!prices || !['read', 'realtime', 'write'].every(
    (key) => validNonNegative(prices[key])
  )) return null;

  const billable = keys.map((key, index) => {
    if (!applyFreeTier) return point[key];
    const limitKey = ['readUnitsDailyLimit', 'realtimeReadUnitsDailyLimit', 'writeUnitsDailyLimit'][index];
    if (!validNonNegative(point[limitKey])) return null;
    return Math.max(0, point[key] - point[limitKey]);
  });
  if (billable.some((value) => value === null)) return null;
  return (billable[0] * prices.read + billable[1] * prices.realtime
    + billable[2] * prices.write) / MILLION;
}

/**
 * Projeção: mínimo de 3 dias anteriores observados e >=80% dos dias anteriores
 * deste mês. Usa média passada para os dias ainda sem observação, sem alegar
 * conhecimento da parte restante do dia em curso.
 */
export function estimateFirestoreOperationCosts({
  points, todayDayKey, prices, usdToBrl = null, applyFreeTier = false,
}) {
  if (!Number.isFinite(utcDay(todayDayKey))) {
    throw new Error('Dia de referência inválido.');
  }
  const convert = validNonNegative(usdToBrl) && usdToBrl > 0 ? usdToBrl : null;
  const [year, month] = todayDayKey.split('-').map(Number);
  const monthStart = todayDayKey.slice(0, 7) + '-01';
  const weekStart = shift(todayDayKey, -6);
  const totalMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysElapsed = daySpan(monthStart, todayDayKey);

  // O snapshot ao vivo deve vir por último para substituir o histórico do mesmo dia.
  const byDay = new Map();
  for (const point of Array.isArray(points) ? points : []) {
    if (!point || !Number.isFinite(utcDay(point.dayKey)) || point.dayKey > todayDayKey) continue;
    byDay.set(point.dayKey, point);
  }
  const dailyUsd = new Map();
  for (const [dayKey, point] of byDay) {
    const value = estimateFirestoreDailyUsd(point, prices, applyFreeTier);
    if (value !== null) dailyUsd.set(dayKey, value);
  }

  function summarize(startDayKey, endDayKey) {
    let usd = 0;
    let observedDays = 0;
    for (const [dayKey, value] of dailyUsd) {
      if (dayKey < startDayKey || dayKey > endDayKey) continue;
      usd += value;
      observedDays++;
    }
    const expectedDays = daySpan(startDayKey, endDayKey);
    return {
      usd: observedDays ? usd : null,
      brl: observedDays && convert !== null ? usd * convert : null,
      observedDays, expectedDays, missingDays: expectedDays - observedDays,
    };
  }

  const today = summarize(todayDayKey, todayDayKey);
  const week = summarize(weekStart, todayDayKey);
  const monthToDate = summarize(monthStart, todayDayKey);
  const previousDay = shift(todayDayKey, -1);
  const previousDays = daysElapsed - 1;
  const past = previousDays > 0 ? summarize(monthStart, previousDay) : null;
  const enoughHistory = past && past.observedDays >= 3
    && past.observedDays / previousDays >= 0.8
    && today.observedDays === 1;
  const forecastUsd = enoughHistory
    ? monthToDate.usd + (past.usd / past.observedDays) * (totalMonthDays - monthToDate.observedDays)
    : null;

  return {
    today,
    week,
    monthToDate,
    forecast: {
      usd: forecastUsd,
      brl: forecastUsd !== null && convert !== null ? forecastUsd * convert : null,
      pastDaysObserved: past?.observedDays ?? 0,
      pastDaysExpected: previousDays,
      eligible: Boolean(enoughHistory),
      totalMonthDays,
    },
    usdToBrl: convert,
    applyFreeTier,
  };
}
