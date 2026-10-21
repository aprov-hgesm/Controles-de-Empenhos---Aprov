/**
 * WAREHOUSE-READ-R1: Firestore REST reads for an authenticated Warehouse
 * server request. The caller provides only verified workspace/UG; no arbitrary
 * document paths or query parameters are exposed to the browser.
 */
import firebaseConfig from '../../firebase-applet-config.json';
import { WarehouseStoreError } from './warehouseFirestoreTransaction';

export type ReadDatabase = 'core' | 'warehouse';
export type ReadCollection = 'invoices' | 'empenhos' | 'intakes' |
  'intakeQueueIndex' | 'queueExclusions' | 'movements';

export interface QueueDocument {
  id: string;
  data: Record<string, unknown>;
}

const MAX_BATCH = 100;
const MAX_PAGE = 250;
type Encoded = Record<string, unknown>;

function decodeValue(raw: Encoded): unknown {
  if ('stringValue' in raw) return raw.stringValue;
  if ('integerValue' in raw) return Number(raw.integerValue);
  if ('doubleValue' in raw) return Number(raw.doubleValue);
  if ('booleanValue' in raw) return raw.booleanValue;
  if ('timestampValue' in raw) return raw.timestampValue;
  if ('nullValue' in raw) return null;
  if ('arrayValue' in raw) return ((raw.arrayValue as {values?:Encoded[]}).values || []).map(decodeValue);
  if ('mapValue' in raw) return decodeFields((raw.mapValue as {fields?:Record<string,Encoded>}).fields || {});
  return undefined;
}
function decodeFields(fields: Record<string, Encoded>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key,value]) => [key,decodeValue(value)]));
}
function base(database: ReadDatabase): string {
  const emulator = process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1';
  if (emulator) {
    if (process.env.NODE_ENV === 'production' ||
      process.env.EMPROVEX_E2E_SERVER_AUTH !== '1' ||
      process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID !== 'demo-emprovex-security') {
      throw new WarehouseStoreError('WAREHOUSE_READ_EMULATOR_FORBIDDEN',503);
    }
    const port = database === 'core'
      ? (process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || '8080')
      : (process.env.EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT ||
          process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || '8080');
    if (!/^\d{4,5}$/.test(port)) throw new WarehouseStoreError('WAREHOUSE_READ_EMULATOR_PORT',503);
    return 'http://127.0.0.1:' + port + '/v1/projects/demo-emprovex-security/databases/' +
      encodeURIComponent(database === 'core' ? '(default)' : 'emprovex-warehouse') + '/documents';
  }
  return 'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(firebaseConfig.projectId) + '/databases/' +
    encodeURIComponent(database === 'core' ? firebaseConfig.firestoreDatabaseId : 'emprovex-warehouse') +
    '/documents';
}
function documentRoot(database: ReadDatabase, workspaceId: string): string {
  if (!/^[a-z0-9_-]{2,90}$/.test(workspaceId)) {
    throw new WarehouseStoreError('WAREHOUSE_READ_SCOPE_INVALID',403);
  }
  return database === 'core' ? 'workspaces/' + workspaceId : 'warehouse/' + workspaceId;
}
function collectionRoot(db: ReadDatabase, ws: string, collection: ReadCollection): string {
  if (db === 'core' && collection !== 'invoices' && collection !== 'empenhos') {
    throw new WarehouseStoreError('WAREHOUSE_READ_COLLECTION_INVALID',400);
  }
  if (db === 'warehouse' && (collection === 'invoices' || collection === 'empenhos')) {
    throw new WarehouseStoreError('WAREHOUSE_READ_COLLECTION_INVALID',400);
  }
  return documentRoot(db,ws) + '/' + collection;
}
async function post(accessToken:string, db:ReadDatabase, suffix:string, body:unknown):Promise<string> {
  const emulator = process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1';
  const response = await fetch(base(db) + suffix, {
    method:'POST',cache:'no-store',
    headers:{authorization:'Bearer ' + (emulator ? 'owner' : accessToken),
      'content-type':'application/json'},
    body:JSON.stringify(body),
  });
  if (!response.ok) throw new WarehouseStoreError('WAREHOUSE_READ_FIRESTORE_UNAVAILABLE',503);
  return response.text();
}
function parseStream(raw:string): Record<string,unknown>[] {
  if (!raw.trim()) return [];
  if (raw.trimStart().startsWith('[')) {
    const arr:unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new WarehouseStoreError('WAREHOUSE_READ_BAD_RESPONSE',503);
    return arr as Record<string,unknown>[];
  }
  return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Record<string,unknown>);
}
function decodeDocument(db:ReadDatabase,ws:string,collection:ReadCollection,raw:unknown):QueueDocument {
  const document = raw as {name?:string;fields?:Record<string,Encoded>};
  const prefix='projects/' +
    (process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
      ? 'demo-emprovex-security' : firebaseConfig.projectId) + '/databases/' +
    (process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
      ? (db === 'core' ? '(default)' : 'emprovex-warehouse')
      : (db === 'core' ? firebaseConfig.firestoreDatabaseId : 'emprovex-warehouse')) +
    '/documents/' + collectionRoot(db,ws,collection) + '/';
  if (!document.name?.startsWith(prefix)) throw new WarehouseStoreError('WAREHOUSE_READ_OUT_OF_SCOPE',503);
  const id = document.name.slice(prefix.length);
  if (!id || id.includes('/') || id.length>512) {
    throw new WarehouseStoreError('WAREHOUSE_READ_INVALID_DOCUMENT_ID',503);
  }
  return {id,data:decodeFields(document.fields || {})};
}
export async function queueReadDocument(
  token:string,db:ReadDatabase,ws:string,collection:ReadCollection,id:string
):Promise<QueueDocument|null> {
  return (await queueReadIds(token,db,ws,collection,[id])).get(id) || null;
}
export async function queueReadIds(
  token:string,db:ReadDatabase,ws:string,collection:ReadCollection,ids:string[]
):Promise<Map<string,QueueDocument>> {
  const root=collectionRoot(db,ws,collection);
  const unique=[...new Set(ids.filter(Boolean))];
  if (unique.some(id=>id.includes('/') || id.length>512)) throw new WarehouseStoreError('WAREHOUSE_READ_INVALID_ID',400);
  const result=new Map<string,QueueDocument>();
  // Bounded concurrent batches; no database-wide scan.
  for(let start=0;start<unique.length;start+=MAX_BATCH*4) {
    const chunks=[] as string[][];
    for(let i=start;i<Math.min(start+MAX_BATCH*4,unique.length);i+=MAX_BATCH)
      chunks.push(unique.slice(i,i+MAX_BATCH));
    const pages=await Promise.all(chunks.map(chunk=>post(token,db,':batchGet',{
      documents:chunk.map(id=>'projects/' +
        (process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
          ? 'demo-emprovex-security' : firebaseConfig.projectId) + '/databases/' +
        (process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
          ? (db==='core' ? '(default)' : 'emprovex-warehouse')
          : (db==='core' ? firebaseConfig.firestoreDatabaseId : 'emprovex-warehouse')) +
        '/documents/' + root + '/' + id),
    })));
    for(const page of pages) for(const row of parseStream(page)) if(row.found) {
      const doc=decodeDocument(db,ws,collection,row.found);
      if(!unique.includes(doc.id)) throw new WarehouseStoreError('WAREHOUSE_READ_UNREQUESTED_DOCUMENT',503);
      result.set(doc.id,doc);
    }
  }
  return result;
}
export type ReadFilter = {field:'active'|'registeredAt'|'source.invoiceRecordKey';op:'EQUAL'|'GREATER_THAN_OR_EQUAL';value:string|boolean};
export async function queueReadPage(
  token:string,db:ReadDatabase,ws:string,collection:ReadCollection,
  options:{pageSize?:number;after?:QueueDocument|null;filter?:ReadFilter}={}
):Promise<QueueDocument[]> {
  const root=collectionRoot(db,ws,collection);
  const pageSize=options.pageSize || 200;
  if(!Number.isInteger(pageSize) || pageSize<1 || pageSize>MAX_PAGE) throw new WarehouseStoreError('WAREHOUSE_READ_PAGE_INVALID',400);
  const query:Record<string,unknown>={
    from:[{collectionId:collection}],
    limit:pageSize,
    orderBy:[{field:{fieldPath:options.filter?.field==='registeredAt'?'registeredAt':'__name__'},direction:'ASCENDING'}],
  };
  if(options.filter) {
    query.where={fieldFilter:{
      field:{fieldPath:options.filter.field},op:options.filter.op,
      value:typeof options.filter.value==='boolean'
        ? {booleanValue:options.filter.value}
        : {stringValue:options.filter.value},
    }};
  }
  if(options.after) {
    const orderValue=options.filter?.field==='registeredAt'
      ? {stringValue:String(options.after.data.registeredAt || '')}
      : {referenceValue:'projects/' +
          (process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
            ? 'demo-emprovex-security':firebaseConfig.projectId) +
          '/databases/' + (process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
            ? (db==='core'?'(default)':'emprovex-warehouse')
            : (db==='core'?firebaseConfig.firestoreDatabaseId:'emprovex-warehouse')) +
          '/documents/' + root + '/' + options.after.id};
    query.startAt={values:[orderValue],before:false};
  }
  const response=await post(token,db,'/'+documentRoot(db,ws)+':runQuery',{structuredQuery:query});
  const rows=parseStream(response);
  return rows.filter(row=>row.document).map(row=>decodeDocument(db,ws,collection,row.document));
}
export async function queueReadUpTo(
  token:string,db:ReadDatabase,ws:string,collection:ReadCollection,
  max:number, filter?:ReadFilter
):Promise<{docs:QueueDocument[];truncated:boolean}> {
  if(!Number.isInteger(max)||max<1||max>12000) throw new WarehouseStoreError('WAREHOUSE_READ_LIMIT_INVALID',400);
  const docs:QueueDocument[]=[];
  let after:QueueDocument|null=null;
  while(docs.length<=max) {
    const page=await queueReadPage(token,db,ws,collection,{
      pageSize:Math.min(MAX_PAGE,max+1-docs.length),after,filter,
    });
    docs.push(...page);
    if(page.length<Math.min(MAX_PAGE,max+1-(docs.length-page.length)))break;
    const next=page.at(-1) || null;
    if(!next || next.id===after?.id) throw new WarehouseStoreError('WAREHOUSE_READ_CURSOR_INVALID',503);
    after=next;
  }
  return {docs:docs.slice(0,max),truncated:docs.length>max};
}
