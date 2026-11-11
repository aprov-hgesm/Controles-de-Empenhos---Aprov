import type {HospitalScope} from '../../../../features/hospital/core/contracts';
export declare class NutritionAuditService {
  constructor(store:unknown);
  catalog(scope:HospitalScope,unitId:string):any;
  configureCatalog(scope:HospitalScope,data:Record<string,unknown>):any;
  createFinding(scope:HospitalScope,data:Record<string,unknown>):any;
  transitionFinding(scope:HospitalScope,data:Record<string,unknown>):any;
  recordMedicalContact(scope:HospitalScope,data:Record<string,unknown>):any;
  recordMedicalResponse(scope:HospitalScope,data:Record<string,unknown>):any;
  closeMedicalContact(scope:HospitalScope,data:Record<string,unknown>):any;
  listFindings(scope:HospitalScope,filters:Record<string,unknown>):any;
  listMedicalContacts(scope:HospitalScope,filters:Record<string,unknown>):any;
  readHistory(scope:HospitalScope,filters:Record<string,unknown>):any;
  readPatientDiet(scope:HospitalScope,filters:Record<string,unknown>):any;
  listPatients(scope:HospitalScope,filters:Record<string,unknown>):any;
  listAlerts(scope:HospitalScope,filters:Record<string,unknown>):any;
  summary(scope:HospitalScope,filters:Record<string,unknown>):any;
  reportCsv(scope:HospitalScope,filters:Record<string,unknown>):string;
}
