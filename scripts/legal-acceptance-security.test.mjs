#!/usr/bin/env node

import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-legal';
const API_KEY = 'fake-api-key';
const PASSWORD = 'Emprovex-Legal!2026';
const AUTH_BASE = 'http://127.0.0.1:9099';
const FIRESTORE_BASE =
  'http://127.0.0.1:8080/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

const LEGAL_BUNDLE_VERSION = 'saas-r1-2026-10-01';
const TERMS_VERSION = 'terms-2026-10-01-r1';
const PRIVACY_VERSION = 'privacy-2026-10-01-r1';
const SCHEMA_VERSION = 'emprovex_legal_acceptance_v1';

const apps = [];

function encodeFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFirestoreFields(value) } };
  }
  throw new Error('Tipo Firestore não suportado no seed: ' + typeof value);
}

function encodeFirestoreFields(record) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeFirestoreValue(value)])
  );
}

async function ownerSet(path, data) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(FIRESTORE_BASE + '/' + encodedPath, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFirestoreFields(data) }),
  });

  if (!response.ok) {
    throw new Error('Seed Firestore falhou (' + response.status + '): ' + await response.text());
  }
}

async function authPost(method, body) {
  const response = await fetch(
    AUTH_BASE + '/identitytoolkit.googleapis.com/v1/' + method + '?key=' + API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error('Auth emulator ' + method + ' falhou: ' + JSON.stringify(payload));
  }

  return payload;
}

async function createVerifiedUser(email) {
  const created = await authPost('accounts:signUp', {
    email,
    password: PASSWORD,
    returnSecureToken: true,
  });

  await authPost('accounts:sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    idToken: created.idToken,
  });

  const codesResponse = await fetch(
    AUTH_BASE + '/emulator/v1/projects/' + PROJECT_ID + '/oobCodes'
  );
  const codesPayload = await codesResponse.json();
  const verification = [...(codesPayload.oobCodes || [])]
    .reverse()
    .find((item) => item.email === email && item.requestType === 'VERIFY_EMAIL');

  if (!verification?.oobLink) {
    throw new Error('Código de verificação não encontrado para ' + email);
  }

  const verifyResponse = await fetch(verification.oobLink);
  if (!verifyResponse.ok) {
    throw new Error('Verificação de e-mail falhou para ' + email);
  }

  return {
    email,
    uid: created.localId,
  };
}

async function createSession(label, email) {
  const app = initializeApp(
    {
      projectId: PROJECT_ID,
      apiKey: API_KEY,
      authDomain: PROJECT_ID + '.firebaseapp.com',
    },
    'legal-' + label + '-' + Date.now() + '-' + Math.random().toString(36).slice(2)
  );
  apps.push(app);

  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_BASE, { disableWarnings: true });
  const credential = await signInWithEmailAndPassword(auth, email, PASSWORD);
  assert.equal(credential.user.emailVerified, true);

  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);

  return { auth, db: firestore, user: credential.user };
}

function workspace(id, email, ug) {
  return {
    id,
    name: 'Workspace ' + id,
    status: 'active',
    ug,
    authorizedEmail: email,
    institutionalProfile: {
      organizationName: 'Organização ' + id,
      sectionName: 'Aprovisionamento',
    },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'aprov1hgesm@gmail.com',
  };
}

function account(email, workspaceId, uid, ug) {
  return {
    email,
    authProvider: 'password',
    firebaseUid: uid,
    accountType: 'sector',
    workspaceId,
    ug,
    status: 'active',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'aprov1hgesm@gmail.com',
  };
}

async function allowed(label, operation) {
  try {
    const result = await operation();
    console.log('  [PASS] ALLOW — ' + label);
    return result;
  } catch (error) {
    throw new Error('Esperava ALLOW: ' + label + '\n' + String(error));
  }
}

async function denied(label, operation) {
  try {
    await operation();
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : '';
    const message = String(error);

    if (
      code.includes('permission-denied')
      || message.includes('PERMISSION_DENIED')
      || message.includes('Missing or insufficient permissions')
    ) {
      console.log('  [PASS] DENY  — ' + label);
      return;
    }

    throw new Error('Falha inesperada em teste DENY: ' + label + '\n' + message);
  }

  throw new Error('Esperava DENY, mas a operação foi permitida: ' + label);
}

function acceptanceData(identity, overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    workspaceId: identity.workspaceId,
    ug: identity.ug,
    uid: identity.uid,
    email: identity.email,
    legalBundleVersion: LEGAL_BUNDLE_VERSION,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    acceptedAt: serverTimestamp(),
    ...overrides,
  };
}

