import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction,warehouseAdminListCollection,warehouseAdminListByField,WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import { validateWarehouseMaterial } from '../warehouse/material';
import {
  createWarehouseMovementId,validateWarehouseMovement,validateWarehouseBalance,
  warehouseMovementMatchesReplay,applyWarehouseMovementToBalance,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,type WarehouseBalance,
  type WarehouseMovement,
} from '../warehouse/movement';
import {
  createWarehouseLocationBalanceId,validateWarehouseLocationBalance,
  applyWarehouseLocationDelta,validateWarehouseDepot,validateWarehouseLocation,
  type WarehouseStockPosition,
} from '../warehouse/location';
import { validateWarehouseLot } from '../warehouse/lot';
import { validateWarehouseDepotLayout } from '../warehouse/layout';
import {
  warehouseCanonicalMaterialReadInput,warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput,warehouseCanonicalDepotReadInput,
  warehouseCanonicalLocationReadInput,
} from '../warehouse/readCompatibility';
import type { ApplyWarehouseMovementInput,ApplyWarehouseMovementResult } from '../warehouse/ledgerRepository';

const fail=(s:string,code=409):never=>{throw new WarehouseStoreError(s,code)};
const path=(ws:string,domain:string,id:string)=>'warehouse/'+ws+'/'+domain+'/'+id;
const token=()=>process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
  ?Promise.resolve('emulator'):getGoogleAccessToken();
