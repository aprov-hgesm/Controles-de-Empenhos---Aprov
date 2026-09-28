import { importPKCS8, SignJWT } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import {
  HGESM_UG,
  HGESM_WORKSPACE_ID,
} from '../hgesmWorkspace';
import {
  validateWarehouseLocationBalance,
  type WarehouseLocationBalance,
} from '../warehouse/location';
import {
  createWarehouseMovementId,
  normalizeWarehouseQuantity,
  validateWarehouseBalance,
  validateWarehouseMovement,
  type WarehouseBalance,
  type WarehouseMovement,
} from '../warehouse/movement';
import {
  validateWarehouseMaterial,
  type WarehouseMaterial,
} from '../warehouse/material';
import {
  validateWarehouseLot,
  WAREHOUSE_LOT_SCHEMA_VERSION,
  type WarehouseLot,
} from '../warehouse/lot';
import {
  planWarehouseOutboundReturn,
} from '../warehouse/outboundReturn';
import {
  WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
  type WarehouseConsumptionRecord,
} from '../warehouse/withdrawal';

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = 'emprovex-warehouse';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const EPSILON = 0.000001;

type FailureCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_CONFIGURATION'
  | 'UPSTREAM_ERROR';

export class WarehouseOutboundReturnFailure extends Error {
  constructor(
    message: string,
    public readonly code: FailureCode,
    public readonly httpStatus: 400 | 404 | 409 | 500 | 503
  ) {
    super(message);
    this.name = 'WarehouseOutboundReturnFailure';
  }
}

interface ServiceAccountCredentials {
  project_id?: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

interface GoogleApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: 'NULL_VALUE' }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface FirestoreDocumentPayload {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

interface FirestoreBatchGetResponse {
  found?: FirestoreDocumentPayload;
  missing?: string;
  readTime?: string;
}

interface FirestoreWrite {
  update?: {
    name: string;
    fields: Record<string, FirestoreValue>;
  };
  updateMask?: {
    fieldPaths: string[];
  };
  currentDocument?: {
    exists?: boolean;
    updateTime?: string;
  };
}

export interface WarehouseOutboundReturnAdminInput {
  actorUid: string;
  consumptionId: string;
  quantity: number;
  reason: string;
  operationId: string;
}

export interface WarehouseOutboundReturnAdminResult {
  movement: WarehouseMovement;
  consumption: WarehouseConsumptionRecord;
  balance: WarehouseBalance;
  locationBalance: WarehouseLocationBalance;
  lot: WarehouseLot | null;
  warnings: string[];
}

let accessTokenCache: AccessTokenCache | null = null;

function normalizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function normalizeUnboundedText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ')
    : '';
}

function parseServiceAccountCredentials(): ServiceAccountCredentials {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new WarehouseOutboundReturnFailure(
      'O serviço seguro de devolução ainda não está configurado no servidor.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  let parsed: Partial<ServiceAccountCredentials>;
  try {
    parsed = JSON.parse(raw) as Partial<ServiceAccountCredentials>;
  } catch {
    throw new WarehouseOutboundReturnFailure(
      'A credencial administrativa do Firebase está inválida no servidor.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  const clientEmail = parsed.client_email?.trim();
  const privateKey = parsed.private_key?.replace(/\\n/g, '\n').trim();
  if (!clientEmail || !privateKey) {
    throw new WarehouseOutboundReturnFailure(
      'A credencial administrativa do Firebase está incompleta no servidor.',
      'SERVER_CONFIGURATION',
      503
    );
  }
  if (parsed.project_id && parsed.project_id !== PROJECT_ID) {
    throw new WarehouseOutboundReturnFailure(
      'A credencial administrativa pertence a outro projeto Firebase.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  return {
    project_id: parsed.project_id,
    client_email: clientEmail,
    private_key: privateKey,
    token_uri: parsed.token_uri || TOKEN_URI,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function googleErrorMessage(payload: GoogleApiErrorPayload): string {
  return payload.error?.message || payload.error?.status || 'GOOGLE_API_ERROR';
}

async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAt - 60_000 > now) {
    return accessTokenCache.token;
  }

  const serviceAccount = parseServiceAccountCredentials();
  const tokenUri = serviceAccount.token_uri || TOKEN_URI;
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');
  const issuedAt = Math.floor(now / 1000);
  const assertion = await new SignJWT({ scope: CLOUD_PLATFORM_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 3600)
    .sign(privateKey);

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });

  const payload = await readJson<Record<string, unknown> & GoogleApiErrorPayload>(response);
  const token = typeof payload.access_token === 'string' ? payload.access_token : '';
  const expiresIn = Number(payload.expires_in || 3600);
  if (!response.ok || !token) {
    throw new WarehouseOutboundReturnFailure(
      'Não foi possível autorizar o serviço seguro de devolução.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  accessTokenCache = {
    token,
    expiresAt: now + Math.max(300, expiresIn) * 1000,
  };
  return token;
}

function firestoreDatabaseRoot(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;
}

function firestoreDocumentName(path: string): string {
  return `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${path}`;
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: toFirestoreFields(value as Record<string, unknown>),
      },
    };
  }
  throw new Error('WAREHOUSE_ADMIN_UNSUPPORTED_FIRESTORE_VALUE');
}

function toFirestoreFields(
  value: Record<string, unknown>
): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, toFirestoreValue(fieldValue)])
  );
}

function fromFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map((item) => fromFirestoreValue(item));
  }
  if ('mapValue' in value) {
    return fromFirestoreFields(value.mapValue.fields || {});
  }
  return undefined;
}

function fromFirestoreFields(
  fields: Record<string, FirestoreValue>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)])
  );
}

function parseBatchGetPayload(text: string): FirestoreBatchGetResponse[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as FirestoreBatchGetResponse | FirestoreBatchGetResponse[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^,|,$/g, ''))
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FirestoreBatchGetResponse);
  }
}

async function beginTransaction(accessToken: string): Promise<string> {
  const response = await fetch(`${firestoreDatabaseRoot()}:beginTransaction`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ options: { readWrite: {} } }),
    cache: 'no-store',
  });
  const payload = await readJson<{ transaction?: string } & GoogleApiErrorPayload>(response);
  if (!response.ok || !payload.transaction) {
    throw new WarehouseOutboundReturnFailure(
      'Não foi possível iniciar a transação segura de devolução.',
      'UPSTREAM_ERROR',
      500
    );
  }
  return payload.transaction;
}

async function rollbackTransaction(
  accessToken: string,
  transaction: string
): Promise<void> {
  try {
    await fetch(`${firestoreDatabaseRoot()}:rollback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ transaction }),
      cache: 'no-store',
    });
  } catch {
    // A expiração do token de transação também encerra a operação sem writes.
  }
}

async function batchGetDocuments(
  accessToken: string,
  transaction: string,
  paths: string[]
): Promise<Map<string, FirestoreDocumentPayload | null>> {
  const documents = paths.map((path) => firestoreDocumentName(path));
  const response = await fetch(`${firestoreDatabaseRoot()}:batchGet`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ documents, transaction }),
    cache: 'no-store',
  });

  const raw = await response.text();
  if (!response.ok) {
    let payload: GoogleApiErrorPayload = {};
    try {
      payload = JSON.parse(raw) as GoogleApiErrorPayload;
    } catch {
      // Mantém mensagem genérica.
    }
    throw new WarehouseOutboundReturnFailure(
      googleErrorMessage(payload),
      'UPSTREAM_ERROR',
      500
    );
  }

  const result = new Map<string, FirestoreDocumentPayload | null>(
    documents.map((name) => [name, null])
  );
  for (const item of parseBatchGetPayload(raw)) {
    if (item.found?.name) result.set(item.found.name, item.found);
    if (item.missing) result.set(item.missing, null);
  }
  return result;
}

async function commitTransaction(
  accessToken: string,
  transaction: string,
  writes: FirestoreWrite[]
): Promise<void> {
  const response = await fetch(`${firestoreDatabaseRoot()}:commit`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ writes, transaction }),
    cache: 'no-store',
  });
  const payload = await readJson<GoogleApiErrorPayload>(response);
  if (!response.ok) {
    const message = googleErrorMessage(payload);
    if (
      message.includes('ABORTED')
      || message.includes('FAILED_PRECONDITION')
      || message.includes('ALREADY_EXISTS')
    ) {
      throw new WarehouseOutboundReturnFailure(
        'O estoque mudou durante a devolução. Atualize e tente novamente.',
        'CONFLICT',
        409
      );
    }
    throw new WarehouseOutboundReturnFailure(
      'Não foi possível concluir a devolução no Firestore.',
      'UPSTREAM_ERROR',
      500
    );
  }
}

function requireDocument(
  documents: Map<string, FirestoreDocumentPayload | null>,
  path: string,
  code: string
): FirestoreDocumentPayload {
  const document = documents.get(firestoreDocumentName(path));
  if (!document?.fields) {
    throw new WarehouseOutboundReturnFailure(
      code,
      'NOT_FOUND',
      404
    );
  }
  return document;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function nullableTimestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

function parseConsumption(
  document: FirestoreDocumentPayload,
  expectedId: string
): WarehouseConsumptionRecord {
  const data = fromFirestoreFields(document.fields || {});
  const quantity = numeric(data.quantity);
  const requestedQuantity = numeric(data.requestedQuantity);
  const returnedQuantity = data.returnedQuantity === undefined
    ? 0
    : numeric(data.returnedQuantity);
  const origin = data.origin;
  const siscofisStatus = data.siscofisStatus;

  if (
    data.schemaVersion !== WAREHOUSE_CONSUMPTION_SCHEMA_VERSION
    || data.id !== expectedId
    || data.workspaceId !== HGESM_WORKSPACE_ID
    || data.ug !== HGESM_UG
    || (origin !== 'STOCK_OUTBOUND' && origin !== 'IMMEDIATE_CONSUMPTION')
    || !Number.isFinite(quantity)
    || quantity <= 0
    || !Number.isFinite(requestedQuantity)
    || requestedQuantity <= 0
    || !Number.isFinite(returnedQuantity)
    || returnedQuantity < 0
    || returnedQuantity > quantity + EPSILON
    || !['PENDING', 'PREPARED', 'POSTED'].includes(String(siscofisStatus))
  ) {
    throw new WarehouseOutboundReturnFailure(
      'Registro de saída inválido para devolução.',
      'CONFLICT',
      409
    );
  }

  return {
    schemaVersion: WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
    id: expectedId,
    workspaceId: HGESM_WORKSPACE_ID,
    ug: HGESM_UG,
    origin: origin as WarehouseConsumptionRecord['origin'],
    materialId: nullableString(data.materialId),
    materialDescription: normalizeText(data.materialDescription, 240),
    unitLabel: normalizeText(data.unitLabel, 80),
    quantity,
    requestedQuantity,
    presentationLabel: normalizeText(data.presentationLabel, 120),
    destinationId: normalizeText(data.destinationId, 80),
    destinationName: normalizeText(data.destinationName, 120),
    withdrawnBy: normalizeText(data.withdrawnBy, 160),
    operatorUid: normalizeText(data.operatorUid, 180),
    movementId: nullableString(data.movementId),
    withdrawalId: nullableString(data.withdrawalId),
    lineId: nullableString(data.lineId),
    intakeId: nullableString(data.intakeId),
    invoiceRecordKey: nullableString(data.invoiceRecordKey),
    barcode: nullableString(data.barcode),
    lotCode: nullableString(data.lotCode),
    positionLabel: normalizeText(data.positionLabel, 240),
    siscofisStatus: siscofisStatus as WarehouseConsumptionRecord['siscofisStatus'],
    occurredAt: nullableTimestamp(data.occurredAt),
    updatedAt: nullableTimestamp(data.updatedAt),
    siscofisUpdatedBy: nullableString(data.siscofisUpdatedBy),
    siscofisUpdatedAt: nullableTimestamp(data.siscofisUpdatedAt),
    returnedQuantity,
    lastReturnMovementId: nullableString(data.lastReturnMovementId),
    lastReturnAt: nullableTimestamp(data.lastReturnAt),
    lastReturnBy: nullableString(data.lastReturnBy),
    lastReturnReason: nullableString(data.lastReturnReason),
    legacy: false,
  };
}

function parseMovement(document: FirestoreDocumentPayload): WarehouseMovement {
  const data = fromFirestoreFields(document.fields || {});
  const result = validateWarehouseMovement(
    {
      schemaVersion: data.schemaVersion,
      id: data.id,
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
    {
      expectedWorkspaceId: HGESM_WORKSPACE_ID,
      expectedUg: HGESM_UG,
    }
  );
  if (!result.ok) {
    throw new WarehouseOutboundReturnFailure(
      'Movimento de estoque inválido.',
      'CONFLICT',
      409
    );
  }
  return result.data;
}

function parseMaterial(
  document: FirestoreDocumentPayload,
  materialId: string
): WarehouseMaterial {
  const data = fromFirestoreFields(document.fields || {});
  const result = validateWarehouseMaterial(
    { ...data, id: materialId },
    {
      expectedWorkspaceId: HGESM_WORKSPACE_ID,
      expectedUg: HGESM_UG,
    }
  );
  if (!result.ok) {
    throw new WarehouseOutboundReturnFailure(
      'Material inválido para devolução.',
      'CONFLICT',
      409
    );
  }
  return result.data;
}

function parseBalance(
  document: FirestoreDocumentPayload,
  materialId: string
): WarehouseBalance {
  const data = fromFirestoreFields(document.fields || {});
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
    {
      expectedWorkspaceId: HGESM_WORKSPACE_ID,
      expectedUg: HGESM_UG,
      expectedMaterialId: materialId,
    }
  );
  if (!result.ok) {
    throw new WarehouseOutboundReturnFailure(
      'Saldo agregado inválido para devolução.',
      'CONFLICT',
      409
    );
  }
  return result.data;
}

function parseLocationBalance(
  document: FirestoreDocumentPayload,
  materialId: string
): WarehouseLocationBalance {
  const data = fromFirestoreFields(document.fields || {});
  const id = document.name?.split('/').pop() || '';
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
    {
      expectedWorkspaceId: HGESM_WORKSPACE_ID,
      expectedMaterialId: materialId,
    }
  );
  if (!result.ok) {
    throw new WarehouseOutboundReturnFailure(
      'Saldo físico inválido para devolução.',
      'CONFLICT',
      409
    );
  }
  return result.data;
}

function parseLot(
  document: FirestoreDocumentPayload,
  lotId: string
): WarehouseLot {
  const data = fromFirestoreFields(document.fields || {});
  const result = validateWarehouseLot(
    {
      schemaVersion: data.schemaVersion,
      id: lotId,
      workspaceId: data.workspaceId,
      ug: data.ug,
      materialId: data.materialId,
      code: data.code,
      expiresOn: data.expiresOn ?? null,
      quantity: data.quantity,
      position: data.position,
      origin: data.origin,
      status: data.status,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    },
    {
      expectedWorkspaceId: HGESM_WORKSPACE_ID,
      expectedUg: HGESM_UG,
    }
  );
  if (!result.ok) {
    throw new WarehouseOutboundReturnFailure(
      'Referência técnica de validade inválida.',
      'CONFLICT',
      409
    );
  }
  return result.data;
}

function createReturnLotId(movementId: string): string {
  const match = /^mov_([a-f0-9]{64})$/.exec(movementId);
  if (!match) {
    throw new WarehouseOutboundReturnFailure(
      'Identidade da devolução inválida.',
      'CONFLICT',
      409
    );
  }
  return 'lot_' + match[1].slice(32);
}

async function enrichReturnedLot(
  accessToken: string,
  actorUid: string,
  movement: WarehouseMovement
): Promise<WarehouseLot | null> {
  const source = movement.source;
  if (source?.kind !== 'OUTBOUND_RETURN' || !source.lotId) return null;

  const originalLotPath = `warehouse/${HGESM_WORKSPACE_ID}/lots/${source.lotId}`;
  const returnLotId = createReturnLotId(movement.id);
  const returnLotPath = `warehouse/${HGESM_WORKSPACE_ID}/lots/${returnLotId}`;
  const transaction = await beginTransaction(accessToken);

  try {
    const documents = await batchGetDocuments(
      accessToken,
      transaction,
      [originalLotPath, returnLotPath]
    );
    const existing = documents.get(firestoreDocumentName(returnLotPath));
    if (existing?.fields) {
      const lot = parseLot(existing, returnLotId);
      if (
        lot.materialId !== movement.materialId
        || lot.quantity !== source.quantity
        || lot.origin.kind !== 'MANUAL_ENRICHMENT'
        || lot.origin.movementId !== movement.id
        || JSON.stringify(lot.position) !== JSON.stringify(source.position)
      ) {
        throw new WarehouseOutboundReturnFailure(
          'Conflito no enriquecimento idempotente da validade.',
          'CONFLICT',
          409
        );
      }
      await rollbackTransaction(accessToken, transaction);
      return lot;
    }

    const originalDocument = requireDocument(
      documents,
      originalLotPath,
      'Referência técnica original não encontrada.'
    );
    const original = parseLot(originalDocument, source.lotId);
    if (
      original.status !== 'active'
      || original.materialId !== movement.materialId
      || JSON.stringify(original.position) !== JSON.stringify(source.position)
    ) {
      throw new WarehouseOutboundReturnFailure(
        'A validade original não corresponde à saída devolvida.',
        'CONFLICT',
        409
      );
    }

    const candidateValidation = validateWarehouseLot(
      {
        schemaVersion: WAREHOUSE_LOT_SCHEMA_VERSION,
        id: returnLotId,
        workspaceId: HGESM_WORKSPACE_ID,
        ug: HGESM_UG,
        materialId: movement.materialId,
        code: original.code,
        expiresOn: original.expiresOn,
        quantity: source.quantity,
        position: source.position,
        origin: {
          kind: 'MANUAL_ENRICHMENT',
          movementId: movement.id,
          invoiceRecordKey: null,
          invoiceId: null,
          supplier: null,
          supplierCnpj: null,
        },
        status: 'active',
        createdBy: actorUid,
        updatedBy: actorUid,
      },
      {
        expectedWorkspaceId: HGESM_WORKSPACE_ID,
        expectedUg: HGESM_UG,
        expectedMaterialId: movement.materialId,
      }
    );
    if (!candidateValidation.ok) {
      throw new WarehouseOutboundReturnFailure(
        'Não foi possível reconstruir a validade da quantidade devolvida.',
        'CONFLICT',
        409
      );
    }

    const now = new Date();
    await commitTransaction(accessToken, transaction, [{
      update: {
        name: firestoreDocumentName(returnLotPath),
        fields: toFirestoreFields({
          ...candidateValidation.data,
          createdAt: now,
          updatedAt: now,
        }),
      },
      currentDocument: { exists: false },
    }]);
    return candidateValidation.data;
  } catch (error) {
    await rollbackTransaction(accessToken, transaction);
    throw error;
  }
}

function normalizeAdminError(error: unknown): WarehouseOutboundReturnFailure {
  if (error instanceof WarehouseOutboundReturnFailure) return error;
  const message = error instanceof Error ? error.message : '';

  if (message === 'WAREHOUSE_OUTBOUND_RETURN_EXCEEDS_REMAINING') {
    return new WarehouseOutboundReturnFailure(
      'A quantidade informada supera o saldo ainda retirado desta saída.',
      'CONFLICT',
      409
    );
  }

  if (
    message.startsWith('WAREHOUSE_OUTBOUND_RETURN_')
    || message.startsWith('WAREHOUSE_INVALID_OUTBOUND_RETURN')
    || message.startsWith('WAREHOUSE_LOCATION_')
    || message.startsWith('WAREHOUSE_BALANCE_')
  ) {
    return new WarehouseOutboundReturnFailure(
      'A saída ou o estoque mudou e a devolução não pôde ser confirmada. Atualize o registro e tente novamente.',
      'CONFLICT',
      409
    );
  }

  if (
    message.includes('PERMISSION_DENIED')
    || message.includes('SERVICE_DISABLED')
    || message.includes('IAM_PERMISSION_DENIED')
  ) {
    return new WarehouseOutboundReturnFailure(
      'A credencial administrativa não possui permissão de escrita no banco do ADM Depósito.',
      'SERVER_CONFIGURATION',
      503
    );
  }
  return new WarehouseOutboundReturnFailure(
    'Não foi possível concluir a devolução com segurança.',
    'UPSTREAM_ERROR',
    500
  );
}

export async function returnWarehouseStockOutboundAdmin(
  input: WarehouseOutboundReturnAdminInput
): Promise<WarehouseOutboundReturnAdminResult> {
  const actorUid = normalizeText(input.actorUid, 180);
  const consumptionId = normalizeUnboundedText(input.consumptionId).toLowerCase();
  const reason = normalizeUnboundedText(input.reason);
  const operationId = normalizeUnboundedText(input.operationId);
  const quantity = normalizeWarehouseQuantity(input.quantity);

  if (
    !actorUid
    || !/^cons_[a-f0-9]{64}$/.test(consumptionId)
    || !/^[A-Za-z0-9_-]{8,96}$/.test(operationId)
    || !reason
    || reason.length > 180
    || quantity === null
    || quantity <= 0
  ) {
    throw new WarehouseOutboundReturnFailure(
      'A solicitação de devolução é inválida.',
      'INVALID_INPUT',
      400
    );
  }

  const movementId = await createWarehouseMovementId(
    HGESM_WORKSPACE_ID,
    ('outbound-return:' + consumptionId + ':' + operationId).slice(0, 240)
  );
  const accessToken = await getGoogleAccessToken();
  const transaction = await beginTransaction(accessToken);

  try {
    const consumptionPath = `warehouse/${HGESM_WORKSPACE_ID}/consumptions/${consumptionId}`;
    const replayPath = `warehouse/${HGESM_WORKSPACE_ID}/movements/${movementId}`;

    const firstRead = await batchGetDocuments(
      accessToken,
      transaction,
      [consumptionPath, replayPath]
    );
    const consumptionDocument = requireDocument(
      firstRead,
      consumptionPath,
      'Saída não encontrada.'
    );
    const consumption = parseConsumption(consumptionDocument, consumptionId);
    const replayDocument = firstRead.get(firestoreDocumentName(replayPath));
    const replayMovement = replayDocument?.fields
      ? parseMovement(replayDocument)
      : null;

    if (
      consumption.origin !== 'STOCK_OUTBOUND'
      || !consumption.materialId
      || !/^mat_[a-f0-9]{32}$/.test(consumption.materialId)
      || !consumption.movementId
      || !/^mov_[a-f0-9]{64}$/.test(consumption.movementId)
      || consumption.legacy
    ) {
      throw new WarehouseOutboundReturnFailure(
        'Esta saída não possui estrutura suficiente para devolução segura.',
        'CONFLICT',
        409
      );
    }

    if (replayMovement) {
      const source = replayMovement.source;
      if (
        replayMovement.id !== movementId
        || replayMovement.workspaceId !== HGESM_WORKSPACE_ID
        || replayMovement.ug !== HGESM_UG
        || replayMovement.materialId !== consumption.materialId
        || replayMovement.type !== 'OUTBOUND_RETURN'
        || source?.kind !== 'OUTBOUND_RETURN'
        || source.actorUid !== actorUid
        || source.consumptionId !== consumptionId
        || source.originalMovementId !== consumption.movementId
        || source.quantity !== quantity
        || source.reason !== reason
      ) {
        throw new WarehouseOutboundReturnFailure(
          'A mesma operação já foi usada com outros dados.',
          'CONFLICT',
          409
        );
      }
    }

    const originalMovementPath = `warehouse/${HGESM_WORKSPACE_ID}/movements/${consumption.movementId}`;
    const materialPath = `warehouse/${HGESM_WORKSPACE_ID}/materials/${consumption.materialId}`;
    const balancePath = `warehouse/${HGESM_WORKSPACE_ID}/balances/${consumption.materialId}`;

    const secondRead = await batchGetDocuments(
      accessToken,
      transaction,
      [originalMovementPath, materialPath, balancePath]
    );
    const originalMovement = parseMovement(
      requireDocument(secondRead, originalMovementPath, 'Movimento original não encontrado.')
    );
    if (originalMovement.source?.kind !== 'EXPRESS_OUTBOUND') {
      throw new WarehouseOutboundReturnFailure(
        'A saída original não é compatível com devolução automática.',
        'CONFLICT',
        409
      );
    }

    const locationPath = `warehouse/${HGESM_WORKSPACE_ID}/locationBalances/${originalMovement.source.locationBalanceId}`;
    const thirdRead = await batchGetDocuments(
      accessToken,
      transaction,
      [locationPath]
    );

    const material = parseMaterial(
      requireDocument(secondRead, materialPath, 'Material não encontrado.'),
      consumption.materialId
    );
    const balance = parseBalance(
      requireDocument(secondRead, balancePath, 'Saldo agregado não encontrado.'),
      consumption.materialId
    );
    const locationBalance = parseLocationBalance(
      requireDocument(thirdRead, locationPath, 'Saldo físico não encontrado.'),
      consumption.materialId
    );

    if (replayMovement) {
      await rollbackTransaction(accessToken, transaction);

      const warnings: string[] = [];
      let lot: WarehouseLot | null = null;
      try {
        lot = await enrichReturnedLot(accessToken, actorUid, replayMovement);
      } catch {
        warnings.push(
          'O saldo já estava devolvido, mas a validade técnica precisa ser revisada no Controle de Itens.'
        );
      }

      return {
        movement: replayMovement,
        consumption,
        balance,
        locationBalance,
        lot,
        warnings,
      };
    }

    const plan = planWarehouseOutboundReturn({
      workspaceId: HGESM_WORKSPACE_ID,
      ug: HGESM_UG,
      actorUid,
      movementId,
      quantity,
      reason,
      consumption,
      originalMovement,
      material,
      balance,
      locationBalance,
    });

    const now = new Date();
    const nextConsumption: WarehouseConsumptionRecord = {
      ...consumption,
      returnedQuantity: plan.returnedQuantity,
      lastReturnMovementId: plan.movement.id,
      lastReturnAt: now.toISOString(),
      lastReturnBy: actorUid,
      lastReturnReason: reason,
      updatedAt: now.toISOString(),
    };

    const writes: FirestoreWrite[] = [
      {
        update: {
          name: firestoreDocumentName(replayPath),
          fields: toFirestoreFields({
            ...plan.movement,
            createdAt: now,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: firestoreDocumentName(balancePath),
          fields: toFirestoreFields({
            ...plan.balance,
            updatedAt: now,
          }),
        },
        currentDocument: balanceDocumentPrecondition(
          requireDocument(secondRead, balancePath, 'Saldo agregado não encontrado.')
        ),
      },
      {
        update: {
          name: firestoreDocumentName(locationPath),
          fields: toFirestoreFields({
            ...plan.locationBalance,
            updatedAt: now,
          }),
        },
        currentDocument: balanceDocumentPrecondition(
          requireDocument(thirdRead, locationPath, 'Saldo físico não encontrado.')
        ),
      },
      {
        update: {
          name: firestoreDocumentName(consumptionPath),
          fields: toFirestoreFields({
            returnedQuantity: nextConsumption.returnedQuantity,
            lastReturnMovementId: nextConsumption.lastReturnMovementId,
            lastReturnAt: now,
            lastReturnBy: nextConsumption.lastReturnBy,
            lastReturnReason: nextConsumption.lastReturnReason,
            updatedAt: now,
          }),
        },
        updateMask: {
          fieldPaths: [
            'returnedQuantity',
            'lastReturnMovementId',
            'lastReturnAt',
            'lastReturnBy',
            'lastReturnReason',
            'updatedAt',
          ],
        },
        currentDocument: balanceDocumentPrecondition(consumptionDocument),
      },
    ];

    await commitTransaction(accessToken, transaction, writes);

    const warnings: string[] = [];
    let lot: WarehouseLot | null = null;
    try {
      lot = await enrichReturnedLot(accessToken, actorUid, plan.movement);
    } catch {
      warnings.push(
        'O saldo voltou ao estoque, mas a validade técnica não pôde ser recomposta automaticamente. Revise a validade no Controle de Itens.'
      );
    }

    return {
      movement: plan.movement,
      consumption: nextConsumption,
      balance: plan.balance,
      locationBalance: plan.locationBalance,
      lot,
      warnings,
    };
  } catch (error) {
    await rollbackTransaction(accessToken, transaction);
    throw normalizeAdminError(error);
  }
}

function balanceDocumentPrecondition(
  document: FirestoreDocumentPayload
): { updateTime?: string } {
  return document.updateTime ? { updateTime: document.updateTime } : {};
}
