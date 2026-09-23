import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import {
  addWarehouseQuantities,
  normalizeWarehouseQuantity,
} from './movement';
import { isValidWarehouseMaterialId } from './material';

export const WAREHOUSE_DEPOT_SCHEMA_VERSION = 'warehouse_depot_v1' as const;
export const WAREHOUSE_LOCATION_SCHEMA_VERSION = 'warehouse_location_v1' as const;
export const WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION =
  'warehouse_location_balance_v1' as const;

export type WarehouseEntityStatus = 'active' | 'inactive';
export type WarehouseLocationKind = 'LOCAL' | 'SUBPOSITION';

export interface WarehouseDepot {
  schemaVersion: typeof WAREHOUSE_DEPOT_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  code: string;
  name: string;
  description: string | null;
  status: WarehouseEntityStatus;
  createdBy: string;
  updatedBy: string;
}

export interface WarehouseLocation {
  schemaVersion: typeof WAREHOUSE_LOCATION_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  depotId: string;
  kind: WarehouseLocationKind;
  parentLocationId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: WarehouseEntityStatus;
  createdBy: string;
  updatedBy: string;
}

export type WarehouseStockPosition =
  | { kind: 'UNASSIGNED' }
  | {
      kind: 'LOCATION';
      depotId: string;
      locationId: string;
      subpositionId: null;
    }
  | {
      kind: 'SUBPOSITION';
      depotId: string;
      locationId: string;
      subpositionId: string;
    };

export interface WarehouseLocationBalance {
  schemaVersion: typeof WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  materialId: string;
  position: WarehouseStockPosition;
  quantity: number;
  revision: number;
  lastMovementId: string;
}

export interface WarehouseLocationValidationIssue {
  code: string;
  path: string;
  message: string;
}

type UnknownObject = Record<string, unknown>;

const DEPOT_ID_PATTERN = /^dep_[a-f0-9]{32}$/;
const LOCATION_ID_PATTERN = /^loc_[a-f0-9]{32}$/;
const SUBPOSITION_ID_PATTERN = /^sub_[a-f0-9]{32}$/;
const LOCATION_BALANCE_ID_PATTERN = /^locbal_[a-f0-9]{64}$/;
const MOVEMENT_ID_PATTERN = /^mov_[a-f0-9]{64}$/;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,31}$/;

const DEPOT_FIELDS = new Set([
  'schemaVersion',
  'id',
  'workspaceId',
  'ug',
  'code',
  'name',
  'description',
  'status',
  'createdBy',
  'updatedBy',
]);

const LOCATION_FIELDS = new Set([
  'schemaVersion',
  'id',
  'workspaceId',
  'ug',
  'depotId',
  'kind',
  'parentLocationId',
  'code',
  'name',
  'description',
  'status',
  'createdBy',
  'updatedBy',
]);

const LOCATION_BALANCE_FIELDS = new Set([
  'schemaVersion',
  'id',
  'workspaceId',
  'ug',
  'materialId',
  'position',
  'quantity',
  'revision',
  'lastMovementId',
]);

function isPlainObject(value: unknown): value is UnknownObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyFields(value: UnknownObject, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function issue(code: string, path: string, message: string): WarehouseLocationValidationIssue {
  return { code, path, message };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeWarehouseLogicalCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '-');
  return CODE_PATTERN.test(normalized) ? normalized : null;
}

export function isValidWarehouseDepotId(value: unknown): value is string {
  return typeof value === 'string' && DEPOT_ID_PATTERN.test(value);
}

export function isValidWarehouseLocationId(value: unknown): value is string {
  return typeof value === 'string' && LOCATION_ID_PATTERN.test(value);
}

export function isValidWarehouseSubpositionId(value: unknown): value is string {
  return typeof value === 'string' && SUBPOSITION_ID_PATTERN.test(value);
}

export function isValidWarehouseLocationBalanceId(value: unknown): value is string {
  return typeof value === 'string' && LOCATION_BALANCE_ID_PATTERN.test(value);
}

function randomHex32(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').toLowerCase();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createWarehouseDepotId(): string {
  return 'dep_' + randomHex32();
}

export function createWarehouseLocationId(kind: WarehouseLocationKind): string {
  return (kind === 'LOCAL' ? 'loc_' : 'sub_') + randomHex32();
}

function normalizeDescription(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = normalizeText(value);
  if (!normalized || normalized.length > 240) return undefined;
  return normalized;
}

function normalizeActor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeText(value);
  return normalized && normalized.length <= 160 ? normalized : null;
}

