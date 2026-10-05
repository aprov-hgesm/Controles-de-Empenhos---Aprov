import {
  collection,
  doc,
  getDoc,
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
  barcodeAssociationMatchesMaterial,
  createWarehouseBarcodeId,
  normalizeWarehouseBarcode,
  validateWarehouseBarcodeAssociation,
  type WarehouseBarcodeAssociation,
} from './barcode';
import {
  validateWarehouseLocationBalance,
  warehouseStockPositionsEqual,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import {
  encodeWarehouseLocationBarcode,
  isWarehouseLocationBarcode,
  WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX,
  WAREHOUSE_LOCATION_BARCODE_NUMERIC_PREFIX,
  WAREHOUSE_LOCATION_BARCODE_PREFIX,
  type WarehouseStockPositionResolveResult,
} from './locationBarcode';
import { resolveWarehouseStockPositionBarcode } from './locationBarcodeResolver';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import {
  loadWarehouseMobilePhysicalPositionContents,
} from './mobilePhysicalQuery';
import type { WarehouseMobilePhysicalQueryItem } from './mobilePhysicalQueryModel';
import {
  buildWarehouseMobilePositionCheckDecision,
  type WarehouseMobilePositionCheckDecision,
} from './mobilePositionCheckModel';
import {
  warehouseDocumentPath,
  warehouseDomainPath,
} from './namespace';
import { recordWarehouseDocumentReads } from './telemetry';

export const WAREHOUSE_MOBILE_POSITION_CHECK_BALANCE_LIMIT = 60;

type ResolvedPosition = Extract<
  WarehouseStockPositionResolveResult,
  { ok: true }
>['value'];

export interface WarehouseMobilePositionCheckAlternative {
  balance: WarehouseLocationBalance;
  resolved: ResolvedPosition;
  code: string;
}

export interface WarehouseMobilePositionCheckMetrics {
  queries: number;
  documentReadsApprox: number;
  selectedPositionResolverReadsApprox: number;
  alternativeResolverReadsApprox: number;
  totalReadsApprox: number;
  listeners: 0;
  cache: 'none';
  payloadBytesApprox: number;
}

export interface WarehouseMobilePositionCheckResult {
  status: WarehouseMobilePositionCheckDecision['status'];
  material: WarehouseMaterial;
  productBarcode: string;
  current: WarehouseMobilePhysicalQueryItem | null;
  alternatives: WarehouseMobilePositionCheckAlternative[];
  metrics: WarehouseMobilePositionCheckMetrics;
}

interface PositionCheckScope {
  workspaceId: string;
  ug: string;
}

function requireScope(input: {
  workspaceId: string;
  ug: string | number;
}): PositionCheckScope {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_AUTH_REQUIRED');

  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const ug = normalizeUnitUg(input.ug);
  if (!isValidWorkspaceId(workspaceId) || !isValidUnitUg(ug)) {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_INVALID_CONTEXT');
  }

  const current = getCurrentOperationalScope(user.uid);
  if (current.workspaceId !== workspaceId || current.ug !== ug) {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_SCOPE_MISMATCH');
  }

  return { workspaceId, ug };
}

function parseAssociation(
  scope: PositionCheckScope,
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
    {
      expectedWorkspaceId: scope.workspaceId,
      expectedUg: scope.ug,
    }
  );

  if (!result.ok) {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_INVALID_BARCODE_ASSOCIATION');
  }
  return result.data;
}

function parseMaterial(
  scope: PositionCheckScope,
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
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_INVALID_MATERIAL');
  }
  return result.data;
}

function parseBalance(
  scope: PositionCheckScope,
  materialId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLocationBalance {
  const result = validateWarehouseLocationBalance(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      position: data.position,
      quantity: data.quantity,
      revision: data.revision,
      lastMovementId: data.lastMovementId,
    },
    {
      expectedWorkspaceId: scope.workspaceId,
      expectedMaterialId: materialId,
    }
  );

  if (!result.ok || result.data.ug !== scope.ug) {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_INVALID_BALANCE');
  }
  return result.data;
}

