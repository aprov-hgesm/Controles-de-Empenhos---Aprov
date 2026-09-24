import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  getCurrentOperationalScope,
  getOperationalCollectionPath,
  operationalCollectionRef,
} from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import type { CronogramaEmpenho, Empenho, Invoice } from '../types';
import { listWarehouseBalances, listWarehouseMovements } from './ledgerRepository';
import { listWarehouseInventorySessions } from './inventoryRepository';
import { listWarehouseLocationBalances } from './locationRepository';
import { listWarehouseLots } from './lotRepository';
import { listWarehouseMaterials } from './materialRepository';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import { listWarehouseSiscofisSnapshots } from './siscofisService';
import {
  WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION,
  buildWarehouseDeliveryProjections,
  validateWarehouseLogisticsSettings,
  type WarehouseDeliveryProjection,
  type WarehouseLogisticsSettings,
} from './logistics';
import {
  WAREHOUSE_LOGISTICS_ALERT_SCHEMA_VERSION,
  buildWarehouseLogisticsAlertCandidates,
  buildWarehouseLogisticsDashboardSummary,
  type WarehouseLogisticsAlert,
  type WarehouseLogisticsAlertCandidate,
  type WarehouseLogisticsDashboardSummary,
  type WarehouseSiscofisAlertSnapshot,
} from './logisticsAlerts';
import type { WarehouseBalance, WarehouseMovement } from './movement';
import type { WarehouseMaterial } from './material';
import type { WarehouseLocationBalance } from './location';
import type { WarehouseLot } from './lot';
import type { WarehouseInventorySession } from './inventory';

export const WAREHOUSE_DELIVERIES_EMPENHOS_LIMIT = 250;
export const WAREHOUSE_DELIVERIES_CRONOGRAMAS_LIMIT = 250;
export const WAREHOUSE_DELIVERIES_INVOICES_LIMIT = 300;
export const WAREHOUSE_DASHBOARD_DOMAIN_LIMIT = 500;
export const WAREHOUSE_LOGISTICS_ALERT_LIMIT = 250;
export const WAREHOUSE_LOGISTICS_SETTINGS_ID = 'logistics-alerts';

interface BoundedResult<T> {
  items: T[];
  truncated: boolean;
}

export interface WarehouseDeliveriesContext {
  empenhos: Empenho[];
  cronogramas: CronogramaEmpenho[];
  invoices: Invoice[];
  balances: WarehouseBalance[];
  movements: WarehouseMovement[];
  projections: WarehouseDeliveryProjection[];
  truncated: boolean;
}

export interface WarehouseLogisticsDashboardContext extends WarehouseDeliveriesContext {
  materials: WarehouseMaterial[];
  locationBalances: WarehouseLocationBalance[];
  lots: WarehouseLot[];
  inventories: WarehouseInventorySession[];
  siscofisSnapshots: WarehouseSiscofisAlertSnapshot[];
  settings: WarehouseLogisticsSettings | null;
  summary: WarehouseLogisticsDashboardSummary;
  alertCandidates: WarehouseLogisticsAlertCandidate[];
}