export function validateWarehouseDepot(
  input: unknown,
  options: { expectedWorkspaceId?: string; expectedUg?: string | number } = {}
):
  | { ok: true; data: WarehouseDepot; issues: [] }
  | { ok: false; issues: WarehouseLocationValidationIssue[] } {
  const issues: WarehouseLocationValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, issues: [issue('invalid_root', '$', 'Depósito deve ser um objeto.')] };
  }
  if (!hasOnlyFields(input, DEPOT_FIELDS)) {
    issues.push(issue('unexpected_field', '$', 'Depósito contém campos fora do contrato warehouse_depot_v1.'));
  }
  if (input.schemaVersion !== WAREHOUSE_DEPOT_SCHEMA_VERSION) {
    issues.push(issue('invalid_schema_version', '$.schemaVersion', 'schemaVersion deve ser warehouse_depot_v1.'));
  }
  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  if (!isValidWarehouseDepotId(id)) issues.push(issue('invalid_depot_id', '$.id', 'ID do depósito é inválido.'));
  const workspaceId = typeof input.workspaceId === 'string' ? normalizeWorkspaceId(input.workspaceId) : '';
  if (!isValidWorkspaceId(workspaceId)) issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId é inválido.'));
  if (options.expectedWorkspaceId && workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)) {
    issues.push(issue('workspace_mismatch', '$.workspaceId', 'Depósito pertence a outro workspace.'));
  }
  const ug = normalizeUnitUg(typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null);
  if (!isValidUnitUg(ug)) issues.push(issue('invalid_ug', '$.ug', 'UG deve possuir exatamente 6 dígitos.'));
  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push(issue('ug_mismatch', '$.ug', 'Depósito pertence a outra UG.'));
  }
  const code = normalizeWarehouseLogicalCode(input.code);
  if (!code) issues.push(issue('invalid_code', '$.code', 'Código lógico deve possuir de 2 a 32 caracteres legíveis.'));
  const name = typeof input.name === 'string' ? normalizeText(input.name) : '';
  if (name.length < 2 || name.length > 120) issues.push(issue('invalid_name', '$.name', 'Nome deve possuir entre 2 e 120 caracteres.'));
  const description = normalizeDescription(input.description);
  if (description === undefined) issues.push(issue('invalid_description', '$.description', 'Descrição deve possuir no máximo 240 caracteres.'));
  const status = input.status;
  if (status !== 'active' && status !== 'inactive') issues.push(issue('invalid_status', '$.status', 'Status deve ser active ou inactive.'));
  const createdBy = normalizeActor(input.createdBy);
  const updatedBy = normalizeActor(input.updatedBy);
  if (!createdBy) issues.push(issue('invalid_created_by', '$.createdBy', 'createdBy é obrigatório.'));
  if (!updatedBy) issues.push(issue('invalid_updated_by', '$.updatedBy', 'updatedBy é obrigatório.'));

  if (issues.length || !code || description === undefined || !createdBy || !updatedBy) return { ok: false, issues };
  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_DEPOT_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      code,
      name,
      description,
      status: status as WarehouseEntityStatus,
      createdBy,
      updatedBy,
    },
  };
}

