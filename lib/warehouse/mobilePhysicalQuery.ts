import {
  collection,
  documentId,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';

import {
  auth,
  warehouseDb as db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import {
  validateWarehouseLocationBalance,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import {
  validateWarehouseLot,
  type WarehouseLot,
} from './lot';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import {
  buildWarehouseMobilePhysicalQueryItems,
  warehouseMobilePhysicalQueryPlan,
  type WarehouseMobilePhysicalQueryItem,
} from './mobilePhysicalQueryModel';
import { warehouseDomainPath } from './namespace';
import { recordWarehouseDocumentReads } from './telemetry';

export const WAREHOUSE_MOBILE_PHYSICAL_BALANCE_LIMIT = 60;
export const WAREHOUSE_MOBILE_PHYSICAL_LOT_LIMIT = 120;
export const WAREHOUSE_MOBILE_PHYSICAL_MATERIAL_BATCH = 30;

export interface WarehouseMobilePhysicalQueryMetrics {
  contentQueries: number;
  contentDocumentsRead: number;
  resolverReadsApprox: number;
  totalReadsApprox: number;
  listeners: 0;
  cache: 'none';
  payloadBytesApprox: number;
}

export interface WarehouseMobilePhysicalQueryResult {
  position: Exclude<WarehouseStockPosition, { kind: 'UNASSIGNED' }>;
  items: WarehouseMobilePhysicalQueryItem[];
  metrics: WarehouseMobilePhysicalQueryMetrics;
}

interface PhysicalQueryScope {
  workspaceId: string;
  ug: string;
}

function requireScope(input: {
  workspaceId: string;
  ug: string | number;
}): PhysicalQueryScope {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_AUTH_REQUIRED');

  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const ug = normalizeUnitUg(input.ug);
  if (!isValidWorkspaceId(workspaceId) || !isValidUnitUg(ug)) {
    throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_INVALID_CONTEXT');
  }

  const current = getCurrentOperationalScope(user.uid);
  if (current.workspaceId !== workspaceId || current.ug !== ug) {
    throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_SCOPE_MISMATCH');
  }

  return { workspaceId, ug };
}

function parseBalance(
  scope: PhysicalQueryScope,
  id: string,
  data: Record<string, unknown>
): WarehouseLocationBalance {
  // Compatibilidade de leitura para saldos legados:
  // preserva o contrato canônico e ignora apenas metadados extras históricos.
  const canonicalBalanceInput = {
    schemaVersion: data.schemaVersion,
    id,
    workspaceId: data.workspaceId,
    ug: data.ug,
    materialId: data.materialId,
    position: data.position,
    quantity: data.quantity,
    revision: data.revision,
    lastMovementId: data.lastMovementId,
  };

  const result = validateWarehouseLocationBalance(
    canonicalBalanceInput,
    { expectedWorkspaceId: scope.workspaceId }
  );
  if (!result.ok) {
    const issues = result.issues.map((issue) => issue.code + '@' + issue.path).join(',');
    throw new Error(
      'WAREHOUSE_MOBILE_PHYSICAL_QUERY_INVALID_BALANCE:' + id + ':' + issues
    );
  }
  if (result.data.ug !== scope.ug) {
    throw new Error(
      'WAREHOUSE_MOBILE_PHYSICAL_QUERY_INVALID_BALANCE:' + id + ':ug_mismatch'
    );
  }
  return result.data;
}

function parseMaterial(
  scope: PhysicalQueryScope,
  id: string,
  data: Record<string, unknown>
): WarehouseMaterial {
  const result = validateWarehouseMaterial(
    { ...data, id },
    {
      expectedWorkspaceId: scope.workspaceId,
      expectedUg: scope.ug,
    }
  );
  if (!result.ok) {
    const issues = result.issues.map((issue) => issue.code + '@' + issue.path).join(',');
    throw new Error(
      'WAREHOUSE_MOBILE_PHYSICAL_QUERY_INVALID_MATERIAL:' + id + ':' + issues
    );
  }
  return result.data;
}

function parseLot(
  scope: PhysicalQueryScope,
  id: string,
  data: Record<string, unknown>
): WarehouseLot {
  const result = validateWarehouseLot(
    {
      ...data,
      id,
      expiresOn: data.expiresOn ?? null,
    },
    {
      expectedWorkspaceId: scope.workspaceId,
      expectedUg: scope.ug,
    }
  );
  if (!result.ok) {
    const issues = result.issues.map((issue) => issue.code + '@' + issue.path).join(',');
    throw new Error(
      'WAREHOUSE_MOBILE_PHYSICAL_QUERY_INVALID_LOT:' + id + ':' + issues
    );
  }
  return result.data;
}

async function loadPositionBalances(
  scope: PhysicalQueryScope,
  position: Exclude<WarehouseStockPosition, { kind: 'UNASSIGNED' }>
): Promise<{ balances: WarehouseLocationBalance[]; reads: number }> {
  const path = warehouseDomainPath(scope.workspaceId, 'locationBalances');
  const plan = warehouseMobilePhysicalQueryPlan(position);

  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where(plan.field, '==', plan.value),
        where('position.kind', '==', plan.kind),
        limit(WAREHOUSE_MOBILE_PHYSICAL_BALANCE_LIMIT + 1)
      )
    );
    recordWarehouseDocumentReads(scope.workspaceId, snapshot.size);

    if (snapshot.size > WAREHOUSE_MOBILE_PHYSICAL_BALANCE_LIMIT) {
      throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_BALANCE_LIMIT');
    }

    return {
      balances: snapshot.docs.map((item) =>
        parseBalance(
          scope,
          item.id,
          item.data() as Record<string, unknown>
        )
      ),
      reads: snapshot.size,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

async function loadMaterials(
  scope: PhysicalQueryScope,
  materialIds: readonly string[]
): Promise<{ materials: WarehouseMaterial[]; reads: number; queries: number }> {
  if (materialIds.length === 0) {
    return { materials: [], reads: 0, queries: 0 };
  }

  const path = warehouseDomainPath(scope.workspaceId, 'materials');
  const materials: WarehouseMaterial[] = [];
  let reads = 0;
  let queries = 0;

  try {
    for (
      let offset = 0;
      offset < materialIds.length;
      offset += WAREHOUSE_MOBILE_PHYSICAL_MATERIAL_BATCH
    ) {
      const ids = materialIds.slice(
        offset,
        offset + WAREHOUSE_MOBILE_PHYSICAL_MATERIAL_BATCH
      );
      const snapshot = await getDocs(
        query(
          collection(db, path),
          where(documentId(), 'in', ids)
        )
      );
      recordWarehouseDocumentReads(scope.workspaceId, snapshot.size);
      reads += snapshot.size;
      queries += 1;

      snapshot.docs.forEach((item) => {
        materials.push(
          parseMaterial(
            scope,
            item.id,
            item.data() as Record<string, unknown>
          )
        );
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }

  if (materials.length !== materialIds.length) {
    const found = new Set(materials.map((material) => material.id));
    const missing = materialIds.filter((materialId) => !found.has(materialId));
    throw new Error(
      'WAREHOUSE_MOBILE_PHYSICAL_QUERY_MATERIAL_NOT_FOUND:' + missing.join(',')
    );
  }

  return { materials, reads, queries };
}

async function loadPositionLots(
  scope: PhysicalQueryScope,
  position: Exclude<WarehouseStockPosition, { kind: 'UNASSIGNED' }>
): Promise<{ lots: WarehouseLot[]; reads: number }> {
  const path = warehouseDomainPath(scope.workspaceId, 'lots');
  const plan = warehouseMobilePhysicalQueryPlan(position);

  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where(plan.field, '==', plan.value),
        where('position.kind', '==', plan.kind),
        limit(WAREHOUSE_MOBILE_PHYSICAL_LOT_LIMIT + 1)
      )
    );
    recordWarehouseDocumentReads(scope.workspaceId, snapshot.size);

    if (snapshot.size > WAREHOUSE_MOBILE_PHYSICAL_LOT_LIMIT) {
      throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_LOT_LIMIT');
    }

    return {
      lots: snapshot.docs.map((item) =>
        parseLot(
          scope,
          item.id,
          item.data() as Record<string, unknown>
        )
      ),
      reads: snapshot.size,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

function approximatePayloadBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return 0;
  }
}

export async function loadWarehouseMobilePhysicalPositionContents(input: {
  workspaceId: string;
  ug: string | number;
  position: WarehouseStockPosition;
}): Promise<WarehouseMobilePhysicalQueryResult> {
  const scope = requireScope(input);
  const plan = warehouseMobilePhysicalQueryPlan(input.position);
  const position = input.position as Exclude<
    WarehouseStockPosition,
    { kind: 'UNASSIGNED' }
  >;

  const balanceResult = await loadPositionBalances(scope, position);
  const materialIds = Array.from(
    new Set(
      balanceResult.balances
        .filter((balance) => balance.quantity > 0)
        .map((balance) => balance.materialId)
    )
  );

  if (materialIds.length === 0) {
    const resolverReadsApprox = plan.kind === 'LOCATION' ? 2 : 3;
    const emptyPayload = { position, items: [] };
    return {
      position,
      items: [],
      metrics: {
        contentQueries: 1,
        contentDocumentsRead: balanceResult.reads,
        resolverReadsApprox,
        totalReadsApprox: resolverReadsApprox + balanceResult.reads,
        listeners: 0,
        cache: 'none',
        payloadBytesApprox: approximatePayloadBytes(emptyPayload),
      },
    };
  }

  const [materialResult, lotResult] = await Promise.all([
    loadMaterials(scope, materialIds),
    loadPositionLots(scope, position),
  ]);

  const items = buildWarehouseMobilePhysicalQueryItems({
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    position,
    balances: balanceResult.balances,
    materials: materialResult.materials,
    lots: lotResult.lots,
  });

  const resolverReadsApprox = plan.kind === 'LOCATION' ? 2 : 3;
  const contentQueries = 2 + materialResult.queries;
  const contentDocumentsRead =
    balanceResult.reads + materialResult.reads + lotResult.reads;

  return {
    position,
    items,
    metrics: {
      contentQueries,
      contentDocumentsRead,
      resolverReadsApprox,
      totalReadsApprox: resolverReadsApprox + contentDocumentsRead,
      listeners: 0,
      cache: 'none',
      payloadBytesApprox: approximatePayloadBytes({ position, items }),
    },
  };
}