function currentScopeForWorkspace(workspaceId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('WAREHOUSE_LOGISTICS_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(currentUser.uid);
  const expected = normalizeWorkspaceId(workspaceId);
  if (scope.workspaceId !== expected) throw new Error('WAREHOUSE_LOGISTICS_WORKSPACE_MISMATCH');
  return { currentUser, scope, workspaceId: expected };
}

async function listOperationalBounded<T>(
  workspaceId: string,
  collectionName: 'empenhos' | 'cronogramas' | 'invoices',
  maxResults: number
): Promise<BoundedResult<T>> {
  const { scope } = currentScopeForWorkspace(workspaceId);
  const path = getOperationalCollectionPath(scope, collectionName);
  try {
    const snapshot = await getDocs(
      query(operationalCollectionRef(scope, collectionName), limit(maxResults))
    );
    return {
      items: snapshot.docs.map((entry) => {
        const data = entry.data() as T & { id?: string; recordKey?: string };
        if (collectionName === 'invoices') {
          return { ...data, recordKey: data.recordKey || entry.id } as T;
        }
        return { ...data, id: data.id || entry.id } as T;
      }),
      truncated: snapshot.size >= maxResults,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
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

function slug(value: string): string {
  const normalized = value.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (normalized || 'entity').slice(0, 150);
}

export function createWarehouseLogisticsAlertId(
  candidate: Pick<WarehouseLogisticsAlertCandidate, 'kind' | 'entityId'>
): string {
  return 'logalert-' + candidate.kind.toLowerCase().replace(/_/g, '-') + '-' + slug(candidate.entityId);
}

function parseWarehouseLogisticsAlert(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLogisticsAlert {
  if (
    data.schemaVersion !== WAREHOUSE_LOGISTICS_ALERT_SCHEMA_VERSION
    || data.workspaceId !== workspaceId
    || data.id !== id
  ) {
    throw new Error('WAREHOUSE_LOGISTICS_ALERT_INVALID');
  }
  return {
    schemaVersion: WAREHOUSE_LOGISTICS_ALERT_SCHEMA_VERSION,
    id,
    workspaceId,
    ug: String(data.ug || ''),
    kind: data.kind as WarehouseLogisticsAlert['kind'],
    entityId: String(data.entityId || ''),
    empenhoId: typeof data.empenhoId === 'string' ? data.empenhoId : null,
    severity: data.severity as WarehouseLogisticsAlert['severity'],
    status: data.status as WarehouseLogisticsAlert['status'],
    title: String(data.title || ''),
    subtitle: String(data.subtitle || ''),
    description: String(data.description || ''),
    fingerprint: String(data.fingerprint || ''),
    active: data.active === true,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    resolvedAt: timestampToIso(data.resolvedAt),
  };
}

function candidateFingerprint(candidate: WarehouseLogisticsAlertCandidate): string {
  return [
    candidate.kind,
    candidate.entityId,
    candidate.severity,
    candidate.title,
    candidate.subtitle,
    candidate.description,
    candidate.empenhoId || '',
  ].join('|');
}

export async function getWarehouseLogisticsSettings(
  workspaceId: string
): Promise<WarehouseLogisticsSettings | null> {
  const { workspaceId: normalized } = currentScopeForWorkspace(workspaceId);
  const path = warehouseDocumentPath(normalized, 'settings', WAREHOUSE_LOGISTICS_SETTINGS_ID);
  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as Record<string, unknown>;
    return validateWarehouseLogisticsSettings({
      schemaVersion: data.schemaVersion as typeof WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION,
      workspaceId: String(data.workspaceId || ''),
      ug: String(data.ug || ''),
      lowStockThreshold: data.lowStockThreshold == null ? null : Number(data.lowStockThreshold),
      updatedBy: String(data.updatedBy || ''),
      updatedAt: timestampToIso(data.updatedAt),
    }, normalized);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function saveWarehouseLogisticsSettings(
  workspaceId: string,
  lowStockThreshold: number | null
): Promise<WarehouseLogisticsSettings> {
  const { currentUser, scope, workspaceId: normalized } = currentScopeForWorkspace(workspaceId);
  if (!scope.ug) throw new Error('WAREHOUSE_LOGISTICS_UG_REQUIRED');

  const canonical = validateWarehouseLogisticsSettings({
    schemaVersion: WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION,
    workspaceId: normalized,
    ug: scope.ug,
    lowStockThreshold,
    updatedBy: currentUser.uid,
    updatedAt: null,
  }, normalized);

  const path = warehouseDocumentPath(normalized, 'settings', WAREHOUSE_LOGISTICS_SETTINGS_ID);
  try {
    await setDoc(doc(db, path), {
      schemaVersion: canonical.schemaVersion,
      workspaceId: canonical.workspaceId,
      ug: canonical.ug,
      lowStockThreshold: canonical.lowStockThreshold,
      updatedBy: canonical.updatedBy,
      updatedAt: serverTimestamp(),
    });
    return { ...canonical, updatedAt: new Date().toISOString() };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function loadWarehouseDeliveriesContext(
  workspaceId: string,
  today: Date = new Date()
): Promise<WarehouseDeliveriesContext> {
  currentScopeForWorkspace(workspaceId);
  const [empenhosResult, cronogramasResult, invoicesResult, balances, movementRecords] = await Promise.all([
    listOperationalBounded<Empenho>(
      workspaceId, 'empenhos', WAREHOUSE_DELIVERIES_EMPENHOS_LIMIT
    ),
    listOperationalBounded<CronogramaEmpenho>(
      workspaceId, 'cronogramas', WAREHOUSE_DELIVERIES_CRONOGRAMAS_LIMIT
    ),
    listOperationalBounded<Invoice>(
      workspaceId, 'invoices', WAREHOUSE_DELIVERIES_INVOICES_LIMIT
    ),
    listWarehouseBalances(workspaceId, WAREHOUSE_DASHBOARD_DOMAIN_LIMIT),
    listWarehouseMovements(workspaceId, 250),
  ]);

  const movements = movementRecords.map((record) => record.movement);

  return {
    empenhos: empenhosResult.items,
    cronogramas: cronogramasResult.items,
    invoices: invoicesResult.items,
    balances,
    movements,
    projections: buildWarehouseDeliveryProjections(
      empenhosResult.items,
      cronogramasResult.items,
      invoicesResult.items,
      balances,
      movements,
      today
    ),
    truncated:
      empenhosResult.truncated
      || cronogramasResult.truncated
      || invoicesResult.truncated
      || balances.length >= WAREHOUSE_DASHBOARD_DOMAIN_LIMIT
      || movementRecords.length >= 250,
  };
}

export async function loadWarehouseLogisticsDashboardContext(
  workspaceId: string,
  today: Date = new Date()
): Promise<WarehouseLogisticsDashboardContext> {
  const [
    deliveries,
    materials,
    locationRecords,
    lotRecords,
    inventoryRecords,
    siscofis,
    settings,
  ] = await Promise.all([
    loadWarehouseDeliveriesContext(workspaceId, today),
    listWarehouseMaterials(workspaceId, WAREHOUSE_DASHBOARD_DOMAIN_LIMIT),
    listWarehouseLocationBalances(workspaceId, WAREHOUSE_DASHBOARD_DOMAIN_LIMIT),
    listWarehouseLots(workspaceId, WAREHOUSE_DASHBOARD_DOMAIN_LIMIT),
    listWarehouseInventorySessions(workspaceId, 60),
    listWarehouseSiscofisSnapshots(workspaceId, 1),
    getWarehouseLogisticsSettings(workspaceId),
  ]);

  const locationBalances = locationRecords.map((record) => record.balance);
  const lots = lotRecords.map((record) => record.lot);
  const inventories = inventoryRecords.map((record) => record.session);
  const siscofisSnapshots: WarehouseSiscofisAlertSnapshot[] = siscofis.map((snapshot) => ({
    id: snapshot.id,
    status: snapshot.status,
    referenceDate: snapshot.referenceDate,
    summary: {
      divergentRows: snapshot.summary.divergentRows,
      unresolvedRows: snapshot.summary.unresolvedRows,
    },
  }));

  const alertInput = {
    workspaceId,
    materials,
    balances: deliveries.balances,
    locationBalances,
    lots,
    inventories,
    siscofisSnapshots,
    deliveries: deliveries.projections,
    settings,
    today,
  };

  return {
    ...deliveries,
    materials,
    locationBalances,
    lots,
    inventories,
    siscofisSnapshots,
    settings,
    summary: buildWarehouseLogisticsDashboardSummary(alertInput),
    alertCandidates: buildWarehouseLogisticsAlertCandidates(alertInput),
    truncated:
      deliveries.truncated
      || materials.length >= WAREHOUSE_DASHBOARD_DOMAIN_LIMIT
      || locationBalances.length >= WAREHOUSE_DASHBOARD_DOMAIN_LIMIT
      || lots.length >= WAREHOUSE_DASHBOARD_DOMAIN_LIMIT
      || inventoryRecords.length >= 60,
  };
}

export async function listWarehouseLogisticsAlerts(
  workspaceId: string,
  maxResults = WAREHOUSE_LOGISTICS_ALERT_LIMIT
): Promise<WarehouseLogisticsAlert[]> {
  const { workspaceId: normalized } = currentScopeForWorkspace(workspaceId);
  const path = warehouseDomainPath(normalized, 'alerts');
  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(Math.max(1, Math.min(maxResults, WAREHOUSE_LOGISTICS_ALERT_LIMIT))))
    );
    return snapshot.docs
      .map((entry) =>
        parseWarehouseLogisticsAlert(
          normalized,
          entry.id,
          entry.data() as Record<string, unknown>
        )
      )
      .sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        return (right.updatedAt || '').localeCompare(left.updatedAt || '');
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export async function reconcileWarehouseLogisticsAlerts(
  workspaceId: string,
  candidates: readonly WarehouseLogisticsAlertCandidate[],
  allowResolution = true
): Promise<{ createdOrUpdated: number; resolved: number; skippedResolution: boolean }> {
  const { scope, workspaceId: normalized } = currentScopeForWorkspace(workspaceId);
  if (!scope.ug) throw new Error('WAREHOUSE_LOGISTICS_UG_REQUIRED');

  const existing = await listWarehouseLogisticsAlerts(normalized);
  const existingById = new Map(existing.map((alert) => [alert.id, alert]));
  const candidateIds = new Set<string>();
  let createdOrUpdated = 0;
  let resolved = 0;

  for (const candidate of candidates) {
    const id = createWarehouseLogisticsAlertId(candidate);
    candidateIds.add(id);
    const prior = existingById.get(id);
    const fingerprint = candidateFingerprint(candidate);

    if (prior?.active && prior.fingerprint === fingerprint) continue;

    const path = warehouseDocumentPath(normalized, 'alerts', id);
    await setDoc(doc(db, path), {
      schemaVersion: WAREHOUSE_LOGISTICS_ALERT_SCHEMA_VERSION,
      id,
      workspaceId: normalized,
      ug: scope.ug,
      kind: candidate.kind,
      entityId: candidate.entityId,
      empenhoId: candidate.empenhoId,
      severity: candidate.severity,
      status: 'OPEN',
      title: candidate.title,
      subtitle: candidate.subtitle,
      description: candidate.description,
      fingerprint,
      active: true,
      createdAt: prior?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      resolvedAt: null,
    });
    createdOrUpdated += 1;
  }

  if (allowResolution && existing.length < WAREHOUSE_LOGISTICS_ALERT_LIMIT) {
    for (const prior of existing) {
      if (!prior.active || candidateIds.has(prior.id)) continue;
      const path = warehouseDocumentPath(normalized, 'alerts', prior.id);
      await setDoc(doc(db, path), {
        schemaVersion: prior.schemaVersion,
        id: prior.id,
        workspaceId: prior.workspaceId,
        ug: prior.ug,
        kind: prior.kind,
        entityId: prior.entityId,
        empenhoId: prior.empenhoId,
        severity: prior.severity,
        status: 'RESOLVED',
        title: prior.title,
        subtitle: prior.subtitle,
        description: prior.description,
        fingerprint: prior.fingerprint,
        active: false,
        createdAt: prior.createdAt,
        updatedAt: serverTimestamp(),
        resolvedAt: serverTimestamp(),
      });
      resolved += 1;
    }
  }

  return {
    createdOrUpdated,
    resolved,
    skippedResolution: !allowResolution || existing.length >= WAREHOUSE_LOGISTICS_ALERT_LIMIT,
  };
}

export async function refreshWarehouseLogisticsAlerts(
  workspaceId: string,
  today: Date = new Date()
): Promise<{ context: WarehouseLogisticsDashboardContext; alerts: WarehouseLogisticsAlert[] }> {
  const context = await loadWarehouseLogisticsDashboardContext(workspaceId, today);
  await reconcileWarehouseLogisticsAlerts(
    workspaceId,
    context.alertCandidates,
    !context.truncated
  );
  return {
    context,
    alerts: await listWarehouseLogisticsAlerts(workspaceId),
  };
}
