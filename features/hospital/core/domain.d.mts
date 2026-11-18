import type { CycleId, MealCycleConfig, MealStatus, MapStatus, LocationStatus, NutritionAuditStatus, MealType, HospitalErrorCode } from './contracts';
export declare const HOSPITAL_TIMEZONE: 'America/Sao_Paulo';
export declare const CYCLES: Readonly<Record<CycleId,Readonly<MealCycleConfig>>>;
export declare class HospitalError extends Error { code: HospitalErrorCode; constructor(code:HospitalErrorCode,message:string); toJSON(): {ok:false;error:{code:HospitalErrorCode;message:string}}; }
export declare function assertHospital(condition:unknown,code:HospitalErrorCode,message:string):asserts condition;
export declare function assertIdentifier(value:unknown,field?:string):string;
export declare function assertDate(value:unknown):string;
export declare function localClock(at:Date|string):{date:string;minuteOfDay:number};
export declare function classifyMealTiming(args:{cycleId:CycleId;localDate:string;at:Date|string;mealType?:MealType}):{cycleId:CycleId;localDate:string;stage:'ON_TIME'|'LATE_BEFORE_TOLERANCE'|'AFTER_TOLERANCE';mapOnTime:boolean;principalDeliveryTolerancePassed:boolean;recommendation:'ROUTINE'|'SECONDARY_OR_CLINICAL_ESCALATION'|'KITCHEN_REVIEW';requestedMealType:MealType;requiresAmendment:boolean};
export declare function assertMealReleaseSafe(args:{fasting:boolean;allergyCodes?:string[];dietRestrictionCodes?:string[]}):void;
export declare function nextMealStatus(current:MealStatus,next:MealStatus):MealStatus;
export declare function nextMapStatus(current:MapStatus,next:MapStatus):MapStatus;
export declare function nextLocationStatus(current:LocationStatus,next:LocationStatus):LocationStatus;
export declare function nextNutritionAuditStatus(current:NutritionAuditStatus,next:NutritionAuditStatus):NutritionAuditStatus;
