/**
 * Migração explícita e delimitada ao DEP-001 da 6ª Bda Inf Bld.
 * Nunca cria locais, remove estoque ou altera IDs; apenas código/nome das
 * subposições legadas, com reivindicações de código atualizadas atomicamente.
 */
import { createHash } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminListByField, warehouseAdminTransaction, WarehouseStoreError,
  type WarehouseAdminDocument, type WarehouseAdminTransactionWrite,
} from './warehouseFirestoreTransaction';
import { validateWarehouseDepot, validateWarehouseLocation, type WarehouseLocation } from '../warehouse/location';
import { warehouseCanonicalDepotReadInput, warehouseCanonicalLocationReadInput } from '../warehouse/readCompatibility';
import { warehouseShelfCanonicalCode } from '../warehouse/subpositionCode';

type MigrationMode = 'PREVIEW' | 'APPLY';
type MigrationInput = {mode:MigrationMode;depotId:string;planHash?:string;confirmDepotCode?:string};
type Candidate = {id:string;location:WarehouseLocation;parent:WarehouseLocation;newCode:string};
const path=(ws:string,domain:string,id:string)=>'warehouse/'+ws+'/'+domain+'/'+id;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const claimId=(kind:string,depotId:string,parentLocationId:string,code:string)=>
  'claim_'+hash('LOCATION:'+kind+':'+depotId+':'+parentLocationId+':'+code);
const fail=(code:string,status=409):never=>{throw new WarehouseStoreError(code,status);};
const token=()=>process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
  ?Promise.resolve('emulator'):getGoogleAccessToken();
