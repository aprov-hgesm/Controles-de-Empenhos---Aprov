import {
  normalizeWarehouseLocationQuantity,
  warehouseStockPositionKey,
  type WarehouseStockPosition,
} from './location';

/**
 * Contrato puro para a futura exclusão com retorno ao recebimento.
 * Não modifica documentos. Jamais soma lotes como estoque independente:
 * locationBalances é a autoridade quantitativa; lotes são rastreabilidade.
 */
export interface DepotReturnBalance {
  id:string;
  materialId:string;
  position:WarehouseStockPosition;
  quantity:number;
}
export interface DepotReturnLot {
  id:string;
  materialId:string;
  position:WarehouseStockPosition;
  status:'active'|'inactive';
  quantity:number;
  code:string;
  expiresOn:string|null;
}
export interface DepotReturnRow {
  materialId:string;
  sourceBalanceId:string;
  sourcePosition:Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>;
  quantity:number;
  lotReferences:Array<Pick<DepotReturnLot,'id'|'quantity'|'code'|'expiresOn'>>;
}
export class DepotReturnPlanError extends Error {
  constructor(public readonly code:string){
    super(code);this.name='DepotReturnPlanError';
  }
}
const fail=(code:string):never=>{throw new DepotReturnPlanError(code);};
const eps=0.000001;

export function planDepotReturnToReceiving(
  depotId:string,balances:readonly DepotReturnBalance[],lots:readonly DepotReturnLot[]
):DepotReturnRow[] {
  if(!/^dep_[a-f0-9]{32}$/.test(depotId))return fail('WAREHOUSE_DEPOT_RETURN_INVALID_DEPOT');
  const materialPosition=(m:string,p:WarehouseStockPosition)=>m+'|'+warehouseStockPositionKey(p);
  const relevant=(p:WarehouseStockPosition)=>p.kind!=='UNASSIGNED'&&p.depotId===depotId;
  const rows=new Map<string,DepotReturnRow>();
  const balanceIds=new Set<string>();
  for(const entry of balances){
    if(!relevant(entry.position))continue;
    const quantity=normalizeWarehouseLocationQuantity(entry.quantity);
    if(quantity===null||quantity<0)return fail('WAREHOUSE_DEPOT_RETURN_INVALID_BALANCE');
    if(quantity===0)continue;
    if(!/^mat_[a-f0-9]{32}$/.test(entry.materialId)
      ||!/^locbal_[a-f0-9]{64}$/.test(entry.id)
      ||balanceIds.has(entry.id))return fail('WAREHOUSE_DEPOT_RETURN_BALANCE_CONFLICT');
    balanceIds.add(entry.id);
    const pos=entry.position as Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>;
    const key=materialPosition(entry.materialId,pos);
    if(rows.has(key))return fail('WAREHOUSE_DEPOT_RETURN_DUPLICATE_POSITION');
    rows.set(key,{materialId:entry.materialId,sourceBalanceId:entry.id,
      sourcePosition:pos,quantity,lotReferences:[]});
  }
  const lotIds=new Set<string>();
  for(const entry of lots){
    if(!relevant(entry.position)||entry.status!=='active')continue;
    const quantity=normalizeWarehouseLocationQuantity(entry.quantity);
    if(quantity===null||quantity<0)return fail('WAREHOUSE_DEPOT_RETURN_INVALID_LOT');
    if(quantity===0)continue;
    if(!/^mat_[a-f0-9]{32}$/.test(entry.materialId)
      ||!/^lot_[a-f0-9]{32}$/.test(entry.id)
      ||lotIds.has(entry.id))return fail('WAREHOUSE_DEPOT_RETURN_LOT_CONFLICT');
    lotIds.add(entry.id);
    const row=rows.get(materialPosition(entry.materialId,entry.position));
    if(!row)return fail('WAREHOUSE_DEPOT_RETURN_LOT_WITHOUT_STOCK');
    row.lotReferences.push({id:entry.id,quantity,code:entry.code,expiresOn:entry.expiresOn});
  }
  for(const row of rows.values()){
    const lotsQty=row.lotReferences.reduce((sum,lot)=>sum+lot.quantity,0);
    if(lotsQty>row.quantity+eps)
      return fail('WAREHOUSE_DEPOT_RETURN_LOT_EXCEEDS_STOCK');
    row.lotReferences.sort((a,b)=>a.id.localeCompare(b.id));
  }
  return [...rows.values()].sort((a,b)=>a.materialId.localeCompare(b.materialId)
    ||a.sourceBalanceId.localeCompare(b.sourceBalanceId));
}
