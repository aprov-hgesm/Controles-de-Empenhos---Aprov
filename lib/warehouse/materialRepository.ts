import { collection, doc, getDoc, getDocs, limit, query, setDoc } from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';

import { db, handleFirestoreError, OperationType } from '../firebase';
import { normalizeWorkspaceId } from '../platformIdentity';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import {
  warehouseDomainPath,
  warehouseDocumentPath,
} from './namespace';

function validateForWorkspace(
  workspaceId: string,
  material: unknown
): WarehouseMaterial {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const result = validateWarehouseMaterial(material, {
    expectedWorkspaceId: normalizedWorkspaceId,
  });

  if (!result.ok) {
    const detail = result.issues
      .map((item) => `${item.path}: ${item.message}`)
      .join('; ');
    throw new Error(`WAREHOUSE_INVALID_MATERIAL: ${detail}`);
  }

  return result.data;
}

export async function listWarehouseMaterials(
  workspaceId: string,
  maxResults = 250
): Promise<WarehouseMaterial[]> {
  const path = warehouseDomainPath(workspaceId, 'materials');

  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 500))))
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    return snapshot.docs.map((item) =>
      validateForWorkspace(workspaceId, {
        ...item.data(),
        id: item.id,
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getWarehouseMaterial(
  workspaceId: string,
  materialId: string
): Promise<WarehouseMaterial | null> {
  const path = warehouseDocumentPath(workspaceId, 'materials', materialId);

  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;

    return validateForWorkspace(workspaceId, {
      ...snapshot.data(),
      id: snapshot.id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function saveWarehouseMaterial(
  workspaceId: string,
  material: WarehouseMaterial
): Promise<WarehouseMaterial> {
  const canonical = validateForWorkspace(workspaceId, material);
  const path = warehouseDocumentPath(workspaceId, 'materials', canonical.id);

  try {
    await setDoc(doc(db, path), canonical);
    return canonical;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return canonical;
  }
}
