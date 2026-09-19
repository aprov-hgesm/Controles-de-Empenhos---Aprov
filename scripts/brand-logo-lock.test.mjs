#!/usr/bin/env node

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-brand-lock';
const FIRESTORE_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OFFICIAL_LOGO = 'data:image/png;base64,EMPROVEX_OFFICIAL_TEST_LOGO';

const app = initializeApp(
  {
    projectId: PROJECT_ID,
    apiKey: 'fake-api-key',
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
  },
  'brand-logo-lock-test'
);

const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

async function ownerSet(path, data) {
  const fields = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value === null
        ? { nullValue: null }
        : { stringValue: String(value) },
    ])
  );

  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${FIRESTORE_BASE}/${encodedPath}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(`Seed Firestore falhou (${response.status}): ${await response.text()}`);
  }
}

async function expectPermissionDenied(action, message) {
  await assert.rejects(
    action,
    (error) => error?.code === 'permission-denied',
    message
  );
}

test('logo institucional permanece legível antes do login e imutável pelo runtime', async () => {
  await ownerSet('settings/global', {
    id: 'global',
    logo: OFFICIAL_LOGO,
    updatedAt: new Date().toISOString(),
    updatedBy: 'maintenance',
  });

  const logoRef = doc(db, 'settings', 'global');

  const publicSnapshot = await getDoc(logoRef);
  assert.equal(publicSnapshot.exists(), true, 'settings/global deve ser legível sem autenticação.');
  assert.equal(
    publicSnapshot.data()?.logo,
    OFFICIAL_LOGO,
    'Leitura pública deve retornar o logo institucional persistido.'
  );

  await expectPermissionDenied(
    () => setDoc(logoRef, { logo: 'data:image/png;base64,REPLACEMENT' }, { merge: true }),
    'Runtime anônimo não pode substituir o logo.'
  );

  await expectPermissionDenied(
    () => deleteDoc(logoRef),
    'Runtime anônimo não pode remover settings/global.'
  );

  const preservedSnapshot = await getDoc(logoRef);
  assert.equal(
    preservedSnapshot.data()?.logo,
    OFFICIAL_LOGO,
    'Tentativas negadas não podem modificar o logo institucional.'
  );
});

after(async () => {
  await deleteApp(app);
});
