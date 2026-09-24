import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import { isValidWarehouseMaterialId } from './material';
import {
  isValidWarehouseDepotId,
  isValidWarehouseLocationBalanceId,
  isValidWarehouseLocationId,
  isValidWarehouseSubpositionId,
  normalizeWarehouseLocationQuantity,
  validateWarehouseStockPosition,
  warehouseStockPositionKey,
  type WarehouseStockPosition,
} from './location';
import { isValidWarehouseMovementId } from './movement';

export const WAREHOUSE_INVENTORY_SCHEMA_VERSION = 'warehouse_inventory_v1' as const;
export const WAREHOUSE_INVENTORY_ITEM_SCHEMA_VERSION = 'warehouse_inventory_item_v1' as const;

export const WAREHOUSE_INVENTORY_STATUSES = [
  'OPENING',
  'COUNTING',
  'REVIEW',
  'CONFIRMING',
  'RECONCILIATION_REQUIRED',
  'CONFIRMED',
  'CANCELLED',
] as const;

export const WAREHOUSE_INVENTORY_ITEM_STATUSES = [
  'PENDING',
  'MATCHED',
  'DIVERGENT',
  'ADJUSTED',
  'STALE',
] as const;

export type WarehouseInventoryStatus = (typeof WAREHOUSE_INVENTORY_STATUSES)[number];
export type WarehouseInventoryItemStatus = (typeof WAREHOUSE_INVENTORY_ITEM_STATUSES)[number];

export type WarehouseInventoryScope =
  | { kind: 'TOTAL' }
  | { kind: 'DEPOT'; depotId: string }
  | { kind: 'LOCATION'; depotId: string; locationId: string }
  | { kind: 'SUBPOSITION'; depotId: string; locationId: string; subpositionId: string };

export interface WarehouseInventoryReviewSummary {
  totalItems: number;
  countedItems: number;
  matchedItems: number;
  divergentItems: number;
  adjustedItems: number;
  positiveDifference: number;
  negativeDifference: number;
}

export interface WarehouseInventorySession {
  schemaVersion: typeof WAREHOUSE_INVENTORY_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  scope: WarehouseInventoryScope;
  status: WarehouseInventoryStatus;
  itemCount: number;
  openedBy: string;
  reviewedBy: string | null;
  confirmationStartedBy: string | null;
  confirmedBy: string | null;
  cancelledBy: string | null;
  reviewSummary: WarehouseInventoryReviewSummary | null;
  staleItemId: string | null;
}

export interface WarehouseInventoryItem {
  schemaVersion: typeof WAREHOUSE_INVENTORY_ITEM_SCHEMA_VERSION;
  id: string;
  inventoryId: string;
  workspaceId: string;
  ug: string;
  materialId: string;
  position: WarehouseStockPosition;
  locationBalanceId: string;
  expectedQuantity: number;
  expectedBalanceRevision: number;
  expectedBalanceLastMovementId: string;
  expectedLocationRevision: number;
  expectedLocationLastMovementId: string;
  countedQuantity: number | null;
  difference: number | null;
  status: WarehouseInventoryItemStatus;
  countedBy: string | null;
  adjustmentMovementId: string | null;
  adjustedBy: string | null;
}

export interface WarehouseInventoryValidationIssue {
  code: string;
  path: string;
  message: string;
}

const INVENTORY_ID_PATTERN = /^inv_[a-f0-9]{32}$/;
const INVENTORY_ITEM_ID_PATTERN = /^invit_[a-f0-9]{64}$/;
type UnknownObject = Record<string, unknown>;

function issue(code: string, path: string, message: string): WarehouseInventoryValidationIssue {
  return { code, path, message };
}

function isPlainObject(value: unknown): value is UnknownObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeActor(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 160 ? normalized : null;
}

export function isValidWarehouseInventoryId(value: unknown): value is string {
  return typeof value === 'string' && INVENTORY_ID_PATTERN.test(value);
}

export function isValidWarehouseInventoryItemId(value: unknown): value is string {
  return typeof value === 'string' && INVENTORY_ITEM_ID_PATTERN.test(value);
}

export function createWarehouseInventoryId(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('WAREHOUSE_INVENTORY_RANDOM_UNAVAILABLE');
  }
  return 'inv_' + crypto.randomUUID().replace(/-/g, '').toLowerCase();
}

