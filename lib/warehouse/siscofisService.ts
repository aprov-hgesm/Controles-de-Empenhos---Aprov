import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION,
  type WarehouseInvoiceIntegrationSettings,
} from './invoiceIntegration';
import { applyWarehouseMovement, listWarehouseBalances } from './ledgerRepository';
import { listWarehouseMaterials, saveWarehouseMaterial } from './materialRepository';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import {
  WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION,
  WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION,
  aggregateMarcoZeroRows,
  buildWarehouseSiscofisPreview,
  buildWarehouseSiscofisPrompt,
  adaptEmprovexSiscofisInventory,
  parseEmprovexSiscofisInventoryJson,
  createMaterialFromSiscofisRow,
  parseWarehouseSiscofisJson,
  type WarehouseSiscofisIssue,
  type WarehouseSiscofisPreview,
  type WarehouseSiscofisPreviewRow,
  type WarehouseSiscofisSnapshotSchemaVersion,
} from './siscofis';

export type WarehouseSiscofisSnapshotKind = 'MARCO_ZERO' | 'SNAPSHOT';
export type WarehouseSiscofisSnapshotStatus = 'APPLYING' | 'CONFIRMED';

export interface WarehouseSiscofisSnapshot {
  schemaVersion: WarehouseSiscofisSnapshotSchemaVersion;
  id: string;
  workspaceId: string;
  ug: string;
  kind: WarehouseSiscofisSnapshotKind;
  status: WarehouseSiscofisSnapshotStatus;
  sourceHash: string;
  importSchemaVersion: typeof WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION;
  sourceLabel: string;
  referenceDate: string;
  cutoffAt: string;
  actorUid: string;
  rows: WarehouseSiscofisPreviewRow[];
  summary: WarehouseSiscofisPreview['summary'];
  movementIds: string[];
  createdAt: string | null;
  confirmedAt: string | null;
}

export interface WarehouseSiscofisContext {
  prompt: string;
  hasMarcoZero: boolean;
  cutoffAt: string | null;
  snapshots: WarehouseSiscofisSnapshot[];
}

const MARCO_ZERO_SNAPSHOT_ID = 'marco-zero';
const INVOICE_SETTINGS_ID = 'invoice-integration';

