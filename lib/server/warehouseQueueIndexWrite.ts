import { createHash } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction,WarehouseStoreError } from './warehouseFirestoreTransaction';
import { createWarehouseItemIntakeId, WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION } from '../warehouse/intake';
import { WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION } from '../warehouse/intakeState';
import { WAREHOUSE_INTAKE_QUEUE_CANDIDATE_SCHEMA_VERSION as CANDIDATE,
 WAREHOUSE_INTAKE_QUEUE_INDEX_SCHEMA_VERSION as INDEX } from '../warehouse/intakeQueueIndexRepository';
const fail=(s:string,status=409):never=>{throw new WarehouseStoreError(s,status)};
const p=(w:string,d:string,i:string)=>'warehouse/'+w+'/'+d+'/'+i;
export async function warehouseQueueIndexServer(
 access:VerifiedWarehouseRequest,kind:'UPSERT'|'STATE'|'DEACTIVATE',raw:unknown
):Promise<number|{ok:true}>{
 const ws=access.workspaceId,now=new Date();
 const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'?'emulator':await getGoogleAccessToken();
 if(kind==='STATE'){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_INDEX_INVALID',400);
  const x=raw as Record<string,unknown>;
  const date=(v:unknown)=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v));
  if(!date(x.cutoffAt)||!date(x.watermarkRegisteredAt))return fail('WAREHOUSE_INDEX_INVALID_DATE',400);
  const key=p(ws,'intakeQueueIndex','state');
  return warehouseAdminTransaction(token,[key],rows=>{
   const row=rows.get(key);
   if(row&&(row.data.workspaceId!==ws||row.data.ug!==access.ug||row.data.schemaVersion!==INDEX))
     return fail('WAREHOUSE_INDEX_SCOPE_MISMATCH',403);
   if(row&&row.data.cutoffAt===x.cutoffAt&&row.data.watermarkRegisteredAt===x.watermarkRegisteredAt
     &&row.data.bootstrapComplete===true)return {result:{ok:true as const},writes:[]};
   return {result:{ok:true as const},writes:[{path:key,data:{
    schemaVersion:INDEX,workspaceId:ws,ug:access.ug,cutoffAt:x.cutoffAt,
    watermarkRegisteredAt:x.watermarkRegisteredAt,bootstrapComplete:true,
    updatedBy:access.uid,updatedAt:now}}]};
  });
 }
 if(!Array.isArray(raw)||raw.length>(kind==='UPSERT'?40:100))
   return fail('WAREHOUSE_INDEX_INVALID_BATCH',400);
 if(!raw.length)return kind==='UPSERT'?0:{ok:true};
 if(kind==='DEACTIVATE'){
  const ids=[...new Set(raw)];
  if(ids.some(id=>typeof id!=='string'||!/^intake_[a-f0-9]{64}$/.test(id)))
    return fail('WAREHOUSE_INDEX_INVALID_ID',400);
  const paths=ids.map(id=>p(ws,'intakeQueueIndex',id));
  return warehouseAdminTransaction(token,paths,rows=>{
   const writes:Array<{path:string;data:Record<string,unknown>}>=[];
   for(const key of paths){
    const row=rows.get(key);if(!row)continue;
    if(row.data.workspaceId!==ws||row.data.ug!==access.ug||row.data.schemaVersion!==CANDIDATE)
      return fail('WAREHOUSE_INDEX_SCOPE',403);
    if(row.data.active===true)writes.push({path:key,data:{...row.data,active:false,
     deactivatedAt:now,updatedAt:now,updatedBy:access.uid}});
   }
   return {result:{ok:true as const},writes};
  });
 }
 const list=[] as Array<{id:string;data:Record<string,unknown>;q:string;state:string;exclude:string}>;
 for(const value of raw){
  if(!value||typeof value!=='object'||Array.isArray(value))return fail('WAREHOUSE_INDEX_INVALID_ITEM',400);
  const d=value as Record<string,unknown>;
  for(const field of ['invoiceRecordKey','invoiceId','empenhoId','itemId']){
   if(typeof d[field]!=='string'||!(d[field] as string).trim()||(d[field] as string).length>180)
     return fail('WAREHOUSE_INDEX_INVALID_ITEM',400);
  }
  if(d.registeredAt!==null&&(typeof d.registeredAt!=='string'||!Number.isFinite(Date.parse(d.registeredAt))))
    return fail('WAREHOUSE_INDEX_INVALID_DATE',400);
  const id=await createWarehouseItemIntakeId(ws,d.invoiceRecordKey as string,d.itemId as string);
  if(d.id!==id)return fail('WAREHOUSE_INDEX_INVALID_ID',400);
  const ex='qex_'+createHash('sha256').update(
   [ws.trim().toLowerCase(),'INTAKE_QUEUE_EXCLUSION',(d.invoiceRecordKey as string).trim()].join('\n')
  ).digest('hex');
  list.push({id,data:d,q:p(ws,'intakeQueueIndex',id),
   state:p(ws,'intakes',id),exclude:p(ws,'queueExclusions',ex)});
 }
 const dedup=[...new Map(list.map(i=>[i.id,i])).values()];
 const reads=[...new Set(dedup.flatMap(i=>[i.q,i.state,i.exclude]))];
 return warehouseAdminTransaction(token,reads,rows=>{
  const pending:Array<{path:string;data:Record<string,unknown>}>=[];
  for(const x of dedup){
   const ex=rows.get(x.exclude);
   if(ex&&ex.data.workspaceId===ws&&ex.data.ug===access.ug)continue;
   const state=rows.get(x.state);
   if(state){
    if(state.data.workspaceId!==ws||state.data.ug!==access.ug)return fail('WAREHOUSE_INDEX_INTAKE_SCOPE',403);
    if(state.data.schemaVersion===WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION
      ||state.data.schemaVersion===WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION
       &&(state.data.status==='PROCESSED'||typeof state.data.pendingQuantity==='number'
        &&state.data.pendingQuantity<=0.000001))continue;
   }
   const old=rows.get(x.q),d=x.data;
   if(old&&(old.data.workspaceId!==ws||old.data.ug!==access.ug||old.data.schemaVersion!==CANDIDATE))
     return fail('WAREHOUSE_INDEX_SCOPE',403);
   if(old?.data.active===true&&old.data.invoiceRecordKey===d.invoiceRecordKey
     &&old.data.invoiceId===d.invoiceId&&old.data.empenhoId===d.empenhoId
     &&old.data.itemId===d.itemId&&old.data.registeredAt===d.registeredAt)continue;
   pending.push({path:x.q,data:{schemaVersion:CANDIDATE,id:x.id,workspaceId:ws,ug:access.ug,
    invoiceRecordKey:d.invoiceRecordKey,invoiceId:d.invoiceId,
    empenhoId:d.empenhoId,itemId:d.itemId,registeredAt:d.registeredAt,
    active:true,deactivatedAt:null,updatedBy:access.uid,updatedAt:now}});
  }
  return {result:pending.length,writes:pending};
 });
}
