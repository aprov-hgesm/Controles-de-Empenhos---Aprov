import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import {
  normalizeWarehouseMaterialUnit,
  warehouseMaterialUnitKey,
  type WarehouseMaterial,
  type WarehouseMaterialUnit,
} from './material';
import { normalizeWarehouseQuantity } from './movement';

export const WAREHOUSE_BARCODE_SCHEMA_VERSION = 'warehouse_barcode_v1' as const;
export const WAREHOUSE_BARCODE_STATUSES = ['active', 'inactive'] as const;
export type WarehouseBarcodeStatus = (typeof WAREHOUSE_BARCODE_STATUSES)[number];

export interface WarehouseBarcodeAssociation {
  schemaVersion: typeof WAREHOUSE_BARCODE_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  materialId: string;
  barcode: string;
  presentation: WarehouseMaterialUnit;
  factorToBaseUnit: number;
  status: WarehouseBarcodeStatus;
  createdBy: string;
  updatedBy: string;
}

export interface WarehouseBarcodeValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface WarehouseBarcodeValidationOptions {
  expectedWorkspaceId?: string;
  expectedUg?: string | number;
  expectedMaterialId?: string;
}

export type WarehouseBarcodeValidationResult =
  | { ok: true; data: WarehouseBarcodeAssociation; issues: [] }
  | { ok: false; issues: WarehouseBarcodeValidationIssue[] };

type UnknownObject = Record<string, unknown>;

const BARCODE_ID_PATTERN = /^bar_[a-f0-9]{64}$/;
const BARCODE_FIELDS = new Set([
  'schemaVersion',
  'id',
  'workspaceId',
  'ug',
  'materialId',
  'barcode',
  'presentation',
  'factorToBaseUnit',
  'status',
  'createdBy',
  'updatedBy',
]);