export function validateWarehouseLocation(
  input: unknown,
  options: { expectedWorkspaceId?: string; expectedUg?: string | number } = {}
):
  | { ok: true; data: WarehouseLocation; issues: [] }
  | { ok: false; issues: WarehouseLocationValidationIssue[] } {
  const issues: WarehouseLocationValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, issues: [issue('invalid_root', '$', 'Localização deve ser um objeto.')] };
  }
  if (!hasOnlyFields(input, LOCATION_FIELDS)) {
    issues.push(issue('unexpected_field', '$', 'Localização contém campos fora do contrato warehouse_location_v1.'));
  }
  if (input.schemaVersion !== WAREHOUSE_LOCATION_SCHEMA_VERSION) {
    issues.push(issue('invalid_schema_version', '$.schemaVersion', 'schemaVersion deve ser warehouse_location_v1.'));
  }
  const kind = input.kind === 'LOCAL' || input.kind === 'SUBPOSITION' ? input.kind : null;
  if (!kind) issues.push(issue('invalid_kind', '$.kind', 'kind deve ser LOCAL ou SUBPOSITION.'));
  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  if (kind === 'LOCAL' && !isValidWarehouseLocationId(id)) issues.push(issue('invalid_location_id', '$.id', 'ID do local é inválido.'));
  if (kind === 'SUBPOSITION' && !isValidWarehouseSubpositionId(id)) issues.push(issue('invalid_subposition_id', '$.id', 'ID da subposição é inválido.'));
  const workspaceId = typeof input.workspaceId === 'string' ? normalizeWorkspaceId(input.workspaceId) : '';
  if (!isValidWorkspaceId(workspaceId)) issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId é inválido.'));
  if (options.expectedWorkspaceId && workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)) {
    issues.push(issue('workspace_mismatch', '$.workspaceId', 'Localização pertence a outro workspace.'));
  }
  const ug = normalizeUnitUg(typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null);
  if (!isValidUnitUg(ug)) issues.push(issue('invalid_ug', '$.ug', 'UG deve possuir exatamente 6 dígitos.'));
  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push(issue('ug_mismatch', '$.ug', 'Localização pertence a outra UG.'));
  }
  const depotId = typeof input.depotId === 'string' ? input.depotId.trim().toLowerCase() : '';
  if (!isValidWarehouseDepotId(depotId)) issues.push(issue('invalid_depot_id', '$.depotId', 'depotId é inválido.'));
  let parentLocationId: string | null = null;
  if (kind === 'SUBPOSITION') {
    parentLocationId = typeof input.parentLocationId === 'string' ? input.parentLocationId.trim().toLowerCase() : '';
    if (!isValidWarehouseLocationId(parentLocationId)) issues.push(issue('invalid_parent_location', '$.parentLocationId', 'Subposição exige um local pai válido.'));
  } else if (input.parentLocationId !== null && input.parentLocationId !== undefined) {
    issues.push(issue('unexpected_parent_location', '$.parentLocationId', 'LOCAL não pode possuir parentLocationId.'));
  }
  const code = normalizeWarehouseLogicalCode(input.code);
  if (!code) issues.push(issue('invalid_code', '$.code', 'Código lógico deve possuir de 2 a 32 caracteres legíveis.'));
  const name = typeof input.name === 'string' ? normalizeText(input.name) : '';
  if (name.length < 2 || name.length > 120) issues.push(issue('invalid_name', '$.name', 'Nome deve possuir entre 2 e 120 caracteres.'));
  const description = normalizeDescription(input.description);
  if (description === undefined) issues.push(issue('invalid_description', '$.description', 'Descrição deve possuir no máximo 240 caracteres.'));
  const status = input.status;
  if (status !== 'active' && status !== 'inactive') issues.push(issue('invalid_status', '$.status', 'Status deve ser active ou inactive.'));
  const createdBy = normalizeActor(input.createdBy);
  const updatedBy = normalizeActor(input.updatedBy);
  if (!createdBy) issues.push(issue('invalid_created_by', '$.createdBy', 'createdBy é obrigatório.'));
  if (!updatedBy) issues.push(issue('invalid_updated_by', '$.updatedBy', 'updatedBy é obrigatório.'));

  if (issues.length || !kind || !code || description === undefined || !createdBy || !updatedBy) return { ok: false, issues };
  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_LOCATION_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      depotId,
      kind,
      parentLocationId,
      code,
      name,
      description,
      status: status as WarehouseEntityStatus,
      createdBy,
      updatedBy,
    },
  };
}

export function validateWarehouseStockPosition(input: unknown): WarehouseStockPosition | null {
  if (!isPlainObject(input) || typeof input.kind !== 'string') return null;
  if (input.kind === 'UNASSIGNED') {
    return Object.keys(input).length === 1 ? { kind: 'UNASSIGNED' } : null;
  }

  const depotId = typeof input.depotId === 'string' ? input.depotId.trim().toLowerCase() : '';
  const locationId = typeof input.locationId === 'string' ? input.locationId.trim().toLowerCase() : '';
  if (!isValidWarehouseDepotId(depotId) || !isValidWarehouseLocationId(locationId)) return null;

  if (input.kind === 'LOCATION') {
    if (input.subpositionId !== null || Object.keys(input).some((key) => !['kind','depotId','locationId','subpositionId'].includes(key))) return null;
    return { kind: 'LOCATION', depotId, locationId, subpositionId: null };
  }

  if (input.kind === 'SUBPOSITION') {
    const subpositionId = typeof input.subpositionId === 'string' ? input.subpositionId.trim().toLowerCase() : '';
    if (!isValidWarehouseSubpositionId(subpositionId) || Object.keys(input).some((key) => !['kind','depotId','locationId','subpositionId'].includes(key))) return null;
    return { kind: 'SUBPOSITION', depotId, locationId, subpositionId };
  }

  return null;
}

export function warehouseStockPositionKey(position: WarehouseStockPosition): string {
  if (position.kind === 'UNASSIGNED') return 'UNASSIGNED';
  if (position.kind === 'LOCATION') return 'LOCATION:' + position.depotId + ':' + position.locationId;
  return 'SUBPOSITION:' + position.depotId + ':' + position.locationId + ':' + position.subpositionId;
}

export function warehouseStockPositionsEqual(left: WarehouseStockPosition, right: WarehouseStockPosition): boolean {
  return warehouseStockPositionKey(left) === warehouseStockPositionKey(right);
}

