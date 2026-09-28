'use client';

import { auth } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import { saveWarehouseBarcodeAssociation } from './barcodeRepository';
import { warehouseUnitFromOperationalLabel } from './invoiceIntegration';
import {
  transferWarehouseStock,
  type TransferWarehouseStockResult,
} from './locationRepository';
import {
  validateWarehouseStockPosition,
  warehouseStockPositionKey,
  type WarehouseStockPosition,
} from './location';
import { applyWarehouseMovement, type ApplyWarehouseMovementResult } from './ledgerRepository';
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

export interface RegisterWarehouseManualEntryInput {
  operationId: string;
  existingMaterialId?: string | null;
  description: string;
  unitLabel: string;
  quantity: number;
  provenance: string;
  reference?: string | null;
  position: WarehouseStockPosition;
  /**
   * Uso interno: permite registrar a entrada diretamente em UNASSIGNED.
   * A interface normal de Entrada Avulsa não habilita esta opção.
   */
  allowUnassignedPosition?: boolean;
  expiresOn?: string | null;
  barcode?: string | null;
}

export interface RegisterWarehouseManualEntryResult {
  material: WarehouseMaterial;
  entry: ApplyWarehouseMovementResult;
  transfer: TransferWarehouseStockResult | null;
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
  if (
    !position
    || (position.kind === 'UNASSIGNED' && !input.allowUnassignedPosition)
  ) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED');
  }

  const normalizedExpiry = normalizeWarehouseExpiryDate(input.expiresOn ?? null);
  if (normalizedExpiry === undefined) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_INVALID_EXPIRY');
  }

  const material = await ensureMaterial(scope, input, operationId);

  const entry = await applyWarehouseMovement(scope.workspaceId, {
    materialId: material.id,
    type: 'MANUAL_ENTRY',
    quantityDelta: quantity,
    idempotencyKey: ['manual-entry', operationId, 'ledger'].join(':'),
    note: 'Entrada avulsa · ' + provenance,
    source: {
      kind: 'MANUAL_ENTRY',
      actorUid: scope.uid,
      provenance,
      reference,
    },
  });

  const transfer = position.kind === 'UNASSIGNED'
    ? null
    : await transferWarehouseStock(scope.workspaceId, {
        materialId: material.id,
        quantity,
        from: { kind: 'UNASSIGNED' },
        to: position,
        idempotencyKey: ['manual-entry', operationId, 'position'].join(':'),
        note: 'Posicionamento da entrada avulsa',
      });

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
    validity,
    barcodeLinked,
    warnings,
  };
}
