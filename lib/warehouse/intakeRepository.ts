import { warehouseServerCommand } from './serverCommandClient';
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

import { recordWarehouseDocumentReads } from './telemetry';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import type { Empenho, Invoice } from '../types';
import { saveWarehouseBarcodeAssociation } from './barcodeRepository';
import {
  createWarehouseMaterialFromEmpenhoItem,
  deriveWarehouseMaterialIdForEmpenhoItem,
} from './invoiceIntegration';
import {
  createWarehouseItemIntakeId,
  validateWarehouseItemIntake,
  WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION,
  type WarehouseItemIntake,
  type WarehouseItemIntakeListItem,
} from './intake';
import type { WarehouseStockPosition } from './location';
import {
  getWarehouseMaterial,
  saveWarehouseMaterial,
} from './materialRepository';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';

export interface AllocateWarehouseInvoiceItemInput {
  invoice: Invoice;
  empenho: Empenho;
  itemId: string;
  position: WarehouseStockPosition;
  lotCode: string;
  expiresOn?: string | null;
  barcode?: string | null;
}

export interface RegisterImmediateConsumptionInput {
  invoice: Invoice;
  empenho: Empenho;
  itemId: string;
  barcode?: string | null;
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

function currentScope(workspaceId: string): {
  workspaceId: string;
  ug: string;
  uid: string;
} {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_INTAKE_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_INTAKE_SCOPE_MISMATCH');
  }
  return {
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    uid: user.uid,
  };
}

function parseIntake(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseItemIntake {
  const result = validateWarehouseItemIntake(
    { ...data, id },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_ITEM_INTAKE: ' +
      result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return result.data;
}

async function ensureMaterial(
  workspaceId: string,
  ug: string,
  empenho: Empenho,
  itemId: string
) {
  const item = empenho.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('WAREHOUSE_INTAKE_ITEM_NOT_FOUND');

  const materialId =
    item.warehouseMaterialId?.trim().toLowerCase()
    || await deriveWarehouseMaterialIdForEmpenhoItem(workspaceId, empenho.id, item.id);

  let material = await getWarehouseMaterial(workspaceId, materialId);
  if (!material) {
    const candidate = createWarehouseMaterialFromEmpenhoItem({
      workspaceId,
      ug,
      materialId,
      item,
    });
    await saveWarehouseMaterial(workspaceId, candidate);
    material = await getWarehouseMaterial(workspaceId, materialId);
  }

  if (!material) throw new Error('WAREHOUSE_INTAKE_MATERIAL_CREATE_FAILED');
  if (material.status !== 'active' || material.ug !== ug) {
    throw new Error('WAREHOUSE_INTAKE_MATERIAL_INACTIVE');
  }
  return { material, item };
}

function findInvoiceItem(invoice: Invoice, itemId: string) {
  const invoiceItem = invoice.items.find((candidate) => candidate.itemId === itemId);
  if (!invoiceItem || !(invoiceItem.quantity > 0)) {
    throw new Error('WAREHOUSE_INTAKE_INVOICE_ITEM_NOT_FOUND');
  }
  return invoiceItem;
}

function invoiceRecordKey(invoice: Invoice): string {
  return (invoice.recordKey || invoice.id || '').trim();
}

async function existingIntakeFor(
  workspaceId: string,
  invoice: Invoice,
  itemId: string
): Promise<WarehouseItemIntake | null> {
  const id = await createWarehouseItemIntakeId(
    workspaceId,
    invoiceRecordKey(invoice),
    itemId
  );
  const path = warehouseDocumentPath(workspaceId, 'intakes', id);
  const snapshot = await getDoc(doc(db, path));
  if (!snapshot.exists()) return null;
  return parseIntake(
    workspaceId,
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );
}

export async function getWarehouseInvoiceIntakeCutoff(
  workspaceId: string
): Promise<string | null> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(scope.workspaceId, 'settings', 'invoice-integration');
  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as Record<string, unknown>;
    const cutoffAt = typeof data.cutoffAt === 'string' ? data.cutoffAt : null;
    return cutoffAt && Number.isFinite(Date.parse(cutoffAt)) ? cutoffAt : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function listWarehouseItemIntakes(
  workspaceId: string,
  maxResults = 500
): Promise<WarehouseItemIntakeListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'intakes');
  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 500))))
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs
      .flatMap((entry) => {
        const data = entry.data() as Record<string, unknown>;
        if (data.schemaVersion !== WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION) {
          return [];
        }
        return [{
          intake: parseIntake(scope.workspaceId, entry.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        }];
      })
      .sort((left, right) =>
        (right.createdAt || '').localeCompare(left.createdAt || '')
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export async function allocateWarehouseInvoiceItem(
  workspaceId: string,
  input: AllocateWarehouseInvoiceItemInput
): Promise<WarehouseItemIntake> {
  currentScope(workspaceId);
  void input;

  // Compatibilidade v1 apenas. O fluxo antigo criava INVOICE_ENTRY e depois
  // promovia UNASSIGNED a origem de TRANSFER. Isso conflita com o contrato
  // canônico atual: pendência pertence ao intake v2 e estoque operacional
  // existe somente em LOCATION/SUBPOSITION.
  throw new Error('WAREHOUSE_LEGACY_INTAKE_RECONCILIATION_REQUIRED');
}

/**
 * Contrato v1 obsoleto não autoriza mais gravação de consumo.
 * A interface atual deve chamar applyWarehouseImmediateConsumptionFast.
 */
export async function registerWarehouseImmediateConsumption(
  workspaceId:string,input:RegisterImmediateConsumptionInput
):Promise<WarehouseItemIntake> {
  currentScope(workspaceId);
  void input;
  throw new Error('WAREHOUSE_LEGACY_INTAKE_RECONCILIATION_REQUIRED');
}

export async function markWarehouseImmediateConsumptionPosted(
  workspaceId:string,intakeId:string
):Promise<void> {
  const scope=currentScope(workspaceId);
  await warehouseServerCommand<{ok:true}>(
    scope.workspaceId,'LEGACY_INTAKE_POSTED',intakeId
  );
}
