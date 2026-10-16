/**
 * W8 QA build preflight. Offline and credential-free.
 * This script reports readiness; a green AUDIT is NOT a certified deploy.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertCloudRunBuildReady } from '../lib/cloudRunIsolation.mjs';

const root = resolve(import.meta.dirname, '..');
const baseline = JSON.parse(readFileSync(resolve(root, 'firebase-applet-config.json'), 'utf8'));
const qa = 'emprovex-qa-r1-261015-6275';
const publicConfig = {
  projectId: qa,
  appId: '1:953294034210:web:W8SYNTHETIC',
  apiKey: 'w8-synthetic-public-config-do-not-deploy',
  authDomain: qa + '.firebaseapp.com',
  firestoreDatabaseId: 'qa-core',
  warehouseDatabaseId: 'qa-warehouse',
  storageBucket: qa + '.firebasestorage.app',
  messagingSenderId: '953294034210',
};
const env = {
  EMPROVEX_RUNTIME_TARGET: 'cloud-run-staging',
  EMPROVEX_CLOUD_PROJECT_ID: qa,
  EMPROVEX_CLOUD_CORE_DATABASE_ID: 'qa-core',
  EMPROVEX_CLOUD_WAREHOUSE_DATABASE_ID: 'qa-warehouse',
  NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON: JSON.stringify(publicConfig),
};
// Validation uses fabricated public web-app fields; NEVER contact Google or use real data.
// Running this preflight does not claim a real QA Firebase Web App is registered.
let result = {
  project: qa,
  classification: 'CLOUD_RUN_QA_BUILD_PREFLIGHT',
  sourceReady: false,
  status: 'BLOCKED',
  reason: null,
  offenders: [],
  firebaseWebAppReady: false,
  containerDeployed: false,
  runtimeCertified: false,
};
try {
  assertCloudRunBuildReady(baseline, env, root);
  result.sourceReady = true;
  result.status = 'SOURCE_GATE_PASS';
  result.reason = 'Web App QA config, artifact scan and runtime interlock still require separate gates';
} catch (err) {
  const msg = String(err?.message || 'UNEXPECTED_PREFLIGHT_ERROR');
  const match = msg.match(/^CLOUD_RUN_SOURCE_NOT_ISOLATED: (.*)$/);
  if (match) {
    result.reason = 'PRODUCTION_SOURCE_REFERENCES';
    result.offenders = match[1].split(', ').map(x => x.trim()).filter(Boolean);
  } else {
    result.reason = /^CLOUD_RUN_/.test(msg) ? msg : 'UNEXPECTED_PREFLIGHT_ERROR';
  }
}
const text = JSON.stringify(result, null, 2) + '\n';
writeFileSync(resolve(root, 'cloud-run-qa-build-preflight-report.json'), text);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, 'source_ready=' + result.sourceReady + '\n');
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '### EMPROVEX QA W8 — offline build preflight',
    '**' + result.status + '** — ' + (result.reason || 'Source-level gate passed'),
    '',
    'Synthetic QA-only web config was used. No Google credentials, Firebase calls, builds or deployments.',
    '',
    ...(result.offenders.length ? ['Detected production-literal source paths (sample):', ...result.offenders.map(x => '- `' + x + '`')] : []),
    '',
    '**Not certified:** Firebase Auth/Rules QA, negative IAM isolation, actual Next build, artifact scan and startup interlock.',
  ];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
process.stdout.write('W8 QA PREFLIGHT: ' + result.status + ' / ' + (result.reason || 'SOURCE_GATE_PASS') + '\n');
for (const file of result.offenders) process.stdout.write('SOURCE_BLOCKER: ' + file + '\n');
// A successful audit exit does not assert deployment readiness. Check sourceReady.
