/**
 * QA-only localhost smoke test for Next standalone AFTER removing the traced
 * production baseline. No Cloud Run deployment, IAM, or GCP credentials.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtime = join(root, '.next', 'standalone');
const app = join(runtime, 'server.js');
if (process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
  throw new Error('QA_STANDALONE_SMOKE_CLOUD_CREDENTIALS_FORBIDDEN');
}
if (process.env.EMPROVEX_RUNTIME_TARGET !== 'cloud-run-staging' ||
    process.env.EMPROVEX_CLOUD_PROJECT_ID !== 'emprovex-qa-r1-261015-6275' ||
    !existsSync(app)) {
  throw new Error('QA_STANDALONE_SMOKE_SOURCE_NOT_READY');
}
if (existsSync(join(runtime, 'firebase-applet-config.json'))) {
  throw new Error('QA_STANDALONE_SMOKE_LEGACY_BASELINE_PRESENT');
}
const port = '8877';
const child = spawn(process.execPath, [app], {
  cwd: runtime,
  env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: port },
  stdio: 'ignore',
});
let exited = false;
child.once('exit', () => { exited = true; });
try {
  let passed = false;
  let status = 0;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (exited) throw new Error('QA_STANDALONE_SMOKE_PROCESS_EXITED');
    await sleep(300);
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/', {
        redirect: 'manual',
        signal: AbortSignal.timeout(1300),
      });
      status = response.status;
      if (status >= 200 && status < 400) {
        process.stdout.write('QA_STANDALONE_LOCAL_BOOT_PASS_HTTP=' + status + '\n');
        passed = true;
        break;
      }
    } catch {
      // Server may still be starting: continue a bounded local-only retry.
    }
  }
  if (!passed) throw new Error('QA_STANDALONE_SMOKE_HTTP_' + (status || 'NO_RESPONSE'));
} finally {
  if (!exited) child.kill('SIGTERM');
}
