import type {HospitalScope} from '../../../../features/hospital/core/contracts';
import type {HospitalQAStore} from '../core/qa-store.mjs';
export declare class HospitalMapsService{
 constructor(store:HospitalQAStore);
 listAdmissions(scope:HospitalScope,args:{unitId:string}):unknown[];
 listKitchenQueue(scope:HospitalScope,args:{unitId:string;localDate?:string;cycleId?:'06'|'10'|'16'}):unknown[];
 createDraft(scope:HospitalScope,args:{unitId:string;localDate:string;cycleId:'06'|'10'|'16'}):unknown;
 listMaps(scope:HospitalScope,args:{unitId:string;localDate?:string;cycleId?:'06'|'10'|'16';status?:string;late?:boolean;patientId?:string;bedId?:string;dietCode?:string;mealType?:string;version?:number;restrictionCode?:string}):unknown[];
 getMap(scope:HospitalScope,args:{mapId:string}):unknown;
 receipt(scope:HospitalScope,args:{mapId:string}):unknown;
 listVersions(scope:HospitalScope,args:{mapId:string}):unknown[];
 setMeal(scope:HospitalScope,args:{mapId:string;admissionId:string;mealType:'PRIMARY'|'SECONDARY';medicalReferenceId:string;dietCode:string;expectedMapRevision:number;idempotencyKey:string;reason?:string|null;effectiveAt?:string|null}):unknown;
 removeMeal(scope:HospitalScope,args:{mapId:string;mealId:string;expectedMapRevision:number;expectedMealRevision:number;reason?:string|null;idempotencyKey:string}):unknown;
 submitMap(scope:HospitalScope,args:{mapId:string;expectedRevision:number;idempotencyKey:string;lateReason?:string|null}):unknown;
 closeDue(scope:HospitalScope,args:{mapId:string;expectedRevision:number;idempotencyKey:string}):unknown;
 escalateClinicalException(scope:HospitalScope,args:{mapId:string;admissionId:string;mealType:'PRIMARY'|'SECONDARY';reason:string;contactReference:string;idempotencyKey:string}):unknown;
}
