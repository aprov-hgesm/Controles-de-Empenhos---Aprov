import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  warehouseAdminTransaction, warehouseAdminBatchRead, warehouseAdminListByField, WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import {
  applyWarehouseLocationDelta, createWarehouseLocationBalanceId,
  warehouseStockPositionsEqual,
  validateWarehouseLocationBalance, validateWarehouseStockPosition,
  type WarehouseLocationBalance,
} from '../warehouse/location';
import { validateWarehouseLot, warehouseLotExpiryState, type WarehouseLot } from '../warehouse/lot';
import { validateWarehouseMaterial, type WarehouseMaterial } from '../warehouse/material';
import {
  applyWarehouseMovementToBalance, createWarehouseMovementId,
  validateWarehouseBalance, normalizeWarehouseQuantity, validateWarehouseMovement,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  type WarehouseBalance, type WarehouseMovement, type WarehouseExpressOutboundMovementSource,
} from '../warehouse/movement';
import { validateWarehouseBarcodeAssociation, type WarehouseBarcodeAssociation } from '../warehouse/barcode';
import { prepareWarehouseExpressOutbound } from '../warehouse/outbound';
import type { ApplyWarehouseExpressOutboundInput, ApplyWarehouseExpressOutboundResult } from '../warehouse/outboundRepository';
import {
  warehouseCanonicalBarcodeReadInput, warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput, warehouseCanonicalMaterialReadInput,
} from '../warehouse/readCompatibility';

const doc=(ws:string,domain:string,id:string)=>`warehouse/${ws}/${domain}/${id}`;
function reject(code:string,status=409):never {throw new WarehouseStoreError(code,status);}
function needed(rows:ReadonlyMap<string,WarehouseAdminDocument|null>,path:string,code:string) {
  return rows.get(path)||reject(code);
}
function valid<T>(r:{ok:boolean;data?:T},code:string):T {
  if(!r.ok||!r.data)return reject(code);
  return r.data;
}
function movementFrom(row:WarehouseAdminDocument,access:VerifiedWarehouseRequest,id:string) {
  const d=row.data;
  return valid(validateWarehouseMovement({
    schemaVersion:d.schemaVersion,id,workspaceId:d.workspaceId,ug:d.ug,
    materialId:d.materialId,type:d.type,quantityDelta:d.quantityDelta,
    idempotencyKeyHash:d.idempotencyKeyHash,reversesMovementId:d.reversesMovementId??null,
    note:d.note??null,source:d.source??null,
  },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}),
  'WAREHOUSE_OUTBOUND_MOVEMENT_INVALID');
}

