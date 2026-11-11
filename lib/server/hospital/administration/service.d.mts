import type {HospitalQAStore} from '../core/qa-store.mjs';
import type {HospitalScope} from '../../../../features/hospital/core/contracts';
export declare const DEFAULT_HOSPITAL_POLICY: Readonly<Record<string,unknown>>;
export declare class HospitalAdministrationService {
  constructor(store:HospitalQAStore,options?:{userExists?:(uid:string)=>Promise<boolean>});
  overview(scope:HospitalScope):unknown;
  listUnits(scope:HospitalScope):unknown;
  saveUnit(scope:HospitalScope,input:any):unknown;
  saveBed(scope:HospitalScope,input:any):unknown;
  listMembers(scope:HospitalScope):unknown;
  saveMember(scope:HospitalScope,input:any):Promise<unknown>;
  revokeMember(scope:HospitalScope,input:any):unknown;
  getPolicy(scope:HospitalScope):unknown;
  savePolicy(scope:HospitalScope,input:any):unknown;
  auditList(scope:HospitalScope,input?:{limit?:number}):unknown;
}
