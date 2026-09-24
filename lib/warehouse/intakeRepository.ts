import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { normalizeSupplierCnpj } from '../invoiceIdentity';
import { getCurrentOperationalScope } from '../operationalPaths';
import type { Empenho, Invoice } from '../types';
import { saveWarehouseBarcodeAssociation } from './barcodeRepository';
import {
  createWarehouseMaterialFromEmpenhoItem,
  deriveWarehouseMaterialIdForEmpenhoItem,
} from './invoiceIntegration';
import {
  createWarehouseItemIntakeId,
  validateWarehouseItemIntake,
  type WarehouseItemIntake,
  type WarehouseItemIntakeListItem,
} from './intake';
import {
  warehouseStockPositionsEqual,
  type WarehouseStockPosition,
} from './location';
import {
  transferWarehouseStock,
} from './locationRepository';
import {
  applyWarehouseMovement,
} from './ledgerRepository';
import {
  createWarehouseLot,
  listWarehouseLots,
} from './lotRepository';
import {
  getWarehouseMaterial,
  saveWarehouseMaterial,
} from './materialRepository';
import { warehouseDocumentPath, warehouseDomainPath } from './namespace';

export interface AllocateWarehouseInvoiceItemInput {
  invoice: Invoice;
  empenho: Empenho;
  itemId: string;
  position: WarehouseStockPosition;
  lotCode: string;
  expiresOn?: string | null;
  barcode?: string | null;
}

export interface RegisterImmediateConsumptionInput {
  invoice: Invoice;
  empenho: Empenho;
  itemId: string;
  barcode?: string | null;
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

function currentScope(workspaceId: string): {
  workspaceId: string;
  ug: string;
  uid: string;
} {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_INTAKE_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_INTAKE_SCOPE_MISMATCH');
  }
  return {
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    uid: user.uid,
  };
}

