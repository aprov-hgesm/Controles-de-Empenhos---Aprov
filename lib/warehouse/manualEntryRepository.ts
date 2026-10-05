'use client';

import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, warehouseDb as db } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import { saveWarehouseBarcodeAssociation } from './barcodeRepository';
import { warehouseUnitFromOperationalLabel } from './invoiceIntegration';
import {
  getWarehouseDepot,
  getWarehouseLocation,
  type TransferWarehouseStockResult,
} from './locationRepository';
import {
  applyWarehouseLocationDelta,
  createWarehouseLocationBalanceId,
  validateWarehouseLocationBalance,
  validateWarehouseStockPosition,
  warehouseStockPositionKey,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';
import type { ApplyWarehouseMovementResult } from './ledgerRepository';
import {
  applyWarehouseMovementToBalance,
  createWarehouseMovementId,
  validateWarehouseBalance,
  validateWarehouseMovement,
  warehouseMovementMatchesReplay,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance,
  type WarehouseMovement,
} from './movement';
import {
  createWarehousePendingLotCode,
  normalizeWarehouseExpiryDate,
  type WarehouseLot,
} from './lot';
import { createWarehouseLot, listWarehouseLots } from './lotRepository';
import {
  createWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import {
  getWarehouseMaterial,
  saveWarehouseMaterial,
} from './materialRepository';
import { warehouseDocumentPath } from './namespace';

export interface RegisterWarehouseManualEntryInput {
  operationId: string;
  existingMaterialId?: string | null;
  description: string;
  unitLabel: string;
  quantity: number;
  provenance: string;
  reference?: string | null;
  position: WarehouseStockPosition;
  expiresOn?: string | null;
  barcode?: string | null;
}

export interface RegisterWarehouseManualEntryResult {
  material: WarehouseMaterial;
  entry: ApplyWarehouseMovementResult;
  /**
   * Compatibilidade de retorno. Entradas novas já nascem localizadas e,
   * portanto, não executam TRANSFER após a entrada.
   */
  transfer: TransferWarehouseStockResult | null;
  locationBalance: WarehouseLocationBalance;
  validity: WarehouseLot | null;
  barcodeLinked: boolean;
  warnings: string[];
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function currentScope(workspaceId: string): {
  workspaceId: string;
  ug: string;
  uid: string;
} {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_MANUAL_ENTRY_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (scope.workspaceId !== normalizedWorkspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_SCOPE_MISMATCH');
  }
  return {
    workspaceId: normalizedWorkspaceId,
    ug: scope.ug,
    uid: user.uid,
  };
}

function normalizeOperationId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{8,96}$/.test(normalized)) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_INVALID_OPERATION_ID');
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

async function manualMaterialId(
  workspaceId: string,
  operationId: string
): Promise<string> {
  const digest = await stableHex(
    [workspaceId, 'MANUAL_ENTRY_MATERIAL', operationId].join('\n')
  );
  return 'mat_' + digest.slice(0, 32);
}

async function ensureMaterial(
  scope: { workspaceId: string; ug: string },
  input: RegisterWarehouseManualEntryInput,
  operationId: string
): Promise<WarehouseMaterial> {
  const existingId = input.existingMaterialId?.trim().toLowerCase() || '';
  if (existingId) {
    const existing = await getWarehouseMaterial(scope.workspaceId, existingId);
    if (!existing) throw new Error('WAREHOUSE_MANUAL_ENTRY_MATERIAL_NOT_FOUND');
    if (existing.status !== 'active' || existing.ug !== scope.ug) {
      throw new Error('WAREHOUSE_MANUAL_ENTRY_MATERIAL_INACTIVE');
    }
    return existing;
  }

  const description = normalizeText(input.description);
  const unitLabel = normalizeText(input.unitLabel);
  if (!description || description.length > 240) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_INVALID_DESCRIPTION');
  }
  if (!unitLabel || unitLabel.length > 80) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_INVALID_UNIT');
  }

  const id = await manualMaterialId(scope.workspaceId, operationId);
  const existing = await getWarehouseMaterial(scope.workspaceId, id);
  if (existing) {
    if (
      existing.status !== 'active'
      || existing.ug !== scope.ug
      || existing.description !== description
    ) {
      throw new Error('WAREHOUSE_MANUAL_ENTRY_MATERIAL_CONFLICT');
    }
    return existing;
  }

  const candidate = createWarehouseMaterial({
    id,
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    description,
    aliases: [],
    unit: warehouseUnitFromOperationalLabel(unitLabel),
    status: 'active',
    conversions: [],
  });
  if (!candidate.ok) {
    throw new Error(
      'WAREHOUSE_MANUAL_ENTRY_MATERIAL_INVALID: '
      + candidate.issues.map((issue) => issue.message).join('; ')
    );
  }

  await saveWarehouseMaterial(scope.workspaceId, candidate.data);
  const saved = await getWarehouseMaterial(scope.workspaceId, id);
  if (!saved) throw new Error('WAREHOUSE_MANUAL_ENTRY_MATERIAL_CREATE_FAILED');
  return saved;
}