export async function applyWarehouseExpressOutboundServer(
  access:VerifiedWarehouseRequest,
  raw:unknown
):Promise<ApplyWarehouseExpressOutboundResult> {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return reject('WAREHOUSE_OUTBOUND_INPUT_INVALID',400);
  const input=raw as Record<string,unknown>;
  if(typeof input.materialId!=='string'||!/^mat_[a-f0-9]{32}$/.test(input.materialId)) {
    return reject('WAREHOUSE_OUTBOUND_INVALID_MATERIAL',400);
  }
  if(typeof input.idempotencyKey!=='string'||input.idempotencyKey.length>200
    ||input.idempotencyKey.length<8) return reject('WAREHOUSE_OUTBOUND_INVALID_OPERATION',400);
  const position=validateWarehouseStockPosition(input.position);
  if(!position || position.kind==='UNASSIGNED')return reject('WAREHOUSE_OUTBOUND_REQUIRES_PHYSICAL_POSITION',400);
  const requestedQuantity=normalizeWarehouseQuantity(input.requestedQuantity);
  if(requestedQuantity===null||requestedQuantity<=0)return reject('WAREHOUSE_OUTBOUND_INVALID_QUANTITY',400);
  const lotId=input.lotId??null;
  const requestedBarcode=input.barcodeAssociation??null;
  const barcodeId=requestedBarcode && typeof requestedBarcode==='object'
    && !Array.isArray(requestedBarcode)
    ?(requestedBarcode as Record<string,unknown>).id:null;
  if(lotId!==null && (typeof lotId!=='string'||!/^lot_[a-f0-9]{32}$/.test(lotId))) {
    return reject('WAREHOUSE_OUTBOUND_INVALID_LOT',400);
  }
  if(requestedBarcode!==null
    &&(typeof barcodeId!=='string'||!/^bar_[a-f0-9]{64}$/.test(barcodeId))) {
    return reject('WAREHOUSE_OUTBOUND_INVALID_BARCODE',400);
  }
  if(input.note!==undefined&&input.note!==null
    &&(typeof input.note!=='string'||input.note.length>240))return reject('WAREHOUSE_OUTBOUND_INVALID_NOTE',400);
  // Presentation is always verified by prepareWarehouseExpressOutbound
  // against the stored material and canonical server-side barcode.
  const materialId=input.materialId;
  const movementId=await createWarehouseMovementId(access.workspaceId,input.idempotencyKey);
  const locationBalanceId=await createWarehouseLocationBalanceId(access.workspaceId,materialId,position);
  const p={
    material:doc(access.workspaceId,'materials',materialId),
    balance:doc(access.workspaceId,'balances',materialId),
    movement:doc(access.workspaceId,'movements',movementId),
    locationBalance:doc(access.workspaceId,'locationBalances',locationBalanceId),
    depot:doc(access.workspaceId,'depots',position.depotId),
    location:doc(access.workspaceId,'locations',position.locationId),
    ...(position.kind==='SUBPOSITION'?{
      subposition:doc(access.workspaceId,'locations',position.subpositionId),
    }:{}),
    ...(typeof lotId==='string'?{lot:doc(access.workspaceId,'lots',lotId)}:{}),
    ...(typeof barcodeId==='string'?{barcode:doc(access.workspaceId,'barcodes',barcodeId)}:{}),
  };
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  // Um lotId nulo não comprova saldo livre: listar referências apenas
  // nesse caso, para evitar reads adicionais nas retiradas rastreadas.
  // O mutex registra alterações de atribuição e evita aceitar lista obsoleta.
  const lockPath=doc(access.workspaceId,'lotAttributionLocks',materialId);
  const initialLock=lotId===null
    ?(await warehouseAdminBatchRead(token,[lockPath])).get(lockPath)??null:null;
  const attributedCandidates=lotId===null
    ?await warehouseAdminListByField(token,access.workspaceId,'lots','materialId',materialId,120):[];
  return warehouseAdminTransaction<ApplyWarehouseExpressOutboundResult>(
    token,[...new Set([...Object.values(p),
      ...(lotId===null?[lockPath,...attributedCandidates.map(candidate=>candidate.path)]:[]),
    ])],rows=>{
      const material=valid(validateWarehouseMaterial(
        warehouseCanonicalMaterialReadInput(materialId,
          needed(rows,p.material,'WAREHOUSE_MATERIAL_NOT_FOUND').data),
        {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}
      ),'WAREHOUSE_INVALID_MATERIAL');
      const storedBalance=needed(rows,p.balance,'WAREHOUSE_BALANCE_NOT_FOUND').data;
      const currentBalance:WarehouseBalance=valid(validateWarehouseBalance({
        schemaVersion:storedBalance.schemaVersion,workspaceId:storedBalance.workspaceId,
        ug:storedBalance.ug,materialId:storedBalance.materialId,quantity:storedBalance.quantity,
        revision:storedBalance.revision,lastMovementId:storedBalance.lastMovementId,
      },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
        expectedMaterialId:materialId}),'WAREHOUSE_INVALID_BALANCE');
      const savedLocation=rows.get(p.locationBalance);
      const currentLocationBalance:WarehouseLocationBalance|null=savedLocation
        ?valid(validateWarehouseLocationBalance(
          warehouseCanonicalLocationBalanceReadInput(locationBalanceId,savedLocation.data),
          {expectedWorkspaceId:access.workspaceId}
        ),'WAREHOUSE_INVALID_LOCATION_BALANCE'):null;
      const liveBarcode:WarehouseBarcodeAssociation|null=typeof barcodeId==='string'
        ?valid(validateWarehouseBarcodeAssociation(
          warehouseCanonicalBarcodeReadInput(barcodeId,
            needed(rows,p.barcode!,'WAREHOUSE_BARCODE_NOT_FOUND').data),
          {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
            expectedMaterialId:materialId}
        ),'WAREHOUSE_INVALID_BARCODE'):null;
      if(liveBarcode&&JSON.stringify(liveBarcode)!==JSON.stringify(requestedBarcode)) {
        return reject('WAREHOUSE_BARCODE_CHANGED');
      }
      const lot:WarehouseLot|null=typeof lotId==='string'
        ?valid(validateWarehouseLot(
          warehouseCanonicalLotReadInput(lotId,
            needed(rows,p.lot!,'WAREHOUSE_OUTBOUND_LOT_NOT_FOUND').data),
          {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
            expectedMaterialId:materialId}
        ),'WAREHOUSE_OUTBOUND_LOT_INVALID'):null;
      // Autoridade no servidor: cliente não pode expedir referência já vencida
      // enviando um lotId diretamente à API (independente do FEFO removido).
      if(lot && warehouseLotExpiryState(lot)==='EXPIRED') {
        return reject('WAREHOUSE_OUTBOUND_LOT_EXPIRED');
      }
      const depot=needed(rows,p.depot,'WAREHOUSE_OUTBOUND_DEPOT_NOT_FOUND').data;
      const loc=needed(rows,p.location,'WAREHOUSE_OUTBOUND_LOCATION_NOT_FOUND').data;
      if(depot.workspaceId!==access.workspaceId||depot.ug!==access.ug||depot.status!=='active'
        ||loc.workspaceId!==access.workspaceId||loc.ug!==access.ug||loc.status!=='active'
        ||loc.kind!=='LOCAL'||loc.depotId!==position.depotId) {
        return reject('WAREHOUSE_OUTBOUND_LOCATION_INACTIVE');
      }
      if(position.kind==='SUBPOSITION'){
        const sub=needed(rows,p.subposition!,'WAREHOUSE_OUTBOUND_SUBPOSITION_NOT_FOUND').data;
        if(sub.kind!=='SUBPOSITION'||sub.depotId!==position.depotId
          ||sub.parentLocationId!==position.locationId||sub.status!=='active'
          ||sub.workspaceId!==access.workspaceId||sub.ug!==access.ug) {
          return reject('WAREHOUSE_OUTBOUND_SUBPOSITION_INACTIVE');
        }
      }
      const old=rows.get(p.movement);
      if(old) {
        const replay=movementFrom(old,access,movementId);
        const source=replay.source;
        const same=source?.kind==='EXPRESS_OUTBOUND'
          && replay.type==='OUTBOUND'
          && replay.materialId===materialId
          && source.requestedQuantity===requestedQuantity
          && JSON.stringify(source.presentation)===JSON.stringify(input.presentation)
          && JSON.stringify(source.position)===JSON.stringify(position)
          && source.barcodeId===(barcodeId??null)
          && source.lotId===(lotId??null)
          && replay.note===(input.note??null);
        if(!same||source?.kind!=='EXPRESS_OUTBOUND')return reject('WAREHOUSE_IDEMPOTENCY_CONFLICT');
        if(!currentLocationBalance)return reject('WAREHOUSE_LOCATION_BALANCE_INCONSISTENT');
        return {result:{
          applied:false,movement:replay,previousBalance:currentBalance,balance:currentBalance,
          locationBalance:currentLocationBalance,lot,
          plan:{requestedQuantity:source.requestedQuantity,baseQuantity:source.quantity,
            factorToBaseUnit:source.factorToBaseUnit,presentation:source.presentation,
            position:source.position,interface:source.interface,
            barcodeAssociation:liveBarcode,lot},
        },writes:[]};
      }
      // O motor de domínio lança Error para condições de negócio.
      // A API precisa preservar o status apropriado (400/409), sem
      // disfarçar saldo insuficiente como indisponibilidade HTTP 503.
      let plan:ReturnType<typeof prepareWarehouseExpressOutbound>;
      try {
        plan=prepareWarehouseExpressOutbound({
          material,balance:currentBalance,requestedQuantity,
          presentation:input.presentation as WarehouseMaterial['unit'],
          position,barcodeAssociation:liveBarcode,lot,
        });
      }catch(error){
        const domainCode=error instanceof Error?error.message:'';
        if (domainCode==='WAREHOUSE_OUTBOUND_INVALID_QUANTITY'
          || domainCode==='WAREHOUSE_OUTBOUND_INVALID_CONVERSION') {
          return reject(domainCode,400);
        }
        const expectedErrors=[
          'WAREHOUSE_MATERIAL_INACTIVE',
          'WAREHOUSE_OUTBOUND_BALANCE_SCOPE_MISMATCH',
          'WAREHOUSE_OUTBOUND_PRESENTATION_NOT_CONFIGURED',
          'WAREHOUSE_BARCODE_INACTIVE',
          'WAREHOUSE_BARCODE_MATERIAL_CONVERSION_MISMATCH',
          'WAREHOUSE_BARCODE_PRESENTATION_MISMATCH',
          'WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK',
          'WAREHOUSE_OUTBOUND_LOT_SCOPE_MISMATCH',
          'WAREHOUSE_OUTBOUND_LOT_INACTIVE',
          'WAREHOUSE_OUTBOUND_LOT_POSITION_MISMATCH',
          'WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION',
        ];
        if(expectedErrors.includes(domainCode))return reject(domainCode,409);
        throw error;
      }
      if(lotId===null) {
        // Rastreabilidade autoritativa no snapshot transacional; nunca
        // usar o saldo livre declarado/estimado pelo navegador.
        const liveLock=rows.get(lockPath);
        if((liveLock?.updateTime??null)!==(initialLock?.updateTime??null)) {
          return reject('WAREHOUSE_OUTBOUND_ATTRIBUTION_CHANGED');
        }
        let attributed=0;
        for(const candidate of attributedCandidates) {
          const stored=needed(rows,candidate.path,'WAREHOUSE_OUTBOUND_ATTRIBUTION_CHANGED');
          const linked=valid(validateWarehouseLot(
            warehouseCanonicalLotReadInput(candidate.path.split('/').at(-1)!,stored.data),
            {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
              expectedMaterialId:materialId}
          ),'WAREHOUSE_OUTBOUND_ATTRIBUTION_INVALID');
          if(warehouseStockPositionsEqual(linked.position,position)) {
            attributed=normalizeWarehouseQuantity(attributed+linked.quantity)
              ??reject('WAREHOUSE_OUTBOUND_ATTRIBUTION_INVALID');
          }
        }
        if(!currentLocationBalance)return reject('WAREHOUSE_OUTBOUND_LOCATION_BALANCE_REQUIRED');
        const free=normalizeWarehouseQuantity(currentLocationBalance.quantity-attributed);
        if(free===null||free<0)return reject('WAREHOUSE_OUTBOUND_ATTRIBUTION_EXCEEDS_STOCK');
        if(plan.baseQuantity>free+0.000001) {
          return reject('WAREHOUSE_OUTBOUND_UNTRACKED_QUANTITY_NOT_AVAILABLE');
        }
      }
      // A retirada composta deve declarar a quantidade base realmente
      // validada no servidor; rejeitar divergência antes de escrever movimento.
      if(input.expectedBaseQuantity!==undefined) {
        const expected=normalizeWarehouseQuantity(input.expectedBaseQuantity);
        if(expected===null||expected<=0||Math.abs(expected-plan.baseQuantity)>0.000001) {
          return reject('WAREHOUSE_OUTBOUND_EXPECTED_BASE_MISMATCH',400);
        }
      }
      if(!currentLocationBalance)return reject('WAREHOUSE_OUTBOUND_LOCATION_BALANCE_REQUIRED');
      if(currentLocationBalance.quantity+0.000001<plan.baseQuantity) {
        return reject('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
      }
      const source:WarehouseExpressOutboundMovementSource={
        kind:'EXPRESS_OUTBOUND',interface:plan.interface,actorUid:access.uid,
        requestedQuantity:plan.requestedQuantity,quantity:plan.baseQuantity,
        presentation:plan.presentation,factorToBaseUnit:plan.factorToBaseUnit,
        barcodeId:liveBarcode?.id||null,barcode:liveBarcode?.barcode||null,
        position,locationBalanceId,lotId:lot?.id||null,lotCode:lot?.code||null,
      };
      const movement:WarehouseMovement=valid(validateWarehouseMovement({
        schemaVersion:WAREHOUSE_MOVEMENT_SCHEMA_VERSION,id:movementId,
        workspaceId:access.workspaceId,ug:access.ug,materialId,
        type:'OUTBOUND',quantityDelta:-plan.baseQuantity,
        idempotencyKeyHash:movementId.slice(4),reversesMovementId:null,
        note:input.note??null,source,
      },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
        expectedMaterialId:materialId}),'WAREHOUSE_INVALID_OUTBOUND_MOVEMENT');
      const balance=applyWarehouseMovementToBalance(movement,currentBalance);
      const locationBalance=applyWarehouseLocationDelta(currentLocationBalance,{
        id:locationBalanceId,workspaceId:access.workspaceId,ug:access.ug,
        materialId,position,quantityDelta:-plan.baseQuantity,movementId,
      });
      if(balance.quantity<0||locationBalance.quantity<0)return reject('WAREHOUSE_OUTBOUND_NEGATIVE_STOCK');
      const now=new Date();
      const writes:Array<{path:string;data:Record<string,unknown>}>= [
        {path:p.movement,data:{...movement,createdAt:now}},
        {path:p.balance,data:{...balance,updatedAt:now}},
        {path:p.locationBalance,data:{...locationBalance,updatedAt:now}},
      ];
      let nextLot=lot;
      if(lot&&p.lot){
        const qty=normalizeWarehouseQuantity(lot.quantity-plan.baseQuantity);
        if(qty===null||qty<0)return reject('WAREHOUSE_OUTBOUND_LOT_NEGATIVE');
        nextLot={...lot,quantity:qty,updatedBy:access.uid};
        const prev=needed(rows,p.lot,'WAREHOUSE_OUTBOUND_LOT_NOT_FOUND').data;
        writes.push({path:p.lot,data:{...prev,...nextLot,updatedAt:now}});
      }
      return {result:{
        applied:true,movement,previousBalance:currentBalance,balance,
        locationBalance,plan,lot:nextLot,
      },writes};
    }
  );
}
