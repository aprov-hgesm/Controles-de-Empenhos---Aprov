import firebaseConfig from '../../firebase-applet-config.json';

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = 'emprovex-warehouse';

export type FirestorePrimitive = string | number | boolean | null;
export type FirestoreValue = FirestorePrimitive | Date | FirestoreValue[] | { [key: string]: FirestoreValue | undefined };
type Encoded = Record<string, unknown>;

export interface WarehouseAdminDocument {
  path: string;
  data: Record<string, unknown>;
  updateTime: string;
}

export class WarehouseStoreError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'WarehouseStoreError';
  }
}

function encodeValue(value: FirestoreValue): Encoded {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new WarehouseStoreError('WAREHOUSE_INVALID_NUMBER', 400);
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  return { mapValue: { fields: encodeFields(value) } };
}

function encodeFields(value: Record<string, FirestoreValue | undefined>): Record<string, Encoded> {
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => [key, encodeValue(entry as FirestoreValue)]));
}

function decodeValue(value: Encoded): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return ((value.arrayValue as {values?: Encoded[]}).values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields((value.mapValue as {fields?: Record<string, Encoded>}).fields ?? {});
  return undefined;
}

function decodeFields(value: Record<string, Encoded>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, decodeValue(field)]));
}

function fullName(path: string): string {
  const warehouseDoc = /^warehouse\/[a-z0-9_-]+\/[A-Za-z]+\/[A-Za-z0-9_-]+$/;
  const inventoryItemDoc = /^warehouse\/[a-z0-9_-]+\/inventories\/inv_[a-f0-9]{32}\/items\/invit_[a-f0-9]{64}$/;
  if (!warehouseDoc.test(path) && !inventoryItemDoc.test(path)) {
    throw new WarehouseStoreError('WAREHOUSE_SERVER_INVALID_DOCUMENT_PATH', 400);
  }
  const effectiveProjectId = process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
    ? 'demo-emprovex-security' : PROJECT_ID;
  return `projects/${effectiveProjectId}/databases/${DATABASE_ID}/documents/${path}`;
}

function firestoreBase(): string {
  // Emulator only in explicitly configured test runtime, not from client input.
  if (process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1') {
    if (process.env.NODE_ENV === 'production') {
      throw new WarehouseStoreError('WAREHOUSE_SERVER_EMULATOR_PRODUCTION_FORBIDDEN', 503);
    }
    // O banco operacional principal usa 8080. O Warehouse possui Emulator
    // próprio (normalmente 8081), pois carrega um ruleset independente.
    if (process.env.EMPROVEX_E2E_SERVER_AUTH !== '1'
      || process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID !== 'demo-emprovex-security') {
      throw new WarehouseStoreError('WAREHOUSE_SERVER_EMULATOR_SCOPE_INVALID', 503);
    }
    const port = process.env.EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT?.trim()
      || process.env.NEXT_PUBLIC_EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT?.trim()
      || process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || '';
    if (!/^\d{2,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
      throw new WarehouseStoreError('WAREHOUSE_SERVER_EMULATOR_PORT_INVALID', 503);
    }
    return `http://127.0.0.1:${port}/v1/projects/demo-emprovex-security/databases/${DATABASE_ID}/documents`;
  }
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;
}

async function request(accessToken: string, operation: string, body: unknown): Promise<Response> {
  const emulator = process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1';
  const response = await fetch(firestoreBase() + operation, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + (emulator ? 'owner' : accessToken),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 409 || response.status === 412
        || detail.includes('ABORTED') || detail.includes('FAILED_PRECONDITION')) {
      throw new WarehouseStoreError('WAREHOUSE_CONCURRENT_MODIFICATION', 409);
    }
    // Never echo upstream bodies; they may contain sensitive metadata.
    throw new WarehouseStoreError('WAREHOUSE_SERVER_FIRESTORE_UNAVAILABLE', 503);
  }
  return response;
}

