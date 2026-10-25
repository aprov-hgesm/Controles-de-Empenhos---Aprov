/**
 * Auditoria read-only dos efeitos imutáveis de retiradas atômicas.
 * Não reconstrói saldos atuais, nem recupera uma retirada inconsistente
 * por segunda baixa. Histórico de devoluções e SISCOFIS é permitido.
 */
import { createHash } from 'node:crypto';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import {
  warehouseAdminBatchRead, WarehouseStoreError,
  type WarehouseAdminDocument,
} from './warehouseFirestoreTransaction';
import { createWarehouseMovementId, normalizeWarehouseQuantity } from '../warehouse/movement';
import { validateWarehouseStockPosition, warehouseStockPositionsEqual } from '../warehouse/location';
import type { WarehouseWithdrawalLineInput, WarehouseMaterialWithdrawal } from '../warehouse/withdrawal';
import type { FinalizeWarehouseMaterialWithdrawalResult } from '../warehouse/withdrawalRepository';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const doc=(ws:string,kind:string,id:string)=>'warehouse/'+ws+'/'+kind+'/'+id;
const reject=(code='WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED'):never=>
  {throw new WarehouseStoreError(code,409);};
const sameNumber=(a:unknown,b:number):boolean=>
  typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<0.000001;

export const WAREHOUSE_WITHDRAWAL_EFFECT_MANIFEST_VERSION='warehouse_withdrawal_effects_v3' as const;
export interface WarehouseWithdrawalEffectLine {
  lineId:string;
  intentIndex:number;
  partIndex:number;
  materialId:string;
  position:WarehouseWithdrawalLineInput['position'];
  lotId:string|null;
  barcodeId:string|null;
  requestedQuantity:number;
  baseQuantity:number;
  originalRequestedQuantity:number;
  originalPresentationCode:string;
  factorToBaseUnit:number;
  movementId:string;
  consumptionId:string;
}
export interface WarehouseWithdrawalEffectManifest {
  schemaVersion:typeof WAREHOUSE_WITHDRAWAL_EFFECT_MANIFEST_VERSION;
  withdrawalId:string;
  intentHash:string;
  intentLineCount:number;
  lines:WarehouseWithdrawalEffectLine[];
}
export function warehouseWithdrawalManifestHash(manifest:WarehouseWithdrawalEffectManifest):string {
  return hash('warehouse_withdrawal_manifest_v3\n'+JSON.stringify(manifest));
}
export async function buildWarehouseWithdrawalEffectManifest(
  ws:string,withdrawalId:string,intentHash:string,intentLineCount:number,
  lines:WarehouseWithdrawalLineInput[],
  byLine:Record<string,{intentIndex:number;partIndex:number;
    originalRequestedQuantity:number;originalPresentationCode:string;
    factorToBaseUnit:number;barcodeId:string|null}>,
):Promise<WarehouseWithdrawalEffectManifest>{
  const mapped:WarehouseWithdrawalEffectLine[]=[];
  for(const line of lines) {
    const extra=byLine[line.lineId];
    if(!extra)reject('WAREHOUSE_WITHDRAWAL_V3_MANIFEST_INVALID');
    mapped.push({
      lineId:line.lineId,intentIndex:extra.intentIndex,partIndex:extra.partIndex,
      materialId:line.materialId,position:line.position,lotId:line.lotId,
      barcodeId:extra.barcodeId,requestedQuantity:line.requestedQuantity,
      baseQuantity:line.baseQuantity,
      originalRequestedQuantity:extra.originalRequestedQuantity,
      originalPresentationCode:extra.originalPresentationCode,
      factorToBaseUnit:extra.factorToBaseUnit,
      movementId:await createWarehouseMovementId(ws,'material-withdrawal:'+withdrawalId+':'+line.lineId),
      consumptionId:'cons_'+hash(ws+'\n'+'stock:'+withdrawalId+':'+line.lineId),
    });
  }
  return {schemaVersion:WAREHOUSE_WITHDRAWAL_EFFECT_MANIFEST_VERSION,
    withdrawalId,intentHash,intentLineCount,lines:mapped};
}

