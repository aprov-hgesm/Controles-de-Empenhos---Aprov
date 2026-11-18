import type {HospitalQAStore} from '../core/qa-store.mjs';
export declare function createHospitalPatientsHandler(input:{
  store:HospitalQAStore,
  verifyToken?:(token:string)=>Promise<{uid:string}>
}): (params:{
  authorization:string,
  organizationId:string,
  operation:string,
  payload?:Record<string,unknown>
})=>Promise<{status:number,body:{ok:boolean,data?:unknown,error?:{code:string,message:string}}}>;
