import type {HospitalQAStore} from './qa-store.mjs';
import type {HospitalResult} from '../../../../features/hospital/core/contracts';
export declare function createHospitalCoreHandler(config:{store:HospitalQAStore;verifyToken?:(token:string)=>Promise<{uid:string}>}): (req:{authorization:string;organizationId:string;operation:string;payload:Record<string,unknown>})=>Promise<{status:number;body:HospitalResult<unknown>}>;