function parseStream(text: string): Array<Record<string, unknown>> {
  // Firestore batchGet REST streams JSON objects separated by newlines.
  // Some HTTP adapters return a JSON array instead.
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new WarehouseStoreError('WAREHOUSE_SERVER_READ_INVALID', 503);
    return parsed as Array<Record<string, unknown>>;
  }
  return trimmed.split(/\r?\n/).filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

export async function warehouseAdminTransaction<T>(
  accessToken: string,
  paths: string[],
  process: (
    read: ReadonlyMap<string, WarehouseAdminDocument | null>,
  ) => { result: T; writes: Array<{ path: string; data: Record<string, unknown> }> }
): Promise<T> {
  if (paths.length < 1 || paths.length > 128 || new Set(paths).size !== paths.length) {
    throw new WarehouseStoreError('WAREHOUSE_SERVER_INVALID_READ_SET', 400);
  }
  const names = paths.map(fullName);
  const begin = await request(accessToken, ':beginTransaction', { options: { readWrite: {} } });
  const transaction = (await begin.json() as {transaction?: string}).transaction;
  if (!transaction) throw new WarehouseStoreError('WAREHOUSE_SERVER_TRANSACTION_MISSING', 503);

  let committed = false;
  try {
    const response = await request(accessToken, ':batchGet', { documents: names, transaction });
    const rows = parseStream(await response.text());
    const read = new Map<string, WarehouseAdminDocument | null>();
    const prefix = fullName(paths[0]).slice(0, -paths[0].length);
    for (const row of rows) {
      const found = row.found as {name?: string;fields?: Record<string, Encoded>;updateTime?: string} | undefined;
      const name = found?.name ?? row.missing;
      if (typeof name !== 'string' || !names.includes(name)) {
        throw new WarehouseStoreError('WAREHOUSE_SERVER_READ_INVALID', 503);
      }
      const path = name.slice(prefix.length);
      if (read.has(path)) throw new WarehouseStoreError('WAREHOUSE_SERVER_READ_DUPLICATE', 503);
      read.set(path, found ? {
        path,
        data: decodeFields(found.fields ?? {}),
        updateTime: found.updateTime || '',
      } : null);
    }
    if (read.size !== paths.length) {
      throw new WarehouseStoreError('WAREHOUSE_SERVER_INCOMPLETE_READ', 503);
    }
    const plan = process(read);
    if (plan.writes.length === 0) {
      return plan.result;
    }
    if (plan.writes.length > 128 || new Set(plan.writes.map(w => w.path)).size !== plan.writes.length) {
      throw new WarehouseStoreError('WAREHOUSE_SERVER_INVALID_WRITE_SET', 400);
    }
    const writes = plan.writes.map(w => {
      const current = read.get(w.path);
      if (!read.has(w.path)) throw new WarehouseStoreError('WAREHOUSE_SERVER_WRITE_NOT_READ', 500);
      return {
        update: { name: fullName(w.path), fields: encodeFields(w.data as Record<string, FirestoreValue>) },
        currentDocument: current ? { updateTime: current.updateTime } : { exists: false },
      };
    });
    await request(accessToken, ':commit', { writes, transaction });
    committed = true;
    return plan.result;
  } finally {
    if (!committed) {
      // A transaction without commit expires eventually; release it promptly.
      await request(accessToken, ':rollback', { transaction }).catch(() => undefined);
    }
  }
}

