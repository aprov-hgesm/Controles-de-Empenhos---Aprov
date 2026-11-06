import test from 'node:test';
import assert from 'node:assert/strict';
import {toVerifiedDeliveryCandidate} from './deliveryCandidates.mjs';
const record={id:'delivery_1',kind:'delivery',companyId:'A',workspaceId:'A',
  deliveryState:'planned',customerOrderId:'order_1',customerOrderLineId:'line_1',
  destination:{address:'Rua A',confirmed:true},quantity:{value:'2.500',unit:'UN'}};
test('project W9 delivery without inventing coordinate or ETA',()=>{
 const c=toVerifiedDeliveryCandidate(record,'A');assert.equal(c.deliveryId,'delivery_1');
 assert.equal(c.quantity.value,'2.500');assert.equal(c.destination.latitude,undefined);
 assert.equal(c.estimatedArrival,undefined);
});
test('foreign tenant and unconfirmed destination fail closed',()=>{
 for(const r of [{...record,companyId:'B'},{...record,workspaceId:'B'},
  {...record,destination:{address:'Rua A',confirmed:false}},
  {...record,kind:'delivery_quota'},{...record,deliveryState:'delivered'}])
  assert.equal(toVerifiedDeliveryCandidate(r,'A'),null);
});
test('only confirmed coordinates are transmitted',()=>{
 let c=toVerifiedDeliveryCandidate({...record,destination:{...record.destination,
   latitude:-29,longitude:-53,coordinateSource:'operator'}},'A');
 assert.equal(c.destination.latitude,-29);
 c=toVerifiedDeliveryCandidate({...record,destination:{...record.destination,
   latitude:900,longitude:-53,coordinateSource:'operator'}},'A');
 assert.equal(c.destination.latitude,undefined);
});
