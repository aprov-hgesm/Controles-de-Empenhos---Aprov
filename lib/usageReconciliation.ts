import type { AdminWorkspaceUsageEstimate } from './platformAdminUsage';
import type { FirebaseGlobalUsageSnapshot } from './platformCapacity';
import { getFirestoreBillingDayKey } from './firestoreBillingDay';

export const USAGE_RECONCILIATION_VERSION = 'emprovex_usage_reconciliation_v1' as const;

export interface UsageCoverage {
  globalObserved: number;
  attributed: number;
  unattributed: number;
  overAttributed: number;
  ratio: number | null;
  percentage: number | null;
}

export interface WorkspaceUsageReconciliationRow {
  workspaceId: string;
  ug: string;
  dayKey: string;
  reads: number;
  writes: number;
  deletes: number;
  snapshots: number;
  readShareOfAttributed: number | null;
  writeShareOfAttributed: number | null;
  estimatedBillableReadUnits: number;
  estimatedBillableWriteUnits: number;
}

export interface UsageReconciliation {
  reconciliationVersion: typeof USAGE_RECONCILIATION_VERSION;
  billingDayKey: string;
  alignedUsageCount: number;
  mismatchedUsageCount: number;
  readCoverage: UsageCoverage;
  writeCoverage: UsageCoverage;
  estimatedAttributedReadUnits: number;
  estimatedUnattributedReadUnits: number;
  estimatedAttributedWriteUnits: number;
  estimatedUnattributedWriteUnits: number;
  rows: WorkspaceUsageReconciliationRow[];
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function coverage(globalObserved: number, attributed: number): UsageCoverage {
  const globalValue = nonNegative(globalObserved);
  const attributedValue = nonNegative(attributed);
  const unattributed = Math.max(0, globalValue - attributedValue);
  const overAttributed = Math.max(0, attributedValue - globalValue);
  const ratio = globalValue > 0 ? attributedValue / globalValue : null;

  return {
    globalObserved: globalValue,
    attributed: attributedValue,
    unattributed,
    overAttributed,
    ratio,
    percentage: ratio === null ? null : ratio * 100,
  };
}

function allocatableUnits(
  globalUnits: number,
  coverageValue: UsageCoverage
): { attributed: number; unattributed: number } {
  const units = nonNegative(globalUnits);
  if (units === 0 || coverageValue.globalObserved === 0) {
    return { attributed: 0, unattributed: units };
  }

  const boundedCoverage = Math.min(
    1,
    coverageValue.attributed / coverageValue.globalObserved
  );
  const attributed = units * boundedCoverage;
  return {
    attributed,
    unattributed: Math.max(0, units - attributed),
  };
}

export function buildUsageReconciliation(
  globalUsage: FirebaseGlobalUsageSnapshot,
  usage: AdminWorkspaceUsageEstimate[]
): UsageReconciliation {
  const billingDayKey = getFirestoreBillingDayKey(
    new Date(globalUsage.windowStartedAt)
  );
  const aligned = usage.filter((item) => item.dayKey === billingDayKey);
  const mismatchedUsageCount = usage.length - aligned.length;

  const totalReads = aligned.reduce(
    (sum, item) => sum + nonNegative(item.estimatedDocumentReads),
    0
  );
  const totalWrites = aligned.reduce(
    (sum, item) => sum + nonNegative(item.estimatedDocumentWrites),
    0
  );

  const readCoverage = coverage(globalUsage.documentReads, totalReads);
  const writeCoverage = coverage(globalUsage.documentWrites, totalWrites);
  const readUnits = allocatableUnits(globalUsage.billableReadUnits, readCoverage);
  const writeUnits = allocatableUnits(globalUsage.billableWriteUnits, writeCoverage);

  const rows = aligned
    .map((item) => {
      const reads = nonNegative(item.estimatedDocumentReads);
      const writes = nonNegative(item.estimatedDocumentWrites);
      const readShareOfAttributed = totalReads > 0 ? reads / totalReads : null;
      const writeShareOfAttributed = totalWrites > 0 ? writes / totalWrites : null;

      return {
        workspaceId: item.workspaceId,
        ug: item.ug,
        dayKey: item.dayKey,
        reads,
        writes,
        deletes: nonNegative(item.estimatedDocumentDeletes),
        snapshots: nonNegative(item.realtimeSnapshots),
        readShareOfAttributed,
        writeShareOfAttributed,
        estimatedBillableReadUnits:
          readShareOfAttributed === null ? 0 : readUnits.attributed * readShareOfAttributed,
        estimatedBillableWriteUnits:
          writeShareOfAttributed === null ? 0 : writeUnits.attributed * writeShareOfAttributed,
      } satisfies WorkspaceUsageReconciliationRow;
    })
    .sort((left, right) => (
      right.estimatedBillableReadUnits - left.estimatedBillableReadUnits
      || right.reads - left.reads
      || left.ug.localeCompare(right.ug, 'pt-BR')
    ));

  return {
    reconciliationVersion: USAGE_RECONCILIATION_VERSION,
    billingDayKey,
    alignedUsageCount: aligned.length,
    mismatchedUsageCount,
    readCoverage,
    writeCoverage,
    estimatedAttributedReadUnits: readUnits.attributed,
    estimatedUnattributedReadUnits: readUnits.unattributed,
    estimatedAttributedWriteUnits: writeUnits.attributed,
    estimatedUnattributedWriteUnits: writeUnits.unattributed,
    rows,
  };
}
