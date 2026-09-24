import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import { isValidWarehouseMaterialId, normalizeWarehouseMaterialUnit, type WarehouseMaterialUnit } from './material';
import {
  isValidWarehouseLocationBalanceId,
  normalizeWarehouseLocationQuantity,
  validateWarehouseStockPosition,
  warehouseStockPositionsEqual,
  type WarehouseStockPosition,
} from './location';

export const WAREHOUSE_MOVEMENT_SCHEMA_VERSION = 'warehouse_movement_v1' as const;
export const WAREHOUSE_BALANCE_SCHEMA_VERSION = 'warehouse_balance_v1' as const;
export const WAREHOUSE_QUANTITY_DECIMALS = 6;
export const WAREHOUSE_MAX_ABSOLUTE_QUANTITY = 1_000_000_000;

export const WAREHOUSE_MOVEMENT_TYPES = [
  'INITIAL_BALANCE',
  'INVOICE_ENTRY',
  'OUTBOUND',
  'TRANSFER',
  'INVENTORY_ADJUSTMENT',
  'INVOICE_CORRECTION',
  'REVERSAL',
] as const;

export type WarehouseMovementType = (typeof WAREHOUSE_MOVEMENT_TYPES)[number];

export const WAREHOUSE_MOVEMENT_SOURCE_ACTIONS = ['ENTRY', 'CORRECTION', 'DELETE'] as const;
export type WarehouseMovementSourceAction = (typeof WAREHOUSE_MOVEMENT_SOURCE_ACTIONS)[number];

export interface WarehouseInvoiceMovementSource {
  kind: 'INVOICE';
  action: WarehouseMovementSourceAction;
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  itemIds: string[];
  supplier: string;
  supplierCnpj: string | null;
  actorUid: string;
}

export interface WarehouseLocationTransferMovementSource {
  kind: 'LOCATION_TRANSFER';
  actorUid: string;
  quantity: number;
  from: WarehouseStockPosition;
  to: WarehouseStockPosition;
  fromBalanceId: string;
  toBalanceId: string;
}

export interface WarehouseExpressOutboundMovementSource {
  kind: 'EXPRESS_OUTBOUND';
  interface: 'BARCODE_SCANNER' | 'MANUAL_SEARCH';
  actorUid: string;
  requestedQuantity: number;
  quantity: number;
  presentation: WarehouseMaterialUnit;
  factorToBaseUnit: number;
  barcodeId: string | null;
  barcode: string | null;
  position: WarehouseStockPosition;
  locationBalanceId: string;
  lotId: string | null;
  lotCode: string | null;
}

export type WarehouseMovementSource =
  | WarehouseInvoiceMovementSource
  | WarehouseLocationTransferMovementSource
  | WarehouseExpressOutboundMovementSource;

export interface WarehouseMovement {
  schemaVersion: typeof WAREHOUSE_MOVEMENT_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  materialId: string;
  type: WarehouseMovementType;
  quantityDelta: number;
  idempotencyKeyHash: string;
  reversesMovementId: string | null;
  note: string | null;
  source: WarehouseMovementSource | null;
}

export interface WarehouseBalance {
  schemaVersion: typeof WAREHOUSE_BALANCE_SCHEMA_VERSION;
  workspaceId: string;
  ug: string;
  materialId: string;
  quantity: number;
  revision: number;
  lastMovementId: string;
}

export interface WarehouseMovementValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface WarehouseMovementValidationOptions {
  expectedWorkspaceId?: string;
  expectedUg?: string | number;
  expectedMaterialId?: string;
}

export type WarehouseMovementValidationResult =
  | { ok: true; data: WarehouseMovement; issues: [] }
  | { ok: false; issues: WarehouseMovementValidationIssue[] };

export type WarehouseBalanceValidationResult =
  | { ok: true; data: WarehouseBalance; issues: [] }
  | { ok: false; issues: WarehouseMovementValidationIssue[] };

