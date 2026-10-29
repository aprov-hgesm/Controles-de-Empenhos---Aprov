/**
 * Reconciliacao leve do carrinho Desktop usando saldo e validades atualizados.
 * A selecao de lotes aqui e apenas uma previsualizacao: o servidor transacional
 * continua sendo a autoridade para autorizar e efetivar toda baixa.
 */
import { planMobileOutboundAutomaticLots } from './mobileOutboundPlan.mjs';

const qty=(n)=>Math.round((n+Number.EPSILON)*1e6)/1e6;

export function replanDesktopWithdrawalCart(lines, snapshots, createLineId, maxLines=40) {
  if(!Array.isArray(lines)||!lines.length||typeof createLineId!=='function')
    throw Error('WAREHOUSE_WITHDRAWAL_CART_INVALID');
  const planned=[];
  const reservedMaterial=new Map();
  const reservedPosition=new Map();
  const reservedLot=new Map();
  for(const line of lines) {
    const current=snapshots[line.materialId];
    if(!current)throw Error('WAREHOUSE_WITHDRAWAL_STOCK_REFRESH_REQUIRED');
    const materialId=line.materialId;
    const key=JSON.stringify(line.position);
    const positionKey=materialId+'|'+key;
    const position=current.positions.find(p=>JSON.stringify(p.position)===key);
    const amount=qty(line.baseQuantity);
    if(!position||position.quantity<=0||!Number.isFinite(amount)||amount<=0)
      throw Error('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
    const materialAvailable=qty(current.globalQuantity-(reservedMaterial.get(materialId)||0));
    const physicalAvailable=qty(position.quantity-(reservedPosition.get(positionKey)||0));
    if(amount>materialAvailable+1e-6)throw Error('WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK');
    if(amount>physicalAvailable+1e-6)throw Error('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
    const remainingLots=current.lots
      .filter(lot=>JSON.stringify(lot.position)===key)
      .map(lot=>({...lot,quantity:qty(lot.quantity-(reservedLot.get(lot.id)||0))}));
    const allocation=planMobileOutboundAutomaticLots({
      quantity:amount,physicalQuantity:physicalAvailable,lots:remainingLots,
    });
    for(let i=0;i<allocation.length;i++) {
      const part=allocation[i];
      const linked=remainingLots.find(lot=>lot.id===part.lotId);
      const same=i===0 && allocation.length===1 &&
        line.lotId===part.lotId && Math.abs(line.baseQuantity-part.quantity)<1e-6
        && line.lotCode===(linked?.code||null);
      planned.push({
        ...line,
        lineId:same?line.lineId:createLineId(),
        baseQuantity:part.quantity,requestedQuantity:part.quantity,
        lotId:part.lotId,lotCode:linked?.code||null,
        availableAtPosition:position.quantity,
        availableBalance:current.globalQuantity,
      });
      if(part.lotId)reservedLot.set(part.lotId,
        qty((reservedLot.get(part.lotId)||0)+part.quantity));
    }
    reservedMaterial.set(materialId,qty((reservedMaterial.get(materialId)||0)+amount));
    reservedPosition.set(positionKey,qty((reservedPosition.get(positionKey)||0)+amount));
    if(planned.length>maxLines)throw Error('WAREHOUSE_WITHDRAWAL_LINE_LIMIT');
  }
  const changed=planned.length!==lines.length||planned.some((line,i)=>(
    line.lineId!==lines[i]?.lineId||line.lotId!==lines[i]?.lotId
    ||line.lotCode!==lines[i]?.lotCode||line.baseQuantity!==lines[i]?.baseQuantity
  ));
  return {lines:planned,changed};
}