const obj=(v:unknown):Record<string,unknown>=>{
  if(!v||typeof v!=='object'||Array.isArray(v))return fail('WAREHOUSE_COMMAND_INVALID',400);
  return v as Record<string,unknown>;
};
function movement(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument):WarehouseMovement {
  const d=row.data;
  const r=validateWarehouseMovement({
    schemaVersion:d.schemaVersion,id:row.path.split('/').at(-1),workspaceId:d.workspaceId,
    ug:d.ug,materialId:d.materialId,type:d.type,quantityDelta:d.quantityDelta,
    idempotencyKeyHash:d.idempotencyKeyHash,reversesMovementId:d.reversesMovementId??null,
    note:d.note??null,source:d.source??null,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
  if(!r.ok)return fail('WAREHOUSE_MOVEMENT_INVALID');
  return r.data;
}
function balance(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument,materialId:string){
  const d=row.data;
  const r=validateWarehouseBalance({
    schemaVersion:d.schemaVersion,workspaceId:d.workspaceId,ug:d.ug,
    materialId:d.materialId,quantity:d.quantity,revision:d.revision,lastMovementId:d.lastMovementId,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,expectedMaterialId:materialId});
  if(!r.ok)return fail('WAREHOUSE_BALANCE_INVALID');
  return r.data;
}
export async function warehouseLedgerMovementServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<ApplyWarehouseMovementResult>{
  const v=obj(raw);
  if(typeof v.materialId!=='string'||!/^mat_[a-f0-9]{32}$/.test(v.materialId)
    ||typeof v.idempotencyKey!=='string'||v.idempotencyKey.length>240) {
    return fail('WAREHOUSE_LEDGER_INVALID_INPUT',400);
  }
  // Interno exclusivamente para Marco Zero SISCOFIS. A API pública rejeita.
  // Os valores externos são validados por regex constante, sem interpolação.
  const allowedKey=/^siscofis:marco-zero:[a-f0-9]{64}:mat_[a-f0-9]{32}$/.test(v.idempotencyKey)
    &&v.idempotencyKey.endsWith(':'+v.materialId);
  if(v.type!=='INITIAL_BALANCE'
    ||v.source!==null
    ||(v.reversesMovementId!==undefined&&v.reversesMovementId!==null)
    ||typeof v.quantityDelta!=='number'||v.quantityDelta<=0
    ||!allowedKey) {
    return fail('WAREHOUSE_SISCOFIS_LEDGER_ONLY',403);
  }
  const input=v as unknown as ApplyWarehouseMovementInput;
  const ws=access.workspaceId,id=await createWarehouseMovementId(ws,input.idempotencyKey);
  const unassigned:WarehouseStockPosition={kind:'UNASSIGNED'};
  const locId=await createWarehouseLocationBalanceId(ws,input.materialId,unassigned);
  const paths={
    material:path(ws,'materials',input.materialId),movement:path(ws,'movements',id),
    balance:path(ws,'balances',input.materialId),location:path(ws,'locationBalances',locId),
    ...(input.reversesMovementId?{reversal:path(ws,'movements',input.reversesMovementId)}:{}),
  };
  const authToken=await token();
  return warehouseAdminTransaction<ApplyWarehouseMovementResult>(
    authToken,Object.values(paths),rows=>{
      const matRow=rows.get(paths.material);if(!matRow)return fail('WAREHOUSE_MATERIAL_NOT_FOUND',404);
      const mat=validateWarehouseMaterial(warehouseCanonicalMaterialReadInput(input.materialId,matRow.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug,
      });
      if(!mat.ok)return fail('WAREHOUSE_MATERIAL_INVALID');
      const check=validateWarehouseMovement({
        schemaVersion:WAREHOUSE_MOVEMENT_SCHEMA_VERSION,id,workspaceId:ws,
        ug:access.ug,materialId:input.materialId,type:input.type,
        quantityDelta:input.quantityDelta,idempotencyKeyHash:id.slice(4),
        reversesMovementId:input.reversesMovementId??null,note:input.note??null,
        source:input.source??null,
      },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:input.materialId});
      if(!check.ok)return fail('WAREHOUSE_MOVEMENT_INVALID',400);
      const candidate=check.data;
      const balRow=rows.get(paths.balance);
      const oldBalance=balRow?balance(access,balRow,input.materialId):null;
      const oldMovement=rows.get(paths.movement);
      if(oldMovement){
        const replay=movement(access,oldMovement);
        if(!warehouseMovementMatchesReplay(replay,candidate))return fail('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        if(!oldBalance)return fail('WAREHOUSE_LEDGER_BALANCE_INCONSISTENT');
        return {result:{applied:false,movement:replay,balance:oldBalance},writes:[]};
      }
      if(mat.data.status!=='active')return fail('WAREHOUSE_MATERIAL_INACTIVE');
      if(candidate.type==='REVERSAL'){
        const reversed=paths.reversal?rows.get(paths.reversal):null;
        if(!reversed)return fail('WAREHOUSE_REVERSAL_TARGET_NOT_FOUND',404);
        const prior=movement(access,reversed);
        if(prior.materialId!==candidate.materialId
          ||candidate.quantityDelta!==-prior.quantityDelta){
          return fail('WAREHOUSE_INVALID_REVERSAL');
        }
      }
      if(candidate.type==='OUTBOUND'&&(!oldBalance||oldBalance.quantity+candidate.quantityDelta< -0.000001)){
        return fail('WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK');
      }
      const nextBalance=applyWarehouseMovementToBalance(candidate,oldBalance);
      const locRow=rows.get(paths.location);
      const oldLocation=locRow?validateWarehouseLocationBalance(
        warehouseCanonicalLocationBalanceReadInput(locId,locRow.data),{
          expectedWorkspaceId:ws,
        }):null;
      if(oldLocation&&!oldLocation.ok)return fail('WAREHOUSE_LOCATION_BALANCE_INVALID');
      if(oldLocation?.ok&&oldLocation.data.ug!==access.ug)return fail('WAREHOUSE_LOCATION_SCOPE_MISMATCH',403);
      const nextLocation=applyWarehouseLocationDelta(oldLocation?.ok?oldLocation.data:null,{
        id:locId,workspaceId:ws,ug:access.ug,materialId:input.materialId,
        position:unassigned,quantityDelta:candidate.quantityDelta,movementId:id,
        initialQuantity:oldLocation?.ok?0:(oldBalance?.quantity||0),
      });
      if(nextBalance.quantity<0||nextLocation.quantity<0)return fail('WAREHOUSE_NEGATIVE_STOCK');
      const now=new Date();
      return {result:{applied:true,movement:candidate,balance:nextBalance},writes:[
        {path:paths.movement,data:{...candidate,createdAt:now}},
        {path:paths.balance,data:{...nextBalance,updatedAt:now}},
        {path:paths.location,data:{...nextLocation,updatedAt:now}},
      ]};
    }
  );
}
function sameScope(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument,kind:string) {
  if(row.data.workspaceId!==access.workspaceId||row.data.ug!==access.ug)return fail('WAREHOUSE_ARCHIVE_SCOPE_MISMATCH',403);
  if(kind==='location'){
    const id=row.path.split('/').at(-1)||'';
    const r=validateWarehouseLocation(warehouseCanonicalLocationReadInput(id,row.data),{
      expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
    });
    if(!r.ok)return fail('WAREHOUSE_ARCHIVE_LOCATION_INVALID');
    return r.data;
  }
  const id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseDepot(warehouseCanonicalDepotReadInput(id,row.data),{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!r.ok)return fail('WAREHOUSE_ARCHIVE_DEPOT_INVALID');
  return r.data;
}
/**
 * Diagnóstico operacional READ-ONLY do bloqueio de exclusão de depósito.
 * Não infere estoque a partir do croqui nem autoriza ignorar saldos legados.
 * O mesmo workspace/UG do usuário já foi verificado na API de operações.
 */
export interface WarehouseDepotArchiveDiagnostic {
  depotId:string;
  positiveBalanceCount:number;
  activeLotCount:number;
  blockers:Array<{
    kind:'BALANCE'|'LOT';
    recordId:string;
    materialId:string;
    quantity:number;
    location:string;
    positionStatus:'ACTIVE'|'INACTIVE'|'MISSING';
  }>;
  truncated:boolean;
}
export async function diagnoseWarehouseDepotArchiveServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<WarehouseDepotArchiveDiagnostic> {
  const input=obj(raw);
  const depotId=input.depotId;
  if(typeof depotId!=='string'||!/^dep_[a-f0-9]{32}$/.test(depotId))
    return fail('WAREHOUSE_ARCHIVE_INVALID_TARGET',400);
  const ws=access.workspaceId,authToken=await token();
  const depotPath=path(ws,'depots',depotId);
  const [locations,balances,lots]=await Promise.all([
    warehouseAdminListCollection(authToken,ws,'locations',500),
    warehouseAdminListCollection(authToken,ws,'locationBalances',500),
    warehouseAdminListCollection(authToken,ws,'lots',500),
  ]);
  // A consulta incompleta jamais pode produzir um falso diagnóstico "vazio".
  if(locations.length===500||balances.length===500||lots.length===500)
    return fail('WAREHOUSE_ARCHIVE_CATALOG_LIMIT');
  await warehouseAdminTransaction(authToken,[depotPath],rows=>{
    const depot=rows.get(depotPath);
    if(!depot)return fail('WAREHOUSE_ARCHIVE_DEPOT_NOT_FOUND',404);
    sameScope(access,depot,'depot');
    return {result:true,writes:[]};
  });
  const byId=new Map(locations.map(row=>[row.path.split('/').at(-1)||'',row]));
  const statusFor=(position:Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>):'ACTIVE'|'INACTIVE'|'MISSING'=> {
    const loc=byId.get(String(position.locationId||''));
    if(!loc||loc.data.kind!=='LOCAL'||loc.data.depotId!==depotId)return 'MISSING';
    if(loc.data.status!=='active')return 'INACTIVE';
    if(position.kind==='SUBPOSITION'){
      const sub=byId.get(String(position.subpositionId||''));
      if(!sub||sub.data.kind!=='SUBPOSITION'||sub.data.depotId!==depotId
        ||sub.data.parentLocationId!==loc.data.id)return 'MISSING';
      if(sub.data.status!=='active')return 'INACTIVE';
    }
    return 'ACTIVE';
  };
  const labelFor=(position:Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>):string=>{
    const loc=byId.get(String(position.locationId||''));
    const sub=position.kind==='SUBPOSITION'?byId.get(String(position.subpositionId||'')):null;
    return [loc?.data.code||String(position.locationId||'LOCAL AUSENTE'),
      ...(position.kind==='SUBPOSITION'?[sub?.data.code||String(position.subpositionId||'SUBPOSIÇÃO AUSENTE')]:[])].join(' / ');
  };
  const affects=(row:WarehouseAdminDocument):boolean=>{
    const p=row.data.position;
    return !!p&&typeof p==='object'&&!Array.isArray(p)
      &&(p as Record<string,unknown>).kind!=='UNASSIGNED'
      &&(p as Record<string,unknown>).depotId===depotId;
  };
  const found:Array<WarehouseDepotArchiveDiagnostic['blockers'][number]>=[];
  let positiveBalanceCount=0,activeLotCount=0;
  for(const row of balances.filter(affects)){
    const id=row.path.split('/').at(-1)||'';
    const validated=validateWarehouseLocationBalance(
      warehouseCanonicalLocationBalanceReadInput(id,row.data),{expectedWorkspaceId:ws});
    if(!validated.ok||validated.data.ug!==access.ug)
      return fail('WAREHOUSE_ARCHIVE_INVALID_BALANCE');
    if(validated.data.quantity<=0)continue;
    positiveBalanceCount++;
    const p=validated.data.position;
    if(p.kind==='UNASSIGNED')continue;
    found.push({kind:'BALANCE',recordId:id,materialId:validated.data.materialId,
      quantity:validated.data.quantity,location:labelFor(p),
      positionStatus:statusFor(p)});
  }
  for(const row of lots.filter(affects)){
    const id=row.path.split('/').at(-1)||'';
    const validated=validateWarehouseLot(warehouseCanonicalLotReadInput(id,row.data),{
      expectedWorkspaceId:ws,expectedUg:access.ug});
    if(!validated.ok)return fail('WAREHOUSE_ARCHIVE_INVALID_LOT');
    if(validated.data.status!=='active'||validated.data.quantity<=0)continue;
    activeLotCount++;
    const p=validated.data.position;
    if(p.kind==='UNASSIGNED')continue;
    found.push({kind:'LOT',recordId:id,materialId:validated.data.materialId,
      quantity:validated.data.quantity,location:labelFor(p),
      positionStatus:statusFor(p)});
  }
  found.sort((a,b)=>(a.positionStatus==='ACTIVE'?1:0)-(b.positionStatus==='ACTIVE'?1:0)
    ||a.location.localeCompare(b.location)||a.materialId.localeCompare(b.materialId));
  return {depotId,positiveBalanceCount,activeLotCount,
    blockers:found.slice(0,30),truncated:found.length>30};
}

export async function warehouseStructureArchiveServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<{ok:true}>{
  const data=obj(raw),isDepot=data.kind==='DEPOT';
  const permanentDelete=isDepot&&data.mode==='DELETE';
  if(data.mode!==undefined&&(!permanentDelete||typeof data.confirmCode!=='string')) {
    return fail('WAREHOUSE_DEPOT_DELETE_INVALID_CONFIRMATION',400);
  }
  if((!isDepot&&data.kind!=='LOCAL'&&data.kind!=='SUBPOSITION')
    ||typeof data.id!=='string'
    ||!(isDepot?/^dep_[a-f0-9]{32}$/.test(data.id)
      :/^(loc_|sub_)[a-f0-9]{32}$/.test(data.id))){
    return fail('WAREHOUSE_ARCHIVE_INVALID_TARGET',400);
  }
  const archiveId=data.id as string;
  const ws=access.workspaceId,authToken=await token();
  const [depots,locations,balances,lots,layouts]=await Promise.all([
    warehouseAdminListCollection(authToken,ws,'depots',500),
    warehouseAdminListCollection(authToken,ws,'locations',500),
    warehouseAdminListCollection(authToken,ws,'locationBalances',500),
    warehouseAdminListCollection(authToken,ws,'lots',500),
    isDepot?warehouseAdminListByField(authToken,ws,'layouts','depotId',archiveId,500)
      :Promise.resolve([]),
  ]);
  // Consultas com limite nao podem liberar exclusao enquanto houver paginas
  // omitidas: saldos/lotes ou layouts ativos poderiam ficar invisiveis.
  if(depots.length===500||locations.length===500||balances.length===500
    ||lots.length===500||layouts.length===500) return fail('WAREHOUSE_ARCHIVE_CATALOG_LIMIT');
  const targetLocation=locations.find(x=>x.path===path(ws,'locations',archiveId));
  if(!isDepot&&(!targetLocation||targetLocation.data.kind!==data.kind)){
    return fail('WAREHOUSE_ARCHIVE_LOCATION_NOT_FOUND',404);
  }
  const depotId=isDepot?data.id:targetLocation!.data.depotId;
  if(typeof depotId!=='string')return fail('WAREHOUSE_ARCHIVE_DEPOT_INVALID');
  const dp=path(ws,'depots',depotId);
  // Tombstone externo ao contrato de domínio: exclusão lógica irreversível,
  // sem remover eventos de estoque, histórico ou índices de auditoria.
  const deletedPath=permanentDelete?path(ws,'depotDeletions',depotId):null;
  if(!depots.some(x=>x.path===dp))return fail('WAREHOUSE_ARCHIVE_DEPOT_NOT_FOUND',404);
  const inDepot=locations.filter(x=>x.data.depotId===depotId);
  const positions=(r:Record<string,unknown>)=>{
    const pos=r.position;
    return pos&&typeof pos==='object'&&!Array.isArray(pos)?pos as Record<string,unknown>:null;
  };
  const affects=(pos:Record<string,unknown>|null):boolean=>{
    if(!pos||pos.kind==='UNASSIGNED'||pos.depotId!==depotId)return false;
    if(isDepot)return true;
    return data.kind==='LOCAL'?pos.locationId===data.id
      :pos.kind==='SUBPOSITION'&&pos.subpositionId===data.id;
  };
  const relevantBalances=balances.filter(x=>affects(positions(x.data)));
  const relevantLots=lots.filter(x=>affects(positions(x.data)));
  const toArchive=inDepot.filter(x=>x.data.status==='active'&&(isDepot
    ||x.data.id===data.id
    ||(data.kind==='LOCAL'&&x.data.kind==='SUBPOSITION'&&x.data.parentLocationId===data.id)));
  const activeLayouts=layouts.filter(x=>x.data.status==='active');
  const reads=[dp,...inDepot.map(x=>x.path),...relevantBalances.map(x=>x.path),
    ...relevantLots.map(x=>x.path),...layouts.map(x=>x.path),
    ...(deletedPath?[deletedPath]:[])];
  if(reads.length>450||toArchive.length+(isDepot?1:0)+activeLayouts.length>430){
    return fail('WAREHOUSE_ARCHIVE_TOO_LARGE');
  }
  return warehouseAdminTransaction(authToken,[...new Set(reads)],rows=>{
    const depot=rows.get(dp);
    if(!depot)return fail('WAREHOUSE_ARCHIVE_DEPOT_NOT_FOUND');
    const checkedDepot=sameScope(access,depot,'depot');
    if(permanentDelete){
      if(checkedDepot.status!=='active')return fail('WAREHOUSE_DEPOT_DELETE_NOT_ACTIVE');
      if(data.confirmCode!==checkedDepot.code)return fail('WAREHOUSE_DEPOT_DELETE_INVALID_CONFIRMATION',400);
      if(deletedPath&&rows.get(deletedPath))return fail('WAREHOUSE_DEPOT_ALREADY_DELETED');
    }
    if(!isDepot){
      const loc=rows.get(path(ws,'locations',archiveId));
      if(!loc||loc.data.status!=='active')return fail('WAREHOUSE_ARCHIVE_LOCATION_NOT_ACTIVE');
      sameScope(access,loc,'location');
    }
    for(const p of relevantBalances.map(x=>x.path)){
      const row=rows.get(p);if(!row)return fail('WAREHOUSE_ARCHIVE_CONCURRENT_CHANGE');
      const id=p.split('/').at(-1)||'';
      const r=validateWarehouseLocationBalance(warehouseCanonicalLocationBalanceReadInput(id,row.data),{
        expectedWorkspaceId:ws,
      });
      if(!r.ok||r.data.ug!==access.ug)return fail('WAREHOUSE_ARCHIVE_INVALID_BALANCE');
      if(r.data.quantity>0&&affects(r.data.position as unknown as Record<string,unknown>)){
        return fail('WAREHOUSE_ARCHIVE_OCCUPIED');
      }
    }
    for(const p of relevantLots.map(x=>x.path)){
      const row=rows.get(p);if(!row)return fail('WAREHOUSE_ARCHIVE_CONCURRENT_CHANGE');
      const id=p.split('/').at(-1)||'';
      const r=validateWarehouseLot(warehouseCanonicalLotReadInput(id,row.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug,
      });
      if(!r.ok)return fail('WAREHOUSE_ARCHIVE_INVALID_LOT');
      if(r.data.status==='active'&&r.data.quantity>0
        &&affects(r.data.position as unknown as Record<string,unknown>)){
        return fail('WAREHOUSE_ARCHIVE_ACTIVE_LOT');
      }
    }
    const now=new Date(),writes:Array<{path:string;data:Record<string,unknown>}>=[];
    for(const p of toArchive.map(x=>x.path)){
      const row=rows.get(p);if(!row)return fail('WAREHOUSE_ARCHIVE_CONCURRENT_CHANGE');
      if(row.data.status==='active'){
        sameScope(access,row,'location');
        writes.push({path:p,data:{...row.data,status:'inactive',updatedBy:access.uid,updatedAt:now}});
      }
    }
    // A inativacao do deposito deve desativar tambem a versao visual ativa
    // na mesma transacao. Nenhum Croqui ativo pode sobreviver ao deposito.
    if(isDepot){
      for(const layoutEntry of activeLayouts){
        const old=rows.get(layoutEntry.path);
        if(!old)return fail('WAREHOUSE_ARCHIVE_LAYOUT_CONCURRENT_CHANGE');
        const id=layoutEntry.path.split('/').at(-1)||'';
        const d=old.data;
        const validated=validateWarehouseDepotLayout({
          schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,
          name:d.name,depotId:d.depotId??null,
          logicalWidth:d.logicalWidth,logicalHeight:d.logicalHeight,
          objects:d.objects,version:d.version,status:d.status,
          previousVersionId:d.previousVersionId??null,
          createdBy:d.createdBy,updatedBy:d.updatedBy,
        },{expectedWorkspaceId:ws,expectedUg:access.ug});
        if(!validated.ok||validated.data.depotId!==depotId||
          validated.data.status!=='active')return fail('WAREHOUSE_ARCHIVE_INVALID_LAYOUT');
        writes.push({path:layoutEntry.path,data:{
          ...old.data,status:'archived',updatedBy:access.uid,updatedAt:now,
        }});
      }
    }
    if(isDepot&&depot.data.status==='active'){
      writes.push({path:dp,data:{...depot.data,status:'inactive',updatedBy:access.uid,updatedAt:now}});
    }
    if(permanentDelete&&deletedPath){
      writes.push({path:deletedPath,data:{
        workspaceId:ws,ug:access.ug,depotId,code:checkedDepot.code,
        name:checkedDepot.name,deletedBy:access.uid,deletedAt:now,
      }});
    }
    return {result:{ok:true as const},writes};
  });
}