type UnknownObject = Record<string, unknown>;

const MOVEMENT_ID_PATTERN = /^mov_[a-f0-9]{64}$/;
const IDEMPOTENCY_HASH_PATTERN = /^[a-f0-9]{64}$/;
const MOVEMENT_FIELDS = new Set([
  'schemaVersion',
  'id',
  'workspaceId',
  'ug',
  'materialId',
  'type',
  'quantityDelta',
  'idempotencyKeyHash',
  'reversesMovementId',
  'note',
  'source',
]);
const INVOICE_MOVEMENT_SOURCE_FIELDS = new Set([
  'kind',
  'action',
  'invoiceRecordKey',
  'invoiceId',
  'empenhoId',
  'itemIds',
  'supplier',
  'supplierCnpj',
  'actorUid',
]);
const TRANSFER_MOVEMENT_SOURCE_FIELDS = new Set([
  'kind',
  'actorUid',
  'quantity',
  'from',
  'to',
  'fromBalanceId',
  'toBalanceId',
]);
const EXPRESS_OUTBOUND_MOVEMENT_SOURCE_FIELDS = new Set([
  'kind',
  'interface',
  'actorUid',
  'requestedQuantity',
  'quantity',
  'presentation',
  'factorToBaseUnit',
  'barcodeId',
  'barcode',
  'position',
  'locationBalanceId',
  'lotId',
  'lotCode',
]);
const BALANCE_FIELDS = new Set([
  'schemaVersion',
  'workspaceId',
  'ug',
  'materialId',
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

function issue(
  code: string,
  path: string,
  message: string
): WarehouseMovementValidationIssue {
  return { code, path, message };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeWarehouseMovementSource(input: unknown): WarehouseMovementSource | null {
  if (input === null || input === undefined || !isPlainObject(input)) return null;

  if (input.kind === 'INVOICE') {
    if (!hasOnlyFields(input, INVOICE_MOVEMENT_SOURCE_FIELDS)) return null;

    const action = typeof input.action === 'string' ? input.action.trim().toUpperCase() : '';
    const invoiceRecordKey = typeof input.invoiceRecordKey === 'string' ? normalizeText(input.invoiceRecordKey) : '';
    const invoiceId = typeof input.invoiceId === 'string' ? normalizeText(input.invoiceId) : '';
    const empenhoId = typeof input.empenhoId === 'string' ? normalizeText(input.empenhoId) : '';
    const actorUid = typeof input.actorUid === 'string' ? normalizeText(input.actorUid) : '';
    const supplier = typeof input.supplier === 'string' ? normalizeText(input.supplier) : '';
    const supplierCnpj = input.supplierCnpj === null || input.supplierCnpj === undefined
      ? null
      : typeof input.supplierCnpj === 'string'
        ? input.supplierCnpj.trim()
        : '';

    if (
      !WAREHOUSE_MOVEMENT_SOURCE_ACTIONS.includes(action as WarehouseMovementSourceAction)
      || !invoiceRecordKey || invoiceRecordKey.length > 160
      || !invoiceId || invoiceId.length > 120
      || !empenhoId || empenhoId.length > 120
      || !actorUid || actorUid.length > 160
      || !supplier || supplier.length > 240
      || (supplierCnpj !== null && !/^[0-9]{14}$/.test(supplierCnpj))
      || !Array.isArray(input.itemIds)
      || input.itemIds.length < 1
      || input.itemIds.length > 32
    ) {
      return null;
    }

    const itemIds: string[] = [];
    for (const value of input.itemIds) {
      if (typeof value !== 'string') return null;
      const normalized = normalizeText(value);
      if (!normalized || normalized.length > 120) return null;
      if (!itemIds.includes(normalized)) itemIds.push(normalized);
    }
    if (itemIds.length < 1) return null;

    return {
      kind: 'INVOICE',
      action: action as WarehouseMovementSourceAction,
      invoiceRecordKey,
      invoiceId,
      empenhoId,
      itemIds,
      supplier,
      supplierCnpj,
      actorUid,
    };
  }

  if (input.kind === 'LOCATION_TRANSFER') {
    if (!hasOnlyFields(input, TRANSFER_MOVEMENT_SOURCE_FIELDS)) return null;
    const actorUid = typeof input.actorUid === 'string' ? normalizeText(input.actorUid) : '';
    const quantity = normalizeWarehouseLocationQuantity(input.quantity);
    const from = validateWarehouseStockPosition(input.from);
    const to = validateWarehouseStockPosition(input.to);
    const fromBalanceId = typeof input.fromBalanceId === 'string'
      ? input.fromBalanceId.trim().toLowerCase()
      : '';
    const toBalanceId = typeof input.toBalanceId === 'string'
      ? input.toBalanceId.trim().toLowerCase()
      : '';

    if (
      !actorUid || actorUid.length > 160
      || quantity === null || quantity <= 0
      || !from || !to || warehouseStockPositionsEqual(from, to)
      || !isValidWarehouseLocationBalanceId(fromBalanceId)
      || !isValidWarehouseLocationBalanceId(toBalanceId)
      || fromBalanceId === toBalanceId
    ) {
      return null;
    }

    return {
      kind: 'LOCATION_TRANSFER',
      actorUid,
      quantity,
      from,
      to,
      fromBalanceId,
      toBalanceId,
    };
  }

  if (input.kind === 'EXPRESS_OUTBOUND') {
    if (!hasOnlyFields(input, EXPRESS_OUTBOUND_MOVEMENT_SOURCE_FIELDS)) return null;
    const actorUid = typeof input.actorUid === 'string' ? normalizeText(input.actorUid) : '';
    const interfaceName = typeof input.interface === 'string'
      ? input.interface.trim().toUpperCase()
      : '';
    const requestedQuantity = normalizeWarehouseQuantity(input.requestedQuantity);
    const quantity = normalizeWarehouseQuantity(input.quantity);
    const factorToBaseUnit = normalizeWarehouseQuantity(input.factorToBaseUnit);
    const presentation = normalizeWarehouseMaterialUnit(input.presentation);
    const position = validateWarehouseStockPosition(input.position);
    const locationBalanceId = typeof input.locationBalanceId === 'string'
      ? input.locationBalanceId.trim().toLowerCase()
      : '';
    const barcodeId = input.barcodeId === null
      ? null
      : typeof input.barcodeId === 'string'
        ? input.barcodeId.trim().toLowerCase()
        : '';
    const barcode = input.barcode === null
      ? null
      : typeof input.barcode === 'string'
        ? input.barcode.trim()
        : '';
    const lotId = input.lotId === null
      ? null
      : typeof input.lotId === 'string'
        ? input.lotId.trim().toLowerCase()
        : '';
    const lotCode = input.lotCode === null
      ? null
      : typeof input.lotCode === 'string'
        ? normalizeText(input.lotCode)
        : '';
    const expectedQuantity = requestedQuantity !== null && factorToBaseUnit !== null
      ? normalizeWarehouseQuantity(requestedQuantity * factorToBaseUnit)
      : null;

    if (
      !actorUid || actorUid.length > 160
      || !['BARCODE_SCANNER', 'MANUAL_SEARCH'].includes(interfaceName)
      || requestedQuantity === null || requestedQuantity <= 0
      || quantity === null || quantity <= 0
      || factorToBaseUnit === null || factorToBaseUnit <= 0
      || expectedQuantity === null || expectedQuantity !== quantity
      || !presentation
      || !position
      || !isValidWarehouseLocationBalanceId(locationBalanceId)
      || (lotId !== null && !/^lot_[a-f0-9]{32}$/.test(lotId))
      || (lotCode !== null && (!lotCode || lotCode.length > 80))
      || ((lotId === null) !== (lotCode === null))
    ) {
      return null;
    }

    if (
      interfaceName === 'BARCODE_SCANNER'
      && (
        typeof barcodeId !== 'string'
        || !/^bar_[a-f0-9]{64}$/.test(barcodeId)
        || typeof barcode !== 'string'
        || !barcode
        || barcode.length > 128
      )
    ) {
      return null;
    }
    if (
      interfaceName === 'MANUAL_SEARCH'
      && (barcodeId !== null || barcode !== null)
    ) {
      return null;
    }

    return {
      kind: 'EXPRESS_OUTBOUND',
      interface: interfaceName as 'BARCODE_SCANNER' | 'MANUAL_SEARCH',
      actorUid,
      requestedQuantity,
      quantity,
      presentation,
      factorToBaseUnit,
      barcodeId,
      barcode,
      position,
      locationBalanceId,
      lotId,
      lotCode,
    };
  }

  return null;
}

export function normalizeWarehouseIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function normalizeWarehouseQuantity(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (Math.abs(value) > WAREHOUSE_MAX_ABSOLUTE_QUANTITY) return null;

  const scale = 10 ** WAREHOUSE_QUANTITY_DECIMALS;
  const scaled = Math.round(value * scale);
  if (!Number.isSafeInteger(scaled)) return null;

  const normalized = scaled / scale;
  if (Math.abs(normalized - value) > 1e-9) return null;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function addWarehouseQuantities(left: number, right: number): number {
  const normalizedLeft = normalizeWarehouseQuantity(left);
  const normalizedRight = normalizeWarehouseQuantity(right);
  if (normalizedLeft === null || normalizedRight === null) {
    throw new Error('WAREHOUSE_INVALID_QUANTITY');
  }

  const result = normalizeWarehouseQuantity(normalizedLeft + normalizedRight);
  if (result === null) {
    throw new Error('WAREHOUSE_QUANTITY_OVERFLOW');
  }
  return result;
}

export function isValidWarehouseMovementId(value: unknown): value is string {
  return typeof value === 'string' && MOVEMENT_ID_PATTERN.test(value);
}

export function warehouseMovementDeltaMatchesType(
  type: WarehouseMovementType,
  quantityDelta: number
): boolean {
  if (type === 'INITIAL_BALANCE' || type === 'INVOICE_ENTRY') {
    return quantityDelta > 0;
  }
  if (type === 'OUTBOUND') {
    return quantityDelta < 0;
  }
  if (type === 'TRANSFER') {
    return quantityDelta === 0;
  }
  return quantityDelta !== 0;
}

export async function hashWarehouseMovementIdempotency(
  workspaceId: string,
  idempotencyKey: string
): Promise<string> {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const normalizedKey = normalizeWarehouseIdempotencyKey(idempotencyKey);

  if (!isValidWorkspaceId(normalizedWorkspaceId) || !normalizedKey) {
    throw new Error('WAREHOUSE_INVALID_IDEMPOTENCY_KEY');
  }

  const payload = new TextEncoder().encode(
    normalizedWorkspaceId + '\n' + normalizedKey
  );
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createWarehouseMovementId(
  workspaceId: string,
  idempotencyKey: string
): Promise<string> {
  return 'mov_' + await hashWarehouseMovementIdempotency(workspaceId, idempotencyKey);
}

export function validateWarehouseMovement(
  input: unknown,
  options: WarehouseMovementValidationOptions = {}
): WarehouseMovementValidationResult {
  const issues: WarehouseMovementValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: [issue('invalid_root', '$', 'Movimento deve ser um objeto.')],
    };
  }

  if (!hasOnlyFields(input, MOVEMENT_FIELDS)) {
    issues.push(
      issue(
        'unexpected_field',
        '$',
        'Movimento contém campos fora do contrato warehouse_movement_v1.'
      )
    );
  }

  if (input.schemaVersion !== WAREHOUSE_MOVEMENT_SCHEMA_VERSION) {
    issues.push(
      issue(
        'invalid_schema_version',
        '$.schemaVersion',
        'schemaVersion deve ser warehouse_movement_v1.'
      )
    );
  }

  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  if (!isValidWarehouseMovementId(id)) {
    issues.push(
      issue(
        'invalid_movement_id',
        '$.id',
        'ID do movimento deve seguir mov_<sha256>.'
      )
    );
  }

  const workspaceId =
    typeof input.workspaceId === 'string'
      ? normalizeWorkspaceId(input.workspaceId)
      : '';
  if (!isValidWorkspaceId(workspaceId)) {
    issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId é inválido.'));
  }
  if (
    options.expectedWorkspaceId &&
    workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)
  ) {
    issues.push(
      issue('workspace_mismatch', '$.workspaceId', 'Movimento pertence a outro workspace.')
    );
  }

  const ug = normalizeUnitUg(
    typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null
  );
  if (!isValidUnitUg(ug)) {
    issues.push(issue('invalid_ug', '$.ug', 'UG deve possuir exatamente 6 dígitos.'));
  }
  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push(issue('ug_mismatch', '$.ug', 'Movimento pertence a outra UG.'));
  }

  const materialId =
    typeof input.materialId === 'string' ? input.materialId.trim().toLowerCase() : '';
  if (!isValidWarehouseMaterialId(materialId)) {
    issues.push(
      issue('invalid_material_id', '$.materialId', 'materialId canônico é inválido.')
    );
  }
  if (options.expectedMaterialId && materialId !== options.expectedMaterialId) {
    issues.push(
      issue('material_mismatch', '$.materialId', 'Movimento pertence a outro material.')
    );
  }

  const type =
    typeof input.type === 'string' ? input.type.trim().toUpperCase() : '';
  if (!WAREHOUSE_MOVEMENT_TYPES.includes(type as WarehouseMovementType)) {
    issues.push(issue('invalid_type', '$.type', 'Tipo de movimentação é inválido.'));
  }

  const quantityDelta = normalizeWarehouseQuantity(input.quantityDelta);
  if (quantityDelta === null) {
    issues.push(
      issue(
        'invalid_quantity_delta',
        '$.quantityDelta',
        'Variação deve ser finita, ter até 6 casas e respeitar o limite operacional.'
      )
    );
  } else if (
    WAREHOUSE_MOVEMENT_TYPES.includes(type as WarehouseMovementType) &&
    !warehouseMovementDeltaMatchesType(type as WarehouseMovementType, quantityDelta)
  ) {
    issues.push(
      issue(
        'invalid_quantity_direction',
        '$.quantityDelta',
        'Sinal/valor da movimentação não é compatível com o tipo.'
      )
    );
  }

  const idempotencyKeyHash =
    typeof input.idempotencyKeyHash === 'string'
      ? input.idempotencyKeyHash.trim().toLowerCase()
      : '';
  if (!IDEMPOTENCY_HASH_PATTERN.test(idempotencyKeyHash)) {
    issues.push(
      issue(
        'invalid_idempotency_hash',
        '$.idempotencyKeyHash',
        'Hash de idempotência deve ser SHA-256 hexadecimal.'
      )
    );
  }
  if (isValidWarehouseMovementId(id) && id !== 'mov_' + idempotencyKeyHash) {
    issues.push(
      issue(
        'movement_idempotency_mismatch',
        '$.id',
        'ID do movimento deve ser derivado do hash de idempotência.'
      )
    );
  }

  let reversesMovementId: string | null = null;
  if (input.reversesMovementId !== null && input.reversesMovementId !== undefined) {
    if (!isValidWarehouseMovementId(input.reversesMovementId)) {
      issues.push(
        issue(
          'invalid_reversal_reference',
          '$.reversesMovementId',
          'Referência de reversão deve apontar para um movimento canônico.'
        )
      );
    } else {
      reversesMovementId = input.reversesMovementId;
    }
  }

  if (type === 'REVERSAL' && !reversesMovementId) {
    issues.push(
      issue(
        'missing_reversal_reference',
        '$.reversesMovementId',
        'REVERSAL exige referência explícita ao movimento revertido.'
      )
    );
  }
  if (type !== 'REVERSAL' && reversesMovementId) {
    issues.push(
      issue(
        'unexpected_reversal_reference',
        '$.reversesMovementId',
        'Somente REVERSAL pode apontar para outro movimento.'
      )
    );
  }
  if (reversesMovementId && reversesMovementId === id) {
    issues.push(
      issue(
        'self_reversal',
        '$.reversesMovementId',
        'Um movimento não pode reverter a si próprio.'
      )
    );
  }

  let note: string | null = null;
  if (input.note !== null && input.note !== undefined) {
    if (typeof input.note !== 'string') {
      issues.push(issue('invalid_note', '$.note', 'Observação deve ser texto.'));
    } else {
      const normalized = normalizeText(input.note);
      if (!normalized || normalized.length > 240) {
        issues.push(
          issue(
            'invalid_note',
            '$.note',
            'Observação deve possuir entre 1 e 240 caracteres.'
          )
        );
      } else {
        note = normalized;
      }
    }
  }

  const source = normalizeWarehouseMovementSource(input.source);
  if (input.source !== null && input.source !== undefined && !source) {
    issues.push(
      issue(
        'invalid_source',
        '$.source',
        'Origem estruturada da movimentação é inválida.'
      )
    );
  }
  if (
    source?.kind === 'INVOICE'
    && !['INVOICE_ENTRY', 'INVOICE_CORRECTION'].includes(type)
  ) {
    issues.push(
      issue(
        'invalid_source_type',
        '$.source',
        'Origem INVOICE só pode acompanhar entrada ou correção de Nota Fiscal.'
      )
    );
  }
  if (source?.kind === 'LOCATION_TRANSFER' && type !== 'TRANSFER') {
    issues.push(
      issue(
        'invalid_source_type',
        '$.source',
        'Origem LOCATION_TRANSFER só pode acompanhar movimento TRANSFER.'
      )
    );
  }
  if (source?.kind === 'EXPRESS_OUTBOUND' && type !== 'OUTBOUND') {
    issues.push(
      issue(
        'invalid_source_type',
        '$.source',
        'Origem EXPRESS_OUTBOUND só pode acompanhar movimento OUTBOUND.'
      )
    );
  }
  if (
    source?.kind === 'EXPRESS_OUTBOUND'
    && quantityDelta !== null
    && source.quantity !== -quantityDelta
  ) {
    issues.push(
      issue(
        'outbound_quantity_mismatch',
        '$.source.quantity',
        'Quantidade auditável da saída deve corresponder ao delta do ledger.'
      )
    );
  }

  if (issues.length || quantityDelta === null) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      materialId,
      type: type as WarehouseMovementType,
      quantityDelta,
      idempotencyKeyHash,
      reversesMovementId,
      note,
      source,
    },
  };
}

