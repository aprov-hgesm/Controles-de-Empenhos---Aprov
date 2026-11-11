import {HospitalFirestoreStore} from './firestore-store.mjs';
import {HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {assertHospitalGcpQaRuntime} from './gcp-qa-runtime.mjs';

let singleton=null;
/** Absolutely no fallback, no principal Firestore, no production credentials. */
export function getHospitalW10Store() {
  if(process.env.HOSPITAL_GCP_QA_ENABLED==='1'){
    assertHospitalGcpQaRuntime();
    if(!singleton)singleton=new HospitalFirestoreStore({transport:'gcp',project:'cozinha-dietetica',host:undefined});
    return singleton;
  }
  if(process.env.NODE_ENV==='production'||process.env.HOSPITAL_FIRESTORE_QA_ENABLED!=='1')
    throw new HospitalError('UNAVAILABLE','QA hospitalar Firestore desabilitado');
  if(!singleton)singleton=new HospitalFirestoreStore();
  return singleton;
}
