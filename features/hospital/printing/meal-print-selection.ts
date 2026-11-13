import type {KitchenMeal} from '../production/contracts';

/** Printing supports organization of pending meals, not only READY ones.
 * Never treat printing as release, production, dispatch or delivery.
 * Safety-blocked/cancelled requests are not printable as valid food labels. */
export const PRINTABLE_MEAL_STATUSES=new Set([
 'REQUESTED','PREPARING','READY','DISPATCHED','RECEIVED_BY_UNIT','DELIVERED'
]);
export type PrintPhase='PLANEJAMENTO'|'PREPARO'|'PRONTA'|'EM_ROTA'|'ENTREGUE';

export function eligibleForOrganizationLabel(m:Pick<KitchenMeal,'status'|'safetyIssue'>){
 return PRINTABLE_MEAL_STATUSES.has(m.status)&&!m.safetyIssue;
}
export function printPhase(status:string):PrintPhase {
 switch(status){
  case 'REQUESTED':return 'PLANEJAMENTO';
  case 'PREPARING':return 'PREPARO';
  case 'READY':return 'PRONTA';
  case 'DISPATCHED':case 'RECEIVED_BY_UNIT':return 'EM_ROTA';
  case 'DELIVERED':return 'ENTREGUE';
  default:return 'PLANEJAMENTO';
 }
}
export function printRecipientType(m:Pick<KitchenMeal,'recipientType'>):'PATIENT'|'COMPANION'{
 return m.recipientType==='COMPANION'?'COMPANION':'PATIENT';
}
export function plannedPrintability(meals:KitchenMeal[]){
 const printable=meals.filter(eligibleForOrganizationLabel);
 return {
  printable,
  skippedForSafety:meals.filter(m=>!eligibleForOrganizationLabel(m)).length,
  preliminary:printable.filter(m=>['REQUESTED','PREPARING'].includes(m.status)).length,
  companions:printable.filter(m=>m.recipientType==='COMPANION').length
 };
}
