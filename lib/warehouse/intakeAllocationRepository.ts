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

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
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
  applyWarehouseMovementToBalance,
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

const LEGACY_MOVEMENTS_PER_INVOICE_LIMIT = 51;
const QUANTITY_EPSILON = 0.000001;

export interface AllocateWarehousePendingItemInput {
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
    { ...data, id },
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
    {
      schemaVersion: data.schemaVersion,
      id,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      code: data.code,
      expiresOn: data.expiresOn ?? null,
      quantity: data.quantity,
      position: data.position,
      origin: data.origin,
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
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
  input: AllocateWarehousePendingItemInput
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
  input: AllocateWarehousePendingItemInput
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

export async function allocateWarehousePendingItem(
  workspaceId: string,
  input: AllocateWarehousePendingItemInput
): Promise<AllocateWarehousePendingItemResult> {
  const scope = currentScope(workspaceId);

  if (
    input.effectiveStatus === 'RECONCILIATION_REQUIRED'
    || input.effectiveStatus === 'PROCESSED'
  ) {
    throw new Error('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
  }

  const quantity = normalizeWarehouseLocationQuantity(input.quantity);
  if (quantity === null || quantity <= 0) {
    throw new Error('WAREHOUSE_INTAKE_ALLOCATION_INVALID_QUANTITY');
  }
  const receivedQuantity = normalizeWarehouseQuantity(input.receivedQuantity);
  if (receivedQuantity === null || receivedQuantity <= 0) {
    throw new Error('WAREHOUSE_INTAKE_ALLOCATION_INVALID_RECEIVED_QUANTITY');
  }
  if (quantity > receivedQuantity + QUANTITY_EPSILON) {
    throw new Error('WAREHOUSE_INTAKE_ALLOCATION_EXCEEDS_PENDING');
  }

  const position = validateWarehouseStockPosition(input.position);
  if (!position || position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_INTAKE_LOCATION_REQUIRED');
  }

  const lotCode = normalizeWarehouseLotCode(input.lotCode);
  if (!lotCode) throw new Error('WAREHOUSE_INTAKE_LOT_REQUIRED');

  const normalizedExpiry = normalizeWarehouseExpiryDate(input.expiresOn);
  if (normalizedExpiry === undefined) {
    throw new Error('WAREHOUSE_INTAKE_INVALID_EXPIRY');
  }

  const barcode = input.barcode ? normalizeWarehouseBarcode(input.barcode) : null;
  if (input.barcode && !barcode) {
    throw new Error('WAREHOUSE_INVALID_BARCODE');
  }
  const operationId = normalizeOperationId(input.operationId);
  const allocationFingerprint = (
    await stableHex([
      operationId,
      String(quantity),
      warehouseStockPositionKey(position),
      lotCode,
      normalizedExpiry || 'NO_EXPIRY',
      barcode || 'NO_BARCODE',
    ].join('\n'))
  ).slice(0, 20);

  const material = await ensureCanonicalMaterial(scope, input);
  const entryMovement = await ensureInvoiceEntry(scope, material, input);

  const from: WarehouseStockPosition = { kind: 'UNASSIGNED' };
  const transferIdempotencyKey = [
    'adm-intake-v2',
    input.intakeId,
    'allocation',
    operationId,
  ].join(':').slice(0, 240);
  const transferMovementId = await createWarehouseMovementId(
    scope.workspaceId,
    transferIdempotencyKey
  );
  const fromBalanceId = await createWarehouseLocationBalanceId(
    scope.workspaceId,
    material.id,
    from
  );
  const toBalanceId = await createWarehouseLocationBalanceId(
    scope.workspaceId,
    material.id,
    position
  );
  const lotId = await createIntakeLotId({
    workspaceId: scope.workspaceId,
    intakeId: input.intakeId,
    entryMovementId: entryMovement.id,
    lotCode,
    position,
  });
  const barcodeId = barcode
    ? await createWarehouseBarcodeId(scope.workspaceId, barcode)
    : null;

  const intakePath = warehouseDocumentPath(
    scope.workspaceId,
    'intakes',
    input.intakeId
  );
  const movementPath = warehouseDocumentPath(
    scope.workspaceId,
    'movements',
    transferMovementId
  );

  try {
    return await runTransaction(db, async (transaction) => {
      const intakeRef = doc(db, intakePath);
      const materialRef = doc(
        db,
        warehouseDocumentPath(scope.workspaceId, 'materials', material.id)
      );
      const balanceRef = doc(
        db,
        warehouseDocumentPath(scope.workspaceId, 'balances', material.id)
      );
      const entryMovementRef = doc(
        db,
        warehouseDocumentPath(scope.workspaceId, 'movements', entryMovement.id)
      );
      const transferMovementRef = doc(db, movementPath);
      const fromBalanceRef = doc(
        db,
        warehouseDocumentPath(
          scope.workspaceId,
          'locationBalances',
          fromBalanceId
        )
      );
      const toBalanceRef = doc(
        db,
        warehouseDocumentPath(
          scope.workspaceId,
          'locationBalances',
          toBalanceId
        )
      );
      const depotRef = doc(
        db,
        warehouseDocumentPath(scope.workspaceId, 'depots', position.depotId)
      );
      const locationRef = doc(
        db,
        warehouseDocumentPath(
          scope.workspaceId,
          'locations',
          position.locationId
        )
      );
      const subpositionRef = position.kind === 'SUBPOSITION'
        ? doc(
            db,
            warehouseDocumentPath(
              scope.workspaceId,
              'locations',
              position.subpositionId
            )
          )
        : null;
      const lotRef = doc(
        db,
        warehouseDocumentPath(scope.workspaceId, 'lots', lotId)
      );
      const barcodeRef = barcodeId
        ? doc(
            db,
            warehouseDocumentPath(scope.workspaceId, 'barcodes', barcodeId)
          )
        : null;

      const [
        intakeSnapshot,
        materialSnapshot,
        balanceSnapshot,
        entryMovementSnapshot,
        transferMovementSnapshot,
        fromBalanceSnapshot,
        toBalanceSnapshot,
        depotSnapshot,
        locationSnapshot,
        subpositionSnapshot,
        lotSnapshot,
        barcodeSnapshot,
      ] = await Promise.all([
        transaction.get(intakeRef),
        transaction.get(materialRef),
        transaction.get(balanceRef),
        transaction.get(entryMovementRef),
        transaction.get(transferMovementRef),
        transaction.get(fromBalanceRef),
        transaction.get(toBalanceRef),
        transaction.get(depotRef),
        transaction.get(locationRef),
        subpositionRef ? transaction.get(subpositionRef) : Promise.resolve(null),
        transaction.get(lotRef),
        barcodeRef ? transaction.get(barcodeRef) : Promise.resolve(null),
      ]);

      if (!materialSnapshot.exists()) {
        throw new Error('WAREHOUSE_MATERIAL_NOT_FOUND');
      }
      const currentMaterial = parseMaterial(
        scope.workspaceId,
        materialSnapshot.id,
        materialSnapshot.data() as Record<string, unknown>
      );
      if (
        currentMaterial.id !== material.id
        || currentMaterial.ug !== scope.ug
        || currentMaterial.status !== 'active'
      ) {
        throw new Error('WAREHOUSE_MATERIAL_INACTIVE');
      }

      if (!balanceSnapshot.exists()) {
        throw new Error('WAREHOUSE_BALANCE_NOT_FOUND');
      }
      const currentBalance = parseBalance(
        scope.workspaceId,
        material.id,
        balanceSnapshot.data() as Record<string, unknown>
      );

      if (!entryMovementSnapshot.exists()) {
        throw new Error('WAREHOUSE_INTAKE_ENTRY_MOVEMENT_MISSING');
      }
      const storedEntryMovement = parseMovement(
        scope.workspaceId,
        entryMovementSnapshot.id,
        entryMovementSnapshot.data() as Record<string, unknown>
      );
      if (
        storedEntryMovement.id !== entryMovement.id
        || storedEntryMovement.materialId !== material.id
        || storedEntryMovement.type !== 'INVOICE_ENTRY'
        || Math.abs(storedEntryMovement.quantityDelta - receivedQuantity) > QUANTITY_EPSILON
        || storedEntryMovement.source?.kind !== 'INVOICE'
        || storedEntryMovement.source.invoiceRecordKey !== input.invoiceRecordKey
        || !storedEntryMovement.source.itemIds.includes(input.itemId)
      ) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
      }

      if (!depotSnapshot.exists() || !locationSnapshot.exists()) {
        throw new Error('WAREHOUSE_POSITION_NOT_FOUND');
      }
      const depot = parseDepot(
        scope.workspaceId,
        depotSnapshot.id,
        depotSnapshot.data() as Record<string, unknown>
      );
      const location = parseLocation(
        scope.workspaceId,
        locationSnapshot.id,
        locationSnapshot.data() as Record<string, unknown>
      );
      const subposition = subpositionSnapshot && subpositionSnapshot.exists()
        ? parseLocation(
            scope.workspaceId,
            subpositionSnapshot.id,
            subpositionSnapshot.data() as Record<string, unknown>
          )
        : null;
      ensureActivePosition(scope, position, depot, location, subposition);

      if (!fromBalanceSnapshot.exists()) {
        throw new Error('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT');
      }
      const currentFrom = parseLocationBalance(
        scope.workspaceId,
        fromBalanceSnapshot.id,
        fromBalanceSnapshot.data() as Record<string, unknown>
      );
      const currentTo = toBalanceSnapshot.exists()
        ? parseLocationBalance(
            scope.workspaceId,
            toBalanceSnapshot.id,
            toBalanceSnapshot.data() as Record<string, unknown>
          )
        : null;

      const source = {
        kind: 'LOCATION_TRANSFER' as const,
        actorUid: scope.uid,
        quantity,
        from,
        to: position,
        fromBalanceId,
        toBalanceId,
      };
      const movementCandidate = validateWarehouseMovement(
        {
          schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
          id: transferMovementId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          materialId: material.id,
          type: 'TRANSFER',
          quantityDelta: 0,
          idempotencyKeyHash: transferMovementId.slice('mov_'.length),
          reversesMovementId: null,
          note: 'Alocação parcial intake v2 · ' + allocationFingerprint,
          source,
        },
        {
          expectedWorkspaceId: scope.workspaceId,
          expectedUg: scope.ug,
          expectedMaterialId: material.id,
        }
      );
      if (!movementCandidate.ok) {
        throw new Error('WAREHOUSE_INVALID_TRANSFER_MOVEMENT');
      }
      const transferMovement = movementCandidate.data;

      if (transferMovementSnapshot.exists()) {
        const existingMovement = parseMovement(
          scope.workspaceId,
          transferMovementSnapshot.id,
          transferMovementSnapshot.data() as Record<string, unknown>
        );
        if (!warehouseMovementMatchesReplay(existingMovement, transferMovement)) {
          throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        }
        if (!intakeSnapshot.exists()) {
          throw new Error('WAREHOUSE_ITEM_INTAKE_LEDGER_MISMATCH');
        }
        const replayedIntake = parseIntake(
          scope.workspaceId,
          intakeSnapshot.id,
          intakeSnapshot.data() as Record<string, unknown>
        );
        const replayedLot = lotSnapshot.exists()
          ? parseLot(
              scope.workspaceId,
              lotSnapshot.id,
              lotSnapshot.data() as Record<string, unknown>
            )
          : null;
        if (!replayedLot) {
          throw new Error('WAREHOUSE_ITEM_INTAKE_LOT_MISMATCH');
        }
        const replayedBarcode =
          barcodeSnapshot && barcodeSnapshot.exists()
            ? parseBarcode(
                scope.workspaceId,
                barcodeSnapshot.id,
                barcodeSnapshot.data() as Record<string, unknown>
              )
            : null;
        return {
          applied: false,
          intake: replayedIntake,
          entryMovementId: storedEntryMovement.id,
          transferMovementId: existingMovement.id,
          lot: replayedLot,
          barcode: replayedBarcode,
        };
      }

      const currentIntake = intakeSnapshot.exists()
        ? parseIntake(
            scope.workspaceId,
            intakeSnapshot.id,
            intakeSnapshot.data() as Record<string, unknown>
          )
        : null;

      if (
        currentIntake
        && (
          currentIntake.invoiceRecordKey !== input.invoiceRecordKey
          || currentIntake.invoiceId !== input.invoiceId
          || currentIntake.empenhoId !== input.empenhoId
          || currentIntake.itemId !== input.itemId
          || Math.abs(
            currentIntake.receivedQuantity - receivedQuantity
          ) > QUANTITY_EPSILON
          || (
            currentIntake.materialId
            && currentIntake.materialId !== material.id
          )
        )
      ) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
      }

      const currentAllocatedQuantity = currentIntake?.allocatedQuantity || 0;
      const currentImmediateConsumptionQuantity =
        currentIntake?.immediateConsumptionQuantity || 0;

      if (
        Math.abs(
          currentAllocatedQuantity - input.expectedAllocatedQuantity
        ) > QUANTITY_EPSILON
        || Math.abs(
          currentImmediateConsumptionQuantity
          - input.expectedImmediateConsumptionQuantity
        ) > QUANTITY_EPSILON
      ) {
        throw new Error('WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION');
      }

      const currentPendingQuantity =
        calculateWarehouseItemIntakePendingQuantity(
          receivedQuantity,
          currentAllocatedQuantity,
          currentImmediateConsumptionQuantity
        );
      if (
        currentPendingQuantity <= QUANTITY_EPSILON
        || quantity > currentPendingQuantity + QUANTITY_EPSILON
      ) {
        throw new Error('WAREHOUSE_INTAKE_ALLOCATION_EXCEEDS_PENDING');
      }
      if (currentFrom.quantity + QUANTITY_EPSILON < quantity) {
        throw new Error('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK');
      }

      const nextFrom = applyWarehouseLocationDelta(currentFrom, {
        id: fromBalanceId,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        materialId: material.id,
        position: from,
        quantityDelta: -quantity,
        movementId: transferMovementId,
      });
      const nextTo = applyWarehouseLocationDelta(currentTo, {
        id: toBalanceId,
        workspaceId: scope.workspaceId,
        ug: scope.ug,
        materialId: material.id,
        position,
        quantityDelta: quantity,
        movementId: transferMovementId,
      });
      const nextBalance = applyWarehouseMovementToBalance(
        transferMovement,
        currentBalance
      );

      let nextLot: WarehouseLot;
      if (lotSnapshot.exists()) {
        const currentLot = parseLot(
          scope.workspaceId,
          lotSnapshot.id,
          lotSnapshot.data() as Record<string, unknown>
        );
        if (
          currentLot.materialId !== material.id
          || currentLot.ug !== scope.ug
          || currentLot.status !== 'active'
          || currentLot.code !== lotCode
          || currentLot.expiresOn !== normalizedExpiry
          || !warehouseStockPositionsEqual(currentLot.position, position)
          || currentLot.origin.kind !== 'INVOICE'
          || currentLot.origin.movementId !== storedEntryMovement.id
          || currentLot.origin.invoiceRecordKey !== input.invoiceRecordKey
          || currentLot.origin.invoiceId !== input.invoiceId
        ) {
          throw new Error('WAREHOUSE_INTAKE_LOT_CONFLICT');
        }
        const nextLotQuantity = normalizeWarehouseLocationQuantity(
          currentLot.quantity + quantity
        );
        if (
          nextLotQuantity === null
          || nextLotQuantity > nextTo.quantity + QUANTITY_EPSILON
        ) {
          throw new Error('WAREHOUSE_INTAKE_LOT_QUANTITY_INVALID');
        }
        const parsedNextLot = validateWarehouseLot(
          {
            ...currentLot,
            quantity: nextLotQuantity,
            updatedBy: scope.uid,
          },
          {
            expectedWorkspaceId: scope.workspaceId,
            expectedUg: scope.ug,
            expectedMaterialId: material.id,
          }
        );
        if (!parsedNextLot.ok) {
          throw new Error('WAREHOUSE_INVALID_LOT_UPDATE');
        }
        nextLot = parsedNextLot.data;
      } else {
        const parsedNewLot = validateWarehouseLot(
          {
            schemaVersion: WAREHOUSE_LOT_SCHEMA_VERSION,
            id: lotId,
            workspaceId: scope.workspaceId,
            ug: scope.ug,
            materialId: material.id,
            code: lotCode,
            expiresOn: normalizedExpiry,
            quantity,
            position,
            origin: {
              kind: 'INVOICE',
              movementId: storedEntryMovement.id,
              invoiceRecordKey: input.invoiceRecordKey,
              invoiceId: input.invoiceId,
              supplier: input.supplier,
              supplierCnpj: null,
            },
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
        if (!parsedNewLot.ok) {
          throw new Error(
            'WAREHOUSE_INVALID_LOT: '
            + parsedNewLot.issues.map((issue) => issue.message).join('; ')
          );
        }
        nextLot = parsedNewLot.data;
      }

      let nextBarcode: WarehouseBarcodeAssociation | null = null;
      if (barcode && barcodeId) {
        if (barcodeSnapshot && barcodeSnapshot.exists()) {
          const existingBarcode = parseBarcode(
            scope.workspaceId,
            barcodeSnapshot.id,
            barcodeSnapshot.data() as Record<string, unknown>
          );
          if (existingBarcode.materialId !== material.id) {
            throw new Error('WAREHOUSE_BARCODE_MATERIAL_CONFLICT');
          }
          if (!barcodeAssociationMatchesMaterial(existingBarcode, material)) {
            throw new Error('WAREHOUSE_BARCODE_PRESENTATION_CONFLICT');
          }
          if (existingBarcode.status !== 'active') {
            throw new Error('WAREHOUSE_BARCODE_INACTIVE');
          }
          nextBarcode = existingBarcode;
        } else {
          const parsedBarcode = validateWarehouseBarcodeAssociation(
            {
              schemaVersion: WAREHOUSE_BARCODE_SCHEMA_VERSION,
              id: barcodeId,
              workspaceId: scope.workspaceId,
              ug: scope.ug,
              materialId: material.id,
              barcode,
              presentation: material.unit,
              factorToBaseUnit: 1,
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
          if (!parsedBarcode.ok) throw new Error('WAREHOUSE_INVALID_BARCODE');
          nextBarcode = parsedBarcode.data;
        }
      }

      const nextAllocatedQuantity = normalizeWarehouseQuantity(
        currentAllocatedQuantity + quantity
      );
      if (nextAllocatedQuantity === null) {
        throw new Error('WAREHOUSE_INTAKE_ALLOCATION_INVALID_QUANTITY');
      }
      const nextPendingQuantity =
        calculateWarehouseItemIntakePendingQuantity(
          receivedQuantity,
          nextAllocatedQuantity,
          currentImmediateConsumptionQuantity
        );

      const nowIso = new Date().toISOString();
      const intakeCandidate = validateWarehouseItemIntakeState(
        {
          schemaVersion: WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
          id: input.intakeId,
          workspaceId: scope.workspaceId,
          ug: scope.ug,
          invoiceRecordKey: input.invoiceRecordKey,
          invoiceId: input.invoiceId,
          empenhoId: input.empenhoId,
          itemId: input.itemId,
          materialId: material.id,
          description: currentIntake?.description || input.description,
          unitLabel: currentIntake?.unitLabel || input.unitLabel,
          supplier: currentIntake?.supplier || input.supplier,
          receivedQuantity,
          allocatedQuantity: nextAllocatedQuantity,
          immediateConsumptionQuantity: currentImmediateConsumptionQuantity,
          pendingQuantity: nextPendingQuantity,
          status: deriveWarehouseItemIntakeStatus(
            receivedQuantity,
            nextAllocatedQuantity,
            currentImmediateConsumptionQuantity
          ),
          createdAt: currentIntake?.createdAt || nowIso,
          updatedAt: nowIso,
          createdBy: currentIntake?.createdBy || scope.uid,
          updatedBy: scope.uid,
        },
        {
          expectedWorkspaceId: scope.workspaceId,
          expectedUg: scope.ug,
        }
      );
      if (!intakeCandidate.ok) {
        throw new Error(
          'WAREHOUSE_INVALID_ITEM_INTAKE_STATE: '
          + intakeCandidate.issues
            .map((issue) => issue.path + ': ' + issue.message)
            .join('; ')
        );
      }
      const nextIntake = intakeCandidate.data;

      transaction.set(transferMovementRef, {
        ...transferMovement,
        createdAt: serverTimestamp(),
      });
      transaction.set(balanceRef, {
        ...nextBalance,
        updatedAt: serverTimestamp(),
      });
      transaction.set(fromBalanceRef, {
        ...nextFrom,
        updatedAt: serverTimestamp(),
      });
      transaction.set(toBalanceRef, {
        ...nextTo,
        updatedAt: serverTimestamp(),
      });

      if (lotSnapshot.exists()) {
        transaction.update(lotRef, {
          quantity: nextLot.quantity,
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(lotRef, {
          ...nextLot,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (
        barcodeRef
        && nextBarcode
        && (!barcodeSnapshot || !barcodeSnapshot.exists())
      ) {
        transaction.set(barcodeRef, {
          ...nextBarcode,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (currentIntake) {
        transaction.update(intakeRef, {
          materialId: nextIntake.materialId,
          allocatedQuantity: nextIntake.allocatedQuantity,
          immediateConsumptionQuantity:
            nextIntake.immediateConsumptionQuantity,
          pendingQuantity: nextIntake.pendingQuantity,
          status: nextIntake.status,
          updatedBy: scope.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(intakeRef, {
          ...nextIntake,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return {
        applied: true,
        intake: nextIntake,
        entryMovementId: storedEntryMovement.id,
        transferMovementId: transferMovement.id,
        lot: nextLot,
        barcode: nextBarcode,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, movementPath);
    throw error;
  }
}
