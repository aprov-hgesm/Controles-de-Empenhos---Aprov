import { warehouseServerCommand } from './serverCommandClient';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  WAREHOUSE_BARCODE_SCHEMA_VERSION,
  barcodeAssociationMatchesMaterial,
  createWarehouseBarcodeId,
  isValidWarehouseBarcodeId,
  normalizeWarehouseBarcode,
  validateWarehouseBarcodeAssociation,
  warehousePresentationFactor,
  type WarehouseBarcodeAssociation,
} from './barcode';
import {
  normalizeWarehouseMaterialUnit,
  type WarehouseMaterial,
  type WarehouseMaterialUnit,
} from './material';
import { isWarehouseLocationBarcode } from './locationBarcode';
import { validateWarehouseMaterial } from './material';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import {
  warehouseCanonicalBarcodeReadInput,
  warehouseCanonicalMaterialReadInput,
} from './readCompatibility';

export interface WarehouseBarcodeListItem {
  association: WarehouseBarcodeAssociation;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SaveWarehouseBarcodeAssociationInput {
  barcode: string;
  materialId: string;
  presentation: WarehouseMaterialUnit;
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

function currentScope(workspaceId: string): { workspaceId: string; ug: string; uid: string } {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_BARCODE_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_BARCODE_SCOPE_MISMATCH');
  }
  return { workspaceId: scope.workspaceId, ug: scope.ug, uid: user.uid };
}

function parseMaterial(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseMaterial {
  const result = validateWarehouseMaterial(
    warehouseCanonicalMaterialReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_INVALID_MATERIAL');
  return result.data;
}

function parseAssociation(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseBarcodeAssociation {
  const result = validateWarehouseBarcodeAssociation(
    warehouseCanonicalBarcodeReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_BARCODE: '
      + result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }
  return result.data;
}

export async function listWarehouseBarcodes(
  workspaceId: string,
  maxResults = 500
): Promise<WarehouseBarcodeListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'barcodes');
  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 500))))
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        association: parseAssociation(scope.workspaceId, item.id, data),
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getWarehouseBarcodeByCode(
  workspaceId: string,
  barcode: string
): Promise<WarehouseBarcodeAssociation | null> {
  const scope = currentScope(workspaceId);
  const normalized = normalizeWarehouseBarcode(barcode);
  if (!normalized) throw new Error('WAREHOUSE_INVALID_BARCODE');
  const id = await createWarehouseBarcodeId(scope.workspaceId, normalized);
  const path = warehouseDocumentPath(scope.workspaceId, 'barcodes', id);
  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;
    return parseAssociation(
      scope.workspaceId,
      snapshot.id,
      snapshot.data() as Record<string, unknown>
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    // Um 403 não significa código livre. Propagar para impedir duplicidade.
    throw error;
  }
}

export async function saveWarehouseBarcodeAssociation(
  workspaceId: string,
  input: SaveWarehouseBarcodeAssociationInput
): Promise<WarehouseBarcodeAssociation> {
  return warehouseServerCommand<WarehouseBarcodeAssociation>(workspaceId, 'BARCODE_SAVE', input);
}

export async function setWarehouseBarcodeStatus(
  workspaceId: string,
  barcodeId: string,
  status: 'active' | 'inactive'
): Promise<void> {
  await warehouseServerCommand(workspaceId, 'BARCODE_STATUS', { barcodeId, status });
}

export async function replaceWarehouseBarcodeAssociation(
  workspaceId: string,
  barcodeId: string,
  nextBarcodeInput: string
): Promise<WarehouseBarcodeAssociation> {
  return warehouseServerCommand<WarehouseBarcodeAssociation>(
    workspaceId, 'BARCODE_REPLACE', { barcodeId, nextBarcodeInput }
  );
}
