import test from 'node:test';
import assert from 'node:assert/strict';
import {isHospitalQaUiReady} from '../../../lib/server/hospital/firebase/qa-ui-gate.mjs';

const cloud={
  NODE_ENV:'production',
  K_SERVICE:'cozinha-dietetica-qa',
  GOOGLE_CLOUD_PROJECT:'cozinha-dietetica',
  HOSPITAL_GCP_QA_ENABLED:'1',
  HOSPITAL_GCP_QA_PRIVATE:'1',
  HOSPITAL_FIRESTORE_QA_ENABLED:'1',
  HOSPITAL_FIRESTORE_PROJECT_ID:'cozinha-dietetica',
  HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL:'hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com',
  HOSPITAL_QA_ORGANIZATION_ID:'qa_hospital',
  HOSPITAL_QA_APP_READY:'1',
  NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY:'synthetic-api-key',
  NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID:'1:123:web:synthetic',
  NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID:'cozinha-dietetica'
};
test('hospital login and workspace open ONLY for isolated private hospital QA with synthetic org',()=>{
  assert.equal(isHospitalQaUiReady(cloud),true);
  assert.equal(isHospitalQaUiReady(cloud,{workspace:true}),true);
  for(const [key,value] of Object.entries({
    K_SERVICE:'emprovex',GOOGLE_CLOUD_PROJECT:'gen-lang-client-0982077967',
    HOSPITAL_GCP_QA_PRIVATE:'0',HOSPITAL_GCP_QA_ENABLED:'0',
    HOSPITAL_FIRESTORE_QA_ENABLED:'0',HOSPITAL_QA_ORGANIZATION_ID:'real_hospital',
    HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL:'main@gen-lang-client-0982077967.iam.gserviceaccount.com',
    NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID:'gen-lang-client-0982077967',
    NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY:'',NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID:''
  })){
    assert.equal(isHospitalQaUiReady({...cloud,[key]:value}),false,key);
  }
  assert.equal(isHospitalQaUiReady({...cloud,HOSPITAL_QA_APP_READY:'0'}),true);
  assert.equal(isHospitalQaUiReady({...cloud,HOSPITAL_QA_APP_READY:'0'},{workspace:true}),false);
  assert.equal(isHospitalQaUiReady({...cloud,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'}),false);
});
test('existing local QA remains separate; regular production never enables with QA flags alone',()=>{
  const local={...cloud,NODE_ENV:'development',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
    HOSPITAL_QA_ORGANIZATION_ID:'hospital-test'};
  assert.equal(isHospitalQaUiReady(local,{workspace:true}),true);
  assert.equal(isHospitalQaUiReady({...local,HOSPITAL_FIRESTORE_QA_ENABLED:'0'}),false);
  assert.equal(isHospitalQaUiReady({...local,NODE_ENV:'production'}),false);
  assert.equal(isHospitalQaUiReady({...cloud,K_SERVICE:'emprovex',NODE_ENV:'production'}),false);
});
