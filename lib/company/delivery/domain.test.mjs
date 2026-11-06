import test from 'node:test';
import assert from 'node:assert/strict';
import {DeliveryError,validKey,parseDeliveryDraft,checkDispatchQuota,checkReturnQuota,assessSchedule,
  approvePromise,transitionDelivery} from './domain.mjs';
const q = value => ({value,unit:'KG'});
const base={customerOrderId:'om1',customerOrderLineId:'line1',catalogItemId:'sku1',
  quantity:q('40'),source:'company_stock',destination:{address:'Rua A, 1, Santa Maria',confirmed:true},
  manualSequence:1,driverUid:'uid_driver'};
test('W9: manual delivery requires confirmed destination, positive units, driver and sequence',()=>{
  assert.equal(parseDeliveryDraft(base).quantity.value,'40');
  assert.throws(()=>parseDeliveryDraft({...base,destination:{address:'a',confirmed:false}}),/DESTINATION_UNCONFIRMED/);
  assert.throws(()=>parseDeliveryDraft({...base,routePlanId:'unapproved'}),/ROUTE_PLAN_INTEGRATION_PENDING/);
});
test('W9: exact quantities reject over-dispatch, duplicate allocation and mismatched unit',()=>{
  const model={unit:'KG',demand:q('100'),dispatched:q('70'),alreadyAssigned:q('30'),requested:q('40'),source:'company_stock'};
  assert.equal(checkDispatchQuota(model).remainingDispatched,'0');
  assert.throws(()=>checkDispatchQuota({...model,requested:q('40.001')}),/W7_DISPATCH_INSUFFICIENT/);
  assert.throws(()=>checkDispatchQuota({...model,requested:{value:'20',unit:'UN'}}),/UNIT_MISMATCH/);
});
test('W9: supplier direct requires independent W7 link evidence, not fictitious company stock',()=>{
 const p={unit:'KG',demand:q('500'),dispatched:q('200'),alreadyAssigned:q('0'),
 requested:q('100'),source:'supplier_direct'};
 assert.throws(()=>checkDispatchQuota(p),/DIRECT_DISPATCH_UNVERIFIED/);
 assert.equal(checkDispatchQuota({...p,directEvidence:q('100')}).assigned,'100');
});
test('W9: inbound delay risk does not rewrite a promised OM date or manufacture ETA',()=>{
 const a=assessSchedule({requestedAt:'2026-11-08T15:00:00Z',
 supplierPromisedAt:'2026-11-09T14:00:00Z',dispatched:false,now:'2026-11-06T12:00:00Z'});
 assert.equal(a.risk,'at_risk');assert.equal(a.eta,null);
 assert.ok(a.reasons.includes('SUPPLIER_AFTER_OM_WINDOW'));
 assert.throws(()=>approvePromise(null,'2026-11-10T12:00:00Z',{approved:false}),/HUMAN_APPROVAL_REQUIRED/);
 assert.equal(approvePromise(null,'2026-11-10T12:00:00Z',
   {approved:true,approvedByUid:'operador',reason:'OM confirmou mudança',approvedAt:'2026-11-06T12:00:00Z'}).next,'2026-11-10T12:00:00Z');
});
test('W9: shipment evidence and transitions never record atesto or payment',()=>{
 const rec={...base,quantity:q('40'),deliveryState:'planned',revision:1,history:[]};
 const c=transitionDelivery(rec,{kind:'collected'},'driver','2026-11-06T12:00:00Z');
 const d=transitionDelivery(c,{kind:'departed'},'driver','2026-11-06T13:00:00Z');
 const p=transitionDelivery(d,{kind:'partial',deliveredQuantity:q('15'),reason:'Restante recusado',proofDocumentId:'doc1'},'driver','2026-11-06T14:00:00Z');
 assert.equal(p.deliveredQuantity.value,'15');assert.equal(p.history.length,3);
 assert.equal('attested' in p,false);assert.equal('paid' in p,false);
 assert.throws(()=>transitionDelivery(p,{kind:'delivered',proofDocumentId:'doc1'},'driver','2026-11-06T15:00:00Z'),/INVALID_DELIVERY_TRANSITION/);
});
test('W9: proof required on refusal, damage and return; no invented real delivery',()=>{
 const r={...base,quantity:q('10'),deliveryState:'departed',revision:3,history:[]};
 assert.throws(()=>transitionDelivery(r,{kind:'delivered'},'d','2026-11-06T14:00:00Z'),/INVALID_ID/);
 const damaged=transitionDelivery(r,{kind:'damaged',reason:'Caixa danificada',proofDocumentId:'photo1'},'d','2026-11-06T14:00:00Z');
 assert.equal(transitionDelivery(damaged,{kind:'returned',reason:'Devolução ao depósito',proofDocumentId:'photo2'},'d','2026-11-06T15:00:00Z').deliveryState,'returned');
});
test('W9: idempotency key format',()=>{assert.equal(validKey('w9-test-001'),'w9-test-001');assert.throws(()=>validKey('a'),DeliveryError);});

test('W9: W7 returns must cover outstanding shipment and cannot be reused',()=>{
 const q2=value=>({value,unit:'KG'});
 const input={shipment:q2('40'),delivered:q2('15'),returnEventQuantity:q2('30'),alreadyAssigned:q2('0')};
 assert.equal(checkReturnQuota(input).credited,'25');
 assert.throws(()=>checkReturnQuota({...input,alreadyAssigned:q2('6')}),/W7_RETURN_QUANTITY_INSUFFICIENT/);
 assert.throws(()=>checkReturnQuota({...input,returnEventQuantity:{value:'30',unit:'UN'}}),/UNIT_MISMATCH/);
});