function parsedLocation(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument):WarehouseLocation {
  const id=row.path.split('/').at(-1)||'';
  const check=validateWarehouseLocation(warehouseCanonicalLocationReadInput(id,row.data),{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!check.ok)return fail('WAREHOUSE_SHELF_LOCATION_INVALID');
  return check.data;
}

export async function warehouseShelfMigrationServer(access:VerifiedWarehouseRequest,raw:unknown){
  if(!raw || typeof raw!=='object'||Array.isArray(raw))return fail('WAREHOUSE_SHELF_INPUT',400);
  const input=raw as MigrationInput;
  if((input.mode!=='PREVIEW'&&input.mode!=='APPLY')
    ||typeof input.depotId!=='string'||!/^dep_[a-f0-9]{32}$/.test(input.depotId))
    return fail('WAREHOUSE_SHELF_INPUT',400);
  // Operação não é um comando de renomeação arbitrário: piloto somente na UG e
  // workspace autorizados. O escopo real vem exclusivamente da sessão verificada.
  if(access.workspaceId!=='aprovisionamento-6-bda-inf-bld'||access.ug!=='160413')
    return fail('WAREHOUSE_SHELF_PILOT_SCOPE',403);
  const authToken=await token();
  const depotPath=path(access.workspaceId,'depots',input.depotId);
  const depotRow=await warehouseAdminTransaction(authToken,[depotPath],rows=>({
    result:rows.get(depotPath),writes:[],
  }));
  if(!depotRow)return fail('WAREHOUSE_SHELF_DEPOT_NOT_FOUND',404);
  const depotCheck=validateWarehouseDepot(
    warehouseCanonicalDepotReadInput(input.depotId,depotRow.data),{
      expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
    });
  if(!depotCheck.ok||depotCheck.data.status!=='active'||depotCheck.data.code!=='DEP-001')
    return fail('WAREHOUSE_SHELF_DEPOT_INVALID',409);
  const rows=await warehouseAdminListByField(authToken,access.workspaceId,
    'locations','depotId',input.depotId,500);
  if(rows.length>=500)return fail('WAREHOUSE_SHELF_CATALOG_LIMIT',409);
  const locations=rows.map(row=>parsedLocation(access,row));
  const parents=new Map(locations.filter(loc=>loc.kind==='LOCAL'&&loc.status==='active')
    .map(loc=>[loc.id,loc]));
  const candidates:Candidate[]=locations.flatMap(loc=>{
    if(loc.kind!=='SUBPOSITION'||loc.status!=='active'||!loc.parentLocationId)return [];
    const parent=parents.get(loc.parentLocationId);
    const newCode=parent?warehouseShelfCanonicalCode(parent.code,loc.code):null;
    return parent&&newCode?[{id:loc.id,location:loc,parent,newCode}]:[];
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if(candidates.length>120)return fail('WAREHOUSE_SHELF_TOO_MANY',409);
  const proposed=new Set<string>();
  let conflicts=0;
  for(const c of candidates){
    const key=c.parent.id+':'+c.newCode;
    if(proposed.has(key)||locations.some(loc=>loc.id!==c.id
      && loc.kind==='SUBPOSITION'&&loc.parentLocationId===c.parent.id
      && loc.code===c.newCode))conflicts++;
    proposed.add(key);
  }
  const planHash=hash(input.depotId+'|'+candidates.map(c=>c.id+':'+c.location.code+':'+c.newCode).join('|'));
  if(input.mode==='PREVIEW')return {
    mode:'PREVIEW' as const,depotId:input.depotId,depotCode:depotCheck.data.code,
    candidateCount:candidates.length,parentCount:new Set(candidates.map(c=>c.parent.id)).size,
    conflicts,planHash,sample:candidates.slice(0,5).map(c=>({
      parent:c.parent.code,before:c.location.code,after:c.newCode,
    })),
  };
  if(input.confirmDepotCode!==depotCheck.data.code||input.planHash!==planHash
    ||!candidates.length||conflicts)return fail('WAREHOUSE_SHELF_CONFIRMATION_REQUIRED',409);
  const auditId='mig_'+hash(input.depotId+':'+planHash).slice(0,32);
  const auditPath=path(access.workspaceId,'structureMigrations',auditId);
  const readPaths=new Set<string>([depotPath,auditPath]);
  for(const c of candidates){
    readPaths.add(path(access.workspaceId,'locations',c.id));
    readPaths.add(path(access.workspaceId,'locations',c.parent.id));
    readPaths.add(path(access.workspaceId,'structureCodeClaims',
      claimId('SUBPOSITION',input.depotId,c.parent.id,c.location.code)));
    readPaths.add(path(access.workspaceId,'structureCodeClaims',
      claimId('SUBPOSITION',input.depotId,c.parent.id,c.newCode)));
  }
  if(readPaths.size>512)return fail('WAREHOUSE_SHELF_READSET_LIMIT',409);
  return warehouseAdminTransaction(authToken,[...readPaths],read=>{
    if(read.get(auditPath))return fail('WAREHOUSE_SHELF_ALREADY_MIGRATED');
    const currentDepot=read.get(depotPath);
    if(!currentDepot||currentDepot.data.code!=='DEP-001'||currentDepot.data.status!=='active')
      return fail('WAREHOUSE_SHELF_DEPOT_CHANGED');
    const writes:WarehouseAdminTransactionWrite[]=[];
    const backup:Array<{id:string;oldCode:string;newCode:string;oldName:string;newName:string}>=[];
    const now=new Date();
    for(const c of candidates){
      const locPath=path(access.workspaceId,'locations',c.id);
      const locRow=read.get(locPath);
      const parentRow=read.get(path(access.workspaceId,'locations',c.parent.id));
      if(!locRow||!parentRow)return fail('WAREHOUSE_SHELF_CONCURRENT_CHANGE');
      const loc=parsedLocation(access,locRow);
      const parent=parsedLocation(access,parentRow);
      if(loc.code!==c.location.code||loc.parentLocationId!==c.parent.id
        ||loc.status!=='active'||loc.kind!=='SUBPOSITION'
        ||parent.status!=='active'||parent.code!==c.parent.code
        ||parent.kind!=='LOCAL')return fail('WAREHOUSE_SHELF_CONCURRENT_CHANGE');
      const oldClaimPath=path(access.workspaceId,'structureCodeClaims',
        claimId('SUBPOSITION',input.depotId,c.parent.id,loc.code));
      const newClaimPath=path(access.workspaceId,'structureCodeClaims',
        claimId('SUBPOSITION',input.depotId,c.parent.id,c.newCode));
      const oldClaim=read.get(oldClaimPath);
      const newClaim=read.get(newClaimPath);
      if((oldClaim&&oldClaim.data.entityId!==c.id)
        ||(newClaim&&newClaim.data.entityId!==c.id))
        return fail('WAREHOUSE_SHELF_CLAIM_CONFLICT');
      const newName=/^Subposi[cç][aã]o\s+\d+$/i.test(loc.name)
        ?'Prateleira '+c.newCode.slice(-2):loc.name;
      const updated=validateWarehouseLocation({...loc,code:c.newCode,name:newName,
        updatedBy:access.uid},{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
      if(!updated.ok)return fail('WAREHOUSE_SHELF_TARGET_INVALID');
      writes.push({path:locPath,data:{...locRow.data,...updated.data,updatedAt:now}});
      writes.push({path:newClaimPath,data:{
        workspaceId:access.workspaceId,ug:access.ug,
        entityId:c.id,entityKind:'SUBPOSITION',depotId:input.depotId,
        parentLocationId:c.parent.id,code:c.newCode,
        createdAt:newClaim?.data.createdAt??now,
      }});
      if(oldClaim)writes.push({path:oldClaimPath,delete:true});
      backup.push({id:c.id,oldCode:loc.code,newCode:c.newCode,
        oldName:loc.name,newName});
    }
    writes.push({path:auditPath,data:{
      workspaceId:access.workspaceId,ug:access.ug,depotId:input.depotId,
      planHash,actor:access.uid,createdAt:now,records:backup,
    }});
    return {result:{mode:'APPLY' as const,updated:candidates.length,
      auditId,depotId:input.depotId},writes};
  });
}
