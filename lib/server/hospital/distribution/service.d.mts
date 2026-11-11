import type {HospitalScope} from '../../../../features/hospital/core/contracts';
import type {HospitalQAStore} from '../core/qa-store.mjs';
export declare class DistributionService {
  constructor(store:HospitalQAStore);
  command(scope:HospitalScope,operation:string,payload:Record<string,unknown>):unknown;
  status(scope:HospitalScope,args:{unitId:string;mealId:string}):{
    mealId:string;mealStatus:string;distributionState:string;jobRevision:number|null;
    destinationUnitId:string|null;routeReconciliationRequired:boolean;mainMealAlert:string|null;
  };
  printLabel(scope:HospitalScope,args:{unitId:string;mealId:string;format?:'80mm'|'A6'|'A4'}):string;
}
