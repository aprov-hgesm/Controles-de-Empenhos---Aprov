import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedStopForDelivery } from './approvedRoute.mjs';
const delivery = {id:'delivery_1',companyId:'A',workspaceId:'A',
 customerOrderId:'order_1',customerOrderLineId:'line_1',driverUid:'driver_a',
 destination:{address:'Rua A'},quantity:{value:'2',unit:'UN'}};
function route(){
 return {status:'approved',approvedByHuman:true,approvedByUid:'planner_1',
  stops:[{candidateDeliveryId:delivery.id,vehicleId:'van_1',sequence:1}],
  unassigned:[],vehicles:[{id:'van_1',driverUid:'driver_a'}],
  candidates:[{deliveryId:delivery.id,companyId:'A',workspaceId:'A',
   customerOrderId:'order_1',customerOrderLineId:'line_1',
   destination:{address:'Rua A',confirmed:true},quantity:{value:'2',unit:'UN'}}]};
}
test('approved, matching W9 delivery allows attaching a route without dispatch',()=>{
 assert.deepEqual(approvedStopForDelivery(route(),delivery),{ok:true,sequence:1,vehicleId:'van_1'});
});
test('draft, missing human approval and absent approver fail closed',()=>{
 for(const patch of [{status:'draft'},{approvedByHuman:false},{approvedByUid:''}]){
  assert.equal(approvedStopForDelivery({...route(),...patch},delivery).code,'ROUTE_NOT_APPROVED');
 }
});
test('unassigned or absent stop never attaches',()=>{
 for(const patch of [{stops:[]},{unassigned:[{candidateDeliveryId:'delivery_1',reason:'janela'}]}]){
  assert.equal(approvedStopForDelivery({...route(),...patch},delivery).code,'ROUTE_STOP_NOT_APPROVED');
 }
});
test('cross-company and stale order, amount or address fail closed',()=>{
 const changes=[{companyId:'B'},{workspaceId:'B'},{customerOrderId:'order_fake'},
  {customerOrderLineId:'line_fake'},{quantity:{value:'3',unit:'UN'}},
  {destination:{address:'Rua B',confirmed:true}},
  {destination:{address:'Rua A',confirmed:false}}];
 for(const c of changes){const p=route();p.candidates[0]={...p.candidates[0],...c};
  assert.equal(approvedStopForDelivery(p,delivery).code,'ROUTE_CANDIDATE_STALE');
 }
});
test('vehicle driver mismatch fails closed',()=>{
 const p=route();p.vehicles[0].driverUid='driver_b';
 assert.equal(approvedStopForDelivery(p,delivery).code,'ROUTE_DRIVER_MISMATCH');
});
