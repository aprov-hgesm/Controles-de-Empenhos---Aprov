import type {HospitalRole} from '../core/contracts';
export interface HospitalMenuItem{id:string;label:string;role:HospitalRole}
export function menuForRoles(roles:readonly HospitalRole[]):HospitalMenuItem[];
export function canOpenPage(roles:readonly HospitalRole[],page:string):boolean;
export function firstPage(roles:readonly HospitalRole[]):string|null;
