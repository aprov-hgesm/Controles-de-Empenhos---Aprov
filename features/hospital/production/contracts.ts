import type {CycleId, MealStatus, MealType, MealRequest, HospitalScope} from '../core/contracts';

/** W4 extends the W0 ProductionBatch without modifying shared W0 contracts. */
export type KitchenBatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'NEEDS_REVIEW' | 'CANCELLED';
export type KitchenReviewReason = 'CANCELLED' | 'SUSPENDED' | 'CLINICAL_BLOCK' | 'MAP_NOT_SUBMITTED' | 'ADMISSION_INACTIVE' | 'LOCATION_CHANGED' | 'DIET_CHANGED' | 'DIET_UNAVAILABLE' | 'FASTING' | 'ALLERGY_CONFLICT' | 'MEAL_MISSING' | 'STATUS_CHANGED';
export interface KitchenBatch {
  id: string;
  organizationId: string;
  unitId: string;
  localDate: string;
  cycleId: CycleId;
  mealIds: string[];
  dietCode: string;
  mealType: MealType;
  restrictionCodes: string[];
  preparationLabel: string;
  quantity: number;
  preparedQuantity: number;
  status: KitchenBatchStatus;
  effectiveStatus: KitchenBatchStatus;
  validation: 'CLEAR' | 'NEEDS_REVIEW';
  invalid: {mealId:string;reason:KitchenReviewReason}[];
  eligibleCount: number;
  totalCount: number;
  revision: number;
  createdAt: string;
  startedAt: string|null;
  completedAt: string|null;
  excludedMealIds: string[];
  actorUid: string;
  cancelReason?: string;
}
export interface KitchenMeal extends MealRequest {
  dietRestrictionCodes: string[];
  safetyIssue: KitchenReviewReason|null;
  isLate: boolean;
}
export interface KitchenMapReceipt {id:string;unitId:string;localDate:string;cycleId:CycleId;status:'SUBMITTED'|'CLOSED';revision:number;submittedAt:string|null;receivedAt?:string|null;receivedByUid?:string|null;needsKitchenReview?:boolean;late?:boolean;closedAt:string|null;}
export interface KitchenGroup {dietCode:string;mealType:MealType;restrictionCodes:string[];preparationLabels:string[];requested:number;preparing:number;ready:number;total:number;}
export interface KitchenSnapshot {
  at: string; localDate: string; cycleId: CycleId;
  maps: KitchenMapReceipt[]; meals: KitchenMeal[]; batches: KitchenBatch[];
  groups: KitchenGroup[];
  counts: {requested:number;preparing:number;ready:number;suspended:number;cancelled:number;blocked:number;late:number;extraordinary:number};
}
export interface KitchenQuery {unitIds:string[];localDate:string;cycleId:CycleId;statuses?:MealStatus[];dietCode?:string;restriction?:string;lateOnly?:boolean;includeSuspended?:boolean;}
/** All operations require a W0-authenticated HospitalScope, never a client-supplied scope. */
export interface KitchenProductionContract {
  snapshot(scope:HospitalScope,query:KitchenQuery):KitchenSnapshot;
  createBatch(scope:HospitalScope,args:{unitId:string;localDate:string;cycleId:CycleId;mealIds:string[];preparationLabel:string;idempotencyKey:string}):KitchenBatch;
  startBatch(scope:HospitalScope,args:{unitId:string;batchId:string;expectedRevision:number;idempotencyKey:string}):KitchenBatch;
  completeBatch(scope:HospitalScope,args:{unitId:string;batchId:string;expectedRevision:number;confirmedQuantity:number;idempotencyKey:string}):KitchenBatch;
  acknowledgeBatch(scope:HospitalScope,args:{unitId:string;batchId:string;expectedRevision:number;idempotencyKey:string}):KitchenBatch;
  reconcileBatch(scope:HospitalScope,args:{unitId:string;batchId:string;expectedRevision:number;excludedMealIds:string[];idempotencyKey:string}):KitchenBatch;
  cancelBatch(scope:HospitalScope,args:{unitId:string;batchId:string;expectedRevision:number;reason:string;idempotencyKey:string}):KitchenBatch;
  flagAffected(scope:HospitalScope,args:{unitId:string;mealId:string;reason:string}):{affected:string[]};
}
export type KitchenEvent =
  | 'meal.production.batch.created' | 'meal.production.batch.started' | 'meal.production.batch.completed'
  | 'meal.production.batch.review.required' | 'meal.production.batch.review.cleared' | 'meal.production.batch.reconciled' | 'meal.production.batch.cancelled'
  | 'meal.production.started' | 'meal.production.completed';
