// W7: pure accounting engine. All numbers persist as exact decimal strings (3 places max).
// Never infer physical receipt from a purchase or governmental acceptance from dispatch.
export class InventoryError extends Error {
  constructor(code, status = 409) { super(code); this.name = 'InventoryError'; this.code = code; this.status = status; }
}
const fail = (code, status = 409) => { throw new InventoryError(code, status); };
export const parseMilli = (value) => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value)) fail('INVALID_QUANTITY', 400);
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
};
export const decimal = (value) => {
  if (value < 0n || value > 999999999999999n) fail('QUANTITY_OUT_OF_RANGE', 400);
  const fraction = String(value % 1000n).padStart(3, '0').replace(/0+$/, '');
  return String(value / 1000n) + (fraction ? '.' + fraction : '');
};
export const id = (value) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('INVALID_ID', 400);
  return value;
};
export const key = (value) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) fail('INVALID_IDEMPOTENCY', 400);
  return value;
};
export const asQuantity = (quantity, canonicalUnit, conversion) => {
  if (!quantity || typeof quantity !== 'object' || Array.isArray(quantity) || typeof quantity.unit !== 'string') fail('INVALID_QUANTITY', 400);
  const n = parseMilli(quantity.value);
  if (n <= 0n) fail('INVALID_QUANTITY', 400);
  if (quantity.unit === canonicalUnit) return n;
  if (!conversion || conversion.from !== quantity.unit || conversion.to !== canonicalUnit ||
    !Number.isSafeInteger(conversion.numerator) || !Number.isSafeInteger(conversion.denominator) ||
    conversion.numerator <= 0 || conversion.denominator <= 0) fail('CONVERSION_REQUIRED', 409);
  const numerator = n * BigInt(conversion.numerator);
  if (numerator % BigInt(conversion.denominator) !== 0n) fail('CONVERSION_NOT_EXACT', 400);
  return numerator / BigInt(conversion.denominator);
};
export const blankStock = () => ({kind:'stock_projection', onHand:'0', reserved:'0'});
export const blankOrder = (catalogItemId, unit) => ({
  kind:'order_projection', catalogItemId, canonicalUnit:unit, stockReserved:'0', purchasePlanned:'0', dispatched:'0'
});
export const blankLink = (sourceType) => ({kind:'allocation_link', sourceType, reserved:'0', planned:'0', dispatched:'0'});
export const blankInbound = (purchaseQuantity) => ({
  kind:'inbound_projection', purchaseQuantity, allocated:'0', received:'0', converted:'0', directDispatched:'0'
});
const n = (object, field) => parseMilli(object[field]);
const nonnegative = (...values) => { if (values.some(v => v < 0n)) fail('NEGATIVE_BALANCE'); };
const bounded = (value, maximum) => { if (value > maximum) fail('INSUFFICIENT_QUANTITY'); };
const validState = (s, o, l, inbound, demand) => {
  const hand=n(s,'onHand'), res=n(s,'reserved');
  nonnegative(hand,res); bounded(res,hand);
  const claimed=n(o,'stockReserved')+n(o,'purchasePlanned')+n(o,'dispatched');
  nonnegative(n(o,'stockReserved'),n(o,'purchasePlanned'),n(o,'dispatched'));
  bounded(claimed,demand);
  nonnegative(n(l,'reserved'),n(l,'planned'),n(l,'dispatched'));
  if (inbound) {
    nonnegative(n(inbound,'allocated'),n(inbound,'received'),n(inbound,'converted'),n(inbound,'directDispatched'));
    bounded(n(inbound,'allocated')+n(inbound,'directDispatched'), n(inbound,'purchaseQuantity'));
    bounded(n(inbound,'received')+n(inbound,'directDispatched'),n(inbound,'purchaseQuantity'));
    bounded(n(inbound,'converted'),n(inbound,'received'));
  }
};
/** @param {{command: any, stock: any, order: any, link: any, inbound?: any, orderLimit?: string, purchased?: string}} input */
export function applyInventoryCommand({command,stock,order,link,inbound=null,orderLimit='0',purchased='0'}) {
  const s={...stock},o={...order},l={...link},p=inbound?{...inbound}:null;
  const q=parseMilli(command.canonicalQuantity);
  if (q<=0n) fail('INVALID_QUANTITY',400);
  const demand=parseMilli(orderLimit);
  const add=(obj,field,delta)=>{ obj[field]=decimal(n(obj,field)+delta); };
  const available=()=>n(s,'onHand')-n(s,'reserved');
  const claim=()=>n(o,'stockReserved')+n(o,'purchasePlanned')+n(o,'dispatched');
  const checkLink=(kind)=>{ if(l.sourceType!==kind) fail('ALLOCATION_SOURCE_MISMATCH'); };
  switch (command.kind) {
    case 'adjust_in':
      if (typeof command.reason !== 'string' || command.reason.trim().length<8 || command.reason.length>500) fail('REASON_REQUIRED',400);
      add(s,'onHand',q); break;
    case 'adjust_out':
      if (typeof command.reason !== 'string' || command.reason.trim().length<8 || command.reason.length>500) fail('REASON_REQUIRED',400);
      bounded(q,available()); add(s,'onHand',-q); break;
    case 'reserve':
      checkLink('stock'); bounded(q,available()); bounded(claim()+q,demand);
      add(s,'reserved',q);add(o,'stockReserved',q);add(l,'reserved',q);break;
    case 'release_converted':
      checkLink('purchase');
      bounded(q,n(l,'reserved'));
      add(s,'reserved',-q);add(o,'stockReserved',-q);add(l,'reserved',-q);break;
    case 'release':
      checkLink('stock');bounded(q,n(l,'reserved'));
      add(s,'reserved',-q);add(o,'stockReserved',-q);add(l,'reserved',-q);break;
    case 'dispatch_converted':
      checkLink('purchase');
      bounded(q,n(l,'reserved'));
      add(s,'reserved',-q);add(s,'onHand',-q);
      add(o,'stockReserved',-q);add(o,'dispatched',q);
      add(l,'reserved',-q);add(l,'dispatched',q);break;
    case 'dispatch':
      checkLink('stock');bounded(q,n(l,'reserved'));
      add(s,'reserved',-q);add(s,'onHand',-q);
      add(o,'stockReserved',-q);add(o,'dispatched',q);
      add(l,'reserved',-q);add(l,'dispatched',q);break;
    case 'return_converted':
      checkLink('purchase');bounded(q,n(l,'dispatched'));
      add(s,'onHand',q);add(o,'dispatched',-q);add(l,'dispatched',-q);break;
    case 'return':
      checkLink('stock');bounded(q,n(l,'dispatched'));
      add(s,'onHand',q);add(o,'dispatched',-q);add(l,'dispatched',-q);break;
    case 'plan_purchase':
      checkLink('purchase');if(!p) fail('PURCHASE_CONTRACT_NOT_READY',503);
      bounded(claim()+q,demand);bounded(n(p,'allocated')+n(p,'directDispatched')+q,n(p,'purchaseQuantity'));
      add(o,'purchasePlanned',q);add(l,'planned',q);add(p,'allocated',q);break;
    case 'unplan_purchase':
      checkLink('purchase');if(!p) fail('PURCHASE_CONTRACT_NOT_READY',503);
      bounded(q,n(l,'planned'));add(o,'purchasePlanned',-q);add(l,'planned',-q);add(p,'allocated',-q);break;
    case 'receive_purchase':
      if(!p) fail('PURCHASE_CONTRACT_NOT_READY',503);
      bounded(n(p,'received')+n(p,'directDispatched')+q,n(p,'purchaseQuantity'));
      add(p,'received',q);add(s,'onHand',q);break;
    case 'convert_purchase':
      checkLink('purchase');if(!p) fail('PURCHASE_CONTRACT_NOT_READY',503);
      bounded(q,n(l,'planned'));bounded(q,n(p,'received')-n(p,'converted'));
      bounded(q,available());add(o,'purchasePlanned',-q);add(o,'stockReserved',q);
      add(l,'planned',-q);add(l,'reserved',q);add(p,'converted',q);add(s,'reserved',q);break;
    case 'direct_dispatch':
      checkLink('purchase');if(!p) fail('PURCHASE_CONTRACT_NOT_READY',503);
      bounded(q,n(l,'planned'));bounded(q,n(p,'purchaseQuantity')-n(p,'received')-n(p,'directDispatched'));
      add(o,'purchasePlanned',-q);add(o,'dispatched',q);
      add(l,'planned',-q);add(l,'dispatched',q);
      add(p,'allocated',-q);add(p,'directDispatched',q);break;
    default: fail('UNKNOWN_OPERATION',400);
  }
  // A physical receipt never marks a buyer order fulfilled. Direct dispatch never touches on-hand.
  validState(s,o,l,p,demand);
  return {stock:s,order:o,link:l,inbound:p,kind:command.kind,quantity:command.canonicalQuantity};
}
