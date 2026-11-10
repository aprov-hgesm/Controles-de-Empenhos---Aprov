import { randomUUID, createHash } from 'node:crypto';
import firebaseConfig from '../../../config/empresas-firebase-web.json';
import { companyDocumentPath, companyCollectionPath, COMPANY_CONTRACT_VERSION } from '../contracts';
import type { CompanyAuthorizedContext } from '../../server/companyAuthz';
import { getCompanyAccessToken } from '../../server/companyFirebaseRuntime';
import {
  CompanyDocumentError, type CompanyDocumentRecord, type CompanyDocumentKind,
  type CompanyReference, type NeReview, makeRecord, publicDocument, sha256,
  validateUpload, assertReadableCompanyDocument,
} from './model';

type FValue = { stringValue?: string; integerValue?: string; booleanValue?: boolean; nullValue?: null; arrayValue?: { values: FValue[] }; mapValue?: { fields: Record<string, FValue> } };
type FireDoc = { name: string; fields?: Record<string, FValue> };
const validId = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);
const encodeField = (value: unknown): FValue => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isSafeInteger(value)) return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeField) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  throw new CompanyDocumentError('DOCUMENT_DATA_INVALID', 422);
};
const encodeFields = (value: Record<string, unknown>): Record<string, FValue> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encodeField(v)]));
const decodeField = (value: FValue): unknown => {
  if ('stringValue' in value) return value.stringValue || '';
  if ('integerValue' in value) return Number(value.integerValue);
  if ('booleanValue' in value) return value.booleanValue || false;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeField);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([k, v]) => [k, decodeField(v)]));
  return null;
};
const decodeDoc = (value: FireDoc): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value.fields || {}).map(([k, v]) => [k, decodeField(v)]));

function emulatorRoot(): string | null {
  if (process.env.EMPROVEX_E2E_SERVER_AUTH !== '1') return null;
  if (!process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.startsWith('demo-')
    || !['127.0.0.1:8080', 'localhost:8080'].includes(process.env.FIRESTORE_EMULATOR_HOST || '')) {
    throw new CompanyDocumentError('DOCUMENT_EMULATOR_CONFIGURATION_INVALID', 503);
  }
  return 'http://' + process.env.FIRESTORE_EMULATOR_HOST + '/v1/projects/'
    + encodeURIComponent(process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID)
    + '/databases/(default)/documents';
}
const liveRoot = 'https://firestore.googleapis.com/v1/projects/'
  + encodeURIComponent(firebaseConfig.projectId) + '/databases/'
  + encodeURIComponent(firebaseConfig.firestoreDatabaseId) + '/documents';