export async function createWarehouseInventoryItemId(
  inventoryId: string,
  materialId: string,
  position: WarehouseStockPosition
): Promise<string> {
  if (!isValidWarehouseInventoryId(inventoryId) || !isValidWarehouseMaterialId(materialId)) {
    throw new Error('WAREHOUSE_INVENTORY_ITEM_IDENTITY_INVALID');
  }
  const bytes = new TextEncoder().encode(
    inventoryId + '\n' + materialId + '\n' + warehouseStockPositionKey(position)
  );
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'invit_' + Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function validateWarehouseInventoryScope(input: unknown): WarehouseInventoryScope | null {
  if (!isPlainObject(input) || typeof input.kind !== 'string') return null;
  if (input.kind === 'TOTAL') {
    return Object.keys(input).length === 1 ? { kind: 'TOTAL' } : null;
  }

  const depotId = typeof input.depotId === 'string' ? input.depotId.trim().toLowerCase() : '';
  if (!isValidWarehouseDepotId(depotId)) return null;

  if (input.kind === 'DEPOT') {
    return Object.keys(input).every((key) => ['kind', 'depotId'].includes(key))
      ? { kind: 'DEPOT', depotId }
      : null;
  }

  const locationId = typeof input.locationId === 'string'
    ? input.locationId.trim().toLowerCase()
    : '';
  if (!isValidWarehouseLocationId(locationId)) return null;

  if (input.kind === 'LOCATION') {
    return Object.keys(input).every((key) => ['kind', 'depotId', 'locationId'].includes(key))
      ? { kind: 'LOCATION', depotId, locationId }
      : null;
  }

  const subpositionId = typeof input.subpositionId === 'string'
    ? input.subpositionId.trim().toLowerCase()
    : '';
  if (input.kind === 'SUBPOSITION' && isValidWarehouseSubpositionId(subpositionId)) {
    return Object.keys(input).every((key) =>
      ['kind', 'depotId', 'locationId', 'subpositionId'].includes(key)
    )
      ? { kind: 'SUBPOSITION', depotId, locationId, subpositionId }
      : null;
  }

  return null;
}

export function warehouseInventoryScopeIncludesPosition(
  scope: WarehouseInventoryScope,
  position: WarehouseStockPosition
): boolean {
  if (scope.kind === 'TOTAL') return true;
  if (position.kind === 'UNASSIGNED') return false;
  if (scope.depotId !== position.depotId) return false;
  if (scope.kind === 'DEPOT') return true;
  if (scope.locationId !== position.locationId) return false;
  if (scope.kind === 'LOCATION') return true;
  return position.kind === 'SUBPOSITION' && scope.subpositionId === position.subpositionId;
}

export function calculateWarehouseInventoryDifference(
  expectedQuantity: number,
  countedQuantity: number
): number {
  const expected = normalizeWarehouseLocationQuantity(expectedQuantity);
  const counted = normalizeWarehouseLocationQuantity(countedQuantity);
  if (expected === null || expected < 0 || counted === null || counted < 0) {
    throw new Error('WAREHOUSE_INVENTORY_INVALID_QUANTITY');
  }
  const difference = normalizeWarehouseLocationQuantity(counted - expected);
  if (difference === null) throw new Error('WAREHOUSE_INVENTORY_INVALID_DIFFERENCE');
  return difference;
}

export function warehouseInventoryItemStatusForDifference(
  countedQuantity: number | null,
  difference: number | null
): WarehouseInventoryItemStatus {
  if (countedQuantity === null || difference === null) return 'PENDING';
  return difference === 0 ? 'MATCHED' : 'DIVERGENT';
}

export function summarizeWarehouseInventoryItems(
  items: readonly WarehouseInventoryItem[]
): WarehouseInventoryReviewSummary {
  let countedItems = 0;
  let matchedItems = 0;
  let divergentItems = 0;
  let adjustedItems = 0;
  let positiveDifference = 0;
  let negativeDifference = 0;

  for (const item of items) {
    if (item.status !== 'PENDING' && item.status !== 'STALE') countedItems += 1;
    if (item.status === 'MATCHED') matchedItems += 1;
    if (item.status === 'DIVERGENT') divergentItems += 1;
    if (item.status === 'ADJUSTED') adjustedItems += 1;
    if (item.status === 'DIVERGENT' && item.difference !== null) {
      if (item.difference > 0) positiveDifference += item.difference;
      if (item.difference < 0) negativeDifference += item.difference;
    }
  }

  return {
    totalItems: items.length,
    countedItems,
    matchedItems,
    divergentItems,
    adjustedItems,
    positiveDifference: normalizeWarehouseLocationQuantity(positiveDifference) || 0,
    negativeDifference: normalizeWarehouseLocationQuantity(negativeDifference) || 0,
  };
}

export function validateWarehouseInventorySession(
  input: unknown,
  options: { expectedWorkspaceId?: string; expectedUg?: string | number } = {}
):
  | { ok: true; data: WarehouseInventorySession; issues: [] }
  | { ok: false; issues: WarehouseInventoryValidationIssue[] } {
  const issues: WarehouseInventoryValidationIssue[] = [];
  if (!isPlainObject(input)) return { ok: false, issues: [issue('invalid_root', '$', 'Inventário deve ser objeto.')] };

  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  if (!isValidWarehouseInventoryId(id)) issues.push(issue('invalid_id', '$.id', 'ID de inventário inválido.'));

  const workspaceId = typeof input.workspaceId === 'string' ? normalizeWorkspaceId(input.workspaceId) : '';
  if (!isValidWorkspaceId(workspaceId)) issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId inválido.'));
  if (options.expectedWorkspaceId && workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)) {
    issues.push(issue('workspace_mismatch', '$.workspaceId', 'Inventário pertence a outro workspace.'));
  }

  const ug = normalizeUnitUg(typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null);
  if (!isValidUnitUg(ug)) issues.push(issue('invalid_ug', '$.ug', 'UG inválida.'));
  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push(issue('ug_mismatch', '$.ug', 'Inventário pertence a outra UG.'));
  }

  const scope = validateWarehouseInventoryScope(input.scope);
  if (!scope) issues.push(issue('invalid_scope', '$.scope', 'Escopo do inventário é inválido.'));

  const status = typeof input.status === 'string' ? input.status : '';
  if (!WAREHOUSE_INVENTORY_STATUSES.includes(status as WarehouseInventoryStatus)) {
    issues.push(issue('invalid_status', '$.status', 'Status do inventário é inválido.'));
  }

  const itemCount = input.itemCount;
  if (typeof itemCount !== 'number' || !Number.isSafeInteger(itemCount) || itemCount < 0 || itemCount > 5000) {
    issues.push(issue('invalid_item_count', '$.itemCount', 'Quantidade de itens do inventário é inválida.'));
  }

  const openedBy = normalizeActor(input.openedBy);
  if (!openedBy) issues.push(issue('invalid_opened_by', '$.openedBy', 'Responsável pela abertura é obrigatório.'));
  const reviewedBy = normalizeActor(input.reviewedBy);
  const confirmationStartedBy = normalizeActor(input.confirmationStartedBy);
  const confirmedBy = normalizeActor(input.confirmedBy);
  const cancelledBy = normalizeActor(input.cancelledBy);
  const staleItemId = input.staleItemId === null || input.staleItemId === undefined
    ? null
    : typeof input.staleItemId === 'string'
      ? input.staleItemId.trim().toLowerCase()
      : '';
  if (staleItemId !== null && !isValidWarehouseInventoryItemId(staleItemId)) {
    issues.push(issue('invalid_stale_item_id', '$.staleItemId', 'Item concorrente inválido.'));
  }

  if (issues.length || !scope || !openedBy || typeof itemCount !== 'number') {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_INVENTORY_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      scope,
      status: status as WarehouseInventoryStatus,
      itemCount,
      openedBy,
      reviewedBy,
      confirmationStartedBy,
      confirmedBy,
      cancelledBy,
      reviewSummary: isPlainObject(input.reviewSummary)
        ? input.reviewSummary as unknown as WarehouseInventoryReviewSummary
        : null,
      staleItemId,
    },
  };
}

