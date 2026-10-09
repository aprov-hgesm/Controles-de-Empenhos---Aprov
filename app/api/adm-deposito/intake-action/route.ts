import { NextResponse } from 'next/server';

import firebaseConfig from '../../../../firebase-applet-config.json';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { getGoogleAccessToken, SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import {
  verifyWarehouseRequest,
  WarehouseAccessError,
} from '../../../../lib/server/warehouseAccess';
import type { Empenho, Invoice } from '../../../../lib/types';
import {
  barcodeAssociationMatchesMaterial,
  createWarehouseBarcodeId,
  normalizeWarehouseBarcode,
  WAREHOUSE_BARCODE_SCHEMA_VERSION,
  type WarehouseBarcodeAssociation,
} from '../../../../lib/warehouse/barcode';
import {
  deriveWarehouseMaterialIdForEmpenhoItem,
  warehouseUnitFromOperationalLabel,
} from '../../../../lib/warehouse/invoiceIntegration';
import { createWarehouseItemIntakeId } from '../../../../lib/warehouse/intake';
import {
  calculateWarehouseItemIntakePendingQuantity,
  deriveWarehouseItemIntakeStatus,
  validateWarehouseItemIntakeState,
  WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
  type WarehouseItemIntakeState,
} from '../../../../lib/warehouse/intakeState';
import {
  createWarehouseLocationBalanceId,
  normalizeWarehouseLocationQuantity,
  validateWarehouseStockPosition,
  warehouseStockPositionKey,
  WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION,
  type WarehouseStockPosition,
} from '../../../../lib/warehouse/location';
import {
  createWarehousePendingLotCode,
  normalizeWarehouseExpiryDate,
  normalizeWarehouseLotCode,
  validateWarehouseLot,
  WAREHOUSE_LOT_SCHEMA_VERSION,
  type WarehouseLot,
} from '../../../../lib/warehouse/lot';
import {
  createWarehouseMaterial,
  normalizeWarehouseMaterialId,
  WAREHOUSE_MATERIAL_SCHEMA_VERSION,
  type WarehouseMaterial,
} from '../../../../lib/warehouse/material';
import {
  createWarehouseMovementId,
  normalizeWarehouseQuantity,
  WAREHOUSE_BALANCE_SCHEMA_VERSION,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
} from '../../../../lib/warehouse/movement';
import {
  normalizeWarehouseWithdrawnBy,
  WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
  WAREHOUSE_DESTINATION_SCHEMA_VERSION,
} from '../../../../lib/warehouse/withdrawal';

const PROJECT_ID = firebaseConfig.projectId;
const CORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
const WAREHOUSE_DATABASE_ID = 'emprovex-warehouse';
const EPSILON = 0.000001;

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: 'NULL_VALUE' }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface AdminDocument {
  path: string;
  data: Record<string, unknown>;
  updateTime: string;
}

interface FirestoreWrite {
  update: {
    name: string;
    fields: Record<string, FirestoreValue>;
  };
  currentDocument: {
    exists?: boolean;
    updateTime?: string;
  };
}

interface BaseInput {
  intakeId: string;
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  itemId: string;
  materialId?: string | null;
  expectedAllocatedQuantity: number;
  expectedImmediateConsumptionQuantity: number;
  effectiveStatus: string;
  quantity: number;
  operationId: string;
}

interface AllocateInput extends BaseInput {
  position: WarehouseStockPosition;
  lotCode: string;
  expiresOn: string | null;
  barcode?: string | null;
}

interface ImmediateInput extends BaseInput {
  destinationId: string;
  withdrawnBy: string;
}

type RequestBody =
  | { action: 'ALLOCATE'; workspaceId: string; input: AllocateInput }
  | { action: 'IMMEDIATE_CONSUMPTION'; workspaceId: string; input: ImmediateInput };

class FastPathError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
    this.name = 'FastPathError';
  }
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function base(databaseId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(databaseId)}/documents`;
}

function fullName(databaseId: string, path: string): string {
  return `projects/${PROJECT_ID}/databases/${databaseId}/documents/${path}`;
}

function toValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toValue) } };
  }
  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: toFields(value as Record<string, unknown>),
      },
    };
  }
  throw new FastPathError('WAREHOUSE_FAST_PATH_INVALID_FIELD', 400);
}

function toFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, field]) => field !== undefined)
      .map(([key, field]) => [key, toValue(field)])
  );
}

function fromValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromValue);
  if ('mapValue' in value) return fromFields(value.mapValue.fields);
  return undefined;
}

function fromFields(
  fields: Record<string, FirestoreValue> | undefined
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, fromValue(value)])
  );
}

// Preserve actionable failure classes without leaking OAuth or Firestore payloads.
function firestoreFailure(status: number, payload: string): FastPathError {
  if (status === 401) return new FastPathError('WAREHOUSE_FAST_PATH_UPSTREAM_AUTH', 503);
  if (status === 403) return new FastPathError('WAREHOUSE_FAST_PATH_UPSTREAM_PERMISSION', 503);
  if (status === 429) return new FastPathError('WAREHOUSE_FAST_PATH_RATE_LIMITED', 503);
  if (status === 409 || status === 412 || payload.includes('FAILED_PRECONDITION') || payload.includes('ABORTED')) {
    return new FastPathError('WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION', 409);
  }
  if (status >= 500) return new FastPathError('WAREHOUSE_FAST_PATH_UPSTREAM_UNAVAILABLE', 503);
  return new FastPathError('WAREHOUSE_FAST_PATH_UPSTREAM_REJECTED', 503);
}

async function getDocument(
  accessToken: string,
  databaseId: string,
  path: string
): Promise<AdminDocument | null> {
  const response = await fetch(`${base(databaseId)}/${encodePath(path)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw firestoreFailure(response.status, '');
  }
  const payload = await response.json() as {
    fields?: Record<string, FirestoreValue>;
    updateTime?: string;
  };
  if (!payload.updateTime) {
    throw new FastPathError('WAREHOUSE_FAST_PATH_INVALID_UPSTREAM_RESPONSE', 503);
  }
  return {
    path,
    data: fromFields(payload.fields),
    updateTime: payload.updateTime,
  };
}