async function loadProduct(
  scope: PositionCheckScope,
  barcodeInput: string
): Promise<{
  barcode: string;
  association: WarehouseBarcodeAssociation;
  material: WarehouseMaterial;
  reads: number;
}> {
  const barcode = normalizeWarehouseBarcode(barcodeInput);
  if (
    !barcode
    || isWarehouseLocationBarcode(barcode)
    || barcode.toUpperCase().startsWith(WAREHOUSE_LOCATION_BARCODE_PREFIX)
    || barcode.toUpperCase().startsWith(WAREHOUSE_LOCATION_BARCODE_COMPACT_PREFIX)
    || barcode.startsWith(WAREHOUSE_LOCATION_BARCODE_NUMERIC_PREFIX)
  ) {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_PRODUCT_BARCODE_INVALID');
  }

  const barcodeId = await createWarehouseBarcodeId(scope.workspaceId, barcode);
  const barcodePath = warehouseDocumentPath(scope.workspaceId, 'barcodes', barcodeId);

  try {
    const barcodeSnapshot = await getDoc(doc(db, barcodePath));
    recordWarehouseDocumentReads(scope.workspaceId, 1);
    if (!barcodeSnapshot.exists()) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_PRODUCT_NOT_FOUND');
    }

    const association = parseAssociation(
      scope,
      barcodeSnapshot.id,
      barcodeSnapshot.data() as Record<string, unknown>
    );
    if (association.status !== 'active' || association.barcode !== barcode) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_PRODUCT_INACTIVE');
    }

    const materialPath = warehouseDocumentPath(
      scope.workspaceId,
      'materials',
      association.materialId
    );
    const materialSnapshot = await getDoc(doc(db, materialPath));
    recordWarehouseDocumentReads(scope.workspaceId, 1);
    if (!materialSnapshot.exists()) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_MATERIAL_NOT_FOUND');
    }

    const material = parseMaterial(
      scope,
      materialSnapshot.id,
      materialSnapshot.data() as Record<string, unknown>
    );
    if (
      material.status !== 'active'
      || !barcodeAssociationMatchesMaterial(association, material)
    ) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_MATERIAL_INACTIVE');
    }

    return {
      barcode,
      association,
      material,
      reads: 2,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, barcodePath);
    throw error;
  }
}

