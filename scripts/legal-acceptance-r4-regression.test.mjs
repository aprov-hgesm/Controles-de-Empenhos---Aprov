import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isVerifiedLegalAcceptance } from '../lib/server/legalAcceptanceRecord.ts';

const founder = {
  workspaceId: 'hgesm-aprov',
  email: 'aprov1hgesm@gmail.com',
  ug: '160416',
};
const expected = {
  schemaVersion: 'emprovex_legal_acceptance_v1',
  legalBundleVersion: 'saas-r4-2026-10-27',
  termsVersion: 'terms-2026-10-27-r2',
  privacyVersion: 'privacy-2026-10-27-r2',
};
const identity = { ...founder, uid: 'real-founder-firebase-uid' };
const text = value => ({ stringValue: value });
const stamp = '2026-10-31T18:31:00.000000Z';
const record = (overrides = {}) => ({
  schemaVersion: text(expected.schemaVersion),
  workspaceId: text(identity.workspaceId),
  uid: text(identity.uid),
  email: text(identity.email),
  ug: text(identity.ug),
  legalBundleVersion: text(expected.legalBundleVersion),
  termsVersion: text(expected.termsVersion),
  privacyVersion: text(expected.privacyVersion),
  acceptedAt: { timestampValue: stamp },
  ...overrides,
});
const matches = (fields, subject = identity, versions = expected) =>
  isVerifiedLegalAcceptance(fields, subject, versions, founder);

test('R4 unchanged legitimate acceptance is recognized once without a second write', () => {
  assert.equal(matches(record()), true);
  assert.equal(matches(record()), true);
});

test('Founder accepted once while workspace UG was missing: genuine nullValue is recognized', () => {
  const legacy = record({ ug: { nullValue: null } });
  assert.equal(matches(legacy), true);
  // The historical record is never changed: it remains auditable.
  assert.deepEqual(legacy.ug, { nullValue: null });
  assert.deepEqual(legacy.acceptedAt, { timestampValue: stamp });
});

test('Founder missing-UG exception requires original timestamp and exact nullValue', () => {
  assert.equal(matches(record({ ug: { nullValue: null }, acceptedAt: undefined })), false);
  assert.equal(matches(record({ ug: { nullValue: null }, acceptedAt: { timestampValue: 'not-a-timestamp' } })), false);
  assert.equal(matches(record({ ug: undefined })), false);
  assert.equal(matches(record({ ug: text('') })), false);
  assert.equal(matches(record({ ug: text('000000') })), false);
  assert.equal(matches(record({ ug: text('160417') })), false);
});

test('No founder legacy exception for other workspaces or changed UGs', () => {
  const legacy = record({ ug: { nullValue: null } });
  assert.equal(matches(legacy, { ...identity, ug: '160999' }), false);
  assert.equal(matches(legacy, { ...identity, workspaceId: 'another-workspace' }), false);
  assert.equal(matches(legacy, { ...identity, email: 'other@example.test' }), false);
  assert.equal(matches(legacy, { ...identity, uid: 'another-uid' }), false);
  const other = { ...identity, workspaceId: 'another-workspace', email: 'other@example.test', ug: '160417' };
  const foreign = record({
    workspaceId: text(other.workspaceId),
    email: text(other.email),
    ug: { nullValue: null },
  });
  assert.equal(matches(foreign, other), false);
});

test('Reject mismatched identity, schema, bundle, terms and privacy regardless of UG', () => {
  for (const field of ['uid', 'email', 'workspaceId', 'schemaVersion',
    'legalBundleVersion', 'termsVersion', 'privacyVersion']) {
    assert.equal(matches(record({ [field]: text('incompatible') })), false, field);
    assert.equal(matches(record({ [field]: text('incompatible'), ug: { nullValue: null } })),
      false, field + ' legacy');
  }
  assert.equal(matches(undefined), false);
});

test('A new legal bundle always requires a new acceptance; no automatic carryover', () => {
  const updated = {
    ...expected,
    legalBundleVersion: 'saas-r5-future',
    termsVersion: 'terms-r5-future',
  };
  assert.equal(matches(record(), identity, updated), false);
  assert.equal(matches(record({ ug: { nullValue: null } }), identity, updated), false);
});

test('Conventional tenants preserve old semantics: exact UG only', () => {
  const other = {
    workspaceId: 'workspace-tenant-b', email: 'b@example.test', uid: 'uid-b', ug: '160417',
  };
  const normal = record({
    workspaceId: text(other.workspaceId), email: text(other.email),
    uid: text(other.uid), ug: text(other.ug),
  });
  assert.equal(matches(normal, other), true);
  assert.equal(matches({ ...normal, ug: { nullValue: null } }, other), false);
});