function parseManualEntryMovement(
  workspaceId: string,
  movementId: string,
  data: Record<string, unknown>
): WarehouseMovement {
  const result = validateWarehouseMovement(
    {
      schemaVersion: data.schemaVersion,
      id: movementId,
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
  if (!result.ok) throw new Error('WAREHOUSE_MANUAL_ENTRY_MOVEMENT_INVALID');
  return result.data;
}

function parseManualEntryBalance(
  workspaceId: string,
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
    { expectedWorkspaceId: workspaceId, expectedMaterialId: materialId }
  );
  if (!result.ok) throw new Error('WAREHOUSE_MANUAL_ENTRY_BALANCE_INVALID');
  return result.data;
}

function parseManualEntryLocationBalance(
  workspaceId: string,
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
    { expectedWorkspaceId: workspaceId, expectedMaterialId: materialId }
  );
  if (!result.ok) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_LOCATION_BALANCE_INVALID');
  }
  return result.data;
}

async function assertManualEntryPositionActive(
  workspaceId: string,
  position: Exclude<WarehouseStockPosition, { kind: 'UNASSIGNED' }>
): Promise<void> {
  const [depotItem, locationItem] = await Promise.all([
    getWarehouseDepot(workspaceId, position.depotId),
    getWarehouseLocation(workspaceId, position.locationId),
  ]);
  const depot = depotItem?.depot || null;
  const location = locationItem?.location || null;
  if (
    !depot
    || depot.status !== 'active'
    || !location
    || location.status !== 'active'
    || location.kind !== 'LOCAL'
    || location.depotId !== depot.id
  ) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED');
  }

  if (position.kind === 'SUBPOSITION') {
    const subpositionItem = await getWarehouseLocation(
      workspaceId,
      position.subpositionId
    );
    const subposition = subpositionItem?.location || null;
    if (
      !subposition
      || subposition.status !== 'active'
      || subposition.kind !== 'SUBPOSITION'
      || subposition.depotId !== depot.id
      || subposition.parentLocationId !== location.id
    ) {
      throw new Error('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED');
    }
  }
}

async function applyWarehouseManualLocatedEntry(input: {
  scope: { workspaceId: string; ug: string; uid: string };
  material: WarehouseMaterial;
  position: Exclude<WarehouseStockPosition, { kind: 'UNASSIGNED' }>;
  quantity: number;
  operationId: string;
  provenance: string;
  reference: string | null;
}): Promise<{
  entry: ApplyWarehouseMovementResult;
  locationBalance: WarehouseLocationBalance;
}> {
  const positionKey = warehouseStockPositionKey(input.position);
  const positionToken = (await stableHex(positionKey)).slice(0, 16);
  const movementId = await createWarehouseMovementId(
    input.scope.workspaceId,
    ['manual-entry', input.operationId, 'ledger'].join(':')
  );
  const idempotencyKeyHash = movementId.slice('mov_'.length);
  const locationBalanceId = await createWarehouseLocationBalanceId(
    input.scope.workspaceId,
    input.material.id,
    input.position
  );

  const movementPath = warehouseDocumentPath(
    input.scope.workspaceId,
    'movements',
    movementId
  );
  const balancePath = warehouseDocumentPath(
    input.scope.workspaceId,
    'balances',
    input.material.id
  );
  const locationBalancePath = warehouseDocumentPath(
    input.scope.workspaceId,
    'locationBalances',
    locationBalanceId
  );

  const candidateResult = validateWarehouseMovement(
    {
      schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
      id: movementId,
      workspaceId: input.scope.workspaceId,
      ug: input.scope.ug,
      materialId: input.material.id,
      type: 'MANUAL_ENTRY',
      quantityDelta: input.quantity,
      idempotencyKeyHash,
      reversesMovementId: null,
      note: [
        'Entrada avulsa',
        input.provenance,
        'posição ' + positionToken,
      ].join(' · '),
      source: {
        kind: 'MANUAL_ENTRY',
        actorUid: input.scope.uid,
        provenance: input.provenance,
        reference: input.reference,
      },
    },
    {
      expectedWorkspaceId: input.scope.workspaceId,
      expectedUg: input.scope.ug,
      expectedMaterialId: input.material.id,
    }
  );
  if (!candidateResult.ok) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_MOVEMENT_INVALID');
  }
  const candidate = candidateResult.data;

  return runTransaction(db, async (transaction) => {
    const movementRef = doc(db, movementPath);
    const balanceRef = doc(db, balancePath);
    const locationBalanceRef = doc(db, locationBalancePath);
    const [movementSnapshot, balanceSnapshot, locationBalanceSnapshot] =
      await Promise.all([
        transaction.get(movementRef),
        transaction.get(balanceRef),
        transaction.get(locationBalanceRef),
      ]);

    const currentBalance = balanceSnapshot.exists()
      ? parseManualEntryBalance(
          input.scope.workspaceId,
          input.material.id,
          balanceSnapshot.data() as Record<string, unknown>
        )
      : null;
    const currentLocationBalance = locationBalanceSnapshot.exists()
      ? parseManualEntryLocationBalance(
          input.scope.workspaceId,
          input.material.id,
          locationBalanceId,
          locationBalanceSnapshot.data() as Record<string, unknown>
        )
      : null;

    if (movementSnapshot.exists()) {
      const existing = parseManualEntryMovement(
        input.scope.workspaceId,
        movementSnapshot.id,
        movementSnapshot.data() as Record<string, unknown>
      );
      if (!warehouseMovementMatchesReplay(existing, candidate)) {
        throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
      }
      if (!currentBalance || !currentLocationBalance) {
        throw new Error('WAREHOUSE_MANUAL_ENTRY_PROJECTION_INCONSISTENT');
      }
      return {
        entry: {
          applied: false,
          movement: existing,
          balance: currentBalance,
        },
        locationBalance: currentLocationBalance,
      };
    }

    if (currentLocationBalance) {
      const currentPositionKey = warehouseStockPositionKey(
        currentLocationBalance.position
      );
      if (currentPositionKey !== positionKey) {
        throw new Error('WAREHOUSE_MANUAL_ENTRY_POSITION_CONFLICT');
      }
    }

    const nextBalance = applyWarehouseMovementToBalance(
      candidate,
      currentBalance
    );
    const nextLocationBalance = applyWarehouseLocationDelta(
      currentLocationBalance,
      {
        id: locationBalanceId,
        workspaceId: input.scope.workspaceId,
        ug: input.scope.ug,
        materialId: input.material.id,
        position: input.position,
        quantityDelta: input.quantity,
        movementId,
      }
    );

    transaction.set(movementRef, {
      ...candidate,
      createdAt: serverTimestamp(),
    });
    transaction.set(balanceRef, {
      ...nextBalance,
      updatedAt: serverTimestamp(),
    });
    transaction.set(locationBalanceRef, {
      ...nextLocationBalance,
      updatedAt: serverTimestamp(),
    });

    return {
      entry: {
        applied: true,
        movement: candidate,
        balance: nextBalance,
      },
      locationBalance: nextLocationBalance,
    };
  });
}