function isPlainObject(value: unknown): value is UnknownObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyFields(value: UnknownObject, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function issue(code: string, path: string, message: string): WarehouseBarcodeValidationIssue {
  return { code, path, message };
}

export function normalizeWarehouseBarcode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > 128
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function isValidWarehouseBarcodeId(value: unknown): value is string {
  return typeof value === 'string' && BARCODE_ID_PATTERN.test(value);
}

export async function createWarehouseBarcodeId(
  workspaceId: string,
  barcode: string
): Promise<string> {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const normalizedBarcode = normalizeWarehouseBarcode(barcode);
  if (!isValidWorkspaceId(normalizedWorkspaceId) || !normalizedBarcode) {
    throw new Error('WAREHOUSE_INVALID_BARCODE_IDENTITY');
  }
  const payload = new TextEncoder().encode(
    normalizedWorkspaceId + '\n' + normalizedBarcode
  );
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return 'bar_' + Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function warehousePresentationFactor(
  material: WarehouseMaterial,
  presentation: WarehouseMaterialUnit
): number | null {
  const normalized = normalizeWarehouseMaterialUnit(presentation);
  if (!normalized) return null;
  const key = warehouseMaterialUnitKey(normalized);
  if (key === warehouseMaterialUnitKey(material.unit)) return 1;
  const conversion = material.conversions.find(
    (candidate) => warehouseMaterialUnitKey(candidate.presentation) === key
  );
  return conversion?.factorToBaseUnit ?? null;
}

export function barcodeAssociationMatchesMaterial(
  association: WarehouseBarcodeAssociation,
  material: WarehouseMaterial
): boolean {
  const expectedFactor = warehousePresentationFactor(material, association.presentation);
  return association.materialId === material.id
    && association.workspaceId === material.workspaceId
    && association.ug === material.ug
    && expectedFactor !== null
    && expectedFactor === association.factorToBaseUnit;
}

export function convertWarehouseBarcodeQuantityToBase(
  association: WarehouseBarcodeAssociation,
  requestedQuantity: number
): number {
  const requested = normalizeWarehouseQuantity(requestedQuantity);
  const factor = normalizeWarehouseQuantity(association.factorToBaseUnit);
  if (requested === null || requested <= 0 || factor === null || factor <= 0) {
    throw new Error('WAREHOUSE_INVALID_BARCODE_QUANTITY');
  }
  const converted = normalizeWarehouseQuantity(requested * factor);
  if (converted === null || converted <= 0) {
    throw new Error('WAREHOUSE_INVALID_BARCODE_CONVERSION');
  }
  return converted;
}

export function findWarehouseBarcodeAssociation(
  associations: WarehouseBarcodeAssociation[],
  barcode: string,
  options: { activeOnly?: boolean } = { activeOnly: true }
): WarehouseBarcodeAssociation | null {
  const normalized = normalizeWarehouseBarcode(barcode);
  if (!normalized) return null;
  return associations.find((association) =>
    association.barcode === normalized
    && (!options.activeOnly || association.status === 'active')
  ) || null;
}

export function validateWarehouseBarcodeAssociation(
  input: unknown,
  options: WarehouseBarcodeValidationOptions = {}
): WarehouseBarcodeValidationResult {
  const issues: WarehouseBarcodeValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, issues: [issue('invalid_root', '$', 'Barcode deve ser um objeto.')] };
  }
  if (!hasOnlyFields(input, BARCODE_FIELDS)) {
    issues.push(issue('unexpected_field', '$', 'Barcode contém campos fora do contrato warehouse_barcode_v1.'));
  }
  if (input.schemaVersion !== WAREHOUSE_BARCODE_SCHEMA_VERSION) {
    issues.push(issue('invalid_schema_version', '$.schemaVersion', 'schemaVersion deve ser warehouse_barcode_v1.'));
  }

  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  if (!isValidWarehouseBarcodeId(id)) {
    issues.push(issue('invalid_barcode_id', '$.id', 'ID técnico do barcode é inválido.'));
  }

  const workspaceId = typeof input.workspaceId === 'string'
    ? normalizeWorkspaceId(input.workspaceId)
    : '';
  if (!isValidWorkspaceId(workspaceId)) {
    issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId é inválido.'));
  }
  if (
    options.expectedWorkspaceId
    && workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)
  ) {
    issues.push(issue('workspace_mismatch', '$.workspaceId', 'Barcode pertence a outro workspace.'));
  }

  const ug = normalizeUnitUg(
    typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null
  );
  if (!isValidUnitUg(ug)) {
    issues.push(issue('invalid_ug', '$.ug', 'UG deve possuir exatamente 6 dígitos.'));
  }
  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push(issue('ug_mismatch', '$.ug', 'Barcode pertence a outra UG.'));
  }

  const materialId = typeof input.materialId === 'string'
    ? input.materialId.trim().toLowerCase()
    : '';
  if (!/^mat_[a-f0-9]{32}$/.test(materialId)) {
    issues.push(issue('invalid_material_id', '$.materialId', 'materialId canônico é inválido.'));
  }
  if (
    options.expectedMaterialId
    && materialId !== options.expectedMaterialId.trim().toLowerCase()
  ) {
    issues.push(issue('material_mismatch', '$.materialId', 'Barcode pertence a outro material.'));
  }

  const barcode = normalizeWarehouseBarcode(input.barcode);
  if (!barcode) {
    issues.push(issue('invalid_barcode', '$.barcode', 'Código de barras deve possuir entre 1 e 128 caracteres válidos.'));
  }

  const presentation = normalizeWarehouseMaterialUnit(input.presentation);
  if (!presentation) {
    issues.push(issue('invalid_presentation', '$.presentation', 'Apresentação do barcode é inválida.'));
  }

  const factorToBaseUnit = normalizeWarehouseQuantity(input.factorToBaseUnit);
  if (factorToBaseUnit === null || factorToBaseUnit <= 0) {
    issues.push(issue('invalid_factor', '$.factorToBaseUnit', 'Fator para unidade-base deve ser positivo e possuir até 6 casas.'));
  }

  const status = typeof input.status === 'string' ? input.status.trim().toLowerCase() : '';
  if (!WAREHOUSE_BARCODE_STATUSES.includes(status as WarehouseBarcodeStatus)) {
    issues.push(issue('invalid_status', '$.status', 'Status deve ser active ou inactive.'));
  }

  const createdBy = typeof input.createdBy === 'string' ? input.createdBy.trim() : '';
  const updatedBy = typeof input.updatedBy === 'string' ? input.updatedBy.trim() : '';
  if (!createdBy || createdBy.length > 160) {
    issues.push(issue('invalid_created_by', '$.createdBy', 'createdBy é inválido.'));
  }
  if (!updatedBy || updatedBy.length > 160) {
    issues.push(issue('invalid_updated_by', '$.updatedBy', 'updatedBy é inválido.'));
  }

  if (issues.length || !barcode || !presentation || factorToBaseUnit === null) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_BARCODE_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      materialId,
      barcode,
      presentation,
      factorToBaseUnit,
      status: status as WarehouseBarcodeStatus,
      createdBy,
      updatedBy,
    },
  };
}
