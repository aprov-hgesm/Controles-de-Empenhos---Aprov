import { allocateWarehousePendingItemFast } from './intakeActionClient';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import {
  barcodeAssociationMatchesMaterial,
  createWarehouseBarcodeId,
  normalizeWarehouseBarcode,
  validateWarehouseBarcodeAssociation,
  WAREHOUSE_BARCODE_SCHEMA_VERSION,
  type WarehouseBarcodeAssociation,
} from './barcode';
import {
  deriveWarehouseMaterialIdForEmpenhoItem,
  warehouseUnitFromOperationalLabel,
} from './invoiceIntegration';
import { WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION } from './intake';
import {
  calculateWarehouseItemIntakePendingQuantity,
  deriveWarehouseItemIntakeStatus,
  validateWarehouseItemIntakeState,
  WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
  type WarehouseItemIntakeEffectiveStatus,
  type WarehouseItemIntakeState,
} from './intakeState';
import {
  applyWarehouseLocationDelta,
  createWarehouseLocationBalanceId,
  normalizeWarehouseLocationQuantity,
  validateWarehouseDepot,
  validateWarehouseLocation,
  validateWarehouseLocationBalance,
  validateWarehouseStockPosition,
  warehouseStockPositionKey,
  warehouseStockPositionsEqual,
  type WarehouseDepot,
  type WarehouseLocation,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import {
  applyWarehouseMovement,
} from './ledgerRepository';
import {
  createWarehousePendingLotCode,
  normalizeWarehouseExpiryDate,
  normalizeWarehouseLotCode,
  validateWarehouseLot,
  WAREHOUSE_LOT_SCHEMA_VERSION,
  type WarehouseLot,
} from './lot';
import {
  createWarehouseMaterial,
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import {
  getWarehouseMaterial,
  saveWarehouseMaterial,
} from './materialRepository';
import {
  createWarehouseMovementId,
  normalizeWarehouseQuantity,
  validateWarehouseBalance,
  validateWarehouseMovement,
  warehouseMovementMatchesReplay,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance,
  type WarehouseMovement,
} from './movement';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';
import {
  warehouseCanonicalBarcodeReadInput,
  warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput,
  warehouseCanonicalMaterialReadInput,
} from './readCompatibility';

const LEGACY_MOVEMENTS_PER_INVOICE_LIMIT = 51;
const QUANTITY_EPSILON = 0.000001;

export interface WarehouseIntakeEntryInput {
  intakeId: string;
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  itemId: string;
  materialId: string | null;
  description: string;
  unitLabel: string;
  supplier: string;
  receivedQuantity: number;
}

export interface AllocateWarehousePendingItemInput extends WarehouseIntakeEntryInput {
  expectedAllocatedQuantity: number;
  expectedImmediateConsumptionQuantity: number;
  effectiveStatus: WarehouseItemIntakeEffectiveStatus;
  quantity: number;
  position: WarehouseStockPosition;
  lotCode: string;
  expiresOn: string | null;
  barcode?: string | null;
  operationId: string;
}

export interface AllocateWarehousePendingItemResult {
  applied: boolean;
  intake: WarehouseItemIntakeState;
  entryMovementId: string;
  transferMovementId: string;
  lot: WarehouseLot;
  barcode: WarehouseBarcodeAssociation | null;
}

function currentScope(workspaceId: string): {
  workspaceId: string;
  ug: string;
  uid: string;
} {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_INTAKE_ALLOCATION_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (
    scope.workspaceId !== normalizedWorkspaceId
    || !scope.ug
  ) {
    throw new Error('WAREHOUSE_INTAKE_ALLOCATION_SCOPE_MISMATCH');
  }
  return {
    workspaceId: normalizedWorkspaceId,
    ug: scope.ug,
    uid: user.uid,
  };
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

function parseMaterial(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseMaterial {
  const parsed = validateWarehouseMaterial(
    warehouseCanonicalMaterialReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_MATERIAL: '
      + parsed.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return parsed.data;
}

function parseMovement(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseMovement {
  const parsed = validateWarehouseMovement(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      type: data.type,
      quantityDelta: data.quantityDelta,
      idempotencyKeyHash: data.idempotencyKeyHash,
      reversesMovementId: data.reversesMovementId ?? null,
      note: data.note ?? null,
      source: data.source ?? null,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_MOVEMENT: '
      + parsed.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return parsed.data;
}

function parseBalance(
  workspaceId: string,
  materialId: string,
  data: Record<string, unknown>
): WarehouseBalance {
  const parsed = validateWarehouseBalance(
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
      expectedMaterialId: materialId,
    }
  );
  if (!parsed.ok) throw new Error('WAREHOUSE_INVALID_BALANCE');
  return parsed.data;
}

function parseLocationBalance(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLocationBalance {
  const parsed = validateWarehouseLocationBalance(
    warehouseCanonicalLocationBalanceReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) throw new Error('WAREHOUSE_INVALID_LOCATION_BALANCE');
  return parsed.data;
}

function parseDepot(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseDepot {
  const parsed = validateWarehouseDepot(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) throw new Error('WAREHOUSE_INVALID_DEPOT');
  return parsed.data;
}

function parseLocation(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLocation {
  const parsed = validateWarehouseLocation(
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      depotId: data.depotId,
      kind: data.kind,
      parentLocationId: data.parentLocationId ?? null,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) throw new Error('WAREHOUSE_INVALID_LOCATION');
  return parsed.data;
}

function parseIntake(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseItemIntakeState {
  if (data.schemaVersion === WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION) {
    throw new Error('WAREHOUSE_ITEM_INTAKE_LEGACY_COMPLETED');
  }
  const parsed = validateWarehouseItemIntakeState(
    {
      ...data,
      id,
      createdAt: timestampToIso(data.createdAt),
      updatedAt: timestampToIso(data.updatedAt),
    },
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_ITEM_INTAKE_STATE: '
      + parsed.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return parsed.data;
}

function parseLot(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLot {
  const parsed = validateWarehouseLot(
    warehouseCanonicalLotReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) throw new Error('WAREHOUSE_INVALID_LOT');
  return parsed.data;
}

function parseBarcode(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseBarcodeAssociation {
  const parsed = validateWarehouseBarcodeAssociation(
    warehouseCanonicalBarcodeReadInput(id, data),
    { expectedWorkspaceId: workspaceId }
  );
  if (!parsed.ok) throw new Error('WAREHOUSE_INVALID_BARCODE');
  return parsed.data;
}

function normalizeOperationId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{8,96}$/.test(normalized)) {
    throw new Error('WAREHOUSE_INTAKE_ALLOCATION_INVALID_OPERATION_ID');
  }
  return normalized;
}

async function stableHex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function createIntakeLotId(input: {
  workspaceId: string;
  intakeId: string;
  entryMovementId: string;
  lotCode: string;
  position: WarehouseStockPosition;
}): Promise<string> {
  const digest = await stableHex([
    input.workspaceId,
    input.intakeId,
    input.entryMovementId,
    input.lotCode,
    warehouseStockPositionKey(input.position),
  ].join('\n'));
  return 'lot_' + digest.slice(0, 32);
}

async function ensureCanonicalMaterial(
  scope: { workspaceId: string; ug: string },
  input: WarehouseIntakeEntryInput
): Promise<WarehouseMaterial> {
  const materialId = input.materialId?.trim().toLowerCase()
    || await deriveWarehouseMaterialIdForEmpenhoItem(
      scope.workspaceId,
      input.empenhoId,
      input.itemId
    );

  let material = await getWarehouseMaterial(scope.workspaceId, materialId);
  if (!material) {
    const candidate = createWarehouseMaterial({
      id: materialId,
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      description: input.description,
      aliases: [],
      unit: warehouseUnitFromOperationalLabel(input.unitLabel),
      status: 'active',
      conversions: [],
    });
    if (!candidate.ok) {
      throw new Error(
        'WAREHOUSE_INTAKE_MATERIAL_CREATE_FAILED: '
        + candidate.issues.map((issue) => issue.message).join('; ')
      );
    }
    await saveWarehouseMaterial(scope.workspaceId, candidate.data);
    material = await getWarehouseMaterial(scope.workspaceId, materialId);
  }

  if (!material) throw new Error('WAREHOUSE_INTAKE_MATERIAL_CREATE_FAILED');
  if (material.ug !== scope.ug || material.status !== 'active') {
    throw new Error('WAREHOUSE_INTAKE_MATERIAL_INACTIVE');
  }
  if (
    input.materialId
    && input.materialId.trim().toLowerCase() !== material.id
  ) {
    throw new Error('WAREHOUSE_ITEM_INTAKE_MATERIAL_CONFLICT');
  }
  return material;
}

async function findLegacyInvoiceMovements(
  workspaceId: string,
  invoiceRecordKey: string,
  itemId: string,
  expectedEntryMovementId: string
): Promise<WarehouseMovement[]> {
  const path = warehouseDomainPath(workspaceId, 'movements');
  try {
    const snapshot = await getDocs(
      query(
        collection(db, path),
        where('source.invoiceRecordKey', '==', invoiceRecordKey),
        limit(LEGACY_MOVEMENTS_PER_INVOICE_LIMIT)
      )
    );
    if (snapshot.size >= LEGACY_MOVEMENTS_PER_INVOICE_LIMIT) {
      throw new Error('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
    }

    return snapshot.docs
      .map((entry) =>
        parseMovement(
          workspaceId,
          entry.id,
          entry.data() as Record<string, unknown>
        )
      )
      .filter((movement) => {
        if (movement.id === expectedEntryMovementId) return false;
        return movement.source?.kind === 'INVOICE'
          && movement.source.itemIds.includes(itemId);
      });
  } catch (error) {
    if (
      error instanceof Error
      && error.message === 'WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED'
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

async function ensureInvoiceEntry(
  scope: { workspaceId: string; ug: string; uid: string },
  material: WarehouseMaterial,
  input: WarehouseIntakeEntryInput
): Promise<WarehouseMovement> {
  const idempotencyKey = [
    'adm-intake-v2',
    input.intakeId,
    'invoice-entry',
  ].join(':').slice(0, 240);
  const expectedEntryMovementId = await createWarehouseMovementId(
    scope.workspaceId,
    idempotencyKey
  );

  const legacyMovements = await findLegacyInvoiceMovements(
    scope.workspaceId,
    input.invoiceRecordKey,
    input.itemId,
    expectedEntryMovementId
  );
  if (legacyMovements.length > 0) {
    throw new Error('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
  }

  const entry = await applyWarehouseMovement(scope.workspaceId, {
    materialId: material.id,
    type: 'INVOICE_ENTRY',
    quantityDelta: input.receivedQuantity,
    idempotencyKey,
    note: 'Entrada quantitativa da NF para tratamento pelo intake v2',
    source: {
      kind: 'INVOICE',
      action: 'ENTRY',
      invoiceRecordKey: input.invoiceRecordKey,
      invoiceId: input.invoiceId,
      empenhoId: input.empenhoId,
      itemIds: [input.itemId],
      supplier: input.supplier,
      supplierCnpj: null,
      actorUid: scope.uid,
    },
  });

  return entry.movement;
}

function ensureActivePosition(
  scope: { workspaceId: string; ug: string },
  position: WarehouseStockPosition,
  depot: WarehouseDepot,
  location: WarehouseLocation,
  subposition: WarehouseLocation | null
): void {
  if (position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_INTAKE_LOCATION_REQUIRED');
  }
  if (
    depot.ug !== scope.ug
    || depot.status !== 'active'
    || location.ug !== scope.ug
    || location.status !== 'active'
    || location.kind !== 'LOCAL'
    || location.depotId !== depot.id
    || location.id !== position.locationId
  ) {
    throw new Error('WAREHOUSE_POSITION_INACTIVE');
  }

  if (position.kind === 'SUBPOSITION') {
    if (
      !subposition
      || subposition.ug !== scope.ug
      || subposition.status !== 'active'
      || subposition.kind !== 'SUBPOSITION'
      || subposition.depotId !== depot.id
      || subposition.parentLocationId !== location.id
      || subposition.id !== position.subpositionId
    ) {
      throw new Error('WAREHOUSE_SUBPOSITION_INACTIVE');
    }
  }
}

export async function ensureWarehouseIntakeEntryContext(
  workspaceId: string,
  input: WarehouseIntakeEntryInput
): Promise<{
  scope: { workspaceId: string; ug: string; uid: string };
  material: WarehouseMaterial;
  entryMovement: WarehouseMovement;
}> {
  const scope = currentScope(workspaceId);
  const material = await ensureCanonicalMaterial(scope, input);
  const entryMovement = await ensureInvoiceEntry(scope, material, input);
  return { scope, material, entryMovement };
}

/** Entrada por NF e lote são sempre autorizadas pelo backend intake-action. */
export async function allocateWarehousePendingItem(
  workspaceId:string,input:AllocateWarehousePendingItemInput
):Promise<AllocateWarehousePendingItemResult> {
  return allocateWarehousePendingItemFast(workspaceId,input);
}
