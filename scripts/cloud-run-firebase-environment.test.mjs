import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveFirebaseEnvironment } from '../lib/firebaseEnvironment.mjs';
import { assertCloudRunBuildReady } from '../lib/cloudRunIsolation.mjs';

const baseline = {
  projectId: 'production-demo-123', appId: '1:123:web:PROD',
  apiKey: 'public-prod-key', authDomain: 'production-demo-123.firebaseapp.com',
  firestoreDatabaseId: 'prod-core', storageBucket: 'production-demo-123.firebasestorage.app',
  messagingSenderId: '123',
};
const isolated = {
  projectId: 'isolated-test-123', appId: '1:789:web:TEST',
  apiKey: 'public-test-key', authDomain: 'isolated-test-123.firebaseapp.com',
  firestoreDatabaseId: 'qa-core', warehouseDatabaseId: 'qa-warehouse',
  storageBucket: 'isolated-test-123.firebasestorage.app', messagingSenderId: '789',
};
const staging = (changes = {}) => ({
  environment: 'cloud-run-staging',
  publicConfigJson: JSON.stringify(isolated),
  ...changes,
});
const realBaseline = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));

test('legacy deployment preserves original Core and Warehouse independently', () => {
  const out = resolveFirebaseEnvironment(baseline, {});
  assert.equal(out.projectId, baseline.projectId);
  assert.equal(out.firestoreDatabaseId, baseline.firestoreDatabaseId);
  assert.equal(out.warehouseDatabaseId, 'emprovex-warehouse');
  assert.equal(Object.isFrozen(out), true);
});

test('legacy explicitly configured warehouse remains unchanged', () => {
  const out = resolveFirebaseEnvironment(baseline, {legacyWarehouseDatabaseId: 'legacy-warehouse'});
  assert.equal(out.warehouseDatabaseId, 'legacy-warehouse');
  assert.equal(out.firestoreDatabaseId, baseline.firestoreDatabaseId);
});

test('legacy forbids a public staging override', () => {
  assert.throws(() => resolveFirebaseEnvironment(baseline, {
    publicConfigJson: JSON.stringify(isolated),
  }), /FIREBASE_ENV_LEGACY_STAGING_OVERRIDE_FORBIDDEN/);
});

test('local emulator keeps synthetic identity, default Core and separate Warehouse', () => {
  const out = resolveFirebaseEnvironment(baseline, {
    emulatorEnabled: true, emulatorProjectId: 'demo-emprovex-tests',
  });
  assert.equal(out.projectId, 'demo-emprovex-tests');
  assert.equal(out.firestoreDatabaseId, '(default)');
  assert.equal(out.warehouseDatabaseId, 'emprovex-warehouse');
});

test('local emulator refuses any non-demo project', () => {
  assert.throws(() => resolveFirebaseEnvironment(baseline, {
    emulatorEnabled: true, emulatorProjectId: baseline.projectId,
  }), /FIREBASE_ENV_EMULATOR_PROJECT_REQUIRED/);
});

test('staging consistently resolves the same project, app, Core and Warehouse', () => {
  const out = resolveFirebaseEnvironment(baseline, staging());
  assert.deepEqual({...out}, isolated);
  assert.equal(Object.isFrozen(out), true);
});

for (const [name, patch, expected] of [
  ['production project', {projectId: baseline.projectId}, /STAGING_PROJECT_NOT_ISOLATED/],
  ['production app', {appId: baseline.appId}, /STAGING_APP_IDENTITY/],
  ['production public apiKey', {apiKey: baseline.apiKey}, /STAGING_APP_IDENTITY/],
  ['production Core database', {firestoreDatabaseId: baseline.firestoreDatabaseId}, /STAGING_DATABASES_NOT_ISOLATED/],
  ['production Warehouse', {warehouseDatabaseId: 'emprovex-warehouse'}, /STAGING_DATABASES_NOT_ISOLATED/],
  ['same Core and Warehouse', {warehouseDatabaseId: 'qa-core'}, /STAGING_DATABASES_NOT_ISOLATED/],
  ['foreign authDomain', {authDomain: baseline.authDomain}, /STAGING_AUTH_DOMAIN/],
  ['foreign Storage bucket', {storageBucket: baseline.storageBucket}, /STAGING_STORAGE/],
  ['embedded admin secret', {private_key: 'not-a-real-secret'}, /STAGING_CONFIG_FIELDS/],
]) {
  test('staging rejects '+name, () => assert.throws(
    () => resolveFirebaseEnvironment(baseline, staging({
      publicConfigJson: JSON.stringify({...isolated, ...patch}),
    })), expected));
}

test('staging refuses absent/incomplete configuration and emulator mixing', () => {
  assert.throws(() => resolveFirebaseEnvironment(baseline, staging({publicConfigJson: ''})),
    /FIREBASE_ENV_STAGING_CONFIG_REQUIRED/);
  assert.throws(() => resolveFirebaseEnvironment(baseline, staging({
    publicConfigJson: JSON.stringify({projectId: 'isolated-test-123'}),
  })), /FIREBASE_ENV_STAGING_CONFIG_FIELDS/);
  assert.throws(() => resolveFirebaseEnvironment(baseline, staging({emulatorEnabled: true})),
    /FIREBASE_ENV_STAGING_EMULATOR_FORBIDDEN/);
});

test('staging accepts explicit Warehouse override only when exactly matching', () => {
  const out = resolveFirebaseEnvironment(baseline, staging({
    legacyWarehouseDatabaseId: 'qa-warehouse',
  }));
  assert.equal(out.warehouseDatabaseId, 'qa-warehouse');
});

test('staging refuses legacy database override disagreement', () => {
  assert.throws(() => resolveFirebaseEnvironment(baseline, staging({
    legacyWarehouseDatabaseId: 'foreign-warehouse',
  })), /FIREBASE_ENV_STAGING_WAREHOUSE_OVERRIDE_CONFLICT/);
});

// This test intentionally scans ONLY local source files, without any tokens or
// network calls. It enforces the W4 strict no-prod-import contract.
test('Cloud Run staging source must contain no unreviewed direct production imports', () => {
  const env = {
    K_SERVICE: 'synthetic-staging',
    EMPROVEX_RUNTIME_TARGET: 'cloud-run-staging',
    EMPROVEX_CLOUD_PROJECT_ID: isolated.projectId,
    EMPROVEX_CLOUD_CORE_DATABASE_ID: isolated.firestoreDatabaseId,
    EMPROVEX_CLOUD_WAREHOUSE_DATABASE_ID: isolated.warehouseDatabaseId,
    NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON: JSON.stringify(isolated),
  };
  assert.doesNotThrow(() => assertCloudRunBuildReady(realBaseline, env, resolve('.')));
});
