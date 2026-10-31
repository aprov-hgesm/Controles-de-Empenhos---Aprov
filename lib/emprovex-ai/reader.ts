/**
 * IAM server-side: somente GET e runQuery em caminhos tipados pelo executor.
 * Nunca recebe caminho/colecao do request do cliente.
 */
import firebaseConfig from '../../firebase-applet-config.json';
import { warehouseAdminBatchRead, warehouseAdminReadScopedQuery,
  type WarehouseAdminDocument } from '../server/warehouseFirestoreTransaction';
import { AiExecutionError } from './response';
import type { AiAccess } from './authorize';

type FireValue={stringValue?:string; integerValue?:string; doubleValue?:number;
 booleanValue?:boolean; timestampValue?:string; nullValue?:string;
 arrayValue?:{values?:FireValue[]}; mapValue?:{fields?:Record<string,FireValue>}};
type FireDocument={name:string; fields?:Record<string,FireValue>};
export type AiRow={id:string;data:Record<string,unknown>};
export type AiFilter={field:string;op:'EQUAL'|'GREATER_THAN_OR_EQUAL'|'LESS_THAN';value:string};
const ROOT='https://firestore.googleapis.com/v1/projects/'
  +encodeURIComponent(firebaseConfig.projectId)+'/databases/'
  +encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents';
