#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
function requireSafe(ok, reason) { if (!ok) throw new Error('RC_R1_QA_ISOLATION_BLOCKED: ' + reason); }
export function assertQaIsolation(env = process.env, root = process.cwd()) {
  requireSafe(env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1', 'emulators flag');
  requireSafe(env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID === 'demo-emprovex-security', 'synthetic project');
  for (const key of ['GCLOUD_PROJECT', 'FIREBASE_PROJECT', 'FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID']) {
    if (env[key]) requireSafe(env[key] === 'demo-emprovex-security', 'project variable ' + key);
  }
  for (const [key,value] of Object.entries({
    FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
    EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT:'8081', NEXT_PUBLIC_EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT:'8081',
    EMPROVEX_E2E_BASE_URL:'http://127.0.0.1:3100'
  })) if (env[key]) requireSafe(env[key] === value, 'nonlocal or unexpected endpoint ' + key);
  requireSafe(!env.GOOGLE_APPLICATION_CREDENTIALS && !env.FIREBASE_TOKEN, 'deploy credentials present');
  const main=JSON.parse(readFileSync(resolve(root,'firebase.security-test.json'),'utf8'));
  const wh=JSON.parse(readFileSync(resolve(root,'firebase.warehouse-e2e-test.json'),'utf8'));
  requireSafe(main.firestore?.rules === 'firestore.rules', 'main rules file');
  requireSafe(main.emulators?.auth?.host === '127.0.0.1' && main.emulators?.auth?.port === 9099, 'Auth host');
  requireSafe(main.emulators?.firestore?.host === '127.0.0.1' && main.emulators?.firestore?.port === 8080, 'main Firestore host');
  requireSafe(wh.firestore?.length === 1 && wh.firestore[0].database === 'emprovex-warehouse' && wh.firestore[0].rules === 'firestore.warehouse.rules', 'warehouse database/rules');
  requireSafe(wh.emulators?.firestore?.host === '127.0.0.1' && wh.emulators?.firestore?.port === 8081, 'warehouse Firestore host');
  return true;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  assertQaIsolation();
  console.log('RC R1 QA: isolation CONFIG verified; runtime test pending');
}
