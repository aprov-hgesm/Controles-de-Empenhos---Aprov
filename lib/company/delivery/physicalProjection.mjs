/** Derived physical W9 projection; not a second ledger or public-agency atesto.
 * Only record a delta inside the SAME CAS/Firestore transaction as a signed W9 proof.
 */
import {DeliveryError,milli,decimal} from './domain.mjs';

const fail=code=>{throw new DeliveryError(code,409);};
const same=(qty,unit)=>qty && typeof qty.value==='string' && qty.unit===unit
  ? milli(qty.value) : fail('UNIT_MISMATCH');

export function applyPhysicalDeliveryProjection({unit,assigned,committed,before,after}){
 if(typeof unit!=='string'||!unit)return fail('UNIT_MISMATCH');
 const b=same(before,unit),a=same(after,unit);
 const d=milli(committed),limit=milli(assigned);
 if(a<b)return fail('PHYSICAL_DELIVERY_REVERSAL_UNSUPPORTED');
 const next=d+(a-b);
 if(next>limit)return fail('PHYSICAL_DELIVERY_EXCEEDS_DISPATCH');
 return Object.freeze({value:decimal(next),unit,basis:'W9_documented_physical_delivery',atesto:false});
}

/** Null means a legacy quota predates this projection: never show false zero. */
export function readPhysicalDeliveryProjection({unit,ordered,quota}){
 const limit=same(ordered,unit);
 if(quota===null)return Object.freeze({value:'0',unit,basis:'W9_documented_physical_delivery',atesto:false});
 if(quota?.physicalDelivered===undefined)return null;
 if(quota.unit!==unit)return fail('UNIT_MISMATCH');
 const p=milli(quota.physicalDelivered),assigned=milli(quota.assigned);
 if(p>assigned||p>limit)return fail('PHYSICAL_DELIVERY_INTEGRITY_ERROR');
 return Object.freeze({value:decimal(p),unit,basis:'W9_documented_physical_delivery',atesto:false});
}