export function validateWarehouseBalance(
  input: unknown,
  options: WarehouseMovementValidationOptions = {}
): WarehouseBalanceValidationResult {
  const issues: WarehouseMovementValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: [issue('invalid_root', '$', 'Saldo deve ser um objeto.')],
    };
  }

  if (!hasOnlyFields(input, BALANCE_FIELDS)) {
    issues.push(
      issue(
        'unexpected_field',
        '$',
        'Saldo contém campos fora do contrato warehouse_balance_v1.'
      )
    );
  }

  if (input.schemaVersion !== WAREHOUSE_BALANCE_SCHEMA_VERSION) {
    issues.push(
      issue(
        'invalid_schema_version',
        '$.schemaVersion',
        'schemaVersion deve ser warehouse_balance_v1.'
      )
    );
  }

  const workspaceId =
    typeof input.workspaceId === 'string'
      ? normalizeWorkspaceId(input.workspaceId)
      : '';
  if (!isValidWorkspaceId(workspaceId)) {
    issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId é inválido.'));
  }
  if (
    options.expectedWorkspaceId &&
    workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)
  ) {
    issues.push(
      issue('workspace_mismatch', '$.workspaceId', 'Saldo pertence a outro workspace.')
    );
  }

  const ug = normalizeUnitUg(
    typeof input.ug === 'string' || typeof input.ug === 'number' ? input.ug : null
  );
  if (!isValidUnitUg(ug)) {
    issues.push(issue('invalid_ug', '$.ug', 'UG deve possuir exatamente 6 dígitos.'));
  }
  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push(issue('ug_mismatch', '$.ug', 'Saldo pertence a outra UG.'));
  }

  const materialId =
    typeof input.materialId === 'string' ? input.materialId.trim().toLowerCase() : '';
  if (!isValidWarehouseMaterialId(materialId)) {
    issues.push(
      issue('invalid_material_id', '$.materialId', 'materialId canônico é inválido.')
    );
  }
  if (options.expectedMaterialId && materialId !== options.expectedMaterialId) {
    issues.push(
      issue('material_mismatch', '$.materialId', 'Saldo pertence a outro material.')
    );
  }

  const quantity = normalizeWarehouseQuantity(input.quantity);
  if (quantity === null) {
    issues.push(issue('invalid_quantity', '$.quantity', 'Quantidade agregada é inválida.'));
  }

  const revision = input.revision;
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    revision > 9_007_199_254_740_000
  ) {
    issues.push(issue('invalid_revision', '$.revision', 'Revisão do saldo é inválida.'));
  }

  const lastMovementId =
    typeof input.lastMovementId === 'string'
      ? input.lastMovementId.trim().toLowerCase()
      : '';
  if (!isValidWarehouseMovementId(lastMovementId)) {
    issues.push(
      issue(
        'invalid_last_movement',
        '$.lastMovementId',
        'Saldo deve apontar para o último movimento canônico.'
      )
    );
  }

  if (issues.length || quantity === null || typeof revision !== 'number') {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_BALANCE_SCHEMA_VERSION,
      workspaceId,
      ug,
      materialId,
      quantity,
      revision,
      lastMovementId,
    },
  };
}

