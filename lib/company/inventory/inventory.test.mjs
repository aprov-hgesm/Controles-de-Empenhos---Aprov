import test from 'node:test';
import assert from 'node:assert/strict';
import {InventoryError,parseMilli,decimal,asQuantity,blankStock,blankOrder,blankLink,
  blankInbound,applyInventoryCommand} from './engine.mjs';

const run=(kind,q,stock,order,link,inbound=null,demand='0',reason)=>{
 return applyInventoryCommand({command:{kind,canonicalQuantity:q,reason},stock,order,link,inbound,orderLimit:demand});
};
const order=(id='SKU')=>blankOrder(id,'KG');
test('W7: decimal exact, rational conversion, no floats/implicit conversion',()=>{
 assert.equal(parseMilli('0.001'),1n);assert.equal(decimal(123456n),'123.456');
 assert.equal(asQuantity({value:'3',unit:'CX'},'UN',{from:'CX',to:'UN',numerator:10,denominator:1}),30000n);
 assert.throws(()=>asQuantity({value:'1',unit:'CX'},'KG'),/CONVERSION_REQUIRED/);
 assert.throws(()=>asQuantity({value:'0.001',unit:'CX'},'KG',{from:'CX',to:'KG',numerator:1,denominator:2}),/CONVERSION_NOT_EXACT/);
 for(const q of ['-1','1.0001','1e5','NaN',' 1','1000000000000'])assert.throws(()=>parseMilli(q),InventoryError);
});
test('W7: manual adjusted stock is never negative and reservations cannot double spend',()=>{
 const s=run('adjust_in','5',blankStock(),order(),blankLink('stock'),null,'0','conferência manual verificada').stock;
 const a=run('reserve','5',s,order(),blankLink('stock'),null,'5');
 assert.equal(a.stock.onHand,'5');assert.equal(a.stock.reserved,'5');
 assert.throws(()=>run('reserve','1',a.stock,a.order,a.link,null,'5'),/INSUFFICIENT_QUANTITY/);
 assert.throws(()=>run('adjust_out','1',a.stock,a.order,a.link,null,'5','ajuste com justificativa'),/INSUFFICIENT_QUANTITY/);
 assert.throws(()=>run('adjust_in','1',s,order(),blankLink('stock'),null,'0','curto'),/REASON_REQUIRED/);
});
test('W7: pedido 500 = 100 físico + 300 origem A + 100 origem B; inTransit is not on-hand',()=>{
 const physical=run('adjust_in','100',blankStock(),order(),blankLink('stock'),null,'0','inventário físico confirmado').stock;
 const stockAllocation=run('reserve','100',physical,order(),blankLink('stock'),null,'500');
 const inboundA=blankInbound('300'),inboundB=blankInbound('100');
 const a=run('plan_purchase','300',stockAllocation.stock,stockAllocation.order,blankLink('purchase'),inboundA,'500');
 const b=run('plan_purchase','100',a.stock,a.order,blankLink('purchase'),inboundB,'500');
 assert.deepEqual([b.order.stockReserved,b.order.purchasePlanned,b.stock.onHand,b.stock.reserved],['100','400','100','100']);
 assert.equal(a.inbound.allocated,'300');assert.equal(b.inbound.allocated,'100');
 assert.throws(()=>run('plan_purchase','1',b.stock,b.order,blankLink('purchase'),blankInbound('10'),'500'),/INSUFFICIENT_QUANTITY/);
});
test('W7: uma compra de 500 atende duas OMs de 200/300 sem sobrealocar fornecedor',()=>{
 let inbound=blankInbound('500');
 const first=run('plan_purchase','200',blankStock(),order(),blankLink('purchase'),inbound,'200');
 inbound=first.inbound;
 const second=run('plan_purchase','300',first.stock,order(),blankLink('purchase'),inbound,'300');
 inbound=second.inbound;
 assert.equal(inbound.allocated,'500');
 assert.throws(()=>run('plan_purchase','1',second.stock,order(),blankLink('purchase'),inbound,'50'),/INSUFFICIENT_QUANTITY/);
});
test('W7: dispatch parcial, retorno e estorno sem apagar evento',()=>{
 const seed=run('adjust_in','10',blankStock(),order(),blankLink('stock'),null,'0','saldo contado manualmente');
 const reserved=run('reserve','6',seed.stock,order(),blankLink('stock'),null,'10');
 const sent=run('dispatch','2',reserved.stock,reserved.order,reserved.link,null,'10');
 assert.deepEqual([sent.stock.onHand,sent.stock.reserved,sent.order.dispatched,sent.order.stockReserved],['8','4','2','4']);
 const returned=run('return','1',sent.stock,sent.order,sent.link,null,'10');
 assert.deepEqual([returned.stock.onHand,returned.order.dispatched,returned.link.dispatched],['9','1','1']);
 const released=run('release','2',returned.stock,returned.order,returned.link,null,'10');
 assert.equal(released.stock.reserved,'2');
 assert.throws(()=>run('return','9',released.stock,released.order,released.link,null,'10'),/INSUFFICIENT_QUANTITY/);
});
test('W7: recebimento real da compra não confirma pedido; entrega direta não movimenta saldo físico',()=>{
 const purchase=blankInbound('5');
 const received=run('receive_purchase','2',blankStock(),order(),blankLink('purchase'),purchase,'0');
 assert.equal(received.stock.onHand,'2');
 assert.equal(received.order.dispatched,'0');
 const planned=run('plan_purchase','3',received.stock,order(),blankLink('purchase'),received.inbound,'3');
 const direct=run('direct_dispatch','2',planned.stock,planned.order,planned.link,planned.inbound,'3');
 assert.deepEqual([direct.stock.onHand,direct.stock.reserved,direct.order.dispatched,direct.order.purchasePlanned],['2','0','2','1']);
 assert.equal(direct.inbound.directDispatched,'2');
 assert.throws(()=>run('direct_dispatch','2',direct.stock,direct.order,direct.link,direct.inbound,'3'),InventoryError);
});
test('W7: compra recebida pode ser convertida em reserva física, expedida e devolvida',()=>{
 const received=run('receive_purchase','5',blankStock(),order(),blankLink('purchase'),blankInbound('5'),'0');
 const planned=run('plan_purchase','5',received.stock,order(),blankLink('purchase'),received.inbound,'5');
 const converted=run('convert_purchase','3',planned.stock,planned.order,planned.link,planned.inbound,'5');
 assert.deepEqual([converted.stock.onHand,converted.stock.reserved,converted.order.purchasePlanned,converted.order.stockReserved],['5','3','2','3']);
 const dispatched=run('dispatch_converted','2',converted.stock,converted.order,converted.link,converted.inbound,'5');
 assert.deepEqual([dispatched.stock.onHand,dispatched.stock.reserved,dispatched.order.dispatched],['3','1','2']);
 const returned=run('return_converted','1',dispatched.stock,dispatched.order,dispatched.link,dispatched.inbound,'5');
 assert.equal(returned.stock.onHand,'4');
});
test('W7: nenhum estado aceita reserva acima da demanda, estoque ou compra',()=>{
 const stock={kind:'stock_projection',onHand:'2',reserved:'3'};
 assert.throws(()=>run('reserve','1',stock,order(),blankLink('stock'),null,'10'),InventoryError);
 assert.throws(()=>run('plan_purchase','6',blankStock(),order(),blankLink('purchase'),blankInbound('5'),'10'),InventoryError);
 assert.throws(()=>run('receive_purchase','6',blankStock(),order(),blankLink('purchase'),blankInbound('5'),'0'),InventoryError);
});
