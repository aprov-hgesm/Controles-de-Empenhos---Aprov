'use client';

import { auth } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import {
  recordWorkspaceDocumentReads,
  recordWorkspaceDocumentWrites,
} from '../workspaceUsageTelemetry';

function usageScope(workspaceId: string): { workspaceId: string; ug: string } | null {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const operational = getCurrentOperationalScope(user.uid);
    const normalized = normalizeWorkspaceId(workspaceId);
    if (operational.workspaceId !== normalized || !operational.ug) return null;
    return { workspaceId: normalized, ug: operational.ug };
  } catch {
    return null;
  }
}

export function recordWarehouseDocumentReads(workspaceId: string, count: number): void {
  if (!Number.isFinite(count) || count <= 0) return;
  const scope = usageScope(workspaceId);
  if (!scope) return;
  try {
    recordWorkspaceDocumentReads(scope, Math.floor(count));
  } catch {
    // Telemetria é best-effort e nunca pode bloquear o ADM Depósito.
  }
}

export function recordWarehouseDocumentWrites(workspaceId: string, count: number): void {
  if (!Number.isFinite(count) || count <= 0) return;
  const scope = usageScope(workspaceId);
  if (!scope) return;
  try {
    recordWorkspaceDocumentWrites(scope, Math.floor(count));
  } catch {
    // Telemetria é best-effort e nunca pode bloquear o ADM Depósito.
  }
}
