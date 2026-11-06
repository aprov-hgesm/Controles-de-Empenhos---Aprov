import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDraft,parseChange,transition,convertedMilli,needFromOrderLine,PurchaseError} from './domain.ts';
const q=(value,unit='UN')=>({value,unit});
const conversion={from:'UN',to:'UN',numerator:1,denominator:1};
const draft=()=>({
  sourceSupplierId:'sup_a',reference:'OC-2026-0001',desiredAt:'2026-12-01T12:00:00Z',
  lines:[{id:'item_1',catalogItemId:'cat_a',supplierSku:'SKU1',description:'Produto de QA',
    quantity:q('400'),conversion,unitPriceCents:3200,
    priceEvidence:{reference:'Cotação real revisada',quotedAt:'2026-11-05T12:00:00Z'},
    allocations:[{customerOrderId:'order_a',customerOrderLineId:'line_a',quantity:q('200')},
      {customerOrderId:'order_b',customerOrderLineId:'line_b',quantity:q('200')}]}]
});
const order=()=>{
  const p=parseDraft(draft());
  return {schemaVersion:'company-r1-v1',id:'po_test',companyId:'company_a',workspaceId:'company_a',
    status:'draft',createdByUid:'uA',createdAt:'2026-11-05T12:00:00Z',updatedAt:'2026-11-05T12:00:00Z',
    revision:1,reference:p.reference,sourceSupplierId:p.sourceSupplierId,workflowState:'draft',
    desiredAt:{value:p.desiredAt,basis:'requested',source:'user',updatedAt:'2026-11-05T12:00:00Z'},
    history:[],lines:p.lines.map(l=>({...l,confirmedQuantity:q('0'),receivedQuantity:q('0')}))};
};
const run=(p,input)=>transition(p,parseChange(input),'uA','2026-11-05T15:00:00Z','event_1','idemp_key_test_01');
test('demanda W1 sem W7 informa falta bruta mas nunca inventa estoque líquido',()=>{
  const result=needFromOrderLine('order_a',{id:'line_a',quantity:q('500'),fulfilledQuantity:q('75')});
  assert.equal(result.outstanding.value,'425');assert.equal(result.netShortage,null);
  assert.equal(result.requiresW7Reconciliation,true);
});
test('compra para várias OMs e fatores exatos',()=>{
  assert.equal(parseDraft(draft()).lines[0].allocations.length,2);
  assert.equal(convertedMilli(q('25'),{from:'UN',to:'UN',numerator:2,denominator:1}),50000n);
  assert.throws(()=>convertedMilli(q('0.001'),{from:'UN',to:'UN',numerator:1,denominator:2}),
    e=>e instanceof PurchaseError&&e.code==='INEXACT_CONVERSION');
});
test('compra não aceita alocação que excede quantidade ou preço inválido',()=>{
  const d=draft();d.lines[0].allocations[0].quantity=q('300');
  assert.throws(()=>parseDraft(d),e=>e.code==='ALLOCATION_EXCEEDS_PURCHASE');
  const d2=draft();d2.lines[0].unitPriceCents=1.5;
  assert.throws(()=>parseDraft(d2),e=>e.code==='INVALID_PRICE');
});
test('400 solicitadas, 250 confirmadas, zero recebidas',()=>{
  const sent=run(order(),{action:'sent',expectedRevision:1,channel:'email',confirmationRef:'EMAIL-001',confirmedByOperator:true}).order;
  const reply=run(sent,{action:'reply',expectedRevision:2,reference:'SUP-001',
    confirmed:[{lineId:'item_1',quantity:q('250')}],promisedAt:'2026-12-08T12:00:00Z'});
  assert.equal(reply.order.workflowState,'partially_confirmed');
  assert.equal(reply.order.lines[0].receivedQuantity.value,'0');
  assert.equal(reply.order.lines[0].confirmedQuantity.value,'250');
  assert.equal(reply.order.desiredAt.value,'2026-12-01T12:00:00Z');
  assert.equal(reply.order.supplierPromisedAt.value,'2026-12-08T12:00:00Z');
  assert.equal(reply.event.receivedDeltas.length,0);
});
test('recebimento parcial cria somente delta e não lança estoque',()=>{
  const sent=run(order(),{action:'sent',expectedRevision:1,channel:'portal',confirmationRef:'P-1',confirmedByOperator:true}).order;
  const confirmed=run(sent,{action:'reply',expectedRevision:2,reference:'R-1',confirmed:[{lineId:'item_1',quantity:q('250')}]}).order;
  const event=run(confirmed,{action:'receive',expectedRevision:3,reference:'REC-1',received:[{lineId:'item_1',quantity:q('125')}]});
  assert.equal(event.order.workflowState,'partially_received');
  assert.equal(event.order.lines[0].receivedQuantity.value,'125');
  assert.equal(event.event.kind,'purchase.received');
  assert.equal(event.event.receivedDeltas[0].quantity.value,'125');
  assert.equal(event.event.stockPosted,false);
  assert.throws(()=>run(event.order,{action:'receive',expectedRevision:4,reference:'REC-2',
    received:[{lineId:'item_1',quantity:q('126')}]}),e=>e.code==='RECEIPT_EXCEEDS_CONFIRMED');
  assert.throws(()=>run(event.order,{action:'cancel',expectedRevision:4,reference:'Cancelamento'}),
    e=>e.code==='CANNOT_CANCEL_RECEIVED');
});
test('estado, concorrência por revisão, recusa e cancelamento',()=>{
  assert.throws(()=>run(order(),{action:'reply',expectedRevision:1,reference:'Sem envio',
    confirmed:[{lineId:'item_1',quantity:q('0')}]}),e=>e.code==='INVALID_STATE');
  const p=run(order(),{action:'sent',expectedRevision:1,channel:'email',confirmationRef:'EM-1',confirmedByOperator:true}).order;
  assert.throws(()=>run(p,{action:'cancel',expectedRevision:1,reference:'Revisão obsoleta'}),e=>e.code==='CONFLICT');
  const cancelled=run(p,{action:'cancel',expectedRevision:2,reference:'C-1'});
  assert.equal(cancelled.event.kind,'purchase.cancelled');
  const rejected=run(p,{action:'reply',expectedRevision:2,reference:'Não aceita',
    confirmed:[{lineId:'item_1',quantity:q('0')}]});
  assert.equal(rejected.order.workflowState,'rejected');
  assert.equal(rejected.event.kind,'purchase.cancelled');
});
test('prazo fornecedor altera apenas fato inbound e preserva prazo OM',()=>{
  const p=run(order(),{action:'sent',expectedRevision:1,channel:'phone',confirmationRef:'CALL-1',confirmedByOperator:true}).order;
  const changed=run(p,{action:'reschedule',expectedRevision:2,reference:'R-2',promisedAt:'2026-12-15T12:00:00Z'});
  assert.equal(changed.order.desiredAt.value,'2026-12-01T12:00:00Z');
  assert.equal(changed.order.supplierPromisedAt.value,'2026-12-15T12:00:00Z');
  assert.equal(changed.event.kind,'purchase.rescheduled');
});
test('requisição de envio exige confirmação humana verificável',()=>{
  assert.throws(()=>parseChange({action:'sent',expectedRevision:1,channel:'email',confirmationRef:'X'}),
    e=>e.code==='INVALID_INPUT');
});
