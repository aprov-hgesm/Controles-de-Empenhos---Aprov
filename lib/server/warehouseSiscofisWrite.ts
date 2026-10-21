import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction,warehouseAdminListCollection,WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import { saveWarehouseMaterialServer } from './warehouseMaterialWrite';
import { warehouseLedgerMovementServer } from './warehouseLedgerAndArchive';
import {
  WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION,WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION,
  WAREHOUSE_SISCOFIS_MAX_ROWS,hashWarehouseSiscofisImport,buildWarehouseSiscofisPreview,
  aggregateMarcoZeroRows,createMaterialFromSiscofisRow,type WarehouseSiscofisPreview,
  type WarehouseSiscofisPreviewRow,
} from '../warehouse/siscofis';
import type { WarehouseSiscofisSnapshot } from '../warehouse/siscofisService';
import { WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION } from '../warehouse/invoiceIntegration';
import { validateWarehouseMaterial } from '../warehouse/material';
import { validateWarehouseBalance } from '../warehouse/movement';
import { warehouseCanonicalMaterialReadInput } from '../warehouse/readCompatibility';
const fail=(s:string,status=409):never=>{throw new WarehouseStoreError(s,status)};
const p=(ws:string,d:string,id:string)=>'warehouse/'+ws+'/'+d+'/'+id;
const token=()=>process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
 ?Promise.resolve('emulator'):getGoogleAccessToken();
