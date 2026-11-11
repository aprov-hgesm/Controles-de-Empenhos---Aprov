import {resolveHospitalScope} from '../core/auth.mjs';
import {HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {HospitalPatientsService} from './service.mjs';

const operations={
  'patient.register':'registerPatient',
  'patient.update':'updatePatient',
  'patient.get':'getPatient',
  'patient.search':'search',
  'bed.list':'listBeds',
  'bed.save':'saveBed',
  'admission.admit':'admit',
  'admission.get':'getAdmission',
  'admission.changeBed':'changeBed',
  'admission.planTransfer':'planTransfer',
  'admission.cancelTransfer':'cancelTransfer',
  'admission.confirmTransfer':'confirmTransfer',
  'admission.temporaryDeparture':'temporaryDeparture',
  'admission.temporaryReturn':'temporaryReturn',
  'admission.planDischarge':'planDischarge',
  'admission.cancelDischarge':'cancelDischarge',
  'admission.confirmDischarge':'confirmDischarge',
  'admission.history':'history',
  'admission.notices':'listNotices'
};
export function createHospitalPatientsHandler({store,verifyToken}={}) {
  const service=new HospitalPatientsService(store);
  return async function handle({authorization,organizationId,operation,payload={}}={}) {
    try {
      if(!Object.hasOwn(operations,operation)) throw new HospitalError('INVALID','Comando desconhecido');
      const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
      const data=service[operations[operation]](scope,payload);
      return {status:200,body:{ok:true,data}};
    }catch(error){
      const code=error instanceof HospitalError?error.code:'UNAVAILABLE';
      return {status:{UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503}[code]??503,
        body:{ok:false,error:{code,message:error instanceof HospitalError?error.message:'Serviço hospitalar indisponível'}}};
    }
  };
}
