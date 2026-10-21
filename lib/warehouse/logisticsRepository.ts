import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { recordWarehouseDocumentReads, recordWarehouseDocumentWrites } from './telemetry';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
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
import { warehouseServerCommand } from './serverCommandClient';
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

export type WarehouseLogisticsDegradedSource = 'inventories' | 'siscofis' | 'settings';

export interface WarehouseLogisticsDashboardContext extends WarehouseDeliveriesContext {
  materials: WarehouseMaterial[];
  locationBalances: WarehouseLocationBalance[];
  lots: WarehouseLot[];
  inventories: WarehouseInventorySession[];
  siscofisSnapshots: WarehouseSiscofisAlertSnapshot[];
  settings: WarehouseLogisticsSettings | null;
  summary: WarehouseLogisticsDashboardSummary;
  alertCandidates: WarehouseLogisticsAlertCandidate[];
  degradedSources: WarehouseLogisticsDegradedSource[];
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
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
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

/** A preferência de alertas é mutável somente através do servidor R2. */
export async function saveWarehouseLogisticsSettings(
  workspaceId: string,
  lowStockThreshold: number | null
): Promise<WarehouseLogisticsSettings> {
  const { workspaceId: normalized }=currentScopeForWorkspace(workspaceId);
  return warehouseServerCommand<WarehouseLogisticsSettings>(
    normalized,'LOGISTICS_SETTINGS_SAVE',lowStockThreshold
  );
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
  const degradedSources = new Set<WarehouseLogisticsDegradedSource>();
  const optional = async <T,>(
    source: WarehouseLogisticsDegradedSource,
    load: Promise<T>,
    fallback: T
  ): Promise<T> => {
    try {
      return await load;
    } catch (error) {
      degradedSources.add(source);
      console.warn(`Fonte auxiliar do Dashboard Logístico indisponível: ${source}.`, error);
      return fallback;
    }
  };

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
    optional('inventories', listWarehouseInventorySessions(workspaceId, 60), []),
    optional('siscofis', listWarehouseSiscofisSnapshots(workspaceId, 1), []),
    optional('settings', getWarehouseLogisticsSettings(workspaceId), null),
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
    degradedSources: Array.from(degradedSources),
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
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
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
  const { workspaceId: normalized }=currentScopeForWorkspace(workspaceId);
  let changed=0;
  for(let i=0;i<candidates.length;i+=35)
    changed+=await warehouseServerCommand<number>(normalized,'LOGISTICS_ALERT_UPSERT',
      candidates.slice(i,i+35));
  const result=await warehouseServerCommand<{resolved:number;skippedResolution:boolean}>(
    normalized,'LOGISTICS_ALERT_RESOLVE',{
      candidateIds:Array.from(new Set(candidates.map(createWarehouseLogisticsAlertId))),
      allowResolution,
    });
  return {createdOrUpdated:changed,...result};
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
