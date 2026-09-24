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

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  WAREHOUSE_BARCODE_SCHEMA_VERSION,
  barcodeAssociationMatchesMaterial,
  createWarehouseBarcodeId,
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
import { validateWarehouseMaterial } from './material';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';

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
    { ...data, id },
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
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      barcode: data.barcode,
      presentation: data.presentation,
      factorToBaseUnit: data.factorToBaseUnit,
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
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
    return null;
  }
}

export async function saveWarehouseBarcodeAssociation(
  workspaceId: string,
  input: SaveWarehouseBarcodeAssociationInput
): Promise<WarehouseBarcodeAssociation> {
  const scope = currentScope(workspaceId);
  const barcode = normalizeWarehouseBarcode(input.barcode);
  const presentation = normalizeWarehouseMaterialUnit(input.presentation);
  if (!barcode) throw new Error('WAREHOUSE_INVALID_BARCODE');
  if (!presentation) throw new Error('WAREHOUSE_BARCODE_INVALID_PRESENTATION');

  const id = await createWarehouseBarcodeId(scope.workspaceId, barcode);
  const barcodePath = warehouseDocumentPath(scope.workspaceId, 'barcodes', id);
  const materialPath = warehouseDocumentPath(
    scope.workspaceId,
    'materials',
    input.materialId
  );

  try {
    return await runTransaction(db, async (transaction) => {
      const barcodeRef = doc(db, barcodePath);
      const materialRef = doc(db, materialPath);
      const [barcodeSnapshot, materialSnapshot] = await Promise.all([
        transaction.get(barcodeRef),
        transaction.get(materialRef),
      ]);
      if (!materialSnapshot.exists()) throw new Error('WAREHOUSE_MATERIAL_NOT_FOUND');

      const material = parseMaterial(
        scope.workspaceId,
        materialSnapshot.id,
        materialSnapshot.data() as Record<string, unknown>
      );
      if (material.status !== 'active' || material.ug !== scope.ug) {
        throw new Error('WAREHOUSE_MATERIAL_INACTIVE');
      }
      const factorToBaseUnit = warehousePresentationFactor(material, presentation);
      if (factorToBaseUnit === null) {
        throw new Error('WAREHOUSE_BARCODE_PRESENTATION_NOT_CONFIGURED');
      }

      if (barcodeSnapshot.exists()) {
        const existing = parseAssociation(
          scope.workspaceId,
          barcodeSnapshot.id,
          barcodeSnapshot.data() as Record<string, unknown>
        );
        const sameIdentity = existing.materialId === material.id
          && existing.barcode === barcode
          && existing.factorToBaseUnit === factorToBaseUnit
          && JSON.stringify(existing.presentation) === JSON.stringify(presentation);
        if (!sameIdentity) throw new Error('WAREHOUSE_BARCODE_ALREADY_LINKED');
        if (!barcodeAssociationMatchesMaterial(existing, material)) {
          throw new Error('WAREHOUSE_BARCODE_MATERIAL_CONVERSION_MISMATCH');
        }
        if (existing.status === 'active') return existing;

        transaction.update(barcodeRef, {
          status: 'active',
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
        return { ...existing, status: 'active', updatedBy: scope.uid };
      }

      const candidate = validateWarehouseBarcodeAssociation(
        {
          schemaVersion: WAREHOUSE_BARCODE_SCHEMA_VERSION,
          id,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          materialId: material.id,
          barcode,
          presentation,
          factorToBaseUnit,
          status: 'active',
          createdBy: scope.uid,
          updatedBy: scope.uid,
        },
        {
          expectedWorkspaceId: scope.workspaceId,
          expectedUg: scope.ug,
          expectedMaterialId: material.id,
        }
      );
      if (!candidate.ok) {
        throw new Error(
          'WAREHOUSE_INVALID_BARCODE: '
          + candidate.issues.map((item) => item.message).join('; ')
        );
      }

      transaction.set(barcodeRef, {
        ...candidate.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return candidate.data;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, barcodePath);
    throw error;
  }
}

export async function setWarehouseBarcodeStatus(
  workspaceId: string,
  barcodeId: string,
  status: 'active' | 'inactive'
): Promise<void> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(scope.workspaceId, 'barcodes', barcodeId);
  await updateDoc(doc(db, path), {
    status,
    updatedBy: scope.uid,
    updatedAt: serverTimestamp(),
  });
}
