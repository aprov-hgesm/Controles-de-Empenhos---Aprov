import {isHospitalGcpQaRuntime} from './gcp-qa-runtime.mjs';

// Identical environment boundary for the hospital landing page, workspace,
// server actions and route adapters. A production NODE_ENV alone grants nothing.
export function isHospitalQaUiReady(env=process.env,{workspace=false}={}) {
  const org=env.HOSPITAL_QA_ORGANIZATION_ID?.trim();
  const configured=Boolean(
    org
    &&env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY?.trim()
    &&env.NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID?.trim()
    &&(!env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID
      || env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID==='cozinha-dietetica'
      || (env.NODE_ENV!=='production'
        &&env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID==='demo-cozinha-dietetica'))
  );
  if(!configured||(workspace && env.HOSPITAL_QA_APP_READY!=='1'))return false;
  if(isHospitalGcpQaRuntime(env))return /^qa_[a-zA-Z0-9_-]+$/.test(org);
  return env.NODE_ENV!=='production'
    &&(Boolean(env.HOSPITAL_FIRESTORE_QA_ENABLED==='1'&&env.FIRESTORE_EMULATOR_HOST)
      ||Boolean(env.HOSPITAL_QA_SQLITE_PATH));
}
