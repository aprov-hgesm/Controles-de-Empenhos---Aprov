import {
  isValidUnitUg,
  isValidWorkspaceId,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import { isValidWarehouseMaterialId } from './material';
import {
  deriveUnassignedQuantity,
  normalizeWarehouseLocationQuantity,
  validateWarehouseStockPosition,
  warehouseStockPositionKey,
  type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from './location';

export const WAREHOUSE_LOT_SCHEMA_VERSION = 'warehouse_lot_v1' as const;
export const WAREHOUSE_EXPIRY_WARNING_DAYS = 30;

export const WAREHOUSE_LOT_STATUSES = ['active', 'inactive'] as const;
export type WarehouseLotStatus = (typeof WAREHOUSE_LOT_STATUSES)[number];

export const WAREHOUSE_LOT_ORIGIN_KINDS = [
  'INVOICE',
  'MANUAL_ENRICHMENT',
  'LEGACY',
] as const;
export type WarehouseLotOriginKind =
  (typeof WAREHOUSE_LOT_ORIGIN_KINDS)[number];

export interface WarehouseLotOrigin {
  kind: WarehouseLotOriginKind;
  movementId: string | null;
  invoiceRecordKey: string | null;
  invoiceId: string | null;
  supplier: string | null;
  supplierCnpj: string | null;
}

export interface WarehouseLot {
  schemaVersion: typeof WAREHOUSE_LOT_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  materialId: string;
  code: string;
  expiresOn: string | null;
  /**
   * Atribuição logística ao lote. Não é saldo contábil e jamais altera
   * warehouse_balance_v1 ou warehouse_location_balance_v1 por si só.
   */
  quantity: number;
  position: WarehouseStockPosition;
  origin: WarehouseLotOrigin;
  status: WarehouseLotStatus;
  createdBy: string;
  updatedBy: string;
}

export interface WarehouseLotValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface WarehouseLotValidationOptions {
  expectedWorkspaceId?: string;
  expectedUg?: string | number;
  expectedMaterialId?: string;
}

export type WarehouseLotValidationResult =
  | { ok: true; data: WarehouseLot; issues: [] }
  | { ok: false; issues: WarehouseLotValidationIssue[] };

export type WarehouseLotExpiryState =
  | 'VALID'
  | 'NEAR_EXPIRY'
  | 'EXPIRED'
  | 'NO_EXPIRY'
  | 'DEPLETED'
  | 'INACTIVE';

export interface WarehouseLogisticsPendency {
  code:
    | 'UNASSIGNED_STOCK'
    | 'LOT_INFORMATION_MISSING'
    | 'LOT_EXPIRY_MISSING'
    | 'EXPIRED_LOT'
    | 'PHYSICAL_BALANCE_MISMATCH'
    | 'LOT_ATTRIBUTION_EXCEEDS_STOCK'
    | 'ORIGIN_LINK_INCOMPLETE';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
}

type UnknownObject = Record<string, unknown>;

const LOT_ID_PATTERN = /^lot_[a-f0-9]{32}$/;
const MOVEMENT_ID_PATTERN = /^mov_[a-f0-9]{64}$/;
const LOT_FIELDS = new Set([
  'schemaVersion',
  'id',
  'workspaceId',
  'ug',
  'materialId',
  'code',
  'expiresOn',
  'quantity',
  'position',
  'origin',
  'status',
  'createdBy',
  'updatedBy',
]);
const ORIGIN_FIELDS = new Set([
  'kind',
  'movementId',
  'invoiceRecordKey',
  'invoiceId',
  'supplier',
  'supplierCnpj',
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
): WarehouseLotValidationIssue {
  return { code, path, message };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableText(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = normalizeText(value);
  if (!normalized || normalized.length > maxLength) return undefined;
  return normalized;
}

function randomHex32(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').toLowerCase();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function createWarehouseLotId(): string {
  return 'lot_' + randomHex32();
}

export function isValidWarehouseLotId(value: unknown): value is string {
  return typeof value === 'string' && LOT_ID_PATTERN.test(value);
}

export function normalizeWarehouseLotCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeText(value);
  if (!normalized || normalized.length > 80) return null;
  return normalized;
}

export function normalizeWarehouseExpiryDate(
  value: unknown
): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return normalized;
}

export function normalizeWarehouseLotOrigin(
  input: unknown
): WarehouseLotOrigin | null {
  if (!isPlainObject(input) || !hasOnlyFields(input, ORIGIN_FIELDS)) return null;

  const kind = typeof input.kind === 'string'
    ? input.kind.trim().toUpperCase()
    : '';
  if (!WAREHOUSE_LOT_ORIGIN_KINDS.includes(kind as WarehouseLotOriginKind)) {
    return null;
  }

  const movementId = normalizeNullableText(input.movementId, 80);
  const invoiceRecordKey = normalizeNullableText(input.invoiceRecordKey, 180);
  const invoiceId = normalizeNullableText(input.invoiceId, 120);
  const supplier = normalizeNullableText(input.supplier, 240);
  const supplierCnpj = normalizeNullableText(input.supplierCnpj, 24);
  if (
    movementId === undefined
    || invoiceRecordKey === undefined
    || invoiceId === undefined
    || supplier === undefined
    || supplierCnpj === undefined
  ) {
    return null;
  }

  if (movementId !== null && !MOVEMENT_ID_PATTERN.test(movementId)) return null;

  if (
    kind === 'INVOICE'
    && (!movementId || !invoiceRecordKey || !invoiceId || !supplier)
  ) {
    return null;
  }

  if (
    kind !== 'INVOICE'
    && (invoiceRecordKey !== null || invoiceId !== null || supplier !== null || supplierCnpj !== null)
  ) {
    return null;
  }

  return {
    kind: kind as WarehouseLotOriginKind,
    movementId,
    invoiceRecordKey,
    invoiceId,
    supplier,
    supplierCnpj,
  };
}

export function validateWarehouseLot(
  input: unknown,
  options: WarehouseLotValidationOptions = {}
): WarehouseLotValidationResult {
  const issues: WarehouseLotValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: [issue('invalid_root', '$', 'Lote deve ser um objeto.')],
    };
  }

  if (!hasOnlyFields(input, LOT_FIELDS)) {
    issues.push(
      issue(
        'unexpected_field',
        '$',
        'Lote contém campos fora do contrato warehouse_lot_v1.'
      )
    );
  }

  if (input.schemaVersion !== WAREHOUSE_LOT_SCHEMA_VERSION) {
    issues.push(
      issue(
        'invalid_schema_version',
        '$.schemaVersion',
        'schemaVersion deve ser warehouse_lot_v1.'
      )
    );
  }

  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : '';
  if (!isValidWarehouseLotId(id)) {
    issues.push(issue('invalid_lot_id', '$.id', 'ID técnico do lote é inválido.'));
  }

  const workspaceId =
    typeof input.workspaceId === 'string'
      ? normalizeWorkspaceId(input.workspaceId)
      : '';
  if (!isValidWorkspaceId(workspaceId)) {
    issues.push(issue('invalid_workspace', '$.workspaceId', 'workspaceId é inválido.'));
  }
  if (
    options.expectedWorkspaceId
    && workspaceId !== normalizeWorkspaceId(options.expectedWorkspaceId)
  ) {
    issues.push(
      issue(
        'workspace_mismatch',
        '$.workspaceId',
        'Lote não pertence ao workspace esperado.'
      )
    );
  }

  const ug = normalizeUnitUg(
    typeof input.ug === 'string' || typeof input.ug === 'number'
      ? input.ug
      : null
  );
  if (!isValidUnitUg(ug)) {
    issues.push(issue('invalid_ug', '$.ug', 'UG deve possuir exatamente 6 dígitos.'));
  }
  if (options.expectedUg && ug !== normalizeUnitUg(options.expectedUg)) {
    issues.push(issue('ug_mismatch', '$.ug', 'Lote não pertence à UG esperada.'));
  }

  const materialId =
    typeof input.materialId === 'string'
      ? input.materialId.trim().toLowerCase()
      : '';
  if (!isValidWarehouseMaterialId(materialId)) {
    issues.push(
      issue('invalid_material_id', '$.materialId', 'materialId canônico é inválido.')
    );
  }
  if (
    options.expectedMaterialId
    && materialId !== options.expectedMaterialId.trim().toLowerCase()
  ) {
    issues.push(
      issue(
        'material_mismatch',
        '$.materialId',
        'Lote não pertence ao material esperado.'
      )
    );
  }

  const code = normalizeWarehouseLotCode(input.code);
  if (!code) {
    issues.push(
      issue('invalid_lot_code', '$.code', 'Código do lote deve possuir de 1 a 80 caracteres.')
    );
  }

  const expiresOn = normalizeWarehouseExpiryDate(input.expiresOn);
  if (expiresOn === undefined) {
    issues.push(
      issue(
        'invalid_expiry',
        '$.expiresOn',
        'Validade deve usar uma data real no formato YYYY-MM-DD ou ser nula.'
      )
    );
  }

  const quantity = normalizeWarehouseLocationQuantity(input.quantity);
  if (quantity === null || quantity < 0) {
    issues.push(
      issue(
        'invalid_quantity',
        '$.quantity',
        'Quantidade rastreável deve ser não negativa e possuir até seis casas decimais.'
      )
    );
  }

  const position = validateWarehouseStockPosition(input.position);
  if (!position) {
    issues.push(
      issue(
        'invalid_position',
        '$.position',
        'Posição física do lote é inválida.'
      )
    );
  }

  const origin = normalizeWarehouseLotOrigin(input.origin);
  if (!origin) {
    issues.push(
      issue(
        'invalid_origin',
        '$.origin',
        'Origem logística do lote é inválida.'
      )
    );
  }

  const status =
    typeof input.status === 'string' ? input.status.trim().toLowerCase() : '';
  if (!WAREHOUSE_LOT_STATUSES.includes(status as WarehouseLotStatus)) {
    issues.push(
      issue('invalid_status', '$.status', 'Status deve ser active ou inactive.')
    );
  }

  const createdBy = normalizeNullableText(input.createdBy, 160);
  const updatedBy = normalizeNullableText(input.updatedBy, 160);
  if (!createdBy) {
    issues.push(issue('invalid_created_by', '$.createdBy', 'createdBy é obrigatório.'));
  }
  if (!updatedBy) {
    issues.push(issue('invalid_updated_by', '$.updatedBy', 'updatedBy é obrigatório.'));
  }

  if (
    issues.length
    || !code
    || expiresOn === undefined
    || quantity === null
    || !position
    || !origin
    || !createdBy
    || !updatedBy
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    data: {
      schemaVersion: WAREHOUSE_LOT_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      materialId,
      code,
      expiresOn,
      quantity,
      position,
      origin,
      status: status as WarehouseLotStatus,
      createdBy,
      updatedBy,
    },
  };
}

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function warehouseLotExpiryState(
  lot: WarehouseLot,
  today: Date = new Date()
): WarehouseLotExpiryState {
  if (lot.status !== 'active') return 'INACTIVE';
  if (lot.quantity <= 0) return 'DEPLETED';
  if (!lot.expiresOn) return 'NO_EXPIRY';

  const expiryMs = Date.parse(lot.expiresOn + 'T00:00:00.000Z');
  const todayMs = startOfUtcDay(today);
  if (expiryMs < todayMs) return 'EXPIRED';

  const warningMs = WAREHOUSE_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
  return expiryMs - todayMs <= warningMs ? 'NEAR_EXPIRY' : 'VALID';
}

