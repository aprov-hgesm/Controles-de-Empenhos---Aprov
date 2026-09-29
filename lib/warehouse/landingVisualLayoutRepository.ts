import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import { recordWarehouseDocumentReads, recordWarehouseDocumentWrites } from './telemetry';
import { warehouseDocumentPath } from './namespace';

export const WAREHOUSE_LANDING_VISUAL_SETTINGS_ID = 'landing-visual-layout';
export const WAREHOUSE_LANDING_VISUAL_SCHEMA_VERSION =
  'warehouse_landing_visual_layout_v1' as const;

export interface WarehouseLandingVisualTransform {
  offsetX: number;
  offsetY: number;
}

export type WarehouseLandingVisualOverrides =
  Record<string, WarehouseLandingVisualTransform>;

export interface WarehouseLandingVisualSettings {
  schemaVersion: typeof WAREHOUSE_LANDING_VISUAL_SCHEMA_VERSION;
  workspaceId: string;
  ug: string;
  overrides: WarehouseLandingVisualOverrides;
  updatedBy: string;
  updatedAt: string | null;
}

const DEPOT_ID_PATTERN = /^dep_[a-f0-9]{32}$/;
const MAX_DEPOTS = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeWarehouseLandingVisualOverrides(
  value: unknown
): WarehouseLandingVisualOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const output: WarehouseLandingVisualOverrides = {};
  for (const [depotId, raw] of Object.entries(value as Record<string, unknown>).slice(0, MAX_DEPOTS)) {
    if (!DEPOT_ID_PATTERN.test(depotId) || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }

    const candidate = raw as Record<string, unknown>;
    output[depotId] = {
      offsetX: clamp(finite(candidate.offsetX, 0), -500, 500),
      offsetY: clamp(finite(candidate.offsetY, 0), -380, 380),
    };
  }

  return output;
}

function timestampToIso(value: unknown): string | null {
  if (
    value
    && typeof value === 'object'
    && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function currentScopeForWorkspace(workspaceId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('WAREHOUSE_LANDING_VISUAL_AUTH_REQUIRED');

  const scope = getCurrentOperationalScope(currentUser.uid);
  const normalized = normalizeWorkspaceId(workspaceId);
  if (scope.workspaceId !== normalized) {
    throw new Error('WAREHOUSE_LANDING_VISUAL_WORKSPACE_MISMATCH');
  }
  if (!scope.ug) throw new Error('WAREHOUSE_LANDING_VISUAL_UG_REQUIRED');
  const ug = scope.ug;

  return { currentUser, scope, workspaceId: normalized, ug };
}

export async function getWarehouseLandingVisualLayout(
  workspaceId: string
): Promise<WarehouseLandingVisualSettings | null> {
  const { workspaceId: normalized } = currentScopeForWorkspace(workspaceId);
  const path = warehouseDocumentPath(
    normalized,
    'settings',
    WAREHOUSE_LANDING_VISUAL_SETTINGS_ID
  );

  try {
    const snapshot = await getDoc(doc(db, path));
    recordWarehouseDocumentReads(normalized, 1);
    if (!snapshot.exists()) return null;

    const data = snapshot.data() as Record<string, unknown>;
    if (
      data.schemaVersion !== WAREHOUSE_LANDING_VISUAL_SCHEMA_VERSION
      || data.workspaceId !== normalized
      || typeof data.ug !== 'string'
      || !/^\d{6}$/.test(data.ug)
      || typeof data.arrangementJson !== 'string'
    ) {
      return null;
    }

    let parsed: unknown = {};
    try {
      parsed = JSON.parse(data.arrangementJson);
    } catch {
      parsed = {};
    }

    return {
      schemaVersion: WAREHOUSE_LANDING_VISUAL_SCHEMA_VERSION,
      workspaceId: normalized,
      ug: data.ug,
      overrides: normalizeWarehouseLandingVisualOverrides(parsed),
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
      updatedAt: timestampToIso(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function saveWarehouseLandingVisualLayout(
  workspaceId: string,
  overrides: WarehouseLandingVisualOverrides
): Promise<WarehouseLandingVisualSettings> {
  const { currentUser, ug, workspaceId: normalized } =
    currentScopeForWorkspace(workspaceId);

  const canonical = normalizeWarehouseLandingVisualOverrides(overrides);
  const arrangementJson = JSON.stringify(canonical);
  const path = warehouseDocumentPath(
    normalized,
    'settings',
    WAREHOUSE_LANDING_VISUAL_SETTINGS_ID
  );

  try {
    await setDoc(doc(db, path), {
      schemaVersion: WAREHOUSE_LANDING_VISUAL_SCHEMA_VERSION,
      workspaceId: normalized,
      ug,
      arrangementJson,
      updatedBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    });
    recordWarehouseDocumentWrites(normalized, 1);

    return {
      schemaVersion: WAREHOUSE_LANDING_VISUAL_SCHEMA_VERSION,
      workspaceId: normalized,
      ug,
      overrides: canonical,
      updatedBy: currentUser.uid,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
