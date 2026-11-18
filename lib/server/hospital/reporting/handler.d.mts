import type {HospitalQAStore} from '../core/qa-store.mjs';
export declare function createHospitalReportingHandler(config:{
  store:HospitalQAStore;verifyToken?:(token:string)=>Promise<{uid:string}>;
}):(args:{
  authorization:string;organizationId:string;view?:string;filters?:Record<string,unknown>;
  page?:number;pageSize?:number;format?:'csv'|'pdf'|null;
})=>Promise<{status:number;headers:Record<string,string>;body?:{ok:boolean;data?:unknown;error?:{code:string;message:string}};bytes?:Uint8Array}>;
