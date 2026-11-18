import {resolveHospitalScope} from './auth.mjs';
import {HospitalCoreService} from './service.mjs';
import {HospitalError} from '../../../../features/hospital/core/domain.mjs';
/** Server-side adapter: call from W2/W3 etc route handlers; no untrusted client roles. */
export function createHospitalCoreHandler({store,verifyToken}) {
  const service=new HospitalCoreService(store);
  const operations={
    'map.create':(s,p)=>service.createDraftMap(s,p),
    'map.submit':(s,p)=>service.submitMap(s,p),
    'map.close':(s,p)=>service.closeMap(s,p),
    'meal.request':(s,p)=>service.addMealRequest(s,p),
    'meal.advance':(s,p)=>service.advanceMeal(s,p),
    'audit.open':(s,p)=>service.openNutritionAudit(s,p),
  };
  return async function handle({authorization,organizationId,operation,payload}) {
    try {
      if(!Object.hasOwn(operations,operation))throw new HospitalError('INVALID','Comando desconhecido');
      const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
      const data=operations[operation](scope,payload??{});
      return {status:200,body:{ok:true,data}};
    } catch(err) {
      const code=err instanceof HospitalError?err.code:'UNAVAILABLE';
      const status={UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503}[code];
      return {status,body:{ok:false,error:{code,message:err instanceof HospitalError?err.message:'Serviço hospitalar indisponível'}}};
    }
  };
}
