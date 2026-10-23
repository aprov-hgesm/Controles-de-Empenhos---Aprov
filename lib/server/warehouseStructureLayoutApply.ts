/**
 * Uma unica transacao para Croqui 2D + cadastros fisicos.
 * O browser jamais escreve no Firestore. Os indexes de codigo existentes sao
 * reivindicados no mesmo commit, inclusive em concorrencia entre operadores.
 */
import { createHash } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction, warehouseAdminListCollection, WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  WAREHOUSE_LOCATION_SCHEMA_VERSION, normalizeWarehouseLogicalCode,
  validateWarehouseDepot, validateWarehouseLocation, validateWarehouseLocationBalance,
  type WarehouseLocation,
} from '../warehouse/location';
import { validateWarehouseLot } from '../warehouse/lot';
import {
  createWarehouseDepotLayoutId, validateWarehouseDepotLayout,
  type WarehouseDepotLayout, type WarehouseDepotLayoutObject,
} from '../warehouse/layout';
import {
  warehouseCanonicalDepotReadInput, warehouseCanonicalLocationReadInput,
  warehouseCanonicalLocationBalanceReadInput, warehouseCanonicalLotReadInput,
} from '../warehouse/readCompatibility';
import type { SaveWarehouseDepotLayoutVersionInput } from '../warehouse/layoutRepository';

export interface CroquiCreateLocal {
  objectId: string;
  code: string;
  name: string;
  description: string | null;
  sourceLocationId: string | null;
  subpositionCount: number;
}
export interface CroquiCreateSubposition {
  parentLocationId: string;
  code: string;
  name: string;
  description: string | null;
}
export interface CroquiRenameLocal {
  id: string;
  name: string;
  description: string | null;
}
export interface CroquiStructureApplyInput extends SaveWarehouseDepotLayoutVersionInput {
  operationId: string;
  createLocals: CroquiCreateLocal[];
  createSubpositions: CroquiCreateSubposition[];
  editLocals: CroquiRenameLocal[];
  archiveLocationIds: string[];
  archiveSubpositionIds: string[];
}
export interface CroquiStructureApplyResult {
  layout: WarehouseDepotLayout;
  createdLocations: WarehouseLocation[];
  archivedLocationIds: string[];
}

const fail=(code:string,status=409):never=>{throw new WarehouseStoreError(code,status);};
const path=(ws:string,group:string,id:string)=>'warehouse/'+ws+'/'+group+'/'+id;
const digest=(key:string)=>createHash('sha256').update(key).digest('hex');
const deterministicId=(prefix:string,seed:string)=>prefix+digest(seed).slice(0,32);
const claimId=(scope:string)=>'claim_'+digest(scope);
const token=()=>process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
  ?Promise.resolve('emulator'):getGoogleAccessToken();
