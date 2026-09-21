#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-backup';
const API_KEY = 'fake-api-key';
const PASSWORD = 'Emprovex-Backup!2026';
const AUTH_BASE = 'http://127.0.0.1:9099';
const FIRESTORE_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
    return { mapValue: { fields: encodeFields(value) } };
  }
  throw new Error(`Tipo não suportado: ${typeof value}`);
}

function encodeFields(record) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)])
  );
}

async function ownerSet(path, data) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${FIRESTORE_BASE}/${encodedPath}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!response.ok) throw new Error(`Seed falhou: ${await response.text()}`);
}

async function ownerDelete(path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${FIRESTORE_BASE}/${encodedPath}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Delete de desastre falhou: ${await response.text()}`);
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
  if (!response.ok) throw new Error(JSON.stringify(payload));
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
  const response = await fetch(`${AUTH_BASE}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const payload = await response.json();
  const verification = [...(payload.oobCodes || [])]
    .reverse()
    .find((item) => item.email === email && item.requestType === 'VERIFY_EMAIL');
  assert.ok(verification?.oobLink);
  const verify = await fetch(verification.oobLink);
  assert.equal(verify.ok, true);
  return { uid: created.localId, email };
}

function workspace(id, email) {
  return {
    id,
    name: 'Workspace de recuperação',
    status: 'active',
    ug: '160416',
    authorizedEmail: email,
    institutionalProfile: {
      organizationName: 'Organização Teste',
      organizationShortName: 'TESTE',
      sectionName: 'Aprovisionamento',
    },
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    createdBy: 'aprov1hgesm@gmail.com',
  };
}

function account(email, workspaceId, uid) {
  return {
    email,
    authProvider: 'password',
    firebaseUid: uid,
    accountType: 'sector',
    workspaceId,
    ug: '160416',
    status: 'active',
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    createdBy: 'aprov1hgesm@gmail.com',
    firstLoginAt: '2026-09-21T00:00:00.000Z',
    lastLoginAt: '2026-09-21T00:00:00.000Z',
  };
}

