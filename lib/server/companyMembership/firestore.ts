import firebaseConfig from '../../../config/empresas-firebase-web.json';
import { getCompanyAccessToken } from '../companyFirebaseRuntime';
import { companyCollectionPath, companyDocumentPath } from '../../company/contracts';

type Value =
  | { stringValue: string } | { booleanValue: boolean } | { integerValue: string }
  | { doubleValue: number } | { nullValue: 'NULL_VALUE' }
  | { mapValue: { fields: Record<string, Value> } }
  | { arrayValue: { values: Value[] } };
type FireDocument = { name?: string; fields?: Record<string, Value>; updateTime?: string };
type Write = {
  update: { name: string; fields: Record<string, Value> };
  currentDocument: { exists: false } | { updateTime: string };
};
export class MembershipStoreError extends Error {
  constructor(public readonly code: 'CONFLICT' | 'UNAVAILABLE', public readonly status: 409 | 503) {
    super(code);
  }
}
const root = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
function target() {
  if (process.env.EMPROVEX_E2E_SERVER_AUTH !== '1') {
    return { url: `https://firestore.googleapis.com/v1/${root}`, emulator: false };
  }
  const id = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim() || '';
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  if (!id.startsWith('demo-') || !['127.0.0.1:8080','localhost:8080'].includes(host)
    || !['127.0.0.1:9099','localhost:9099'].includes(authHost)
    || process.env.K_SERVICE || process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new MembershipStoreError('UNAVAILABLE', 503);
  }
  return {
    url: `http://${host}/v1/projects/${encodeURIComponent(id)}/databases/(default)/documents`,
    emulator: true,
  };
}
function encode(value: unknown): Value {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isSafeInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number' && Number.isFinite(value)) return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'object' && value) return { mapValue: { fields: fields(value as Record<string, unknown>) } };
  throw new MembershipStoreError('UNAVAILABLE', 503);
}
function fields(record: Record<string, unknown>): Record<string, Value> {
  return Object.fromEntries(Object.entries(record).filter(([,v]) => v !== undefined)
    .map(([k,v]) => [k, encode(v)]));
}
function decode(value: Value): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return value.arrayValue.values.map(decode);
  return fromFields(value.mapValue.fields);
}
function fromFields(f: Record<string, Value> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).map(([k,v]) => [k, decode(v)]));
}
function safePath(path: string): string {
  const segments = path.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..'
    || segment.length > 256 || /[?#]/.test(segment))) {
    throw new MembershipStoreError('UNAVAILABLE', 503);
  }
  return segments.map(encodeURIComponent).join('/');
}
async function access() {
  const cfg = target();
  try {
    return { ...cfg, token: cfg.emulator ? 'owner' : await getCompanyAccessToken() };
  } catch {
    throw new MembershipStoreError('UNAVAILABLE', 503);
  }
}
async function doFetch(path: string, init?: RequestInit): Promise<Response> {
  const c = await access();
  try {
    return await fetch(c.url + path, {
      ...init, headers: { authorization: `Bearer ${c.token}`,
        ...(init?.body ? { 'content-type': 'application/json' } : {}) },
      cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new MembershipStoreError('UNAVAILABLE', 503);
  }
}
export interface StoredDocument<T> { value: T; updateTime: string }
export async function getDocument<T>(path: string): Promise<StoredDocument<T> | null> {
  const response = await doFetch('/' + safePath(path));
  if (response.status === 404) return null;
  if (!response.ok) throw new MembershipStoreError('UNAVAILABLE', 503);
  const doc = await response.json() as FireDocument;
  if (!doc.updateTime) throw new MembershipStoreError('UNAVAILABLE', 503);
  return { value: fromFields(doc.fields) as T, updateTime: doc.updateTime };
}
export async function listDocuments<T>(companyId: string, pageSize: number, pageToken: string) {
  const collection = companyCollectionPath(companyId, 'members');
  const q = new URLSearchParams({ pageSize: String(pageSize) });
  if (pageToken) q.set('pageToken', pageToken);
  const response = await doFetch('/' + safePath(collection) + '?' + q.toString());
  if (response.status === 404) return { members: [] as StoredDocument<T>[], nextPageToken: '' };
  if (!response.ok) throw new MembershipStoreError('UNAVAILABLE', 503);
  const payload = await response.json() as { documents?: FireDocument[]; nextPageToken?: string };
  return {
    members: (payload.documents || []).filter(d => d.updateTime)
      .map(d => ({ value: fromFields(d.fields) as T, updateTime: d.updateTime! })),
    nextPageToken: payload.nextPageToken || '',
  };
}
/** Atomic all-or-nothing member write and append-only audit. updateTime = CAS. */
export async function commitMemberChange(
  companyId: string,
  memberId: string,
  record: Record<string, unknown>,
  expectedUpdateTime: string | null,
  eventId: string,
  audit: Record<string, unknown>,
  memberIndex?: { uid: string; email: string; companyId: string; existingUpdateTime: string | null },
): Promise<void> {
  const c = await access();
  const memberPath = companyDocumentPath(companyId, 'members', memberId);
  const auditPath = companyDocumentPath(companyId, 'auditEvents', eventId);
  // Firestore commit expects projects/.../documents/... regardless of REST host.
  const prefix = c.emulator
    ? `projects/${process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID}/databases/(default)/documents`
    : root;
  const writes: Write[] = [
    { update: { name: prefix + '/' + memberPath, fields: fields(record) },
      currentDocument: expectedUpdateTime
        ? { updateTime: expectedUpdateTime } : { exists: false } },
    { update: { name: prefix + '/' + auditPath, fields: fields(audit) },
      currentDocument: { exists: false } },
  ];
  // Atomic UID selector, not an authorization grant. The guard checks membership LIVE.
  if (memberIndex) {
    if (memberIndex.companyId !== companyId || !/^[^/.]{1,128}$/.test(memberIndex.uid)) {
      throw new MembershipStoreError('UNAVAILABLE', 503);
    }
    writes.push({
      update: {
        name: prefix + '/companyMemberAuthIndex/' + memberIndex.uid,
        fields: fields({ firebaseUid: memberIndex.uid, email: memberIndex.email,
          companyId, workspaceId: companyId }),
      },
      currentDocument: memberIndex.existingUpdateTime
        ? { updateTime: memberIndex.existingUpdateTime } : { exists: false },
    });
  }
  let response: Response;
  try {
    response = await fetch(c.url + ':commit', {
      method: 'POST',
      headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ writes }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new MembershipStoreError('UNAVAILABLE', 503);
  }
  if (response.ok) return;
  const body = (await response.text()).slice(0, 600);
  if (response.status === 409 || response.status === 412
    || /ALREADY_EXISTS|FAILED_PRECONDITION|ABORTED|entity already exists/i.test(body)) {
    throw new MembershipStoreError('CONFLICT', 409);
  }
  throw new MembershipStoreError('UNAVAILABLE', 503);
}
export async function readIdentityDocument(collection: 'platformAccounts' | 'platformAuthUidIndex' | 'workspaces' | 'companyMemberAuthIndex', id: string) {
  if (!/^[^/]{1,256}$/.test(id) || id.includes('..')) throw new MembershipStoreError('UNAVAILABLE', 503);
  return getDocument<Record<string, unknown>>(`${collection}/${id}`);
}
