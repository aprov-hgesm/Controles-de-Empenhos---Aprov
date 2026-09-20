'use client';

import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from './firebase';
import { USAGE_TELEMETRY_VERSION } from './platformCapacity';
import { isValidUnitUg } from './platformIdentity';

export const WORKSPACE_USAGE_SOURCE = 'emprovex-workspace-estimate' as const;
export const WORKSPACE_USAGE_INITIAL_FLUSH_MS = 60 * 1000;
export const WORKSPACE_USAGE_FLUSH_INTERVAL_MS = 15 * 60 * 1000;
export const WORKSPACE_USAGE_RETRY_MS = 5 * 60 * 1000;

interface WorkspaceUsageScope {
  workspaceId: string;
  ug: string | null;
}

export interface WorkspaceUsageDelta {
  documentReads?: number;
  documentWrites?: number;
  documentDeletes?: number;
  realtimeSnapshots?: number;
}

interface PendingWorkspaceUsage {
  workspaceId: string;
  ug: string;
  dayKey: string;
  estimatedDocumentReads: number;
  estimatedDocumentWrites: number;
  estimatedDocumentDeletes: number;
  realtimeSnapshots: number;
  peakRealtimeListeners: number;
  lastReportedPeakRealtimeListeners: number;
  hasReported: boolean;
}

const STORAGE_PREFIX = 'emprovex:usage:v1:';
const pendingByKey = new Map<string, PendingWorkspaceUsage>();
const flushTimers = new Map<string, number>();
const flushInFlight = new Set<string>();
const activeListenersByScope = new Map<string, number>();

function safeSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getWorkspaceUsageDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function buildUsageKey(scope: WorkspaceUsageScope, dayKey: string): string {
  return `${scope.workspaceId}:${dayKey}`;
}

function buildStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function normalizeCount(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value <= 0) return 0;
  return Math.floor(value);
}

function isValidScope(scope: WorkspaceUsageScope): scope is { workspaceId: string; ug: string } {
  return Boolean(
    scope.workspaceId
    && scope.ug
    && isValidUnitUg(scope.ug)
  );
}

function emptyPending(scope: { workspaceId: string; ug: string }, dayKey: string): PendingWorkspaceUsage {
  return {
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    dayKey,
    estimatedDocumentReads: 0,
    estimatedDocumentWrites: 0,
    estimatedDocumentDeletes: 0,
    realtimeSnapshots: 0,
    peakRealtimeListeners: 0,
    lastReportedPeakRealtimeListeners: 0,
    hasReported: false,
  };
}

function loadPending(
  scope: { workspaceId: string; ug: string },
  dayKey: string
): PendingWorkspaceUsage {
  const key = buildUsageKey(scope, dayKey);
  const cached = pendingByKey.get(key);
  if (cached) return cached;

  const storage = safeSessionStorage();
  if (storage) {
    try {
      const raw = storage.getItem(buildStorageKey(key));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PendingWorkspaceUsage>;
        if (
          parsed.workspaceId === scope.workspaceId
          && parsed.ug === scope.ug
          && parsed.dayKey === dayKey
        ) {
          const restored: PendingWorkspaceUsage = {
            ...emptyPending(scope, dayKey),
            estimatedDocumentReads: normalizeCount(parsed.estimatedDocumentReads),
            estimatedDocumentWrites: normalizeCount(parsed.estimatedDocumentWrites),
            estimatedDocumentDeletes: normalizeCount(parsed.estimatedDocumentDeletes),
            realtimeSnapshots: normalizeCount(parsed.realtimeSnapshots),
            peakRealtimeListeners: normalizeCount(parsed.peakRealtimeListeners),
            lastReportedPeakRealtimeListeners: normalizeCount(
              parsed.lastReportedPeakRealtimeListeners
            ),
            hasReported: parsed.hasReported === true,
          };
          pendingByKey.set(key, restored);
          return restored;
        }
      }
    } catch {
      // Telemetry must never interfere with the operational flow.
    }
  }

  const created = emptyPending(scope, dayKey);
  pendingByKey.set(key, created);
  return created;
}

function persistPending(key: string, pending: PendingWorkspaceUsage): void {
  pendingByKey.set(key, pending);
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(buildStorageKey(key), JSON.stringify(pending));
  } catch {
    // Best-effort local buffering only.
  }
}

function hasDirtyUsage(pending: PendingWorkspaceUsage): boolean {
  return pending.estimatedDocumentReads > 0
    || pending.estimatedDocumentWrites > 0
    || pending.estimatedDocumentDeletes > 0
    || pending.realtimeSnapshots > 0
    || pending.peakRealtimeListeners > pending.lastReportedPeakRealtimeListeners;
}

function scheduleFlush(
  scope: { workspaceId: string; ug: string },
  dayKey: string,
  delayMs: number
): void {
  if (typeof window === 'undefined') return;
  const key = buildUsageKey(scope, dayKey);
  if (flushTimers.has(key) || flushInFlight.has(key)) return;

  const timer = window.setTimeout(() => {
    flushTimers.delete(key);
    void flushWorkspaceUsageTelemetry(scope, dayKey);
  }, delayMs);

  flushTimers.set(key, timer);
}

export function recordWorkspaceUsage(
  scope: WorkspaceUsageScope,
  delta: WorkspaceUsageDelta
): void {
  if (!isValidScope(scope)) return;

  const dayKey = getWorkspaceUsageDayKey();
  const key = buildUsageKey(scope, dayKey);
  const pending = loadPending(scope, dayKey);

  pending.estimatedDocumentReads += normalizeCount(delta.documentReads);
  pending.estimatedDocumentWrites += normalizeCount(delta.documentWrites);
  pending.estimatedDocumentDeletes += normalizeCount(delta.documentDeletes);
  pending.realtimeSnapshots += normalizeCount(delta.realtimeSnapshots);

  persistPending(key, pending);

  if (hasDirtyUsage(pending)) {
    scheduleFlush(
      scope,
      dayKey,
      pending.hasReported
        ? WORKSPACE_USAGE_FLUSH_INTERVAL_MS
        : WORKSPACE_USAGE_INITIAL_FLUSH_MS
    );
  }
}

