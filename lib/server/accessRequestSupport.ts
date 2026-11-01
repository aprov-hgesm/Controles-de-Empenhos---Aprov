/**
 * EMPROVEX Suporte W2: contratos pequenos e puros para interessados.
 * A coleção existente permanece como fonte de verdade. Sem vínculo implícito
 * com workspace, billing, trial ou contas do Firebase Auth.
 */
export const ACCESS_REQUEST_PAGE_SIZE = 25;
export const ACCESS_REQUEST_NOTE_LIMIT = 280;
export const ACCESS_REQUEST_REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const ACCESS_REQUEST_STATUSES = [
  'novo', 'contatado', 'em_teste', 'concluido', 'descartado',
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

type FirestoreValue = { stringValue?: string; timestampValue?: string };
export type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};
type Fetcher = typeof fetch;

const readField = (document: FirestoreDocument, key: string) =>
  document.fields?.[key]?.stringValue || document.fields?.[key]?.timestampValue || '';

export function mapAccessRequest(document: FirestoreDocument) {
  return {
    id: document.name.split('/').pop() || '',
    nomeCompleto: readField(document, 'nomeCompleto'),
    patente: readField(document, 'patente'),
    organizacaoMilitar: readField(document, 'organizacaoMilitar'),
    email: readField(document, 'email'),
    whatsapp: readField(document, 'whatsapp'),
    status: readField(document, 'status') || 'novo',
    createdAt: readField(document, 'createdAt'),
    updatedAt: readField(document, 'updatedAt'),
    lastRequestedAt: readField(document, 'lastRequestedAt'),
    lastContactAt: readField(document, 'lastContactAt'),
    nextActionAt: readField(document, 'nextActionAt'),
    adminNote: readField(document, 'adminNote'),
    version: document.updateTime || '',
  };
}

export function validAccessRequestPageToken(value: string | null): boolean {
  return value === null || (value.length <= 4096 && /^[A-Za-z0-9+/_=.\\-]+$/.test(value));
}

export async function listAccessRequestPage(
  baseUrl: string,
  token: string,
  pageToken: string | null,
  fetcher: Fetcher = fetch
) {
  if (!validAccessRequestPageToken(pageToken)) throw new Error('INVALID_PAGE_TOKEN');
  const params = new URLSearchParams({
    pageSize: String(ACCESS_REQUEST_PAGE_SIZE),
    orderBy: 'createdAt desc',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const response = await fetcher(baseUrl + '?' + params.toString(), {
    headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível consultar interessados.');
  const data = await response.json() as {
    documents?: FirestoreDocument[]; nextPageToken?: string;
  };
  return {
    records: (data.documents || []).map(mapAccessRequest),
    nextPageToken: data.nextPageToken || null,
  };
}

function validDate(value: unknown): value is string {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export type AccessRequestPatch = {
  id: string;
  version: string;
  fields: Record<string, FirestoreValue>;
  fieldPaths: string[];
};

export function parseAccessRequestPatch(value: unknown, now: string): AccessRequestPatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const permitted = new Set(['id', 'version', 'status', 'adminNote', 'lastContactAt', 'nextActionAt']);
  if (Object.keys(body).some(key => !permitted.has(key))) return null;
  if (typeof body.id !== 'string' || !/^[a-f0-9]{64}$/.test(body.id)
    || typeof body.version !== 'string' || !Number.isFinite(Date.parse(body.version))) return null;

  const fields: Record<string, FirestoreValue> = {};
  const fieldPaths: string[] = [];
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (typeof body.status !== 'string' || !ACCESS_REQUEST_STATUSES.includes(body.status as AccessRequestStatus)) return null;
    fields.status = { stringValue: body.status };
    fieldPaths.push('status');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'adminNote')) {
    if (typeof body.adminNote !== 'string' || body.adminNote.length > ACCESS_REQUEST_NOTE_LIMIT
      || /[\\u0000-\\u001F\\u007F]/.test(body.adminNote)) return null;
    fields.adminNote = { stringValue: body.adminNote.normalize('NFC').trim() };
    fieldPaths.push('adminNote');
  }
  for (const key of ['lastContactAt', 'nextActionAt'] as const) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (!validDate(body[key])) return null;
    fields[key] = { stringValue: body[key] as string };
    fieldPaths.push(key);
  }
  if (!fieldPaths.length) return null;
  fields.updatedAt = { timestampValue: now };
  fieldPaths.push('updatedAt');
  return { id: body.id, version: body.version, fields, fieldPaths };
}

/**
 * Reenvio não reabre o lead, não substitui dados do fundador e não duplica docs.
 * Uma tentativa persistida por janela >=24h, mesmo entre múltiplas instâncias.
 * 412 concorrente e falhas internas são neutras para o formulário público.
 */
export async function recordRepeatAccessRequest(
  baseUrl: string,
  id: string,
  token: string,
  now: string,
  fetcher: Fetcher = fetch
): Promise<'updated' | 'skipped'> {
  const url = baseUrl + '/' + id;
  const headers = { Authorization: 'Bearer ' + token };
  const response = await fetcher(url, { headers, cache: 'no-store' });
  if (!response.ok) return 'skipped';
  const document = await response.json() as FirestoreDocument;
  const latest = readField(document, 'lastRequestedAt') || readField(document, 'createdAt');
  const elapsed = Date.parse(now) - Date.parse(latest);
  if (!document.updateTime || !Number.isFinite(elapsed) || elapsed < ACCESS_REQUEST_REPEAT_WINDOW_MS) return 'skipped';
  const params = new URLSearchParams({
    'updateMask.fieldPaths': 'lastRequestedAt',
    'currentDocument.updateTime': document.updateTime,
  });
  const saved = await fetcher(url + '?' + params.toString(), {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { lastRequestedAt: { timestampValue: now } } }),
    cache: 'no-store',
  });
  return saved.ok ? 'updated' : 'skipped';
}