function timestampToIso(value: unknown): string | null {
  if (
    value
    && typeof value === 'object'
    && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function parseSnapshot(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseSiscofisSnapshot {
  if (
    !['warehouse_siscofis_snapshot_v1', WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION].includes(String(data.schemaVersion))
    || data.id !== id
    || data.workspaceId !== workspaceId
    || typeof data.ug !== 'string'
    || !/^\d{6}$/.test(data.ug)
    || !['MARCO_ZERO', 'SNAPSHOT'].includes(String(data.kind))
    || !['APPLYING', 'CONFIRMED'].includes(String(data.status))
    || typeof data.sourceHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(data.sourceHash)
    || data.importSchemaVersion !== WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION
    || typeof data.sourceLabel !== 'string'
    || typeof data.referenceDate !== 'string'
    || typeof data.cutoffAt !== 'string'
    || typeof data.actorUid !== 'string'
    || !Array.isArray(data.rows)
    || !Array.isArray(data.movementIds)
    || !data.summary
    || typeof data.summary !== 'object'
  ) {
    throw new Error('WAREHOUSE_SISCOFIS_INVALID_SNAPSHOT');
  }

  return {
    schemaVersion: data.schemaVersion as WarehouseSiscofisSnapshotSchemaVersion,
    id,
    workspaceId,
    ug: data.ug,
    kind: data.kind as WarehouseSiscofisSnapshotKind,
    status: data.status as WarehouseSiscofisSnapshotStatus,
    sourceHash: data.sourceHash,
    importSchemaVersion: WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION,
    sourceLabel: data.sourceLabel,
    referenceDate: data.referenceDate,
    cutoffAt: data.cutoffAt,
    actorUid: data.actorUid,
    rows: data.rows as WarehouseSiscofisPreviewRow[],
    summary: data.summary as WarehouseSiscofisPreview['summary'],
    movementIds: data.movementIds.filter((value): value is string => typeof value === 'string'),
    createdAt: timestampToIso(data.createdAt),
    confirmedAt: timestampToIso(data.confirmedAt),
  };
}

function assertCurrentScope(workspaceId: string): {
  workspaceId: string;
  ug: string;
  uid: string;
} {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('WAREHOUSE_SISCOFIS_AUTH_REQUIRED');

  const scope = getCurrentOperationalScope(currentUser.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_SISCOFIS_SCOPE_MISMATCH');
  }

  return {
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    uid: currentUser.uid,
  };
}

async function getInvoiceSettings(
  workspaceId: string
): Promise<WarehouseInvoiceIntegrationSettings | null> {
  const path = warehouseDocumentPath(workspaceId, 'settings', INVOICE_SETTINGS_ID);
  const snapshot = await getDoc(doc(db, path));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Record<string, unknown>;
  if (
    data.schemaVersion !== WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION
    || data.workspaceId !== workspaceId
    || typeof data.ug !== 'string'
    || typeof data.cutoffAt !== 'string'
    || !Number.isFinite(Date.parse(data.cutoffAt))
    || typeof data.activatedBy !== 'string'
  ) {
    throw new Error('WAREHOUSE_INVOICE_SETTINGS_INVALID');
  }

  return data as unknown as WarehouseInvoiceIntegrationSettings;
}

async function ensureInvoiceCutoff(input: {
  workspaceId: string;
  ug: string;
  uid: string;
  existing: WarehouseInvoiceIntegrationSettings | null;
}): Promise<WarehouseInvoiceIntegrationSettings> {
  if (input.existing) return input.existing;

  const settings: WarehouseInvoiceIntegrationSettings = {
    schemaVersion: WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION,
    workspaceId: input.workspaceId,
    ug: input.ug,
    cutoffAt: new Date().toISOString(),
    activatedBy: input.uid,
  };

  const path = warehouseDocumentPath(
    input.workspaceId,
    'settings',
    INVOICE_SETTINGS_ID
  );
  await setDoc(doc(db, path), settings);
  return settings;
}

async function getMarcoZero(
  workspaceId: string
): Promise<WarehouseSiscofisSnapshot | null> {
  const path = warehouseDocumentPath(
    workspaceId,
    'siscofisSnapshots',
    MARCO_ZERO_SNAPSHOT_ID
  );
  const snapshot = await getDoc(doc(db, path));
  if (!snapshot.exists()) return null;
  return parseSnapshot(
    workspaceId,
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );
}

export async function listWarehouseSiscofisSnapshots(
  workspaceId: string,
  maxResults = 12
): Promise<WarehouseSiscofisSnapshot[]> {
  const path = warehouseDomainPath(workspaceId, 'siscofisSnapshots');
  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        orderBy('createdAt', 'desc'),
        limit(Math.max(1, Math.min(maxResults, 25)))
      )
    );
    return snapshot.docs.map((item) =>
      parseSnapshot(workspaceId, item.id, item.data() as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function loadWarehouseSiscofisContext(
  workspaceId: string
): Promise<WarehouseSiscofisContext> {
  const scope = assertCurrentScope(workspaceId);
  const [settings, marcoZero, snapshots] = await Promise.all([
    getInvoiceSettings(workspaceId),
    getMarcoZero(workspaceId),
    listWarehouseSiscofisSnapshots(workspaceId, 12),
  ]);

  if (settings && settings.ug !== scope.ug) {
    throw new Error('WAREHOUSE_SISCOFIS_CUTOFF_UG_MISMATCH');
  }
  if (marcoZero && marcoZero.ug !== scope.ug) {
    throw new Error('WAREHOUSE_SISCOFIS_MARCO_ZERO_UG_MISMATCH');
  }

  return {
    prompt: buildWarehouseSiscofisPrompt(),
    hasMarcoZero: marcoZero?.status === 'CONFIRMED',
    cutoffAt: settings?.cutoffAt || marcoZero?.cutoffAt || null,
    snapshots,
  };
}


export async function prepareEmprovexSiscofisInventoryImport(
  workspaceId: string,
  rawJson: string,
  referenceDate: string,
  sourceLabel = 'Inventário SISCOFIS — Migração inicial',
  materialOverrides: Record<string, string> = {}
): Promise<WarehouseSiscofisPreview> {
  const scope = assertCurrentScope(workspaceId);
  const external = parseEmprovexSiscofisInventoryJson(rawJson);
  if (!external.ok || !external.data) {
    const error = new Error('WAREHOUSE_SISCOFIS_VALIDATION_FAILED');
    (error as Error & { issues?: WarehouseSiscofisIssue[] }).issues = external.issues;
    throw error;
  }
  const [materials, balances, settings, marcoZero] = await Promise.all([
    listWarehouseMaterials(workspaceId, 500),
    listWarehouseBalances(workspaceId, 500),
    getInvoiceSettings(workspaceId),
    getMarcoZero(workspaceId),
  ]);
  const adapted = adaptEmprovexSiscofisInventory({ inventory: external.data, ug: scope.ug, referenceDate, sourceLabel, materials, materialOverrides });
  return buildWarehouseSiscofisPreview({
    workspaceId,
    importData: adapted.importData,
    materials,
    balances,
    hasMarcoZero: Boolean(marcoZero),
    cutoffAt: settings?.cutoffAt || marcoZero?.cutoffAt || null,
    priorIssues: [...external.issues, ...adapted.issues],
  });
}

export async function prepareWarehouseSiscofisImport(
  workspaceId: string,
  rawJson: string
): Promise<WarehouseSiscofisPreview> {
  const scope = assertCurrentScope(workspaceId);
  const parsed = parseWarehouseSiscofisJson(rawJson, scope.ug);

  if (!parsed.ok || !parsed.data) {
    const error = new Error('WAREHOUSE_SISCOFIS_VALIDATION_FAILED');
    (error as Error & { issues?: WarehouseSiscofisIssue[] }).issues = parsed.issues;
    throw error;
  }

  const [materials, balances, settings, marcoZero] = await Promise.all([
    listWarehouseMaterials(workspaceId, 500),
    listWarehouseBalances(workspaceId, 500),
    getInvoiceSettings(workspaceId),
    getMarcoZero(workspaceId),
  ]);

  return buildWarehouseSiscofisPreview({
    workspaceId,
    importData: parsed.data,
    materials,
    balances,
    hasMarcoZero: Boolean(marcoZero),
    cutoffAt: settings?.cutoffAt || marcoZero?.cutoffAt || null,
    priorIssues: parsed.issues,
  });
}

function snapshotPayload(input: {
  id: string;
  workspaceId: string;
  ug: string;
  kind: WarehouseSiscofisSnapshotKind;
  status: WarehouseSiscofisSnapshotStatus;
  preview: WarehouseSiscofisPreview;
  cutoffAt: string;
  uid: string;
  movementIds: string[];
}): Record<string, unknown> {
  return {
    schemaVersion: WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION,
    id: input.id,
    workspaceId: input.workspaceId,
    ug: input.ug,
    kind: input.kind,
    status: input.status,
    sourceHash: input.preview.sourceHash,
    importSchemaVersion: WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION,
    sourceLabel: input.preview.import.sourceLabel,
    referenceDate: input.preview.import.referenceDate,
    cutoffAt: input.cutoffAt,
    actorUid: input.uid,
    rows: input.preview.rows,
    summary: input.preview.summary,
    movementIds: input.movementIds,
  };
}

async function finalizePreviewWithCurrentBalances(
  preview: WarehouseSiscofisPreview,
  workspaceId: string
): Promise<WarehouseSiscofisPreviewRow[]> {
  const balances = await listWarehouseBalances(workspaceId, 500);
  const balanceByMaterial = new Map(
    balances.map((balance) => [balance.materialId, balance.quantity])
  );

  return preview.rows.map((row) => {
    const emprovexQuantity = row.materialId
      ? balanceByMaterial.get(row.materialId) || 0
      : 0;
    if (preview.kind === 'MARCO_ZERO') {
      return {
        ...row,
        emprovexQuantity,
        projectedQuantity: emprovexQuantity,
        difference: 0,
      };
    }
    const difference = Number((row.siscofisQuantity - emprovexQuantity).toFixed(6));
    return {
      ...row,
      emprovexQuantity,
      projectedQuantity: emprovexQuantity,
      difference,
      state: !row.materialId
        ? 'UNRESOLVED'
        : difference === 0
          ? 'MATCHED'
          : 'DIVERGENT',
    };
  });
}

export async function confirmWarehouseSiscofisImport(
  workspaceId: string,
  preview: WarehouseSiscofisPreview
): Promise<WarehouseSiscofisSnapshot> {
  const scope = assertCurrentScope(workspaceId);

  if (!preview.canConfirm) {
    throw new Error('WAREHOUSE_SISCOFIS_PREVIEW_NOT_CONFIRMABLE');
  }
  if (preview.import.ug !== scope.ug) {
    throw new Error('WAREHOUSE_SISCOFIS_UG_MISMATCH');
  }

  const settings = await getInvoiceSettings(workspaceId);
  const existingMarcoZero = await getMarcoZero(workspaceId);
  const expectedKind = existingMarcoZero?.status === 'CONFIRMED' ? 'SNAPSHOT' : 'MARCO_ZERO';

  if (preview.kind !== expectedKind) {
    throw new Error('WAREHOUSE_SISCOFIS_PREVIEW_STALE');
  }

  if (
    existingMarcoZero
    && existingMarcoZero.status === 'APPLYING'
    && existingMarcoZero.sourceHash !== preview.sourceHash
  ) {
    throw new Error('WAREHOUSE_SISCOFIS_MARCO_ZERO_IN_PROGRESS');
  }

  const activeSettings = await ensureInvoiceCutoff({
    workspaceId,
    ug: scope.ug,
    uid: scope.uid,
    existing: settings,
  });

  if (preview.kind === 'MARCO_ZERO') {
    const referenceDay = Date.parse(preview.import.referenceDate + 'T00:00:00.000Z');
    const cutoffDay = Date.parse(
      activeSettings.cutoffAt.slice(0, 10) + 'T00:00:00.000Z'
    );
    const currentBalances = await listWarehouseBalances(workspaceId, 500);
    if (
      currentBalances.some((balance) => balance.quantity !== 0)
      && referenceDay >= cutoffDay
    ) {
      throw new Error('WAREHOUSE_SISCOFIS_MARCO_ZERO_CUTOFF_OVERLAP');
    }

    const snapshotPath = warehouseDocumentPath(
      workspaceId,
      'siscofisSnapshots',
      MARCO_ZERO_SNAPSHOT_ID
    );
    const snapshotRef = doc(db, snapshotPath);
    const snapshotExisting = await getDoc(snapshotRef);

    if (snapshotExisting.exists()) {
      const stored = parseSnapshot(
        workspaceId,
        snapshotExisting.id,
        snapshotExisting.data() as Record<string, unknown>
      );
      if (stored.sourceHash !== preview.sourceHash) {
        throw new Error('WAREHOUSE_SISCOFIS_MARCO_ZERO_ALREADY_DEFINED');
      }
      if (stored.status === 'CONFIRMED') return stored;
    } else {
      await setDoc(snapshotRef, {
        ...snapshotPayload({
          id: MARCO_ZERO_SNAPSHOT_ID,
          workspaceId,
          ug: scope.ug,
          kind: 'MARCO_ZERO',
          status: 'APPLYING',
          preview,
          cutoffAt: activeSettings.cutoffAt,
          uid: scope.uid,
          movementIds: [],
        }),
        createdAt: serverTimestamp(),
        confirmedAt: null,
      });
    }

    const materials = await listWarehouseMaterials(workspaceId, 500);
    const materialIds = new Set(materials.map((material) => material.id));
    const movementIds: string[] = [];

    for (const group of aggregateMarcoZeroRows(preview)) {
      if (!materialIds.has(group.materialId)) {
        const material = createMaterialFromSiscofisRow({
          workspaceId,
          ug: scope.ug,
          materialId: group.materialId,
          row: group.representativeRow,
        });
        await saveWarehouseMaterial(workspaceId, material);
        materialIds.add(group.materialId);
      }

      const result = await applyWarehouseMovement(workspaceId, {
        materialId: group.materialId,
        type: 'INITIAL_BALANCE',
        quantityDelta: group.quantity,
        idempotencyKey:
          'siscofis:marco-zero:' + preview.sourceHash + ':' + group.materialId,
        note:
          'Marco Zero SISCOFIS ' + preview.import.referenceDate
          + ' · linhas ' + group.rowIds.join(',').slice(0, 150),
        source: null,
      });
      movementIds.push(result.movement.id);
    }

    const finalRows = await finalizePreviewWithCurrentBalances(preview, workspaceId);
    const finalSummary = {
      ...preview.summary,
      matchedRows: finalRows.filter((row) => row.state === 'MATCHED').length,
      unresolvedRows: finalRows.filter((row) => row.state === 'UNRESOLVED').length,
      divergentRows: 0,
    };

    await updateDoc(snapshotRef, {
      status: 'CONFIRMED',
      rows: finalRows,
      summary: finalSummary,
      movementIds: Array.from(new Set(movementIds)),
      confirmedAt: serverTimestamp(),
    });

    const confirmed = await getDoc(snapshotRef);
    return parseSnapshot(
      workspaceId,
      confirmed.id,
      confirmed.data() as Record<string, unknown>
    );
  }

  const snapshotId = 'snapshot_' + preview.sourceHash.slice(0, 32);
  const snapshotPath = warehouseDocumentPath(
    workspaceId,
    'siscofisSnapshots',
    snapshotId
  );
  const snapshotRef = doc(db, snapshotPath);
  const existingSnapshot = await getDoc(snapshotRef);

  if (existingSnapshot.exists()) {
    const stored = parseSnapshot(
      workspaceId,
      existingSnapshot.id,
      existingSnapshot.data() as Record<string, unknown>
    );
    if (stored.sourceHash !== preview.sourceHash) {
      throw new Error('WAREHOUSE_SISCOFIS_SNAPSHOT_ID_CONFLICT');
    }
    return stored;
  }

  const finalRows = await finalizePreviewWithCurrentBalances(preview, workspaceId);
  const finalSummary = {
    ...preview.summary,
    matchedRows: finalRows.filter((row) => row.state === 'MATCHED').length,
    unresolvedRows: finalRows.filter((row) => row.state === 'UNRESOLVED').length,
    divergentRows: finalRows.filter((row) => row.state === 'DIVERGENT').length,
    createsMaterials: 0,
  };

  await setDoc(snapshotRef, {
    ...snapshotPayload({
      id: snapshotId,
      workspaceId,
      ug: scope.ug,
      kind: 'SNAPSHOT',
      status: 'CONFIRMED',
      preview: { ...preview, rows: finalRows, summary: finalSummary },
      cutoffAt: activeSettings.cutoffAt,
      uid: scope.uid,
      movementIds: [],
    }),
    createdAt: serverTimestamp(),
    confirmedAt: serverTimestamp(),
  });

  const stored = await getDoc(snapshotRef);
  return parseSnapshot(
    workspaceId,
    stored.id,
    stored.data() as Record<string, unknown>
  );
}
