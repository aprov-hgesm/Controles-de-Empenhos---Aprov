/** W9 pure business logic: a shipment never implies an OM atesto or financial settlement. */
export class DeliveryError extends Error {
  constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
}
const fail = (code, status = 400) => { throw new DeliveryError(code,status); };
export const validId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : fail('INVALID_ID');
export const validKey = v => typeof v === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(v) ? v : fail('IDEMPOTENCY_KEY_REQUIRED');
export const milli = value => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value)) fail('INVALID_QUANTITY');
  const [a,b=''] = value.split('.');
  return BigInt(a)*1000n+BigInt(b.padEnd(3,'0'));
};
export const decimal = n => {
  if (n < 0n || n > 999999999999999n) fail('QUANTITY_OUT_OF_RANGE');
  const f=String(n%1000n).padStart(3,'0').replace(/0+$/,'');
  return String(n/1000n)+(f ? '.'+f : '');
};
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonempty = (v,max=250) => typeof v === 'string' && v.trim().length>0 &&
  v.trim().length<=max && !/[\u0000-\u001f\u007f]/.test(v) ? v.trim() : fail('INVALID_INPUT');
const iso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v) &&
  !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,19)===v.slice(0,19) ? v : fail('INVALID_DATE');
export function parseFact(raw,basis,source) {
  if (!object(raw) || raw.basis!==basis || raw.source!==source) fail('INVALID_TEMPORAL_SOURCE');
  return {value:iso(raw.value),basis,source,updatedAt:iso(raw.updatedAt)};
}
export function parseDeliveryDraft(raw) {
  if (!object(raw)) fail('INVALID_BODY');
  const quantity=raw.quantity;
  if (!object(quantity) || !['UN','KG','G','L','ML','CX','FD','M'].includes(quantity.unit) || milli(quantity.value)<=0n) fail('INVALID_QUANTITY');
  const destination=raw.destination;
  if (!object(destination) || destination.confirmed!==true) fail('DESTINATION_UNCONFIRMED',409);
  const address=nonempty(destination.address,500);
  let window;
  if(raw.receptionWindow!==undefined){
    const w=raw.receptionWindow;
    if(!object(w) || iso(w.start)>=iso(w.end)) fail('INVALID_RECEPTION_WINDOW');
    window={start:w.start,end:w.end};
  }
  const source = raw.source==='supplier_direct' ? 'supplier_direct' :
    raw.source==='company_stock' ? 'company_stock' : fail('INVALID_SOURCE');
  const proposed = raw.manualSequence;
  if(!Number.isSafeInteger(proposed) || proposed<1 || proposed>1000) fail('INVALID_SEQUENCE');
  if(raw.routePlanId!==undefined) fail('ROUTE_PLAN_INTEGRATION_PENDING',409);
  return {customerOrderId:validId(raw.customerOrderId),customerOrderLineId:validId(raw.customerOrderLineId),
    catalogItemId:validId(raw.catalogItemId), quantity:{value:decimal(milli(quantity.value)),unit:quantity.unit},
    source, ...(source==='supplier_direct'?{purchaseOrderId:validId(raw.purchaseOrderId),
      purchaseLineId:validId(raw.purchaseLineId)}:{}),
    destination:{address,confirmed:true}, ...(window?{receptionWindow:window}:{}),
    manualSequence:proposed,
    driverUid:nonempty(raw.driverUid,128),
    ...(raw.unloadMinutes===undefined?{}:(Number.isSafeInteger(raw.unloadMinutes) && raw.unloadMinutes>=0 && raw.unloadMinutes<=1440
      ? {unloadMinutes:raw.unloadMinutes} : fail('INVALID_UNLOAD_MINUTES'))),
    ...(raw.notes===undefined?{}:{notes:nonempty(raw.notes,2000)})};
}
/** Atomic W9 quota must not exceed quantity already dispatched by W7.
 * Direct dispatch must independently have W7 purchase-link evidence.
 */
