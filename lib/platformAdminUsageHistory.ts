'use client';

import {
  Timestamp,
  collection,
  documentId,
  endAt,
  getDocs,
  orderBy,
  query,
  startAt,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  getFirestoreBillingDayKey,
  shiftFirestoreBillingDayKey,
} from './firestoreBillingDay';
import { USAGE_TELEMETRY_VERSION } from './platformCapacity';
import { WORKSPACE_USAGE_SOURCE } from './workspaceUsageTelemetry';

export type UsageReportPeriod = 'daily' | 'weekly' | 'monthly' | 'annual';

export interface UsageReportRange {
  period: UsageReportPeriod;
  startDayKey: string;
  endDayKey: string;
  label: string;
}

export interface GlobalUsageHistoryPoint {
  dayKey: string;
  billableReadUnits: number;
  billableRealtimeReadUnits: number;
  billableWriteUnits: number;
  documentReads: number;
  documentWrites: number;
  documentDeletes: number;
  readUnitsDailyLimit: number;
  realtimeReadUnitsDailyLimit: number;
  writeUnitsDailyLimit: number;
  readQuotaPercentage: number;
  observedAt: string | null;
  dataThrough: string | null;
}

export interface WorkspaceUsageHistoryPoint {
  workspaceId: string;
  ug: string;
  dayKey: string;
  estimatedDocumentReads: number;
  estimatedDocumentWrites: number;
  estimatedDocumentDeletes: number;
  realtimeSnapshots: number;
  peakRealtimeListeners: number;
  telemetryFlushes: number;
  lastReportedAt: string | null;
}

export function getUsageReportRange(
  period: UsageReportPeriod,
  now = new Date()
): UsageReportRange {
  const endDayKey = getFirestoreBillingDayKey(now);
  const [year, month] = endDayKey.split('-');
  let startDayKey = endDayKey;
  let label = 'Hoje';

  if (period === 'weekly') {
    startDayKey = shiftFirestoreBillingDayKey(endDayKey, -6);
    label = 'Últimos 7 dias';
  } else if (period === 'monthly') {
    startDayKey = `${year}-${month}-01`;
    label = 'Mês atual';
  } else if (period === 'annual') {
    startDayKey = `${year}-01-01`;
    label = `Ano ${year}`;
  }

  return {
    period,
    startDayKey,
    endDayKey,
    label,
  };
}

function safeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isoTimestamp(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function loadGlobalUsageHistory(
  range: UsageReportRange
): Promise<GlobalUsageHistoryPoint[]> {
  const snapshot = await getDocs(query(
    collection(db, 'platformUsageHistory'),
    orderBy(documentId()),
    startAt(range.startDayKey),
    endAt(range.endDayKey)
  ));

  return snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    const readUnitsDailyLimit = safeCount(data.readUnitsDailyLimit);
    const billableReadUnits = safeCount(data.billableReadUnits);

    return {
      dayKey: item.id,
      billableReadUnits,
      billableRealtimeReadUnits: safeCount(data.billableRealtimeReadUnits),
      billableWriteUnits: safeCount(data.billableWriteUnits),
      documentReads: safeCount(data.documentReads),
      documentWrites: safeCount(data.documentWrites),
      documentDeletes: safeCount(data.documentDeletes),
      readUnitsDailyLimit,
      realtimeReadUnitsDailyLimit: safeCount(data.realtimeReadUnitsDailyLimit),
      writeUnitsDailyLimit: safeCount(data.writeUnitsDailyLimit),
      readQuotaPercentage: Number.isFinite(Number(data.readQuotaPercentage))
        ? Number(data.readQuotaPercentage)
        : readUnitsDailyLimit > 0
          ? (billableReadUnits / readUnitsDailyLimit) * 100
          : 0,
      observedAt: isoTimestamp(data.observedAt),
      dataThrough: isoTimestamp(data.dataThrough),
    };
  });
}

export async function loadWorkspaceUsageHistory(
  workspaceId: string,
  ug: string,
  range: UsageReportRange
): Promise<WorkspaceUsageHistoryPoint[]> {
  const snapshot = await getDocs(query(
    collection(db, 'workspaces', workspaceId, 'usageEstimates'),
    orderBy(documentId()),
    startAt(range.startDayKey),
    endAt(range.endDayKey)
  ));

  return snapshot.docs
    .map((item) => {
      const data = item.data() as Record<string, unknown>;
      const validIdentity = (
        data.telemetryVersion === USAGE_TELEMETRY_VERSION
        && data.source === WORKSPACE_USAGE_SOURCE
        && data.workspaceId === workspaceId
        && data.ug === ug
        && data.dayKey === item.id
      );

      if (!validIdentity) return null;

      return {
        workspaceId,
        ug,
        dayKey: item.id,
        estimatedDocumentReads: safeCount(data.estimatedDocumentReads),
        estimatedDocumentWrites: safeCount(data.estimatedDocumentWrites),
        estimatedDocumentDeletes: safeCount(data.estimatedDocumentDeletes),
        realtimeSnapshots: safeCount(data.realtimeSnapshots),
        peakRealtimeListeners: safeCount(data.peakRealtimeListeners),
        telemetryFlushes: safeCount(data.telemetryFlushes),
        lastReportedAt: isoTimestamp(data.lastReportedAt),
      } satisfies WorkspaceUsageHistoryPoint;
    })
    .filter((value): value is WorkspaceUsageHistoryPoint => Boolean(value));
}
