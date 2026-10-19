export interface FirestoreCostPoint {
  dayKey: string;
  billableReadUnits: number;
  billableRealtimeReadUnits: number;
  billableWriteUnits: number;
  readUnitsDailyLimit?: number;
  realtimeReadUnitsDailyLimit?: number;
  writeUnitsDailyLimit?: number;
  metricsComplete?: boolean;
}
export interface FirestoreCostPrices {
  read: number;
  realtime: number;
  write: number;
}
export interface FirestoreCostSummary {
  usd: number | null;
  brl: number | null;
  observedDays: number;
  expectedDays: number;
  missingDays: number;
}
export function estimateFirestoreDailyUsd(
  point: FirestoreCostPoint,
  prices: FirestoreCostPrices,
  applyFreeTier?: boolean
): number | null;
export function estimateFirestoreOperationCosts(input: {
  points: FirestoreCostPoint[];
  todayDayKey: string;
  prices: FirestoreCostPrices;
  usdToBrl?: number | null;
  applyFreeTier?: boolean;
}): {
  today: FirestoreCostSummary;
  week: FirestoreCostSummary;
  monthToDate: FirestoreCostSummary;
  forecast: {
    usd: number | null;
    brl: number | null;
    pastDaysObserved: number;
    pastDaysExpected: number;
    eligible: boolean;
    totalMonthDays: number;
  };
  usdToBrl: number | null;
  applyFreeTier: boolean;
};