function write(
  databaseId: string,
  path: string,
  data: Record<string, unknown>,
  current: AdminDocument | null
): FirestoreWrite {
  return {
    update: {
      name: fullName(databaseId, path),
      fields: toFields(data),
    },
    currentDocument: current
      ? { updateTime: current.updateTime }
      : { exists: false },
  };
}

async function commit(
  accessToken: string,
  databaseId: string,
  writes: FirestoreWrite[]
): Promise<void> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(databaseId)}/documents:commit`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ writes }),
      cache: 'no-store',
    }
  );
  if (response.ok) return;
  const text = await response.text();
  throw firestoreFailure(response.status, text);
}

function requiredText(value: unknown, max: number): string {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, max)
    : '';
  if (!normalized) throw new FastPathError('WAREHOUSE_FAST_PATH_INVALID_DATA', 409);
  return normalized;
}

function operationId(value: unknown): string {
  const normalized = requiredText(value, 96);
  if (!/^[A-Za-z0-9_-]{8,96}$/.test(normalized)) {
    throw new FastPathError('WAREHOUSE_INTAKE_ALLOCATION_INVALID_OPERATION_ID', 400);
  }
  return normalized;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function numberField(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

async function canonicalContext(
  accessToken: string,
  workspaceId: string,
  ug: string,
  input: BaseInput
) {
  const invoicePath = `workspaces/${workspaceId}/invoices/${input.invoiceRecordKey}`;
  const invoiceDocument = await getDocument(
    accessToken,
    CORE_DATABASE_ID,
    invoicePath
  );
  if (!invoiceDocument) {
    throw new FastPathError('WAREHOUSE_FAST_PATH_CANONICAL_INVOICE_MISSING', 409);
  }
  const invoice = invoiceDocument.data as unknown as Invoice;
  if (
    invoice.id !== input.invoiceId
    || invoice.empenhoId !== input.empenhoId
  ) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 409);
  }
  const invoiceItem = invoice.items?.find((item) => item.itemId === input.itemId);
  if (!invoiceItem || !(invoiceItem.quantity > 0)) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 409);
  }

  const empenhoPath = `workspaces/${workspaceId}/empenhos/${invoice.empenhoId}`;
  const empenhoDocument = await getDocument(
    accessToken,
    CORE_DATABASE_ID,
    empenhoPath
  );
  if (!empenhoDocument) {
    throw new FastPathError('WAREHOUSE_FAST_PATH_CANONICAL_EMPENHO_MISSING', 409);
  }
  const empenho = empenhoDocument.data as unknown as Empenho;
  const empenhoItem = empenho.items?.find((item) => item.id === input.itemId);
  if (!empenhoItem) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 409);
  }

  const intakeId = await createWarehouseItemIntakeId(
    workspaceId,
    input.invoiceRecordKey,
    input.itemId
  );
  if (intakeId !== input.intakeId) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 409);
  }

  const materialId = await deriveWarehouseMaterialIdForEmpenhoItem(
    workspaceId,
    input.empenhoId,
    input.itemId
  );
  const requestedMaterial = normalizeWarehouseMaterialId(input.materialId);
  if (requestedMaterial && requestedMaterial !== materialId) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_MATERIAL_CONFLICT', 409);
  }

  return {
    invoice,
    invoiceItem,
    empenho,
    empenhoItem,
    intakeId,
    materialId,
    receivedQuantity: invoiceItem.quantity,
    description: requiredText(empenhoItem.name, 500),
    unitLabel: requiredText(empenhoItem.unit, 120),
    supplier: requiredText(invoice.supplier || empenho.supplier, 240),
    supplierCnpj: (() => {
      const digits = String(invoice.supplierCnpj || empenho.supplierCnpj || '')
        .replace(/\D/g, '');
      return digits.length === 14 ? digits : null;
    })(),
    ug,
  };
}

async function assertNoLegacyEntry(
  accessToken: string,
  workspaceId: string,
  intakeId: string
): Promise<void> {
  const legacyMovementId = await createWarehouseMovementId(
    workspaceId,
    ['adm-intake-v2', intakeId, 'invoice-entry'].join(':').slice(0, 240)
  );
  const legacy = await getDocument(
    accessToken,
    WAREHOUSE_DATABASE_ID,
    `warehouse/${workspaceId}/movements/${legacyMovementId}`
  );
  if (legacy) throw new FastPathError('WAREHOUSE_FAST_PATH_LEGACY', 409);
}

function parseIntake(
  document: AdminDocument | null,
  workspaceId: string,
  ug: string,
  input: BaseInput,
  context: Awaited<ReturnType<typeof canonicalContext>>,
  actorUid: string
): WarehouseItemIntakeState {
  if (!document) {
    return {
      schemaVersion: WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
      id: input.intakeId,
      workspaceId,
      ug,
      invoiceRecordKey: input.invoiceRecordKey,
      invoiceId: input.invoiceId,
      empenhoId: input.empenhoId,
      itemId: input.itemId,
      materialId: null,
      description: context.description,
      unitLabel: context.unitLabel,
      supplier: context.supplier,
      receivedQuantity: context.receivedQuantity,
      allocatedQuantity: 0,
      immediateConsumptionQuantity: 0,
      pendingQuantity: context.receivedQuantity,
      status: 'PENDING',
      createdAt: null,
      updatedAt: null,
      createdBy: actorUid,
      updatedBy: actorUid,
    };
  }
  if (document.data.schemaVersion !== WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION) {
    throw new FastPathError('WAREHOUSE_FAST_PATH_LEGACY', 409);
  }
  const parsed = validateWarehouseItemIntakeState(
    {
      ...document.data,
      id: input.intakeId,
      createdAt: timestamp(document.data.createdAt),
      updatedAt: timestamp(document.data.updatedAt),
    },
    { expectedWorkspaceId: workspaceId, expectedUg: ug }
  );
  if (!parsed.ok) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 409);
  }
  const state = parsed.data;
  if (
    state.invoiceRecordKey !== input.invoiceRecordKey
    || state.invoiceId !== input.invoiceId
    || state.empenhoId !== input.empenhoId
    || state.itemId !== input.itemId
    || Math.abs(state.receivedQuantity - context.receivedQuantity) > EPSILON
  ) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 409);
  }
  return state;
}

function assertProgress(state: WarehouseItemIntakeState, input: BaseInput): void {
  if (
    Math.abs(state.allocatedQuantity - input.expectedAllocatedQuantity) > EPSILON
    || Math.abs(
      state.immediateConsumptionQuantity
      - input.expectedImmediateConsumptionQuantity
    ) > EPSILON
  ) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION', 409);
  }
}

function intakeResponse(state: WarehouseItemIntakeState): WarehouseItemIntakeState {
  return {
    ...state,
    createdAt: state.createdAt ? new Date(state.createdAt).toISOString() : null,
    updatedAt: state.updatedAt ? new Date(state.updatedAt).toISOString() : null,
  };
}

async function performAllocation(
  accessToken: string,
  access: Awaited<ReturnType<typeof verifyWarehouseRequest>>,
  input: AllocateInput
) {
  if (
    input.effectiveStatus === 'RECONCILIATION_REQUIRED'
    || input.effectiveStatus === 'PROCESSED'
  ) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 409);
  }
  const quantity = normalizeWarehouseQuantity(input.quantity);
  if (quantity === null || quantity <= 0) {
    throw new FastPathError('WAREHOUSE_INTAKE_ALLOCATION_INVALID_QUANTITY', 400);
  }
  const position = validateWarehouseStockPosition(input.position);
  if (!position || position.kind === 'UNASSIGNED') {
    throw new FastPathError('WAREHOUSE_INTAKE_LOCATION_REQUIRED', 400);
  }
  const opId = operationId(input.operationId);
  const context = await canonicalContext(
    accessToken,
    access.workspaceId,
    access.ug,
    input
  );
  await assertNoLegacyEntry(accessToken, access.workspaceId, input.intakeId);

  const movementId = await createWarehouseMovementId(
    access.workspaceId,
    ['adm-intake-fast', input.intakeId, 'allocate', opId].join(':').slice(0, 240)
  );
  const locationBalanceId = await createWarehouseLocationBalanceId(
    access.workspaceId,
    context.materialId,
    position
  );
  const lotCode = input.lotCode.trim()
    ? normalizeWarehouseLotCode(input.lotCode)
    : createWarehousePendingLotCode(input.intakeId);
  const expiresOn = normalizeWarehouseExpiryDate(input.expiresOn);
  if (!lotCode || expiresOn === undefined) {
    throw new FastPathError('WAREHOUSE_INTAKE_INVALID_LOT', 400);
  }
  const lotId = 'lot_' + (
    await sha256Hex([
      access.workspaceId,
      input.intakeId,
      lotCode,
      warehouseStockPositionKey(position),
    ].join('\n'))
  ).slice(0, 32);
  const barcode = input.barcode ? normalizeWarehouseBarcode(input.barcode) : null;
  if (input.barcode && !barcode) {
    throw new FastPathError('WAREHOUSE_INVALID_BARCODE', 400);
  }
  const barcodeId = barcode
    ? await createWarehouseBarcodeId(access.workspaceId, barcode)
    : null;

  // The immutable movement records the full normalized intent. A replay with the
  // same operationId but different barcode (including null), presentation, lot,
  // expiry or physical position must never be accepted as an applied operation.
  const allocationIntentHash = await sha256Hex(JSON.stringify({
    intakeId: input.intakeId,
    materialId: context.materialId,
    quantity,
    position: warehouseStockPositionKey(position),
    lotCode,
    expiresOn,
    barcode,
    presentation: warehouseUnitFromOperationalLabel(context.unitLabel),
  }));
  const allocationMovementNote = 'Alocação direta da Central de Depósitos | intent:' + allocationIntentHash;

  const root = `warehouse/${access.workspaceId}`;
  const paths = {
    intake: `${root}/intakes/${input.intakeId}`,
    material: `${root}/materials/${context.materialId}`,
    balance: `${root}/balances/${context.materialId}`,
    locationBalance: `${root}/locationBalances/${locationBalanceId}`,
    movement: `${root}/movements/${movementId}`,
    depot: `${root}/depots/${position.depotId}`,
    location: `${root}/locations/${position.locationId}`,
    subposition: position.kind === 'SUBPOSITION'
      ? `${root}/locations/${position.subpositionId}`
      : null,
    lot: `${root}/lots/${lotId}`,
    barcode: barcodeId ? `${root}/barcodes/${barcodeId}` : null,
  };

  const [
    intakeDocument,
    materialDocument,
    balanceDocument,
    locationBalanceDocument,
    movementDocument,
    depotDocument,
    locationDocument,
    subpositionDocument,
    lotDocument,
    barcodeDocument,
  ] = await Promise.all([
    getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.intake),
    getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.material),
    getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.balance),
    getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.locationBalance),
    getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.movement),
    getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.depot),
    getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.location),
    paths.subposition
      ? getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.subposition)
      : Promise.resolve(null),
    getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.lot),
    paths.barcode
      ? getDocument(accessToken, WAREHOUSE_DATABASE_ID, paths.barcode)
      : Promise.resolve(null),
  ]);

  if (!depotDocument || !locationDocument) {
    throw new FastPathError('WAREHOUSE_POSITION_NOT_FOUND', 409);
  }
  if (
    depotDocument.data.workspaceId !== access.workspaceId
    || depotDocument.data.ug !== access.ug
    || depotDocument.data.status !== 'active'
    || locationDocument.data.workspaceId !== access.workspaceId
    || locationDocument.data.ug !== access.ug
    || locationDocument.data.status !== 'active'
    || locationDocument.data.depotId !== position.depotId
    || locationDocument.data.kind !== 'LOCAL'
  ) {
    throw new FastPathError('WAREHOUSE_POSITION_INACTIVE', 409);
  }
  if (
    position.kind === 'SUBPOSITION'
    && (
      !subpositionDocument
      || subpositionDocument.data.workspaceId !== access.workspaceId
      || subpositionDocument.data.ug !== access.ug
      || subpositionDocument.data.status !== 'active'
      || subpositionDocument.data.kind !== 'SUBPOSITION'
      || subpositionDocument.data.depotId !== position.depotId
      || subpositionDocument.data.parentLocationId !== position.locationId
    )
  ) {
    throw new FastPathError('WAREHOUSE_SUBPOSITION_INACTIVE', 409);
  }

  const currentIntake = parseIntake(
    intakeDocument,
    access.workspaceId,
    access.ug,
    input,
    context,
    access.uid
  );

  if (movementDocument) {
    if (
      !intakeDocument
      || movementDocument.data.schemaVersion !== WAREHOUSE_MOVEMENT_SCHEMA_VERSION
      || movementDocument.data.id !== movementId
      || movementDocument.data.workspaceId !== access.workspaceId
      || movementDocument.data.ug !== access.ug
      || movementDocument.data.materialId !== context.materialId
      || movementDocument.data.type !== 'INVOICE_ENTRY'
      || Math.abs(numberField(movementDocument.data.quantityDelta) - quantity) > EPSILON
      || movementDocument.data.note !== allocationMovementNote
      || !lotDocument
      || lotDocument.data.code !== lotCode
      || lotDocument.data.expiresOn !== expiresOn
      || warehouseStockPositionKey(validateWarehouseStockPosition(lotDocument.data.position) || { kind: 'UNASSIGNED' }) !== warehouseStockPositionKey(position)
      || (barcode !== null && (
        !barcodeDocument
        || barcodeDocument.data.id !== barcodeId
        || barcodeDocument.data.barcode !== barcode
        || barcodeDocument.data.materialId !== context.materialId
        || barcodeDocument.data.status !== 'active'
        || JSON.stringify(barcodeDocument.data.presentation) !== JSON.stringify(warehouseUnitFromOperationalLabel(context.unitLabel))
      ))
    ) {
      throw new FastPathError('WAREHOUSE_IDEMPOTENCY_CONFLICT', 409);
    }
    return {
      applied: false,
      intake: intakeResponse(currentIntake),
      entryMovementId: movementId,
      transferMovementId: movementId,
      lot: lotDocument?.data || null,
      barcode: barcodeDocument?.data || null,
    };
  }

  assertProgress(currentIntake, input);

  const pending = calculateWarehouseItemIntakePendingQuantity(
    context.receivedQuantity,
    currentIntake.allocatedQuantity,
    currentIntake.immediateConsumptionQuantity
  );
  if (pending <= EPSILON || quantity > pending + EPSILON) {
    throw new FastPathError('WAREHOUSE_INTAKE_ALLOCATION_EXCEEDS_PENDING', 409);
  }

  let material: WarehouseMaterial;
  if (materialDocument) {
    if (
      materialDocument.data.schemaVersion !== WAREHOUSE_MATERIAL_SCHEMA_VERSION
      || materialDocument.data.id !== context.materialId
      || materialDocument.data.workspaceId !== access.workspaceId
      || materialDocument.data.ug !== access.ug
      || materialDocument.data.status !== 'active'
    ) {
      throw new FastPathError('WAREHOUSE_MATERIAL_INACTIVE', 409);
    }
    material = materialDocument.data as unknown as WarehouseMaterial;
  } else {
    const created = createWarehouseMaterial({
      id: context.materialId,
      workspaceId: access.workspaceId,
      ug: access.ug,
      description: context.description,
      aliases: [],
      unit: warehouseUnitFromOperationalLabel(context.unitLabel),
      status: 'active',
      conversions: [],
    });
    if (!created.ok) {
      throw new FastPathError('WAREHOUSE_INTAKE_MATERIAL_CREATE_FAILED', 409);
    }
    material = created.data;
  }

  if (
    balanceDocument
    && (
      balanceDocument.data.schemaVersion !== WAREHOUSE_BALANCE_SCHEMA_VERSION
      || balanceDocument.data.workspaceId !== access.workspaceId
      || balanceDocument.data.ug !== access.ug
      || balanceDocument.data.materialId !== context.materialId
    )
  ) {
    throw new FastPathError('WAREHOUSE_LEDGER_BALANCE_INCONSISTENT', 409);
  }
  if (
    locationBalanceDocument
    && (
      locationBalanceDocument.data.schemaVersion
        !== WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION
      || locationBalanceDocument.data.workspaceId !== access.workspaceId
      || locationBalanceDocument.data.ug !== access.ug
      || locationBalanceDocument.data.materialId !== context.materialId
      || warehouseStockPositionKey(
        validateWarehouseStockPosition(locationBalanceDocument.data.position)
          || { kind: 'UNASSIGNED' }
      ) !== warehouseStockPositionKey(position)
    )
  ) {
    throw new FastPathError('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT', 409);
  }

  const currentBalanceQuantity = normalizeWarehouseQuantity(
    numberField(balanceDocument?.data.quantity)
  ) || 0;
  const currentLocationQuantity = normalizeWarehouseLocationQuantity(
    numberField(locationBalanceDocument?.data.quantity)
  ) || 0;
  const nextBalanceQuantity = normalizeWarehouseQuantity(
    currentBalanceQuantity + quantity
  );
  const nextLocationQuantity = normalizeWarehouseLocationQuantity(
    currentLocationQuantity + quantity
  );
  if (
    nextBalanceQuantity === null
    || nextLocationQuantity === null
    || currentBalanceQuantity < 0
    || currentLocationQuantity < 0
  ) {
    throw new FastPathError('WAREHOUSE_INVALID_QUANTITY', 409);
  }

  const now = new Date();
  const nextAllocated = currentIntake.allocatedQuantity + quantity;
  const nextIntakeCandidate: WarehouseItemIntakeState = {
    ...currentIntake,
    schemaVersion: WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
    materialId: context.materialId,
    description: context.description,
    unitLabel: context.unitLabel,
    supplier: context.supplier,
    receivedQuantity: context.receivedQuantity,
    allocatedQuantity: nextAllocated,
    pendingQuantity: calculateWarehouseItemIntakePendingQuantity(
      context.receivedQuantity,
      nextAllocated,
      currentIntake.immediateConsumptionQuantity
    ),
    status: deriveWarehouseItemIntakeStatus(
      context.receivedQuantity,
      nextAllocated,
      currentIntake.immediateConsumptionQuantity
    ),
    createdAt: currentIntake.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    updatedBy: access.uid,
  };
  const intakeValidation = validateWarehouseItemIntakeState(
    nextIntakeCandidate,
    { expectedWorkspaceId: access.workspaceId, expectedUg: access.ug }
  );
  if (!intakeValidation.ok) {
    throw new FastPathError('WAREHOUSE_INVALID_ITEM_INTAKE_STATE', 409);
  }
  const nextIntake = intakeValidation.data;

  const movement = {
    schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
    id: movementId,
    workspaceId: access.workspaceId,
    ug: access.ug,
    materialId: context.materialId,
    type: 'INVOICE_ENTRY',
    quantityDelta: quantity,
    idempotencyKeyHash: movementId.slice('mov_'.length),
    reversesMovementId: null,
    note: allocationMovementNote,
    source: {
      kind: 'INVOICE',
      action: 'ENTRY',
      invoiceRecordKey: input.invoiceRecordKey,
      invoiceId: input.invoiceId,
      empenhoId: input.empenhoId,
      itemIds: [input.itemId],
      supplier: context.supplier,
      supplierCnpj: context.supplierCnpj,
      actorUid: access.uid,
    },
    createdAt: now,
  };

  const balance = {
    schemaVersion: WAREHOUSE_BALANCE_SCHEMA_VERSION,
    workspaceId: access.workspaceId,
    ug: access.ug,
    materialId: context.materialId,
    quantity: nextBalanceQuantity,
    revision: Math.max(0, numberField(balanceDocument?.data.revision)) + 1,
    lastMovementId: movementId,
    updatedAt: now,
  };

  const locationBalance = {
    schemaVersion: WAREHOUSE_LOCATION_BALANCE_SCHEMA_VERSION,
    id: locationBalanceId,
    workspaceId: access.workspaceId,
    ug: access.ug,
    materialId: context.materialId,
    position,
    quantity: nextLocationQuantity,
    revision: Math.max(0, numberField(locationBalanceDocument?.data.revision)) + 1,
    lastMovementId: movementId,
    updatedAt: now,
  };

  let nextLot: WarehouseLot;
  if (lotDocument) {
    const lotData = lotDocument.data;
    const existing = validateWarehouseLot(
      {
        schemaVersion: lotData.schemaVersion,
        id: lotId,
        workspaceId: lotData.workspaceId,
        ug: lotData.ug,
        materialId: lotData.materialId,
        code: lotData.code,
        expiresOn: lotData.expiresOn ?? null,
        quantity: lotData.quantity,
        position: lotData.position,
        origin: lotData.origin,
        status: lotData.status,
        createdBy: lotData.createdBy,
        updatedBy: lotData.updatedBy,
      },
      {
        expectedWorkspaceId: access.workspaceId,
        expectedUg: access.ug,
        expectedMaterialId: context.materialId,
      }
    );
    if (
      !existing.ok
      || existing.data.status !== 'active'
      || existing.data.code !== lotCode
      || existing.data.expiresOn !== expiresOn
      || warehouseStockPositionKey(existing.data.position)
        !== warehouseStockPositionKey(position)
    ) {
      throw new FastPathError('WAREHOUSE_INTAKE_LOT_CONFLICT', 409);
    }
    const nextLotQuantity = normalizeWarehouseLocationQuantity(
      existing.data.quantity + quantity
    );
    if (nextLotQuantity === null) {
      throw new FastPathError('WAREHOUSE_INTAKE_LOT_QUANTITY_INVALID', 409);
    }
    nextLot = {
      ...existing.data,
      quantity: nextLotQuantity,
      updatedBy: access.uid,
    };
  } else {
    nextLot = {
      schemaVersion: WAREHOUSE_LOT_SCHEMA_VERSION,
      id: lotId,
      workspaceId: access.workspaceId,
      ug: access.ug,
      materialId: context.materialId,
      code: lotCode,
      expiresOn,
      quantity,
      position,
      origin: {
        kind: 'INVOICE',
        movementId,
        invoiceRecordKey: input.invoiceRecordKey,
        invoiceId: input.invoiceId,
        supplier: context.supplier,
        supplierCnpj: context.supplierCnpj,
      },
      status: 'active',
      createdBy: access.uid,
      updatedBy: access.uid,
    };
  }

  let barcodeAssociation: WarehouseBarcodeAssociation | null = null;
  if (barcode && barcodeId) {
    if (barcodeDocument) {
      const existing = barcodeDocument.data as unknown as WarehouseBarcodeAssociation;
      if (
        existing.schemaVersion !== WAREHOUSE_BARCODE_SCHEMA_VERSION
        || existing.id !== barcodeId
        || existing.materialId !== context.materialId
        || existing.status !== 'active'
        || !barcodeAssociationMatchesMaterial(existing, material)
      ) {
        throw new FastPathError('WAREHOUSE_BARCODE_MATERIAL_CONFLICT', 409);
      }
      barcodeAssociation = existing;
    } else {
      barcodeAssociation = {
        schemaVersion: WAREHOUSE_BARCODE_SCHEMA_VERSION,
        id: barcodeId,
        workspaceId: access.workspaceId,
        ug: access.ug,
        materialId: context.materialId,
        barcode,
        presentation: material.unit,
        factorToBaseUnit: 1,
        status: 'active',
        createdBy: access.uid,
        updatedBy: access.uid,
      };
    }
  }

  const writes: FirestoreWrite[] = [
    write(WAREHOUSE_DATABASE_ID, paths.movement, movement, null),
    write(WAREHOUSE_DATABASE_ID, paths.balance, balance, balanceDocument),
    write(
      WAREHOUSE_DATABASE_ID,
      paths.locationBalance,
      locationBalance,
      locationBalanceDocument
    ),
    write(
      WAREHOUSE_DATABASE_ID,
      paths.intake,
      { ...nextIntake, createdAt: new Date(nextIntake.createdAt || now), updatedAt: now },
      intakeDocument
    ),
    write(
      WAREHOUSE_DATABASE_ID,
      paths.lot,
      { ...nextLot, createdAt: new Date(timestamp(lotDocument?.data.createdAt) || now), updatedAt: now },
      lotDocument
    ),
  ];
  if (!materialDocument) {
    writes.push(write(
      WAREHOUSE_DATABASE_ID,
      paths.material,
      { ...material } as Record<string, unknown>,
      null
    ));
  }
  if (barcodeAssociation && paths.barcode && !barcodeDocument) {
    writes.push(write(
      WAREHOUSE_DATABASE_ID,
      paths.barcode,
      { ...barcodeAssociation, createdAt: now, updatedAt: now },
      null
    ));
  }

  await commit(accessToken, WAREHOUSE_DATABASE_ID, writes);

  return {
    applied: true,
    intake: intakeResponse(nextIntake),
    entryMovementId: movementId,
    transferMovementId: movementId,
    lot: nextLot,
    barcode: barcodeAssociation,
  };
}

async function performImmediateConsumption(
  accessToken: string,
  access: Awaited<ReturnType<typeof verifyWarehouseRequest>>,
  input: ImmediateInput
) {
  if (
    input.effectiveStatus === 'RECONCILIATION_REQUIRED'
    || input.effectiveStatus === 'PROCESSED'
  ) {
    throw new FastPathError('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 409);
  }
  const quantity = normalizeWarehouseQuantity(input.quantity);
  if (quantity === null || quantity <= 0) {
    throw new FastPathError('WAREHOUSE_IMMEDIATE_CONSUMPTION_INVALID_QUANTITY', 400);
  }
  const withdrawnBy = normalizeWarehouseWithdrawnBy(input.withdrawnBy || '');
  if (!withdrawnBy) {
    throw new FastPathError('WAREHOUSE_WITHDRAWN_BY_REQUIRED', 400);
  }
  const opId = operationId(input.operationId);
  const context = await canonicalContext(
    accessToken,
    access.workspaceId,
    access.ug,
    input
  );
  await assertNoLegacyEntry(accessToken, access.workspaceId, input.intakeId);

  const consumptionId = 'cons_' + await sha256Hex(
    access.workspaceId + '\nimmediate-fast:' + input.intakeId + ':' + opId
  );
  const root = `warehouse/${access.workspaceId}`;
  const intakePath = `${root}/intakes/${input.intakeId}`;
  const destinationPath = `${root}/destinations/${input.destinationId}`;
  const consumptionPath = `${root}/consumptions/${consumptionId}`;

  const [intakeDocument, destinationDocument, consumptionDocument] =
    await Promise.all([
      getDocument(accessToken, WAREHOUSE_DATABASE_ID, intakePath),
      getDocument(accessToken, WAREHOUSE_DATABASE_ID, destinationPath),
      getDocument(accessToken, WAREHOUSE_DATABASE_ID, consumptionPath),
    ]);

  if (
    !destinationDocument
    || destinationDocument.data.schemaVersion !== WAREHOUSE_DESTINATION_SCHEMA_VERSION
    || destinationDocument.data.workspaceId !== access.workspaceId
    || destinationDocument.data.ug !== access.ug
    || destinationDocument.data.status !== 'active'
  ) {
    throw new FastPathError('WAREHOUSE_DESTINATION_INACTIVE', 409);
  }

  const currentIntake = parseIntake(
    intakeDocument,
    access.workspaceId,
    access.ug,
    input,
    context,
    access.uid
  );

  if (consumptionDocument) {
    if (
      !intakeDocument
      || consumptionDocument.data.schemaVersion
        !== WAREHOUSE_CONSUMPTION_SCHEMA_VERSION
      || consumptionDocument.data.id !== consumptionId
      || consumptionDocument.data.workspaceId !== access.workspaceId
      || consumptionDocument.data.ug !== access.ug
      || consumptionDocument.data.origin !== 'IMMEDIATE_CONSUMPTION'
      || consumptionDocument.data.intakeId !== input.intakeId
      || consumptionDocument.data.invoiceRecordKey !== input.invoiceRecordKey
      || consumptionDocument.data.destinationId !== input.destinationId
      || consumptionDocument.data.withdrawnBy !== withdrawnBy
      || Math.abs(numberField(consumptionDocument.data.quantity) - quantity) > EPSILON
    ) {
      throw new FastPathError('WAREHOUSE_CONSUMPTION_IDEMPOTENCY_CONFLICT', 409);
    }
    return {
      applied: false,
      intake: intakeResponse(currentIntake),
      movementId: null,
      consumptionId,
    };
  }

  assertProgress(currentIntake, input);

  const pending = calculateWarehouseItemIntakePendingQuantity(
    context.receivedQuantity,
    currentIntake.allocatedQuantity,
    currentIntake.immediateConsumptionQuantity
  );
  if (pending <= EPSILON || quantity > pending + EPSILON) {
    throw new FastPathError('WAREHOUSE_IMMEDIATE_CONSUMPTION_EXCEEDS_PENDING', 409);
  }

  const now = new Date();
  const nextImmediate = currentIntake.immediateConsumptionQuantity + quantity;
  const nextIntakeCandidate: WarehouseItemIntakeState = {
    ...currentIntake,
    schemaVersion: WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
    materialId: currentIntake.materialId || null,
    description: context.description,
    unitLabel: context.unitLabel,
    supplier: context.supplier,
    receivedQuantity: context.receivedQuantity,
    immediateConsumptionQuantity: nextImmediate,
    pendingQuantity: calculateWarehouseItemIntakePendingQuantity(
      context.receivedQuantity,
      currentIntake.allocatedQuantity,
      nextImmediate
    ),
    status: deriveWarehouseItemIntakeStatus(
      context.receivedQuantity,
      currentIntake.allocatedQuantity,
      nextImmediate
    ),
    createdAt: currentIntake.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    updatedBy: access.uid,
  };
  const intakeValidation = validateWarehouseItemIntakeState(
    nextIntakeCandidate,
    { expectedWorkspaceId: access.workspaceId, expectedUg: access.ug }
  );
  if (!intakeValidation.ok) {
    throw new FastPathError('WAREHOUSE_INVALID_ITEM_INTAKE_STATE', 409);
  }
  const nextIntake = intakeValidation.data;

  const consumption = {
    schemaVersion: WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
    id: consumptionId,
    workspaceId: access.workspaceId,
    ug: access.ug,
    origin: 'IMMEDIATE_CONSUMPTION',
    materialId: nextIntake.materialId,
    materialDescription: context.description,
    unitLabel: context.unitLabel,
    quantity,
    requestedQuantity: quantity,
    presentationLabel: context.unitLabel,
    destinationId: input.destinationId,
    destinationName: requiredText(destinationDocument.data.name, 120),
    withdrawnBy,
    operatorUid: access.uid,
    movementId: null,
    withdrawalId: null,
    lineId: null,
    intakeId: input.intakeId,
    invoiceRecordKey: input.invoiceRecordKey,
    barcode: null,
    lotCode: null,
    positionLabel: 'Consumo imediato · sem entrada em estoque',
    siscofisStatus: 'PENDING',
    occurredAt: now,
    updatedAt: now,
    siscofisUpdatedBy: null,
    siscofisUpdatedAt: null,
    returnedQuantity: 0,
    lastReturnMovementId: null,
    lastReturnAt: null,
    lastReturnBy: null,
    lastReturnReason: null,
  };

  await commit(accessToken, WAREHOUSE_DATABASE_ID, [
    write(
      WAREHOUSE_DATABASE_ID,
      intakePath,
      { ...nextIntake, createdAt: new Date(nextIntake.createdAt || now), updatedAt: now },
      intakeDocument
    ),
    write(WAREHOUSE_DATABASE_ID, consumptionPath, consumption, null),
  ]);

  return {
    applied: true,
    intake: intakeResponse(nextIntake),
    movementId: null,
    consumptionId,
  };
}

export async function POST(request: Request) {
  try {
    const access = await verifyWarehouseRequest(
      request.headers.get('authorization')
    );
    const body = await request.json() as RequestBody;
    if (!body || body.workspaceId !== access.workspaceId || !body.input) {
      throw new FastPathError('WAREHOUSE_FAST_PATH_SCOPE_MISMATCH', 403);
    }
    const accessToken = await getGoogleAccessToken();
    const result = body.action === 'ALLOCATE'
      ? await performAllocation(accessToken, access, body.input)
      : body.action === 'IMMEDIATE_CONSUMPTION'
        ? await performImmediateConsumption(accessToken, access, body.input)
        : null;
    if (!result) {
      throw new FastPathError('WAREHOUSE_FAST_PATH_INVALID_ACTION', 400);
    }
    return NextResponse.json({ result });
  } catch (error) {
    if (
      error instanceof FounderAuthError
      || error instanceof WarehouseAccessError
    ) {
      return NextResponse.json(
        { error: 'WAREHOUSE_ACCESS_DENIED' },
        { status: error.status }
      );
    }
    if (error instanceof SectorProvisioningFailure) {
      return NextResponse.json(
        { error: error.code === 'SERVER_CONFIGURATION'
          ? 'WAREHOUSE_FAST_PATH_SERVER_CONFIGURATION'
          : 'WAREHOUSE_FAST_PATH_UPSTREAM_AUTH' },
        { status: 503 }
      );
    }
    if (error instanceof FastPathError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status }
      );
    }
    console.error('Central de Depósitos fast intake action failed:', error);
    return NextResponse.json(
      { error: 'WAREHOUSE_FAST_PATH_UNAVAILABLE' },
      { status: 503 }
    );
  }
}
