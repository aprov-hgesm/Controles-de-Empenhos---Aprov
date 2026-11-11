import {resolveHospitalScope} from '../core/auth.mjs';
import {HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {DistributionService} from './service.mjs';

const httpStatus={UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503};

/** Reusable server-only adapter. Tests inject verifier; HTTP never supplies roles/UID/clock. */
export function createDistributionHandler({store,verifyToken}){
  const service=new DistributionService(store);
  return async function handle({authorization,organizationId,operation,payload={}}){
    try{
      if(!['distribution.status','label.print','assembly.start','assembly.complete','assembly.check','assembly.reopen','meal.suspend','batch.dispatch','batch.receive','meal.deliver','meal.return','meal.cancel','route.flag'].includes(operation))
        throw new HospitalError('INVALID','Operação de distribuição desconhecida');
      const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
      if(operation==='label.print'){
        const html=service.printLabel(scope,payload);
        return {status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'"},html};
      }
      const data=operation==='distribution.status'?service.status(scope,payload):service.command(scope,operation,payload);
      return {status:200,headers:{'cache-control':'no-store, private','x-content-type-options':'nosniff'},body:{ok:true,data}};
    }catch(e){
      const code=e instanceof HospitalError?e.code:'UNAVAILABLE';
      return {status:httpStatus[code]||503,headers:{'cache-control':'no-store, private'},body:{ok:false,error:{code,message:e instanceof HospitalError?e.message:'Serviço hospitalar indisponível'}}};
    }
  };
}