// Server-side filtered query; the caller cannot choose collection or query
// arbitrarily. Used only for canonical lot planning before a transaction.
export async function warehouseAdminListByField(
  accessToken: string,
  workspaceId: string,
  domain: 'lots' | 'depots' | 'locations' | 'locationBalances',
  field: 'materialId' | 'code' | 'depotId',
  value: string,
  maxResults = 100
): Promise<WarehouseAdminDocument[]> {
  const parentPath = `warehouse/${workspaceId}`;
  // Validate the scope with the same strict document path guard.
  fullName(parentPath + '/' + domain + '/probe');
  if (value.length > 180 || !value
    || !Number.isInteger(maxResults) || maxResults < 1 || maxResults > 500) {
    throw new WarehouseStoreError('WAREHOUSE_SERVER_QUERY_INVALID', 400);
  }
  const response = await request(accessToken, '/' + parentPath + ':runQuery', {
    structuredQuery: {
      from: [{ collectionId: domain }],
      where: { fieldFilter: {
        field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value },
      } },
      limit: maxResults + 1,
    },
  });
  const rows = parseStream(await response.text());
  const prefix = fullName(parentPath + '/' + domain + '/probe').slice(0, -'probe'.length);
  const docs = rows
    .filter((row) => typeof row.document === 'object')
    .map((row) => {
      const doc = row.document as {
        name?: string; fields?: Record<string, Encoded>; updateTime?: string;
      };
      if (!doc.name?.startsWith(prefix) || !doc.updateTime) {
        throw new WarehouseStoreError('WAREHOUSE_SERVER_QUERY_OUT_OF_SCOPE', 503);
      }
      // O nome do projeto e do banco podem conter "warehouse/".
      // Nunca extrair caminho usando indexOf('warehouse/'): validar o
      // prefixo EXATO e anexar exclusivamente o ID do documento.
      const id = doc.name.slice(prefix.length);
      if (!id || id.includes('/') || !/^[A-Za-z0-9_-]+$/.test(id)) {
        throw new WarehouseStoreError('WAREHOUSE_SERVER_QUERY_DOCUMENT_INVALID', 503);
      }
      return {
        path: parentPath + '/' + domain + '/' + id,
        data: decodeFields(doc.fields || {}),
        updateTime: doc.updateTime,
      };
    });
  if (docs.length > maxResults) throw new WarehouseStoreError('WAREHOUSE_SERVER_QUERY_SATURATED', 409);
  return docs;
}

/**
 * Consulta server-only limitada a domínios explícitos. Nunca permite ao
 * navegador escolher collectionPath, filtros ou consultas arbitrárias.
 * A saturação aborta inventários para evitar snapshots incompletos.
 */
export async function warehouseAdminListCollection(
  accessToken: string,
  workspaceId: string,
  domain: 'materials' | 'balances' | 'locationBalances' | 'depots' | 'locations' | 'inventories',
  maxResults = 500
): Promise<WarehouseAdminDocument[]> {
  if(!Number.isInteger(maxResults)||maxResults<1||maxResults>500) {
    throw new WarehouseStoreError('WAREHOUSE_SERVER_QUERY_INVALID',400);
  }
  const root='warehouse/'+workspaceId;
  const stub=root+'/'+domain+'/probe';
  const stubName=fullName(stub);
  const namePrefix=stubName.slice(0,-'probe'.length);
  const result=await request(accessToken,'/'+root+':runQuery',{
    structuredQuery:{from:[{collectionId:domain}],limit:maxResults+1},
  });
  const rows=parseStream(await result.text());
  const docs:WarehouseAdminDocument[]=[];
  for(const item of rows) {
    const raw=item.document as {name?:string;fields?:Record<string,Encoded>;updateTime?:string}|undefined;
    if(!raw)continue;
    if(!raw.name?.startsWith(namePrefix)||!raw.updateTime) {
      throw new WarehouseStoreError('WAREHOUSE_SERVER_QUERY_OUT_OF_SCOPE',503);
    }
    docs.push({
      path:raw.name.slice(stubName.indexOf('warehouse/')),
      data:decodeFields(raw.fields||{}),
      updateTime:raw.updateTime,
    });
  }
  if(docs.length>maxResults) {
    throw new WarehouseStoreError('WAREHOUSE_SERVER_QUERY_SATURATED',409);
  }
  return docs;
}