export function recordWorkspaceDocumentReads(
  scope: WorkspaceUsageScope,
  count = 1
): void {
  recordWorkspaceUsage(scope, { documentReads: count });
}

export function recordWorkspaceDocumentWrites(
  scope: WorkspaceUsageScope,
  count = 1
): void {
  recordWorkspaceUsage(scope, { documentWrites: count });
}

export function recordWorkspaceDocumentDeletes(
  scope: WorkspaceUsageScope,
  count = 1
): void {
  recordWorkspaceUsage(scope, { documentDeletes: count });
}

export function recordWorkspaceRealtimeSnapshot(
  scope: WorkspaceUsageScope,
  estimatedDocumentReads: number
): void {
  recordWorkspaceUsage(scope, {
    documentReads: estimatedDocumentReads,
    realtimeSnapshots: 1,
  });
}

export function trackWorkspaceRealtimeListener(
  scope: WorkspaceUsageScope
): () => void {
  if (!isValidScope(scope)) return () => undefined;

  const scopeKey = scope.workspaceId;
  const nextCount = (activeListenersByScope.get(scopeKey) || 0) + 1;
  activeListenersByScope.set(scopeKey, nextCount);

  const dayKey = getWorkspaceUsageDayKey();
  const key = buildUsageKey(scope, dayKey);
  const pending = loadPending(scope, dayKey);
  if (nextCount > pending.peakRealtimeListeners) {
    pending.peakRealtimeListeners = nextCount;
    persistPending(key, pending);
    scheduleFlush(
      scope,
      dayKey,
      pending.hasReported
        ? WORKSPACE_USAGE_FLUSH_INTERVAL_MS
        : WORKSPACE_USAGE_INITIAL_FLUSH_MS
    );
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const current = activeListenersByScope.get(scopeKey) || 0;
    if (current <= 1) {
      activeListenersByScope.delete(scopeKey);
    } else {
      activeListenersByScope.set(scopeKey, current - 1);
    }
  };
}

export async function flushWorkspaceUsageTelemetry(
  scope: WorkspaceUsageScope,
  requestedDayKey = getWorkspaceUsageDayKey()
): Promise<void> {
  if (!isValidScope(scope)) return;

  const key = buildUsageKey(scope, requestedDayKey);
  if (flushInFlight.has(key)) return;

  const pending = loadPending(scope, requestedDayKey);
  if (!hasDirtyUsage(pending)) return;

  const snapshot = {
    estimatedDocumentReads: pending.estimatedDocumentReads,
    estimatedDocumentWrites: pending.estimatedDocumentWrites,
    estimatedDocumentDeletes: pending.estimatedDocumentDeletes,
    realtimeSnapshots: pending.realtimeSnapshots,
    peakRealtimeListeners: pending.peakRealtimeListeners,
    peakDelta: Math.max(
      0,
      pending.peakRealtimeListeners - pending.lastReportedPeakRealtimeListeners
    ),
  };

  flushInFlight.add(key);

  try {
    await setDoc(
      doc(
        db,
        'workspaces',
        scope.workspaceId,
        'usageEstimates',
        requestedDayKey
      ),
      {
        telemetryVersion: USAGE_TELEMETRY_VERSION,
        source: WORKSPACE_USAGE_SOURCE,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        dayKey: requestedDayKey,
        windowStartedAt: `${requestedDayKey}T00:00:00.000Z`,
        windowEndedAt: `${requestedDayKey}T23:59:59.999Z`,
        estimatedDocumentReads: increment(snapshot.estimatedDocumentReads),
        estimatedDocumentWrites: increment(snapshot.estimatedDocumentWrites),
        estimatedDocumentDeletes: increment(snapshot.estimatedDocumentDeletes),
        realtimeSnapshots: increment(snapshot.realtimeSnapshots),
        peakRealtimeListeners: increment(snapshot.peakDelta),
        telemetryFlushes: increment(1),
        lastReportedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const current = loadPending(scope, requestedDayKey);
    current.estimatedDocumentReads = Math.max(
      0,
      current.estimatedDocumentReads - snapshot.estimatedDocumentReads
    );
    current.estimatedDocumentWrites = Math.max(
      0,
      current.estimatedDocumentWrites - snapshot.estimatedDocumentWrites
    );
    current.estimatedDocumentDeletes = Math.max(
      0,
      current.estimatedDocumentDeletes - snapshot.estimatedDocumentDeletes
    );
    current.realtimeSnapshots = Math.max(
      0,
      current.realtimeSnapshots - snapshot.realtimeSnapshots
    );
    current.lastReportedPeakRealtimeListeners = Math.max(
      current.lastReportedPeakRealtimeListeners,
      snapshot.peakRealtimeListeners
    );
    current.hasReported = true;
    persistPending(key, current);

    if (hasDirtyUsage(current)) {
      scheduleFlush(
        scope,
        requestedDayKey,
        WORKSPACE_USAGE_FLUSH_INTERVAL_MS
      );
    }
  } catch (error) {
    console.warn('Não foi possível consolidar a telemetria estimada da UG.', error);
    scheduleFlush(scope, requestedDayKey, WORKSPACE_USAGE_RETRY_MS);
  } finally {
    flushInFlight.delete(key);
  }
}
