#!/usr/bin/env node
// Dry-run only: no Google API clients, gcloud, subprocess, credentials or mutations.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const template=readFileSync(resolve(root,'ops/hospital-w11-cloud-run-qa.template.yaml'),'utf8');
const mandatory=[
  'name: cozinha-dietetica-qa',
  'run.googleapis.com/ingress: internal',
  'serviceAccountName: hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com',
  'REPLACE_WITH_APPROVED_IMAGE_DIGEST',
  'name: HOSPITAL_GCP_QA_ENABLED',
  'name: HOSPITAL_GCP_QA_PRIVATE',
  'name: HOSPITAL_FIRESTORE_PROJECT_ID',
  'name: HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL',
  'name: GOOGLE_CLOUD_PROJECT',
  'value: cozinha-dietetica',
];
for(const part of mandatory)if(!template.includes(part))throw Error('NO_GO: QA template missing required protection: '+part);
if(/allUsers|allow-unauthenticated|gen-lang-client-0982077967|emprovex-run-runtime|FIRESTORE_EMULATOR_HOST|HOSPITAL_QA_DB_PATH|PRIVATE_KEY/.test(template))
  throw Error('NO_GO: forbidden cloud project, public invoker or embedded credential');
const command=process.argv[2]??'plan';
if(command!=='plan')throw Error('Only read-only dry-run is supported (plan)');
process.stdout.write([
 'W11 QA GCP PLAN ONLY — no external operation executed',
 'Project/database: cozinha-dietetica / (default)',
 'Service: cozinha-dietetica-qa (ingress internal, require authenticated invoker)',
 'Runtime identity: hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com (no key files)',
 'Permissions to review before grant: datastore entities read/write via roles/datastore.user on hospital project only; firebaseauth.users.get via custom role or justified viewer',
 'Client Firestore Rules: allow read, write: if false (unchanged)',
 'Approved image digest required; do not use image tags or deploy main service.',
 'Approval required before any service-account/IAM/API/Cloud Run/index creation or synthetic GCP write.',
 'No merge, deployment, billing or real patient data in this command.'
].join('\n')+'\n');
