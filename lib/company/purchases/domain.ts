/** W6 — compras empresariais: quantidades exatas, fatos separados e nenhum lançamento no ledger W7. */
import type { CompanyOwnedRecord, CompanyUnit, CompanyUnitConversion, CompanyQuantity, CompanyTemporalFact } from '../contracts';

export type PurchaseState = 'draft' | 'sent' | 'partially_confirmed' | 'confirmed' | 'partially_received' | 'received' | 'rejected' | 'cancelled';
export type PurchaseOperation = 'sent' | 'reply' | 'receive' | 'reschedule' | 'cancel';
export interface PurchaseAllocationPlan {
  customerOrderId: string; customerOrderLineId: string; quantity: CompanyQuantity;
}
export interface PurchaseLine {
  id: string; catalogItemId: string; supplierSku: string; description: string;
  quantity: CompanyQuantity; conversion: CompanyUnitConversion;
  unitPriceCents: number; priceEvidence: { reference: string; quotedAt: string };
  allocations: PurchaseAllocationPlan[];
  confirmedQuantity: CompanyQuantity; receivedQuantity: CompanyQuantity;
}
export interface PurchaseOrder extends CompanyOwnedRecord {
  sourceSupplierId: string; reference: string; workflowState: PurchaseState;
  lines: PurchaseLine[]; desiredAt: CompanyTemporalFact;
  supplierPromisedAt?: CompanyTemporalFact;
  dispatchEvidence?: { channel: 'email' | 'phone' | 'whatsapp' | 'portal'; reference: string; confirmedByUid: string; confirmedAt: string };
  supplierReplyReference?: string;
  history: Array<{ operation: PurchaseOperation; at: string; actorUid: string; reference: string }>;
  /** The W5 export expects this snapshot. No shipment or receipt is invented. */
  pdfSnapshot?: { id: string; companyId: string; workspaceId: string; documentNumber: string;
    customerName: string; supplierName: string; issuedAt: string;
    lines: Array<{ id: string; description: string; quantity: string; unit: CompanyUnit; unitPriceCents: number }> };
}
export interface PurchaseEvent {
  schemaVersion: 'company-r1-v1'; id: string; companyId: string; workspaceId: string;
  purchaseOrderId: string; sourceSupplierId: string;
  kind: 'purchase.sent' | 'purchase.reply' | 'purchase.received' | 'purchase.rescheduled' | 'purchase.cancelled';
  occurredAt: string; actorUid: string; idempotencyKey: string; purchaseRevision: number;
  receiptReference?: string;
  /** Delta only; W7 must consume once by event id. Never authoritative stock here. */
  receivedDeltas: Array<{ lineId: string; catalogItemId: string; quantity: CompanyQuantity; conversion: CompanyUnitConversion }>;
  stockPosted: false;
}
export class PurchaseError extends Error {
  readonly code: string;
  readonly status: 400 | 404 | 409 | 429 | 503;
  constructor(code: string, status: 400 | 404 | 409 | 429 | 503) {
    super(code); this.code = code; this.status = status; this.name = 'PurchaseError';
  }
}
const bad = (code = 'INVALID_INPUT'): never => { throw new PurchaseError(code,400); };
const conflict = (code = 'CONFLICT'): never => { throw new PurchaseError(code,409); };
export const object = (v:unknown): v is Record<string,unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const string = (v:unknown, max=160): string => typeof v === 'string' && v.trim().length>0 && v.trim().length<=max && !/[\u0000-\u001f\u007f]/.test(v) ? v.trim() : bad();
export const identifier = (v:unknown): string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : bad();
export const key = (v:unknown): string => typeof v === 'string' && /^[A-Za-z0-9._:-]{12,128}$/.test(v) ? v : bad('IDEMPOTENCY_KEY_REQUIRED');
const unitSet = new Set<CompanyUnit>(['UN','KG','G','L','ML','CX','FD','M']);
export function positiveQuantity(v:unknown, zero=false): CompanyQuantity {
  if (!object(v) || typeof v.value !== 'string' || typeof v.unit !== 'string' || !unitSet.has(v.unit as CompanyUnit)) return bad();
  const amount = milli(v.value);
  if (!zero && amount===BigInt(0)) return bad();
  return {value:v.value,unit:v.unit as CompanyUnit};
}
export function milli(v:string):bigint {
  if (typeof v!=='string' || !/^(0|[1-9]\d{0,11})(\.\d{1,3})?$/.test(v)) return bad();
  const [whole, frac=''] = v.split('.');
  return BigInt(whole)*BigInt(1000)+BigInt(frac.padEnd(3,'0'));
}
export function decimal(v:bigint):string {
  if (v<BigInt(0)) return conflict('NEGATIVE_QUANTITY');
  const frac=(v%BigInt(1000)).toString().padStart(3,'0').replace(/0+$/,'');
  return (v/BigInt(1000)).toString()+(frac ? '.'+frac : '');
}
function ratio(raw:unknown, from:CompanyUnit, to:CompanyUnit):CompanyUnitConversion {
  if (!object(raw) || raw.from!==from || raw.to!==to
      || !Number.isSafeInteger(raw.numerator) || !Number.isSafeInteger(raw.denominator)
      || Number(raw.numerator)<1 || Number(raw.denominator)<1
      || Number(raw.numerator)>1000000000 || Number(raw.denominator)>1000000000) return bad('INVALID_CONVERSION');
  return {from,to,numerator:Number(raw.numerator),denominator:Number(raw.denominator)};
}
export function convertedMilli(quantity:CompanyQuantity, conversion:CompanyUnitConversion):bigint {
  if (quantity.unit!==conversion.from) return bad('INVALID_CONVERSION');
  const numerator=milli(quantity.value)*BigInt(conversion.numerator);
  const denominator=BigInt(conversion.denominator);
  if (numerator%denominator!==BigInt(0)) return bad('INEXACT_CONVERSION');
  return numerator/denominator;
}
const timestamp = (v:unknown):string => {
  const s=string(v,40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s)
    || Number.isNaN(Date.parse(s))) return bad('INVALID_DATE');
  return s;
};
function temporal(value:unknown,basis:CompanyTemporalFact['basis'],source:CompanyTemporalFact['source']):CompanyTemporalFact {
  const now=new Date().toISOString();
  return {value:timestamp(value),basis,source,updatedAt:now};
}
export interface DraftInput {
  sourceSupplierId:string; reference:string; desiredAt:string;
  lines:Array<{id:string;catalogItemId:string;supplierSku:string;description:string;quantity:CompanyQuantity;
    conversion:CompanyUnitConversion;unitPriceCents:number;priceEvidence:{reference:string;quotedAt:string};
    allocations:PurchaseAllocationPlan[]}>;
}
export function parseDraft(raw:unknown):DraftInput {
  if (!object(raw) || !Array.isArray(raw.lines) || raw.lines.length<1 || raw.lines.length>40) return bad();
  const lines=raw.lines.map((item):DraftInput['lines'][number]=>{
    if (!object(item) || !object(item.priceEvidence) || !Array.isArray(item.allocations)
        || item.allocations.length<1 || item.allocations.length>30) return bad();
    const q=positiveQuantity(item.quantity);
    const conversion=ratio(item.conversion,q.unit,item.conversion && object(item.conversion) ? item.conversion.to as CompanyUnit : q.unit);
    if (!unitSet.has(conversion.to)) return bad();
    const allocations=item.allocations.map((a):PurchaseAllocationPlan=>{
      if (!object(a)) return bad();
      const aq=positiveQuantity(a.quantity);
      if (aq.unit!==conversion.to) return bad('ALLOCATION_UNIT_MISMATCH');
      return {customerOrderId:identifier(a.customerOrderId),customerOrderLineId:identifier(a.customerOrderLineId),quantity:aq};
    });
    if (new Set(allocations.map(a=>a.customerOrderId+':'+a.customerOrderLineId)).size!==allocations.length) return bad('DUPLICATE_ALLOCATION');
    if (allocations.reduce((sum,a)=>sum+milli(a.quantity.value),BigInt(0))>convertedMilli(q,conversion)) return bad('ALLOCATION_EXCEEDS_PURCHASE');
    if (!Number.isSafeInteger(item.unitPriceCents) || Number(item.unitPriceCents)<0) return bad('INVALID_PRICE');
    return {id:identifier(item.id),catalogItemId:identifier(item.catalogItemId),
      supplierSku:string(item.supplierSku,80),description:string(item.description,240),
      quantity:q,conversion,unitPriceCents:Number(item.unitPriceCents),
      priceEvidence:{reference:string(item.priceEvidence.reference,200),quotedAt:timestamp(item.priceEvidence.quotedAt)},
      allocations};
  });
  if (new Set(lines.map(l=>l.id)).size!==lines.length) return bad('DUPLICATE_LINE');
  return {sourceSupplierId:identifier(raw.sourceSupplierId),reference:string(raw.reference,120),
    desiredAt:timestamp(raw.desiredAt),lines};
}
export type PurchaseChange =
  | {action:'sent';expectedRevision:number;channel:'email'|'phone'|'whatsapp'|'portal';confirmationRef:string;confirmedByOperator:true}
  | {action:'reply';expectedRevision:number;reference:string;confirmed:Array<{lineId:string;quantity:CompanyQuantity}>;promisedAt?:string}
  | {action:'receive';expectedRevision:number;reference:string;received:Array<{lineId:string;quantity:CompanyQuantity}>}
  | {action:'reschedule';expectedRevision:number;reference:string;promisedAt:string}
  | {action:'cancel';expectedRevision:number;reference:string};
