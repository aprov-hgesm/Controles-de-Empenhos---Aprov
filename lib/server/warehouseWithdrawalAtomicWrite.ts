/**
 * Retirada v2: ALL-OR-NOTHING em uma única transação Firestore.
 * Nenhum saldo, movimento ou consumo é gravado até todas as linhas validarem.
 * Caminhos legados FINALIZING/PARTIALLY_APPLIED são tratados pelo motor v1.
 */
import { createHash } from 'node:crypto';
import {
  auditWarehouseAtomicWithdrawalReplay, buildWarehouseWithdrawalEffectManifest,
  warehouseWithdrawalManifestHash,
} from './warehouseWithdrawalEvidence';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { WarehouseStoreError, warehouseAdminBatchRead, warehouseAdminListByField,
  warehouseAdminTransaction, type WarehouseAdminDocument } from './warehouseFirestoreTransaction';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { applyWarehouseLocationDelta, createWarehouseLocationBalanceId,
  warehouseStockPositionsEqual, validateWarehouseLocationBalance,
  validateWarehouseStockPosition, type WarehouseLocationBalance,
  type WarehouseStockPosition } from '../warehouse/location';
import { validateWarehouseMaterial, type WarehouseMaterial } from '../warehouse/material';
import { validateWarehouseLot, warehouseLotExpiryState, type WarehouseLot } from '../warehouse/lot';
import { validateWarehouseBarcodeAssociation, type WarehouseBarcodeAssociation } from '../warehouse/barcode';
import { applyWarehouseMovementToBalance, createWarehouseMovementId,
  normalizeWarehouseQuantity, validateWarehouseBalance, validateWarehouseMovement,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION, type WarehouseBalance, type WarehouseMovement,
  type WarehouseExpressOutboundMovementSource } from '../warehouse/movement';
import { prepareWarehouseExpressOutbound } from '../warehouse/outbound';
import { warehouseCanonicalBarcodeReadInput, warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalLotReadInput, warehouseCanonicalMaterialReadInput } from '../warehouse/readCompatibility';
import { WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION, WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,
  normalizeWarehouseWithdrawnBy, type WarehouseMaterialWithdrawal,
  type WarehouseWithdrawalLineInput } from '../warehouse/withdrawal';
import type { FinalizeWarehouseMaterialWithdrawalInput,
  FinalizeWarehouseMaterialWithdrawalResult } from '../warehouse/withdrawalRepository';

const path=(ws:string,kind:string,id:string)=>'warehouse/'+ws+'/'+kind+'/'+id;
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const deny=(message:string,status=409):never=>{throw new WarehouseStoreError(message,status);};
const get=(rows:ReadonlyMap<string,WarehouseAdminDocument|null>,p:string,code:string)=>
  rows.get(p)||deny(code);