async function access() {
  const emulator = emulatorRoot();
  return { root: emulator || liveRoot, token: emulator ? 'owner' : await getCompanyAccessToken() };
}
function storageSettings() {
  const test = emulatorRoot() !== null;
  const bucket = process.env.EMPROVEX_COMPANY_DOCUMENTS_BUCKET || '';
  if (!/^[a-z0-9][a-z0-9._-]{2,62}$/.test(bucket) || bucket.includes('..')) {
    throw new CompanyDocumentError('DOCUMENT_STORAGE_NOT_CONFIGURED', 503);
  }
  if (test) {
    const endpoint = process.env.EMPROVEX_COMPANY_GCS_EMULATOR_URL || '';
    if (!['http://127.0.0.1:4443', 'http://localhost:4443'].includes(endpoint)) {
      throw new CompanyDocumentError('DOCUMENT_STORAGE_NOT_CONFIGURED', 503);
    }
    return { endpoint, bucket };
  }
  return { endpoint: 'https://storage.googleapis.com', bucket };
}
const requestTimeout = 12000;
async function firestoreGet(path: string): Promise<Record<string, unknown> | null> {
  const auth = await access();
  const response = await fetch(auth.root + '/' + path, {
    headers: { authorization: 'Bearer ' + auth.token }, cache: 'no-store',
    signal: AbortSignal.timeout(requestTimeout),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new CompanyDocumentError('DOCUMENT_DATABASE_UNAVAILABLE', 503);
  return decodeDoc(await response.json() as FireDoc);
}
export async function companyEntity(
  ctx: CompanyAuthorizedContext,
  collection: CompanyReference,
  id: string,
): Promise<Record<string, unknown>> {
  if (!validId(id) || !(['commitments', 'purchaseOrders', 'deliveries'] as string[]).includes(collection)) {
    throw new CompanyDocumentError('DOCUMENT_REFERENCE_INVALID', 400);
  }
  const record = await firestoreGet(companyDocumentPath(ctx.companyId, collection, id));
  if (!record || record.companyId !== ctx.companyId || record.workspaceId !== ctx.companyId) {
    throw new CompanyDocumentError('DOCUMENT_NOT_FOUND', 404);
  }
  return record;
}
export async function readDocument(ctx: CompanyAuthorizedContext, id: string): Promise<CompanyDocumentRecord> {
  if (!validId(id)) throw new CompanyDocumentError('DOCUMENT_NOT_FOUND', 404);
  const record = await firestoreGet(companyDocumentPath(ctx.companyId, 'documents', id));
  if (!record) throw new CompanyDocumentError('DOCUMENT_NOT_FOUND', 404);
  const result = record as unknown as CompanyDocumentRecord;
  assertReadableCompanyDocument(ctx.companyId, result);
  return result;
}
export async function listDocuments(ctx: CompanyAuthorizedContext, token?: string) {
  if (token && (token.length > 2048 || !/^[A-Za-z0-9_+\/-]+={0,2}$/.test(token))) {
    throw new CompanyDocumentError('DOCUMENT_PAGE_INVALID', 400);
  }
  const auth = await access();
  const params = new URLSearchParams({ pageSize: '25' });
  if (token) params.set('pageToken', token);
  const response = await fetch(auth.root + '/' + companyCollectionPath(ctx.companyId, 'documents') + '?' + params.toString(), {
    headers: { authorization: 'Bearer ' + auth.token }, cache: 'no-store', signal: AbortSignal.timeout(requestTimeout),
  });
  if (response.status === 404) return { documents: [], nextPageToken: null };
  if (!response.ok) throw new CompanyDocumentError('DOCUMENT_DATABASE_UNAVAILABLE', 503);
  const body = await response.json() as { documents?: FireDoc[]; nextPageToken?: string };
  const documents = (body.documents || []).map(decodeDoc).map(x => x as unknown as CompanyDocumentRecord);
  for (const record of documents) assertReadableCompanyDocument(ctx.companyId, record);
  return { documents: documents.map(publicDocument), nextPageToken: body.nextPageToken || null };
}
async function uploadObject(token: string, objectPath: string, bytes: Uint8Array, mime: string) {
  const { endpoint, bucket } = storageSettings();
  const params = new URLSearchParams({ uploadType: 'media', name: objectPath, ifGenerationMatch: '0' });
  const response = await fetch(endpoint + '/upload/storage/v1/b/' + encodeURIComponent(bucket) + '/o?' + params.toString(), {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': mime },
    body: Buffer.from(bytes), cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new CompanyDocumentError('DOCUMENT_STORAGE_UNAVAILABLE', 503);
}
async function deleteObject(token: string, objectPath: string) {
  const { endpoint, bucket } = storageSettings();
  await fetch(endpoint + '/storage/v1/b/' + encodeURIComponent(bucket) + '/o/' + encodeURIComponent(objectPath), {
    method: 'DELETE', headers: { authorization: 'Bearer ' + token },
    cache: 'no-store', signal: AbortSignal.timeout(requestTimeout),
  }).catch(() => undefined);
}
export async function downloadDocument(ctx: CompanyAuthorizedContext, record: CompanyDocumentRecord): Promise<Uint8Array> {
  assertReadableCompanyDocument(ctx.companyId, record);
  if (!record.storageObject.startsWith('company-documents/' + ctx.companyId + '/' + record.id + '/')) {
    throw new CompanyDocumentError('DOCUMENT_NOT_FOUND', 404);
  }
  const auth = await access();
  const { endpoint, bucket } = storageSettings();
  const response = await fetch(endpoint + '/storage/v1/b/' + encodeURIComponent(bucket) + '/o/'
    + encodeURIComponent(record.storageObject) + '?alt=media', {
    headers: { authorization: 'Bearer ' + auth.token }, cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 404) throw new CompanyDocumentError('DOCUMENT_NOT_FOUND', 404);
  if (!response.ok) throw new CompanyDocumentError('DOCUMENT_STORAGE_UNAVAILABLE', 503);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== record.byteLength || sha256(bytes) !== record.sha256) {
    throw new CompanyDocumentError('DOCUMENT_INTEGRITY_FAILED', 503);
  }
  return bytes;
}
function createWrite(root: string, path: string, fields: Record<string, unknown>) {
  return {
    update: { name: root + '/' + path, fields: encodeFields(fields) },
    currentDocument: { exists: false },
  };
}
export async function saveDocument(input: {
  ctx: CompanyAuthorizedContext;
  file: File;
  kind: CompanyDocumentKind;
  referenceType: CompanyReference | null;
  referenceId: string | null;
  idempotencyKey: string;
  review?: NeReview;
  originalExtraction?: NeReview;
}): Promise<{ document: ReturnType<typeof publicDocument>; replayed: boolean }> {
  const { ctx, file, kind, referenceType, referenceId, idempotencyKey } = input;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new CompanyDocumentError('DOCUMENT_IDEMPOTENCY_KEY_REQUIRED', 400);
  if ((referenceType === null) !== (referenceId === null)) throw new CompanyDocumentError('DOCUMENT_REFERENCE_INVALID', 400);
  if (kind !== 'ne' && (referenceType === null || referenceId === null)) throw new CompanyDocumentError('DOCUMENT_REFERENCE_REQUIRED', 400);
  if (kind === 'ne' && (!input.review || !input.originalExtraction)) throw new CompanyDocumentError('NE_REVIEW_REQUIRED', 422);
  if (referenceType && referenceId) await companyEntity(ctx, referenceType, referenceId);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const verified = validateUpload(file, bytes, kind);
  const contentHash = sha256(bytes);
  const requestHash = createHash('sha256').update(JSON.stringify({
    companyId: ctx.companyId, kind, referenceType, referenceId, hash: contentHash, review: input.review || null,
  })).digest('hex');
  const idemId = createHash('sha256').update(ctx.companyId + ':' + idempotencyKey).digest('hex');
  const idemPath = companyDocumentPath(ctx.companyId, 'idempotencyKeys', idemId);
  const previous = await firestoreGet(idemPath);
  if (previous) {
    if (previous.requestHash !== requestHash || typeof previous.documentId !== 'string') throw new CompanyDocumentError('DOCUMENT_IDEMPOTENCY_CONFLICT', 409);
    return { document: publicDocument(await readDocument(ctx, previous.documentId)), replayed: true };
  }
  const auth = await access();
  const id = randomUUID();
  const now = new Date().toISOString();
  const storageObject = 'company-documents/' + ctx.companyId + '/' + id + '/' + verified.filename;
  const record = makeRecord({
    kind, displayName: verified.filename, mediaType: verified.mime, byteLength: bytes.byteLength,
    sha256: contentHash, storageObject, referenceType, referenceId,
    review: input.review || null, originalExtraction: input.originalExtraction || null,
    confirmedByUid: kind === 'ne' ? ctx.uid : null,
    confirmedAt: kind === 'ne' ? now : null, expiresAt: null,
  }, { id, companyId: ctx.companyId, uid: ctx.uid, now });
  await uploadObject(auth.token, storageObject, bytes, verified.mime);
  try {
    const auditId = randomUUID();
    const writes = [
      createWrite(auth.root, companyDocumentPath(ctx.companyId, 'documents', id), record as unknown as Record<string, unknown>),
      createWrite(auth.root, idemPath, {
        schemaVersion: COMPANY_CONTRACT_VERSION, id: idemId, companyId: ctx.companyId,
        workspaceId: ctx.companyId, requestHash, documentId: id, actorUid: ctx.uid, createdAt: now,
      }),
      createWrite(auth.root, companyDocumentPath(ctx.companyId, 'auditEvents', auditId), {
        schemaVersion: COMPANY_CONTRACT_VERSION, eventId: auditId, companyId: ctx.companyId,
        actorUid: ctx.uid, action: 'documents:write', entityType: 'documents',
        entityId: id, correlationId: randomUUID(), idempotencyKey: idemId,
        beforeRevision: null, afterRevision: 1, occurredAt: now,
      }),
    ];
    const response = await fetch(auth.root + ':commit', {
      method: 'POST', headers: { authorization: 'Bearer ' + auth.token, 'content-type': 'application/json' },
      body: JSON.stringify({ writes }), cache: 'no-store', signal: AbortSignal.timeout(requestTimeout),
    });
    if (!response.ok) throw new CompanyDocumentError(response.status === 409 || response.status === 412
      ? 'DOCUMENT_IDEMPOTENCY_CONFLICT' : 'DOCUMENT_DATABASE_UNAVAILABLE', response.status === 409 || response.status === 412 ? 409 : 503);
  } catch (error) {
    // A transport timeout may occur *after* Firestore committed successfully.
    // Never delete a potentially committed object before reconciling the idempotency record.
    let existing: Record<string, unknown> | null = null;
    let reconciled = false;
    try { existing = await firestoreGet(idemPath); reconciled = true; }
    catch { /* Keep the object for administrative recovery rather than damage a committed record. */ }
    if (existing?.requestHash === requestHash && typeof existing.documentId === 'string') {
      return { document: publicDocument(await readDocument(ctx, existing.documentId)), replayed: true };
    }
    if (reconciled && !existing) await deleteObject(auth.token, storageObject);
    throw error;
  }
  return { document: publicDocument(record), replayed: false };
}
