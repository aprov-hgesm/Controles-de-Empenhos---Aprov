import type {HospitalScope,Patient,Admission,Bed,PatientLocationEvent,AuditEvent} from '../../../../features/hospital/core/contracts';
import type {HospitalQAStore} from '../core/qa-store.mjs';
type AnyArgs = Record<string,any>;
export declare class HospitalPatientsService {
 constructor(store: HospitalQAStore);
 registerPatient(scope:HospitalScope,args:AnyArgs):Patient & {revision:number,unitId:string};
 updatePatient(scope:HospitalScope,args:AnyArgs):Patient & {revision:number,unitId:string};
 saveBed(scope:HospitalScope,args:AnyArgs):Bed & {revision:number,occupied?:boolean};
 listBeds(scope:HospitalScope,args:AnyArgs):(Bed & {occupied:boolean})[];
 admit(scope:HospitalScope,args:AnyArgs):Admission;
 getPatient(scope:HospitalScope,args:AnyArgs):Patient;
 getAdmission(scope:HospitalScope,args:AnyArgs):{admission:Admission,patient:Patient,medicalReferenceId:string|null};
 search(scope:HospitalScope,args:AnyArgs):{items:Array<{patient:Patient,admission:Admission|null,bedLabel:string,medicalReferenceId:string|null}>,total:number,limit:number,offset:number};
 changeBed(scope:HospitalScope,args:AnyArgs):Admission;
 planTransfer(scope:HospitalScope,args:AnyArgs):PatientLocationEvent;
 cancelTransfer(scope:HospitalScope,args:AnyArgs):PatientLocationEvent;
 confirmTransfer(scope:HospitalScope,args:AnyArgs):{event:PatientLocationEvent,admission:Admission};
 temporaryDeparture(scope:HospitalScope,args:AnyArgs):Admission;
 temporaryReturn(scope:HospitalScope,args:AnyArgs):Admission;
 planDischarge(scope:HospitalScope,args:AnyArgs):Admission;
 cancelDischarge(scope:HospitalScope,args:AnyArgs):Admission;
 confirmDischarge(scope:HospitalScope,args:AnyArgs):Admission;
 history(scope:HospitalScope,args:AnyArgs):AuditEvent[];
 listNotices(scope:HospitalScope,args:AnyArgs):unknown[];
}
