import {
  collection,
  documentId,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  validateWarehouseDepot,
  validateWarehouseLocation,
  validateWarehouseLocationBalance,
  warehouseStockPositionKey,
  type WarehouseDepot,
  type WarehouseLocation,
  type WarehouseLocationBalance,
} from './location';
import { validateWarehouseLot, type WarehouseLot } from './lot';
import {
  isValidWarehouseMaterialId,
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import { validateWarehouseBalance, type WarehouseBalance } from './movement';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import {
  warehouseCanonicalDepotReadInput,
  warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLocationReadInput,
  warehouseCanonicalLotReadInput,
  warehouseCanonicalMaterialReadInput,
} from './readCompatibility';
import { recordWarehouseDocumentReads } from './telemetry';

export const WAREHOUSE_MOBILE_OUTBOUND_LOCATION_LIMIT = 60;
export const WAREHOUSE_MOBILE_OUTBOUND_LOT_LIMIT = 120;
const DOCUMENT_ID_BATCH = 30;

export interface WarehouseMobileOutboundPositionLabel {
  key: string;
  label: string;
}

export interface WarehouseMobileItemAvailability {
  material: WarehouseMaterial;
  balance: WarehouseBalance;
  locationBalances: WarehouseLocationBalance[];
  lots: WarehouseLot[];
  positionLabels: WarehouseMobileOutboundPositionLabel[];
  metrics: {
    documentsRead: number;
    listeners: 0;
  };
}

function currentScope(
  workspaceId: string
): { workspaceId: string; ug: string; uid: string } {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_MOBILE_OUTBOUND_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_MOBILE_OUTBOUND_SCOPE_MISMATCH');
  }
  return { workspaceId: scope.workspaceId, ug: scope.ug, uid: user.uid };
}

async function loadDocumentsById(
  workspaceId: string,
  path: string,
  ids: readonly string[]
): Promise<{ data: Map<string, Record<string, unknown>>; reads: number }> {
  const unique = Array.from(new Set(ids));
  const data = new Map<string, Record<string, unknown>>();
  let reads = 0;

  for (let offset = 0; offset < unique.length; offset += DOCUMENT_ID_BATCH) {
    const batch = unique.slice(offset, offset + DOCUMENT_ID_BATCH);
    if (batch.length === 0) continue;
    const snapshot = await getDocs(
      query(collection(db, path), where(documentId(), 'in', batch))
    );
    recordWarehouseDocumentReads(workspaceId, snapshot.size);
    reads += snapshot.size;
    snapshot.docs.forEach((item) => {
      data.set(item.id, item.data() as Record<string, unknown>);
    });
  }

  return { data, reads };
}

function parseMaterial(
  workspaceId: string,
  ug: string,
  id: string,
  data: Record<string, unknown>
): WarehouseMaterial {
  const result = validateWarehouseMaterial(
    warehouseCanonicalMaterialReadInput(id, data),
    { expectedWorkspaceId: workspaceId, expectedUg: ug }
  );
  if (!result.ok) throw new Error('WAREHOUSE_MOBILE_OUTBOUND_INVALID_MATERIAL');
  return result.data;
}

function parseBalance(
  workspaceId: string,
  ug: string,
  materialId: string,
  data: Record<string, unknown>
): WarehouseBalance {
  const result = validateWarehouseBalance(
    {
      schemaVersion: data.schemaVersion,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      quantity: data.quantity,
      revision: data.revision,
      lastMovementId: data.lastMovementId,
    },
    {
      expectedWorkspaceId: workspaceId,
      expectedUg: ug,
      expectedMaterialId: materialId,
    }
  );
  if (!result.ok) throw new Error('WAREHOUSE_MOBILE_OUTBOUND_INVALID_BALANCE');
  return result.data;
}

