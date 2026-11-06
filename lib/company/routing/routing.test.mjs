import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateOf,vehicleOf,manualProposal,reorderStops,approvePlan,externalNavigation,RoutingError}
 from '../geo/core.mjs';
import {createProviderTransport} from '../geo/providerTransport.mjs';
const scope='qa-company-A';
const now='2026-11-06T08:00:00.000Z',later='2026-11-06T17:00:00.000Z';
const vehicle=(id,cap=100)=>({id,origin:{latitude:-29.6842,longitude:-53.8069,coordinateSource:'operator'},
 capacity:{weightKg:cap},shift:{start:now,end:later},breaks:[]});
const dest=(n,opts={})=>({companyId:scope,workspaceId:scope,deliveryId:'delivery_'+n,
 customerOrderId:'order_'+n,customerOrderLineId:'line_'+n,
 destination:{address:'Rua de Teste numero '+n+', Santa Maria RS',confirmed:true,
 latitude:-29.68+n/1000,longitude:-53.8+n/1000,coordinateSource:'operator'},
 quantity:{value:'1',unit:'UN'},weightKg:25,unloadMinutes:10,...opts});
const candidates=[1,2,3,4,5].map(n=>dest(n));
const vehicles=[vehicle('truck_1',100),vehicle('truck_2',100)];
const assignments=[1,2,3,4].map(n=>({candidateDeliveryId:'delivery_'+n,
 vehicleId:n<=2?'truck_1':'truck_2'}));
