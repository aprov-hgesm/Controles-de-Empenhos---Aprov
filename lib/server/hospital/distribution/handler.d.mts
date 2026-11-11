import type {HospitalQAStore} from '../core/qa-store.mjs';
export interface HospitalDistributionResponse {
  status:number;
  headers:Record<string,string>;
  html?:string;
  body?:{ok:true;data:unknown}|{ok:false;error:{code:string;message:string}};
}
export declare function createDistributionHandler(args:{
  store:HospitalQAStore;
  verifyToken?:(token:string)=>Promise<{uid:string}>;
}):(args:{
  authorization:string;
  organizationId:string;
  operation:string;
  payload?:Record<string,unknown>;
})=>Promise<HospitalDistributionResponse>;
