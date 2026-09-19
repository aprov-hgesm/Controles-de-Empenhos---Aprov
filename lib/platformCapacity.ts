import { HGESM_SECTOR_EMAIL } from './hgesmWorkspace';
import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizePlatformEmail,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from './platformIdentity';

export const CAPACITY_POLICY_VERSION = 'emprovex_capacity_v1';
export const USAGE_TELEMETRY_VERSION = 'emprovex_usage_v1';

export const DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT = 2;

export type SimultaneousSessionLimit = number | null;

export type UsageBudgetLevel =
  | 'unconfigured'
  | 'normal'
  | 'attention'
  | 'elevated'
  | 'critical'
  | 'exceeded';

export interface InternalDailyUsageBudget {
  documentReads: number | null;
  documentWrites: number | null;
  documentDeletes: number | null;
}

export interface WorkspaceCapacityPolicy {
  policyVersion: typeof CAPACITY_POLICY_VERSION;
  workspaceId: string;
  ug: string;
  /**
   * null = unlimited. This value is reserved for the founder identity.
   * External sectors default to DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT.
   */
  simultaneousSessionLimit: SimultaneousSessionLimit;
  dailyUsageBudget: InternalDailyUsageBudget;
}

export interface WorkspaceSessionLease {
  sessionId: string;
  workspaceId: string;
  ug: string;
  uid: string;
  accountEmail: string;
  browserInstanceId: string;
  startedAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface WorkspaceUsageEstimate {
  telemetryVersion: typeof USAGE_TELEMETRY_VERSION;
  source: 'emprovex-workspace-estimate';
  workspaceId: string;
  ug: string;
  windowStartedAt: string;
  windowEndedAt: string;
  estimatedDocumentReads: number;
  estimatedDocumentWrites: number;
  estimatedDocumentDeletes: number;
  realtimeSnapshots: number;
  peakRealtimeListeners: number;
  peakActiveSessions: number;
}

export interface FirebaseGlobalUsageSnapshot {
  telemetryVersion: typeof USAGE_TELEMETRY_VERSION;
  source: 'google-cloud-monitoring';
  projectId: string;
  databaseId: string;
  windowStartedAt: string;
  windowEndedAt: string;
  documentReads: number;
  documentWrites: number;
  documentDeletes: number;
  activeConnections: number;
  snapshotListeners: number;
}

export interface UsageBudgetAssessment {
  level: UsageBudgetLevel;
  ratio: number | null;
  percentage: number | null;
}

export function isFounderCapacityExempt(accountEmail?: string | null): boolean {
  if (!accountEmail) return false;
  return normalizePlatformEmail(accountEmail) === HGESM_SECTOR_EMAIL;
}

export function getDefaultSimultaneousSessionLimit(
  accountEmail?: string | null
): SimultaneousSessionLimit {
  return isFounderCapacityExempt(accountEmail)
    ? null
    : DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT;
}

export function createDefaultWorkspaceCapacityPolicy(input: {
  workspaceId: string;
  ug: string;
  authorizedEmail: string;
}): WorkspaceCapacityPolicy {
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const ug = normalizeUnitUg(input.ug);

  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('workspaceId inválido para política de capacidade.');
  }
  if (!isValidUnitUg(ug)) {
    throw new Error('UG inválida para política de capacidade.');
  }

  return {
    policyVersion: CAPACITY_POLICY_VERSION,
    workspaceId,
    ug,
    simultaneousSessionLimit: getDefaultSimultaneousSessionLimit(input.authorizedEmail),
    dailyUsageBudget: {
      documentReads: null,
      documentWrites: null,
      documentDeletes: null,
    },
  };
}

export function isValidConfiguredSessionLimit(
  value: SimultaneousSessionLimit
): boolean {
  return value === null || (Number.isSafeInteger(value) && value >= 1);
}

export function assessUsageBudget(
  used: number,
  budget: number | null
): UsageBudgetAssessment {
  if (!Number.isFinite(used) || used < 0) {
    throw new Error('Consumo utilizado deve ser um número não negativo.');
  }
  if (budget === null) {
    return { level: 'unconfigured', ratio: null, percentage: null };
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error('Orçamento interno deve ser positivo ou nulo.');
  }

  const ratio = used / budget;
  const percentage = ratio * 100;

  if (ratio > 1) return { level: 'exceeded', ratio, percentage };
  if (ratio >= 0.95) return { level: 'critical', ratio, percentage };
  if (ratio >= 0.85) return { level: 'elevated', ratio, percentage };
  if (ratio >= 0.7) return { level: 'attention', ratio, percentage };
  return { level: 'normal', ratio, percentage };
}
