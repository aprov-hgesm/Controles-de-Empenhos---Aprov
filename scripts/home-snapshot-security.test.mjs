#!/usr/bin/env node

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-security';
const API_KEY = 'fake-api-key';
const PASSWORD = 'Emprovex-Teste!2026';
const AUTH_BASE = 'http://127.0.0.1:9099';
const FIRESTORE_BASE =
  `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const apps = [];

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [key, encodeValue(nested)])
        ),
      },
    };
  }
  throw new Error(`Unsupported seed type: ${typeof value}`);
}

async function ownerSet(path, data) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${FIRESTORE_BASE}/${encodedPath}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, encodeValue(value)])
      ),
    }),
  });

  if (!response.ok) {
    throw new Error(`Owner seed failed (${response.status}): ${await response.text()}`);
  }
}

async function authPost(method, body) {
  const response = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/${method}?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Auth emulator failed: ${JSON.stringify(payload)}`);
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
    `${AUTH_BASE}/emulator/v1/projects/${PROJECT_ID}/oobCodes`
  );
  const codes = await codesResponse.json();
  const verification = [...(codes.oobCodes || [])]
    .reverse()
    .find((item) => item.email === email && item.requestType === 'VERIFY_EMAIL');

  if (!verification?.oobLink) {
    throw new Error(`Verification code not found for ${email}`);
  }

  await fetch(verification.oobLink);
  return { uid: created.localId, email };
}

function workspace(id, email, ug) {
  return {
    id,
    name: `Workspace ${id}`,
    status: 'active',
    ug,
    authorizedEmail: email,
    institutionalProfile: {
      organizationName: `Organização ${id}`,
      organizationShortName: id.toUpperCase(),
      sectionName: 'Aprovisionamento',
    },
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
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
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    createdBy: 'aprov1hgesm@gmail.com',
  };
}

function snapshot(workspaceId, ug, uid, overrides = {}) {
  return {
    snapshotVersion: 'emprovex_home_snapshot_v1',
    workspaceId,
    ug,
    contentHash: 'a1b2c3d4',
    generatedAt: '2026-09-20T06:00:00.000Z',
    generatedBy: uid,
    metrics: { totalEmpenhos: 1, totalValue: 1000 },
    alerts: { total: 0, critical: 0, attention: 0 },
    receiving: { pendingEmpenhos: 1, pendingItems: 1, balance: 1000 },
    execution: { committed: 1000, received: 0, percentage: 0 },
    classStats: [{ code: 'QR', count: 1, value: 1000 }],
    stars: [{
      id: '2026NE000001',
      supplier: 'Fornecedor Snapshot',
      supplierKey: '11111111000191',
      classification: 'QR',
      status: 'Ativo',
      value: 1000,
      balance: 1000,
      receivedPct: 0,
      severity: 'normal',
      stage: 'active',
      message: 'Operação sem sinal de atenção ativo.',
    }],
    ...overrides,
  };
}

async function expectDenied(action, label) {
  await assert.rejects(
    action,
    (error) => String(error?.code || error).includes('permission-denied'),
    label
  );
}

test('homeSnapshot é isolado por workspace/UG e limitado a 72 estrelas', async () => {
  const identity = await createVerifiedUser('snapshot-a@example.test');

  await ownerSet(
    'workspaces/snapshot-a',
    workspace('snapshot-a', identity.email, '160416')
  );
  await ownerSet(
    `platformAccounts/${identity.email}`,
    account(identity.email, 'snapshot-a', identity.uid, '160416')
  );

  await ownerSet(
    'workspaces/snapshot-b',
    workspace('snapshot-b', 'snapshot-b@example.test', '160417')
  );
  await ownerSet(
    'platformAccounts/snapshot-b@example.test',
    account('snapshot-b@example.test', 'snapshot-b', 'uid-b', '160417')
  );
  await ownerSet(
    'workspaces/snapshot-b/settings/homeSnapshot',
    snapshot('snapshot-b', '160417', 'uid-b')
  );

  const app = initializeApp(
    {
      projectId: PROJECT_ID,
      apiKey: API_KEY,
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
    },
    `home-snapshot-security-${Date.now()}`
  );
  apps.push(app);

  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_BASE, { disableWarnings: true });
  const credential = await signInWithEmailAndPassword(
    auth,
    identity.email,
    PASSWORD
  );

  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  const ownRef = doc(db, 'workspaces', 'snapshot-a', 'settings', 'homeSnapshot');
  await setDoc(
    ownRef,
    snapshot('snapshot-a', '160416', credential.user.uid)
  );

  const own = await getDoc(ownRef);
  assert.equal(own.exists(), true);
  assert.equal(own.data()?.ug, '160416');

  await expectDenied(
    () => setDoc(
      ownRef,
      snapshot('snapshot-a', '160999', credential.user.uid)
    ),
    'Snapshot com UG divergente deve ser negado.'
  );

  await expectDenied(
    () => setDoc(
      ownRef,
      snapshot('snapshot-a', '160416', credential.user.uid, {
        stars: Array.from({ length: 73 }, (_, index) => ({
          id: `NE-${index}`,
        })),
      })
    ),
    'Snapshot com mais de 72 estrelas deve ser negado.'
  );

  await expectDenied(
    () => getDoc(
      doc(db, 'workspaces', 'snapshot-b', 'settings', 'homeSnapshot')
    ),
    'Setor não pode ler snapshot de outro workspace.'
  );

  await expectDenied(
    () => deleteDoc(ownRef),
    'Snapshot derivado não pode ser apagado pelo runtime.'
  );
});

after(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});
