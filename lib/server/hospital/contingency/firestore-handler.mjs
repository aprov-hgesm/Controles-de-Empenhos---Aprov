import {HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {resolveHospitalScope} from '../core/auth.mjs';
import {HospitalContingencyService} from './firestore-service.mjs';

const codes={UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,
 NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503};

/** QA-only API: verified hospital Auth + membership; no untrusted role claims. */
export function createHospitalContingencyHandler({store,verifyToken}){
 const service=new HospitalContingencyService(store);
 return async function handle({authorization,organizationId,operation,payload}){
  try {
   if(operation!=='downtime.record')throw new HospitalError('INVALID','Operação inválida');
   const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
   const data=await service.registerExternalRecord(scope,payload);
   return {status:200,body:{ok:true,data}};
  }catch(error){
   const code=error instanceof HospitalError?error.code:'UNAVAILABLE';
   return {status:codes[code]??503,body:{ok:false,error:{
    code,message:error instanceof HospitalError?error.message:'Contingência indisponível'
   }}};
  }
 };
}