export function parseChange(v:unknown):PurchaseChange {
  if (!object(v) || !Number.isSafeInteger(v.expectedRevision) || Number(v.expectedRevision)<1) return bad();
  const expectedRevision=Number(v.expectedRevision);
  if (v.action==='sent') {
    if (v.confirmedByOperator!==true || !['email','phone','whatsapp','portal'].includes(String(v.channel))) return bad();
    return {action:'sent',expectedRevision,channel:v.channel as 'email',confirmationRef:string(v.confirmationRef,200),confirmedByOperator:true};
  }
  if (v.action==='reply'||v.action==='receive') {
    const field=v.action==='reply'?'confirmed':'received';
    const raw=v[field];
    if (!Array.isArray(raw) || raw.length<1 || raw.length>40) return bad();
    const lines=raw.map((x:unknown)=> {
      if (!object(x)) return bad();
      return {lineId:identifier(x.lineId),quantity:positiveQuantity(x.quantity,true)};
    });
    if (new Set(lines.map(x=>x.lineId)).size!==lines.length) return bad('DUPLICATE_LINE');
    if (v.action==='reply') return {action:'reply',expectedRevision,reference:string(v.reference,200),
      confirmed:lines,promisedAt:v.promisedAt===undefined?undefined:timestamp(v.promisedAt)};
    if (lines.some(x=>milli(x.quantity.value)===BigInt(0))) return bad('EMPTY_RECEIPT');
    return {action:'receive',expectedRevision,reference:string(v.reference,200),received:lines};
  }
  if (v.action==='reschedule') return {action:'reschedule',expectedRevision,reference:string(v.reference,200),promisedAt:timestamp(v.promisedAt)};
  if (v.action==='cancel') return {action:'cancel',expectedRevision,reference:string(v.reference,200)};
  return bad('UNKNOWN_OPERATION');
}
/** State machine returns changes and immutable delta event; does not write W7 stock. */
export function transition(p:PurchaseOrder,c:PurchaseChange,uid:string,now:string,eventId:string,idempotencyKey:string):{order:PurchaseOrder;event:PurchaseEvent} {
  if (p.revision!==c.expectedRevision || p.workflowState==='cancelled'||p.workflowState==='rejected'||p.workflowState==='received') return conflict();
  const order:PurchaseOrder={...p,lines:p.lines.map(x=>({...x})),revision:p.revision+1,updatedAt:now,
    history:[...p.history.slice(-49),{operation:c.action,at:now,actorUid:uid,
      reference:c.action==='sent'?c.confirmationRef:c.reference}]};
  const deltas:PurchaseEvent['receivedDeltas']=[];
  if (c.action==='sent') {
    if(p.workflowState!=='draft') return conflict('INVALID_STATE');
    order.workflowState='sent';order.status='active';
    order.dispatchEvidence={channel:c.channel,reference:c.confirmationRef,confirmedByUid:uid,confirmedAt:now};
  } else if(c.action==='reply') {
    if(!['sent','partially_confirmed','confirmed','partially_received'].includes(p.workflowState)) return conflict('INVALID_STATE');
    if(c.confirmed.length!==p.lines.length) return bad('REPLY_MUST_COVER_LINES');
    for(const line of order.lines){
      const reply=c.confirmed.find(x=>x.lineId===line.id);
      if(!reply||reply.quantity.unit!==line.quantity.unit) return bad('INVALID_LINE');
      const n=milli(reply.quantity.value);
      if(n>milli(line.quantity.value)||n<milli(line.receivedQuantity.value)) return conflict('CONFIRMED_QUANTITY_CONFLICT');
      line.confirmedQuantity=reply.quantity;
    }
    const total=order.lines.reduce((s,x)=>s+milli(x.confirmedQuantity.value),BigInt(0));
    const ordered=order.lines.reduce((s,x)=>s+milli(x.quantity.value),BigInt(0));
    order.workflowState=total===BigInt(0)?'rejected':
      p.workflowState==='partially_received'?'partially_received':total===ordered?'confirmed':'partially_confirmed';
    if(total===BigInt(0)) order.status='cancelled';
    order.supplierReplyReference=c.reference;
    if(c.promisedAt) order.supplierPromisedAt=temporal(c.promisedAt,'confirmed','supplier');
  } else if(c.action==='receive') {
    if(!['partially_confirmed','confirmed','partially_received'].includes(p.workflowState)) return conflict('INVALID_STATE');
    for(const receipt of c.received){
      const line=order.lines.find(x=>x.id===receipt.lineId);
      if(!line||line.quantity.unit!==receipt.quantity.unit) return bad('INVALID_LINE');
      const n=milli(line.receivedQuantity.value)+milli(receipt.quantity.value);
      if(n>milli(line.confirmedQuantity.value)) return conflict('RECEIPT_EXCEEDS_CONFIRMED');
      line.receivedQuantity={value:decimal(n),unit:line.quantity.unit};
      deltas.push({lineId:line.id,catalogItemId:line.catalogItemId,quantity:receipt.quantity,conversion:line.conversion});
    }
    order.workflowState=order.lines.every(x=>milli(x.receivedQuantity.value)===milli(x.quantity.value))?'received':'partially_received';
  } else if(c.action==='reschedule') {
    if(p.workflowState==='draft') return conflict('INVALID_STATE');
    order.supplierPromisedAt=temporal(c.promisedAt,'confirmed','supplier');
  } else {
    if(p.lines.some(x=>milli(x.receivedQuantity.value)!==BigInt(0))) return conflict('CANNOT_CANCEL_RECEIVED');
    order.workflowState='cancelled';order.status='cancelled';
  }
  const kind:PurchaseEvent['kind']=c.action==='sent'?'purchase.sent':c.action==='reply'&&order.workflowState==='rejected'?'purchase.cancelled':
    c.action==='reply'?'purchase.reply':c.action==='receive'?'purchase.received':c.action==='reschedule'?'purchase.rescheduled':'purchase.cancelled';
  return {order,event:{schemaVersion:'company-r1-v1',id:eventId,companyId:p.companyId,workspaceId:p.companyId,
    purchaseOrderId:p.id,sourceSupplierId:p.sourceSupplierId,kind,occurredAt:now,actorUid:uid,
    idempotencyKey,purchaseRevision:order.revision,receiptReference:c.action==='receive'?c.reference:undefined,
    receivedDeltas:deltas,stockPosted:false}};
}
/** W1 demand known, W7 stock unknown => never invent a net shortage. */
export function needFromOrderLine(orderId:string,line:{id:string;quantity:CompanyQuantity;fulfilledQuantity:CompanyQuantity}) {
  const total=positiveQuantity(line.quantity);const fulfilled=positiveQuantity(line.fulfilledQuantity,true);
  if(total.unit!==fulfilled.unit||milli(fulfilled.value)>milli(total.value)) return conflict('INVALID_W1_DEMAND');
  return {customerOrderId:orderId,lineId:line.id,outstanding:{value:decimal(milli(total.value)-milli(fulfilled.value)),unit:total.unit},
    availableStock:null,netShortage:null,requiresW7Reconciliation:true};
}
