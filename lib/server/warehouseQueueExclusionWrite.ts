import { createHash } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction, WarehouseStoreError } from './warehouseFirestoreTransaction';
import type { WarehouseQueueExclusionInput } from '../warehouse/intakeQueueExclusionRepository';

const SCHEMA='warehouse_intake_queue_exclusion_v1';
type Input = WarehouseQueueExclusionInput;
const invalid=():never=>{throw new WarehouseStoreError('WAREHOUSE_QUEUE_EXCLUSION_INVALID',400);};
const normalize=(raw:unknown):Input[]=>{
  if(!Array.isArray(raw)||raw.length>400)return invalid();
  const byKey=new Map<string,Input>();
  for(const value of raw) {
    if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
    const row=value as Record<string,unknown>;
    if(typeof row.invoiceRecordKey!=='string'
      ||typeof row.invoiceId!=='string'
      ||typeof row.empenhoId!=='string'
      ||(row.pregao!==null && row.pregao!==undefined && typeof row.pregao!=='string'))return invalid();
    const recordKey=row.invoiceRecordKey.trim();
    const invoiceId=row.invoiceId.trim();
    const empenhoId=row.empenhoId.trim();
    const pregao=typeof row.pregao==='string'?row.pregao.trim():null;
    if(!recordKey||recordKey.length>180||!invoiceId||invoiceId.length>120
      ||!empenhoId||empenhoId.length>120||(pregao && pregao.length>120))return invalid();
    byKey.set(recordKey,{invoiceRecordKey:recordKey,invoiceId,empenhoId,pregao});
  }
  return [...byKey.values()];
};

export async function excludeWarehouseQueueServer(
  access:VerifiedWarehouseRequest,input:unknown
):Promise<number> {
  const entries=normalize(input);
  if(entries.length===0)return 0;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  let changed=0;
  // Bounded operations, idempotent per invoice record.
  for(let offset=0;offset<entries.length;offset+=64){
    const batch=entries.slice(offset,offset+64).map(invoice=>{
      const id='qex_'+createHash('sha256').update([
        access.workspaceId,'INTAKE_QUEUE_EXCLUSION',invoice.invoiceRecordKey,
      ].join('\n')).digest('hex');
      return {invoice,id,path:`warehouse/${access.workspaceId}/queueExclusions/${id}`};
    });
    const count=await warehouseAdminTransaction(token,batch.map(x=>x.path),rows=>{
      const now=new Date();
      const writes=batch.flatMap(({invoice,id,path})=>{
        const old=rows.get(path);
        if(old) {
          if(old.data.workspaceId!==access.workspaceId || old.data.ug!==access.ug
            || old.data.invoiceRecordKey!==invoice.invoiceRecordKey
            || old.data.schemaVersion!==SCHEMA) {
            throw new WarehouseStoreError('WAREHOUSE_QUEUE_EXCLUSION_SCOPE_MISMATCH',403);
          }
          // Exclusions are durable. Replay never rewrites an existing event.
          return [];
        }
        return [{path,data:{
          schemaVersion:SCHEMA,id,workspaceId:access.workspaceId,ug:access.ug,
          ...invoice,removedBy:access.uid,removedAt:now,
        }}];
      });
      return {result:writes.length,writes};
    });
    changed+=count;
  }
  return changed;
}