function fromDoc(row:WarehouseAdminDocument):WarehouseSiscofisSnapshot {
 const d=row.data;
 return {...d,createdAt:typeof d.createdAt==='string'?d.createdAt:null,
  confirmedAt:typeof d.confirmedAt==='string'?d.confirmedAt:null} as unknown as WarehouseSiscofisSnapshot;
}
async function canonicalRows(access:VerifiedWarehouseRequest,authToken:string){
 const [ms,bs]=await Promise.all([
  warehouseAdminListCollection(authToken,access.workspaceId,'materials',500),
  warehouseAdminListCollection(authToken,access.workspaceId,'balances',500),
 ]);
 const materials=ms.map(row=>{
  const id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseMaterial(warehouseCanonicalMaterialReadInput(id,row.data),{
   expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!r.ok)return fail('WAREHOUSE_SISCOFIS_MATERIAL_INVALID');
  return r.data;
 });
 const balances=bs.map(row=>{
  const d=row.data,id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseBalance({
    schemaVersion:d.schemaVersion,workspaceId:d.workspaceId,ug:d.ug,
    materialId:d.materialId??id,quantity:d.quantity,revision:d.revision,
    lastMovementId:d.lastMovementId,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,expectedMaterialId:id});
  if(!r.ok)return fail('WAREHOUSE_SISCOFIS_BALANCE_INVALID');
  return r.data;
 });
 return {materials,balances};
}
function finalRows(preview:WarehouseSiscofisPreview,
 balances:Awaited<ReturnType<typeof canonicalRows>>['balances']):WarehouseSiscofisPreviewRow[]{
 const byId=new Map(balances.map(b=>[b.materialId,b.quantity]));
 return preview.rows.map(row=>{
  const qty=row.materialId?byId.get(row.materialId)??0:0;
  if(preview.kind==='MARCO_ZERO')return {...row,emprovexQuantity:qty,
    projectedQuantity:qty,difference:0};
  const difference=Number((row.siscofisQuantity-qty).toFixed(6));
  return {...row,emprovexQuantity:qty,projectedQuantity:qty,difference,
   state:!row.materialId?'UNRESOLVED':difference===0?'MATCHED':'DIVERGENT'};
 });
}
const asSnapshot=(input:{id:string;access:VerifiedWarehouseRequest;
 preview:WarehouseSiscofisPreview;cutoff:string;status:'APPLYING'|'CONFIRMED';
 movementIds:string[];rows:WarehouseSiscofisPreviewRow[];confirmedAt:Date|null;
 createdAt:Date;summary:WarehouseSiscofisPreview['summary']}):Record<string,unknown>=>({
 schemaVersion:WAREHOUSE_SISCOFIS_SNAPSHOT_SCHEMA_VERSION,id:input.id,
 workspaceId:input.access.workspaceId,ug:input.access.ug,kind:input.preview.kind,
 status:input.status,sourceHash:input.preview.sourceHash,
 importSchemaVersion:WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION,
 sourceLabel:input.preview.import.sourceLabel,
 referenceDate:input.preview.import.referenceDate,
 cutoffAt:input.cutoff,actorUid:input.access.uid,
 rows:input.rows,summary:input.summary,movementIds:input.movementIds,
 createdAt:input.createdAt,confirmedAt:input.confirmedAt,
});
export async function confirmWarehouseSiscofisServer(
 access:VerifiedWarehouseRequest,raw:unknown
):Promise<WarehouseSiscofisSnapshot>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_SISCOFIS_INPUT_INVALID',400);
 const proposed=raw as WarehouseSiscofisPreview,importData=proposed.import;
 if(!importData||!Array.isArray(importData.rows)||importData.rows.length>WAREHOUSE_SISCOFIS_MAX_ROWS
  ||importData.schemaVersion!==WAREHOUSE_SISCOFIS_IMPORT_SCHEMA_VERSION
  ||importData.ug!==access.ug
  ||typeof importData.referenceDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(importData.referenceDate)
  ||typeof importData.sourceLabel!=='string'||importData.sourceLabel.length>240
  ||typeof proposed.sourceHash!=='string'||!(/^[a-f0-9]{64}$/.test(proposed.sourceHash))
  ||!Array.isArray(proposed.rows)||proposed.rows.length>WAREHOUSE_SISCOFIS_MAX_ROWS){
  return fail('WAREHOUSE_SISCOFIS_INPUT_INVALID',400);
 }
 // Confirmação jamais aceita um hash alegado que não reflita as linhas importadas.
 if(await hashWarehouseSiscofisImport(importData)!==proposed.sourceHash){
  return fail('WAREHOUSE_SISCOFIS_SOURCE_HASH_MISMATCH',400);
 }
 const authToken=await token(),ws=access.workspaceId;
 const settingsPath=p(ws,'settings','invoice-integration');
 const marcoPath=p(ws,'siscofisSnapshots','marco-zero');
 const meta=await warehouseAdminTransaction(authToken,[settingsPath,marcoPath],r=>({
  result:{settings:r.get(settingsPath),marco:r.get(marcoPath)},writes:[],
 }));
 const stored=meta.marco;
 if(stored&&(stored.data.workspaceId!==ws||stored.data.ug!==access.ug
  ||stored.data.kind!=='MARCO_ZERO'))return fail('WAREHOUSE_SISCOFIS_SCOPE_MISMATCH',403);
 if(meta.settings&&(meta.settings.data.workspaceId!==ws||meta.settings.data.ug!==access.ug
  ||meta.settings.data.schemaVersion!==WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION)){
  return fail('WAREHOUSE_SISCOFIS_SETTINGS_INVALID',403);
 }
 const alreadyConfirmed=stored?.data.status==='CONFIRMED';
 const expectedKind=alreadyConfirmed?'SNAPSHOT':'MARCO_ZERO';
 if(proposed.kind!==expectedKind)return fail('WAREHOUSE_SISCOFIS_PREVIEW_STALE');
 if(stored?.data.status==='APPLYING'&&stored.data.sourceHash!==proposed.sourceHash){
  return fail('WAREHOUSE_SISCOFIS_MARCO_ZERO_IN_PROGRESS');
 }
 const balancesAndMaterials=await canonicalRows(access,authToken);
 const existingCutoff=meta.settings?.data.cutoffAt;
 const cutoff=typeof existingCutoff==='string'&&Number.isFinite(Date.parse(existingCutoff))
  ?existingCutoff:new Date().toISOString();
 const preview=await buildWarehouseSiscofisPreview({
  workspaceId:ws,importData,materials:balancesAndMaterials.materials,
  balances:balancesAndMaterials.balances,hasMarcoZero:alreadyConfirmed,
  cutoffAt:cutoff,
 });
 const resuming=stored?.data.status==='APPLYING'&&stored.data.sourceHash===proposed.sourceHash;
 if((!preview.canConfirm&&!resuming)||preview.sourceHash!==proposed.sourceHash){
  return fail('WAREHOUSE_SISCOFIS_PREVIEW_NOT_CONFIRMABLE');
 }
 // Cutoff imutável: a primeira criação usa escrita condicional no servidor.
 await warehouseAdminTransaction(authToken,[settingsPath],r=>{
  const old=r.get(settingsPath);
  if(old)return {result:{ok:true as const},writes:[]};
  return {result:{ok:true as const},writes:[{path:settingsPath,data:{
   schemaVersion:WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION,
   workspaceId:ws,ug:access.ug,cutoffAt:cutoff,activatedBy:access.uid,
  }}]};
 });
 const snapshotId=preview.kind==='MARCO_ZERO'?'marco-zero':'snapshot_'+preview.sourceHash.slice(0,32);
 const snapPath=p(ws,'siscofisSnapshots',snapshotId);
 const existing=await warehouseAdminTransaction(authToken,[snapPath],r=>({
  result:r.get(snapPath),writes:[],
 }));
 if(existing){
  if(existing.data.sourceHash!==preview.sourceHash||existing.data.workspaceId!==ws
    ||existing.data.ug!==access.ug)return fail('WAREHOUSE_SISCOFIS_SNAPSHOT_CONFLICT');
  if(existing.data.status==='CONFIRMED')return fromDoc(existing);
 }
 if(preview.kind==='MARCO_ZERO'){
  await warehouseAdminTransaction(authToken,[snapPath],r=>{
   const row=r.get(snapPath);
   if(row)return {result:{ok:true as const},writes:[]};
   const data=asSnapshot({id:snapshotId,access,preview,cutoff,status:'APPLYING',
    movementIds:[],rows:preview.rows,confirmedAt:null,createdAt:new Date(),summary:preview.summary});
   return {result:{ok:true as const},writes:[{path:snapPath,data}]};
  });
  const available=new Set(balancesAndMaterials.materials.map(m=>m.id));
  const movementIds:string[]=[];
  for(const group of aggregateMarcoZeroRows(preview)){
   if(!available.has(group.materialId)){
    const material=createMaterialFromSiscofisRow({workspaceId:ws,ug:access.ug,
     materialId:group.materialId,row:group.representativeRow});
    await saveWarehouseMaterialServer(access,material);
    available.add(group.materialId);
   }
   const applied=await warehouseLedgerMovementServer(access,{
    materialId:group.materialId,type:'INITIAL_BALANCE',quantityDelta:group.quantity,
    idempotencyKey:'siscofis:marco-zero:'+preview.sourceHash+':'+group.materialId,
    note:'Marco Zero SISCOFIS '+importData.referenceDate
      +' · linhas '+group.rowIds.join(',').slice(0,150),source:null,
   });
   movementIds.push(applied.movement.id);
  }
  const fresh=await canonicalRows(access,authToken);
  const rows=finalRows(preview,fresh.balances);
  const summary={...preview.summary,matchedRows:rows.filter(r=>r.state==='MATCHED').length,
    unresolvedRows:rows.filter(r=>r.state==='UNRESOLVED').length,divergentRows:0};
  return warehouseAdminTransaction(authToken,[snapPath],r=>{
   const row=r.get(snapPath);
   if(!row||row.data.sourceHash!==preview.sourceHash||row.data.ug!==access.ug){
    return fail('WAREHOUSE_SISCOFIS_SNAPSHOT_CONCURRENT_CHANGE');
   }
   if(row.data.status==='CONFIRMED')return {result:fromDoc(row),writes:[]};
   const final={...row.data,status:'CONFIRMED',rows,summary,
    movementIds:[...new Set(movementIds)],confirmedAt:new Date()};
   return {result:fromDoc({path:snapPath,data:{...final,confirmedAt:new Date().toISOString()},
    updateTime:''}),writes:[{path:snapPath,data:final}]};
  });
 }
 const rows=finalRows(preview,balancesAndMaterials.balances);
 const summary={...preview.summary,matchedRows:rows.filter(r=>r.state==='MATCHED').length,
  unresolvedRows:rows.filter(r=>r.state==='UNRESOLVED').length,
  divergentRows:rows.filter(r=>r.state==='DIVERGENT').length,createsMaterials:0};
 return warehouseAdminTransaction(authToken,[snapPath],r=>{
  const prior=r.get(snapPath);
  if(prior){
   if(prior.data.sourceHash!==preview.sourceHash)return fail('WAREHOUSE_SISCOFIS_SNAPSHOT_CONFLICT');
   return {result:fromDoc(prior),writes:[]};
  }
  const now=new Date(),record=asSnapshot({id:snapshotId,access,preview,cutoff,
   status:'CONFIRMED',movementIds:[],rows,summary,createdAt:now,confirmedAt:now});
  return {result:fromDoc({path:snapPath,data:{...record,
    createdAt:now.toISOString(),confirmedAt:now.toISOString()},updateTime:''}),
   writes:[{path:snapPath,data:record}]};
 });
}
