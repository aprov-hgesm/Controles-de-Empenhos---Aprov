import {
  doc,
  serverTimestamp,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase/firestore';

import { db } from '../firebase';
import type { OperationalDataScope } from '../operationalPaths';
import type { Empenho, Invoice, InvoiceItem, Item } from '../types';
import {
  createWarehouseMovementId,
  applyWarehouseMovementToBalance,
  validateWarehouseBalance,
  validateWarehouseMovement,
  warehouseMovementMatchesReplay,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance,
  type WarehouseMovement,
  type WarehouseMovementSource,
} from './movement';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from './material';
import { warehouseDocumentPath } from './namespace';
import {
  WAREHOUSE_INVOICE_LINK_SCHEMA_VERSION,
  WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION,
  attachWarehouseMaterialMappings,
  attachWarehouseMaterialMappingsToEmpenho,
  buildWarehouseInvoiceIdempotencyKey,
  buildWarehouseInvoiceMovementPlans,
  createWarehouseMaterialFromEmpenhoItem,
  deriveWarehouseMaterialIdForEmpenhoItem,
  isInvoiceOnOrAfterWarehouseCutoff,
  isWarehouseIntegratedInvoice,
  type WarehouseInvoiceIntegrationSettings,
  type WarehouseInvoiceMovementPlan,
} from './invoiceIntegration';

const INVOICE_INTEGRATION_SETTINGS_ID = 'invoice-integration';

export interface WarehouseInvoiceReceiptTransactionInput {
  enabled: boolean;
  scope: OperationalDataScope;
  userId: string;
  invoice: Invoice;
  previousInvoice: Invoice | null;
  previousInvoiceRecordKey?: string | null;
  targetEmpenho: Empenho;
  storedTargetEmpenho: Empenho;
  invoiceRecordKey: string;
}

export interface WarehouseInvoiceReceiptTransactionResult {
  invoice: Invoice;
  targetEmpenho: Empenho;
  movementIds: string[];
  integrated: boolean;
}

export interface WarehouseInvoiceDeletionTransactionInput {
  enabled: boolean;
  scope: OperationalDataScope;
  userId: string;
  invoice: Invoice;
  invoiceRecordKey: string;
}

function parseSettings(
  snapshot: DocumentSnapshot,
  workspaceId: string,
  ug: string
): WarehouseInvoiceIntegrationSettings | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  if (
    data.schemaVersion !== WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION
    || data.workspaceId !== workspaceId
    || data.ug !== ug
    || typeof data.cutoffAt !== 'string'
    || !Number.isFinite(Date.parse(data.cutoffAt))
    || typeof data.activatedBy !== 'string'
    || !data.activatedBy.trim()
  ) {
    throw new Error('WAREHOUSE_INVOICE_SETTINGS_INVALID');
  }
  return data as unknown as WarehouseInvoiceIntegrationSettings;
}

function parseMaterial(
  workspaceId: string,
  materialId: string,
  snapshot: DocumentSnapshot
): WarehouseMaterial | null {
  if (!snapshot.exists()) return null;
  const result = validateWarehouseMaterial(
    { ...snapshot.data(), id: materialId },
    { expectedWorkspaceId: workspaceId }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_MATERIAL: '
      + result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return result.data;
}

function parseBalance(
  workspaceId: string,
  materialId: string,
  snapshot: DocumentSnapshot
): WarehouseBalance | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const result = validateWarehouseBalance(
    {
      schemaVersion: data.schemaVersion,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId,
      quantity: data.quantity,
      revision: data.revision,
      lastMovementId: data.lastMovementId,
    },
    { expectedWorkspaceId: workspaceId, expectedMaterialId: materialId }
  );
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_BALANCE: '
      + result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return result.data;
}

function parseMovement(
  workspaceId: string,
  movementId: string,
  snapshot: DocumentSnapshot
): WarehouseMovement | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
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
  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_INVALID_MOVEMENT: '
      + result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }
  return result.data;
}

