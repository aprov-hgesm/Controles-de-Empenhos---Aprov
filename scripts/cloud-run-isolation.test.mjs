import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertCloudRunIsolation, assertCloudRunBuildReady } from '../lib/cloudRunIsolation.mjs';

const baseline = { projectId:'prod-project-98765', appId:'1:123:web:PROD', apiKey:'prod-public-key',
  authDomain:'prod-project-98765.firebaseapp.com', storageBucket:'prod-project-98765.firebasestorage.app',
  firestoreDatabaseId:'prod-core-database' };
const publicConfig = { projectId:'isolated-qa-12345', appId:'1:789:web:TEST',
  apiKey:'test-public-key', authDomain:'isolated-qa-12345.firebaseapp.com',
  storageBucket:'isolated-qa-12345.firebasestorage.app',
  firestoreDatabaseId:'qa-core', warehouseDatabaseId:'qa-warehouse', messagingSenderId:'789' };
const env = (change={}) => ({ K_SERVICE:'emprovex-isolated', EMPROVEX_RUNTIME_TARGET:'cloud-run-staging',
  EMPROVEX_CLOUD_PROJECT_ID:'isolated-qa-12345', EMPROVEX_CLOUD_CORE_DATABASE_ID:'qa-core',
  EMPROVEX_CLOUD_WAREHOUSE_DATABASE_ID:'qa-warehouse',
  NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON:JSON.stringify(publicConfig), ...change });
test('legacy Vercel preserves old behavior', () =>
  assert.equal(assertCloudRunIsolation(baseline, {}), null));
test('synthetic isolated staging config passes structural validation only', () =>
  assert.equal(assertCloudRunIsolation(baseline, env()).coreDatabaseId,'qa-core'));
for (const [name, overrides] of [
  ['Cloud Run without server target', { EMPROVEX_RUNTIME_TARGET:'' }],
  ['project production', { NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON:JSON.stringify({...publicConfig,projectId:baseline.projectId}) }],
  ['project runtime mismatch', { GOOGLE_CLOUD_PROJECT:'foreign-project' }],
  ['wrong admin project', { EMPROVEX_CLOUD_PROJECT_ID:'wrong-project' }],
  ['mixed databases', { EMPROVEX_CLOUD_WAREHOUSE_DATABASE_ID:'qa-core' }],
  ['production warehouse DB', { NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON:JSON.stringify({...publicConfig,warehouseDatabaseId:'emprovex-warehouse'}) }],
  ['production app', { NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON:JSON.stringify({...publicConfig,appId:baseline.appId}) }],
  ['private material in public config', { NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON:JSON.stringify({...publicConfig,private_key:'TEST'}) }],
  ['service account JSON', { FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:'FICTIONAL' }],
  ['missing config', { NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON:'' }],
  ['runtime emulator', { NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS:'1' }],
]) test('fail closed: '+name, () =>
  assert.throws(() => assertCloudRunIsolation(baseline, env(overrides)), /CLOUD_RUN_ISOLATION_/));
test('build refuses any source containing production Firebase import', () => {
  const dir=mkdtempSync(join(tmpdir(),'emprovex-cloud-isolation-'));
  try {
    mkdirSync(join(dir,'app'));
    writeFileSync(join(dir,'app','page.ts'), "import cfg from '../firebase-applet-config.json';");
    assert.throws(() => assertCloudRunBuildReady(baseline, env(), dir), /CLOUD_RUN_SOURCE_NOT_ISOLATED/);
    writeFileSync(join(dir,'app','page.ts'), "export const ok = 1;");
    assert.equal(assertCloudRunBuildReady(baseline, env(), dir).projectId, publicConfig.projectId);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