test('backup lógico reconstrói workspace após perda isolada sem sobrescrever IDs', async () => {
  const identity = await createVerifiedUser('backup-recovery@example.test');
  const workspaceId = 'workspace-backup-recovery';
  await ownerSet(`workspaces/${workspaceId}`, workspace(workspaceId, identity.email));
  await ownerSet(`platformAccounts/${identity.email}`, account(identity.email, workspaceId, identity.uid));

  const original = {
    empenho: {
      id: '2026NE000777',
      supplier: 'Fornecedor Recuperação',
      supplierCnpj: '11111111000191',
      description: 'Empenho protegido por backup',
      date: '2026-09-01',
      status: 'Ativo',
      items: [],
      pregao: '90077/2026',
      classification: 'PASA',
    },
    invoice: {
      id: 'NF-777',
      recordKey: 'nf_11111111000191_nf-777',
      empenhoId: '2026NE000777',
      supplier: 'Fornecedor Recuperação',
      supplierCnpj: '11111111000191',
      issueDate: '2026-09-10',
      items: [],
      totalValue: 1234.56,
      comissaoDate: '2026-09-15',
      tesourariaDate: '2026-09-18',
      numeroNS: '2026NS000777',
      nsUg: '160416',
    },
    comissao: {
      id: 'comissao-2026-09',
      mesReferencia: '2026-09',
      boletimNumero: '123',
      boletimData: '2026-09-01',
      presidente: { nome: 'Presidente', posto: '1º Ten' },
      auxiliares: [],
    },
    alert: {
      id: 'alert-777',
      empenhoId: '2026NE000777',
      type: 'ATENÇÃO',
      title: 'Alerta recuperável',
      subtitle: 'Backup',
      description: 'Registro lógico',
      date: 'Agora',
    },
    cronograma: {
      id: 'cronograma-777',
      empenhoId: '2026NE000777',
      dataCriacao: '2026-09-20',
      colunas: [],
      distribuicao: {},
    },
    termoCounter: 17,
    empenhoClasses: {
      schemaVersion: 2,
      classes: [{ code: 'PASA', description: 'PASA', requiresTermoRecebimento: false }],
      updatedAt: '2026-09-20T00:00:00.000Z',
      updatedBy: identity.uid,
    },
  };

  // Simula a existência de um backup externo e depois perda completa dos dados operacionais.
  const lostPaths = [
    `workspaces/${workspaceId}/empenhos/${original.empenho.id}`,
    `workspaces/${workspaceId}/invoices/${original.invoice.recordKey}`,
    `workspaces/${workspaceId}/comissoes/${original.comissao.id}`,
    `workspaces/${workspaceId}/alerts/${original.alert.id}`,
    `workspaces/${workspaceId}/cronogramas/${original.cronograma.id}`,
    `workspaces/${workspaceId}/settings/termoRecebimentoCounter`,
    `workspaces/${workspaceId}/settings/empenhoClasses`,
  ];
  for (const path of lostPaths) await ownerDelete(path);

  const app = initializeApp(
    { projectId: PROJECT_ID, apiKey: API_KEY, authDomain: `${PROJECT_ID}.firebaseapp.com` },
    `backup-recovery-${Date.now()}`
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_BASE, { disableWarnings: true });
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  const credential = await signInWithEmailAndPassword(auth, identity.email, PASSWORD);
  assert.equal(credential.user.uid, identity.uid);

  const now = new Date().toISOString();
  await setDoc(
    doc(firestore, 'workspaces', workspaceId, 'empenhos', original.empenho.id),
    {
      ...original.empenho,
      revision: 1,
      updatedAt: now,
      updatedBy: identity.uid,
      userId: identity.uid,
    }
  );

  const invoiceRef = doc(firestore, 'workspaces', workspaceId, 'invoices', original.invoice.recordKey);
  const lockId = `sagNsLock_160416_${original.invoice.numeroNS}`;
  const lockRef = doc(firestore, 'workspaces', workspaceId, 'settings', lockId);
  const batch = writeBatch(firestore);
  batch.set(invoiceRef, { ...original.invoice, userId: identity.uid });
  batch.set(lockRef, {
    id: lockId,
    type: 'sag-ns-lock',
    workspaceId,
    ug: '160416',
    numeroNS: original.invoice.numeroNS,
    invoiceRecordKey: original.invoice.recordKey,
    invoiceId: original.invoice.id,
    empenhoId: original.invoice.empenhoId,
    supplierCnpj: original.invoice.supplierCnpj,
    createdAt: now,
    updatedAt: now,
    updatedBy: identity.uid,
  });
  await batch.commit();

  await setDoc(doc(firestore, 'workspaces', workspaceId, 'comissoes', original.comissao.id), original.comissao);
  await setDoc(doc(firestore, 'workspaces', workspaceId, 'alerts', original.alert.id), {
    ...original.alert,
    userId: identity.uid,
  });
  await setDoc(doc(firestore, 'workspaces', workspaceId, 'cronogramas', original.cronograma.id), {
    ...original.cronograma,
    userId: identity.uid,
  });
  const counterRef = doc(firestore, 'workspaces', workspaceId, 'settings', 'termoRecebimentoCounter');
  await setDoc(counterRef, { currentNumber: 0 });
  await updateDoc(counterRef, { currentNumber: original.termoCounter });
  await setDoc(
    doc(firestore, 'workspaces', workspaceId, 'settings', 'empenhoClasses'),
    original.empenhoClasses
  );

  const [empenho, invoice, lock, comissao, alert, cronograma, counter, classes] = await Promise.all([
    getDoc(doc(firestore, 'workspaces', workspaceId, 'empenhos', original.empenho.id)),
    getDoc(invoiceRef),
    getDoc(lockRef),
    getDoc(doc(firestore, 'workspaces', workspaceId, 'comissoes', original.comissao.id)),
    getDoc(doc(firestore, 'workspaces', workspaceId, 'alerts', original.alert.id)),
    getDoc(doc(firestore, 'workspaces', workspaceId, 'cronogramas', original.cronograma.id)),
    getDoc(counterRef),
    getDoc(doc(firestore, 'workspaces', workspaceId, 'settings', 'empenhoClasses')),
  ]);

  for (const snapshot of [empenho, invoice, lock, comissao, alert, cronograma, counter, classes]) {
    assert.equal(snapshot.exists(), true);
  }
  assert.equal(empenho.id, original.empenho.id);
  assert.equal(invoice.id, original.invoice.recordKey);
  assert.equal(invoice.data()?.comissaoDate, original.invoice.comissaoDate);
  assert.equal(invoice.data()?.tesourariaDate, original.invoice.tesourariaDate);
  assert.equal(lock.data()?.numeroNS, original.invoice.numeroNS);
  assert.equal(counter.data()?.currentNumber, original.termoCounter);
  assert.equal(classes.data()?.classes?.[0]?.code, 'PASA');

  await deleteApp(app);
});