function ensureInvoiceMappingsAreComplete(invoice: Invoice): void {
  for (const item of invoice.items) {
    if (item.quantity > 0 && !item.warehouseMaterialId) {
      throw new Error('WAREHOUSE_INVOICE_MATERIAL_MAPPING_MISSING');
    }
  }
}

function findOperationalItem(empenho: Empenho, itemId: string): Item {
  const item = empenho.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('WAREHOUSE_INVOICE_EMPENHO_ITEM_NOT_FOUND');
  return item;
}

async function resolveMaterialMappings(input: {
  scope: OperationalDataScope;
  invoice: Invoice;
  storedTargetEmpenho: Empenho;
}): Promise<{
  invoice: Invoice;
  targetMaterialByItemId: Map<string, string>;
  newlyDerivedMaterialIds: Set<string>;
}> {
  const materialByItemId = new Map<string, string>();
  const newlyDerivedMaterialIds = new Set<string>();

  for (const invoiceItem of input.invoice.items) {
    const sourceItem = findOperationalItem(input.storedTargetEmpenho, invoiceItem.itemId);
    let materialId = sourceItem.warehouseMaterialId?.trim().toLowerCase();

    if (!materialId) {
      materialId = await deriveWarehouseMaterialIdForEmpenhoItem(
        input.scope.workspaceId,
        input.storedTargetEmpenho.id,
        sourceItem.id
      );
      newlyDerivedMaterialIds.add(materialId);
    }

    materialByItemId.set(invoiceItem.itemId, materialId);
  }

  return {
    invoice: attachWarehouseMaterialMappings(input.invoice, materialByItemId),
    targetMaterialByItemId: materialByItemId,
    newlyDerivedMaterialIds,
  };
}

function buildMovementSource(input: {
  plan: WarehouseInvoiceMovementPlan;
  invoice: Invoice;
  invoiceRecordKey: string;
  userId: string;
}): WarehouseMovementSource {
  return {
    kind: 'INVOICE',
    action: input.plan.action,
    invoiceRecordKey: input.invoiceRecordKey,
    invoiceId: input.invoice.id,
    empenhoId: input.invoice.empenhoId,
    itemIds: input.plan.itemIds,
    supplier: input.invoice.supplier,
    supplierCnpj: input.invoice.supplierCnpj || null,
    actorUid: input.userId,
  };
}

function attachMovementHistory(
  nextInvoice: Invoice,
  previousInvoice: Invoice | null,
  movementIdByMaterial: Map<string, string>
): Invoice {
  const priorItems = previousInvoice?.items || [];

  const items: InvoiceItem[] = nextInvoice.items.map((item) => {
    const materialId = item.warehouseMaterialId;
    const prior = priorItems.find(
      (candidate) =>
        candidate.itemId === item.itemId
        && candidate.warehouseMaterialId === materialId
    );
    const movementId = materialId ? movementIdByMaterial.get(materialId) : undefined;
    const history = [
      ...(prior?.warehouseMovementIds || []),
      ...(movementId ? [movementId] : []),
    ].filter((value, index, all) => all.indexOf(value) === index).slice(-25);

    return {
      ...item,
      ...(history.length ? { warehouseMovementIds: history } : {}),
    };
  });

  return { ...nextInvoice, items };
}