function nonempty(value:unknown,limit=120):value is string{
  return typeof value==='string' && value.trim().length>0 && value.trim().length<=limit;
}
function existingLocation(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument){
  const id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseLocation(warehouseCanonicalLocationReadInput(id,row.data),{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!r.ok)return fail('WAREHOUSE_CROQUI_LOCATION_INVALID');
  return r.data;
}
function existingLayout(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument){
  const id=row.path.split('/').at(-1)||'';
  const d=row.data;
  const r=validateWarehouseDepotLayout({
    schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,
    name:d.name,depotId:d.depotId??null,logicalWidth:d.logicalWidth,
    logicalHeight:d.logicalHeight,objects:d.objects,version:d.version,status:d.status,
    previousVersionId:d.previousVersionId??null,createdBy:d.createdBy,updatedBy:d.updatedBy,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
  if(!r.ok)return fail('WAREHOUSE_CROQUI_LAYOUT_INVALID');
  return r.data;
}

/** A operacao depende obrigatoriamente de uma versao exata, inclusive null. */
export async function warehouseStructureLayoutApplyServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<CroquiStructureApplyResult> {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_CROQUI_INPUT',400);
  const data=raw as CroquiStructureApplyInput;
  if(typeof data.depotId!=='string'||!/^dep_[a-f0-9]{32}$/.test(data.depotId)
    ||typeof data.operationId!=='string'||!/^[a-f0-9-]{32,40}$/.test(data.operationId)
    ||!nonempty(data.name)||!Array.isArray(data.objects)||data.objects.length>160
    ||!Array.isArray(data.createLocals)||data.createLocals.length>12
    ||!Array.isArray(data.createSubpositions)||data.createSubpositions.length>20
    ||!Array.isArray(data.editLocals)||data.editLocals.length>30
    ||!Array.isArray(data.archiveLocationIds)||data.archiveLocationIds.length>12
    ||!Array.isArray(data.archiveSubpositionIds)||data.archiveSubpositionIds.length>20
    ||!Object.prototype.hasOwnProperty.call(data,'expectedVersion')
    ||!Object.prototype.hasOwnProperty.call(data,'baseLayoutId')
    ||!(data.expectedVersion===null||(typeof data.expectedVersion==='number'&&Number.isInteger(data.expectedVersion)&&data.expectedVersion>=1))
    ||!(data.baseLayoutId===null||(typeof data.baseLayoutId==='string'&&/^lay_[a-f0-9]{32}$/.test(data.baseLayoutId)))
  )return fail('WAREHOUSE_CROQUI_INPUT',400);
  const {workspaceId:ws,ug}=access,depotId=data.depotId;
  const authToken=await token();
  const all=await Promise.all([
    warehouseAdminListCollection(authToken,ws,'layouts',500),
    warehouseAdminListCollection(authToken,ws,'locations',500),
  ]);
  const previous=all[0].map(row=>({row,layout:existingLayout(access,row)}))
    .filter(entry=>entry.layout.depotId===depotId && entry.layout.status==='active');
  if(previous.length>1)return fail('WAREHOUSE_CROQUI_MULTIPLE_ACTIVE');
  const current=previous[0]??null;
  const locRows=all[1],byId=new Map(locRows.map(row=>[row.path.split('/').at(-1)||'',row]));
  const currentLocations=locRows.map(row=>existingLocation(access,row));
  // Idempotencia do layout e dos IDs criados: nunca repetir uma criacao por retry.
  const layoutId=deterministicId('lay_',ws+':croqui:'+data.operationId);
  const existingSaved=all[0].find(row=>row.path===path(ws,'layouts',layoutId));
  if(existingSaved){
    const saved=existingLayout(access,existingSaved);
    if(saved.depotId!==depotId||saved.createdBy!==access.uid)
      return fail('WAREHOUSE_CROQUI_REPLAY_CONFLICT');
    return {layout:saved,createdLocations:[],archivedLocationIds:[]};
  }
  if(current?.layout.id!==data.baseLayoutId || (current?.layout.version??null)!==data.expectedVersion)
    return fail('WAREHOUSE_CROQUI_VERSION_CONFLICT');
  const usedCodes=new Set(currentLocations
    .filter(loc=>loc.depotId===depotId&&loc.status==='active'&&loc.kind==='LOCAL')
    .map(loc=>loc.code));
  const createByObject=new Map<string,WarehouseLocation>();
  const newRows:Array<{location:WarehouseLocation;claim:string}>=[];
  const createSpecs:Array<{spec:CroquiCreateLocal;location:WarehouseLocation}>=[];
  const stamp=new Date();
  function createLocation(
    kind:'LOCAL'|'SUBPOSITION',codeInput:string,name:string,
    description:string|null,parentLocationId:string|null,seed:string
  ):WarehouseLocation{
    const code=normalizeWarehouseLogicalCode(codeInput);
    if(!code||!nonempty(name))return fail('WAREHOUSE_CROQUI_LOCATION_INPUT',400);
    const id=deterministicId(kind==='LOCAL'?'loc_':'sub_',ws+':'+data.operationId+':'+seed);
    if(description!==null && (typeof description!=='string'||description.length>500))
      return fail('WAREHOUSE_CROQUI_LOCATION_DESCRIPTION',400);
    const candidate={
      schemaVersion:WAREHOUSE_LOCATION_SCHEMA_VERSION,id,workspaceId:ws,ug,depotId,kind,
      parentLocationId,code,name,description,status:'active' as const,
      createdBy:access.uid,updatedBy:access.uid,
    };
    const validated=validateWarehouseLocation(candidate,{expectedWorkspaceId:ws,expectedUg:ug});
    if(!validated.ok)return fail('WAREHOUSE_CROQUI_LOCATION_INPUT',400);
    const claim=claimId('LOCATION:'+kind+':'+depotId+':'+(parentLocationId??'')+':'+code);
    newRows.push({location:validated.data,claim});
    return validated.data;
  }
  for(const spec of data.createLocals){
    if(!spec||!nonempty(spec.objectId,40)||!/^obj_[a-f0-9]{32}$/.test(spec.objectId)
      ||createByObject.has(spec.objectId)||typeof spec.code!=='string'
      ||!(spec.sourceLocationId===null||(typeof spec.sourceLocationId==='string'&&/^loc_[a-f0-9]{32}$/.test(spec.sourceLocationId)))
      ||!Number.isInteger(spec.subpositionCount)||spec.subpositionCount<0||spec.subpositionCount>30
      ||(spec.description!==null&&typeof spec.description!=='string')){
      return fail('WAREHOUSE_CROQUI_CREATE_INPUT',400);
    }
    const code=normalizeWarehouseLogicalCode(spec.code);
    if(!code||usedCodes.has(code))return fail('WAREHOUSE_CROQUI_DUPLICATE_CODE');
    usedCodes.add(code);
    const location=createLocation('LOCAL',code,spec.name,spec.description,null,spec.objectId);
    createByObject.set(spec.objectId,location);
    createSpecs.push({spec,location});
    if(spec.sourceLocationId){
      const source=byId.get(spec.sourceLocationId);
      if(!source)return fail('WAREHOUSE_CROQUI_SOURCE_NOT_FOUND');
      const parsed=existingLocation(access,source);
      if(parsed.depotId!==depotId||parsed.kind!=='LOCAL'||parsed.status!=='active')
        return fail('WAREHOUSE_CROQUI_SOURCE_INVALID');
      const children=currentLocations.filter(c=>c.parentLocationId===parsed.id&&c.kind==='SUBPOSITION'&&c.status==='active');
      if(children.length>30)return fail('WAREHOUSE_CROQUI_TOO_MANY_SUBPOSITIONS');
      for(const [index,child] of children.entries()){
        const suffix=child.code.startsWith(parsed.code)?child.code.slice(parsed.code.length):'-'+String(index+1).padStart(2,'0');
        createLocation('SUBPOSITION',code+suffix,child.name,child.description,location.id,spec.objectId+':'+index);
      }
    }else{
      for(let i=1;i<=spec.subpositionCount;i++){
        const sequence=String(i).padStart(2,'0');
        createLocation('SUBPOSITION',code+'-'+sequence,'Subposição '+sequence,null,location.id,spec.objectId+':'+i);
      }
    }
  }
  const existingChildCodes = new Set(currentLocations
    .filter(loc=>loc.kind==='SUBPOSITION'&&loc.status==='active')
    .map(loc=>loc.parentLocationId+':'+loc.code));
  const newChildCodes=new Set<string>();
  for(const child of data.createSubpositions){
    if(!child||typeof child.parentLocationId!=='string'
      ||!/^loc_[a-f0-9]{32}$/.test(child.parentLocationId)
      ||typeof child.code!=='string'||!nonempty(child.name)
      ||(child.description!==null&&typeof child.description!=='string'))
      return fail('WAREHOUSE_CROQUI_SUBPOSITION_INPUT',400);
    if(data.archiveLocationIds.includes(child.parentLocationId))
      return fail('WAREHOUSE_CROQUI_ARCHIVED_PARENT',400);
    const parent=byId.get(child.parentLocationId);
    if(!parent)return fail('WAREHOUSE_CROQUI_PARENT_MISSING');
    const parsed=existingLocation(access,parent);
    if(parsed.kind!=='LOCAL'||parsed.depotId!==depotId||parsed.status!=='active')
      return fail('WAREHOUSE_CROQUI_PARENT_INVALID');
    const code=normalizeWarehouseLogicalCode(child.code);
    if(!code)return fail('WAREHOUSE_CROQUI_SUBPOSITION_CODE',400);
    const scoped=parsed.id+':'+code;
    if(existingChildCodes.has(scoped)||newChildCodes.has(scoped))
      return fail('WAREHOUSE_CROQUI_DUPLICATE_CODE');
    newChildCodes.add(scoped);
    createLocation('SUBPOSITION',code,child.name,child.description,
      parsed.id,'new-sub:'+parsed.id+':'+code);
  }
  const objects=data.objects.map(item=>{
    const loc=createByObject.get(item.id);
    return loc?{...item,warehouseLocationId:loc.id,label:loc.code+' · '+loc.name}:item;
  });
  if(createByObject.size!==objects.filter(item=>createByObject.has(item.id)).length)
    return fail('WAREHOUSE_CROQUI_OBJECT_DUPLICATE',400);
  for(const objectId of createByObject.keys()){
    const item=objects.find(o=>o.id===objectId);
    if(!item||data.objects.find(o=>o.id===objectId)?.warehouseLocationId!==null)
      return fail('WAREHOUSE_CROQUI_OBJECT_NOT_FOUND',400);
  }
  if(data.archiveLocationIds.some(id=>typeof id!=='string'||!/^loc_[a-f0-9]{32}$/.test(id)))
    return fail('WAREHOUSE_CROQUI_ARCHIVE_INPUT',400);
  const archiveIds=new Set(data.archiveLocationIds);
  if(archiveIds.size!==data.archiveLocationIds.length)return fail('WAREHOUSE_CROQUI_ARCHIVE_INPUT',400);
  if(data.archiveSubpositionIds.some(id=>typeof id!=='string'||!/^sub_[a-f0-9]{32}$/.test(id)))
    return fail('WAREHOUSE_CROQUI_ARCHIVE_INPUT',400);
  const directChildArchives=new Set(data.archiveSubpositionIds);
  if(directChildArchives.size!==data.archiveSubpositionIds.length)
    return fail('WAREHOUSE_CROQUI_ARCHIVE_INPUT',400);
  const updatedIds=new Set<string>();
  const edits=data.editLocals.map(item=>{
    if(!item||typeof item.id!=='string'||updatedIds.has(item.id)
      ||!nonempty(item.name)||(item.description!==null&&typeof item.description!=='string'))
      return fail('WAREHOUSE_CROQUI_EDIT_INPUT',400);
    updatedIds.add(item.id);
    const row=byId.get(item.id);
    if(!row)return fail('WAREHOUSE_CROQUI_EDIT_NOT_FOUND');
    const loc=existingLocation(access,row);
    if(loc.status!=='active'||loc.depotId!==depotId
      ||(loc.kind!=='LOCAL'&&loc.kind!=='SUBPOSITION')
      ||archiveIds.has(loc.id)||directChildArchives.has(loc.id)
      ||(loc.parentLocationId!==null&&archiveIds.has(loc.parentLocationId)))
      return fail('WAREHOUSE_CROQUI_EDIT_INVALID');
    return {id:item.id,location:loc,name:item.name.trim(),description:item.description};
  });
  const archives=new Set<string>();
  for(const id of directChildArchives){
    const row=byId.get(id);
    if(!row)return fail('WAREHOUSE_CROQUI_ARCHIVE_NOT_FOUND');
    const child=existingLocation(access,row);
    if(child.kind!=='SUBPOSITION'||child.status!=='active'||child.depotId!==depotId)
      return fail('WAREHOUSE_CROQUI_ARCHIVE_INVALID');
    archives.add(id);
  }
  for(const id of archiveIds){
    const row=byId.get(id);
    if(!row)return fail('WAREHOUSE_CROQUI_ARCHIVE_NOT_FOUND');
    const loc=existingLocation(access,row);
    if(loc.kind!=='LOCAL'||loc.depotId!==depotId||loc.status!=='active')
      return fail('WAREHOUSE_CROQUI_ARCHIVE_INVALID');
    archives.add(id);
    for(const child of currentLocations.filter(child=>child.parentLocationId===id&&child.status==='active')){
      archives.add(child.id);
    }
  }
  for(const object of objects){
    if(object.warehouseLocationId && archives.has(object.warehouseLocationId))
      return fail('WAREHOUSE_CROQUI_ARCHIVE_REFERENCED');
  }
  const refs=objects.map(o=>o.warehouseLocationId).filter((id):id is string=>!!id);
  if(new Set(refs).size!==refs.length)return fail('WAREHOUSE_CROQUI_DUPLICATE_REFERENCE');
  const candidate=validateWarehouseDepotLayout({
    schemaVersion:'warehouse_depot_layout_v1',id:layoutId,workspaceId:ws,ug,
    name:data.name,depotId,logicalWidth:data.logicalWidth,logicalHeight:data.logicalHeight,
    objects,version:(current?.layout.version??0)+1,status:'active',
    previousVersionId:current?.layout.id??null,createdBy:access.uid,updatedBy:access.uid,
  },{expectedWorkspaceId:ws,expectedUg:ug});
  if(!candidate.ok)return fail('WAREHOUSE_CROQUI_LAYOUT_INPUT',400);
  const layout=candidate.data;
  const archiveBalances=archives.size?
    await warehouseAdminListCollection(authToken,ws,'locationBalances',500):[];
  const archiveLots=archives.size?
    await warehouseAdminListCollection(authToken,ws,'lots',500):[];
  const affectedPosition=(position:unknown):boolean=>{
    if(!position||typeof position!=='object')return false;
    const p=position as {locationId?:unknown;subpositionId?:unknown};
    return (typeof p.locationId==='string'&&archives.has(p.locationId))
      ||(typeof p.subpositionId==='string'&&archives.has(p.subpositionId));
  };
  const balances=archiveBalances.filter(row=>affectedPosition(row.data.position));
  const lots=archiveLots.filter(row=>affectedPosition(row.data.position));
  const allPaths=[
    path(ws,'layouts',layoutId),path(ws,'depots',depotId),
    ...(current?[current.row.path]:[]),
    ...refs.filter(id=>!newRows.some(n=>n.location.id===id)).map(id=>path(ws,'locations',id)),
    ...newRows.flatMap(n=>[path(ws,'locations',n.location.id),path(ws,'structureCodeClaims',n.claim)]),
    ...data.createSubpositions.map(child=>path(ws,'locations',child.parentLocationId)),
    ...createSpecs.flatMap(entry=>entry.spec.sourceLocationId
      ?[path(ws,'locations',entry.spec.sourceLocationId),
        ...currentLocations.filter(c=>c.parentLocationId===entry.spec.sourceLocationId&&c.status==='active')
          .map(c=>path(ws,'locations',c.id))]
      :[]),
    ...edits.map(e=>path(ws,'locations',e.id)),
    ...[...archives].map(id=>path(ws,'locations',id)),
    ...balances.map(row=>row.path),...lots.map(row=>row.path),
  ];
  const reads=[...new Set(allPaths)];
  if(reads.length>450||newRows.length*2+archives.size+edits.length+3>430)
    return fail('WAREHOUSE_CROQUI_TOO_LARGE',400);
  return warehouseAdminTransaction(authToken,reads,rows=>{
    if(rows.get(path(ws,'layouts',layoutId)))return fail('WAREHOUSE_CROQUI_RETRY');
    const depotRow=rows.get(path(ws,'depots',depotId));
    if(!depotRow)return fail('WAREHOUSE_CROQUI_DEPOT_NOT_FOUND');
    const depot=validateWarehouseDepot(warehouseCanonicalDepotReadInput(depotId,depotRow.data),{
      expectedWorkspaceId:ws,expectedUg:ug,
    });
    if(!depot.ok||depot.data.status!=='active')return fail('WAREHOUSE_CROQUI_DEPOT_INACTIVE');
    if(current){
      const stored=rows.get(current.row.path);
      if(!stored||existingLayout(access,stored).status!=='active'
        ||existingLayout(access,stored).version!==current.layout.version)
        return fail('WAREHOUSE_CROQUI_VERSION_CONFLICT');
    }
    for(const id of refs){
      if(newRows.some(n=>n.location.id===id))continue;
      const row=rows.get(path(ws,'locations',id));
      if(!row)return fail('WAREHOUSE_CROQUI_LOCATION_NOT_FOUND');
      const loc=existingLocation(access,row);
      if(loc.status!=='active'||loc.depotId!==depotId||loc.kind!=='LOCAL')
        return fail('WAREHOUSE_CROQUI_LOCATION_INVALID');
    }
    for(const entry of createSpecs){
      if(!entry.spec.sourceLocationId)continue;
      const source=rows.get(path(ws,'locations',entry.spec.sourceLocationId));
      if(!source)return fail('WAREHOUSE_CROQUI_SOURCE_CHANGED');
      const loc=existingLocation(access,source);
      if(loc.status!=='active'||loc.depotId!==depotId)
        return fail('WAREHOUSE_CROQUI_SOURCE_CHANGED');
      for(const child of currentLocations.filter(c=>c.parentLocationId===loc.id&&c.status==='active')){
        const fresh=rows.get(path(ws,'locations',child.id));
        if(!fresh||existingLocation(access,fresh).status!=='active')
          return fail('WAREHOUSE_CROQUI_SOURCE_CHANGED');
      }
    }
    for(const child of data.createSubpositions){
      const row=rows.get(path(ws,'locations',child.parentLocationId));
      if(!row)return fail('WAREHOUSE_CROQUI_PARENT_MISSING');
      const parent=existingLocation(access,row);
      if(parent.status!=='active'||parent.depotId!==depotId||parent.kind!=='LOCAL')
        return fail('WAREHOUSE_CROQUI_PARENT_INVALID');
    }
    for(const {location,claim} of newRows){
      if(rows.get(path(ws,'locations',location.id))
        ||rows.get(path(ws,'structureCodeClaims',claim)))
        return fail('WAREHOUSE_CROQUI_DUPLICATE_CODE');
    }
    for(const row of balances){
      const fresh=rows.get(row.path);
      if(!fresh)return fail('WAREHOUSE_CROQUI_ARCHIVE_CONFLICT');
      const id=row.path.split('/').at(-1)||'';
      const b=validateWarehouseLocationBalance(
        warehouseCanonicalLocationBalanceReadInput(id,fresh.data),{expectedWorkspaceId:ws});
      if(!b.ok||b.data.ug!==ug)return fail('WAREHOUSE_CROQUI_ARCHIVE_BALANCE_INVALID');
      if(b.data.quantity>0&&affectedPosition(b.data.position))
        return fail('WAREHOUSE_CROQUI_LOCATION_OCCUPIED');
    }
    for(const row of lots){
      const fresh=rows.get(row.path);
      if(!fresh)return fail('WAREHOUSE_CROQUI_ARCHIVE_CONFLICT');
      const id=row.path.split('/').at(-1)||'';
      const lot=validateWarehouseLot(warehouseCanonicalLotReadInput(id,fresh.data),{
        expectedWorkspaceId:ws,expectedUg:ug,
      });
      if(!lot.ok)return fail('WAREHOUSE_CROQUI_ARCHIVE_LOT_INVALID');
      if(lot.data.status==='active'&&lot.data.quantity>0&&affectedPosition(lot.data.position))
        return fail('WAREHOUSE_CROQUI_LOCATION_HAS_ACTIVE_LOT');
    }
    const writes:Array<{path:string;data:Record<string,unknown>}>=[
      {path:path(ws,'layouts',layoutId),data:{...layout,createdAt:stamp,updatedAt:stamp}},
      // O mesmo documento do deposito serializa commits concorrentes da Central.
      {path:path(ws,'depots',depotId),data:{...depotRow.data,updatedAt:stamp,updatedBy:access.uid}},
    ];
    if(current){
      const old=rows.get(current.row.path)!;
      writes.push({path:current.row.path,data:{...old.data,status:'archived',
        updatedAt:stamp,updatedBy:access.uid}});
    }
    for(const {location,claim} of newRows){
      writes.push({path:path(ws,'locations',location.id),
        data:{...location,createdAt:stamp,updatedAt:stamp}});
      writes.push({path:path(ws,'structureCodeClaims',claim),data:{
        workspaceId:ws,ug,entityId:location.id,entityKind:location.kind,
        depotId,parentLocationId:location.parentLocationId,code:location.code,createdAt:stamp,
      }});
    }
    for(const edit of edits){
      const p=path(ws,'locations',edit.id),row=rows.get(p);
      if(!row)return fail('WAREHOUSE_CROQUI_EDIT_CONFLICT');
      const live=existingLocation(access,row);
      if((live.kind!=='LOCAL'&&live.kind!=='SUBPOSITION')
        ||live.status!=='active'||live.depotId!==depotId)
        return fail('WAREHOUSE_CROQUI_EDIT_CONFLICT');
      writes.push({path:p,data:{...row.data,name:edit.name,description:edit.description,
        updatedAt:stamp,updatedBy:access.uid}});
    }
    for(const id of archives){
      const p=path(ws,'locations',id),row=rows.get(p);
      if(!row)return fail('WAREHOUSE_CROQUI_ARCHIVE_CONFLICT');
      const live=existingLocation(access,row);
      if(live.status!=='active'||live.depotId!==depotId)
        return fail('WAREHOUSE_CROQUI_ARCHIVE_CONFLICT');
      writes.push({path:p,data:{...row.data,status:'inactive',
        updatedAt:stamp,updatedBy:access.uid}});
    }
    return {result:{
      layout,createdLocations:createSpecs.map(x=>x.location),
      archivedLocationIds:[...archives],
    },writes};
  });
}
