import {HospitalError,assertHospital} from '../../../../features/hospital/core/domain.mjs';

// This module is server-only and deliberately requires an isolated Cloud Run
// service. An env flag alone cannot activate hospital access on EMPROVEX.
export const HOSPITAL_PROJECT='cozinha-dietetica';
export const HOSPITAL_SERVICE='cozinha-dietetica-qa';
export const HOSPITAL_REGION='southamerica-east1';
const METADATA='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default';

export function isHospitalGcpQaRuntime(env=process.env) {
  return env.NODE_ENV==='production'
    && env.HOSPITAL_GCP_QA_ENABLED==='1'
    && env.HOSPITAL_FIRESTORE_QA_ENABLED==='1'
    && env.HOSPITAL_FIRESTORE_PROJECT_ID===HOSPITAL_PROJECT
    && env.GOOGLE_CLOUD_PROJECT===HOSPITAL_PROJECT
    && env.K_SERVICE===HOSPITAL_SERVICE
    && env.HOSPITAL_GCP_QA_PRIVATE==='1'
    && !env.FIRESTORE_EMULATOR_HOST
    && !env.FIREBASE_AUTH_EMULATOR_HOST
    && typeof env.HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL==='string'
    && /^[-a-z0-9]+@cozinha-dietetica\.iam\.gserviceaccount\.com$/.test(env.HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL);
}
export function assertHospitalGcpQaRuntime(env=process.env) {
  assertHospital(isHospitalGcpQaRuntime(env),'UNAVAILABLE','Runtime hospitalar privado não autorizado');
}
export async function hospitalMetadataIdentity(fetchImpl=globalThis.fetch) {
  assertHospitalGcpQaRuntime();
  assertHospital(typeof fetchImpl==='function','UNAVAILABLE','HTTP IAM indisponível');
  let emailResponse,tokenResponse;
  try {
    [emailResponse,tokenResponse]=await Promise.all([
      fetchImpl(METADATA+'/email',{headers:{'Metadata-Flavor':'Google'},cache:'no-store',signal:AbortSignal.timeout(4000)}),
      fetchImpl(METADATA+'/token',{headers:{'Metadata-Flavor':'Google'},cache:'no-store',signal:AbortSignal.timeout(4000)}),
    ]);
  } catch {throw new HospitalError('UNAVAILABLE','Identidade hospitalar indisponível');}
  assertHospital(emailResponse?.ok&&tokenResponse?.ok,'UNAVAILABLE','Metadata IAM indisponível');
  let email,credential;
  try {[email,credential]=await Promise.all([emailResponse.text(),tokenResponse.json()]);}
  catch {throw new HospitalError('UNAVAILABLE','Resposta IAM inválida');}
  assertHospital(email.trim()===process.env.HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL
    && typeof credential?.access_token==='string'&&credential.access_token.length>20
    && (credential.token_type===undefined||credential.token_type==='Bearer'),
    'UNAVAILABLE','Identidade hospitalar divergente');
  return {email:email.trim(),accessToken:credential.access_token};
}

export function requireHospitalCloudIdentity(identity) {
  assertHospitalGcpQaRuntime();
  assertHospital(identity?.email===process.env.HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL
    && typeof identity?.accessToken==='string' && identity.accessToken.length>20,
    'UNAVAILABLE','Conta IAM hospitalar divergente');
  return identity;
}
