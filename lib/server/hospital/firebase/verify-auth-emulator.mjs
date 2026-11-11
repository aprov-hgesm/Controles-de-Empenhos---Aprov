import {HospitalError, assertHospital} from '../../../../features/hospital/core/domain.mjs';

const PROJECT='demo-cozinha-dietetica';
const ISSUER='https://securetoken.google.com/'+PROJECT;

/**
 * QA-only verifier of Firebase Auth emulator ID tokens. Never accepts production
 * sessions: loopback host + demo project + explicit QA flag + account lookup
 * must ALL match. The emulator is an isolated fixture, not a trusted identity
 * service for any deployed clinical runtime.
 */
export async function verifyHospitalEmulatorIdToken(token,{fetchImpl=globalThis.fetch}={}){
  assertHospital(process.env.NODE_ENV!=='production'&&process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1',
    'UNAUTHORIZED','Emulador Auth não autorizado');
  const host=process.env.FIREBASE_AUTH_EMULATOR_HOST;
  assertHospital(typeof host==='string'&&/^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host),
    'UNAUTHORIZED','Emulador de identidade obrigatório');
  assertHospital(typeof token==='string'&&token.length>20&&token.length<16000,
    'UNAUTHORIZED','Token inválido');
  let claims,header;
  try{
    const [h,p]=token.split('.');
    header=JSON.parse(Buffer.from(h,'base64url').toString('utf8'));
    claims=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));
  }catch{throw new HospitalError('UNAUTHORIZED','Token de QA inválido')}
  assertHospital(header?.alg==='none'&&claims?.iss===ISSUER&&claims?.aud===PROJECT
    &&typeof claims.sub==='string'&&claims.sub.length>=1&&claims.sub.length<=128
    &&Number.isInteger(claims.exp)&&claims.exp>Math.floor(Date.now()/1000)
    &&Number.isInteger(claims.auth_time)&&claims.auth_time>0,
    'UNAUTHORIZED','Token de emulador incorreto');
  let response;
  try{
    response=await fetchImpl('http://'+host+'/identitytoolkit.googleapis.com/v1/accounts:lookup?key=synthetic',
      {method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(5000),cache:'no-store'});
  }catch{throw new HospitalError('UNAUTHORIZED','Identidade de QA indisponível')}
  assertHospital(response.ok,'UNAUTHORIZED','Conta de QA não verificada');
  const body=await response.json();
  const user=body.users?.find(x=>x.localId===claims.sub);
  const validSince=Number(user?.validSince);
  assertHospital(user&&user.disabled!==true&&Number.isSafeInteger(validSince)
    &&claims.auth_time>=validSince,'UNAUTHORIZED','Conta QA revogada ou desabilitada');
  return Object.freeze({uid:claims.sub});
}
