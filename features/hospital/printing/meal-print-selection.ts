import type {KitchenMeal} from '../production/contracts';

/**
 * The very same definitive physical label may be printed before the cook
 * starts production and paired with the recipient label from Distribution.
 * Printing does not transition, approve or deliver any meal.
 */
export const PRINTABLE_MEAL_STATUSES=new Set([
 'REQUESTED','PREPARING','READY','DISPATCHED','RECEIVED_BY_UNIT','DELIVERED'
]);
export function eligibleForOrganizationLabel(m:Pick<KitchenMeal,'status'|'safetyIssue'>){
 return PRINTABLE_MEAL_STATUSES.has(m.status)&&!m.safetyIssue;
}
export function printRecipientType(m:Pick<KitchenMeal,'recipientType'>):'PATIENT'|'COMPANION'{
 return m.recipientType==='COMPANION'?'COMPANION':'PATIENT';
}
export function plannedPrintability(meals:KitchenMeal[]){
 const printable=meals.filter(eligibleForOrganizationLabel);
 return {
  printable,
  skippedForSafety:meals.length-printable.length,
  companions:printable.filter(m=>m.recipientType==='COMPANION').length
 };
}
