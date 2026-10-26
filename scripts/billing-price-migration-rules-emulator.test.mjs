#!/usr/bin/env node
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, doc, getDoc, getFirestore,
  runTransaction, serverTimestamp, setDoc,
} from 'firebase/firestore';
import test from 'node:test';

const PROJECT = 'demo-emprovex-billing-migration';
const OWNER = 'aprov1hgesm@gmail.com';
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '';
if (!/^(localhost|127\.0\.0\.1):8080$/.test(HOST) || process.env.GCLOUD_PROJECT !== PROJECT) {
  throw new Error('Only local Firestore emulator with demo project is permitted');
}

const config = {
  version: 'emprovex_billing_v1',
  billingMode: 'observe', requirePayment: false, automaticSuspension: false,
  monthlyPriceCents: 5000, currency: 'BRL', defaultTrialDays: 30,
  dueBusinessDay: 5, gracePeriodDays: 10, paymentMethod: 'pix_manual',
  pixKey: '', pixKeyType: '', pixRecipientName: '', paymentLinkUrl: '',
  supportContact: '', holidayDates: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  updatedBy: OWNER,
};

function firestoreValue(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(firestoreValue) } };
  throw Error('unsupported fixture type');
}

async function seedLegacyConfig() {
  const endpoint = 'http://127.0.0.1:8080/v1/projects/' +
    PROJECT + '/databases/(default)/documents/platformBillingConfig/main';
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(config)
      .map(([k, v]) => [k, firestoreValue(v)])) }),
  });
  assert.ok(response.ok, 'legacy fixture seed refused: ' + response.status);
}

async function session(email, label) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key',
    authDomain: PROJECT + '.firebaseapp.com' }, 'test-' + label);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = GoogleAuthProvider.credential(JSON.stringify({
    sub: 'google-' + label, email, email_verified: true,
  }));
  const signedIn = await signInWithCredential(auth, credential);
  const claims = await signedIn.user.getIdTokenResult(true);
  assert.equal(claims.signInProvider, 'google.com');
  assert.equal(claims.claims.email_verified, true);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { app, auth, db, user: signedIn.user };
}

function migrateWithAudit(db, user, operation = 'billing.price_migration') {
  const accountRef = doc(db, 'platformBillingConfig', 'main');
  const eventRef = doc(collection(db, 'platformAuditEvents'));
  return runTransaction(db, async (tx) => {
    const current = await tx.get(accountRef);
    assert.equal(current.exists(), true);
    const previous = current.data();
    tx.set(accountRef, {
      ...previous, monthlyPriceCents: 7000,
      updatedAt: '2026-10-26T00:00:00.000Z', updatedBy: user.email,
    });
    tx.set(eventRef, {
      eventVersion: 'emprovex_audit_v1',
      eventId: eventRef.id, workspaceId: 'hgesm-aprov', ug: '160416',
      operation, source: 'admin', entityType: 'billing_config',
      entityId: 'main', correlationId: eventRef.id,
      actorUid: user.uid, actorEmail: user.email,
      before: { monthlyPriceCents: 5000 },
      after: { monthlyPriceCents: 7000 },
      metadata: { reason: 'saas_r1_full_plan_70_brl' },
      createdAt: serverTimestamp(),
    });
  });
}

async function denied(action) {
  await assert.rejects(action(), (e) =>
    String(e?.code || '').includes('permission-denied') ||
    /PERMISSION_DENIED|Missing or insufficient permissions/.test(String(e)));
}

test('migration event is authorized only for verified Google founder and remains atomic', async () => {
  await seedLegacyConfig();
  const founder = await session(OWNER, 'founder');
  const stranger = await session('other@example.com', 'stranger');
  try {
    const ref = doc(founder.db, 'platformBillingConfig', 'main');
    // Merely having a verified Google session is insufficient.
    await denied(() => migrateWithAudit(stranger.db, stranger.user));
    assert.equal((await getDoc(ref)).data().monthlyPriceCents, 5000);
    // New operation must not authorize arbitrary audit labels.
    await denied(() => migrateWithAudit(founder.db, founder.user, 'billing.fake_migration'));
    assert.equal((await getDoc(ref)).data().monthlyPriceCents, 5000);
    // Actual legacy-to-current migration is permitted, audit included.
    await migrateWithAudit(founder.db, founder.user);
    assert.equal((await getDoc(ref)).data().monthlyPriceCents, 7000);
  } finally {
    await Promise.allSettled([signOut(founder.auth), signOut(stranger.auth)]);
    await Promise.allSettled([deleteApp(founder.app), deleteApp(stranger.app)]);
  }
});