function parseLocationBalance(
  workspaceId: string,
  ug: string,
  materialId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLocationBalance {
  const result = validateWarehouseLocationBalance(
    warehouseCanonicalLocationBalanceReadInput(id, data),
    { expectedWorkspaceId: workspaceId, expectedMaterialId: materialId }
  );
  if (!result.ok || result.data.ug !== ug) {
    throw new Error('WAREHOUSE_MOBILE_OUTBOUND_INVALID_LOCATION_BALANCE');
  }
  return result.data;
}

function parseLot(
  workspaceId: string,
  ug: string,
  materialId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLot {
  const result = validateWarehouseLot(
    warehouseCanonicalLotReadInput(id, data),
    {
      expectedWorkspaceId: workspaceId,
      expectedUg: ug,
      expectedMaterialId: materialId,
    }
  );
  if (!result.ok) throw new Error('WAREHOUSE_MOBILE_OUTBOUND_INVALID_LOT');
  return result.data;
}

function parseDepot(
  workspaceId: string,
  ug: string,
  id: string,
  data: Record<string, unknown>
): WarehouseDepot {
  const result = validateWarehouseDepot(
    warehouseCanonicalDepotReadInput(id, data),
    { expectedWorkspaceId: workspaceId, expectedUg: ug }
  );
  if (!result.ok) throw new Error('WAREHOUSE_MOBILE_OUTBOUND_INVALID_DEPOT');
  return result.data;
}

function parseLocation(
  workspaceId: string,
  ug: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLocation {
  const result = validateWarehouseLocation(
    warehouseCanonicalLocationReadInput(id, data),
    { expectedWorkspaceId: workspaceId, expectedUg: ug }
  );
  if (!result.ok) throw new Error('WAREHOUSE_MOBILE_OUTBOUND_INVALID_LOCATION');
  return result.data;
}

export async function loadWarehouseMobileItemAvailability(
  workspaceId: string,
  materialId: string
): Promise<WarehouseMobileItemAvailability> {
  const scope = currentScope(workspaceId);
  if (!isValidWarehouseMaterialId(materialId)) {
    throw new Error('WAREHOUSE_MOBILE_OUTBOUND_INVALID_MATERIAL_ID');
  }

  const materialPath = warehouseDocumentPath(scope.workspaceId, 'materials', materialId);
  const balancePath = warehouseDocumentPath(scope.workspaceId, 'balances', materialId);
  const locationBalancesPath = warehouseDomainPath(scope.workspaceId, 'locationBalances');
  const lotsPath = warehouseDomainPath(scope.workspaceId, 'lots');

  try {
    const [materialSnapshot, balanceSnapshot, locationSnapshot, lotSnapshot] =
      await Promise.all([
        getDoc(doc(db, materialPath)),
        getDoc(doc(db, balancePath)),
        getDocs(
          query(
            collection(db, locationBalancesPath),
            where('materialId', '==', materialId),
            limit(WAREHOUSE_MOBILE_OUTBOUND_LOCATION_LIMIT + 1)
          )
        ),
        getDocs(
          query(
            collection(db, lotsPath),
            where('materialId', '==', materialId),
            limit(WAREHOUSE_MOBILE_OUTBOUND_LOT_LIMIT + 1)
          )
        ),
      ]);

    const initialReads =
      (materialSnapshot.exists() ? 1 : 0)
      + (balanceSnapshot.exists() ? 1 : 0)
      + locationSnapshot.size
      + lotSnapshot.size;
    recordWarehouseDocumentReads(scope.workspaceId, initialReads);

    if (!materialSnapshot.exists()) throw new Error('WAREHOUSE_MATERIAL_NOT_FOUND');
    if (!balanceSnapshot.exists()) throw new Error('WAREHOUSE_BALANCE_NOT_FOUND');
    if (locationSnapshot.size > WAREHOUSE_MOBILE_OUTBOUND_LOCATION_LIMIT) {
      throw new Error('WAREHOUSE_MOBILE_OUTBOUND_LOCATION_LIMIT');
    }
    if (lotSnapshot.size > WAREHOUSE_MOBILE_OUTBOUND_LOT_LIMIT) {
      throw new Error('WAREHOUSE_MOBILE_OUTBOUND_LOT_LIMIT');
    }

    const material = parseMaterial(
      scope.workspaceId,
      scope.ug,
      materialSnapshot.id,
      materialSnapshot.data() as Record<string, unknown>
    );
    const balance = parseBalance(
      scope.workspaceId,
      scope.ug,
      material.id,
      balanceSnapshot.data() as Record<string, unknown>
    );
    const parsedLocationBalances = locationSnapshot.docs.map((item) =>
      parseLocationBalance(
        scope.workspaceId,
        scope.ug,
        material.id,
        item.id,
        item.data() as Record<string, unknown>
      )
    );
    const lots = lotSnapshot.docs.map((item) =>
      parseLot(
        scope.workspaceId,
        scope.ug,
        material.id,
        item.id,
        item.data() as Record<string, unknown>
      )
    );

    const positivePhysical = parsedLocationBalances.filter(
      (item) => item.quantity > 0 && item.position.kind !== 'UNASSIGNED'
    );
    const depotIds = positivePhysical.flatMap((item) =>
      item.position.kind === 'UNASSIGNED' ? [] : [item.position.depotId]
    );
    const locationIds = positivePhysical.flatMap((item) => {
      if (item.position.kind === 'UNASSIGNED') return [];
      return item.position.kind === 'SUBPOSITION'
        ? [item.position.locationId, item.position.subpositionId]
        : [item.position.locationId];
    });

    const [depotDocuments, locationDocuments] = await Promise.all([
      loadDocumentsById(
        scope.workspaceId,
        warehouseDomainPath(scope.workspaceId, 'depots'),
        depotIds
      ),
      loadDocumentsById(
        scope.workspaceId,
        warehouseDomainPath(scope.workspaceId, 'locations'),
        locationIds
      ),
    ]);

    const activeBalances: WarehouseLocationBalance[] = [];
    const positionLabels: WarehouseMobileOutboundPositionLabel[] = [];

    positivePhysical.forEach((item) => {
      if (item.position.kind === 'UNASSIGNED') return;
      const depotRaw = depotDocuments.data.get(item.position.depotId);
      const localRaw = locationDocuments.data.get(item.position.locationId);
      if (!depotRaw || !localRaw) {
        throw new Error('WAREHOUSE_MOBILE_OUTBOUND_POSITION_METADATA_MISSING');
      }

      const depot = parseDepot(scope.workspaceId, scope.ug, item.position.depotId, depotRaw);
      const local = parseLocation(scope.workspaceId, scope.ug, item.position.locationId, localRaw);
      if (local.kind !== 'LOCAL' || local.depotId !== depot.id) {
        throw new Error('WAREHOUSE_MOBILE_OUTBOUND_POSITION_HIERARCHY_INVALID');
      }
      if (depot.status !== 'active' || local.status !== 'active') return;

      let label = depot.code + ' · ' + local.code;
      if (item.position.kind === 'SUBPOSITION') {
        const subRaw = locationDocuments.data.get(item.position.subpositionId);
        if (!subRaw) {
          throw new Error('WAREHOUSE_MOBILE_OUTBOUND_POSITION_METADATA_MISSING');
        }
        const sub = parseLocation(
          scope.workspaceId,
          scope.ug,
          item.position.subpositionId,
          subRaw
        );
        if (
          sub.kind !== 'SUBPOSITION'
          || sub.depotId !== depot.id
          || sub.parentLocationId !== local.id
        ) {
          throw new Error('WAREHOUSE_MOBILE_OUTBOUND_POSITION_HIERARCHY_INVALID');
        }
        if (sub.status !== 'active') return;
        label += ' · ' + sub.code;
      }

      activeBalances.push(item);
      positionLabels.push({
        key: warehouseStockPositionKey(item.position),
        label,
      });
    });

    return {
      material,
      balance,
      locationBalances: activeBalances,
      lots,
      positionLabels,
      metrics: {
        documentsRead: initialReads + depotDocuments.reads + locationDocuments.reads,
        listeners: 0,
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, locationBalancesPath);
    throw error;
  }
}

export type WarehouseMobileOutboundAvailability = WarehouseMobileItemAvailability;

export const loadWarehouseMobileOutboundAvailability = loadWarehouseMobileItemAvailability;
