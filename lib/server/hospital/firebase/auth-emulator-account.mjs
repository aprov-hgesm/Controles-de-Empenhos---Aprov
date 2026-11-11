import {assertHospital,HospitalError} from '../../../../features/hospital/core/domain.mjs';
/** QA-only administrative Firebase Auth emulator lookup, no production identity access. */
export async function hospitalQaUserExists(uid,{fetchImpl=globalThis.fetch}={}){
  assertHospital(process.env.NODE_ENV!=='production'&&process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1',
    'UNAVAILABLE','QA Auth fechado');
  const host=process.env.FIREBASE_AUTH_EMULATOR_HOST;
  assertHospital(typeof host==='string'&&/^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host),
    'UNAVAILABLE','Emulador Auth obrigatório');
  assertHospital(typeof uid==='string'&&/^[A-Za-z0-9_:-]{1,128}$/.test(uid),'INVALID','UID inválido');
  let response;
  try{
    response=await fetchImpl('http://'+host+'/emulator/v1/projects/demo-cozinha-dietetica/accounts',
      {headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(5000)});
  }catch{throw new HospitalError('UNAVAILABLE','Consulta Auth QA indisponível')}
  assertHospital(response?.ok,'UNAVAILABLE','Diretório Auth QA indisponível');
  const data=await response.json();
  return Array.isArray(data.users)&&data.users.some(x=>x.localId===uid&&x.disabled!==true);
}
