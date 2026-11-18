import type {HospitalScope,HospitalPermission} from '../../../../features/hospital/core/contracts';
export declare function verifyFirebaseHospitalToken(token:string):Promise<{uid:string}>;
export declare function resolveHospitalScope(args:{authorization:string;organizationId:string;store:{findMembership(org:string,uid:string):any;findOrganization(org:string):any};verifyToken?:(token:string)=>Promise<{uid:string}>}):Promise<HospitalScope>;
export declare function requireHospitalPermission(scope:HospitalScope,permission:HospitalPermission,unitId?:string):HospitalScope;
export declare function requireHospitalOrganization(scope:HospitalScope,organizationId:string):HospitalScope;
