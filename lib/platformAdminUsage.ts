'use client';

import {
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';

import { db } from './firebase';
import { USAGE_TELEMETRY_VERSION } from './platformCapacity';
import { isValidUnitUg, type Workspace } from './platformIdentity';
import {
  WORKSPACE_USAGE_SOURCE,
  WORKSPACE_USAGE_MODULES,
  type WorkspaceUsageModuleCounts,
  getWorkspaceUsageDayKey,
} from './workspaceUsageTelemetry';

export interface AdminWorkspaceUsageEstimate {
  workspaceId: string;
  ug: string;
  dayKey: string;
  hasTelemetry: boolean;
  moduleBreakdownAvailable: boolean;
  moduleOperations: WorkspaceUsageModuleCounts;
  source: typeof WORKSPACE_USAGE_SOURCE;
  estimatedDocumentReads: number;
  estimatedDocumentWrites: number;
  estimatedDocumentDeletes: number;
  realtimeSnapshots: number;
  peakRealtimeListeners: number;
  telemetryFlushes: number;
  lastReportedAt: string | null;
}

function safeCounter(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function readModuleOperations(value: unknown): WorkspaceUsageModuleCounts {
  const result: WorkspaceUsageModuleCounts = {
    empenhos: 0, notas: 0, deposito: 0, sessoes: 0, outros: 0,
  };
  if (!value || typeof value !== 'object') return result;
  for (const module of WORKSPACE_USAGE_MODULES) {
    result[module] = safeCounter((value as Record<string, unknown>)[module]);
  }
  return result;
}

function emptyUsage(workspace: Workspace, dayKey: string): AdminWorkspaceUsageEstimate {
  return {
    workspaceId: workspace.id,
    ug: workspace.ug || '',
    dayKey,
    hasTelemetry: false,
    moduleBreakdownAvailable: false,
    moduleOperations: readModuleOperations(null),
    source: WORKSPACE_USAGE_SOURCE,
    estimatedDocumentReads: 0,
    estimatedDocumentWrites: 0,
    estimatedDocumentDeletes: 0,
    realtimeSnapshots: 0,
    peakRealtimeListeners: 0,
    telemetryFlushes: 0,
    lastReportedAt: null,
  };
}

export async function loadPlatformWorkspaceUsage(
  workspaces: Workspace[],
  date = new Date()
): Promise<AdminWorkspaceUsageEstimate[]> {
  const dayKey = getWorkspaceUsageDayKey(date);
  const eligible = workspaces.filter(
    (workspace) => workspace.ug && isValidUnitUg(workspace.ug)
  );

  return Promise.all(
    eligible.map(async (workspace) => {
      const snapshot = await getDoc(
        doc(db, 'workspaces', workspace.id, 'usageEstimates', dayKey)
      );
      if (!snapshot.exists()) return emptyUsage(workspace, dayKey);

      const data = snapshot.data() as Record<string, unknown>;
      const validIdentity = (
        data.telemetryVersion === USAGE_TELEMETRY_VERSION
        && data.source === WORKSPACE_USAGE_SOURCE
        && data.workspaceId === workspace.id
        && data.ug === workspace.ug
        && data.dayKey === dayKey
      );

      if (!validIdentity) return emptyUsage(workspace, dayKey);

      return {
        workspaceId: workspace.id,
        ug: workspace.ug || '',
        dayKey,
        hasTelemetry: true,
        moduleBreakdownAvailable: Boolean(
          data.moduleOperations
          && typeof data.moduleOperations === 'object'
        ),
        moduleOperations: readModuleOperations(data.moduleOperations),
        source: WORKSPACE_USAGE_SOURCE,
        estimatedDocumentReads: safeCounter(data.estimatedDocumentReads),
        estimatedDocumentWrites: safeCounter(data.estimatedDocumentWrites),
        estimatedDocumentDeletes: safeCounter(data.estimatedDocumentDeletes),
        realtimeSnapshots: safeCounter(data.realtimeSnapshots),
        peakRealtimeListeners: safeCounter(data.peakRealtimeListeners),
        telemetryFlushes: safeCounter(data.telemetryFlushes),
        lastReportedAt: toIso(data.lastReportedAt),
      };
    })
  );
}
