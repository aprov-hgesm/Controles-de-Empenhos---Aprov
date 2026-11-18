import type {HospitalQAStore} from '../core/qa-store.mjs';
export declare function createHospitalW3Handler(args:{store:HospitalQAStore;verifyToken?:(token:string)=>Promise<{uid:string}>}):(
 args:{authorization:string;organizationId:string;operation:string;payload:Record<string,unknown>;area:'maps'|'diets'}
)=>Promise<{status:number;body:{ok:true;data:unknown}|{ok:false;error:{code:string;message:string}}}>;
export declare function getW3QAStore():HospitalQAStore;
