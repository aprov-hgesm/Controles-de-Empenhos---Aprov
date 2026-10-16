import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const config = JSON.parse(read('firebase.cloud-run-qa-rules.json'));
const expectedNames = ['qa-core', 'qa-warehouse'];
const denyAll = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

test('QA Rules manifest maps exactly two named banks and no default', () => {
  assert.deepEqual(config, { firestore: [
    {database: 'qa-core', rules: 'firestore.qa-core.rules'},
    {database: 'qa-warehouse', rules: 'firestore.qa-warehouse.rules'}
  ]});
  assert.deepEqual(config.firestore.map(item => item.database), expectedNames);
  assert.equal(config.firestorm, undefined);
});

for (const [i, db] of expectedNames.entries()) {
  test(db + ' starts deny-by-default, without inherited production authorizations', () => {
    const ruleFile = config.firestore[i].rules;
    assert.equal(read(ruleFile).trim(), denyAll.trim());
    assert.equal(ruleFile, 'firestore.' + db + '.rules');
  });
}

test('One-shot Windows auditor is read-only, pinned to QA, no token or deployment', () => {
  const script = read('scripts/cloud-run-qa-readonly-audit.ps1');
  assert.match(script, /emprovex-qa-r1-261015-6275/);
  assert.match(script, /emprovex-qa-runtime@emprovex-qa-r1-261015-6275\.iam\.gserviceaccount\.com/);
  assert.match(script, /qa-core/);
  assert.match(script, /qa-warehouse/);
  for (const disallowed of [
    /\b(print-access-token|activate-service-account|add-iam-policy-binding|create|deploy|delete|update|set-iam-policy|set-policy)\b/i,
    /\b(services\s+enable|billing\s+projects\s+link|config\s+set)\b/i,
    /GOOGLE_APPLICATION_CREDENTIALS|FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON/,
    /gcloud\.cmd\s+auth\s+/i
  ]) assert.doesNotMatch(script, disallowed);
});