export function validateWarehouseInventoryItem(
  input: unknown,
  options: { expectedWorkspaceId?: string; expectedInventoryId?: string } = {}
):
  | { ok: true; data: WarehouseInventoryItem; issues: [] }
  | { ok: false; issues: WarehouseInventoryValidationIssue[] } {
  const issues: WarehouseInventoryValidationIssue[] = [];
  if (!isPlainObject(input)) return { ok: false, issues: [issue('invalid_root', '$', 'Item de inventário deve ser objeto.')] };

  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  const inventoryId = typeof input.inventoryId === 'string' ? input.inventoryId.trim().toLowerCase() : '';
  const workspaceId = typeof input.workspaceId === 'string' ? normalizeWorkspaceId(input.workspaceId) : '';
  const ug = normalizeUnitUg(typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null);
  const materialId = typeof input.materialId === 'string' ? input.materialId.trim().toLowerCase() : '';
  const position = validateWarehouseStockPosition(input.position);
  const locationBalanceId = typeof input.locationBalanceId === 'string'
    ? input.locationBalanceId.trim().toLowerCase()
    : '';

  if (!isValidWarehouseInventoryItemId(id)) issues.push(issue('invalid_id', '$.id', 'ID do item é inválido.'));
  if (!isValidWarehouseInventoryId(inventoryId)) issues.push(issue('invalid_inventory_id', '$.inventoryId', 'Sessão do item é inválida.'));
  if (options.expectedInventoryId && inventoryId !== options.expectedInventoryId) issues.push(issue('inventory_mismatch', '$.inventoryId', 'Item pertence a outra sessão.'));
  if (!isValidWorkspaceId(workspaceId)) issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId inválido.'));
  if (options.expectedWorkspaceId && workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)) issues.push(issue('workspace_mismatch', '$.workspaceId', 'Item pertence a outro workspace.'));
  if (!isValidUnitUg(ug)) issues.push(issue('invalid_ug', '$.ug', 'UG inválida.'));
  if (!isValidWarehouseMaterialId(materialId)) issues.push(issue('invalid_material_id', '$.materialId', 'Material inválido.'));
  if (!position) issues.push(issue('invalid_position', '$.position', 'Posição inválida.'));
  if (!isValidWarehouseLocationBalanceId(locationBalanceId)) issues.push(issue('invalid_location_balance_id', '$.locationBalanceId', 'Projeção física inválida.'));

  const expectedQuantity = normalizeWarehouseLocationQuantity(input.expectedQuantity);
  const countedQuantity = input.countedQuantity === null || input.countedQuantity === undefined
    ? null
    : normalizeWarehouseLocationQuantity(input.countedQuantity);
  const difference = input.difference === null || input.difference === undefined
    ? null
    : normalizeWarehouseLocationQuantity(input.difference);
  if (expectedQuantity === null || expectedQuantity < 0) issues.push(issue('invalid_expected', '$.expectedQuantity', 'Esperado inválido.'));
  if (countedQuantity !== null && countedQuantity < 0) issues.push(issue('invalid_counted', '$.countedQuantity', 'Contado inválido.'));
  if ((countedQuantity === null) !== (difference === null)) issues.push(issue('count_difference_pair', '$.difference', 'Contado e diferença devem existir em conjunto.'));
  if (countedQuantity !== null && expectedQuantity !== null && difference !== null) {
    try {
      if (calculateWarehouseInventoryDifference(expectedQuantity, countedQuantity) !== difference) {
        issues.push(issue('difference_mismatch', '$.difference', 'Divergência não corresponde a contado - esperado.'));
      }
    } catch {
      issues.push(issue('difference_invalid', '$.difference', 'Divergência inválida.'));
    }
  }

  const expectedBalanceRevision = input.expectedBalanceRevision;
  const expectedLocationRevision = input.expectedLocationRevision;
  if (typeof expectedBalanceRevision !== 'number' || !Number.isSafeInteger(expectedBalanceRevision) || expectedBalanceRevision < 1) issues.push(issue('invalid_balance_revision', '$.expectedBalanceRevision', 'Revisão agregada inválida.'));
  if (typeof expectedLocationRevision !== 'number' || !Number.isSafeInteger(expectedLocationRevision) || expectedLocationRevision < 1) issues.push(issue('invalid_location_revision', '$.expectedLocationRevision', 'Revisão física inválida.'));

  const expectedBalanceLastMovementId = typeof input.expectedBalanceLastMovementId === 'string' ? input.expectedBalanceLastMovementId.trim().toLowerCase() : '';
  const expectedLocationLastMovementId = typeof input.expectedLocationLastMovementId === 'string' ? input.expectedLocationLastMovementId.trim().toLowerCase() : '';
  if (!isValidWarehouseMovementId(expectedBalanceLastMovementId)) issues.push(issue('invalid_balance_movement', '$.expectedBalanceLastMovementId', 'Movimento agregado de referência inválido.'));
  if (!isValidWarehouseMovementId(expectedLocationLastMovementId)) issues.push(issue('invalid_location_movement', '$.expectedLocationLastMovementId', 'Movimento físico de referência inválido.'));

  const status = typeof input.status === 'string' ? input.status : '';
  if (!WAREHOUSE_INVENTORY_ITEM_STATUSES.includes(status as WarehouseInventoryItemStatus)) issues.push(issue('invalid_status', '$.status', 'Status do item inválido.'));

  const countedBy = normalizeActor(input.countedBy);
  const adjustmentMovementId = input.adjustmentMovementId === null || input.adjustmentMovementId === undefined
    ? null
    : typeof input.adjustmentMovementId === 'string'
      ? input.adjustmentMovementId.trim().toLowerCase()
      : '';
  const adjustedBy = normalizeActor(input.adjustedBy);
  if (adjustmentMovementId !== null && !isValidWarehouseMovementId(adjustmentMovementId)) issues.push(issue('invalid_adjustment_movement', '$.adjustmentMovementId', 'Movimento de ajuste inválido.'));

  if (issues.length || !position || expectedQuantity === null || typeof expectedBalanceRevision !== 'number' || typeof expectedLocationRevision !== 'number') {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_INVENTORY_ITEM_SCHEMA_VERSION,
      id,
      inventoryId,
      workspaceId,
      ug,
      materialId,
      position,
      locationBalanceId,
      expectedQuantity,
      expectedBalanceRevision,
      expectedBalanceLastMovementId,
      expectedLocationRevision,
      expectedLocationLastMovementId,
      countedQuantity,
      difference,
      status: status as WarehouseInventoryItemStatus,
      countedBy,
      adjustmentMovementId,
      adjustedBy,
    },
  };
}
