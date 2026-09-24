import {
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { saveAlert } from '../firebaseSync';
import {
  getCurrentOperationalScope,
  getOperationalCollectionPath,
  operationalCollectionRef,
} from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import type { Alert, CronogramaEmpenho, Empenho, Invoice } from '../types';
import { listWarehouseBalances } from './ledgerRepository';
import { listWarehouseInventorySessions } from './inventoryRepository';
import { listWarehouseLocationBalances } from './locationRepository';
import { listWarehouseLots } from './lotRepository';
import { listWarehouseMaterials } from './materialRepository';
import { warehouseDocumentPath } from './namespace';
import { listWarehouseSiscofisSnapshots } from './siscofisService';
import {
  WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION,
  buildWarehouseDeliveryProjections,
  validateWarehouseLogisticsSettings,
  type WarehouseDeliveryProjection,
  type WarehouseLogisticsSettings,
} from './logistics';
import {
  WAREHOUSE_LOGISTICS_ALERT_PREFIX,
  buildWarehouseLogisticsAlertCandidates,
  buildWarehouseLogisticsDashboardSummary,
  warehouseLogisticsAlertManagedPrefix,
  type WarehouseLogisticsAlertCandidate,
  type WarehouseLogisticsAlertKind,
  type WarehouseLogisticsDashboardSummary,
  type WarehouseSiscofisAlertSnapshot,
} from './logisticsAlerts';
import type { WarehouseBalance } from './movement';
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
  return typeof value === 'string' ? value : null;
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
  const [empenhosResult, cronogramasResult, invoicesResult, balances] = await Promise.all([
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
  ]);

  return {
    empenhos: empenhosResult.items,
    cronogramas: cronogramasResult.items,
    invoices: invoicesResult.items,
    balances,
    projections: buildWarehouseDeliveryProjections(
      empenhosResult.items,
      cronogramasResult.items,
      invoicesResult.items,
      balances,
      today
    ),
    truncated:
      empenhosResult.truncated
      || cronogramasResult.truncated
      || invoicesResult.truncated
      || balances.length >= WAREHOUSE_DASHBOARD_DOMAIN_LIMIT,
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

async function listExistingWarehouseLogisticsAlerts(
  workspaceId: string
): Promise<BoundedResult<Alert>> {
  const { scope } = currentScopeForWorkspace(workspaceId);
  const path = getOperationalCollectionPath(scope, 'alerts');
  try {
    const ref = operationalCollectionRef(scope, 'alerts');
    const snapshot = await getDocs(
      query(
        ref,
        orderBy(documentId()),
        startAt(WAREHOUSE_LOGISTICS_ALERT_PREFIX),
        endAt(WAREHOUSE_LOGISTICS_ALERT_PREFIX + '\uf8ff'),
        limit(WAREHOUSE_LOGISTICS_ALERT_LIMIT)
      )
    );
    return {
      items: snapshot.docs.map((entry) => ({ ...(entry.data() as Alert), id: entry.id })),
      truncated: snapshot.size >= WAREHOUSE_LOGISTICS_ALERT_LIMIT,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

function sameAlertState(left: Alert, right: Alert): boolean {
  return left.type === right.type
    && (left.status || 'NOVO') === (right.status || 'NOVO')
    && left.source === right.source
    && left.title === right.title
    && left.subtitle === right.subtitle
    && left.description === right.description
    && left.empenhoId === right.empenhoId
    && left.logistics?.active === right.logistics?.active
    && left.logistics?.fingerprint === right.logistics?.fingerprint;
}

export async function reconcileWarehouseLogisticsAlerts(
  workspaceId: string,
  candidates: readonly WarehouseLogisticsAlertCandidate[],
  managedKinds: readonly WarehouseLogisticsAlertKind[],
  allowResolution = true
): Promise<{ createdOrUpdated: number; resolved: number; skippedResolution: boolean }> {
  const { currentUser } = currentScopeForWorkspace(workspaceId);
  const existingResult = await listExistingWarehouseLogisticsAlerts(workspaceId);
  const managedPrefixes = managedKinds.map((kind) =>
    warehouseLogisticsAlertManagedPrefix(workspaceId, kind)
  );
  const existing = existingResult.items.filter((alert) =>
    managedPrefixes.some((prefix) => alert.id.startsWith(prefix))
  );
  const candidateById = new Map(candidates.map((item) => [item.alert.id, item.alert]));
  let createdOrUpdated = 0;
  let resolved = 0;
  const now = new Date().toISOString();

  for (const rawCandidate of candidateById.values()) {
    const prior = existing.find((alert) => alert.id === rawCandidate.id);
    let next: Alert;

    if (!prior) {
      next = { ...rawCandidate, createdAt: now, date: now };
    } else if (prior.logistics?.active === false) {
      next = {
        ...prior,
        ...rawCandidate,
        status: 'NOVO',
        date: now,
        createdAt: now,
        readAt: undefined,
        resolvedAt: undefined,
        archivedAt: undefined,
      };
    } else {
      // Uma resolução manual é respeitada enquanto a mesma causa permanece ativa.
      next = {
        ...prior,
        ...rawCandidate,
        status: prior.status || 'NOVO',
        date: prior.date || rawCandidate.date,
        createdAt: prior.createdAt || now,
        readAt: prior.readAt,
        resolvedAt: prior.resolvedAt,
        archivedAt: prior.archivedAt,
      };
    }

    if (!prior || !sameAlertState(prior, next)) {
      await saveAlert(currentUser.uid, next);
      createdOrUpdated += 1;
    }
  }

  if (allowResolution && !existingResult.truncated) {
    for (const prior of existing) {
      if (candidateById.has(prior.id) || prior.logistics?.active === false) continue;
      const next: Alert = {
        ...prior,
        status: prior.status === 'ARQUIVADO' ? 'ARQUIVADO' : 'RESOLVIDO',
        readAt: prior.readAt || now,
        resolvedAt: prior.status === 'ARQUIVADO' ? prior.resolvedAt : (prior.resolvedAt || now),
        logistics: prior.logistics ? { ...prior.logistics, active: false } : prior.logistics,
      };
      if (!sameAlertState(prior, next)) {
        await saveAlert(currentUser.uid, next);
        resolved += 1;
      }
    }
  }

  return {
    createdOrUpdated,
    resolved,
    skippedResolution: !allowResolution || existingResult.truncated,
  };
}
