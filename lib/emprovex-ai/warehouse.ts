/** Contratos C07 e C08: somente saldo canonico e posicoes materializadas do Warehouse. */
import type { AiAccess } from './authorize';
import type { AiQuery } from './contracts';
import { AiExecutionError, type QueryOutcome } from './response';
import { warehouseDocument, warehouseQuery, warehouseMaterialNameSearch, type AiRow } from './reader';
import { createWarehouseBarcodeId } from '../warehouse/barcode';

function s(v:unknown):string{return typeof v==='string'?v:'';}
function positiveQuantity(v:unknown):number {
  if(typeof v!=='number'||!Number.isFinite(v)||v<0)
    throw new AiExecutionError('AI_WAREHOUSE_QUANTITY_INTEGRITY',503);
  return v;
}
function ensureScope(value:Record<string,unknown>,access:AiAccess):void {
  if(value.workspaceId!==access.workspaceId||value.ug!==access.ug)
    throw new AiExecutionError('AI_WAREHOUSE_SCOPE_INTEGRITY',503);
}
async function resolveMaterial(access:AiAccess,p:Record<string,unknown>):
 Promise<{row:AiRow|null;candidates:AiRow[];examined:number;incomplete:boolean}> {
  const id=s(p.materialId),barcode=s(p.barcode);
  if(id){
    const row=await warehouseDocument(access,'materials',id);
    return {row,candidates:[],examined:1,incomplete:false};
  }
  if(barcode){
    const barcodeId=await createWarehouseBarcodeId(access.workspaceId,barcode);
    const association=await warehouseDocument(access,'barcodes',barcodeId);
    if(!association || association.data.barcode!==barcode || association.data.status!=='active')
      return {row:null,candidates:[],examined:1,incomplete:false};
    const materialId=s(association.data.materialId);
    if(!/^mat_[a-f0-9]{32}$/.test(materialId))throw new AiExecutionError('AI_BARCODE_MATERIAL_INVALID',503);
    const row=await warehouseDocument(access,'materials',materialId);
    return {row,candidates:[],examined:2,incomplete:false};
  }
  const raw=s(p.materialQuery).trim();
  // Fast exact indexed lookup, scoped to this workspace. Duplicate exact names
  // require disambiguation rather than silently selecting the first record.
  const exact=await warehouseQuery(access,'materials',{field:'description',value:raw},3);
  if(exact.rows.length){
    return {row:exact.rows.length===1&&!exact.truncated?exact.rows[0]:null,
      candidates:exact.rows,examined:exact.examined,incomplete:exact.truncated};
  }
  // A product family (e.g. "arroz") is often part of a longer description.
  // The new read-only Warehouse discovery scans real paginated catalog pages,
  // bounded by W3 limits; only an exhausted scan can establish uniqueness.
  const q=await warehouseMaterialNameSearch(access,raw);
  const candidates=q.rows;
  return {row:candidates.length===1&&!q.truncated?candidates[0]:null,candidates,
    examined:exact.examined+q.examined,incomplete:q.truncated};
}
function materialDetails(row:AiRow) {
  return {materialId:row.id,description:row.data.description,unit:row.data.unit,
    aliases:row.data.aliases};
}
function unresolved(resolved:Awaited<ReturnType<typeof resolveMaterial>>):QueryOutcome {
  const ambiguous=resolved.candidates.length>1;
  return {status:ambiguous?'ambiguous':resolved.incomplete?'partial':'empty',
    // Expose real names/units for a human-readable choice. An incomplete
    // catalog must NEVER be presented as a definitive list or zero.
    data:resolved.candidates.length?
      {candidates:resolved.candidates.slice(0,12).map(materialDetails)}:null,
    evidence:resolved.candidates.slice(0,12).map(row=>({source:'warehouse.materials',documentId:row.id})),
    limitations:resolved.incomplete?
      ['Busca parcial no catálogo autorizado. Você pode escolher uma das opções encontradas ou informar um nome mais específico.']:[],
    coverage:resolved.incomplete?'incomplete':'complete',truncated:resolved.incomplete,
    examinedDocuments:resolved.examined};
}
async function stock(access:AiAccess,p:Record<string,unknown>):Promise<QueryOutcome>{
  const material=await resolveMaterial(access,p);
  if(!material.row)return unresolved(material);
  ensureScope(material.row.data,access);
  const balance=await warehouseDocument(access,'balances',material.row.id);
  if(!balance)return {status:'partial',coverage:'unknown',
    data:{...materialDetails(material.row),quantity:null},
    limitations:['Documento de saldo agregado ausente: não é possível inferir saldo zero.'],
    evidence:[{source:'warehouse.materials',documentId:material.row.id}],
    examinedDocuments:material.examined+1};
  const quantity=positiveQuantity(balance.data.quantity);
  return {data:{...materialDetails(material.row),quantity,asOf:new Date().toISOString()},
    evidence:[{source:'warehouse.materials',documentId:material.row.id},
      {source:'warehouse.balances',documentId:balance.id}],
    examinedDocuments:material.examined+1};
}
async function locations(access:AiAccess,p:Record<string,unknown>):Promise<QueryOutcome>{
  const material=await resolveMaterial(access,p);
  if(!material.row)return unresolved(material);
  const q=await warehouseQuery(access,'locationBalances',{field:'materialId',value:material.row.id},101);
  const physical=q.rows.filter(row=>positiveQuantity(row.data.quantity)>0
    && (row.data.position as Record<string,unknown>|undefined)?.kind!=='UNASSIGNED');
  const pageSize=typeof p.pageSize==='number'?p.pageSize:20;
  const selected=physical.slice(0,pageSize);
  // Cache in-flight promises to avoid repeat reads and overlap independent lookups.
  const depotCache=new Map<string,Promise<AiRow|null>>(),locationCache=new Map<string,Promise<AiRow|null>>();
  const getDepot=(id:string):Promise<AiRow|null>=>{
    let task=depotCache.get(id);
    if(!task){task=warehouseDocument(access,'depots',id);depotCache.set(id,task);}
    return task;
  };
  const getLocation=(id:string):Promise<AiRow|null>=>{
    let task=locationCache.get(id);
    if(!task){task=warehouseDocument(access,'locations',id);locationCache.set(id,task);}
    return task;
  };
  const out:Record<string,unknown>[]=[];
  const evidence=[{source:'warehouse.materials',documentId:material.row.id}];
  let missing=false;
  for(const row of selected){
    const position=row.data.position as Record<string,unknown>;
    if(!position || !['LOCATION','SUBPOSITION'].includes(s(position.kind)))
      throw new AiExecutionError('AI_LOCATION_POSITION_INVALID',503);
    const depotId=s(position.depotId),locationId=s(position.locationId);
    const subId=s(position.subpositionId);
    if(!/^dep_[a-f0-9]{32}$/.test(depotId)||!/^loc_[a-f0-9]{32}$/.test(locationId)
      || (subId&&!/^sub_[a-f0-9]{32}$/.test(subId)))throw new AiExecutionError('AI_LOCATION_LINK_INVALID',503);
    const [depot,location,sub]=await Promise.all([
      getDepot(depotId),getLocation(locationId),subId?getLocation(subId):Promise.resolve(null)
    ]);
    if(!depot||!location||(subId&&!sub) || location.data.depotId!==depotId
      ||(sub && (sub.data.parentLocationId!==locationId || sub.data.depotId!==depotId))){
      missing=true;
      continue;
    }
    if(p.depotId && p.depotId!==depotId)continue;
    out.push({materialId:material.row.id,quantity:positiveQuantity(row.data.quantity),
      depot:{id:depot.id,name:depot.data.name,code:depot.data.code},
      shelf:{id:location.id,name:location.data.name,code:location.data.code},
      position:sub?{id:sub.id,name:sub.data.name,code:sub.data.code}:null,
      unit:material.row.data.unit});
    evidence.push({source:'warehouse.locationBalances',documentId:row.id},
      {source:'warehouse.depots',documentId:depot.id},
      {source:'warehouse.locations',documentId:location.id});
  }
  const incomplete=q.truncated||physical.length>pageSize||missing;
  return {status:incomplete?'partial':out.length?'ok':'empty',
    data:{material:materialDetails(material.row),locations:out},
    evidence,coverage:incomplete?'incomplete':'complete',truncated:incomplete,
    limitations:[...(missing?['Há saldo por posição com depósito ou localização inconsistente.']:[]),
      ...(incomplete?['Limite de posições atingido; refinar depósito ou identificação.']:[]),
      'Ausência de posição física não significa saldo agregado zero.'],
    examinedDocuments:material.examined+q.examined+depotCache.size+locationCache.size};
}
export async function executeWarehouse(access:AiAccess,q:AiQuery):Promise<QueryOutcome>{
  if(q.intent==='warehouse_stock_get')return stock(access,q.params);
  if(q.intent==='warehouse_material_locations_list')return locations(access,q.params);
  throw new AiExecutionError('AI_WAREHOUSE_CONTRACT_UNSUPPORTED',422);
}