async function applyPlansInTransaction(input: {
  transaction: Transaction;
  scope: OperationalDataScope;
  userId: string;
  invoice: Invoice;
  previousInvoice: Invoice | null;
  invoiceRecordKey: string;
  previousInvoiceRecordKey?: string | null;
  integrationRevision: number;
  plans: WarehouseInvoiceMovementPlan[];
  materialSourceById: Map<string, Item>;
  newlyDerivedMaterialIds: Set<string>;
}): Promise<Map<string, string>> {
  if (!input.scope.ug) throw new Error('WAREHOUSE_INVOICE_UG_REQUIRED');
  if (!input.plans.length) return new Map();

  const movementEntries = await Promise.all(
    input.plans.map(async (plan) => {
      const idempotencyKey = buildWarehouseInvoiceIdempotencyKey({
        invoiceRecordKey: input.invoiceRecordKey,
        integrationRevision: input.integrationRevision,
        plan,
      });
      const movementId = await createWarehouseMovementId(
        input.scope.workspaceId,
        idempotencyKey
      );
      return { plan, movementId };
    })
  );

  const refs = movementEntries.map(({ plan, movementId }) => ({
    plan,
    movementId,
    materialRef: doc(
      db,
      warehouseDocumentPath(input.scope.workspaceId, 'materials', plan.materialId)
    ),
    movementRef: doc(
      db,
      warehouseDocumentPath(input.scope.workspaceId, 'movements', movementId)
    ),
    balanceRef: doc(
      db,
      warehouseDocumentPath(input.scope.workspaceId, 'balances', plan.materialId)
    ),
  }));

  const [materialSnapshots, movementSnapshots, balanceSnapshots] = await Promise.all([
    Promise.all(refs.map((entry) => input.transaction.get(entry.materialRef))),
    Promise.all(refs.map((entry) => input.transaction.get(entry.movementRef))),
    Promise.all(refs.map((entry) => input.transaction.get(entry.balanceRef))),
  ]);

  const movementIdByMaterial = new Map<string, string>();

  for (let index = 0; index < refs.length; index += 1) {
    const entry = refs[index];
    const sourceItem = input.materialSourceById.get(entry.plan.materialId);
    let material = parseMaterial(
      input.scope.workspaceId,
      entry.plan.materialId,
      materialSnapshots[index]
    );

    if (!material) {
      if (!input.newlyDerivedMaterialIds.has(entry.plan.materialId) || !sourceItem) {
        throw new Error('WAREHOUSE_MATERIAL_NOT_FOUND');
      }
      material = createWarehouseMaterialFromEmpenhoItem({
        workspaceId: input.scope.workspaceId,
        ug: input.scope.ug,
        materialId: entry.plan.materialId,
        item: sourceItem,
      });
    }

    if (material.ug !== input.scope.ug) throw new Error('WAREHOUSE_MATERIAL_UG_MISMATCH');
    if (material.status !== 'active') throw new Error('WAREHOUSE_MATERIAL_INACTIVE');

    const sourceInvoice =
      entry.plan.action === 'DELETE' && input.previousInvoice
        ? input.previousInvoice
        : input.invoice;
    const sourceRecordKey =
      entry.plan.action === 'DELETE' && input.previousInvoiceRecordKey
        ? input.previousInvoiceRecordKey
        : input.invoiceRecordKey;
    const source = buildMovementSource({
      plan: entry.plan,
      invoice: sourceInvoice,
      invoiceRecordKey: sourceRecordKey,
      userId: input.userId,
    });
    const candidateResult = validateWarehouseMovement(
      {
        schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
        id: entry.movementId,
        workspaceId: input.scope.workspaceId,
        ug: input.scope.ug,
        materialId: entry.plan.materialId,
        type: entry.plan.movementType,
        quantityDelta: entry.plan.quantityDelta,
        idempotencyKeyHash: entry.movementId.slice('mov_'.length),
        reversesMovementId: null,
        note: 'NF ' + input.invoice.id + ' · Empenho ' + input.invoice.empenhoId,
        source,
      },
      {
        expectedWorkspaceId: input.scope.workspaceId,
        expectedUg: input.scope.ug,
        expectedMaterialId: entry.plan.materialId,
      }
    );

    if (!candidateResult.ok) {
      throw new Error(
        'WAREHOUSE_INVALID_MOVEMENT: '
        + candidateResult.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
      );
    }

    const candidate = candidateResult.data;
    const existingMovement = parseMovement(
      input.scope.workspaceId,
      entry.movementId,
      movementSnapshots[index]
    );
    const currentBalance = parseBalance(
      input.scope.workspaceId,
      entry.plan.materialId,
      balanceSnapshots[index]
    );

    if (existingMovement) {
      if (!warehouseMovementMatchesReplay(existingMovement, candidate)) {
        throw new Error('WAREHOUSE_IDEMPOTENCY_CONFLICT');
      }
      if (!currentBalance) throw new Error('WAREHOUSE_LEDGER_BALANCE_INCONSISTENT');
      movementIdByMaterial.set(entry.plan.materialId, existingMovement.id);
      continue;
    }

    const nextBalance = applyWarehouseMovementToBalance(candidate, currentBalance);

    if (!materialSnapshots[index].exists()) {
      input.transaction.set(entry.materialRef, material);
    }
    input.transaction.set(entry.movementRef, {
      ...candidate,
      createdAt: serverTimestamp(),
    });
    input.transaction.set(entry.balanceRef, {
      ...nextBalance,
      updatedAt: serverTimestamp(),
    });
    movementIdByMaterial.set(entry.plan.materialId, candidate.id);
  }

  return movementIdByMaterial;
}

