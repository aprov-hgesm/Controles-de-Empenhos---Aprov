import {HospitalFirestoreStore} from './firestore-store.mjs';
import {HospitalError} from '../../../../features/hospital/core/domain.mjs';

let singleton=null;
/** Absolutely no fallback, no principal Firestore, no production credentials. */
export function getHospitalW10Store() {
  if(process.env.NODE_ENV==='production'||process.env.HOSPITAL_FIRESTORE_QA_ENABLED!=='1')
    throw new HospitalError('UNAVAILABLE','QA hospitalar Firestore desabilitado');
  if(!singleton)singleton=new HospitalFirestoreStore();
  return singleton;
}
