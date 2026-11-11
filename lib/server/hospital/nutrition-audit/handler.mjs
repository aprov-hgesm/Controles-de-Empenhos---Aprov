import { HospitalError } from '../../../../features/hospital/core/domain.mjs';
import { resolveHospitalScope } from '../core/auth.mjs';
import { NutritionAuditService } from './service.mjs';
const reads={
  'finding.list':(svc,scope,p)=>svc.listFindings(scope,p),
  'medical.list':(svc,scope,p)=>svc.listMedicalContacts(scope,p),
  'history.read':(svc,scope,p)=>svc.readHistory(scope,p),
  'patients.list':(svc,scope,p)=>svc.listPatients(scope,p),
  'patient.diet':(svc,scope,p)=>svc.readPatientDiet(scope,p),
  'alerts.list':(svc,scope,p)=>svc.listAlerts(scope,p),
  'summary.read':(svc,scope,p)=>svc.summary(scope,p),
  'report.csv':(svc,scope,p)=>svc.reportCsv(scope,p),
  'catalog.read':(svc,scope,p)=>svc.catalog(scope,p.unitId),
};
const writes={
  'finding.create':(svc,scope,p)=>svc.createFinding(scope,p),
  'finding.transition':(svc,scope,p)=>svc.transitionFinding(scope,p),
  'medical.contact':(svc,scope,p)=>svc.recordMedicalContact(scope,p),
  'medical.response':(svc,scope,p)=>svc.recordMedicalResponse(scope,p),
  'medical.close':(svc,scope,p)=>svc.closeMedicalContact(scope,p),
  'catalog.configure':(svc,scope,p)=>svc.configureCatalog(scope,p),
};
/** No header-based role escalation: Firebase token and W0 QA membership verified on every call. */
export function createNutritionAuditHandler({store,verifyToken}) {
  const service=new NutritionAuditService(store);
  return async function handle({method='GET',authorization,organizationId,operation,payload={}}) {
    try {
      const methods=method==='GET'?reads:method==='POST'?writes:null;
      if(!methods || !Object.hasOwn(methods,operation))throw new HospitalError('INVALID','Operação ou método não permitido');
      const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
      const data=methods[operation](service,scope,payload ?? {});
      return {status:200,body:{ok:true,data}};
    }catch(error){const code=error instanceof HospitalError?error.code:'UNAVAILABLE';return {status:{UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503}[code]??503,body:{ok:false,error:{code,message:error instanceof HospitalError?error.message:'Auditoria indisponível'}}};}
  };
}
