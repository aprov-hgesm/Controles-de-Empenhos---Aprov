import { collection, doc, getDoc, getDocs, limit, query, setDoc, startAfter, type DocumentData, type QueryDocumentSnapshot, type QuerySnapshot } from 'firebase/firestore';

import { recordWarehouseDocumentReads } from './telemetry';

import { warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { normalizeWorkspaceId } from '../platformIdentity';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import {
  warehouseDomainPath,
  warehouseDocumentPath,
} from './namespace';
import { warehouseCanonicalMaterialReadInput } from './readCompatibility';
import { warehouseServerCommand } from './serverCommandClient';

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
  const max = Math.max(1, Math.min(maxResults, 5000));

  try {
    const materials: WarehouseMaterial[] = [];
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
    while (materials.length < max) {
      const pageSize = Math.min(500, max - materials.length);
      const base = collection(db, path);
      const snapshot: QuerySnapshot<DocumentData> = await getDocs(cursor
        ? query(base, startAfter(cursor), limit(pageSize))
        : query(base, limit(pageSize)));
      recordWarehouseDocumentReads(workspaceId, snapshot.size);
      for (const item of snapshot.docs) {
        materials.push(validateForWorkspace(workspaceId,
          warehouseCanonicalMaterialReadInput(
            item.id, item.data() as Record<string, unknown>
          )
        ));
      }
      if (snapshot.size < pageSize) return materials;
      cursor = snapshot.docs[snapshot.docs.length - 1];
    }
    // Somente a leitura ampliada do importador precisa garantir cobertura total.
    if (maxResults > 500 && cursor) {
      const additional = await getDocs(query(collection(db, path), startAfter(cursor), limit(1)));
      recordWarehouseDocumentReads(workspaceId, additional.size);
      if (!additional.empty) throw new Error('WAREHOUSE_MATERIAL_CATALOG_INCOMPLETE');
    }
    return materials;
  } catch (error) {
    if (error instanceof Error && error.message === 'WAREHOUSE_MATERIAL_CATALOG_INCOMPLETE')
      throw error;
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
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

    return validateForWorkspace(
      workspaceId,
      warehouseCanonicalMaterialReadInput(
        snapshot.id,
        snapshot.data() as Record<string, unknown>
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Não há escrita de materiais via SDK cliente.
 * O servidor revalida tenant, UG, atributos e unidade após lançamentos.
 */
export async function saveWarehouseMaterial(
  workspaceId: string,
  material: WarehouseMaterial
): Promise<WarehouseMaterial> {
  const canonical=validateForWorkspace(workspaceId,material);
  return warehouseServerCommand<WarehouseMaterial>(
    workspaceId,'MATERIAL_SAVE',canonical
  );
}