export function checkDispatchQuota(input){
  const {unit,demand,dispatched,alreadyAssigned,requested,directEvidence,source}=input;
  if(!['UN','KG','G','L','ML','CX','FD','M'].includes(unit)) fail('INVALID_UNIT');
  for (const q of [demand,dispatched,alreadyAssigned,requested]) if(!object(q)||q.unit!==unit)fail('UNIT_MISMATCH',409);
  const d=milli(demand.value), sent=milli(dispatched.value),
    used=milli(alreadyAssigned.value), ask=milli(requested.value);
  if(ask<=0n||used>sent||used+ask>sent||used+ask>d)fail('W7_DISPATCH_INSUFFICIENT',409);
  if(source==='supplier_direct' &&
    (!object(directEvidence)||directEvidence.unit!==unit||milli(directEvidence.value)<ask))fail('DIRECT_DISPATCH_UNVERIFIED',409);
  if(source!=='supplier_direct' && source!=='company_stock')fail('INVALID_SOURCE');
  return {assigned:decimal(used+ask),remainingDispatched:decimal(sent-used-ask)};
}
export function assessSchedule({requestedAt,supplierPromisedAt,receiptConfirmedAt,dispatched,deliveryWindow,now}){
  const requested=requestedAt?iso(requestedAt):null;
  const supplier=supplierPromisedAt?iso(supplierPromisedAt):null;
  const receipt=receiptConfirmedAt?iso(receiptConfirmedAt):null;
  const clock=iso(now);
  const latest=deliveryWindow?.end?iso(deliveryWindow.end):requested;
  const reasons=[];
  if(latest && supplier && supplier>latest && !receipt)reasons.push('SUPPLIER_AFTER_OM_WINDOW');
  if(latest && !dispatched && clock>latest)reasons.push('OM_DEADLINE_EXPIRED');
  if(!dispatched && !supplier && !receipt)reasons.push('INBOUND_UNCONFIRMED');
  if(latest && receipt && receipt>latest)reasons.push('RECEIPT_AFTER_OM_WINDOW');
  return {risk:reasons.length?'at_risk':(!dispatched?'needs_confirmation':'ready_to_deliver'),
    reasons,requestedAt:requested,supplierPromisedAt:supplier,receiptConfirmedAt:receipt,
    latestOmAt:latest,eta:null,etaBasis:'not_calculated'};
}
export function approvePromise(previous, next, decision){
  if(!object(decision)||decision.approved!==true||!nonempty(decision.approvedByUid,128)||
    nonempty(decision.reason,1200).length<12)fail('HUMAN_APPROVAL_REQUIRED',409);
  return {previous:previous||null,next:iso(next),approvedByUid:decision.approvedByUid,
    reason:decision.reason,approvedAt:iso(decision.approvedAt)};
}
export function transitionDelivery(record,raw,actorUid,at){
  if(!object(record)||!object(raw))fail('INVALID_INPUT');
  const action=raw.kind;
  const valid={planned:['collected'],collected:['departed'],departed:['delivered','partial','refused','damaged'],
    partial:['returned'],refused:['returned'],damaged:['returned'],delivered:[],returned:[]};
  if(!Object.prototype.hasOwnProperty.call(valid,record.deliveryState)||!valid[record.deliveryState].includes(action))
    fail('INVALID_DELIVERY_TRANSITION',409);
  const reason=['partial','refused','damaged','returned'].includes(action)?nonempty(raw.reason,1200):null;
  if(reason && reason.length<8)fail('REASON_REQUIRED');
  if((action==='departed'||action==='collected') && raw.proofDocumentId!==undefined)fail('INVALID_EVIDENCE');
  const requiresProof=['delivered','partial','refused','damaged','returned'].includes(action);
  const proofDocumentId=requiresProof?validId(raw.proofDocumentId):null;
  const quantity=record.quantity;
  const planned=milli(quantity.value);
  let delivered='0';
  if(action==='delivered')delivered=quantity.value;
  else if(action==='partial'){
    if(!object(raw.deliveredQuantity) || raw.deliveredQuantity.unit!==quantity.unit)fail('INVALID_DELIVERED_QUANTITY');
    const amount=milli(raw.deliveredQuantity.value);
    if(amount<=0n||amount>=planned)fail('INVALID_DELIVERED_QUANTITY');
    delivered=decimal(amount);
  }else if(action==='returned')delivered=record.deliveredQuantity?.value||'0';
  const event={kind:action,at:iso(at),actorUid:nonempty(actorUid,128),
    ...(reason?{reason}:{}),...(proofDocumentId?{proofDocumentId}:{}),
    ...(action==='partial'?{deliveredQuantity:{value:delivered,unit:quantity.unit}}:{})};
  return {...record,deliveryState:action,
    deliveredQuantity:{value:action==='collected'||action==='departed'?'0':delivered,unit:quantity.unit},
    history:[...(Array.isArray(record.history)?record.history:[]).slice(-79),event],
    revision:record.revision+1,updatedAt:at};
}