export async function registerWarehouseManualEntry(
  workspaceId: string,
  input: RegisterWarehouseManualEntryInput
): Promise<RegisterWarehouseManualEntryResult> {
  const scope = currentScope(workspaceId);
  const operationId = normalizeOperationId(input.operationId);
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_INVALID_QUANTITY');
  }

  const provenance = normalizeText(input.provenance);
  const reference = normalizeText(input.reference || '') || null;
  if (!provenance || provenance.length > 180) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_PROVENANCE_REQUIRED');
  }
  if (reference && reference.length > 160) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_REFERENCE_INVALID');
  }

  const position = validateWarehouseStockPosition(input.position);
  if (!position || position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED');
  }
  await assertManualEntryPositionActive(scope.workspaceId, position);

  const normalizedExpiry = normalizeWarehouseExpiryDate(input.expiresOn ?? null);
  if (normalizedExpiry === undefined) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_INVALID_EXPIRY');
  }

  const material = await ensureMaterial(scope, input, operationId);

  const locatedEntry = await applyWarehouseManualLocatedEntry({
    scope,
    material,
    position,
    quantity,
    operationId,
    provenance,
    reference,
  });
  const entry = locatedEntry.entry;
  const transfer = null;

  const warnings: string[] = [];
  let validity: WarehouseLot | null = null;

  if (normalizedExpiry) {
    const technicalCode = createWarehousePendingLotCode(
      'manual-' + operationId
    );
    try {
      const currentLots = await listWarehouseLots(scope.workspaceId, 500, material.id);
      const current = currentLots.find(
        (item) =>
          item.lot.status === 'active'
          && item.lot.code === technicalCode
          && warehouseStockPositionKey(item.lot.position) === warehouseStockPositionKey(position)
      )?.lot || null;

      validity = current || await createWarehouseLot(scope.workspaceId, {
        materialId: material.id,
        code: technicalCode,
        expiresOn: normalizedExpiry,
        quantity,
        position,
        origin: {
          kind: 'MANUAL_ENRICHMENT',
          movementId: entry.movement.id,
          invoiceRecordKey: null,
          invoiceId: null,
          supplier: null,
          supplierCnpj: null,
        },
      });
    } catch {
      warnings.push('A entrada foi registrada, mas a validade precisa ser revisada no Controle de Itens.');
    }
  }

  let barcodeLinked = false;
  const barcode = normalizeText(input.barcode || '');
  if (barcode) {
    try {
      await saveWarehouseBarcodeAssociation(scope.workspaceId, {
        barcode,
        materialId: material.id,
        presentation: material.unit,
      });
      barcodeLinked = true;
    } catch {
      warnings.push('A entrada foi registrada, mas o código de barras não pôde ser vinculado.');
    }
  }

  return {
    material,
    entry,
    transfer,
    locationBalance: locatedEntry.locationBalance,
    validity,
    barcodeLinked,
    warnings,
  };
}
