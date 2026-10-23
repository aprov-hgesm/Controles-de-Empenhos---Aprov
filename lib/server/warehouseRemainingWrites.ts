import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction, warehouseAdminListCollection, WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  createWarehouseBarcodeId, normalizeWarehouseBarcode, isValidWarehouseBarcodeId,
  WAREHOUSE_BARCODE_SCHEMA_VERSION, warehousePresentationFactor,
  barcodeAssociationMatchesMaterial, validateWarehouseBarcodeAssociation,
  type WarehouseBarcodeAssociation,
} from '../warehouse/barcode';
import { isWarehouseLocationBarcode } from '../warehouse/locationBarcode';
import {
  normalizeWarehouseMaterialUnit, validateWarehouseMaterial,
  type WarehouseMaterial,
} from '../warehouse/material';
import type { SaveWarehouseBarcodeAssociationInput } from '../warehouse/barcodeRepository';
import {
  createWarehouseDepotLayoutId, validateWarehouseDepotLayout,
  type WarehouseDepotLayout, type WarehouseDepotLayoutObject,
} from '../warehouse/layout';
import type { SaveWarehouseDepotLayoutVersionInput } from '../warehouse/layoutRepository';
import { warehouseFindOverlappingLocals } from '../warehouse/layoutCollision';
import { validateWarehouseDepot, validateWarehouseLocation } from '../warehouse/location';
import {
  warehouseCanonicalMaterialReadInput, warehouseCanonicalBarcodeReadInput,
  warehouseCanonicalDepotReadInput, warehouseCanonicalLocationReadInput,
} from '../warehouse/readCompatibility';
import {
  createWarehouseItemIntakeId, WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION,
} from '../warehouse/intake';
import {
  WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION, calculateWarehouseItemIntakePendingQuantity,
  deriveWarehouseItemIntakeStatus, validateWarehouseItemIntakeState,
  type WarehouseItemIntakeState,
} from '../warehouse/intakeState';
import type { SaveWarehouseItemIntakeStateInput } from '../warehouse/intakeStateRepository';