export async function integrateInvoiceReceiptInTransaction(
  transaction: Transaction,
  input: WarehouseInvoiceReceiptTransactionInput
): Promise<WarehouseInvoiceReceiptTransactionResult> {
  if (!input.enabled || !input.scope.ug) {
    return {
      invoice: input.invoice,
      targetEmpenho: input.targetEmpenho,
      movementIds: [],
      integrated: false,
    };
  }

  const settingsRef = doc(
    db,
    warehouseDocumentPath(
      input.scope.workspaceId,
      'settings',
      INVOICE_INTEGRATION_SETTINGS_ID
    )
  );
  const settingsSnapshot = await transaction.get(settingsRef);
  let settings = parseSettings(settingsSnapshot, input.scope.workspaceId, input.scope.ug);
  let shouldCreateSettings = false;

  if (!settings) {
    if (isWarehouseIntegratedInvoice(input.previousInvoice)) {
      throw new Error('WAREHOUSE_INVOICE_SETTINGS_MISSING');
    }
    if (input.previousInvoice) {
      return {
        invoice: input.invoice,
        targetEmpenho: input.targetEmpenho,
        movementIds: [],
        integrated: false,
      };
    }
    const cutoffAt = input.invoice.registeredAt || new Date().toISOString();
    settings = {
      schemaVersion: WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION,
      workspaceId: input.scope.workspaceId,
      ug: input.scope.ug,
      cutoffAt,
      activatedBy: input.userId,
    };
    shouldCreateSettings = true;
  }

  const eligible =
    isWarehouseIntegratedInvoice(input.previousInvoice)
    || isInvoiceOnOrAfterWarehouseCutoff(input.invoice.registeredAt, settings.cutoffAt);

  if (!eligible) {
    return {
      invoice: input.invoice,
      targetEmpenho: input.targetEmpenho,
      movementIds: [],
      integrated: false,
    };
  }

  if (input.previousInvoice && isWarehouseIntegratedInvoice(input.previousInvoice)) {
    ensureInvoiceMappingsAreComplete(input.previousInvoice);
    if (input.previousInvoice.warehouseIntegration?.workspaceId !== input.scope.workspaceId) {
      throw new Error('WAREHOUSE_INVOICE_WORKSPACE_MISMATCH');
    }
  }

  const mapped = await resolveMaterialMappings({
    scope: input.scope,
    invoice: input.invoice,
    storedTargetEmpenho: input.storedTargetEmpenho,
  });
  ensureInvoiceMappingsAreComplete(mapped.invoice);

  const mappedTargetEmpenho = attachWarehouseMaterialMappingsToEmpenho(
    input.targetEmpenho,
    mapped.targetMaterialByItemId
  );
  const materialSourceById = new Map<string, Item>();
  for (const invoiceItem of mapped.invoice.items) {
    const materialId = invoiceItem.warehouseMaterialId!;
    materialSourceById.set(
      materialId,
      findOperationalItem(input.storedTargetEmpenho, invoiceItem.itemId)
    );
  }

  const integrationRevision =
    (input.previousInvoice?.warehouseIntegration?.revision || 0) + 1;
  const plans = buildWarehouseInvoiceMovementPlans(
    input.previousInvoice,
    mapped.invoice
  );
  const movementIdByMaterial = await applyPlansInTransaction({
    transaction,
    scope: input.scope,
    userId: input.userId,
    invoice: mapped.invoice,
    previousInvoice: input.previousInvoice,
    invoiceRecordKey: input.invoiceRecordKey,
    previousInvoiceRecordKey: input.previousInvoiceRecordKey,
    integrationRevision,
    plans,
    materialSourceById,
    newlyDerivedMaterialIds: mapped.newlyDerivedMaterialIds,
  });

  const linkedInvoice = attachMovementHistory(
    mapped.invoice,
    input.previousInvoice,
    movementIdByMaterial
  );
  const movementIds = Array.from(movementIdByMaterial.values());
  const integratedInvoice: Invoice = {
    ...linkedInvoice,
    warehouseIntegration: {
      schemaVersion: WAREHOUSE_INVOICE_LINK_SCHEMA_VERSION,
      status: 'integrated',
      workspaceId: input.scope.workspaceId,
      cutoffAt: settings.cutoffAt,
      revision: integrationRevision,
      lastMovementIds: movementIds.length
        ? movementIds
        : input.previousInvoice?.warehouseIntegration?.lastMovementIds || [],
    },
  };

  if (shouldCreateSettings) transaction.set(settingsRef, settings);

  return {
    invoice: integratedInvoice,
    targetEmpenho: mappedTargetEmpenho,
    movementIds,
    integrated: true,
  };
}

