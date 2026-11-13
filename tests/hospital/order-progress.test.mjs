import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getOrderProgress,ORDER_STEPS} from '../../features/hospital/integration/order-progress.mjs';

const draft={status:'DRAFT',submittedAt:null};
const sent={status:'SUBMITTED',submittedAt:'2026-11-13T10:00:00Z'};
const received={...sent,receivedAt:'2026-11-13T10:05:00Z'};
const rows=(...statuses)=>statuses.map(status=>({status}));
test('five stages only follow persisted backend events',()=>{
 assert.equal(ORDER_STEPS.length,5);
 assert.equal(getOrderProgress(draft,rows('REQUESTED')).stage,-1);
 assert.equal(getOrderProgress(sent,rows('REQUESTED')).stage,0);
 assert.equal(getOrderProgress(received,rows('REQUESTED')).stage,1);
 assert.equal(getOrderProgress(received,rows('PREPARING')).stage,2);
 assert.equal(getOrderProgress(received,rows('READY')).stage,2);
 assert.equal(getOrderProgress(received,rows('DISPATCHED')).stage,3);
 assert.equal(getOrderProgress(received,rows('RECEIVED_BY_UNIT')).stage,3);
 assert.equal(getOrderProgress(received,rows('DELIVERED')).stage,4);
});
test('never confirms an entire map from one delivered meal',()=>{
 const result=getOrderProgress(received,rows('DELIVERED','REQUESTED'));
 assert.equal(result.stage,3);
 assert.equal(result.partial,true);
 assert.equal(result.delivered,1);
 assert.equal(result.completed,false);
});
test('blocked meals and map with zero meals are never completed',()=>{
 assert.notEqual(getOrderProgress(received,rows('DELIVERED','SAFETY_BLOCKED')).stage,4);
 assert.equal(getOrderProgress(received,rows()).completed,false);
 assert.equal(getOrderProgress(received,rows('READY','SUSPENDED')).problems,1);
});
test('a kitchen read without explicit receipt is NOT a confirmation',()=>{
 const result=getOrderProgress(sent,rows('REQUESTED'));
 assert.match(result.headline,/Aguardando confirmação/);
 assert.equal(result.received,false);
});