const fail = (code:string,status=409):never => { throw new WarehouseStoreError(code,status); };
const path=(ws:string,domain:string,id:string)=>'warehouse/'+ws+'/'+domain+'/'+id;
const stamp=()=>new Date();
function token() {
  return process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?Promise.resolve('emulator'):getGoogleAccessToken();
}
function object(raw:unknown):Record<string,unknown> {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) return fail('WAREHOUSE_COMMAND_INVALID',400);
  return raw as Record<string,unknown>;
}
function material(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument):WarehouseMaterial {
  const id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseMaterial(warehouseCanonicalMaterialReadInput(id,row.data),{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!r.ok)return fail('WAREHOUSE_MATERIAL_CORRUPT');
  return r.data;
}
function barcode(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument):WarehouseBarcodeAssociation {
  const id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseBarcodeAssociation(warehouseCanonicalBarcodeReadInput(id,row.data),{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!r.ok)return fail('WAREHOUSE_BARCODE_CORRUPT');
  return r.data;
}
function activeMaterial(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument|null) {
  if(!row)return fail('WAREHOUSE_MATERIAL_NOT_FOUND',404);
  const m=material(access,row);
  if(m.status!=='active')return fail('WAREHOUSE_MATERIAL_INACTIVE');
  return m;
}
function sameAssociation(a:WarehouseBarcodeAssociation,materialId:string,bar:string,unit:unknown,factor:number) {
  return a.materialId===materialId && a.barcode===bar && a.factorToBaseUnit===factor
    &&JSON.stringify(a.presentation)===JSON.stringify(unit);
}
export function warehouseBarcodeServer(
  access:VerifiedWarehouseRequest, action:'SAVE'|'REPLACE', raw:unknown
):Promise<WarehouseBarcodeAssociation>;
export function warehouseBarcodeServer(
  access:VerifiedWarehouseRequest, action:'STATUS', raw:unknown
):Promise<{ok:true}>;
export async function warehouseBarcodeServer(
  access:VerifiedWarehouseRequest, action:'SAVE'|'STATUS'|'REPLACE', raw:unknown
):Promise<WarehouseBarcodeAssociation|{ok:true}> {
  const data=object(raw);
  const authToken=await token(),now=stamp(),ws=access.workspaceId;
  if(action==='STATUS') {
    const {barcodeId,status}=data;
    if(typeof barcodeId!=='string'||!isValidWarehouseBarcodeId(barcodeId)
      ||(status!=='active'&&status!=='inactive'))return fail('WAREHOUSE_BARCODE_INPUT_INVALID',400);
    const p=path(ws,'barcodes',barcodeId);
    return warehouseAdminTransaction(authToken,[p],rows=>{
      const row=rows.get(p);if(!row)return fail('WAREHOUSE_BARCODE_NOT_FOUND',404);
      const existing=barcode(access,row);
      if(existing.status===status)return {result:{ok:true as const},writes:[]};
      return {result:{ok:true as const},writes:[{path:p,data:{
        ...row.data,status,updatedBy:access.uid,updatedAt:now,
      }}]};
    });
  }
  if(action==='SAVE') {
    if(typeof data.barcode!=='string'||typeof data.materialId!=='string') {
      return fail('WAREHOUSE_BARCODE_INPUT_INVALID',400);
    }
    const normalized=normalizeWarehouseBarcode(data.barcode);
    const presentation=normalizeWarehouseMaterialUnit(data.presentation as SaveWarehouseBarcodeAssociationInput['presentation']);
    if(!normalized||isWarehouseLocationBarcode(normalized)||!presentation) {
      return fail('WAREHOUSE_BARCODE_INPUT_INVALID',400);
    }
    const id=await createWarehouseBarcodeId(ws,normalized);
    const p=path(ws,'barcodes',id),mp=path(ws,'materials',data.materialId);
    return warehouseAdminTransaction(authToken,[p,mp],rows=>{
      const mat=activeMaterial(access,rows.get(mp)||null);
      const factor=warehousePresentationFactor(mat,presentation);
      if(factor===null)return fail('WAREHOUSE_BARCODE_PRESENTATION_NOT_CONFIGURED');
      const previous=rows.get(p);
      if(previous) {
        const old=barcode(access,previous);
        if(!sameAssociation(old,mat.id,normalized,presentation,factor))return fail('WAREHOUSE_BARCODE_ALREADY_LINKED');
        if(!barcodeAssociationMatchesMaterial(old,mat))return fail('WAREHOUSE_BARCODE_MATERIAL_CONVERSION_MISMATCH');
        if(old.status==='active')return {result:old,writes:[]};
        return {result:{...old,status:'active' as const,updatedBy:access.uid},writes:[
          {path:p,data:{...previous.data,status:'active',updatedBy:access.uid,updatedAt:now}},
        ]};
      }
      const r=validateWarehouseBarcodeAssociation({
        schemaVersion:WAREHOUSE_BARCODE_SCHEMA_VERSION,id,workspaceId:ws,ug:access.ug,
        materialId:mat.id,barcode:normalized,presentation,factorToBaseUnit:factor,
        status:'active',createdBy:access.uid,updatedBy:access.uid,
      },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:mat.id});
      if(!r.ok)return fail('WAREHOUSE_BARCODE_INVALID',400);
      return {result:r.data,writes:[{path:p,data:{...r.data,createdAt:now,updatedAt:now}}]};
    });
  }
  if(typeof data.barcodeId!=='string'||!isValidWarehouseBarcodeId(data.barcodeId)
    ||typeof data.nextBarcodeInput!=='string')return fail('WAREHOUSE_BARCODE_INPUT_INVALID',400);
  const next=normalizeWarehouseBarcode(data.nextBarcodeInput);
  if(!next||isWarehouseLocationBarcode(next))return fail('WAREHOUSE_BARCODE_INPUT_INVALID',400);
  const original=path(ws,'barcodes',data.barcodeId);
  const nextId=await createWarehouseBarcodeId(ws,next);
  // A identidade material pode ter mudado entre as leituras; verificar de novo no commit.
  const prior=await warehouseAdminTransaction(authToken,[original],rows=>({
    result:rows.get(original),writes:[],
  }));
  if(!prior)return fail('WAREHOUSE_BARCODE_NOT_FOUND',404);
  const old=barcode(access,prior);
  const matPath=path(ws,'materials',old.materialId),dest=path(ws,'barcodes',nextId);
  if(original===dest)return old;
  return warehouseAdminTransaction(authToken,[original,matPath,dest],rows=>{
    const present=rows.get(original);
    if(!present)return fail('WAREHOUSE_BARCODE_NOT_FOUND',404);
    const current=barcode(access,present);
    if(current.status!=='active')return fail('WAREHOUSE_BARCODE_INACTIVE');
    if(current.materialId!==old.materialId)return fail('WAREHOUSE_BARCODE_CONCURRENT_CHANGE');
    const mat=activeMaterial(access,rows.get(matPath)||null);
    if(!barcodeAssociationMatchesMaterial(current,mat))return fail('WAREHOUSE_BARCODE_MATERIAL_CONVERSION_MISMATCH');
    const exists=rows.get(dest);
    let associated:WarehouseBarcodeAssociation;
    const writes:Array<{path:string;data:Record<string,unknown>}>=[];
    if(exists){
      associated=barcode(access,exists);
      if(!sameAssociation(associated,current.materialId,next,current.presentation,current.factorToBaseUnit)){
        return fail('WAREHOUSE_BARCODE_ALREADY_LINKED');
      }
      if(associated.status!=='active'){
        associated={...associated,status:'active',updatedBy:access.uid};
        writes.push({path:dest,data:{...exists.data,status:'active',updatedAt:now,updatedBy:access.uid}});
      }
    }else{
      const r=validateWarehouseBarcodeAssociation({
        ...current,id:nextId,barcode:next,status:'active',
        createdBy:access.uid,updatedBy:access.uid,
      },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:current.materialId});
      if(!r.ok)return fail('WAREHOUSE_BARCODE_INVALID',400);
      associated=r.data;
      writes.push({path:dest,data:{...r.data,createdAt:now,updatedAt:now}});
    }
    writes.push({path:original,data:{...present.data,status:'inactive',updatedAt:now,updatedBy:access.uid}});
    return {result:associated,writes};
  });
}
function parsedLayout(access:VerifiedWarehouseRequest,row:WarehouseAdminDocument):WarehouseDepotLayout {
  const d=row.data,id=row.path.split('/').at(-1)||'';
  const r=validateWarehouseDepotLayout({
    schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,
    name:d.name,depotId:d.depotId??null,logicalWidth:d.logicalWidth,
    logicalHeight:d.logicalHeight,objects:d.objects,version:d.version,status:d.status,
    previousVersionId:d.previousVersionId??null,createdBy:d.createdBy,updatedBy:d.updatedBy,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
  if(!r.ok)return fail('WAREHOUSE_LAYOUT_CORRUPT');
  return r.data;
}
export async function warehouseLayoutSaveServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<WarehouseDepotLayout> {
  const data=object(raw) as unknown as SaveWarehouseDepotLayoutVersionInput;
  if(typeof data.name!=='string'||!Array.isArray(data.objects) ||data.objects.length>250
    ||(data.depotId!==null&&typeof data.depotId!=='string')){
    return fail('WAREHOUSE_LAYOUT_INVALID',400);
  }
  const ids=Array.from(new Set(data.objects
    .map((item:WarehouseDepotLayoutObject)=>item.warehouseLocationId)
    .filter((x):x is string=>typeof x==='string'&&!!x)));
  if(ids.length!==data.objects.filter((item)=>!!item.warehouseLocationId).length) {
    return fail('WAREHOUSE_LAYOUT_DUPLICATE_LOCATION',400);
  }
  const tokenValue=await token(),ws=access.workspaceId;
  const all=await warehouseAdminListCollection(tokenValue,ws,'layouts',500);
  const active=all.map(x=>({row:x,layout:parsedLayout(access,x)}))
    .filter(x=>x.layout.status==='active'&&x.layout.depotId===data.depotId);
  if(active.length>1)return fail('WAREHOUSE_LAYOUT_MULTIPLE_ACTIVE');
  const current=active[0]??null;
  if(data.baseLayoutId!==undefined&&data.baseLayoutId!==null
    &&data.baseLayoutId!==current?.layout.id)return fail('WAREHOUSE_LAYOUT_BASE_NOT_ACTIVE');
  if(data.expectedVersion!==undefined&&data.expectedVersion!==null
    &&data.expectedVersion!==current?.layout.version)return fail('WAREHOUSE_LAYOUT_VERSION_CONFLICT');
  const id=createWarehouseDepotLayoutId(),version=(current?.layout.version??0)+1;
  const r=validateWarehouseDepotLayout({
    schemaVersion:'warehouse_depot_layout_v1',id,workspaceId:ws,ug:access.ug,
    name:data.name,depotId:data.depotId,logicalWidth:data.logicalWidth,
    logicalHeight:data.logicalHeight,objects:data.objects,version,
    status:'active',previousVersionId:current?.layout.id??null,
    createdBy:access.uid,updatedBy:access.uid,
  },{expectedWorkspaceId:ws,expectedUg:access.ug});
  if(!r.ok)return fail('WAREHOUSE_LAYOUT_INVALID',400);
  // O endpoint legado nao pode contornar a mesma protecao da Central 2D.
  if(warehouseFindOverlappingLocals(r.data.objects).length)
    return fail('WAREHOUSE_LAYOUT_LOCATION_OVERLAP',409);
  const nextPath=path(ws,'layouts',id);
  const oldPath=current?.row.path;
  const depotPath=data.depotId?path(ws,'depots',data.depotId):null;
  const locPaths=ids.map(x=>path(ws,'locations',x));
  const reads=[nextPath,...(oldPath?[oldPath]:[]),...(depotPath?[depotPath]:[]),...locPaths];
  const now=stamp();
  return warehouseAdminTransaction(tokenValue,reads,rows=>{
    if(rows.get(nextPath))return fail('WAREHOUSE_LAYOUT_ID_CONFLICT');
    if(oldPath){
      const row=rows.get(oldPath);if(!row)return fail('WAREHOUSE_LAYOUT_BASE_NOT_FOUND');
      const fresh=parsedLayout(access,row);
      if(fresh.status!=='active'||fresh.version!==current?.layout.version)return fail('WAREHOUSE_LAYOUT_VERSION_CONFLICT');
    }
    if(depotPath){
      const row=rows.get(depotPath);
      if(!row)return fail('WAREHOUSE_LAYOUT_DEPOT_INVALID');
      const depot=validateWarehouseDepot(warehouseCanonicalDepotReadInput(data.depotId!,row.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug,
      });
      if(!depot.ok||depot.data.status!=='active')return fail('WAREHOUSE_LAYOUT_DEPOT_INVALID');
    }
    for(const p of locPaths){
      const row=rows.get(p);if(!row)return fail('WAREHOUSE_LAYOUT_LOCATION_INVALID');
      const loc=validateWarehouseLocation(warehouseCanonicalLocationReadInput(p.split('/').at(-1)!,row.data),{
        expectedWorkspaceId:ws,expectedUg:access.ug,
      });
      if(!loc.ok||loc.data.status!=='active'||(data.depotId&&loc.data.depotId!==data.depotId)){
        return fail('WAREHOUSE_LAYOUT_LOCATION_INVALID');
      }
    }
    const writes=[{path:nextPath,data:{...r.data,createdAt:now,updatedAt:now} as Record<string,unknown>}];
    if(oldPath){
      const row=rows.get(oldPath)!;
      writes.push({path:oldPath,data:{...row.data,status:'archived',updatedAt:now,updatedBy:access.uid}});
    }
    return {result:r.data,writes};
  });
}
export async function warehouseIntakeStateServer(
  access:VerifiedWarehouseRequest,raw:unknown
):Promise<WarehouseItemIntakeState> {
  const data=object(raw);
  for(const k of ['invoiceRecordKey','invoiceId','empenhoId','itemId','description','unitLabel','supplier']){
    if(typeof data[k]!=='string')return fail('WAREHOUSE_ITEM_INTAKE_INVALID_INPUT',400);
  }
  const input=data as unknown as SaveWarehouseItemIntakeStateInput;
  const id=await createWarehouseItemIntakeId(access.workspaceId,input.invoiceRecordKey,input.itemId);
  const p=path(access.workspaceId,'intakes',id),now=new Date().toISOString();
  const initial:WarehouseItemIntakeState={
    schemaVersion:WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,id,
    workspaceId:access.workspaceId,ug:access.ug,
    invoiceRecordKey:input.invoiceRecordKey.trim(),invoiceId:input.invoiceId.trim(),
    empenhoId:input.empenhoId.trim(),itemId:input.itemId.trim(),
    materialId:input.materialId?.trim().toLowerCase()||null,
    description:input.description.trim(),unitLabel:input.unitLabel.trim(),
    supplier:input.supplier.trim(),receivedQuantity:input.receivedQuantity,
    allocatedQuantity:input.allocatedQuantity,
    immediateConsumptionQuantity:input.immediateConsumptionQuantity,
    pendingQuantity:calculateWarehouseItemIntakePendingQuantity(
      input.receivedQuantity,input.allocatedQuantity,input.immediateConsumptionQuantity),
    status:deriveWarehouseItemIntakeStatus(
      input.receivedQuantity,input.allocatedQuantity,input.immediateConsumptionQuantity),
    createdAt:now,updatedAt:now,createdBy:access.uid,updatedBy:access.uid,
  };
  const checked=validateWarehouseItemIntakeState(initial,{
    expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
  });
  if(!checked.ok)return fail('WAREHOUSE_ITEM_INTAKE_INVALID',400);
  const authToken=await token();
  return warehouseAdminTransaction(authToken,[p],rows=>{
    const row=rows.get(p);
    if(!row)return {result:checked.data,writes:[{path:p,data:{...checked.data,createdAt:stamp(),updatedAt:stamp()}}]};
    if(row.data.schemaVersion===WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION){
      return fail('WAREHOUSE_ITEM_INTAKE_LEGACY_COMPLETED');
    }
    if(row.data.schemaVersion!==WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION){
      return fail('WAREHOUSE_ITEM_INTAKE_UNKNOWN_SCHEMA');
    }
    const parsed=validateWarehouseItemIntakeState({
      ...row.data,id,createdAt:typeof row.data.createdAt==='string'?row.data.createdAt:now,
      updatedAt:typeof row.data.updatedAt==='string'?row.data.updatedAt:now,
    },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug});
    if(!parsed.ok)return fail('WAREHOUSE_ITEM_INTAKE_STORED_INVALID');
    const old=parsed.data,candidate=checked.data;
    if(old.invoiceRecordKey!==candidate.invoiceRecordKey||old.invoiceId!==candidate.invoiceId
      ||old.empenhoId!==candidate.empenhoId||old.itemId!==candidate.itemId
      ||Math.abs(old.receivedQuantity-candidate.receivedQuantity)>0.000001){
      return fail('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED');
    }
    if(candidate.allocatedQuantity+0.000001<old.allocatedQuantity
      ||candidate.immediateConsumptionQuantity+0.000001<old.immediateConsumptionQuantity){
      return fail('WAREHOUSE_ITEM_INTAKE_PROGRESS_CANNOT_DECREASE');
    }
    if(old.materialId&&candidate.materialId&&old.materialId!==candidate.materialId){
      return fail('WAREHOUSE_ITEM_INTAKE_MATERIAL_CONFLICT');
    }
    const next:WarehouseItemIntakeState={
      ...old,materialId:old.materialId||candidate.materialId,
      allocatedQuantity:candidate.allocatedQuantity,
      immediateConsumptionQuantity:candidate.immediateConsumptionQuantity,
      pendingQuantity:calculateWarehouseItemIntakePendingQuantity(
        old.receivedQuantity,candidate.allocatedQuantity,candidate.immediateConsumptionQuantity),
      status:deriveWarehouseItemIntakeStatus(
        old.receivedQuantity,candidate.allocatedQuantity,candidate.immediateConsumptionQuantity),
      updatedAt:now,updatedBy:access.uid,
    };
    const valid=validateWarehouseItemIntakeState(next,{
      expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
    });
    if(!valid.ok)return fail('WAREHOUSE_ITEM_INTAKE_INVALID',400);
    const unchanged=next.allocatedQuantity===old.allocatedQuantity
      &&next.immediateConsumptionQuantity===old.immediateConsumptionQuantity
      &&next.materialId===old.materialId;
    return {result:unchanged?old:valid.data,writes:unchanged?[]:[{path:p,data:{
      ...row.data,materialId:valid.data.materialId,allocatedQuantity:valid.data.allocatedQuantity,
      immediateConsumptionQuantity:valid.data.immediateConsumptionQuantity,
      pendingQuantity:valid.data.pendingQuantity,status:valid.data.status,
      updatedBy:access.uid,updatedAt:stamp(),
    }}]};
  });
}
