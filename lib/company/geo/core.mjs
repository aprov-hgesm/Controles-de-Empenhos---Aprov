/** W11 pure routing validation/planning; no military data, GPS or inferred ETA. */
export class RoutingError extends Error {
  constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
export const identifier=v=>{
  if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v))throw new RoutingError('INVALID_IDENTIFIER');
  return v;
};
export const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function coordinate(value){
  if(!object(value)||!Number.isFinite(value.latitude)||!Number.isFinite(value.longitude)
    ||Math.abs(value.latitude)>90||Math.abs(value.longitude)>180)
    throw new RoutingError('INVALID_COORDINATE');
  return {latitude:value.latitude,longitude:value.longitude};
}
function positive(v,field,allowZero=false){
  if(typeof v!=='number'||!Number.isFinite(v)||v<0||(!allowZero&&v===0)||v>1e9)
    throw new RoutingError('INVALID_'+field);
  return v;
}
function windowOf(v){
  if(v===undefined||v===null)return undefined;
  if(!object(v)||typeof v.start!=='string'||typeof v.end!=='string'
    ||!Number.isFinite(Date.parse(v.start))||!Number.isFinite(Date.parse(v.end))
    ||new Date(v.start).toISOString()!==v.start||new Date(v.end).toISOString()!==v.end
    ||Date.parse(v.end)<=Date.parse(v.start))throw new RoutingError('INVALID_WINDOW');
  return {start:v.start,end:v.end};
}
export function candidateOf(raw,scope){
  if(!object(raw))throw new RoutingError('INVALID_CANDIDATE');
  if(raw.companyId!==scope||raw.workspaceId!==scope)throw new RoutingError('COMPANY_SCOPE_FORBIDDEN',403);
  const destination=raw.destination;
  if(!object(destination)||typeof destination.address!=='string'
    ||destination.address.trim().length<5||destination.address.length>500
    ||typeof destination.confirmed!=='boolean')throw new RoutingError('INVALID_DESTINATION');
  const hasLat=destination.latitude!==undefined||destination.longitude!==undefined;
  let coords;
  if(hasLat) {
    coords=coordinate(destination);
    if(typeof destination.coordinateSource!=='string'||!destination.coordinateSource.trim()
      ||destination.coordinateSource.length>100)throw new RoutingError('COORDINATE_SOURCE_REQUIRED');
  }
  const weightKg=raw.weightKg===undefined?undefined:positive(raw.weightKg,'WEIGHT',true);
  const volumeM3=raw.volumeM3===undefined?undefined:positive(raw.volumeM3,'VOLUME',true);
  if(!object(raw.quantity)||typeof raw.quantity.value!=='string'||!/^\d+(?:\.\d{1,3})?$/.test(raw.quantity.value)
    ||!['UN','KG','G','L','ML','CX','FD','M'].includes(raw.quantity.unit))throw new RoutingError('INVALID_QUANTITY');
  return {
    companyId:scope,workspaceId:scope,deliveryId:identifier(raw.deliveryId),
    customerOrderId:identifier(raw.customerOrderId),customerOrderLineId:identifier(raw.customerOrderLineId),
    destination:{address:destination.address.trim(),confirmed:destination.confirmed,
      ...(coords||{}),...(coords?{coordinateSource:destination.coordinateSource.trim()}: {})},
    ...(windowOf(raw.receptionWindow)?{receptionWindow:windowOf(raw.receptionWindow)}:{}),
    ...(raw.unloadMinutes!==undefined?{unloadMinutes:positive(raw.unloadMinutes,'UNLOAD',true)}:{}),
    quantity:{unit:raw.quantity.unit,value:raw.quantity.value},...(weightKg!==undefined?{weightKg}:{}),
    ...(volumeM3!==undefined?{volumeM3}:{})
  };
}
export function vehicleOf(raw){
  if(!object(raw))throw new RoutingError('INVALID_VEHICLE');
  const id=identifier(raw.id),origin=coordinate(raw.origin);
  if(typeof raw.origin.coordinateSource!=='string'||!raw.origin.coordinateSource.trim())
    throw new RoutingError('ORIGIN_SOURCE_REQUIRED');
  const cap=raw.capacity;
  if(!object(cap)||!['weightKg','volumeM3','units'].some(k=>cap[k]!==undefined))
    throw new RoutingError('CAPACITY_REQUIRED');
  const capacity={};
  for(const key of ['weightKg','volumeM3','units'])if(cap[key]!==undefined)capacity[key]=positive(cap[key],'CAPACITY');
  const shift=windowOf(raw.shift);
  if(!shift)throw new RoutingError('SHIFT_REQUIRED');
  const breaks=raw.breaks===undefined?[]:raw.breaks;
  if(!Array.isArray(breaks)||breaks.length>8)throw new RoutingError('INVALID_BREAKS');
  const validatedBreaks=breaks.map(windowOf);
  if(validatedBreaks.some(b=>Date.parse(b.start)<Date.parse(shift.start)||Date.parse(b.end)>Date.parse(shift.end)))
    throw new RoutingError('BREAK_OUT_OF_SHIFT');
  return{id,origin:{...origin,coordinateSource:raw.origin.coordinateSource.trim()},
    capacity,shift,breaks:validatedBreaks,
    ...(typeof raw.driverUid==='string'&&raw.driverUid.length<129?{driverUid:raw.driverUid}:{})};
}
function reasonFor(candidate,vehicle,used){
  if(!candidate.destination.confirmed||candidate.destination.latitude===undefined)
    return 'DESTINATION_NEEDS_HUMAN_CONFIRMATION';
  if(!vehicle)return 'NO_VEHICLE';
  const cap=vehicle.capacity;
  if(cap.weightKg!==undefined&&candidate.weightKg===undefined)return 'WEIGHT_UNKNOWN';
  if(cap.volumeM3!==undefined&&candidate.volumeM3===undefined)return 'VOLUME_UNKNOWN';
  if(cap.units!==undefined&&(candidate.quantity.unit!=='UN'||!Number.isInteger(Number(candidate.quantity.value))))
    return 'UNIT_CAPACITY_INCOMPATIBLE';
  for(const [limit,qty] of [['weightKg','weightKg'],['volumeM3','volumeM3']]) {
    if(cap[limit]!==undefined&&used[limit]+(candidate[qty]||0)>cap[limit]+1e-9)return 'CAPACITY_EXCEEDED';
  }
  if(cap.units!==undefined&&used.units+Number(candidate.quantity.value)>cap.units)return 'CAPACITY_EXCEEDED';
  const window=candidate.receptionWindow;
  if(window&&(Date.parse(window.end)<Date.parse(vehicle.shift.start)
    ||Date.parse(window.start)>Date.parse(vehicle.shift.end)))return 'WINDOW_OUTSIDE_SHIFT';
  // Transit time is unknown for manual mode; never imply window feasibility or ETA.
  return null;
}
export function manualProposal({companyId,workspaceId,candidates,vehicles,assignments}){
  if(typeof companyId!=='string'||companyId!==workspaceId)throw new RoutingError('COMPANY_SCOPE_FORBIDDEN',403);
  if(!Array.isArray(candidates)||candidates.length>100||!Array.isArray(vehicles)||vehicles.length>10
    ||!Array.isArray(assignments)||assignments.length>100)throw new RoutingError('LIMIT_EXCEEDED');
  const cs=candidates.map(c=>candidateOf(c,companyId)), vs=vehicles.map(vehicleOf);
  const indexed=new Map(cs.map(c=>[c.deliveryId,c])),fleet=new Map(vs.map(v=>[v.id,v]));
  if(indexed.size!==cs.length||fleet.size!==vs.length)throw new RoutingError('DUPLICATE_ID');
  const seen=new Set(),used=new Map(vs.map(v=>[v.id,{weightKg:0,volumeM3:0,units:0}]));
  const stops=[],unassigned=[];
  for(const item of assignments){
    if(!object(item))throw new RoutingError('INVALID_ASSIGNMENT');
    const candidate=indexed.get(identifier(item.candidateDeliveryId));
    if(!candidate||seen.has(candidate.deliveryId))throw new RoutingError('INVALID_ASSIGNMENT');
    seen.add(candidate.deliveryId);
    const vehicle=fleet.get(identifier(item.vehicleId)),usage=used.get(item.vehicleId);
    const reason=reasonFor(candidate,vehicle,usage||{weightKg:0,volumeM3:0,units:0});
    if(reason){unassigned.push({candidateDeliveryId:candidate.deliveryId,reason});continue;}
    usage.weightKg+=candidate.weightKg||0;
    usage.volumeM3+=candidate.volumeM3||0;
    usage.units+=candidate.quantity.unit==='UN'?Number(candidate.quantity.value):0;
    stops.push({candidateDeliveryId:candidate.deliveryId,vehicleId:vehicle.id,sequence:stops.filter(s=>s.vehicleId===vehicle.id).length+1});
  }
  for(const c of cs)if(!seen.has(c.deliveryId))unassigned.push({candidateDeliveryId:c.deliveryId,
    reason:'NOT_ASSIGNED_BY_OPERATOR'});
  return {companyId,workspaceId,source:'manual',status:'draft',stops,unassigned,
    warnings:stops.length?['TRAVEL_TIME_AND_WINDOWS_NOT_VERIFIED']:[],
    requiresHumanApproval:true};
}
export function reorderStops(proposal,orderedIds){
  if(!object(proposal)||!Array.isArray(proposal.stops)||!Array.isArray(orderedIds)
    ||orderedIds.length!==proposal.stops.length)throw new RoutingError('INVALID_REORDER');
  const index=new Map(proposal.stops.map(s=>[s.candidateDeliveryId,s]));
  if(index.size!==orderedIds.length||new Set(orderedIds).size!==orderedIds.length
    ||orderedIds.some(id=>!index.has(id)))throw new RoutingError('INVALID_REORDER');
  const sequence=new Map();
  return {...proposal,source:'manual',status:'draft',stops:orderedIds.map(id=>{
    const s=index.get(id);const n=(sequence.get(s.vehicleId)||0)+1;sequence.set(s.vehicleId,n);
    return {...s,sequence:n,estimatedArrival:undefined,estimatedTravelMinutes:undefined,estimatedDistanceMeters:undefined};
  }),warnings:['TRAVEL_TIME_AND_WINDOWS_NOT_VERIFIED'],requiresHumanApproval:true};
}
export function externalNavigation(destination,provider){
  const {latitude,longitude}=coordinate(destination);
  if(destination.confirmed!==true)throw new RoutingError('UNCONFIRMED_DESTINATION');
  const pair=latitude+','+longitude;
  if(provider==='waze')return 'https://waze.com/ul?ll='+encodeURIComponent(pair)+'&navigate=yes';
  if(provider==='google')return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(pair)+'&travelmode=driving';
  throw new RoutingError('UNSUPPORTED_NAVIGATION');
}
export function approvePlan(plan,{expectedRevision,confirmedUnassignedIds,confirmedDestinationIds}){
  if(!object(plan)||plan.status!=='draft'&&plan.status!=='optimizedSuggestion')
    throw new RoutingError('INVALID_APPROVAL',409);
  if(!Number.isSafeInteger(expectedRevision)||plan.revision!==expectedRevision)
    throw new RoutingError('REVISION_CONFLICT',409);
  if(!Array.isArray(confirmedUnassignedIds)||!Array.isArray(confirmedDestinationIds)
    ||new Set(confirmedUnassignedIds).size!==confirmedUnassignedIds.length)throw new RoutingError('EXPLICIT_CONFIRMATION_REQUIRED');
  const unassigned=(plan.unassigned||[]).map(s=>s.candidateDeliveryId);
  if(unassigned.some(id=>!confirmedUnassignedIds.includes(id)))throw new RoutingError('UNASSIGNED_ACK_REQUIRED');
  if((plan.stops||[]).some(s=>!confirmedDestinationIds.includes(s.candidateDeliveryId)))
    throw new RoutingError('DESTINATION_ACK_REQUIRED');
  return {...plan,status:'approved',revision:expectedRevision+1,approvedByHuman:true};
}
