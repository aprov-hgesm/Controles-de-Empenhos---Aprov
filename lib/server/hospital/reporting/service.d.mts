import type {HospitalScope} from '../../../../features/hospital/core/contracts';
import type {HospitalQAStore} from '../core/qa-store.mjs';
export declare class HospitalReportingService {
  constructor(store:HospitalQAStore);
  query(scope:HospitalScope,args?:{view?:'maps'|'production'|'timeliness'|'occurrences'|'nutrition'|'waste';filters?:Record<string,unknown>;page?:number;pageSize?:number}):{
    view:string;filters:Record<string,unknown>;rows:Record<string,unknown>[];summary:Record<string,unknown>;
    page:number;pageSize:number;total:number;totalPages:number;partial:boolean;generatedAt:string;source:string;auditTimezone:string;estimatedReadRows:number;notice:string;
  };
}