const plan=()=>manualProposal({companyId:scope,workspaceId:scope,candidates,vehicles,assignments});
const throws=(fn,code)=>assert.throws(fn,e=>e instanceof RoutingError&&e.code===code);
test('five OMs, two vehicles: deterministic order, totals and unassigned stop',()=>{
 const p=plan();assert.equal(p.stops.length,4);assert.equal(p.unassigned.length,1);
 assert.deepEqual(p.stops.map(s=>[s.vehicleId,s.sequence]),[
  ['truck_1',1],['truck_1',2],['truck_2',1],['truck_2',2]]);
 assert.deepEqual(p.unassigned,[{candidateDeliveryId:'delivery_5',reason:'NOT_ASSIGNED_BY_OPERATOR'}]);
 assert.equal(p.requiresHumanApproval,true);
 assert.ok(!p.stops.some(s=>'estimatedArrival' in s));
});
test('ambiguous address remains visibly unassigned; no center-of-city geocoding',()=>{
 const p=manualProposal({companyId:scope,workspaceId:scope,vehicles,
  candidates:[dest(1,{destination:{address:'Santa Maria, RS',confirmed:false}})],
  assignments:[{candidateDeliveryId:'delivery_1',vehicleId:'truck_1'}]});
 assert.equal(p.stops.length,0);
 assert.equal(p.unassigned[0].reason,'DESTINATION_NEEDS_HUMAN_CONFIRMATION');
});
test('vehicle capacity 20kg rejects 25kg load',()=>{
 const p=manualProposal({companyId:scope,workspaceId:scope,vehicles:[vehicle('truck_1',20)],
  candidates:[dest(1)],assignments:[{candidateDeliveryId:'delivery_1',vehicleId:'truck_1'}]});
 assert.equal(p.unassigned[0].reason,'CAPACITY_EXCEEDED');
});
test('aggregate capacity overrun is surfaced without hiding stop',()=>{
 const p=manualProposal({companyId:scope,workspaceId:scope,vehicles:[vehicle('truck_1',40)],
  candidates:[dest(1),dest(2)],assignments:[1,2].map(n=>({
   candidateDeliveryId:'delivery_'+n,vehicleId:'truck_1'}))});
 assert.equal(p.stops.length,1);assert.equal(p.unassigned[0].reason,'CAPACITY_EXCEEDED');
});
test('unknown cargo weight denies capacity-verified assignment',()=>{
 const c=dest(2);delete c.weightKg;
 const p=manualProposal({companyId:scope,workspaceId:scope,vehicles,
  candidates:[c],assignments:[{candidateDeliveryId:c.deliveryId,vehicleId:'truck_1'}]});
 assert.equal(p.unassigned[0].reason,'WEIGHT_UNKNOWN');
});
test('incompatible reception window is unassigned',()=>{
 const c=dest(3,{receptionWindow:{start:'2026-11-07T07:00:00.000Z',end:'2026-11-07T08:00:00.000Z'}});
 const p=manualProposal({companyId:scope,workspaceId:scope,vehicles,
  candidates:[c],assignments:[{candidateDeliveryId:c.deliveryId,vehicleId:'truck_1'}]});
 assert.equal(p.unassigned[0].reason,'WINDOW_OUTSIDE_SHIFT');
});
test('unavailable vehicle returns reason and manual still works',()=>{
 const p=manualProposal({companyId:scope,workspaceId:scope,vehicles:[],
  candidates:[dest(1)],assignments:[{candidateDeliveryId:'delivery_1',vehicleId:'missing'}]});
 assert.equal(p.unassigned[0].reason,'NO_VEHICLE');
});
test('two vehicle manual reorder uses per-vehicle sequence and clears ETA',()=>{
 const p=plan(),reordered=reorderStops(p,['delivery_4','delivery_1','delivery_3','delivery_2']);
 assert.deepEqual(reordered.stops.map(s=>[s.candidateDeliveryId,s.sequence]),
  [['delivery_4',1],['delivery_1',1],['delivery_3',2],['delivery_2',2]]);
 assert.equal(reordered.status,'draft');assert.equal(reordered.requiresHumanApproval,true);
 throws(()=>reorderStops(p,['delivery_1','delivery_1','delivery_3','delivery_4']),'INVALID_REORDER');
});
test('strict tenant A/B isolation on candidate and proposal',()=>{
 throws(()=>candidateOf({...dest(1),workspaceId:'qa-company-B'},scope),'COMPANY_SCOPE_FORBIDDEN');
 throws(()=>manualProposal({companyId:scope,workspaceId:'qa-company-B',candidates,vehicles,
  assignments}),'COMPANY_SCOPE_FORBIDDEN');
});
test('coordinate changes require provenance, validation and confirmed status',()=>{
 throws(()=>candidateOf(dest(1,{destination:{
  address:'Rua Exemplo 123',confirmed:true,latitude:91,longitude:-53,coordinateSource:'operator'}}),scope),
  'INVALID_COORDINATE');
 throws(()=>candidateOf(dest(1,{destination:{
  address:'Rua Exemplo 123',confirmed:true,latitude:-29.7,longitude:-53.8}}),scope),
  'COORDINATE_SOURCE_REQUIRED');
 const changed=candidateOf(dest(1,{destination:{
  address:'Rua Exemplo 456',confirmed:false,latitude:-29.7,longitude:-53.8,coordinateSource:'revised'}}),scope);
 assert.equal(changed.destination.confirmed,false);
});
test('strict ISO windows accept canonical UTC milliseconds and reject ambiguous formats',()=>{
 const canonical={start:'2026-11-06T08:00:00.000Z',end:'2026-11-06T12:00:00.000Z'};
 assert.deepEqual(vehicleOf({...vehicle('truck_1'),shift:canonical}).shift,canonical);
 assert.deepEqual(candidateOf(dest(1,{receptionWindow:canonical}),scope).receptionWindow,canonical);
 for(const [start,end] of [
  ['2026-11-06T08:00:00Z','2026-11-06T12:00:00Z'],
  ['2026-11-06T05:00:00.000-03:00','2026-11-06T09:00:00.000-03:00'],
  ['2026-11-06T08:00:00.000Z','2026-11-06T08:00:00.000Z'],
  ['2026-11-06T12:00:00.000Z','2026-11-06T08:00:00.000Z'],
  ['2026-11-06T08:00:00','2026-11-06T12:00:00'],
 ]) {
  throws(()=>vehicleOf({...vehicle('truck_1'),shift:{start,end}}),'INVALID_WINDOW');
  throws(()=>candidateOf(dest(1,{receptionWindow:{start,end}}),scope),'INVALID_WINDOW');
 }
});
test('invalid window and breaks are denied, not guessed',()=>{
 throws(()=>candidateOf(dest(1,{receptionWindow:{start:later,end:now}}),scope),'INVALID_WINDOW');
 throws(()=>vehicleOf({...vehicle('truck_1'),breaks:[{
  start:'2026-11-06T07:00:00.000Z',end:'2026-11-06T08:30:00.000Z'}]}),'BREAK_OUT_OF_SHIFT');
});
test('approval requires revision, acknowledgement and named human confirmation',()=>{
 const p={...plan(),revision:2};
 throws(()=>approvePlan(p,{expectedRevision:1,confirmedUnassignedIds:['delivery_5'],
  confirmedDestinationIds:p.stops.map(s=>s.candidateDeliveryId)}),'REVISION_CONFLICT');
 throws(()=>approvePlan(p,{expectedRevision:2,confirmedUnassignedIds:[],
  confirmedDestinationIds:p.stops.map(s=>s.candidateDeliveryId)}),'UNASSIGNED_ACK_REQUIRED');
 throws(()=>approvePlan(p,{expectedRevision:2,confirmedUnassignedIds:['delivery_5'],
  confirmedDestinationIds:[]}),'DESTINATION_ACK_REQUIRED');
 const approved=approvePlan(p,{expectedRevision:2,confirmedUnassignedIds:['delivery_5'],
  confirmedDestinationIds:p.stops.map(s=>s.candidateDeliveryId)});
 assert.equal(approved.status,'approved');assert.equal(approved.revision,3);
 throws(()=>approvePlan(approved,{expectedRevision:3,confirmedUnassignedIds:['delivery_5'],
  confirmedDestinationIds:p.stops.map(s=>s.candidateDeliveryId)}),'INVALID_APPROVAL');
});
test('Waze and Google links send only confirmed coordinates, never IDs or private data',()=>{
 const d=dest(1).destination;
 const waze=externalNavigation(d,'waze'),google=externalNavigation(d,'google');
 for(const url of [waze,google]){
  assert.equal(new URL(url).protocol,'https:');
  assert.ok(!url.includes('delivery_1')&&!url.includes('order_1')&&!url.includes('Rua'));
  assert.ok(!url.includes('token')&&!url.includes('NF'));
 }
 assert.equal(new URL(waze).hostname,'waze.com');
 assert.equal(new URL(google).hostname,'www.google.com');
 throws(()=>externalNavigation({...d,confirmed:false},'waze'),'UNCONFIRMED_DESTINATION');
 throws(()=>externalNavigation(d,'unknown'),'UNSUPPORTED_NAVIGATION');
});
test('no vehicle capacity, duplicate IDs, unknown assignments and no forced ETA',()=>{
 throws(()=>vehicleOf({...vehicle('truck_1'),capacity:{}}),'CAPACITY_REQUIRED');
 throws(()=>manualProposal({companyId:scope,workspaceId:scope,
  candidates:[dest(1),dest(1)],vehicles,assignments:[]}), 'DUPLICATE_ID');
 throws(()=>manualProposal({companyId:scope,workspaceId:scope,
  candidates:[dest(1)],vehicles,
  assignments:[{candidateDeliveryId:'nonexistent',vehicleId:'truck_1'}]}),'INVALID_ASSIGNMENT');
});

