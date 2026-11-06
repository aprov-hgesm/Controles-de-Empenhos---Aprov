import 'server-only';
import {candidateOf,vehicleOf,manualProposal,RoutingError} from '../geo/core.mjs';
/** Optional, operator-configured VROOM/OSRM. No paid services and no client-supplied URLs. */
import {createProviderTransport} from '../geo/providerTransport.mjs';
const transport=createProviderTransport();
function endpoint(name:string){
 const raw=name==='vroom'?process.env.EMPROVEX_COMPANY_VROOM_URL:process.env.EMPROVEX_COMPANY_OSRM_URL;
 if(!raw)return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!u.hostname)
   throw new Error('INVALID_PROVIDER_CONFIG');
  return u;
 }catch{throw new RoutingError('PROVIDER_NOT_CONFIGURED',503);}
}
const request=(name:string,url:URL,init:RequestInit)=>transport.request(name,url,init);
const seconds=(iso:string)=>Math.floor(Date.parse(iso)/1000);
const amount=(n:number,scale:number)=>{
  const v=Math.ceil(n*scale);
  if(!Number.isSafeInteger(v)||v<0)return 0;
  return v;
};
/** VROOM accepts numeric IDs, never internal delivery IDs, addresses, contacts, NE or NF. */
export async function optimizedProposal(scope:string,candidatesInput:unknown,vehiclesInput:unknown){
  const url=endpoint('vroom');
  if(!url)throw new RoutingError('ROUTING_PROVIDER_DISABLED',503);
  if(!Array.isArray(candidatesInput)||candidatesInput.length>50
    ||!Array.isArray(vehiclesInput)||vehiclesInput.length>8)throw new RoutingError('LIMIT_EXCEEDED');
  const candidates=candidatesInput.map(c=>candidateOf(c,scope));
  type RoutingVehicle={id:string;origin:{latitude:number;longitude:number};
    capacity:{weightKg?:number;volumeM3?:number;units?:number};
    shift:{start:string;end:string};breaks:Array<{start:string;end:string}>};
  const vehicles=vehiclesInput.map(v=>vehicleOf(v) as RoutingVehicle);
  // No invented upper bounds. Optimizer only runs with fully declared vehicle dimensions.
  if(vehicles.some(v=>v.capacity.weightKg===undefined||v.capacity.volumeM3===undefined
     ||v.capacity.units===undefined))throw new RoutingError('CAPACITY_UNVERIFIED',409);
  if(new Set(candidates.map(c=>c.deliveryId)).size!==candidates.length
    ||new Set(vehicles.map(v=>v.id)).size!==vehicles.length)throw new RoutingError('DUPLICATE_ID');
  const usable:{candidate:typeof candidates[number];idx:number}[]=[],excluded:{candidateDeliveryId:string;reason:string}[]=[];
  for(const [idx,c] of candidates.entries()){
    if(!c.destination.confirmed||c.destination.latitude===undefined){excluded.push({candidateDeliveryId:c.deliveryId,reason:'DESTINATION_UNCONFIRMED'});continue;}
    if(c.unloadMinutes===undefined){excluded.push({candidateDeliveryId:c.deliveryId,reason:'UNLOAD_DURATION_UNKNOWN'});continue;}
    // VROOM must not silently infer unknown carrying load when any vehicle has a limit.
    if(vehicles.some(v=>(v.capacity.weightKg!==undefined&&c.weightKg===undefined)
        ||(v.capacity.volumeM3!==undefined&&c.volumeM3===undefined)
        ||(v.capacity.units!==undefined&&(c.quantity.unit!=='UN'||!Number.isInteger(Number(c.quantity.value)))))){
      excluded.push({candidateDeliveryId:c.deliveryId,reason:'LOAD_UNVERIFIED'});continue;
    }
    usable.push({candidate:c,idx});
  }
  if(!vehicles.length||!usable.length){
    const proposal=manualProposal({companyId:scope,workspaceId:scope,
      candidates,vehicles,assignments:[]});
    return {...proposal,unassigned:[...excluded,...candidates.filter(c=>!excluded.some(e=>e.candidateDeliveryId===c.deliveryId))
      .map(c=>({candidateDeliveryId:c.deliveryId,reason:'NO_VEHICLE_OR_USABLE_STOP'}))]};
  }
  const jobs=usable.map(({candidate:c,idx})=>({
    id:idx+1,location:[c.destination.longitude,c.destination.latitude],
    service:Math.ceil(c.unloadMinutes!*60),
    ...(c.receptionWindow?{time_windows:[[seconds(c.receptionWindow.start),seconds(c.receptionWindow.end)]]}:{ }),
    amount:[amount(c.weightKg||0,1000),amount(c.volumeM3||0,1000000),
      c.quantity.unit==='UN'?Number(c.quantity.value):0]
  }));
  const fleet=vehicles.map((v,idx)=>({
    id:idx+1,start:[v.origin.longitude,v.origin.latitude],
    capacity:[amount(v.capacity.weightKg!,1000),amount(v.capacity.volumeM3!,1000000),v.capacity.units!],
    time_window:[seconds(v.shift.start),seconds(v.shift.end)],
    ...(v.breaks.length?{breaks:v.breaks.map((b,i)=>({id:i+1,time_windows:[[seconds(b.start),seconds(b.end)]],
      service:0}))}:{})
  }));
  const response=await request('vroom',url,{method:'POST',body:JSON.stringify({vehicles:fleet,jobs})}) as
    {code?:number;routes?:Array<{vehicle:number;steps?:Array<{type?:string;id?:number;arrival?:number;
      duration?:number;distance?:number}>}>;unassigned?:Array<{id?:number}>};
  if(response.code!==0||!Array.isArray(response.routes)||!Array.isArray(response.unassigned))
    throw new RoutingError('PROVIDER_INVALID_RESPONSE',503);
  const taken=new Set<number>(),stops:Array<{candidateDeliveryId:string;vehicleId:string;sequence:number;
    estimatedArrival?:string;estimatedTravelMinutes?:number;estimatedDistanceMeters?:number}>=[];
  for(const route of response.routes){
    const vehicle=vehicles[route.vehicle-1];
    if(!vehicle||!Array.isArray(route.steps))throw new RoutingError('PROVIDER_INVALID_RESPONSE',503);
    let sequence=0;
    for(const step of route.steps)if(step.type==='job'){
      const candidate=candidates[(step.id||0)-1];
      if(!candidate||!usable.some(u=>u.idx+1===step.id)||taken.has(step.id!))
        throw new RoutingError('PROVIDER_INVALID_RESPONSE',503);
      taken.add(step.id!);sequence++;
      stops.push({candidateDeliveryId:candidate.deliveryId,vehicleId:vehicle.id,sequence,
        ...(Number.isFinite(step.arrival)?{estimatedArrival:new Date(step.arrival!*1000).toISOString()}:{}),
        ...(Number.isFinite(step.duration)?{estimatedTravelMinutes:step.duration!/60}:{}),
        ...(Number.isFinite(step.distance)?{estimatedDistanceMeters:step.distance}: {})});
    }
  }
  const missed=usable.filter(u=>!taken.has(u.idx+1)).map(u=>({
    candidateDeliveryId:u.candidate.deliveryId,reason:'PROVIDER_UNASSIGNED_OR_UNVERIFIED'}));
  return {companyId:scope,workspaceId:scope,source:'osrm-vroom' as const,
    status:'optimizedSuggestion' as const,stops,unassigned:[...excluded,...missed],
    calculatedAt:new Date().toISOString(),provider:'vroom',requiresHumanApproval:true as const,
    warnings:[]};
}
/** Optional OSRM matrix, coordinates only; no addresses or company identifiers. */
export async function travelMatrix(points:readonly {latitude:number;longitude:number}[]){
  const base=endpoint('osrm');if(!base)throw new RoutingError('ROUTING_PROVIDER_DISABLED',503);
  if(points.length<2||points.length>25)throw new RoutingError('LIMIT_EXCEEDED');
  const coordinates=points.map(p=>{const q=coordinateOf(p);return q.longitude+','+q.latitude;}).join(';');
  const url=new URL(base.toString());
  if(!url.pathname.endsWith('/'))url.pathname+='/';
  url.pathname+='table/v1/driving/'+coordinates;
  url.search='?annotations=duration,distance';
  const payload=await request('osrm',url,{method:'GET'}) as
    {code?:string;durations?:Array<Array<number|null>>;distances?:Array<Array<number|null>>};
  if(payload.code!=='Ok'||payload.durations?.length!==points.length
    ||payload.distances?.length!==points.length)throw new RoutingError('PROVIDER_INVALID_RESPONSE',503);
  return {durations:payload.durations,distances:payload.distances,provider:'osrm',calculatedAt:new Date().toISOString()};
}
function coordinateOf(p:{latitude:number;longitude:number}){
  if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)
    ||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180)throw new RoutingError('INVALID_COORDINATE');
  return p;
}