async function loadMaterialBalances(
  scope: PositionCheckScope,
  materialId: string
): Promise<{ balances: WarehouseLocationBalance[]; reads: number }> {
  const path = warehouseDomainPath(scope.workspaceId, 'locationBalances');

  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('materialId', '==', materialId),
        limit(WAREHOUSE_MOBILE_POSITION_CHECK_BALANCE_LIMIT + 1)
      )
    );
    recordWarehouseDocumentReads(scope.workspaceId, snapshot.size);

    if (snapshot.size > WAREHOUSE_MOBILE_POSITION_CHECK_BALANCE_LIMIT) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_BALANCE_LIMIT');
    }

    return {
      balances: snapshot.docs.map((item) =>
        parseBalance(
          scope,
          materialId,
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

function positionCode(position: WarehouseStockPosition): string {
  if (position.kind === 'LOCATION') {
    return encodeWarehouseLocationBarcode({
      kind: 'LOCAL',
      entityId: position.locationId,
    });
  }
  if (position.kind === 'SUBPOSITION') {
    return encodeWarehouseLocationBarcode({
      kind: 'SUBPOSITION',
      entityId: position.subpositionId,
    });
  }
  throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_PHYSICAL_POSITION_REQUIRED');
}

async function resolveAlternatives(input: {
  scope: PositionCheckScope;
  balances: readonly WarehouseLocationBalance[];
}): Promise<{
  alternatives: WarehouseMobilePositionCheckAlternative[];
  resolverReadsApprox: number;
}> {
  const alternatives: WarehouseMobilePositionCheckAlternative[] = [];
  let resolverReadsApprox = 0;

  for (const balance of input.balances) {
    const code = positionCode(balance.position);
    const resolved = await resolveWarehouseStockPositionBarcode({
      code,
      workspaceId: input.scope.workspaceId,
      ug: input.scope.ug,
    });
    if (!resolved.ok) {
      throw new Error(
        'WAREHOUSE_MOBILE_POSITION_CHECK_ALTERNATIVE_POSITION_INVALID:' + resolved.error
      );
    }
    if (!warehouseStockPositionsEqual(resolved.value.position, balance.position)) {
      throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_ALTERNATIVE_POSITION_MISMATCH');
    }

    resolverReadsApprox += balance.position.kind === 'LOCATION' ? 2 : 3;
    alternatives.push({ balance, resolved: resolved.value, code });
  }

  return { alternatives, resolverReadsApprox };
}

function approximatePayloadBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return 0;
  }
}

export async function checkWarehouseMobileMaterialAtPosition(input: {
  workspaceId: string;
  ug: string | number;
  position: WarehouseStockPosition;
  productBarcode: string;
}): Promise<WarehouseMobilePositionCheckResult> {
  const scope = requireScope(input);
  if (input.position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_PHYSICAL_POSITION_REQUIRED');
  }

  const product = await loadProduct(scope, input.productBarcode);
  const contents = await loadWarehouseMobilePhysicalPositionContents({
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    position: input.position,
  });

  const quickDecision = buildWarehouseMobilePositionCheckDecision({
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    selectedPosition: input.position,
    materialId: product.material.id,
    physicalItems: contents.items,
    materialBalances: [],
  });

  if (quickDecision.status === 'CORRECT') {
    const payload = {
      status: quickDecision.status,
      material: product.material,
      current: quickDecision.current,
      alternatives: [],
    };
    return {
      status: 'CORRECT',
      material: product.material,
      productBarcode: product.barcode,
      current: quickDecision.current,
      alternatives: [],
      metrics: {
        queries: contents.metrics.contentQueries,
        documentReadsApprox: product.reads + contents.metrics.contentDocumentsRead,
        selectedPositionResolverReadsApprox: contents.metrics.resolverReadsApprox,
        alternativeResolverReadsApprox: 0,
        totalReadsApprox: product.reads + contents.metrics.totalReadsApprox,
        listeners: 0,
        cache: 'none',
        payloadBytesApprox: approximatePayloadBytes(payload),
      },
    };
  }

  const materialBalances = await loadMaterialBalances(scope, product.material.id);
  const decision = buildWarehouseMobilePositionCheckDecision({
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    selectedPosition: input.position,
    materialId: product.material.id,
    physicalItems: contents.items,
    materialBalances: materialBalances.balances,
  });
  if (decision.status !== 'INCORRECT') {
    throw new Error('WAREHOUSE_MOBILE_POSITION_CHECK_CONCURRENT_POSITION_CHANGE');
  }

  const alternativeResult = await resolveAlternatives({
    scope,
    balances: decision.alternatives,
  });
  const payload = {
    status: decision.status,
    material: product.material,
    current: null,
    alternatives: alternativeResult.alternatives,
  };

  return {
    status: 'INCORRECT',
    material: product.material,
    productBarcode: product.barcode,
    current: null,
    alternatives: alternativeResult.alternatives,
    metrics: {
      queries: contents.metrics.contentQueries + 1,
      documentReadsApprox:
        product.reads
        + contents.metrics.contentDocumentsRead
        + materialBalances.reads,
      selectedPositionResolverReadsApprox: contents.metrics.resolverReadsApprox,
      alternativeResolverReadsApprox: alternativeResult.resolverReadsApprox,
      totalReadsApprox:
        product.reads
        + contents.metrics.totalReadsApprox
        + materialBalances.reads
        + alternativeResult.resolverReadsApprox,
      listeners: 0,
      cache: 'none',
      payloadBytesApprox: approximatePayloadBytes(payload),
    },
  };
}