const OPERATIONAL=['suppliers','empenhos','invoices','cronogramas'] as const;
export type OperationalDomain=typeof OPERATIONAL[number];
function decode(value:FireValue):unknown {
  if(value.stringValue!==undefined)return value.stringValue;
  if(value.timestampValue!==undefined)return value.timestampValue;
  if(value.integerValue!==undefined)return Number(value.integerValue);
  if(value.doubleValue!==undefined)return value.doubleValue;
  if(value.booleanValue!==undefined)return value.booleanValue;
  if(value.nullValue!==undefined)return null;
  if(value.mapValue)return fields(value.mapValue.fields||{});
  if(value.arrayValue)return (value.arrayValue.values||[]).map(decode);
  throw new AiExecutionError('AI_UNSUPPORTED_FIRESTORE_VALUE',503);
}
function fields(value:Record<string,FireValue>):Record<string,unknown> {
  return Object.fromEntries(Object.entries(value).map(([key,val])=>[key,decode(val)]));
}
function safePath(path:string):string {
  if(!/^(?:platformAccounts\/[^/]{3,254}|workspaces\/[a-z0-9-]{2,48}|billingAccounts\/[a-z0-9-]{2,48}|billingCycles\/[a-z0-9-]{2,48}__\d{4}-\d{2}|platformBillingConfig\/main|workspaces\/[a-z0-9-]{2,48}\/(?:empenhos|suppliers|invoices|cronogramas)\/[A-Za-z0-9_-]{1,130}|supplierDirectory\/defaults)$/.test(path))
    throw new AiExecutionError('AI_DOCUMENT_PATH_INVALID',400);
  return path.split('/').map(encodeURIComponent).join('/');
}
async function firestoreFetch(url:string,token:string,body?:unknown):Promise<Response> {
  const response=await fetch(url,{method:body?'POST':'GET',cache:'no-store',
    headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  if(response.status===401 || response.status===403)throw new AiExecutionError('AI_FIRESTORE_FORBIDDEN',503);
  if(!response.ok && response.status!==404)
    throw new AiExecutionError('AI_FIRESTORE_READ_UNAVAILABLE',503);
  return response;
}
export async function coreDocument(path:string,token:string):Promise<Record<string,unknown>|null>{
  const response=await firestoreFetch(ROOT+'/'+safePath(path),token);
  if(response.status===404)return null;
  const doc=await response.json() as FireDocument;
  return fields(doc.fields||{});
}
export async function coreOperationalDocument(
 access:AiAccess,domain:OperationalDomain,id:string
):Promise<AiRow|null> {
  const path='workspaces/'+access.workspaceId+'/'+domain+'/'+id;
  const record=await coreDocument(path,access.googleToken);
  if(!record)return null;
  if(record.workspaceId && record.workspaceId!==access.workspaceId)
    throw new AiExecutionError('AI_SCOPE_INTEGRITY',503);
  if(record.ug && record.ug!==access.ug)
    throw new AiExecutionError('AI_UG_INTEGRITY',503);
  return {id,data:record};
}
export async function coreOperationalQuery(
 access:AiAccess,domain:OperationalDomain,filters:readonly AiFilter[],max:number,
 orderField='__name__',startAfter?:{fieldValue:string;id:string}
):Promise<{rows:AiRow[];truncated:boolean;examined:number}> {
  if(!OPERATIONAL.includes(domain) || !Number.isInteger(max) || max<1 || max>201
    || filters.length>3 || filters.some(f=>!['registeredAt','empenhoId','supplierCnpj','cnpj'].includes(f.field)))
    throw new AiExecutionError('AI_QUERY_CONTRACT_INVALID',400);
  const parent='workspaces/'+access.workspaceId;
  const prefix='projects/'+firebaseConfig.projectId+'/databases/'+firebaseConfig.firestoreDatabaseId+'/documents/'+parent+'/'+domain+'/';
  const comparisons=filters.map(f=>({fieldFilter:{field:{fieldPath:f.field},op:f.op,value:{stringValue:f.value}}}));
  const where=comparisons.length===0?{}:{where:comparisons.length===1?comparisons[0]:{compositeFilter:{op:'AND',filters:comparisons}}};
  const orders=orderField==='registeredAt'
    ? [{field:{fieldPath:'registeredAt'},direction:'ASCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}]
    : [{field:{fieldPath:'__name__'},direction:'ASCENDING'}];
  const start=startAfter?{startAt:{before:false,values:orderField==='registeredAt'
    ? [{stringValue:startAfter.fieldValue},{referenceValue:prefix+startAfter.id}]
    :[{referenceValue:prefix+startAfter.id}]}}:{};
  const response=await firestoreFetch(ROOT+'/'+parent+':runQuery',access.googleToken,
    {structuredQuery:{from:[{collectionId:domain}],...where,orderBy:orders,...start,limit:max}});
  const payload=await response.json() as Array<{document?:FireDocument}>;
  if(!Array.isArray(payload))throw new AiExecutionError('AI_QUERY_PAYLOAD_INVALID',503);
  const rows=payload.flatMap(row=>{
    if(!row.document)return [];
    const d=row.document;
    if(!d.name?.startsWith(prefix))throw new AiExecutionError('AI_QUERY_SCOPE_VIOLATION',503);
    const id=d.name.slice(prefix.length);
    if(!/^[A-Za-z0-9_-]{1,130}$/.test(id))throw new AiExecutionError('AI_DOCUMENT_ID_INVALID',503);
    const data=fields(d.fields||{});
    if(data.workspaceId && data.workspaceId!==access.workspaceId)throw new AiExecutionError('AI_SCOPE_INTEGRITY',503);
    if(data.ug && data.ug!==access.ug)throw new AiExecutionError('AI_UG_INTEGRITY',503);
    return [{id,data}];
  });
  return {rows,truncated:rows.length>=max,examined:rows.length};
}
export async function warehouseDocument(
  access:AiAccess,domain:'materials'|'balances'|'depots'|'locations'|'barcodes',id:string
):Promise<AiRow|null> {
  const path='warehouse/'+access.workspaceId+'/'+domain+'/'+id;
  const map=await warehouseAdminBatchRead(access.googleToken,[path]);
  const row=map.get(path);
  if(!row)return null;
  assertWarehouseRow(row,access);
  return {id,data:row.data};
}
export async function warehouseQuery(
  access:AiAccess,domain:'materials'|'locationBalances'|'barcodes',filter:{field:string;value:string}|null,max:number
):Promise<{rows:AiRow[];truncated:boolean;examined:number}> {
  if(max<1||max>101||!Number.isInteger(max))throw new AiExecutionError('AI_WAREHOUSE_LIMIT_INVALID',400);
  const filters=filter?[filter]:[];
  if(filter && !((domain==='locationBalances'&&filter.field==='materialId')
    ||(domain==='barcodes'&&filter.field==='materialId')))throw new AiExecutionError('AI_WAREHOUSE_FILTER_INVALID',400);
  const rows=await warehouseAdminReadScopedQuery(access.googleToken,access.workspaceId,domain,filters,max);
  for(const row of rows)assertWarehouseRow(row,access);
  return {rows:rows.map(row=>({id:row.path.split('/').at(-1)!,data:row.data})),
    truncated:rows.length>=max,examined:rows.length};
}
function assertWarehouseRow(row:WarehouseAdminDocument,access:AiAccess):void {
  if(row.data.workspaceId!==access.workspaceId||row.data.ug!==access.ug)
    throw new AiExecutionError('AI_WAREHOUSE_SCOPE_INTEGRITY',503);
}