async function main() {
  console.log('SAAS-DL — segurança do aceite legal versionado\n');

  const userA = await createVerifiedUser('legal-a@example.test');
  const userB = await createVerifiedUser('legal-b@example.test');

  await ownerSet('workspaces/workspace-a', workspace('workspace-a', userA.email, '160416'));
  await ownerSet('platformAccounts/' + userA.email, account(userA.email, 'workspace-a', userA.uid, '160416'));

  await ownerSet('workspaces/workspace-b', workspace('workspace-b', userB.email, '160417'));
  await ownerSet('platformAccounts/' + userB.email, account(userB.email, 'workspace-b', userB.uid, '160417'));

  const sessionA = await createSession('a', userA.email);
  const sessionB = await createSession('b', userB.email);

  const identityA = {
    workspaceId: 'workspace-a',
    ug: '160416',
    uid: userA.uid,
    email: userA.email,
  };

  const acceptanceId = userA.uid + '__' + LEGAL_BUNDLE_VERSION;
  const acceptanceRefA = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'legalAcceptances',
    acceptanceId
  );

  await allowed('usuário aceita a versão atual no próprio workspace', () =>
    setDoc(acceptanceRefA, acceptanceData(identityA))
  );

  const firstSnapshot = await allowed('usuário lê apenas o próprio aceite esperado', () =>
    getDoc(acceptanceRefA)
  );
  assert.equal(firstSnapshot.exists(), true);
  assert.equal(firstSnapshot.data()?.legalBundleVersion, LEGAL_BUNDLE_VERSION);
  const firstAcceptedAt = firstSnapshot.data()?.acceptedAt;

  await allowed('mesma versão é idempotente e não cria novo registro', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const snapshot = await transaction.get(acceptanceRefA);
      if (snapshot.exists()) return;
      transaction.set(acceptanceRefA, acceptanceData(identityA));
    })
  );

  const secondSnapshot = await getDoc(acceptanceRefA);
  assert.deepEqual(secondSnapshot.data()?.acceptedAt, firstAcceptedAt);

  await denied('outro workspace não lê aceite alheio', () =>
    getDoc(
      doc(
        sessionB.db,
        'workspaces',
        'workspace-a',
        'legalAcceptances',
        acceptanceId
      )
    )
  );

  await denied('outro workspace não grava aceite alheio', () =>
    setDoc(
      doc(
        sessionB.db,
        'workspaces',
        'workspace-a',
        'legalAcceptances',
        userB.uid + '__' + LEGAL_BUNDLE_VERSION
      ),
      acceptanceData({
        workspaceId: 'workspace-a',
        ug: '160416',
        uid: userB.uid,
        email: userB.email,
      })
    )
  );

  await denied('usuário não altera aceite já registrado', () =>
    updateDoc(acceptanceRefA, { termsVersion: 'terms-adulterado' })
  );

  await denied('usuário não apaga aceite', () =>
    deleteDoc(acceptanceRefA)
  );

  await denied('usuário não lista o histórico de aceites do workspace', () =>
    getDocs(collection(sessionA.db, 'workspaces', 'workspace-a', 'legalAcceptances'))
  );

  await denied('UID divergente é rejeitado', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'legalAcceptances',
        'uid-adulterado__' + LEGAL_BUNDLE_VERSION
      ),
      acceptanceData(identityA, { uid: 'uid-adulterado' })
    )
  );

  await denied('e-mail divergente é rejeitado', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'legalAcceptances',
        userA.uid + '__' + LEGAL_BUNDLE_VERSION + '-email'
      ),
      acceptanceData(identityA, { email: 'outro@example.test' })
    )
  );

  await denied('UG divergente é rejeitada', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'legalAcceptances',
        userA.uid + '__' + LEGAL_BUNDLE_VERSION + '-ug'
      ),
      acceptanceData(identityA, { ug: '160499' })
    )
  );

  await denied('versão diferente não reutiliza o documento vigente', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'legalAcceptances',
        userA.uid + '__saas-r1-future'
      ),
      acceptanceData(identityA, {
        legalBundleVersion: 'saas-r1-future',
        termsVersion: 'terms-future',
        privacyVersion: 'privacy-future',
      })
    )
  );

  await denied('timestamp arbitrário do cliente é rejeitado', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'legalAcceptances',
        userA.uid + '__' + LEGAL_BUNDLE_VERSION + '-timestamp'
      ),
      acceptanceData(identityA, {
        acceptedAt: new Date('2026-01-01T00:00:00.000Z'),
      })
    )
  );

  console.log('\nSAAS-DL LEGAL ACCEPTANCE SECURITY: READY');
}

try {
  await main();
} finally {
  for (const app of apps) {
    try {
      const auth = getAuth(app);
      if (auth.currentUser) await signOut(auth);
    } catch {
      // Cleanup best effort.
    }
    try {
      await deleteApp(app);
    } catch {
      // Cleanup best effort.
    }
  }
}