function parseManifest(
  header:Record<string,unknown>,input:{withdrawalId:string;intentHash:string;intentLineCount:number},
):WarehouseWithdrawalEffectManifest {
  const manifest=header.effectManifest as WarehouseWithdrawalEffectManifest|undefined;
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)
    ||manifest.schemaVersion!==WAREHOUSE_WITHDRAWAL_EFFECT_MANIFEST_VERSION
    ||manifest.withdrawalId!==input.withdrawalId
    ||manifest.intentHash!==input.intentHash||manifest.intentLineCount!==input.intentLineCount
    ||!Array.isArray(manifest.lines)||manifest.lines.length<1||manifest.lines.length>40
    ||header.effectManifestHash!==warehouseWithdrawalManifestHash(manifest)
    ||header.expectedLineCount!==manifest.lines.length
    ||header.appliedLineCount!==manifest.lines.length)return reject();
  const unique=new Set<string>();
  const perIntent=new Map<number,number[]>();
  for(const line of manifest.lines){
    if(!line||typeof line!=='object'
      ||!/^wline_[a-f0-9]{32}$/.test(line.lineId)
      ||!/^mat_[a-f0-9]{32}$/.test(line.materialId)
      ||!/^mov_[a-f0-9]{64}$/.test(line.movementId)
      ||!/^cons_[a-f0-9]{64}$/.test(line.consumptionId)
      ||!Number.isSafeInteger(line.intentIndex)||line.intentIndex<0
      ||line.intentIndex>=input.intentLineCount
      ||!Number.isSafeInteger(line.partIndex)||line.partIndex<0
      ||normalizeWarehouseQuantity(line.requestedQuantity)!==line.requestedQuantity
      ||normalizeWarehouseQuantity(line.baseQuantity)!==line.baseQuantity
      ||line.baseQuantity<=0||line.requestedQuantity<=0
      ||!Number.isFinite(line.originalRequestedQuantity)||line.originalRequestedQuantity<=0
      ||!Number.isFinite(line.factorToBaseUnit)||line.factorToBaseUnit<=0
      ||typeof line.originalPresentationCode!=='string'
      ||!validateWarehouseStockPosition(line.position)
      ||line.position.kind==='UNASSIGNED'
      ||(line.lotId!==null&&!/^lot_[a-f0-9]{32}$/.test(line.lotId))
      ||(line.barcodeId!==null&&!/^bar_[a-f0-9]{64}$/.test(line.barcodeId)))
      return reject();
    const key=line.intentIndex+':'+line.partIndex;
    if(unique.has(key)||unique.has(line.lineId))return reject();
    unique.add(key);unique.add(line.lineId);
    const parts=perIntent.get(line.intentIndex)||[];
    parts.push(line.partIndex);perIntent.set(line.intentIndex,parts);
  }
  if(perIntent.size!==input.intentLineCount)return reject();
  for(const parts of perIntent.values()) {
    parts.sort((a,b)=>a-b);
    if(parts.some((part,index)=>part!==index))return reject();
  }
  return manifest;
}
async function getDocs(token:string,names:string[]) {
  const rows=new Map<string,WarehouseAdminDocument|null>();
  for(let start=0;start<names.length;start+=30) {
    const part=await warehouseAdminBatchRead(token,names.slice(start,start+30));
    for(const [key,row] of part)rows.set(key,row);
  }
  return rows;
}
export async function auditWarehouseAtomicWithdrawalReplay(
  access:VerifiedWarehouseRequest,token:string,withdrawalId:string,
  header:WarehouseAdminDocument,
  options:
    |{version:2;lines:WarehouseWithdrawalLineInput[]}
    |{version:3;intentHash:string;intentLineCount:number},
):Promise<FinalizeWarehouseMaterialWithdrawalResult>{
  const h=header.data,ws=access.workspaceId;
  if(h.id!==withdrawalId||h.workspaceId!==ws||h.ug!==access.ug
    ||h.atomicVersion!==options.version||h.schemaVersion!=='warehouse_material_withdrawal_v1'
    ||h.status!=='FINALIZED'
    ||typeof h.createdBy!=='string'||!h.createdBy
    ||typeof h.withdrawnBy!=='string'||!h.withdrawnBy
    ||typeof h.destinationId!=='string'||!/^dest_[a-f0-9]{32}$/.test(h.destinationId)
    ||typeof h.payloadHash!=='string'||! /^[a-f0-9]{64}$/.test(h.payloadHash))
    return reject();

  let expected:WarehouseWithdrawalEffectLine[];
  if(options.version===3){
    if(h.payloadHash!==options.intentHash||h.intentLineCount!==options.intentLineCount)return reject();
    expected=parseManifest(h,{withdrawalId,intentHash:options.intentHash,
      intentLineCount:options.intentLineCount}).lines;
  } else {
    if(h.expectedLineCount!==options.lines.length||h.appliedLineCount!==options.lines.length)
      return reject();
    expected=await Promise.all(options.lines.map(async(line,index)=>({
      lineId:line.lineId,intentIndex:index,partIndex:0,materialId:line.materialId,
      position:line.position,lotId:line.lotId,barcodeId:line.barcodeAssociation?.id||null,
      requestedQuantity:line.requestedQuantity,baseQuantity:line.baseQuantity,
      originalRequestedQuantity:line.requestedQuantity,
      originalPresentationCode:line.presentation.code,factorToBaseUnit:
        line.requestedQuantity?line.baseQuantity/line.requestedQuantity:1,
      movementId:await createWarehouseMovementId(ws,'material-withdrawal:'+withdrawalId+':'+line.lineId),
      consumptionId:'cons_'+hash(ws+'\n'+'stock:'+withdrawalId+':'+line.lineId),
    })));
  }
  const names=expected.flatMap(line=>[
    doc(ws,'movements',line.movementId),doc(ws,'consumptions',line.consumptionId)]);
  if(new Set(names).size!==names.length)return reject();
  const rows=await getDocs(token,names);
  for(const line of expected) {
    const m=rows.get(doc(ws,'movements',line.movementId))?.data;
    const c=rows.get(doc(ws,'consumptions',line.consumptionId))?.data;
    const s=m?.source as Record<string,unknown>|undefined;
    if(!m||!c||m.id!==line.movementId||m.workspaceId!==ws||m.ug!==access.ug
      ||m.materialId!==line.materialId||m.type!=='OUTBOUND'
      ||!sameNumber(m.quantityDelta,-line.baseQuantity)
      ||m.idempotencyKeyHash!==line.movementId.slice(4)
      ||s?.kind!=='EXPRESS_OUTBOUND'||s.actorUid!==h.createdBy
      ||!sameNumber(s.quantity,line.baseQuantity)
      ||!sameNumber(s.requestedQuantity,line.requestedQuantity)
      ||s.lotId!==(line.lotId??null)
      ||s.barcodeId!==(line.barcodeId??null)
      ||!warehouseStockPositionsEqual(s.position as WarehouseWithdrawalLineInput['position'],line.position)
      ||c.id!==line.consumptionId||c.workspaceId!==ws||c.ug!==access.ug
      ||c.origin!=='STOCK_OUTBOUND'||c.materialId!==line.materialId
      ||c.withdrawalId!==withdrawalId||c.lineId!==line.lineId
      ||c.movementId!==line.movementId||c.operatorUid!==h.createdBy
      ||c.destinationId!==h.destinationId||c.withdrawnBy!==h.withdrawnBy
      ||!sameNumber(c.quantity,line.baseQuantity)
      ||!sameNumber(c.requestedQuantity,line.requestedQuantity)
      ||!['PENDING','PREPARED','POSTED'].includes(String(c.siscofisStatus)))
      return reject();
  }
  return {withdrawal:h as unknown as WarehouseMaterialWithdrawal,movementIds:[]};
}
