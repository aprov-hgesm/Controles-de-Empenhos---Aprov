import type {HospitalScope} from '../../../../features/hospital/core/contracts';
import type {HospitalQAStore} from '../core/qa-store.mjs';
export declare class HospitalDietsService{
 constructor(store:HospitalQAStore);
 listCatalog(scope:HospitalScope,args:{unitId?:string;includeInactive?:boolean}):unknown[];
 getCatalog(scope:HospitalScope,args:{unitId?:string;catalogItemId:string}):unknown;
 saveCatalog(scope:HospitalScope,args:{catalogItemId:string;code:string;label:string;type:'ORAL'|'ENTERAL'|'SUPPLEMENT'|'OTHER';consistency?:string;route?:string;device?:string|null;restrictionCodes?:string[];allergenCodes?:string[];volumeMl?:number|null;unit?:string;preparations?:string[];status?:'ACTIVE'|'INACTIVE';expectedRevision?:number}):unknown;
 catalogHistory(scope:HospitalScope,args:{catalogItemId:string}):unknown[];
 listReferences(scope:HospitalScope,args:{unitId:string;admissionId:string}):unknown[];
 getCurrentReference(scope:HospitalScope,args:{unitId:string;admissionId:string}):unknown;
 recordReference(scope:HospitalScope,args:{unitId:string;admissionId:string;referenceId:string;catalogItemId:string;sourceRef:string;sourceVersion:string;prescriberAsRecorded:string;prescribedAt:string;effectiveAt?:string|null;restrictionCodes?:string[];allergyCodes?:string[];fasting:boolean}):unknown;
}