test('mocked provider happy path strips redirects, validates JSON and has timeout',async()=>{
 const calls=[];
 const t=createProviderTransport({fetchImpl:async(url,init)=>{
  calls.push({url,init});return{ok:true,text:async()=>JSON.stringify({code:0,routes:[]})};
 }});
 const result=await t.request('vroom',new URL('https://routing.example/'),{method:'POST',body:'{}'});
 assert.equal(result.code,0);assert.equal(calls.length,1);
 assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.cache,'no-store');
 assert.ok(calls[0].init.signal instanceof AbortSignal);
});
test('provider errors, timeout-like rejection and circuit breaker fail closed',async()=>{
 let now=1000,count=0;
 const t=createProviderTransport({clock:()=>now,fetchImpl:async()=>{
  count++;throw new Error('simulated timeout');}});
 for(let i=0;i<3;i++)await assert.rejects(
  t.request('vroom',new URL('https://routing.example/')),
  err=>err.code==='ROUTING_PROVIDER_UNAVAILABLE');
 await assert.rejects(t.request('vroom',new URL('https://routing.example/')),
  err=>err.code==='PROVIDER_CIRCUIT_OPEN');
 assert.equal(count,3);now+=61000;
 await assert.rejects(t.request('vroom',new URL('https://routing.example/')),
  err=>err.code==='ROUTING_PROVIDER_UNAVAILABLE');
});
test('provider quota prevents exceeding per-instance request budget',async()=>{
 const t=createProviderTransport({limit:1,fetchImpl:async()=>({
  ok:true,text:async()=>JSON.stringify({code:0})
 })});
 await t.request('osrm',new URL('https://routing.example/'));
 await assert.rejects(t.request('osrm',new URL('https://routing.example/')),
  err=>err.code==='PROVIDER_QUOTA_REACHED');
});
