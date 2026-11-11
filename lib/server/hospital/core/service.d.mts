import type {HospitalScope,Admission,DietMap,MealRequest,NutritionAudit,Patient,MedicalDietReference,DietCatalogItem,PatientLocationEvent,DietMapVersion,MealStatus,AuditEvent} from '../../../../features/hospital/core/contracts';
import type {HospitalQAStore} from './qa-store.mjs';
export declare class HospitalCoreService {
  constructor(store:HospitalQAStore);
  get<T=unknown>(scope:HospitalScope,kind:string,recordId:string,unitId:string):T;
  list<T=unknown>(scope:HospitalScope,kind:string,unitId:string):T[];
  createPatient(scope:HospitalScope,args:{patientId:string;unitId:string;referenceCode:string}):Patient&{revision:number;unitId:string};
  upsertDietCatalogItem(scope:HospitalScope,args:{catalogItemId:string;code:string;label:string;restrictionCodes?:string[]}):DietCatalogItem&{revision:number;unitId:string};
  createAdmission(scope:HospitalScope,args:{admissionId:string;patientId:string;unitId:string;bedId?:string|null;fasting?:boolean;allergyCodes?:string[]}):Admission;
  updateClinicalSafety(scope:HospitalScope,args:{admissionId:string;unitId:string;fasting:boolean;allergyCodes:string[];expectedRevision:number}):Admission;
  recordMedicalDiet(scope:HospitalScope,args:{referenceId:string;admissionId:string;unitId:string;catalogItemId:string;sourceRef:string;prescribedAt:string}):MedicalDietReference&{revision:number;unitId:string};
  createDraftMap(scope:HospitalScope,args:{unitId:string;localDate:string;cycleId:'06'|'10'|'16'}):DietMap;
  addMealRequest(scope:HospitalScope,args:{mapId:string;admissionId:string;mealType:'PRIMARY'|'SECONDARY';dietCode:string;medicalReferenceId:string;idempotencyKey:string;reason?:string|null;effectiveAt?:string|null}):MealRequest;
  submitMap(scope:HospitalScope,args:{mapId:string;expectedRevision:number;reason?:string|null}):DietMap;
  closeMap(scope:HospitalScope,args:{mapId:string;expectedRevision:number}):DietMap;
  advanceMeal(scope:HospitalScope,args:{mealId:string;unitId:string;next:MealStatus;expectedRevision:number}):MealRequest;
  planTransfer(scope:HospitalScope,args:{eventId:string;admissionId:string;fromUnitId:string;toUnitId:string;effectiveAt?:string|null}):PatientLocationEvent;
  confirmTransfer(scope:HospitalScope,args:{eventId:string;fromUnitId:string;expectedRevision:number}):PatientLocationEvent;
  openNutritionAudit(scope:HospitalScope,args:{auditId:string;unitId:string;admissionId:string;observation:string}):NutritionAudit;
  transitionNutritionAudit(scope:HospitalScope,args:{auditId:string;unitId:string;next:'CONTACTED'|'FOLLOW_UP'|'CLOSED';expectedRevision:number}):NutritionAudit;
  auditTrail(scope:HospitalScope,args:{kind:string;recordId:string;unitId:string}):AuditEvent[];
  listMapVersions(scope:HospitalScope,args:{mapId:string;unitId:string}):DietMapVersion[];
}
