'use strict';
// EMPROVEX R7.5: One-off Cloud Run Job; read-only Firestore IAM probe.
// No private keys, secret reads, production documents, payments or writes.
const { randomUUID } = require('node:crypto');
const PROJECT = 'gen-lang-client-0982077967';
const JOB = 'emprovex-r7-iam-probe';
const SERVICE_ACCOUNT = 'emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com';
const DATABASES = Object.freeze([
  ['ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1', 404],
  ['emprovex-warehouse', 404],
  ['ai-studio-gestoaprovhgesm-c7f13148-de76-4977-b517-2bd46fe2942b', 403],
  ['emprovex-restore-warehouse-2026-10-04', 403],
  ['ai-studio-controledeempenh-3eeee498-faa1-4326-8f4f-95d34b382ec1', 403],
]);

async function readMetadata(suffix) {
  const response = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/' + suffix,
    {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    }
  );
  if (!response.ok) throw new Error('METADATA_HTTP_' + response.status);
  return response;
}

async function main() {
  if (process.env.CLOUD_RUN_JOB !== JOB ||
      process.env.CLOUD_RUN_TASK_INDEX !== '0' ||
      !process.env.CLOUD_RUN_EXECUTION) {
    throw new Error('NOT_THE_EXPECTED_CLOUD_RUN_JOB');
  }
  const email = (await (await readMetadata('email')).text()).trim();
  if (email !== SERVICE_ACCOUNT) throw new Error('WRONG_RUNTIME_SERVICE_ACCOUNT');
  console.log('R7_PROBE: RUNTIME_IDENTITY_PASS');

  const credential = await (await readMetadata('token')).json();
  const token = credential && credential.access_token;
  if (typeof token !== 'string' || token.length < 20) {
    throw new Error('NO_RUNTIME_ACCESS_TOKEN');
  }

  const nonce = randomUUID().replaceAll('-', '');
  let allowed = 0;
  let denied = 0;
  for (const [db, expected] of DATABASES) {
    // Collection and document IDs must not match reserved Firestore __.*__ pattern.
    // The random path is never created; a 404 proves document GET is authorized.
    // A 403 proves this exact document GET was not authorized.
    const uri = 'https://firestore.googleapis.com/v1/projects/' +
      PROJECT + '/databases/' + db + '/documents/emprovex_r7_iam_probe/' + nonce;
    const response = await fetch(uri, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (response.status !== expected) {
      throw new Error('FIRESTORE_ACCESS_MISMATCH:' + db +
        ':expected=' + expected + ':actual=' + response.status);
    }
    if (expected === 404) allowed++;
    else denied++;
    console.log('R7_PROBE: ' + (expected === 404 ? 'ALLOW' : 'DENY') +
      ' PASS ' + db + ' HTTP ' + response.status);
  }
  if (allowed !== 2 || denied !== 3) throw new Error('INCOMPLETE_PROBE');
  console.log('R7_PROBE: PASS (2 allowed; 3 denied; read-only)');
}

main().catch(error => {
  // Do not include upstream response bodies, JWTs, or secret values.
  const message = error instanceof Error ? error.message : 'UNKNOWN';
  console.error('R7_PROBE: FAIL ' + message.slice(0, 220));
  process.exitCode = 1;
});
