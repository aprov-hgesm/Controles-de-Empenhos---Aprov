import {resolveHospitalScope} from '../core/auth.mjs';
import {HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {HospitalAdministrationService} from './service.mjs';

const responseStatus={UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503};
/** Strict allowlist: client cannot pass roles/scopes as authority. */
export function createHospitalAdministrationHandler({store,verifyToken,userExists}={}) {
  const service=new HospitalAdministrationService(store,{userExists});
  const reads={
    'overview':s=>service.overview(s),
    'units.list':s=>service.listUnits(s),
    'members.list':s=>service.listMembers(s),
    'settings.read':s=>service.getPolicy(s),
    'audit.list':(s,p)=>service.auditList(s,p),
  };
  const writes={
    'unit.save':(s,p)=>service.saveUnit(s,p),
    'bed.save':(s,p)=>service.saveBed(s,p),
    'membership.save':(s,p)=>service.saveMember(s,p),
    'membership.revoke':(s,p)=>service.revokeMember(s,p),
    'settings.save':(s,p)=>service.savePolicy(s,p),
  };
  return async function handle({authorization,organizationId,operation,payload={},method='GET'}) {
    try {
      const commands=method==='GET'?reads:method==='POST'?writes:null;
      if(!commands||!Object.hasOwn(commands,operation))throw new HospitalError('INVALID','Operação administrativa não autorizada');
      const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
      const data=await commands[operation](scope,payload??{});
      return {status:200,body:{ok:true,data}};
    } catch(err) {
      const code=err instanceof HospitalError?err.code:'UNAVAILABLE';
      return {status:responseStatus[code]??503,body:{ok:false,error:{code,message:err instanceof HospitalError?err.message:'Serviço hospitalar indisponível'}}};
    }
  };
}