export async function integrateInvoiceDeletionInTransaction(
  transaction: Transaction,
  input: WarehouseInvoiceDeletionTransactionInput
): Promise<string[]> {
  if (!input.enabled || !input.scope.ug || !isWarehouseIntegratedInvoice(input.invoice)) {
    return [];
  }
  if (input.invoice.warehouseIntegration?.workspaceId !== input.scope.workspaceId) {
    throw new Error('WAREHOUSE_INVOICE_WORKSPACE_MISMATCH');
  }
  ensureInvoiceMappingsAreComplete(input.invoice);

  const settingsRef = doc(
    db,
    warehouseDocumentPath(
      input.scope.workspaceId,
      'settings',
      INVOICE_INTEGRATION_SETTINGS_ID
    )
  );
  const settingsSnapshot = await transaction.get(settingsRef);
  const settings = parseSettings(settingsSnapshot, input.scope.workspaceId, input.scope.ug);
  if (!settings) throw new Error('WAREHOUSE_INVOICE_SETTINGS_MISSING');

  const plans = buildWarehouseInvoiceMovementPlans(input.invoice, null);
  const materialSourceById = new Map<string, Item>();
  for (const invoiceItem of input.invoice.items) {
    const materialId = invoiceItem.warehouseMaterialId!;
    materialSourceById.set(materialId, {
      id: invoiceItem.itemId,
      name: 'Material vinculado à NF ' + input.invoice.id,
      unit: 'un',
      quantity: invoiceItem.quantity,
      unitPrice: invoiceItem.unitPrice,
      received: invoiceItem.quantity,
      warehouseMaterialId: materialId,
    });
  }

  const movementIdByMaterial = await applyPlansInTransaction({
    transaction,
    scope: input.scope,
    userId: input.userId,
    invoice: input.invoice,
    previousInvoice: input.invoice,
    invoiceRecordKey: input.invoiceRecordKey,
    previousInvoiceRecordKey: input.invoiceRecordKey,
    integrationRevision: (input.invoice.warehouseIntegration?.revision || 0) + 1,
    plans,
    materialSourceById,
    newlyDerivedMaterialIds: new Set(),
  });

  return Array.from(movementIdByMaterial.values());
}

export function assertBulkInvoiceDeletionDoesNotBypassWarehouse(
  invoices: Invoice[]
): void {
  const integrated = invoices.filter(isWarehouseIntegratedInvoice);
  if (integrated.length > 0) {
    throw new Error(
      'WAREHOUSE_BULK_INVOICE_DELETE_BLOCKED: Exclua NFs integradas individualmente para que cada estorno seja registrado no ledger.'
    );
  }
}
