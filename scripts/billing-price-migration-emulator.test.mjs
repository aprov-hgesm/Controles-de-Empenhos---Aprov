#!/usr/bin/env node
// Only against Firebase demo emulators, never production.
// EXPECT_MIGRATION_ALLOWED=0 proves baseline DENY; =1 certifies candidate fix.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, linkWithCredential } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';

const PROJECT = 'demo-emprovex-billing-migration';
const OWNER = 'aprov1hgesm@gmail.com';
const URL_AUTH = 'http://127.0.0.1:9099';
const DB_URL = 'http://127.0.0.1:8080/v1/projects/' + PROJECT + '/databases/(default)/documents';
const PASSWORD = 'BillingRegression!2026';
const apps = [];

function makeSession(label) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-api-key', authDomain: PROJECT + '.firebaseapp.com' }, 'billing-' + label);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, URL_AUTH, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { auth, db };
}
function google(label, email) {
  return GoogleAuthProvider.credential(JSON.stringify({ sub: 'billing-' + label, email, email_verified: true }));
}
async function authApi(endpoint, data) {
  const response = await fetch(URL_AUTH + '/identitytoolkit.googleapis.com/v1/' + endpoint + '?key=fake-api-key', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  assert.equal(response.ok, true, JSON.stringify(result));
  return result;
}
async function setupVerifiedPasswordOwner() {
  const created = await authApi('accounts:signUp', { email: OWNER, password: PASSWORD, returnSecureToken: true });
  await authApi('accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: created.idToken });
  const response = await fetch(URL_AUTH + '/emulator/v1/projects/' + PROJECT + '/oobCodes');
  assert.equal(response.ok, true);
  const entries = (await response.json()).oobCodes || [];
  const code = [...entries].reverse().find((e) => e.email === OWNER && e.requestType === 'VERIFY_EMAIL');
  assert.ok(code?.oobLink);
  assert.equal((await fetch(code.oobLink)).ok, true);
}
function value(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) } };
}
async function seed(path, data) {
  const response = await fetch(DB_URL + '/' + path, {
    method: 'PATCH', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, value(v)])) }),
  });
  assert.equal(response.ok, true, 'Seed: ' + path + ': ' + await response.text());
}
async function denied(label, run) {
  await assert.rejects(run, (error) => {
    assert.match(String(error?.code || error?.message), /permission.denied|PERMISSION_DENIED|Missing or insufficient permissions/i, label);
    return true;
  });
  console.log('PASS DENY ' + label);
}
function event(uid, id, operation) {
  return {
    eventVersion: 'emprovex_audit_v1', eventId: id, workspaceId: 'hgesm-aprov', ug: '160416',
    operation, source: 'admin', entityType: 'billing_config', entityId: 'main',
    correlationId: 'test-' + id, actorUid: uid, actorEmail: OWNER,
    before: { monthlyPriceCents: 5000 }, after: { monthlyPriceCents: 7000 },
    metadata: { reason: 'saas_r1_full_plan_70_brl' }, createdAt: serverTimestamp(),
  };
}
async function main() {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  await setupVerifiedPasswordOwner();
  const password = makeSession('password-owner');
  const passwordUser = (await signInWithEmailAndPassword(password.auth, OWNER, PASSWORD)).user;
  assert.equal((await passwordUser.getIdTokenResult(true)).signInProvider, 'password');
  await linkWithCredential(passwordUser, google('owner', OWNER));
  const founder = makeSession('founder-google');
  const founderUser = (await signInWithCredential(founder.auth, google('owner', OWNER))).user;
  const token = await founderUser.getIdTokenResult(true);
  assert.equal(token.signInProvider, 'google.com');
  assert.equal(token.claims.email_verified, true);
  assert.equal(token.claims.email, OWNER);
  console.log('PASS founder Google identity and verified email');

  const outsider = makeSession('outsider-google');
  await signInWithCredential(outsider.auth, google('outsider', 'sector@example.test'));
  const anonymous = makeSession('anonymous');

  const legacy = {
    version: 'emprovex_billing_v1', billingMode: 'observe', requirePayment: false,
    automaticSuspension: false, monthlyPriceCents: 5000, currency: 'BRL',
    defaultTrialDays: 30, dueBusinessDay: 5, gracePeriodDays: 10, paymentMethod: 'pix_manual',
    pixKey: '', pixKeyType: '', pixRecipientName: '', paymentLinkUrl: '', supportContact: '',
    holidayDates: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    updatedBy: OWNER,
  };
  await seed('platformBillingConfig/main', legacy);
  await seed('billingAccounts/vip-legacy', {
    version: 'emprovex_billing_v1', workspaceId: 'vip-legacy',
    status: 'exempt', monthlyPriceCents: 0, currency: 'BRL',
  });
  const cfg = doc(founder.db, 'platformBillingConfig', 'main');
  assert.equal((await getDoc(cfg)).data()?.monthlyPriceCents, 5000);
  await getDocs(collection(founder.db, 'billingAccounts'));
  await getDocs(collection(founder.db, 'billingCycles'));
  console.log('PASS ALLOW founder reads billing data');

  await denied('founder-password read', () => getDoc(doc(password.db, 'platformBillingConfig', 'main')));
  await denied('outsider Google list', () => getDocs(collection(outsider.db, 'billingAccounts')));
  await denied('anonymous read', () => getDoc(doc(anonymous.db, 'platformBillingConfig', 'main')));

  await setDoc(doc(founder.db, 'platformAuditEvents', 'audit-control'),
    event(founderUser.uid, 'audit-control', 'billing.config_update'));
  console.log('PASS ALLOW billing.config_update audit');

  const migrate = () => runTransaction(founder.db, async (t) => {
    const original = await t.get(cfg);
    assert.equal(original.data()?.monthlyPriceCents, 5000);
    t.set(cfg, { ...original.data(), monthlyPriceCents: 7000, updatedAt: '2026-10-26T00:00:00.000Z', updatedBy: OWNER });
    t.set(doc(founder.db, 'platformAuditEvents', 'audit-migration'),
      event(founderUser.uid, 'audit-migration', 'billing.price_migration'));
  });
  if (process.env.EXPECT_MIGRATION_ALLOWED === '1') {
    await migrate();
    assert.equal((await getDoc(cfg)).data()?.monthlyPriceCents, 7000);
    assert.equal((await getDoc(doc(founder.db, 'platformAuditEvents', 'audit-migration'))).exists(), true);
    console.log('PASS ALLOW atomic migration and audit');
  } else {
    await denied('legacy migration rejected by current Rules', migrate);
    assert.equal((await getDoc(cfg)).data()?.monthlyPriceCents, 5000);
    assert.equal((await getDoc(doc(founder.db, 'platformAuditEvents', 'audit-migration'))).exists(), false);
    console.log('PASS baseline: denied transaction atomic');
  }
  await denied('outsider cannot forge migration audit', () =>
    setDoc(doc(outsider.db, 'platformAuditEvents', 'audit-forged'),
      event(founderUser.uid, 'audit-forged', 'billing.price_migration')));
  const vip = (await getDoc(doc(founder.db, 'billingAccounts', 'vip-legacy'))).data();
  assert.equal(vip?.status, 'exempt');
  assert.equal(vip?.monthlyPriceCents, 0);
  console.log('PASS VIP R$0 preserved and outsider blocked');
}
try {
  await main();
  console.log('BILLING MIGRATION SECURITY: PASS');
} catch (e) {
  console.error('BILLING MIGRATION SECURITY: FAIL', e);
  process.exitCode = 1;
} finally {
  await Promise.all(apps.map((instance) => deleteApp(instance)));
}
