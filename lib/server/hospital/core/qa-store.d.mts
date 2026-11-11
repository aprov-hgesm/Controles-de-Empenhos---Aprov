import type {HospitalMembership,HospitalOrganization,DietMapVersion,AuditEvent} from '../../../../features/hospital/core/contracts';
export declare class HospitalQAStore {
  constructor(args:{filename:string;qa:true});
  close():void;
  transaction<T>(run:(store:HospitalQAStore)=>T):T;
  now():string;
  /** Strictly synthetic fixture seeding: QA only, never expose as HTTP endpoint. */
  seedOrganization(value:HospitalOrganization):void;
  seedMembership(value:HospitalMembership):void;
  findOrganization(organizationId:string):HospitalOrganization|null;
  findMembership(organizationId:string,uid:string):HospitalMembership|null;
  get<T=unknown>(organizationId:string,kind:string,id:string):T|null;
  list<T=unknown>(organizationId:string,kind:string,unitId:string):T[];
  put<T extends {id:string;organizationId:string;unitId:string;revision?:number}>(organizationId:string,kind:string,unitId:string,value:T,expectedRevision?:number):T&{revision:number};
  saveMapVersion(organizationId:string,mapId:string,version:number,kind:string,snapshot:unknown,reason:string|null,actorUid:string):DietMapVersion;
  listMapVersions(organizationId:string,mapId:string):DietMapVersion[];
  ensureMealUnique(organizationId:string,admissionId:string,localDate:string,cycleId:string,mealType:string,id:string):void;
  getMealKey(organizationId:string,admissionId:string,localDate:string,cycleId:string,mealType:string):string|null;
  appendEvent(org:string,kind:string,id:string,type:string,uid:string,payload:unknown,effectiveAt?:string|null):AuditEvent;
  events(org:string,kind:string,id:string):AuditEvent[];
  idempotent<T>(org:string,operation:string,key:string,requestHash:string,fn:()=>T):T;
}
