import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction,warehouseAdminListCollection,WarehouseStoreError } from './warehouseFirestoreTransaction';
import { WAREHOUSE_LOGISTICS_ALERT_SCHEMA_VERSION as SCHEMA,
  type WarehouseLogisticsAlertCandidate } from '../warehouse/logisticsAlerts';
const kinds=new Set(['MATERIAL_UNLOCATED','LOT_EXPIRED','LOT_NEAR_EXPIRY','STOCK_ZERO',
 'LOW_STOCK','INVENTORY_RECONCILIATION','SISCOFIS_DIVERGENCE','DELIVERY_DUE_SOON','DELIVERY_OVERDUE']);
const fail=(s:string,status=409):never=>{throw new WarehouseStoreError(s,status)};
const path=(ws:string,id:string)=>'warehouse/'+ws+'/alerts/'+id;
const makeId=(c:{kind:string;entityId:string})=>'logalert-'+c.kind.toLowerCase().replace(/_/g,'-')
 +'-'+(c.entityId.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'entity').slice(0,150);
export async function warehouseLogisticsAlertsServer(
 access:VerifiedWarehouseRequest,kind:'UPSERT'|'RESOLVE',raw:unknown
):Promise<number|{resolved:number;skippedResolution:boolean}> {
 const ws=access.workspaceId;
 const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'?'emulator':await getGoogleAccessToken();
 if(kind==='UPSERT'){
  if(!Array.isArray(raw)||raw.length>35)return fail('WAREHOUSE_ALERT_INVALID_BATCH',400);
  if(!raw.length)return 0;
  const candidates:WarehouseLogisticsAlertCandidate[]=raw.map(v=>{
   if(!v||typeof v!=='object'||Array.isArray(v))return fail('WAREHOUSE_ALERT_INVALID',400);
   const d=v as Record<string,unknown>;
   if(!kinds.has(String(d.kind))||typeof d.entityId!=='string'||!d.entityId||d.entityId.length>180
     ||!['INFO','WARNING','CRITICAL'].includes(String(d.severity))
     ||['title','subtitle','description'].some(k=>typeof d[k]!=='string'||(d[k] as string).length>1800)
     ||(d.empenhoId!==null&&d.empenhoId!==undefined&&typeof d.empenhoId!=='string'))
     return fail('WAREHOUSE_ALERT_INVALID',400);
   return d as unknown as WarehouseLogisticsAlertCandidate;
  });
  const batch=[...new Map(candidates.map(v=>[makeId(v),v])).entries()];
  const paths=batch.map(([id])=>path(ws,id));
  return warehouseAdminTransaction(token,paths,rows=>{
   const now=new Date(),writes:Array<{path:string;data:Record<string,unknown>}>=[];
   for(const [id,c] of batch){
    const p=path(ws,id),old=rows.get(p);
    if(old&&(old.data.workspaceId!==ws||old.data.ug!==access.ug
      ||old.data.schemaVersion!==SCHEMA))return fail('WAREHOUSE_ALERT_SCOPE',403);
    const fingerprint=[c.kind,c.entityId,c.severity,c.title,c.subtitle,c.description,c.empenhoId||''].join('|');
    if(old?.data.active===true&&old.data.fingerprint===fingerprint)continue;
    writes.push({path:p,data:{
      ...(old?.data??{schemaVersion:SCHEMA,id,workspaceId:ws,ug:access.ug,
        kind:c.kind,entityId:c.entityId,empenhoId:c.empenhoId,createdAt:now}),
      severity:c.severity,status:'OPEN',title:c.title,subtitle:c.subtitle,
      description:c.description,fingerprint,active:true,updatedAt:now,resolvedAt:null,
    }});
   }
   return {result:writes.length,writes};
  });
 }
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_ALERT_RESOLVE_INVALID',400);
 const cmd=raw as Record<string,unknown>;
 if(typeof cmd.allowResolution!=='boolean'||!Array.isArray(cmd.candidateIds)
   ||cmd.candidateIds.length>250||cmd.candidateIds.some(id=>typeof id!=='string'
     ||!/^logalert-[a-z0-9._-]{3,190}$/.test(id)))
   return fail('WAREHOUSE_ALERT_RESOLVE_INVALID',400);
 if(!cmd.allowResolution)return {resolved:0,skippedResolution:true};
 const alerts=await warehouseAdminListCollection(token,ws,'alerts',500);
 // Saturated result means no safe resolution from an incomplete view.
 if(alerts.length>=250)return {resolved:0,skippedResolution:true};
 const current=new Set(cmd.candidateIds as string[]);
 const pending=alerts.filter(d=>d.data.active===true&&!current.has(d.path.split('/').at(-1)||''));
 let resolved=0;
 for(let i=0;i<pending.length;i+=50){
  const keys=pending.slice(i,i+50).map(v=>v.path);
  resolved+=await warehouseAdminTransaction(token,keys,rows=>{
   const now=new Date(),writes:Array<{path:string;data:Record<string,unknown>}>=[];
   for(const key of keys){
    const doc=rows.get(key);if(!doc||doc.data.active!==true)continue;
    if(doc.data.workspaceId!==ws||doc.data.ug!==access.ug)return fail('WAREHOUSE_ALERT_SCOPE',403);
    writes.push({path:key,data:{...doc.data,status:'RESOLVED',active:false,
      resolvedAt:now,updatedAt:now}});
   }
   return {result:writes.length,writes};
  });
 }
 return {resolved,skippedResolution:false};
}