export function applyWarehouseMovementToBalance(
  movement: WarehouseMovement,
  currentBalance: WarehouseBalance | null
): WarehouseBalance {
  if (
    currentBalance &&
    (
      currentBalance.workspaceId !== movement.workspaceId ||
      currentBalance.ug !== movement.ug ||
      currentBalance.materialId !== movement.materialId
    )
  ) {
    throw new Error('WAREHOUSE_BALANCE_SCOPE_MISMATCH');
  }

  return {
    schemaVersion: WAREHOUSE_BALANCE_SCHEMA_VERSION,
    workspaceId: movement.workspaceId,
    ug: movement.ug,
    materialId: movement.materialId,
    quantity: addWarehouseQuantities(currentBalance?.quantity || 0, movement.quantityDelta),
    revision: (currentBalance?.revision || 0) + 1,
    lastMovementId: movement.id,
  };
}

export function warehouseMovementMatchesReplay(
  existing: WarehouseMovement,
  candidate: WarehouseMovement
): boolean {
  return existing.id === candidate.id
    && existing.schemaVersion === candidate.schemaVersion
    && existing.workspaceId === candidate.workspaceId
    && existing.ug === candidate.ug
    && existing.materialId === candidate.materialId
    && existing.type === candidate.type
    && existing.quantityDelta === candidate.quantityDelta
    && existing.idempotencyKeyHash === candidate.idempotencyKeyHash
    && existing.reversesMovementId === candidate.reversesMovementId
    && existing.note === candidate.note
    && JSON.stringify(existing.source) === JSON.stringify(candidate.source);
}