export async function createWarehouseLocationBalanceId(
  workspaceId: string,
  materialId: string,
  position: WarehouseStockPosition
): Promise<string> {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (!isValidWorkspaceId(normalizedWorkspaceId) || !isValidWarehouseMaterialId(materialId)) {
    throw new Error('WAREHOUSE_LOCATION_BALANCE_SCOPE_INVALID');
  }
  const payload = new TextEncoder().encode(
    normalizedWorkspaceId + '\n' + materialId + '\n' + warehouseStockPositionKey(position)
  );
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return 'locbal_' + hash;
}

export function validateWarehouseLocationBalance(
  input: unknown,
  options: { expectedWorkspaceId?: string; expectedMaterialId?: string } = {}
):
  | { ok: true; data: WarehouseLocationBalance; issues: [] }
  | { ok: false; issues: WarehouseLocationValidationIssue[] } {
  const issues: WarehouseLocationValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, issues: [issue('invalid_root', '$', 'Saldo por localização deve ser um objeto.')] };
  }
  if (!hasOnlyFields(input, LOCATION_BALANCE_FIELDS)) {
    issues.push(issue('unexpected_field', '$', 'Saldo por localização contém campos fora do contrato warehouse_location_balance_v1.'));
  }
  if (input.schemaVersion !== WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION) {
    issues.push(issue('invalid_schema_version', '$.schemaVersion', 'schemaVersion deve ser warehouse_location_balance_v1.'));
  }
  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  if (!isValidWarehouseLocationBalanceId(id)) issues.push(issue('invalid_balance_id', '$.id', 'ID do saldo por localização é inválido.'));
  const workspaceId = typeof input.workspaceId === 'string' ? normalizeWorkspaceId(input.workspaceId) : '';
  if (!isValidWorkspaceId(workspaceId)) issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId é inválido.'));
  if (options.expectedWorkspaceId && workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)) {
    issues.push(issue('workspace_mismatch', '$.workspaceId', 'Saldo pertence a outro workspace.'));
  }
  const ug = normalizeUnitUg(typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null);
  if (!isValidUnitUg(ug)) issues.push(issue('invalid_ug', '$.ug', 'UG deve possuir exatamente 6 dígitos.'));
  const materialId = typeof input.materialId === 'string' ? input.materialId.trim().toLowerCase() : '';
  if (!isValidWarehouseMaterialId(materialId)) issues.push(issue('invalid_material_id', '$.materialId', 'materialId canônico é inválido.'));
  if (options.expectedMaterialId && materialId !== options.expectedMaterialId) {
    issues.push(issue('material_mismatch', '$.materialId', 'Saldo pertence a outro material.'));
  }
  const position = validateWarehouseStockPosition(input.position);
  if (!position) issues.push(issue('invalid_position', '$.position', 'Posição física é inválida.'));
  const quantity = normalizeWarehouseQuantity(input.quantity);
  if (quantity === null) issues.push(issue('invalid_quantity', '$.quantity', 'Quantidade por localização é inválida.'));
  const revision = input.revision;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) {
    issues.push(issue('invalid_revision', '$.revision', 'Revisão é inválida.'));
  }
  const lastMovementId = typeof input.lastMovementId === 'string' ? input.lastMovementId.trim().toLowerCase() : '';
  if (!MOVEMENT_ID_PATTERN.test(lastMovementId)) issues.push(issue('invalid_last_movement', '$.lastMovementId', 'lastMovementId é inválido.'));

  if (issues.length || !position || quantity === null || typeof revision !== 'number') return { ok: false, issues };
  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      materialId,
      position,
      quantity,
      revision,
      lastMovementId,
    },
  };
}

export function applyWarehouseLocationDelta(
  base: WarehouseLocationBalance | null,
  input: {
    id: string;
    workspaceId: string;
    ug: string;
    materialId: string;
    position: WarehouseStockPosition;
    quantityDelta: number;
    movementId: string;
    initialQuantity?: number;
  }
): WarehouseLocationBalance {
  const startQuantity = base ? base.quantity : (input.initialQuantity || 0);
  const nextQuantity = addWarehouseQuantities(startQuantity, input.quantityDelta);
  return {
    schemaVersion: WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION,
    id: input.id,
    workspaceId: input.workspaceId,
    ug: input.ug,
    materialId: input.materialId,
    position: input.position,
    quantity: nextQuantity,
    revision: (base?.revision || 0) + 1,
    lastMovementId: input.movementId,
  };
}

export function deriveUnassignedQuantity(total: number, physicalBalances: WarehouseLocationBalance[]): number {
  return physicalBalances
    .filter((item) => item.position.kind !== 'UNASSIGNED')
    .reduce((remaining, item) => addWarehouseQuantities(remaining, -item.quantity), total);
}