function checked<T>(validation:{ok:boolean;data?:T},code:string):T {
  if(!validation.ok||!validation.data)return deny(code);
  return validation.data;
}
interface ReadLine {
  line:WarehouseWithdrawalLineInput;
  movementId:string;
  locationBalanceId:string;
  consumptionId:string;
  position:Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>;
}
export function atomicWarehouseWithdrawalHash(input:FinalizeWarehouseMaterialWithdrawalInput) {
  // Todos os campos documentais fazem parte da identidade imutável do comando.
  return sha(JSON.stringify({destinationId:input.destinationId,
    withdrawnBy:normalizeWarehouseWithdrawnBy(input.withdrawnBy),
    lines:input.lines}));
}
export interface WarehouseWithdrawalAtomicV3Options {
  intentHash:string;
  intentLineCount:number;
  /** Versões lidas no planejamento, rechecadas na transação de baixa. */
  snapshotVersions:Record<string,string|null>;
  /** Barcode IDs obtidos de associações lidas/validadas no servidor. */
  barcodeIdsByLine:Record<string,string|null>;
  originalByLine:Record<string,{intentIndex:number;partIndex:number;
    originalRequestedQuantity:number;originalPresentationCode:string;
    factorToBaseUnit:number;barcodeId:string|null}>;
}
export async function finalizeWarehouseWithdrawalAtomicServer(
  access:VerifiedWarehouseRequest,input:FinalizeWarehouseMaterialWithdrawalInput,
  v3?:WarehouseWithdrawalAtomicV3Options,
):Promise<FinalizeWarehouseMaterialWithdrawalResult> {
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ?'emulator':await getGoogleAccessToken();
  const ws=access.workspaceId, destinationPath=path(ws,'destinations',input.destinationId);
  const headerPath=path(ws,'withdrawals',input.withdrawalId);
  const hash=v3?.intentHash??atomicWarehouseWithdrawalHash(input);
  const version=v3?3:2;
  // Replay confirmado deve independer de saldo atual, validade alterada,
  // localização desativada ou da disponibilidade de consultas secundárias.
  const saved=(await warehouseAdminBatchRead(token,[headerPath])).get(headerPath);
  if(saved) {
    const h=saved.data;
    if(h.atomicVersion!==version)return deny(v3
        ?'WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT'
        :'WAREHOUSE_WITHDRAWAL_LEGACY_RECOVERY_REQUIRED');
    if(h.workspaceId!==ws||h.ug!==access.ug||h.id!==input.withdrawalId
      ||h.payloadHash!==hash||h.destinationId!==input.destinationId
      ||(!v3&&h.withdrawnBy!==normalizeWarehouseWithdrawnBy(input.withdrawnBy))
      ||(v3?h.intentLineCount!==v3.intentLineCount:h.expectedLineCount!==input.lines.length))
      return deny('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT');
    if(h.status!=='FINALIZED'||h.appliedLineCount!==(v3?h.expectedLineCount:input.lines.length))
      return deny('WAREHOUSE_WITHDRAWAL_ATOMIC_HEADER_INVALID');
    return auditWarehouseAtomicWithdrawalReplay(access,token,input.withdrawalId,saved,
      v3?{version:3,intentHash:hash,intentLineCount:v3.intentLineCount}
        :{version:2,lines:input.lines});
  }
  const prepared:ReadLine[]=await Promise.all(input.lines.map(async line=>{
    const position=validateWarehouseStockPosition(line.position);
    if(!position||position.kind==='UNASSIGNED')return deny('WAREHOUSE_OUTBOUND_REQUIRES_PHYSICAL_POSITION',400);
    return {
      line,position,
      movementId:await createWarehouseMovementId(ws,'material-withdrawal:'+input.withdrawalId+':'+line.lineId),
      locationBalanceId:await createWarehouseLocationBalanceId(ws,line.materialId,position),
      consumptionId:'cons_'+sha(ws+'\n'+'stock:'+input.withdrawalId+':'+line.lineId),
    };
  }));
  const effectManifest=v3?await buildWarehouseWithdrawalEffectManifest(
    ws,input.withdrawalId,hash,v3.intentLineCount,input.lines,v3.originalByLine):null;
  const set=new Set<string>([headerPath,destinationPath]);
  const untracked=new Set<string>();
  for(const p of prepared) {
    const {line,position}=p;
    for(const [kind,id] of [
      ['materials',line.materialId],['balances',line.materialId],
      ['movements',p.movementId],['consumptions',p.consumptionId],
      ['locationBalances',p.locationBalanceId],
      ['depots',position.depotId],['locations',position.locationId],
    ])set.add(path(ws,kind,id));
    if(position.kind==='SUBPOSITION')set.add(path(ws,'locations',position.subpositionId));
    if(line.lotId)set.add(path(ws,'lots',line.lotId));
    else untracked.add(line.materialId);
    if(line.barcodeAssociation)set.add(path(ws,'barcodes',line.barcodeAssociation.id));
  }
  const candidateByMaterial=new Map<string,string[]>();
  const mutexVersions=new Map<string,string|null>();
  for(const materialId of untracked) {
    const mutexPath=path(ws,'lotAttributionLocks',materialId);
    const mutex=(await warehouseAdminBatchRead(token,[mutexPath])).get(mutexPath);
    mutexVersions.set(mutexPath,mutex?.updateTime||null);
    set.add(mutexPath);
    const candidates=await warehouseAdminListByField(token,ws,'lots','materialId',materialId,120);
    const names=candidates.map(candidate=>candidate.path);
    candidateByMaterial.set(materialId,names);
    for(const name of names)set.add(name);
  }
  if(v3)for(const name of Object.keys(v3.snapshotVersions))set.add(name);
  if(set.size>450)return deny('WAREHOUSE_WITHDRAWAL_ATOMIC_TOO_MANY_DOCUMENTS',400);

  // Um único commit; a transação serializa concorrência por saldo, referência,
  // movimento, consumo e cabeçalho. No replay retorna sem escritas.
  const committed=await warehouseAdminTransaction<FinalizeWarehouseMaterialWithdrawalResult>(
    token,[...set],rows=>{
      const old=rows.get(headerPath);
      if(old) {
        const h=old.data;
        if(h.atomicVersion!==version)return deny(v3
        ?'WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT'
        :'WAREHOUSE_WITHDRAWAL_LEGACY_RECOVERY_REQUIRED');
        if(h.workspaceId!==ws||h.ug!==access.ug||h.id!==input.withdrawalId
          ||h.payloadHash!==hash||h.destinationId!==input.destinationId
          ||(!v3&&h.withdrawnBy!==normalizeWarehouseWithdrawnBy(input.withdrawnBy))
          ||(v3?h.intentLineCount!==v3.intentLineCount:h.expectedLineCount!==prepared.length)) {
          return deny('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT');
        }
        if(h.status!=='FINALIZED'||h.appliedLineCount!==(v3?h.expectedLineCount:prepared.length)) {
          return deny('WAREHOUSE_WITHDRAWAL_ATOMIC_HEADER_INVALID');
        }
        const withdrawal=h as unknown as WarehouseMaterialWithdrawal;
        // Checagem de movimentos e consumos é feita após esta transação
        // no caminho de replay, sempre sem novas escritas.
        return {result:{withdrawal,movementIds:[]},writes:[]};
      }
      if(v3)for(const [name,updateTime] of Object.entries(v3.snapshotVersions)) {
        if((rows.get(name)?.updateTime||null)!==updateTime)
          return deny('WAREHOUSE_WITHDRAWAL_V3_SNAPSHOT_CHANGED');
      }
      const destination=get(rows,destinationPath,'WAREHOUSE_DESTINATION_INACTIVE').data;
      if(destination.status!=='active'||destination.workspaceId!==ws||destination.ug!==access.ug
        ||typeof destination.name!=='string'||!destination.name.trim())
        return deny('WAREHOUSE_DESTINATION_INACTIVE');
      for(const [mutexPath,initialVersion] of mutexVersions) {
        if((rows.get(mutexPath)?.updateTime||null)!==initialVersion)
          return deny('WAREHOUSE_OUTBOUND_ATTRIBUTION_CHANGED');
      }
      const now=new Date();
      const writes=new Map<string,Record<string,unknown>>();
      // staged é a imagem transacional após as linhas anteriores: suportar
      // várias linhas para o mesmo material, mesma posição e mesma validade.
      const staged=new Map<string,Record<string,unknown>>();
      const current=(name:string)=>staged.get(name)||get(rows,name,'WAREHOUSE_WITHDRAWAL_DOCUMENT_MISSING').data;
      const place=(name:string,data:Record<string,unknown>)=>{
        if(!rows.has(name))return deny('WAREHOUSE_WITHDRAWAL_WRITE_NOT_READ');
        staged.set(name,data);writes.set(name,data);
      };
      const ids:string[]=[];
      for(let index=0;index<prepared.length;index++) {
        const p=prepared[index],{line,position}=p;
        if(process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
          &&process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID==='demo-emprovex-security'
          &&process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE===String(index+1))
          return deny('WAREHOUSE_ATOMIC_TEST_INJECTED_FAILURE');
        const matPath=path(ws,'materials',line.materialId),balPath=path(ws,'balances',line.materialId);
        const locBalPath=path(ws,'locationBalances',p.locationBalanceId);
        const material=checked(validateWarehouseMaterial(
          warehouseCanonicalMaterialReadInput(line.materialId,current(matPath)),
          {expectedWorkspaceId:ws,expectedUg:access.ug}),'WAREHOUSE_INVALID_MATERIAL');
        const balanceData=current(balPath);
        const balance:WarehouseBalance=checked(validateWarehouseBalance({
          schemaVersion:balanceData.schemaVersion,workspaceId:balanceData.workspaceId,
          ug:balanceData.ug,materialId:balanceData.materialId,quantity:balanceData.quantity,
          revision:balanceData.revision,lastMovementId:balanceData.lastMovementId,
        },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:line.materialId}),
        'WAREHOUSE_INVALID_BALANCE');
        const locationData=current(locBalPath);
        const location:WarehouseLocationBalance=checked(validateWarehouseLocationBalance(
          warehouseCanonicalLocationBalanceReadInput(p.locationBalanceId,locationData),
          {expectedWorkspaceId:ws,expectedMaterialId:line.materialId}),
        'WAREHOUSE_INVALID_LOCATION_BALANCE');
        if(location.ug!==access.ug||!warehouseStockPositionsEqual(location.position,position))
          return deny('WAREHOUSE_OUTBOUND_LOCATION_SCOPE_MISMATCH');
        const depot=get(rows,path(ws,'depots',position.depotId),'WAREHOUSE_OUTBOUND_DEPOT_NOT_FOUND').data;
        const local=get(rows,path(ws,'locations',position.locationId),'WAREHOUSE_OUTBOUND_LOCATION_NOT_FOUND').data;
        if(depot.workspaceId!==ws||depot.ug!==access.ug||depot.status!=='active'
          ||local.workspaceId!==ws||local.ug!==access.ug||local.status!=='active'
          ||local.kind!=='LOCAL'||local.depotId!==position.depotId)
          return deny('WAREHOUSE_OUTBOUND_LOCATION_INACTIVE');
        if(position.kind==='SUBPOSITION') {
          const sub=get(rows,path(ws,'locations',position.subpositionId),
            'WAREHOUSE_OUTBOUND_SUBPOSITION_NOT_FOUND').data;
          if(sub.workspaceId!==ws||sub.ug!==access.ug||sub.status!=='active'
            ||sub.kind!=='SUBPOSITION'||sub.depotId!==position.depotId
            ||sub.parentLocationId!==position.locationId)
            return deny('WAREHOUSE_OUTBOUND_SUBPOSITION_INACTIVE');
        }
        let barcode:WarehouseBarcodeAssociation|null=null;
        if(line.barcodeAssociation) {
          const b=line.barcodeAssociation;
          barcode=checked(validateWarehouseBarcodeAssociation(
            warehouseCanonicalBarcodeReadInput(b.id,
              current(path(ws,'barcodes',b.id))),
            {expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:line.materialId}),
          'WAREHOUSE_INVALID_BARCODE');
          if(JSON.stringify(barcode)!==JSON.stringify(b))return deny('WAREHOUSE_BARCODE_CHANGED');
        }
        let lot:WarehouseLot|null=null,lotPath:string|null=null;
        if(line.lotId) {
          lotPath=path(ws,'lots',line.lotId);
          lot=checked(validateWarehouseLot(
            warehouseCanonicalLotReadInput(line.lotId,current(lotPath)),
            {expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:line.materialId}),
            'WAREHOUSE_OUTBOUND_LOT_INVALID');
          if(warehouseLotExpiryState(lot)==='EXPIRED')return deny('WAREHOUSE_OUTBOUND_LOT_EXPIRED');
        }
        let plan:ReturnType<typeof prepareWarehouseExpressOutbound>;
        try {
          plan=prepareWarehouseExpressOutbound({material,balance,requestedQuantity:line.requestedQuantity,
            presentation:line.presentation,position,barcodeAssociation:barcode,lot});
        }catch(error) {
          return deny(error instanceof Error?error.message:'WAREHOUSE_OUTBOUND_PLAN_INVALID');
        }
        const declared=normalizeWarehouseQuantity(line.baseQuantity);
        if(declared===null||declared<=0||Math.abs(declared-plan.baseQuantity)>0.000001)
          return deny('WAREHOUSE_OUTBOUND_EXPECTED_BASE_MISMATCH',400);
        if(location.quantity+0.000001<plan.baseQuantity)
          return deny('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
        if(!lot) {
          let attributed=0;
          for(const name of candidateByMaterial.get(line.materialId)||[]) {
            const currentLot=checked(validateWarehouseLot(
              warehouseCanonicalLotReadInput(name.split('/').at(-1)!,current(name)),
              {expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:line.materialId}),
              'WAREHOUSE_OUTBOUND_ATTRIBUTION_INVALID');
            if(warehouseStockPositionsEqual(currentLot.position,position))
              attributed=normalizeWarehouseQuantity(attributed+currentLot.quantity)
                ??deny('WAREHOUSE_OUTBOUND_ATTRIBUTION_INVALID');
          }
          // Referências explícitas da mesma retirada também integram esse saldo.
          const free=normalizeWarehouseQuantity(location.quantity-attributed);
          if(free===null||free<0)return deny('WAREHOUSE_OUTBOUND_ATTRIBUTION_EXCEEDS_STOCK');
          if(plan.baseQuantity>free+0.000001)
            return deny('WAREHOUSE_OUTBOUND_UNTRACKED_QUANTITY_NOT_AVAILABLE');
        }
        if(rows.get(path(ws,'movements',p.movementId))
          ||rows.get(path(ws,'consumptions',p.consumptionId)))
          return deny('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT');
        const note='Saída de Material · '+input.withdrawalId+' · '+line.lineId;
        const source:WarehouseExpressOutboundMovementSource={
          kind:'EXPRESS_OUTBOUND',interface:plan.interface,actorUid:access.uid,
          requestedQuantity:plan.requestedQuantity,quantity:plan.baseQuantity,
          presentation:plan.presentation,factorToBaseUnit:plan.factorToBaseUnit,
          barcodeId:v3?.barcodeIdsByLine[line.lineId]??barcode?.id??null,
          barcode:v3?line.barcode:barcode?.barcode||null,
          position,locationBalanceId:p.locationBalanceId,lotId:lot?.id||null,lotCode:lot?.code||null,
        };
        const movement:WarehouseMovement=checked(validateWarehouseMovement({
          schemaVersion:WAREHOUSE_MOVEMENT_SCHEMA_VERSION,id:p.movementId,
          workspaceId:ws,ug:access.ug,materialId:line.materialId,type:'OUTBOUND',
          quantityDelta:-plan.baseQuantity,idempotencyKeyHash:p.movementId.slice(4),
          reversesMovementId:null,note,source,
        },{expectedWorkspaceId:ws,expectedUg:access.ug,expectedMaterialId:line.materialId}),
        'WAREHOUSE_INVALID_OUTBOUND_MOVEMENT');
        const nextBalance=applyWarehouseMovementToBalance(movement,balance);
        const nextLocation=applyWarehouseLocationDelta(location,{
          id:p.locationBalanceId,workspaceId:ws,ug:access.ug,materialId:line.materialId,
          position,quantityDelta:-plan.baseQuantity,movementId:p.movementId,
        });
        if(nextBalance.quantity<0||nextLocation.quantity<0)
          return deny('WAREHOUSE_OUTBOUND_NEGATIVE_STOCK');
        place(balPath,{...nextBalance,updatedAt:now});
        place(locBalPath,{...nextLocation,updatedAt:now});
        place(path(ws,'movements',p.movementId),{...movement,createdAt:now});
        if(lot && lotPath) {
          const quantity=normalizeWarehouseQuantity(lot.quantity-plan.baseQuantity);
          if(quantity===null||quantity<0)return deny('WAREHOUSE_OUTBOUND_LOT_NEGATIVE');
          place(lotPath,{...current(lotPath),quantity,updatedBy:access.uid,updatedAt:now});
        }
        // Identidade, quantidades e referências provêm de documentos canônicos;
        // nenhuma informação de saldo ou operador é aceita do navegador.
        place(path(ws,'consumptions',p.consumptionId),{
          schemaVersion:WAREHOUSE_CONSUMPTION_SCHEMA_VERSION,id:p.consumptionId,
          workspaceId:ws,ug:access.ug,origin:'STOCK_OUTBOUND',
          materialId:line.materialId,materialDescription:material.description,
          unitLabel:material.unit.label||material.unit.code,
          quantity:plan.baseQuantity,
          requestedQuantity:v3
            ?normalizeWarehouseQuantity(plan.baseQuantity/
              v3.originalByLine[line.lineId].factorToBaseUnit)
              ??deny('WAREHOUSE_WITHDRAWAL_V3_CONVERSION_INVALID')
            :plan.requestedQuantity,
          presentationLabel:v3?line.presentationLabel:
            barcode?.presentation.label||line.presentation.label||line.presentation.code,
          destinationId:input.destinationId,destinationName:destination.name,
          withdrawnBy:normalizeWarehouseWithdrawnBy(input.withdrawnBy),
          operatorUid:access.uid,movementId:p.movementId,withdrawalId:input.withdrawalId,
          lineId:line.lineId,intakeId:null,invoiceRecordKey:null,
          barcode:v3?line.barcode:barcode?.barcode||null,lotCode:lot?.code||null,
          ...(v3?{operatorRequestedQuantity:v3.originalByLine[line.lineId].originalRequestedQuantity,
            operatorPresentationCode:v3.originalByLine[line.lineId].originalPresentationCode,
            operatorPresentationLabel:line.presentationLabel,
            operatorFactorToBaseUnit:v3.originalByLine[line.lineId].factorToBaseUnit,
            operatorIntentIndex:v3.originalByLine[line.lineId].intentIndex}:{}),
          positionLabel:local.name+(position.kind==='SUBPOSITION'?' / '+get(rows,
            path(ws,'locations',position.subpositionId),'WAREHOUSE_OUTBOUND_SUBPOSITION_NOT_FOUND').data.name:''),
          siscofisStatus:'PENDING',occurredAt:now,updatedAt:now,
          siscofisUpdatedBy:null,siscofisUpdatedAt:null,returnedQuantity:0,
          lastReturnMovementId:null,lastReturnAt:null,lastReturnBy:null,lastReturnReason:null,
        });
        ids.push(p.movementId);
      }
      const nowString=now.toISOString();
      const withdrawal:WarehouseMaterialWithdrawal={
        schemaVersion:WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,id:input.withdrawalId,
        workspaceId:ws,ug:access.ug,destinationId:input.destinationId,
        destinationName:destination.name,withdrawnBy:normalizeWarehouseWithdrawnBy(input.withdrawnBy),
        payloadHash:hash,expectedLineCount:prepared.length,appliedLineCount:prepared.length,
        status:'FINALIZED',createdBy:access.uid,createdAt:nowString,
        updatedAt:nowString,finalizedAt:nowString,
      };
      place(headerPath,{...withdrawal,atomicVersion:version,
        ...(v3&&effectManifest?{intentLineCount:v3.intentLineCount,
          effectManifest,effectManifestHash:warehouseWithdrawalManifestHash(effectManifest)}:{})});
      if(writes.size>450)return deny('WAREHOUSE_WITHDRAWAL_ATOMIC_TOO_MANY_WRITES',400);
      return {result:{withdrawal,movementIds:ids},
        writes:[...writes].map(([name,data])=>({path:name,data}))};
    }
  );
  if(committed.movementIds.length===0) {
    const savedReplay=(await warehouseAdminBatchRead(token,[headerPath])).get(headerPath);
    if(!savedReplay)return deny('WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED');
    return auditWarehouseAtomicWithdrawalReplay(access,token,input.withdrawalId,
      savedReplay,v3?{version:3,intentHash:hash,intentLineCount:v3.intentLineCount}
        :{version:2,lines:input.lines});
  }
  // Injeção estritamente no Emulator: simula perda da resposta HTTP após
  // commit remoto confirmado. O mesmo withdrawalId recupera sem nova baixa.
  if(process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    &&process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID==='demo-emprovex-security'
    &&process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT===input.withdrawalId)
    return deny('WAREHOUSE_ATOMIC_TEST_RESPONSE_LOST',503);
  return committed;
}