export function selectWarehouseFefoLot(
  lots: readonly WarehouseLot[],
  today: Date = new Date()
): WarehouseLot | null {
  return lots
    .filter((lot) => {
      const state = warehouseLotExpiryState(lot, today);
      return state === 'VALID' || state === 'NEAR_EXPIRY';
    })
    .slice()
    .sort((left, right) => {
      const expiryCompare = (left.expiresOn || '').localeCompare(right.expiresOn || '');
      if (expiryCompare !== 0) return expiryCompare;
      const codeCompare = left.code.localeCompare(right.code, 'pt-BR');
      return codeCompare !== 0 ? codeCompare : left.id.localeCompare(right.id);
    })[0] || null;
}

export function warehouseLotOriginLabel(origin: WarehouseLotOrigin): string {
  if (origin.kind === 'INVOICE') {
    return 'NF ' + (origin.invoiceId || '—') + ' · ' + (origin.supplier || 'Fornecedor não informado');
  }
  if (origin.kind === 'LEGACY') return 'Estoque legado';
  return 'Enriquecimento manual';
}

export function buildWarehouseLogisticsPendencies(input: {
  materialId: string;
  totalQuantity: number;
  locationBalances: readonly WarehouseLocationBalance[];
  lots: readonly WarehouseLot[];
  today?: Date;
}): WarehouseLogisticsPendency[] {
  const pendencies: WarehouseLogisticsPendency[] = [];
  const relevantLocations = input.locationBalances.filter(
    (item) => item.materialId === input.materialId
  );
  const relevantLots = input.lots.filter(
    (item) => item.materialId === input.materialId && item.status === 'active'
  );
  const physical = relevantLocations.filter(
    (item) => item.position.kind !== 'UNASSIGNED'
  );

  let derivedUnassigned = 0;
  try {
    derivedUnassigned = deriveUnassignedQuantity(input.totalQuantity, physical);
  } catch {
    derivedUnassigned = -1;
  }

  if (derivedUnassigned < -0.000001) {
    pendencies.push({
      code: 'PHYSICAL_BALANCE_MISMATCH',
      severity: 'critical',
      title: 'Distribuição física inconsistente',
      message: 'As posições físicas superam o saldo agregado. O sistema não corrige essa diferença automaticamente.',
    });
  } else if (derivedUnassigned > 0.000001) {
    pendencies.push({
      code: 'UNASSIGNED_STOCK',
      severity: 'warning',
      title: 'Saldo sem localização',
      message: 'Há saldo agregado ainda representado como Sem localização.',
    });
  }

  if (input.totalQuantity > 0 && relevantLots.length === 0) {
    pendencies.push({
      code: 'LOT_INFORMATION_MISSING',
      severity: 'info',
      title: 'Lote não informado',
      message: 'Verifique se este material exige rastreabilidade por lote. O saldo permanece operável.',
    });
  }

  if (relevantLots.some((lot) => lot.quantity > 0 && !lot.expiresOn)) {
    pendencies.push({
      code: 'LOT_EXPIRY_MISSING',
      severity: 'info',
      title: 'Validade não informada',
      message: 'Existe lote ativo sem validade. Materiais sem validade continuam permitidos.',
    });
  }

  if (
    relevantLots.some(
      (lot) => warehouseLotExpiryState(lot, input.today) === 'EXPIRED'
    )
  ) {
    pendencies.push({
      code: 'EXPIRED_LOT',
      severity: 'critical',
      title: 'Lote vencido',
      message: 'Existe quantidade rastreada em lote vencido. O FEFO não recomenda esse lote.',
    });
  }

  const attributedQuantity = relevantLots.reduce(
    (sum, lot) => sum + lot.quantity,
    0
  );
  if (attributedQuantity > input.totalQuantity + 0.000001) {
    pendencies.push({
      code: 'LOT_ATTRIBUTION_EXCEEDS_STOCK',
      severity: 'critical',
      title: 'Atribuição de lotes excede o saldo',
      message: 'A soma informativa dos lotes supera o saldo oficial. O saldo não foi alterado.',
    });
  }

  if (
    relevantLots.some(
      (lot) => lot.quantity > 0 && lot.origin.kind !== 'INVOICE'
    )
  ) {
    pendencies.push({
      code: 'ORIGIN_LINK_INCOMPLETE',
      severity: 'info',
      title: 'Origem documental incompleta',
      message: 'Existe lote sem vínculo com Nota Fiscal. O vínculo pode ser enriquecido posteriormente.',
    });
  }

  return pendencies;
}

export function warehouseLotIdentityKey(lot: WarehouseLot): string {
  return [
    lot.materialId,
    warehouseStockPositionKey(lot.position),
    lot.code.toLocaleLowerCase('pt-BR'),
  ].join('|');
}