function parseIntake(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseItemIntake {
  const result = validateWarehouseItemIntake(
    { ...data, id },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_ITEM_INTAKE: ' +
      result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return result.data;
}

async function ensureMaterial(
  workspaceId: string,
  ug: string,
  empenho: Empenho,
  itemId: string
) {
  const item = empenho.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('WAREHOUSE_INTAKE_ITEM_NOT_FOUND');

  const materialId =
    item.warehouseMaterialId?.trim().toLowerCase()
    || await deriveWarehouseMaterialIdForEmpenhoItem(workspaceId, empenho.id, item.id);

  let material = await getWarehouseMaterial(workspaceId, materialId);
  if (!material) {
    const candidate = createWarehouseMaterialFromEmpenhoItem({
      workspaceId,
      ug,
      materialId,
      item,
    });
    await saveWarehouseMaterial(workspaceId, candidate);
    material = await getWarehouseMaterial(workspaceId, materialId);
  }

  if (!material) throw new Error('WAREHOUSE_INTAKE_MATERIAL_CREATE_FAILED');
  if (material.status !== 'active' || material.ug !== ug) {
    throw new Error('WAREHOUSE_INTAKE_MATERIAL_INACTIVE');
  }
  return { material, item };
}

function findInvoiceItem(invoice: Invoice, itemId: string) {
  const invoiceItem = invoice.items.find((candidate) => candidate.itemId === itemId);
  if (!invoiceItem || !(invoiceItem.quantity > 0)) {
    throw new Error('WAREHOUSE_INTAKE_INVOICE_ITEM_NOT_FOUND');
  }
  return invoiceItem;
}

function invoiceRecordKey(invoice: Invoice): string {
  return (invoice.recordKey || invoice.id || '').trim();
}

async function existingIntakeFor(
  workspaceId: string,
  invoice: Invoice,
  itemId: string
): Promise<WarehouseItemIntake | null> {
  const id = await createWarehouseItemIntakeId(
    workspaceId,
    invoiceRecordKey(invoice),
    itemId
  );
  const path = warehouseDocumentPath(workspaceId, 'intakes', id);
  const snapshot = await getDoc(doc(db, path));
  if (!snapshot.exists()) return null;
  return parseIntake(
    workspaceId,
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );
}

async function persistCompletedIntake(
  intake: WarehouseItemIntake
): Promise<WarehouseItemIntake> {
  const path = warehouseDocumentPath(intake.workspaceId, 'intakes', intake.id);
  const reference = doc(db, path);
  try {
    const existing = await getDoc(reference);
    if (existing.exists()) {
      const parsed = parseIntake(
        intake.workspaceId,
        existing.id,
        existing.data() as Record<string, unknown>
      );
      if (
        parsed.invoiceRecordKey !== intake.invoiceRecordKey
        || parsed.itemId !== intake.itemId
        || parsed.mode !== intake.mode
      ) {
        throw new Error('WAREHOUSE_INTAKE_IDEMPOTENCY_CONFLICT');
      }
      return parsed;
    }

    await setDoc(reference, {
      ...intake,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return intake;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function getWarehouseInvoiceIntakeCutoff(
  workspaceId: string
): Promise<string | null> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(scope.workspaceId, 'settings', 'invoice-integration');
  try {
    const snapshot = await getDoc(doc(db, path));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as Record<string, unknown>;
    const cutoffAt = typeof data.cutoffAt === 'string' ? data.cutoffAt : null;
    return cutoffAt && Number.isFinite(Date.parse(cutoffAt)) ? cutoffAt : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function listWarehouseItemIntakes(
  workspaceId: string,
  maxResults = 500
): Promise<WarehouseItemIntakeListItem[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'intakes');
  try {
    const snapshot = await getDocs(
      query(collection(db, path), limit(Math.max(1, Math.min(maxResults, 500))))
    );
    return snapshot.docs
      .map((entry) => {
        const data = entry.data() as Record<string, unknown>;
        return {
          intake: parseIntake(scope.workspaceId, entry.id, data),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .sort((left, right) =>
        (right.createdAt || '').localeCompare(left.createdAt || '')
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export async function allocateWarehouseInvoiceItem(
  workspaceId: string,
  input: AllocateWarehouseInvoiceItemInput
): Promise<WarehouseItemIntake> {
  const scope = currentScope(workspaceId);
  const recordKey = invoiceRecordKey(input.invoice);
  if (!recordKey) throw new Error('WAREHOUSE_INTAKE_INVOICE_IDENTITY_REQUIRED');
  if (input.invoice.empenhoId !== input.empenho.id) {
    throw new Error('WAREHOUSE_INTAKE_EMPENHO_MISMATCH');
  }
  if (input.position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_INTAKE_LOCATION_REQUIRED');
  }
  const lotCode = input.lotCode.trim();
  if (!lotCode) throw new Error('WAREHOUSE_INTAKE_LOT_REQUIRED');

  const existing = await existingIntakeFor(workspaceId, input.invoice, input.itemId);
  if (existing) {
    if (existing.mode !== 'ALLOCATED') throw new Error('WAREHOUSE_INTAKE_ALREADY_DECIDED');
    return existing;
  }

  const invoiceItem = findInvoiceItem(input.invoice, input.itemId);
  const { material, item } = await ensureMaterial(
    scope.workspaceId,
    scope.ug,
    input.empenho,
    input.itemId
  );

  const source = {
    kind: 'INVOICE' as const,
    action: 'ENTRY' as const,
    invoiceRecordKey: recordKey,
    invoiceId: input.invoice.id,
    empenhoId: input.invoice.empenhoId,
    itemIds: [input.itemId],
    supplier: input.invoice.supplier || input.empenho.supplier,
    supplierCnpj: normalizeSupplierCnpj(
      input.invoice.supplierCnpj || input.empenho.supplierCnpj
    ) || null,
    actorUid: scope.uid,
  };

  const entry = await applyWarehouseMovement(scope.workspaceId, {
    materialId: material.id,
    type: 'INVOICE_ENTRY',
    quantityDelta: invoiceItem.quantity,
    idempotencyKey: [
      'adm-intake',
      recordKey,
      input.itemId,
      'entry',
    ].join(':').slice(0, 240),
    note: 'Entrada confirmada no Cadastro de Itens do ADM Depósito',
    source,
  });

  const transfer = await transferWarehouseStock(scope.workspaceId, {
    materialId: material.id,
    quantity: invoiceItem.quantity,
    from: { kind: 'UNASSIGNED' },
    to: input.position,
    idempotencyKey: [
      'adm-intake',
      recordKey,
      input.itemId,
      'location',
      input.position.kind,
      input.position.depotId,
      input.position.locationId,
      input.position.kind === 'SUBPOSITION' ? input.position.subpositionId : '',
    ].join(':').slice(0, 240),
    note: 'Alocação inicial do item recebido por NF',
  });

  const existingLots = await listWarehouseLots(scope.workspaceId, 500, material.id);
  let lot = existingLots.find(({ lot: candidate }) =>
    candidate.status === 'active'
    && candidate.code === lotCode
    && candidate.origin.kind === 'INVOICE'
    && candidate.origin.movementId === entry.movement.id
    && warehouseStockPositionsEqual(candidate.position, input.position)
  )?.lot || null;

  if (!lot) {
    lot = await createWarehouseLot(scope.workspaceId, {
      materialId: material.id,
      code: lotCode,
      expiresOn: input.expiresOn?.trim() || null,
      quantity: invoiceItem.quantity,
      position: input.position,
      origin: {
        kind: 'INVOICE',
        movementId: entry.movement.id,
        invoiceRecordKey: recordKey,
        invoiceId: input.invoice.id,
        supplier: input.invoice.supplier || input.empenho.supplier,
        supplierCnpj: normalizeSupplierCnpj(
          input.invoice.supplierCnpj || input.empenho.supplierCnpj
        ) || null,
      },
    });
  }

  const barcode = input.barcode?.trim() || null;
  if (barcode) {
    await saveWarehouseBarcodeAssociation(scope.workspaceId, {
      barcode,
      materialId: material.id,
      presentation: material.unit,
    });
  }

  const id = await createWarehouseItemIntakeId(
    scope.workspaceId,
    recordKey,
    input.itemId
  );
  const candidate = validateWarehouseItemIntake(
    {
      schemaVersion: 'warehouse_item_intake_v1',
      id,
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      invoiceRecordKey: recordKey,
      invoiceId: input.invoice.id,
      empenhoId: input.invoice.empenhoId,
      itemId: input.itemId,
      materialId: material.id,
      description: item.name,
      unitLabel: item.unit || material.unit.label || material.unit.code,
      quantity: invoiceItem.quantity,
      mode: 'ALLOCATED',
      position: input.position,
      lotId: lot.id,
      lotCode: lot.code,
      expiresOn: lot.expiresOn,
      barcode,
      entryMovementId: entry.movement.id,
      transferMovementId: transfer.movement.id,
      siscofisStatus: 'NOT_APPLICABLE',
      createdBy: scope.uid,
      updatedBy: scope.uid,
    },
    { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug }
  );
  if (!candidate.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_ITEM_INTAKE: ' +
      candidate.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return persistCompletedIntake(candidate.data);
}

export async function registerWarehouseImmediateConsumption(
  workspaceId: string,
  input: RegisterImmediateConsumptionInput
): Promise<WarehouseItemIntake> {
  const scope = currentScope(workspaceId);
  const recordKey = invoiceRecordKey(input.invoice);
  if (!recordKey) throw new Error('WAREHOUSE_INTAKE_INVOICE_IDENTITY_REQUIRED');
  if (input.invoice.empenhoId !== input.empenho.id) {
    throw new Error('WAREHOUSE_INTAKE_EMPENHO_MISMATCH');
  }

  const existing = await existingIntakeFor(workspaceId, input.invoice, input.itemId);
  if (existing) {
    if (existing.mode !== 'IMMEDIATE_CONSUMPTION') {
      throw new Error('WAREHOUSE_INTAKE_ALREADY_DECIDED');
    }
    return existing;
  }

  const invoiceItem = findInvoiceItem(input.invoice, input.itemId);
  const { material, item } = await ensureMaterial(
    scope.workspaceId,
    scope.ug,
    input.empenho,
    input.itemId
  );

  const barcode = input.barcode?.trim() || null;
  if (barcode) {
    await saveWarehouseBarcodeAssociation(scope.workspaceId, {
      barcode,
      materialId: material.id,
      presentation: material.unit,
    });
  }

  const id = await createWarehouseItemIntakeId(
    scope.workspaceId,
    recordKey,
    input.itemId
  );
  const candidate = validateWarehouseItemIntake(
    {
      schemaVersion: 'warehouse_item_intake_v1',
      id,
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      invoiceRecordKey: recordKey,
      invoiceId: input.invoice.id,
      empenhoId: input.invoice.empenhoId,
      itemId: input.itemId,
      materialId: material.id,
      description: item.name,
      unitLabel: item.unit || material.unit.label || material.unit.code,
      quantity: invoiceItem.quantity,
      mode: 'IMMEDIATE_CONSUMPTION',
      position: null,
      lotId: null,
      lotCode: null,
      expiresOn: null,
      barcode,
      entryMovementId: null,
      transferMovementId: null,
      siscofisStatus: 'PENDING',
      createdBy: scope.uid,
      updatedBy: scope.uid,
    },
    { expectedWorkspaceId: scope.workspaceId, expectedUg: scope.ug }
  );
  if (!candidate.ok) {
    throw new Error('WAREHOUSE_INVALID_ITEM_INTAKE');
  }
  return persistCompletedIntake(candidate.data);
}

export async function markWarehouseImmediateConsumptionPosted(
  workspaceId: string,
  intakeId: string
): Promise<void> {
  const scope = currentScope(workspaceId);
  const path = warehouseDocumentPath(scope.workspaceId, 'intakes', intakeId);
  const reference = doc(db, path);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) throw new Error('WAREHOUSE_INTAKE_NOT_FOUND');
  const current = parseIntake(
    scope.workspaceId,
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );
  if (current.mode !== 'IMMEDIATE_CONSUMPTION') {
    throw new Error('WAREHOUSE_INTAKE_NOT_IMMEDIATE');
  }
  if (current.siscofisStatus === 'POSTED') return;
  await updateDoc(reference, {
    siscofisStatus: 'POSTED',
    updatedBy: scope.uid,
    updatedAt: serverTimestamp(),
  });
}
