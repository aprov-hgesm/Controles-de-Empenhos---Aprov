export class ProductionService {
 constructor(store:any);
 snapshot(scope:any,query:any):Promise<any>;
 createBatch(scope:any,args:any):Promise<any>;
 startBatch(scope:any,args:any):Promise<any>;
 completeBatch(scope:any,args:any):Promise<any>;
 acknowledgeBatch(scope:any,args:any):Promise<any>;
 reconcileBatch(scope:any,args:any):Promise<any>;
 cancelBatch(scope:any,args:any):Promise<any>;
 flagAffected(scope:any,args:any):Promise<any>;
}
