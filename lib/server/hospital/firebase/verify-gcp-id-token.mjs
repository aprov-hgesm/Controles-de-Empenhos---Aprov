import {createRemoteJWKSet,jwtVerify} from 'jose';
import {HospitalError,assertHospital} from '../../../../features/hospital/core/domain.mjs';
import {HOSPITAL_PROJECT,assertHospitalGcpQaRuntime,hospitalMetadataIdentity,requireHospitalCloudIdentity} from './gcp-qa-runtime.mjs';

const issuer='https://securetoken.google.com/'+HOSPITAL_PROJECT;
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),{timeoutDuration:5000});
const directory='https://identitytoolkit.googleapis.com/v1/projects/'+HOSPITAL_PROJECT+'/accounts:lookup';

/** Admin account lookup uses hospital OAuth IAM, never a public API key. */
export async function hospitalGcpUserAccount(uid,{
  fetchImpl=globalThis.fetch,identityProvider=()=>hospitalMetadataIdentity(fetchImpl)
}={}) {
  assertHospitalGcpQaRuntime();
  assertHospital(typeof uid==='string'&&/^[A-Za-z0-9_:-]{1,128}$/.test(uid),'UNAUTHORIZED','UID hospitalar inválido');
  const identity=requireHospitalCloudIdentity(await identityProvider());
  let response;
  try {
    response=await fetchImpl(directory,{
      method:'POST',cache:'no-store',
      headers:{Authorization:'Bearer '+identity.accessToken,'Content-Type':'application/json'},
      body:JSON.stringify({localId:[uid]}),
      signal:AbortSignal.timeout(6000),
    });
  }catch {throw new HospitalError('UNAVAILABLE','Diretório hospitalar indisponível');}
  assertHospital(response?.ok,'UNAVAILABLE','Consulta IAM Auth recusada');
  let data;
  try{data=await response.json();}
  catch {throw new HospitalError('UNAVAILABLE','Resposta Auth inválida');}
  const account=Array.isArray(data?.users)?data.users.find(u=>u.localId===uid):null;
  return account??null;
}

/** Verifies JWT/project/time and live disabled/revoked account state at each request. */
export async function verifyHospitalGcpIdToken(token,{
  verifyJwt=(t)=>jwtVerify(t,jwks,{issuer,audience:HOSPITAL_PROJECT,algorithms:['RS256'],clockTolerance:5}),
  lookupUser=hospitalGcpUserAccount,
}={}) {
  assertHospitalGcpQaRuntime();
  assertHospital(typeof token==='string'&&token.length>=20&&token.length<=16000,
    'UNAUTHORIZED','Token hospitalar inválido');
  let payload;
  try {({payload}=await verifyJwt(token));}
  catch {throw new HospitalError('UNAUTHORIZED','Token hospitalar inválido');}
  const now=Math.floor(Date.now()/1000);
  assertHospital(payload?.iss===issuer&&payload?.aud===HOSPITAL_PROJECT
    &&typeof payload.sub==='string'&&payload.sub.length>0&&payload.sub.length<=128
    &&Number.isInteger(payload.iat)&&payload.iat<=now+5
    &&Number.isInteger(payload.exp)&&payload.exp>now-5
    &&Number.isInteger(payload.auth_time)&&payload.auth_time>0&&payload.auth_time<=now+5
    &&payload.firebase?.sign_in_provider!=='custom' /* custom token sessions are not clinical auth */,
    'UNAUTHORIZED','Claims Firebase hospitalares inválidas');
  const user=await lookupUser(payload.sub);
  const validSince=Number(user?.validSince);
  assertHospital(user?.disabled!==true&&user?.localId===payload.sub
    &&Number.isSafeInteger(validSince)&&validSince>=0
    &&payload.auth_time>=validSince,
    'UNAUTHORIZED','Conta desabilitada ou sessão revogada');
  return Object.freeze({uid:payload.sub});
}
export async function hospitalGcpUserExists(uid) {
  const user=await hospitalGcpUserAccount(uid);
  return Boolean(user&&user.disabled!==true);
}
