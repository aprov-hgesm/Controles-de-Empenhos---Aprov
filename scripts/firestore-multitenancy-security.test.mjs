#!/usr/bin/env node

import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-security';
const API_KEY = 'fake-api-key';
const PASSWORD = 'Emprovex-Teste!2026';
const AUTH_BASE = 'http://127.0.0.1:9099';
const FIRESTORE_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const results = [];
const apps = [];

function now() {
  return new Date().toISOString();
}

function encodeFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value instanceof Timestamp) return { timestampValue: value.toDate().toISOString() };
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
  throw new Error(`Tipo Firestore não suportado no seed: ${typeof value}`);
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
  const response = await fetch(`${FIRESTORE_BASE}/${encodedPath}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFirestoreFields(data) }),
  });

  if (!response.ok) {
    throw new Error(`Seed Firestore falhou (${response.status}): ${await response.text()}`);
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
    throw new Error(`Auth emulator ${method} falhou: ${JSON.stringify(payload)}`);
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
  if (!codesResponse.ok) {
    throw new Error(`Não foi possível consultar códigos OOB: ${await codesResponse.text()}`);
  }

  const codesPayload = await codesResponse.json();
  const verification = [...(codesPayload.oobCodes || [])]
    .reverse()
    .find((item) => item.email === email && item.requestType === 'VERIFY_EMAIL');

  if (!verification?.oobLink) {
    throw new Error(`Código de verificação não encontrado para ${email}.`);
  }

  const verifyResponse = await fetch(verification.oobLink);
  if (!verifyResponse.ok) {
    throw new Error(`Verificação de e-mail falhou para ${email}.`);
  }

  return {
    email,
    uid: created.localId,
  };
}

function mockGoogleCredential(label, email) {
  return GoogleAuthProvider.credential(
    JSON.stringify({
      sub: `google-${label}`,
      email,
      email_verified: true,
    })
  );
}

async function createSession(label, email, provider = 'password') {
  const app = initializeApp(
    {
      projectId: PROJECT_ID,
      apiKey: API_KEY,
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
    },
    `security-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  apps.push(app);

  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_BASE, { disableWarnings: true });

  const credential = provider === 'google.com'
    ? await signInWithCredential(auth, mockGoogleCredential(label, email))
    : await signInWithEmailAndPassword(auth, email, PASSWORD);

  const tokenResult = await credential.user.getIdTokenResult(true);
  assert.equal(
    credential.user.emailVerified,
    true,
    `E-mail de teste ${email} precisa estar verificado.`
  );
  assert.equal(
    tokenResult.signInProvider,
    provider,
    `Sessão ${label} deveria usar provider ${provider}, mas recebeu ${tokenResult.signInProvider}.`
  );

  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  return { auth, db: firestore, user: credential.user };
}
async function allowed(label, operation) {
  try {
    await operation();
    results.push({ label, outcome: 'ALLOW', ok: true });
    console.log(`  [PASS] ALLOW — ${label}`);
  } catch (error) {
    results.push({ label, outcome: 'ALLOW', ok: false, error: String(error) });
    throw new Error(`Esperava ALLOW: ${label}\n${String(error)}`);
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
      results.push({ label, outcome: 'DENY', ok: true });
      console.log(`  [PASS] DENY  — ${label}`);
      return;
    }
    results.push({ label, outcome: 'DENY', ok: false, error: message });
    throw new Error(`Falha inesperada em teste DENY: ${label}\n${message}`);
  }

  results.push({ label, outcome: 'DENY', ok: false, error: 'Operação foi permitida.' });
  throw new Error(`Esperava DENY, mas a operação foi permitida: ${label}`);
}

function workspace(id, email, status = 'active', extra = {}) {
  const { ug = '160416', ...rest } = extra;
  return {
    id,
    name: `Workspace ${id}`,
    status,
    ...(ug ? { ug } : {}),
    authorizedEmail: email,
    institutionalProfile: {
      organizationName: `Organização ${id}`,
      organizationShortName: id.toUpperCase(),
      sectionName: 'Aprovisionamento',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'aprov1hgesm@gmail.com',
    ...rest,
  };
}

function account(email, workspaceId, uid, status = 'active', authProvider = 'password', ug = '160416') {
  return {
    email,
    ...(authProvider ? { authProvider } : {}),
    ...(uid ? { firebaseUid: uid } : {}),
    accountType: 'sector',
    workspaceId,
    ...(ug ? { ug } : {}),
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'aprov1hgesm@gmail.com',
    ...(uid
      ? {
          firstLoginAt: '2026-01-01T00:00:00.000Z',
          lastLoginAt: '2026-01-01T00:00:00.000Z',
        }
      : {}),
  };
}

async function seedWorkspace(
  id,
  email,
  uid,
  status = 'active',
  accountWorkspaceId = id,
  authProvider = 'password',
  ug = '160416'
) {
  await ownerSet(`workspaces/${id}`, workspace(id, email, status, { ug }));
  await ownerSet(
    `platformAccounts/${email}`,
    account(email, accountWorkspaceId, uid, status, authProvider, ug)
  );
  await ownerSet(`workspaces/${id}/empenhos/sample`, {
    id: 'sample',
    ownerWorkspaceId: id,
    marker: `seed-${id}`,
  });
}

const DEFAULT_NS_UG = '160416';

function sagLockId(ns, ug = DEFAULT_NS_UG) {
  return `sagNsLock_${ug}_${encodeURIComponent(ns)}`;
}

function legacySagLockId(ns) {
  return `sagNsLock_${encodeURIComponent(ns)}`;
}

async function reserveSagNs(db, uid, workspaceId, invoiceRecordKey, invoiceId, empenhoId, supplierCnpj, ns, ug = DEFAULT_NS_UG) {
  const invoiceRef = doc(db, 'workspaces', workspaceId, 'invoices', invoiceRecordKey);
  const lockRef = doc(db, 'workspaces', workspaceId, 'settings', sagLockId(ns, ug));

  return runTransaction(db, async (transaction) => {
    const [invoiceSnapshot, lockSnapshot] = await Promise.all([
      transaction.get(invoiceRef),
      transaction.get(lockRef),
    ]);

    if (!invoiceSnapshot.exists()) {
      throw new Error('SAG_INVOICE_MISSING');
    }

    if (
      lockSnapshot.exists()
      && lockSnapshot.data()?.invoiceRecordKey !== invoiceRecordKey
    ) {
      throw new Error('SAG_NS_LOCK_CONFLICT');
    }

    const timestamp = now();
    transaction.set(invoiceRef, { numeroNS: ns, nsUg: ug }, { merge: true });
    transaction.set(
      lockRef,
      {
        id: sagLockId(ns, ug),
        type: 'sag-ns-lock',
        workspaceId,
        ug,
        numeroNS: ns,
        invoiceRecordKey,
        invoiceId,
        empenhoId,
        supplierCnpj,
        createdAt: lockSnapshot.data()?.createdAt || timestamp,
        updatedAt: timestamp,
        updatedBy: uid,
      },
      { merge: true }
    );
  });
}

async function main() {
  console.log('Bloco 20 — testes automatizados de segurança multi-tenant\n');

  const identities = {};
  for (const [key, email] of Object.entries({
    a: 'sector-a@example.test',
    b: 'sector-b@example.test',
    wrongUid: 'sector-wrong-uid@example.test',
    bootstrap: 'sector-bootstrap@example.test',
    prebound: 'sector-prebound@example.test',
    suspended: 'sector-suspended@example.test',
    tampered: 'sector-tampered@example.test',
    lifecycle: 'sector-lifecycle@example.test',
  })) {
    identities[key] = await createVerifiedUser(email);
  }

  const founderEmail = 'aprov1hgesm@gmail.com';
  const admin = await createSession('admin-google', founderEmail, 'google.com');
  identities.founder = {
    email: founderEmail,
    uid: admin.user.uid,
  };

  await seedWorkspace('workspace-a', identities.a.email, identities.a.uid);
  await seedWorkspace('workspace-b', identities.b.email, identities.b.uid, 'active', 'workspace-b', 'password', '160417');
  await seedWorkspace(
    'workspace-wrong-uid',
    identities.wrongUid.email,
    'uid-que-nao-corresponde-a-sessao'
  );
  // Caso legado sem authProvider: continua aceito somente quando a sessão é password.
  await seedWorkspace(
    'workspace-bootstrap',
    identities.bootstrap.email,
    null,
    'active',
    'workspace-bootstrap',
    null,
    null
  );

  await ownerSet(
    'workspaces/workspace-prebound',
    workspace('workspace-prebound', identities.prebound.email, 'active')
  );
  await ownerSet(
    `platformAccounts/${identities.prebound.email}`,
    {
      email: identities.prebound.email,
      authProvider: 'password',
      firebaseUid: identities.prebound.uid,
      accountType: 'sector',
      workspaceId: 'workspace-prebound',
      ug: '160416',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'aprov1hgesm@gmail.com',
    }
  );

  await seedWorkspace(
    'workspace-suspended',
    identities.suspended.email,
    identities.suspended.uid,
    'disabled'
  );
  await seedWorkspace(
    'workspace-tampered',
    identities.tampered.email,
    identities.tampered.uid,
    'active',
    'outro-workspace'
  );
  await seedWorkspace(
    'workspace-lifecycle',
    identities.lifecycle.email,
    identities.lifecycle.uid
  );

  await ownerSet(
    'workspaces/hgesm-aprov',
    workspace('hgesm-aprov', identities.founder.email, 'active', { legacyWorkspace: true })
  );
  await ownerSet(
    `platformAccounts/${identities.founder.email}`,
    account(
      identities.founder.email,
      'hgesm-aprov',
      null,
      'active',
      'google.com'
    )
  );
  await ownerSet('workspaces/hgesm-aprov/empenhos/sample', {
    id: 'sample',
    ownerWorkspaceId: 'hgesm-aprov',
  });

  console.log('\nEMPROVEX — cadastro de NF independente do ADM Depósito');

  const coreReceiptEmpenhoId = '2026NECORE001';
  const coreReceiptInvoiceKey = 'nf_11222333000181_core001';
  await ownerSet(`workspaces/hgesm-aprov/empenhos/${coreReceiptEmpenhoId}`, {
    id: coreReceiptEmpenhoId,
    supplier: 'Fornecedor Core EMPROVEX',
    supplierCnpj: '11222333000181',
    description: 'Empenho de regressão do cadastro independente de NF',
    date: '2026-09-24',
    status: 'Ativo',
    classification: 'QR',
    items: [
      {
        id: 'item-core-1',
        name: 'Material operacional EMPROVEX',
        unit: 'UN',
        quantity: 10,
        unitPrice: 25,
        received: 0,
      },
    ],
    revision: 1,
    updatedAt: '2026-09-24T12:00:00.000Z',
    updatedBy: admin.user.uid,
    userId: admin.user.uid,
  });

  await allowed('Fundador cadastra NF no EMPROVEX sem qualquer escrita do ADM Depósito', () =>
    runTransaction(admin.db, async (transaction) => {
      const empenhoRef = doc(
        admin.db,
        'workspaces',
        'hgesm-aprov',
        'empenhos',
        coreReceiptEmpenhoId
      );
      const invoiceRef = doc(
        admin.db,
        'workspaces',
        'hgesm-aprov',
        'invoices',
        coreReceiptInvoiceKey
      );
      const [empenhoSnapshot, invoiceSnapshot] = await Promise.all([
        transaction.get(empenhoRef),
        transaction.get(invoiceRef),
      ]);
      assert.equal(empenhoSnapshot.exists(), true);
      assert.equal(invoiceSnapshot.exists(), false);

      const storedEmpenho = empenhoSnapshot.data();
      transaction.set(empenhoRef, {
        ...storedEmpenho,
        items: storedEmpenho.items.map((item) =>
          item.id === 'item-core-1'
            ? { ...item, received: 2 }
            : item
        ),
        revision: 2,
        updatedAt: now(),
        updatedBy: admin.user.uid,
        userId: admin.user.uid,
      });

      transaction.set(invoiceRef, {
        id: 'CORE001',
        recordKey: coreReceiptInvoiceKey,
        empenhoId: coreReceiptEmpenhoId,
        issueDate: '2026-09-24',
        items: [
          {
            itemId: 'item-core-1',
            quantity: 2,
            unitPrice: 25,
            subtotal: 50,
          },
        ],
        totalValue: 50,
        supplier: 'Fornecedor Core EMPROVEX',
        supplierCnpj: '11222333000181',
        registeredAt: now(),
        localizacaoAtual: 'APROVISIONAMENTO',
        userId: admin.user.uid,
      });

    })
  );

  await allowed('Transação crítica da NF não depende de alerta informativo', async () => {
    const snapshot = await getDoc(
      doc(
        admin.db,
        'workspaces',
        'hgesm-aprov',
        'alerts',
        'core-receipt-alert'
      )
    );
    assert.equal(snapshot.exists(), false);
  });

  await allowed('NF independente permanece legível no workspace fundador', async () => {
    const snapshot = await getDoc(
      doc(
        admin.db,
        'workspaces',
        'hgesm-aprov',
        'invoices',
        coreReceiptInvoiceKey
      )
    );
    assert.equal(snapshot.exists(), true);
    assert.equal(snapshot.data()?.warehouseIntegration, undefined);
  });

  await allowed('Cadastro de NF não cria configuração warehouse implicitamente', async () => {
    const snapshot = await getDoc(
      doc(
        admin.db,
        'warehouse',
        'hgesm-aprov',
        'settings',
        'invoice-integration'
      )
    );
    assert.equal(snapshot.exists(), false);
  });

  const billingAccountSeed = (workspaceId, email, ug) => ({
    version: 'emprovex_billing_v1',
    workspaceId,
    ug,
    authorizedEmail: email,
    status: 'trial',
    monthlyPriceCents: 7000,
    currency: 'BRL',
    trialGranted: true,
    trialStartedAt: '2026-09-21T00:00:00.000Z',
    trialEndsAt: '2026-10-21T00:00:00.000Z',
    paymentRequired: false,
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    createdBy: founderEmail,
    updatedBy: founderEmail,
  });
  await ownerSet(
    'billingAccounts/workspace-a',
    billingAccountSeed('workspace-a', identities.a.email, '160416')
  );
  await ownerSet(
    'billingAccounts/workspace-b',
    billingAccountSeed('workspace-b', identities.b.email, '160417')
  );

  let sessionA = await createSession('a', identities.a.email);
  const sessionB = await createSession('b', identities.b.email);
  const sessionWrongUid = await createSession('wrong', identities.wrongUid.email);
  const sessionBootstrap = await createSession('bootstrap', identities.bootstrap.email);
  const sessionPrebound = await createSession('prebound', identities.prebound.email);
  const sessionSuspended = await createSession('suspended', identities.suspended.email);
  const sessionTampered = await createSession('tampered', identities.tampered.email);
  const sessionLifecycle = await createSession('lifecycle', identities.lifecycle.email);

  console.log('\nBilling em modo de observação');

  await allowed('Setor consulta somente o próprio status de trial', () =>
    getDoc(doc(sessionA.db, 'billingAccounts', 'workspace-a'))
  );
  await denied('Setor não consulta o billing de outro workspace', () =>
    getDoc(doc(sessionA.db, 'billingAccounts', 'workspace-b'))
  );
  await denied('Setor não lista billingAccounts globalmente', () =>
    getDocs(collection(sessionA.db, 'billingAccounts'))
  );
  await denied('Setor não altera o próprio trial', () =>
    updateDoc(doc(sessionA.db, 'billingAccounts', 'workspace-a'), {
      trialEndsAt: '2099-12-31T00:00:00.000Z',
    })
  );
  await allowed('Administrador lista assinaturas comerciais', () =>
    getDocs(collection(admin.db, 'billingAccounts'))
  );
  await allowed('Administrador atualiza situação comercial sem tocar no workspace', () =>
    updateDoc(doc(admin.db, 'billingAccounts', 'workspace-a'), {
      status: 'pending',
      updatedAt: '2026-09-22T00:00:00.000Z',
      updatedBy: founderEmail,
    })
  );
  const operationalStillAvailable = await getDoc(
    doc(sessionA.db, 'workspaces', 'workspace-a', 'empenhos', 'sample')
  );
  assert.equal(
    operationalStillAvailable.exists(),
    true,
    'Billing pending em OBSERVE não pode bloquear o acesso operacional.'
  );

  await linkWithCredential(
    sessionA.user,
    mockGoogleCredential('sector-a-linked', identities.a.email)
  );
  await sessionA.user.getIdToken(true);
  const sessionAGoogle = await createSession(
    'sector-a-linked',
    identities.a.email,
    'google.com'
  );
  assert.equal(
    sessionAGoogle.user.uid,
    identities.a.uid,
    'O teste de provider precisa usar o mesmo UID do setor.'
  );

  sessionA = await createSession(
    'sector-a-password-linked',
    identities.a.email,
    'password'
  );
  assert.equal(
    sessionA.user.uid,
    identities.a.uid,
    'A sessão legítima do setor deve continuar usando o mesmo UID após o vínculo Google.'
  );

  await authPost('accounts:update', {
    idToken: await admin.user.getIdToken(),
    password: PASSWORD,
    returnSecureToken: true,
  });
  const founderPassword = await createSession(
    'founder-password',
    identities.founder.email,
    'password'
  );
  assert.equal(
    founderPassword.user.uid,
    identities.founder.uid,
    'O teste do fundador precisa manter o mesmo UID entre providers.'
  );

  console.log('\nFASE 0 — isolamento do ADM Depósito');

  const phaseZeroDepotId = 'dep_' + '0'.repeat(32);
  const founderWarehouseProbe = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'depots',
    phaseZeroDepotId
  );

  await allowed('Fundador grava no namespace ADM Depósito', () =>
    setDoc(founderWarehouseProbe, {
      schemaVersion: 'warehouse_depot_v1',
      id: phaseZeroDepotId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      code: 'DEP-00',
      name: 'Depósito de prova da fundação',
      description: null,
      status: 'active',
      createdBy: admin.user.uid,
      updatedBy: admin.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  await allowed('Fundador lê o namespace ADM Depósito', () =>
    getDoc(founderWarehouseProbe)
  );
  await allowed('Fundador lista domínio do namespace ADM Depósito', () =>
    getDocs(collection(admin.db, 'warehouse', 'hgesm-aprov', 'depots'))
  );
  await denied('Setor externo não lê namespace ADM Depósito do fundador', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'depots',
        phaseZeroDepotId
      )
    )
  );
  await denied('Setor externo não grava namespace ADM Depósito nem no próprio workspace', () =>
    setDoc(
      doc(
        sessionA.db,
        'warehouse',
        'workspace-a',
        'depots',
        'external-probe'
      ),
      { marker: 'forbidden' }
    )
  );
  await denied('Sessão fundadora por senha não acessa ADM Depósito', () =>
    getDoc(
      doc(
        founderPassword.db,
        'warehouse',
        'hgesm-aprov',
        'depots',
        phaseZeroDepotId
      )
    )
  );
  await denied('Fundador não usa o namespace ADM Depósito de workspace externo', () =>
    getDoc(
      doc(
        admin.db,
        'warehouse',
        'workspace-a',
        'depots',
        'external-probe'
      )
    )
  );

  console.log('\nFASE 1 — fundação canônica do material');

  const canonicalMaterialId = 'mat_123e4567e89b12d3a456426614174000';
  const canonicalMaterial = {
    schemaVersion: 'warehouse_material_v1',
    id: canonicalMaterialId,
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    description: 'Arroz parboilizado',
    aliases: ['Arroz beneficiado'],
    unit: { code: 'kg', label: null },
    status: 'active',
    conversions: [
      {
        presentation: { code: 'g', label: null },
        factorToBaseUnit: 0.001,
      },
      {
        presentation: { code: 'box', label: 'Caixa 30 kg' },
        factorToBaseUnit: 30,
      },
    ],
  };

  const founderMaterialProbe = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'materials',
    canonicalMaterialId
  );

  await allowed('Fundador grava material canônico da FASE 1', () =>
    setDoc(founderMaterialProbe, canonicalMaterial)
  );
  await allowed('Fundador lê material canônico da FASE 1', () =>
    getDoc(founderMaterialProbe)
  );
  await allowed('Fundador lista materiais da FASE 1', () =>
    getDocs(collection(admin.db, 'warehouse', 'hgesm-aprov', 'materials'))
  );

  await denied('Material não pode declarar workspace diferente do caminho', () =>
    setDoc(founderMaterialProbe, {
      ...canonicalMaterial,
      workspaceId: 'workspace-a',
    })
  );

  await denied('Setor externo não lê material do fundador', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'materials',
        canonicalMaterialId
      )
    )
  );

  const externalMaterialId = 'mat_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  await denied('Setor externo não grava material nem no próprio workspace', () =>
    setDoc(
      doc(
        sessionA.db,
        'warehouse',
        'workspace-a',
        'materials',
        externalMaterialId
      ),
      {
        ...canonicalMaterial,
        id: externalMaterialId,
        workspaceId: 'workspace-a',
        ug: '123456',
      }
    )
  );

  await denied('Sessão fundadora por senha não lê materiais da FASE 1', () =>
    getDoc(
      doc(
        founderPassword.db,
        'warehouse',
        'hgesm-aprov',
        'materials',
        canonicalMaterialId
      )
    )
  );

  await denied('Fundador não grava material em workspace externo', () =>
    setDoc(
      doc(
        admin.db,
        'warehouse',
        'workspace-a',
        'materials',
        externalMaterialId
      ),
      {
        ...canonicalMaterial,
        id: externalMaterialId,
        workspaceId: 'workspace-a',
        ug: '123456',
      }
    )
  );


  console.log('\nFASE 2 — ledger, saldo agregado e idempotência');

  const phase2Movement1Id = 'mov_' + '1'.repeat(64);
  const phase2Movement2Id = 'mov_' + '2'.repeat(64);
  const phase2Movement3Id = 'mov_' + '3'.repeat(64);
  const founderMovement1 = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'movements',
    phase2Movement1Id
  );
  const founderMovement2 = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'movements',
    phase2Movement2Id
  );
  const founderBalance = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'balances',
    canonicalMaterialId
  );

  await allowed('Fundador cria movimento e saldo atômicos da FASE 2', async () => {
    const batch = writeBatch(admin.db);
    batch.set(founderMovement1, {
      schemaVersion: 'warehouse_movement_v1',
      id: phase2Movement1Id,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      type: 'INITIAL_BALANCE',
      quantityDelta: 10,
      idempotencyKeyHash: '1'.repeat(64),
      reversesMovementId: null,
      note: null,
      createdAt: serverTimestamp(),
    });
    batch.set(founderBalance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      quantity: 10,
      revision: 1,
      lastMovementId: phase2Movement1Id,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await allowed('Fundador lê ledger da FASE 2', () => getDoc(founderMovement1));
  await allowed('Fundador lê saldo materializado da FASE 2', () => getDoc(founderBalance));

  await allowed('Fundador aplica segundo movimento e atualiza saldo da FASE 2', async () => {
    const batch = writeBatch(admin.db);
    batch.set(founderMovement2, {
      schemaVersion: 'warehouse_movement_v1',
      id: phase2Movement2Id,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      type: 'OUTBOUND',
      quantityDelta: -2,
      idempotencyKeyHash: '2'.repeat(64),
      reversesMovementId: null,
      note: 'Saída de teste',
      createdAt: serverTimestamp(),
    });
    batch.set(founderBalance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      quantity: 8,
      revision: 2,
      lastMovementId: phase2Movement2Id,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await denied('Ledger da FASE 2 é append-only', () =>
    updateDoc(founderMovement1, { note: 'Tentativa de sobrescrita' })
  );

  await denied('Saldo da FASE 2 não aceita alteração sem novo movimento', () =>
    updateDoc(founderBalance, {
      quantity: 999,
      revision: 3,
      updatedAt: serverTimestamp(),
    })
  );

  await denied('Movimento da FASE 2 não existe sem atualização de saldo correspondente', () =>
    setDoc(
      doc(
        admin.db,
        'warehouse',
        'hgesm-aprov',
        'movements',
        phase2Movement3Id
      ),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase2Movement3Id,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        type: 'INVENTORY_ADJUSTMENT',
        quantityDelta: 1,
        idempotencyKeyHash: '3'.repeat(64),
        reversesMovementId: null,
        note: null,
        createdAt: serverTimestamp(),
      }
    )
  );

  await denied('Setor externo não lê ledger da FASE 2', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'movements',
        phase2Movement1Id
      )
    )
  );

  await denied('Setor externo não lê saldo da FASE 2', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'balances',
        canonicalMaterialId
      )
    )
  );

  await denied('Sessão fundadora por senha não lê ledger da FASE 2', () =>
    getDoc(
      doc(
        founderPassword.db,
        'warehouse',
        'hgesm-aprov',
        'movements',
        phase2Movement1Id
      )
    )
  );

  console.log('\nFASE 4 — NF → estoque, cutoff e rastreabilidade');

  const phase4MaterialId = 'mat_' + '4'.repeat(32);
  const phase4Movement1Id = 'mov_' + '4'.repeat(64);
  const phase4Movement2Id = 'mov_' + '5'.repeat(64);
  const phase4InvalidMovementId = 'mov_' + '6'.repeat(64);
  const phase4Settings = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'settings',
    'invoice-integration'
  );
  const phase4Material = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'materials',
    phase4MaterialId
  );
  const phase4Balance = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'balances',
    phase4MaterialId
  );
  const phase4Movement1 = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'movements',
    phase4Movement1Id
  );

  await allowed('Fundador ativa cutoff e cria material + entrada + saldo na mesma operação', async () => {
    const batch = writeBatch(admin.db);
    batch.set(phase4Settings, {
      schemaVersion: 'warehouse_invoice_settings_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      cutoffAt: '2026-09-23T15:00:00.000Z',
      activatedBy: admin.user.uid,
    });
    batch.set(phase4Material, {
      schemaVersion: 'warehouse_material_v1',
      id: phase4MaterialId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      description: 'Material criado pela NF',
      aliases: [],
      unit: { code: 'unit', label: null },
      status: 'active',
      conversions: [],
    });
    batch.set(phase4Movement1, {
      schemaVersion: 'warehouse_movement_v1',
      id: phase4Movement1Id,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: phase4MaterialId,
      type: 'INVOICE_ENTRY',
      quantityDelta: 4,
      idempotencyKeyHash: '4'.repeat(64),
      reversesMovementId: null,
      note: 'NF 12345 · Empenho 2026NE001',
      source: {
        kind: 'INVOICE',
        action: 'ENTRY',
        invoiceRecordKey: '12345678000199__12345',
        invoiceId: '12345',
        empenhoId: '2026NE001',
        itemIds: ['00001'],
        supplier: 'Fornecedor Teste',
        supplierCnpj: '12345678000199',
        actorUid: admin.user.uid,
      },
      createdAt: serverTimestamp(),
    });
    batch.set(phase4Balance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: phase4MaterialId,
      quantity: 4,
      revision: 1,
      lastMovementId: phase4Movement1Id,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await allowed('Fundador lê movimento de NF da FASE 4', () => getDoc(phase4Movement1));
  await allowed('Fundador lê cutoff imutável da FASE 4', () => getDoc(phase4Settings));

  await allowed('Correção de NF gera novo movimento e nova revisão do mesmo saldo', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'movements', phase4Movement2Id),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase4Movement2Id,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: phase4MaterialId,
        type: 'INVOICE_CORRECTION',
        quantityDelta: 2,
        idempotencyKeyHash: '5'.repeat(64),
        reversesMovementId: null,
        note: 'NF 12345 · correção',
        source: {
          kind: 'INVOICE',
          action: 'CORRECTION',
          invoiceRecordKey: '12345678000199__12345',
          invoiceId: '12345',
          empenhoId: '2026NE001',
          itemIds: ['00001'],
          supplier: 'Fornecedor Teste',
          supplierCnpj: '12345678000199',
          actorUid: admin.user.uid,
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(phase4Balance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: phase4MaterialId,
      quantity: 6,
      revision: 2,
      lastMovementId: phase4Movement2Id,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await denied('Origem de NF não pode falsificar o operador', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'movements', phase4InvalidMovementId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase4InvalidMovementId,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: phase4MaterialId,
        type: 'INVOICE_CORRECTION',
        quantityDelta: 1,
        idempotencyKeyHash: '6'.repeat(64),
        reversesMovementId: null,
        note: 'tentativa inválida',
        source: {
          kind: 'INVOICE',
          action: 'CORRECTION',
          invoiceRecordKey: '12345678000199__12345',
          invoiceId: '12345',
          empenhoId: '2026NE001',
          itemIds: ['00001'],
          supplier: 'Fornecedor Teste',
          supplierCnpj: '12345678000199',
          actorUid: 'uid-falsificado',
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(phase4Balance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: phase4MaterialId,
      quantity: 7,
      revision: 3,
      lastMovementId: phase4InvalidMovementId,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await denied('Cutoff da FASE 4 não pode ser reescrito após ativação', () =>
    updateDoc(phase4Settings, { cutoffAt: '2020-01-01T00:00:00.000Z' })
  );
  await denied('Setor externo não lê cutoff do ADM Depósito', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'settings',
        'invoice-integration'
      )
    )
  );
  await denied('Setor externo não lê movimento de NF do fundador', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'movements',
        phase4Movement1Id
      )
    )
  );

  console.log('\nFASE 6 — Depósitos / Localizações / Transferências');

  const phase6DepotId = 'dep_' + '6'.repeat(32);
  const phase6LocationId = 'loc_' + '6'.repeat(32);
  const phase6SubpositionId = 'sub_' + '6'.repeat(32);
  const phase6DepotRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'depots',
    phase6DepotId
  );
  const phase6LocationRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'locations',
    phase6LocationId
  );
  const phase6SubpositionRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'locations',
    phase6SubpositionId
  );

  await allowed('Fundador cria depósito da FASE 6', () =>
    setDoc(phase6DepotRef, {
      schemaVersion: 'warehouse_depot_v1',
      id: phase6DepotId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      code: 'DEP-06',
      name: 'Depósito FASE 6',
      description: 'Estrutura física operacional',
      status: 'active',
      createdBy: admin.user.uid,
      updatedBy: admin.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('Fundador cria local dentro do depósito da FASE 6', () =>
    setDoc(phase6LocationRef, {
      schemaVersion: 'warehouse_location_v1',
      id: phase6LocationId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      depotId: phase6DepotId,
      kind: 'LOCAL',
      parentLocationId: null,
      code: 'LOC-06',
      name: 'Local FASE 6',
      description: null,
      status: 'active',
      createdBy: admin.user.uid,
      updatedBy: admin.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('Fundador cria subposição opcional da FASE 6', () =>
    setDoc(phase6SubpositionRef, {
      schemaVersion: 'warehouse_location_v1',
      id: phase6SubpositionId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      depotId: phase6DepotId,
      kind: 'SUBPOSITION',
      parentLocationId: phase6LocationId,
      code: 'SUB-06',
      name: 'Subposição FASE 6',
      description: null,
      status: 'active',
      createdBy: admin.user.uid,
      updatedBy: admin.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('Fundador edita nome sem alterar identidade lógica do depósito', () =>
    updateDoc(phase6DepotRef, {
      name: 'Depósito FASE 6 renomeado',
      updatedBy: admin.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  await denied('Depósito da FASE 6 não aceita UG adulterada', () =>
    setDoc(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'depots', 'dep_' + 'a'.repeat(32)),
      {
        schemaVersion: 'warehouse_depot_v1',
        id: 'dep_' + 'a'.repeat(32),
        workspaceId: 'hgesm-aprov',
        ug: '999999',
        code: 'DEP-X',
        name: 'Depósito adulterado',
        description: null,
        status: 'active',
        createdBy: admin.user.uid,
        updatedBy: admin.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  );

  await denied('Setor externo continua sem acesso às localizações da FASE 6', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'locations',
        phase6LocationId
      )
    )
  );

  await denied('Depósito da FASE 6 não pode ser excluído fisicamente', () =>
    deleteDoc(phase6DepotRef)
  );
  await denied('Localização da FASE 6 não pode ser excluída fisicamente', () =>
    deleteDoc(phase6LocationRef)
  );

  const phase6TransferMovementId = 'mov_' + '7'.repeat(64);
  const phase6FromBalanceId = 'locbal_1f4db6d13593019e244c182002ecfbbb2764d28ce246c65fa31daa5bcb60c43f';
  const phase6ToBalanceId = 'locbal_44d9ac45e4e3ccec26b4bd88bb4d76964dbeb04f4716483f486329c99e96d722';
  const phase6FromBalanceRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'locationBalances',
    phase6FromBalanceId
  );
  const phase6ToBalanceRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'locationBalances',
    phase6ToBalanceId
  );

  await allowed('Transferência interna mantém saldo total e altera distribuição física', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(
        admin.db,
        'warehouse',
        'hgesm-aprov',
        'movements',
        phase6TransferMovementId
      ),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase6TransferMovementId,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        type: 'TRANSFER',
        quantityDelta: 0,
        idempotencyKeyHash: '7'.repeat(64),
        reversesMovementId: null,
        note: 'Transferência operacional FASE 6',
        source: {
          kind: 'LOCATION_TRANSFER',
          actorUid: admin.user.uid,
          quantity: 3,
          from: { kind: 'UNASSIGNED' },
          to: {
            kind: 'LOCATION',
            depotId: phase6DepotId,
            locationId: phase6LocationId,
            subpositionId: null,
          },
          fromBalanceId: phase6FromBalanceId,
          toBalanceId: phase6ToBalanceId,
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(founderBalance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      quantity: 8,
      revision: 3,
      lastMovementId: phase6TransferMovementId,
      updatedAt: serverTimestamp(),
    });
    batch.set(phase6FromBalanceRef, {
      schemaVersion: 'warehouse_location_balance_v1',
      id: phase6FromBalanceId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      position: { kind: 'UNASSIGNED' },
      quantity: 5,
      revision: 1,
      lastMovementId: phase6TransferMovementId,
      updatedAt: serverTimestamp(),
    });
    batch.set(phase6ToBalanceRef, {
      schemaVersion: 'warehouse_location_balance_v1',
      id: phase6ToBalanceId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      position: {
        kind: 'LOCATION',
        depotId: phase6DepotId,
        locationId: phase6LocationId,
        subpositionId: null,
      },
      quantity: 3,
      revision: 1,
      lastMovementId: phase6TransferMovementId,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  const phase6AggregateAfter = await getDoc(founderBalance);
  const phase6OriginAfter = await getDoc(phase6FromBalanceRef);
  const phase6DestinationAfter = await getDoc(phase6ToBalanceRef);
  assert.equal(phase6AggregateAfter.data().quantity, 8);
  assert.equal(phase6OriginAfter.data().quantity, 5);
  assert.equal(phase6DestinationAfter.data().quantity, 3);

  await denied('Projeção física não aceita gravação avulsa sem movimento novo', () =>
    updateDoc(phase6ToBalanceRef, {
      quantity: 99,
      revision: 2,
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('Fundador inativa local sem apagá-lo', () =>
    updateDoc(phase6LocationRef, {
      status: 'inactive',
      updatedBy: admin.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  const phase6InactiveTransferId = 'mov_' + '9'.repeat(64);
  await denied('Local inativo não pode receber transferência', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'movements', phase6InactiveTransferId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase6InactiveTransferId,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        type: 'TRANSFER',
        quantityDelta: 0,
        idempotencyKeyHash: '9'.repeat(64),
        reversesMovementId: null,
        note: null,
        source: {
          kind: 'LOCATION_TRANSFER',
          actorUid: admin.user.uid,
          quantity: 1,
          from: { kind: 'UNASSIGNED' },
          to: {
            kind: 'LOCATION',
            depotId: phase6DepotId,
            locationId: phase6LocationId,
            subpositionId: null,
          },
          fromBalanceId: phase6FromBalanceId,
          toBalanceId: phase6ToBalanceId,
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(founderBalance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      quantity: 8,
      revision: 4,
      lastMovementId: phase6InactiveTransferId,
      updatedAt: serverTimestamp(),
    });
    batch.set(phase6FromBalanceRef, {
      schemaVersion: 'warehouse_location_balance_v1',
      id: phase6FromBalanceId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      position: { kind: 'UNASSIGNED' },
      quantity: 4,
      revision: 2,
      lastMovementId: phase6InactiveTransferId,
      updatedAt: serverTimestamp(),
    });
    batch.set(phase6ToBalanceRef, {
      schemaVersion: 'warehouse_location_balance_v1',
      id: phase6ToBalanceId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      position: {
        kind: 'LOCATION',
        depotId: phase6DepotId,
        locationId: phase6LocationId,
        subpositionId: null,
      },
      quantity: 4,
      revision: 2,
      lastMovementId: phase6InactiveTransferId,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await allowed('Fundador reativa local para uso posterior', () =>
    updateDoc(phase6LocationRef, {
      status: 'active',
      updatedBy: admin.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  console.log('\nFASE 7 — Estoque Operável / Lotes / Validade / FEFO');

  const phase7InvoiceLotId = 'lot_' + '7'.repeat(32);
  const phase7InvoiceLotRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'lots',
    phase7InvoiceLotId
  );
  const phase7InvoiceOrigin = {
    kind: 'INVOICE',
    movementId: phase4Movement1Id,
    invoiceRecordKey: '12345678000199__12345',
    invoiceId: '12345',
    supplier: 'Fornecedor Teste',
    supplierCnpj: '12345678000199',
  };

  await allowed('Fundador cria lote FASE 7 vinculado a material e origem de NF', () =>
    setDoc(phase7InvoiceLotRef, {
      schemaVersion: 'warehouse_lot_v1',
      id: phase7InvoiceLotId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: phase4MaterialId,
      code: 'NF-12345-L1',
      expiresOn: '2027-01-15',
      quantity: 4,
      position: { kind: 'UNASSIGNED' },
      origin: phase7InvoiceOrigin,
      status: 'active',
      createdBy: admin.user.uid,
      updatedBy: admin.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await denied('Lote FASE 7 rejeita validade fora do contrato', () =>
    setDoc(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'lots', 'lot_' + '8'.repeat(32)),
      {
        schemaVersion: 'warehouse_lot_v1',
        id: 'lot_' + '8'.repeat(32),
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: phase4MaterialId,
        code: 'INVALID-DATE',
        expiresOn: '15/01/2027',
        quantity: 1,
        position: { kind: 'UNASSIGNED' },
        origin: phase7InvoiceOrigin,
        status: 'active',
        createdBy: admin.user.uid,
        updatedBy: admin.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  );

  await denied('Lote FASE 7 não pode trocar material canônico após criação', () =>
    updateDoc(phase7InvoiceLotRef, {
      materialId: canonicalMaterialId,
      updatedBy: admin.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  await denied('Lote FASE 7 não aceita origem de NF pertencente a outro material', () =>
    setDoc(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'lots', 'lot_' + '9'.repeat(32)),
      {
        schemaVersion: 'warehouse_lot_v1',
        id: 'lot_' + '9'.repeat(32),
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        code: 'ORIGIN-MISMATCH',
        expiresOn: '2027-03-01',
        quantity: 1,
        position: { kind: 'UNASSIGNED' },
        origin: phase7InvoiceOrigin,
        status: 'active',
        createdBy: admin.user.uid,
        updatedBy: admin.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  );

  await denied('Lote FASE 7 não aceita UG adulterada', () =>
    setDoc(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'lots', 'lot_' + 'a'.repeat(32)),
      {
        schemaVersion: 'warehouse_lot_v1',
        id: 'lot_' + 'a'.repeat(32),
        workspaceId: 'hgesm-aprov',
        ug: '999999',
        materialId: canonicalMaterialId,
        code: 'UG-INVALID',
        expiresOn: null,
        quantity: 1,
        position: { kind: 'UNASSIGNED' },
        origin: {
          kind: 'MANUAL_ENRICHMENT',
          movementId: null,
          invoiceRecordKey: null,
          invoiceId: null,
          supplier: null,
          supplierCnpj: null,
        },
        status: 'active',
        createdBy: admin.user.uid,
        updatedBy: admin.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  );

  await denied('Setor externo continua sem acesso aos lotes da FASE 7', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'lots',
        phase7InvoiceLotId
      )
    )
  );

  await denied('Setor externo não cria lote nem no namespace fundador', () =>
    setDoc(
      doc(sessionA.db, 'warehouse', 'hgesm-aprov', 'lots', 'lot_' + 'b'.repeat(32)),
      {
        schemaVersion: 'warehouse_lot_v1',
        id: 'lot_' + 'b'.repeat(32),
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: phase4MaterialId,
        code: 'EXTERNAL',
        expiresOn: null,
        quantity: 1,
        position: { kind: 'UNASSIGNED' },
        origin: {
          kind: 'MANUAL_ENRICHMENT',
          movementId: null,
          invoiceRecordKey: null,
          invoiceId: null,
          supplier: null,
          supplierCnpj: null,
        },
        status: 'active',
        createdBy: sessionA.user.uid,
        updatedBy: sessionA.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  );

  await denied('Lote FASE 7 não pode ser excluído e perder histórico logístico', () =>
    deleteDoc(phase7InvoiceLotRef)
  );

  const phase7ManualOrigin = {
    kind: 'MANUAL_ENRICHMENT',
    movementId: null,
    invoiceRecordKey: null,
    invoiceId: null,
    supplier: null,
    supplierCnpj: null,
  };
  await allowed('Fundador cria lotes FEFO sem alterar saldo oficial', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'lots', 'lot_' + 'c'.repeat(32)),
      {
        schemaVersion: 'warehouse_lot_v1',
        id: 'lot_' + 'c'.repeat(32),
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        code: 'LOTE-FEFO-PRIMEIRO',
        expiresOn: '2026-11-10',
        quantity: 2,
        position: { kind: 'UNASSIGNED' },
        origin: phase7ManualOrigin,
        status: 'active',
        createdBy: admin.user.uid,
        updatedBy: admin.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'lots', 'lot_' + 'd'.repeat(32)),
      {
        schemaVersion: 'warehouse_lot_v1',
        id: 'lot_' + 'd'.repeat(32),
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        code: 'LOTE-FEFO-DEPOIS',
        expiresOn: '2026-12-15',
        quantity: 2,
        position: {
          kind: 'LOCATION',
          depotId: phase6DepotId,
          locationId: phase6LocationId,
          subpositionId: null,
        },
        origin: phase7ManualOrigin,
        status: 'active',
        createdBy: admin.user.uid,
        updatedBy: admin.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    return batch.commit();
  });

  const phase7BalanceAfter = await getDoc(founderBalance);
  assert.equal(
    phase7BalanceAfter.data().quantity,
    8,
    'Enriquecimento de lotes jamais altera warehouse_balance_v1'
  );


  console.log('\nFASE 8 — Código de barras / Scanner / Saída Expressa');

  const phase8BarcodeId = 'bar_' + '8'.repeat(64);
  const phase8BarcodeRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'barcodes',
    phase8BarcodeId
  );
  const phase8Barcode = {
    schemaVersion: 'warehouse_barcode_v1',
    id: phase8BarcodeId,
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    materialId: canonicalMaterialId,
    barcode: '7891234567808',
    presentation: { code: 'kg', label: null },
    factorToBaseUnit: 1,
    status: 'active',
    createdBy: admin.user.uid,
    updatedBy: admin.user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await allowed('Fundador associa barcode FASE 8 ao material canônico', () =>
    setDoc(phase8BarcodeRef, phase8Barcode)
  );
  await allowed('Fundador lê barcode FASE 8', () => getDoc(phase8BarcodeRef));

  await denied('Barcode FASE 8 rejeita UG adulterada', () =>
    setDoc(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'barcodes', 'bar_' + 'a'.repeat(64)),
      {
        ...phase8Barcode,
        id: 'bar_' + 'a'.repeat(64),
        barcode: '7891234567809',
        ug: '999999',
      }
    )
  );

  await denied('Barcode FASE 8 não pode trocar material após associação', () =>
    updateDoc(phase8BarcodeRef, {
      materialId: phase4MaterialId,
      updatedBy: admin.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  await denied('Setor externo não lê códigos de barras da FASE 8', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'barcodes',
        phase8BarcodeId
      )
    )
  );

  await denied('Setor externo não cria barcode nem no namespace fundador', () =>
    setDoc(
      doc(sessionA.db, 'warehouse', 'hgesm-aprov', 'barcodes', 'bar_' + 'b'.repeat(64)),
      {
        ...phase8Barcode,
        id: 'bar_' + 'b'.repeat(64),
        barcode: '7891234567810',
        createdBy: sessionA.user.uid,
        updatedBy: sessionA.user.uid,
      }
    )
  );

  const phase8MovementId = 'mov_' + 'e'.repeat(64);
  await allowed('Saída expressa FASE 8 baixa ledger, saldo e posição na mesma operação', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'movements', phase8MovementId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase8MovementId,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        type: 'OUTBOUND',
        quantityDelta: -1,
        idempotencyKeyHash: 'e'.repeat(64),
        reversesMovementId: null,
        note: 'Saída expressa security test',
        source: {
          kind: 'EXPRESS_OUTBOUND',
          interface: 'BARCODE_SCANNER',
          actorUid: admin.user.uid,
          requestedQuantity: 1,
          quantity: 1,
          presentation: { code: 'kg', label: null },
          factorToBaseUnit: 1,
          barcodeId: phase8BarcodeId,
          barcode: '7891234567808',
          position: { kind: 'UNASSIGNED' },
          locationBalanceId: phase6FromBalanceId,
          lotId: null,
          lotCode: null,
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(founderBalance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      quantity: 7,
      revision: 4,
      lastMovementId: phase8MovementId,
      updatedAt: serverTimestamp(),
    });
    batch.set(phase6FromBalanceRef, {
      schemaVersion: 'warehouse_location_balance_v1',
      id: phase6FromBalanceId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      position: { kind: 'UNASSIGNED' },
      quantity: 4,
      revision: 2,
      lastMovementId: phase8MovementId,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  const phase8BalanceAfter = await getDoc(founderBalance);
  const phase8PositionAfter = await getDoc(phase6FromBalanceRef);
  assert.equal(phase8BalanceAfter.data().quantity, 7);
  assert.equal(phase8PositionAfter.data().quantity, 4);

  const phase8MissingPositionId = 'mov_' + 'd'.repeat(64);
  await denied('Saída expressa FASE 8 exige baixa física atômica correspondente', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'movements', phase8MissingPositionId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase8MissingPositionId,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        type: 'OUTBOUND',
        quantityDelta: -1,
        idempotencyKeyHash: 'd'.repeat(64),
        reversesMovementId: null,
        note: null,
        source: {
          kind: 'EXPRESS_OUTBOUND',
          interface: 'BARCODE_SCANNER',
          actorUid: admin.user.uid,
          requestedQuantity: 1,
          quantity: 1,
          presentation: { code: 'kg', label: null },
          factorToBaseUnit: 1,
          barcodeId: phase8BarcodeId,
          barcode: '7891234567808',
          position: { kind: 'UNASSIGNED' },
          locationBalanceId: phase6FromBalanceId,
          lotId: null,
          lotCode: null,
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(founderBalance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      quantity: 6,
      revision: 5,
      lastMovementId: phase8MissingPositionId,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  const phase8NegativeId = 'mov_' + 'c'.repeat(64);
  await denied('Saída expressa FASE 8 não pode produzir saldo negativo', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'movements', phase8NegativeId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase8NegativeId,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        type: 'OUTBOUND',
        quantityDelta: -8,
        idempotencyKeyHash: 'c'.repeat(64),
        reversesMovementId: null,
        note: null,
        source: {
          kind: 'EXPRESS_OUTBOUND',
          interface: 'BARCODE_SCANNER',
          actorUid: admin.user.uid,
          requestedQuantity: 8,
          quantity: 8,
          presentation: { code: 'kg', label: null },
          factorToBaseUnit: 1,
          barcodeId: phase8BarcodeId,
          barcode: '7891234567808',
          position: { kind: 'UNASSIGNED' },
          locationBalanceId: phase6FromBalanceId,
          lotId: null,
          lotCode: null,
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(founderBalance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      quantity: -1,
      revision: 5,
      lastMovementId: phase8NegativeId,
      updatedAt: serverTimestamp(),
    });
    batch.set(phase6FromBalanceRef, {
      schemaVersion: 'warehouse_location_balance_v1',
      id: phase6FromBalanceId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      position: { kind: 'UNASSIGNED' },
      quantity: -4,
      revision: 3,
      lastMovementId: phase8NegativeId,
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await denied('Barcode FASE 8 não pode ser excluído fisicamente', () =>
    deleteDoc(phase8BarcodeRef)
  );


  console.log('\nFASE 9 — Visão do Depósito / Editor / Persistência');

  const phase9LayoutV1Id = 'lay_' + '1'.repeat(32);
  const phase9LayoutV2Id = 'lay_' + '2'.repeat(32);
  const phase9Object = {
    id: 'obj_' + '9'.repeat(32),
    kind: 'SHELF',
    label: 'Estante FASE 9',
    x: 32,
    y: 40,
    width: 180,
    height: 80,
    rotation: 0,
    layer: 1,
    elevation: 1,
    visualVariant: 'solid',
    warehouseLocationId: phase6LocationId,
  };
  const phase9LayoutV1Ref = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'layouts',
    phase9LayoutV1Id
  );
  const phase9LayoutV2Ref = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'layouts',
    phase9LayoutV2Id
  );
  const phase9LayoutBase = {
    schemaVersion: 'warehouse_depot_layout_v1',
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    name: 'Croqui principal FASE 9',
    depotId: phase6DepotId,
    logicalWidth: 1000,
    logicalHeight: 620,
    objects: [phase9Object],
    createdBy: admin.user.uid,
    updatedBy: admin.user.uid,
  };

  await allowed('Fundador cria layout ativo FASE 9 sem tocar no estoque', () =>
    setDoc(phase9LayoutV1Ref, {
      ...phase9LayoutBase,
      id: phase9LayoutV1Id,
      version: 1,
      status: 'active',
      previousVersionId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('Fundador lê layout FASE 9', () => getDoc(phase9LayoutV1Ref));

  await denied('Layout FASE 9 rejeita UG adulterada', () =>
    setDoc(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'layouts', 'lay_' + '3'.repeat(32)),
      {
        ...phase9LayoutBase,
        id: 'lay_' + '3'.repeat(32),
        ug: '999999',
        version: 1,
        status: 'active',
        previousVersionId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  );

  await allowed('FASE 9 arquiva versão anterior e ativa nova versão atomicamente', async () => {
    const batch = writeBatch(admin.db);
    batch.update(phase9LayoutV1Ref, {
      status: 'archived',
      updatedBy: admin.user.uid,
      updatedAt: serverTimestamp(),
    });
    batch.set(phase9LayoutV2Ref, {
      ...phase9LayoutBase,
      id: phase9LayoutV2Id,
      name: 'Croqui principal FASE 9 v2',
      objects: [{ ...phase9Object, x: 96 }],
      version: 2,
      status: 'active',
      previousVersionId: phase9LayoutV1Id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await denied('Layout arquivado não pode ter geometria reescrita', () =>
    updateDoc(phase9LayoutV1Ref, {
      objects: [{ ...phase9Object, x: 999 }],
      updatedBy: admin.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  await denied('Setor externo não lê layout da FASE 9', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'layouts',
        phase9LayoutV2Id
      )
    )
  );

  await denied('Setor externo não cria layout nem no próprio workspace', () =>
    setDoc(
      doc(sessionA.db, 'warehouse', 'workspace-a', 'layouts', 'lay_' + '4'.repeat(32)),
      {
        ...phase9LayoutBase,
        id: 'lay_' + '4'.repeat(32),
        workspaceId: 'workspace-a',
        version: 1,
        status: 'active',
        previousVersionId: null,
        createdBy: sessionA.user.uid,
        updatedBy: sessionA.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  );

  await denied('Layout FASE 9 não pode ser excluído fisicamente', () =>
    deleteDoc(phase9LayoutV2Ref)
  );

  console.log('\nFASE 10 — Inventário Físico');

  const phase10InventoryId = 'inv_' + 'a'.repeat(32);
  const phase10ItemId = 'invit_' + 'b'.repeat(64);
  const phase10MovementId = 'mov_' + 'd'.repeat(64);
  const phase10InventoryRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'inventories',
    phase10InventoryId
  );
  const phase10ItemRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'inventories',
    phase10InventoryId,
    'items',
    phase10ItemId
  );

  const phase10BalanceBefore = await getDoc(founderBalance);
  const phase10LocationBefore = await getDoc(phase6FromBalanceRef);
  assert.equal(phase10BalanceBefore.exists(), true);
  assert.equal(phase10LocationBefore.exists(), true);
  const phase10Aggregate = phase10BalanceBefore.data();
  const phase10Physical = phase10LocationBefore.data();
  const phase10Counted = phase10Physical.quantity + 1;

  await allowed('Fundador abre sessão de inventário FASE 10', () =>
    setDoc(phase10InventoryRef, {
      schemaVersion: 'warehouse_inventory_v1',
      id: phase10InventoryId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      scope: { kind: 'TOTAL' },
      status: 'OPENING',
      itemCount: 1,
      openedBy: admin.user.uid,
      reviewedBy: null,
      confirmationStartedBy: null,
      confirmedBy: null,
      cancelledBy: null,
      reviewSummary: null,
      staleItemId: null,
      referenceCapturedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedAt: null,
      confirmationStartedAt: null,
      confirmedAt: null,
      cancelledAt: null,
    })
  );

  await allowed('Fundador cria item separado do estoque oficial', () =>
    setDoc(phase10ItemRef, {
      schemaVersion: 'warehouse_inventory_item_v1',
      id: phase10ItemId,
      inventoryId: phase10InventoryId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      position: { kind: 'UNASSIGNED' },
      locationBalanceId: phase6FromBalanceId,
      expectedQuantity: phase10Physical.quantity,
      expectedBalanceRevision: phase10Aggregate.revision,
      expectedBalanceLastMovementId: phase10Aggregate.lastMovementId,
      expectedLocationRevision: phase10Physical.revision,
      expectedLocationLastMovementId: phase10Physical.lastMovementId,
      countedQuantity: null,
      difference: null,
      status: 'PENDING',
      countedBy: null,
      countedAt: null,
      adjustmentMovementId: null,
      adjustedBy: null,
      adjustedAt: null,
    })
  );

  await allowed('Sessão FASE 10 entra em contagem', () =>
    updateDoc(phase10InventoryRef, {
      status: 'COUNTING',
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('Salvar contagem não altera saldo oficial', () =>
    updateDoc(phase10ItemRef, {
      countedQuantity: phase10Counted,
      difference: 1,
      status: 'DIVERGENT',
      countedBy: admin.user.uid,
      countedAt: serverTimestamp(),
      adjustmentMovementId: null,
      adjustedBy: null,
      adjustedAt: null,
    })
  );
  const phase10BalanceAfterCount = await getDoc(founderBalance);
  const phase10LocationAfterCount = await getDoc(phase6FromBalanceRef);
  assert.equal(phase10BalanceAfterCount.data().quantity, phase10Aggregate.quantity);
  assert.equal(phase10LocationAfterCount.data().quantity, phase10Physical.quantity);

  await denied('Contagem isolada não pode escrever saldo diretamente', () =>
    updateDoc(founderBalance, {
      quantity: phase10Aggregate.quantity + 1,
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('Fundador fecha contagem para revisão', () =>
    updateDoc(phase10InventoryRef, {
      status: 'REVIEW',
      reviewedBy: admin.user.uid,
      reviewSummary: {
        totalItems: 1,
        countedItems: 1,
        matchedItems: 0,
        divergentItems: 1,
        adjustedItems: 0,
        positiveDifference: 1,
        negativeDifference: 0,
      },
      reviewedAt: serverTimestamp(),
      staleItemId: null,
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('Fundador inicia confirmação explícita', () =>
    updateDoc(phase10InventoryRef, {
      status: 'CONFIRMING',
      confirmationStartedBy: admin.user.uid,
      confirmationStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('INVENTORY_ADJUSTMENT atualiza ledger e projeções atomicamente', async () => {
    const batch = writeBatch(admin.db);
    batch.set(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'movements', phase10MovementId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: phase10MovementId,
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        materialId: canonicalMaterialId,
        type: 'INVENTORY_ADJUSTMENT',
        quantityDelta: 1,
        idempotencyKeyHash: 'd'.repeat(64),
        reversesMovementId: null,
        note: 'Ajuste confirmado no inventário físico ' + phase10InventoryId,
        source: {
          kind: 'PHYSICAL_INVENTORY',
          actorUid: admin.user.uid,
          inventoryId: phase10InventoryId,
          inventoryItemId: phase10ItemId,
          expectedQuantity: phase10Physical.quantity,
          countedQuantity: phase10Counted,
          position: { kind: 'UNASSIGNED' },
          locationBalanceId: phase6FromBalanceId,
          expectedLocationRevision: phase10Physical.revision,
          expectedLocationLastMovementId: phase10Physical.lastMovementId,
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(founderBalance, {
      schemaVersion: 'warehouse_balance_v1',
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      quantity: phase10Aggregate.quantity + 1,
      revision: phase10Aggregate.revision + 1,
      lastMovementId: phase10MovementId,
      updatedAt: serverTimestamp(),
    });
    batch.set(phase6FromBalanceRef, {
      schemaVersion: 'warehouse_location_balance_v1',
      id: phase6FromBalanceId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      materialId: canonicalMaterialId,
      position: { kind: 'UNASSIGNED' },
      quantity: phase10Physical.quantity + 1,
      revision: phase10Physical.revision + 1,
      lastMovementId: phase10MovementId,
      updatedAt: serverTimestamp(),
    });
    batch.update(phase10ItemRef, {
      status: 'ADJUSTED',
      adjustmentMovementId: phase10MovementId,
      adjustedBy: admin.user.uid,
      adjustedAt: serverTimestamp(),
    });
    return batch.commit();
  });

  await allowed('Fundador finaliza sessão FASE 10', () =>
    updateDoc(phase10InventoryRef, {
      status: 'CONFIRMED',
      confirmedBy: admin.user.uid,
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      staleItemId: null,
    })
  );

  await denied('Sessão finalizada FASE 10 não pode ser reescrita', () =>
    updateDoc(phase10InventoryRef, {
      status: 'COUNTING',
      updatedAt: serverTimestamp(),
    })
  );
  await denied('Histórico FASE 10 não pode ser excluído', () =>
    deleteDoc(phase10InventoryRef)
  );
  await denied('Setor externo não lê inventário da FASE 10', () =>
    getDoc(
      doc(
        sessionA.db,
        'warehouse',
        'hgesm-aprov',
        'inventories',
        phase10InventoryId
      )
    )
  );
  await denied('Inventário FASE 10 rejeita UG adulterada', () =>
    setDoc(
      doc(admin.db, 'warehouse', 'hgesm-aprov', 'inventories', 'inv_' + 'e'.repeat(32)),
      {
        schemaVersion: 'warehouse_inventory_v1',
        id: 'inv_' + 'e'.repeat(32),
        workspaceId: 'hgesm-aprov',
        ug: '999999',
        scope: { kind: 'TOTAL' },
        status: 'OPENING',
        itemCount: 1,
        openedBy: admin.user.uid,
        reviewedBy: null,
        confirmationStartedBy: null,
        confirmedBy: null,
        cancelledBy: null,
        reviewSummary: null,
        staleItemId: null,
        referenceCapturedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        reviewedAt: null,
        confirmationStartedAt: null,
        confirmedAt: null,
        cancelledAt: null,
      }
    )
  );

  console.log('Isolamento A ↔ B');
  await allowed('Setor A lê o próprio empenho', () =>
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'empenhos', 'sample'))
  );
  await allowed('Setor B lê o próprio empenho', () =>
    getDoc(doc(sessionB.db, 'workspaces', 'workspace-b', 'empenhos', 'sample'))
  );
  await denied('Setor A não lê empenho do Setor B', () =>
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-b', 'empenhos', 'sample'))
  );
  await denied('Setor B não lê empenho do Setor A', () =>
    getDoc(doc(sessionB.db, 'workspaces', 'workspace-a', 'empenhos', 'sample'))
  );
  await allowed('Setor A grava no próprio workspace', () =>
    setDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'alerts', 'self-write'), {
      workspaceId: 'workspace-a',
      marker: 'allowed',
    })
  );
  await denied('Setor A não grava no workspace B', () =>
    setDoc(doc(sessionA.db, 'workspaces', 'workspace-b', 'alerts', 'cross-write'), {
      workspaceId: 'workspace-b',
      marker: 'forbidden',
    })
  );

  console.log('\nBloco 16.1 — limite de sessões simultâneas por UG');

  const sessionLeaseExpiry = () => Timestamp.fromMillis(Date.now() + (30 * 60 * 1000));
  const sessionLeasePayload = (slotId, sessionId, browserInstanceId) => ({
    leaseVersion: 'emprovex_session_v1',
    slotId,
    sessionId,
    workspaceId: 'workspace-a',
    ug: '160416',
    uid: sessionA.user.uid,
    accountEmail: identities.a.email,
    browserInstanceId,
    startedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    expiresAt: sessionLeaseExpiry(),
  });

  const sessionSlot1 = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'sessionSlots',
    'slot-1'
  );
  const sessionSlot2 = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'sessionSlots',
    'slot-2'
  );

  await allowed('Setor externo ocupa o primeiro slot de sessão', () =>
    setDoc(sessionSlot1, sessionLeasePayload('slot-1', 'session-browser-a1', 'browser-instance-a1'))
  );
  await allowed('Setor externo ocupa o segundo slot de sessão', () =>
    setDoc(sessionSlot2, sessionLeasePayload('slot-2', 'session-browser-a2', 'browser-instance-a2'))
  );
  await denied('Terceiro slot não existe no contrato de capacidade', () =>
    setDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'sessionSlots', 'slot-3'),
      sessionLeasePayload('slot-3', 'session-browser-a3', 'browser-instance-a3')
    )
  );
  await denied('Sessão diferente não sobrescreve slot ainda ativo', () =>
    setDoc(
      sessionSlot1,
      sessionLeasePayload('slot-1', 'session-browser-intruso', 'browser-instance-intruso')
    )
  );
  await allowed('Mesma sessão renova diretamente o slot conhecido com identidade confirmada', () =>
    updateDoc(sessionSlot1, {
      leaseVersion: 'emprovex_session_v1',
      slotId: 'slot-1',
      sessionId: 'session-browser-a1',
      workspaceId: 'workspace-a',
      ug: '160416',
      uid: sessionA.user.uid,
      accountEmail: identities.a.email,
      browserInstanceId: 'browser-instance-a1',
      lastSeenAt: serverTimestamp(),
      expiresAt: sessionLeaseExpiry(),
    })
  );
  await denied('Outro workspace não lê slots de sessão do Setor A', () =>
    getDoc(doc(sessionB.db, 'workspaces', 'workspace-a', 'sessionSlots', 'slot-1'))
  );
  await allowed('Administrador pode observar slots como metadado de capacidade', () =>
    getDoc(doc(admin.db, 'workspaces', 'workspace-a', 'sessionSlots', 'slot-1'))
  );
  await denied('Conta fundadora não consome slot no workspace fundador', () =>
    setDoc(
      doc(admin.db, 'workspaces', 'hgesm-aprov', 'sessionSlots', 'slot-1'),
      {
        leaseVersion: 'emprovex_session_v1',
        slotId: 'slot-1',
        sessionId: 'founder-session',
        workspaceId: 'hgesm-aprov',
        ug: '160416',
        uid: admin.user.uid,
        accountEmail: identities.founder.email,
        browserInstanceId: 'founder-browser',
        startedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        expiresAt: sessionLeaseExpiry(),
      }
    )
  );

  await allowed('Logout explícito pode liberar o slot da própria conta', () =>
    deleteDoc(sessionSlot2)
  );

  await ownerSet('workspaces/workspace-a/sessionSlots/slot-2', {
    leaseVersion: 'emprovex_session_v1',
    slotId: 'slot-2',
    sessionId: 'expired-session',
    workspaceId: 'workspace-a',
    ug: '160416',
    uid: sessionA.user.uid,
    accountEmail: identities.a.email,
    browserInstanceId: 'expired-browser',
    startedAt: new Date(Date.now() - (30 * 60 * 1000)),
    lastSeenAt: new Date(Date.now() - (30 * 60 * 1000)),
    expiresAt: new Date(Date.now() - (20 * 60 * 1000)),
  });

  await allowed('Slot expirado pode ser retomado por uma nova sessão', () =>
    setDoc(
      sessionSlot2,
      sessionLeasePayload('slot-2', 'session-browser-reclaimed', 'browser-instance-reclaimed')
    )
  );

  await denied('Sessão antiga não renova slot retomado por outra identidade lógica', () =>
    updateDoc(sessionSlot2, {
      leaseVersion: 'emprovex_session_v1',
      slotId: 'slot-2',
      sessionId: 'expired-session',
      workspaceId: 'workspace-a',
      ug: '160416',
      uid: sessionA.user.uid,
      accountEmail: identities.a.email,
      browserInstanceId: 'expired-browser',
      lastSeenAt: serverTimestamp(),
      expiresAt: sessionLeaseExpiry(),
    })
  );

  await allowed('Sessão vencedora renova diretamente o slot retomado', () =>
    updateDoc(sessionSlot2, {
      leaseVersion: 'emprovex_session_v1',
      slotId: 'slot-2',
      sessionId: 'session-browser-reclaimed',
      workspaceId: 'workspace-a',
      ug: '160416',
      uid: sessionA.user.uid,
      accountEmail: identities.a.email,
      browserInstanceId: 'browser-instance-reclaimed',
      lastSeenAt: serverTimestamp(),
      expiresAt: sessionLeaseExpiry(),
    })
  );

  console.log('\nBloco 16.2 — painel e encerramento remoto de sessões');

  await allowed('Administrador lista slots de sessão de toda a plataforma', () =>
    getDocs(collectionGroup(admin.db, 'sessionSlots'))
  );

  const revokedSessionId = 'session-browser-a1';
  const revocationRefA1 = doc(
    admin.db,
    'workspaces',
    'workspace-a',
    'sessionRevocations',
    revokedSessionId
  );

  await allowed('Administrador revoga e libera uma sessão na mesma transação', () =>
    runTransaction(admin.db, async (transaction) => {
      const snapshot = await transaction.get(
        doc(admin.db, 'workspaces', 'workspace-a', 'sessionSlots', 'slot-1')
      );
      assert.equal(snapshot.exists(), true);

      transaction.set(revocationRefA1, {
        revocationVersion: 'emprovex_session_revocation_v1',
        sessionId: revokedSessionId,
        workspaceId: 'workspace-a',
        ug: '160416',
        uid: sessionA.user.uid,
        accountEmail: identities.a.email,
        slotId: 'slot-1',
        createdAt: serverTimestamp(),
        createdBy: identities.founder.email,
        expiresAt: Timestamp.fromMillis(Date.now() + (24 * 60 * 60 * 1000)),
      });
      transaction.delete(
        doc(admin.db, 'workspaces', 'workspace-a', 'sessionSlots', 'slot-1')
      );
    })
  );

  await allowed('Setor lê tombstone conhecido dentro do próprio workspace', () =>
    getDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'sessionRevocations',
        revokedSessionId
      )
    )
  );

  await denied('Tombstone existente é imutável e não pode ser reciclado pelo administrador', () =>
    setDoc(revocationRefA1, {
      revocationVersion: 'emprovex_session_revocation_v1',
      sessionId: revokedSessionId,
      workspaceId: 'workspace-a',
      ug: '160416',
      uid: sessionA.user.uid,
      accountEmail: identities.a.email,
      slotId: 'slot-1',
      createdAt: serverTimestamp(),
      createdBy: identities.founder.email,
      expiresAt: Timestamp.fromMillis(Date.now() + (48 * 60 * 60 * 1000)),
    })
  );

  await allowed('Setor pode verificar tombstone inexistente antes de adquirir lease', () =>
    getDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'sessionRevocations',
        'session-ainda-nao-revogada'
      )
    )
  );

  await denied('Outro workspace não lê revogação de sessão do Setor A', () =>
    getDoc(
      doc(
        sessionB.db,
        'workspaces',
        'workspace-a',
        'sessionRevocations',
        revokedSessionId
      )
    )
  );

  await denied('Setor operacional não cria tombstone de revogação', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'sessionRevocations',
        'forged-revocation'
      ),
      {
        revocationVersion: 'emprovex_session_revocation_v1',
        sessionId: 'forged-revocation',
        workspaceId: 'workspace-a',
        ug: '160416',
        uid: sessionA.user.uid,
        accountEmail: identities.a.email,
        slotId: 'slot-1',
        createdAt: serverTimestamp(),
        createdBy: identities.a.email,
        expiresAt: Timestamp.fromMillis(Date.now() + (24 * 60 * 60 * 1000)),
      }
    )
  );

  console.log('\nBloco 16.3 — telemetria estimada por UG');

  const usageDayKey = '2026-09-19';
  const usageRefA = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'usageEstimates',
    usageDayKey
  );
  const usagePayload = {
    telemetryVersion: 'emprovex_usage_v1',
    source: 'emprovex-workspace-estimate',
    workspaceId: 'workspace-a',
    ug: '160416',
    dayKey: usageDayKey,
    windowStartedAt: `${usageDayKey}T00:00:00.000Z`,
    windowEndedAt: `${usageDayKey}T23:59:59.999Z`,
    estimatedDocumentReads: 25,
    estimatedDocumentWrites: 4,
    estimatedDocumentDeletes: 1,
    realtimeSnapshots: 6,
    peakRealtimeListeners: 3,
    telemetryFlushes: 1,
    lastReportedAt: serverTimestamp(),
  };

  await allowed('Setor grava telemetria estimada somente no próprio workspace/UG', () =>
    setDoc(usageRefA, usagePayload)
  );

  await allowed('Setor incrementa apenas contadores monotônicos da própria UG', () =>
    updateDoc(usageRefA, {
      estimatedDocumentReads: 30,
      estimatedDocumentWrites: 5,
      realtimeSnapshots: 7,
      peakRealtimeListeners: 4,
      telemetryFlushes: 2,
      lastReportedAt: serverTimestamp(),
    })
  );

  await denied('Setor não pode reduzir contador consolidado de telemetria', () =>
    updateDoc(usageRefA, {
      estimatedDocumentReads: 1,
      telemetryFlushes: 3,
      lastReportedAt: serverTimestamp(),
    })
  );

  await allowed('Setor migra uma única vez a janela UTC legada para o billing day', () =>
    updateDoc(usageRefA, {
      windowStartedAt: '2026-09-19T07:00:00.000Z',
      windowEndedAt: '2026-09-20T06:59:59.999Z',
      estimatedDocumentReads: 31,
      telemetryFlushes: 3,
      lastReportedAt: serverTimestamp(),
    })
  );

  await denied('Setor não pode alterar novamente a janela já migrada', () =>
    updateDoc(usageRefA, {
      windowStartedAt: '2026-09-19T08:00:00.000Z',
      windowEndedAt: '2026-09-20T07:59:59.999Z',
      estimatedDocumentReads: 32,
      telemetryFlushes: 4,
      lastReportedAt: serverTimestamp(),
    })
  );

  await denied('Setor não pode falsificar UG na própria telemetria', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'usageEstimates',
        '2026-09-20'
      ),
      {
        ...usagePayload,
        dayKey: '2026-09-20',
        ug: '999999',
        windowStartedAt: '2026-09-20T00:00:00.000Z',
        windowEndedAt: '2026-09-20T23:59:59.999Z',
        lastReportedAt: serverTimestamp(),
      }
    )
  );

  await denied('Outro workspace não grava telemetria no Setor A', () =>
    setDoc(
      doc(
        sessionB.db,
        'workspaces',
        'workspace-a',
        'usageEstimates',
        '2026-09-20'
      ),
      {
        ...usagePayload,
        dayKey: '2026-09-20',
        windowStartedAt: '2026-09-20T00:00:00.000Z',
        windowEndedAt: '2026-09-20T23:59:59.999Z',
        lastReportedAt: serverTimestamp(),
      }
    )
  );

  await denied('Setor operacional não lê o documento administrativo de telemetria', () =>
    getDoc(usageRefA)
  );

  await allowed('Administrador lê a estimativa consolidada por UG', () =>
    getDoc(
      doc(
        admin.db,
        'workspaces',
        'workspace-a',
        'usageEstimates',
        usageDayKey
      )
    )
  );

  await denied('Telemetria diária não pode ser apagada pelo setor', () =>
    deleteDoc(usageRefA)
  );

  await deleteDoc(sessionSlot2);

  console.log('\nConcorrência otimista de empenhos');

  const concurrencyEmpenhoRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'empenhos',
    '2026NE-CONC-001'
  );

  await denied('Empenho novo sem revision não pode ser criado', () =>
    setDoc(concurrencyEmpenhoRef, {
      id: '2026NE-CONC-001',
      supplier: 'Fornecedor Concorrência',
      supplierCnpj: '11111111000191',
      description: 'Teste de revisionamento',
      date: '2026-09-19',
      status: 'Ativo',
      items: [],
    })
  );

  await allowed('Empenho novo nasce em revision 1 com ator autenticado', () =>
    setDoc(concurrencyEmpenhoRef, {
      id: '2026NE-CONC-001',
      supplier: 'Fornecedor Concorrência',
      supplierCnpj: '11111111000191',
      description: 'Teste de revisionamento',
      date: '2026-09-19',
      status: 'Ativo',
      items: [],
      revision: 1,
      updatedAt: now(),
      updatedBy: sessionA.user.uid,
    })
  );

  await denied('Empenho não aceita repetir a mesma revision em atualização', () =>
    updateDoc(concurrencyEmpenhoRef, {
      pregao: 'STALE',
      revision: 1,
      updatedAt: now(),
      updatedBy: sessionA.user.uid,
    })
  );

  await denied('Empenho não aceita pular revision', () =>
    updateDoc(concurrencyEmpenhoRef, {
      pregao: 'SKIP',
      revision: 3,
      updatedAt: now(),
      updatedBy: sessionA.user.uid,
    })
  );

  await denied('Empenho não aceita updatedBy forjado', () =>
    updateDoc(concurrencyEmpenhoRef, {
      pregao: 'FORGED',
      revision: 2,
      updatedAt: now(),
      updatedBy: 'uid-forjado',
    })
  );

  await allowed('Empenho avança exatamente uma revision por atualização', () =>
    updateDoc(concurrencyEmpenhoRef, {
      pregao: '90099/2026',
      revision: 2,
      updatedAt: now(),
      updatedBy: sessionA.user.uid,
    })
  );

  const legacyConcurrencyRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'empenhos',
    '2026NE-CONC-LEGACY'
  );
  await ownerSet('workspaces/workspace-a/empenhos/2026NE-CONC-LEGACY', {
    id: '2026NE-CONC-LEGACY',
    supplier: 'Fornecedor Legado',
    supplierCnpj: '11111111000191',
    description: 'Documento sem revision anterior ao Bloco 13',
    date: '2026-09-18',
    status: 'Ativo',
    items: [],
  });

  await allowed('Empenho legado sem revision migra uma única vez de 0 para 1', () =>
    updateDoc(legacyConcurrencyRef, {
      pregao: '90098/2026',
      revision: 1,
      updatedAt: now(),
      updatedBy: sessionA.user.uid,
    })
  );

  const fixedExpectedRevision = 2;
  const concurrentWrites = await Promise.allSettled([
    runTransaction(sessionA.db, async (transaction) => {
      const snapshot = await transaction.get(concurrencyEmpenhoRef);
      assert.equal(snapshot.data()?.revision, fixedExpectedRevision);
      transaction.update(concurrencyEmpenhoRef, {
        marker: 'writer-a',
        revision: fixedExpectedRevision + 1,
        updatedAt: now(),
        updatedBy: sessionA.user.uid,
      });
    }),
    runTransaction(sessionA.db, async (transaction) => {
      const snapshot = await transaction.get(concurrencyEmpenhoRef);
      assert.equal(snapshot.data()?.revision, fixedExpectedRevision);
      transaction.update(concurrencyEmpenhoRef, {
        marker: 'writer-b',
        revision: fixedExpectedRevision + 1,
        updatedAt: now(),
        updatedBy: sessionA.user.uid,
      });
    }),
  ]);
  assert.equal(
    concurrentWrites.filter((item) => item.status === 'fulfilled').length,
    1,
    'Somente uma sessão pode confirmar a mesma revision esperada.'
  );
  assert.equal(
    concurrentWrites.filter((item) => item.status === 'rejected').length,
    1,
    'A segunda sessão precisa detectar revision obsoleta após o retry transacional.'
  );
  console.log('  [PASS] RACE  — Duas sessões com a mesma revision não geram lost update');

  console.log('\nIdentidade e bootstrap');
  await denied('Setor com mesmo e-mail e UID via Google não lê o próprio platformAccount', () =>
    getDoc(
      doc(
        sessionAGoogle.db,
        'platformAccounts',
        identities.a.email
      )
    )
  );
  await denied('Setor com mesmo e-mail e UID via Google não acessa dados operacionais', () =>
    getDoc(
      doc(
        sessionAGoogle.db,
        'workspaces',
        'workspace-a',
        'empenhos',
        'sample'
      )
    )
  );
  await denied('Fundador com mesmo e-mail e UID via senha não acessa dados operacionais HGeSM', () =>
    getDoc(
      doc(
        founderPassword.db,
        'workspaces',
        'hgesm-aprov',
        'empenhos',
        'sample'
      )
    )
  );
  await denied('Fundador com mesmo e-mail e UID via senha não obtém metadados administrativos', () =>
    getDoc(
      doc(
        founderPassword.db,
        'workspaces',
        'hgesm-aprov'
      )
    )
  );
  await denied('Mesmo e-mail com UID divergente não acessa dados operacionais', () =>
    getDoc(
      doc(
        sessionWrongUid.db,
        'workspaces',
        'workspace-wrong-uid',
        'empenhos',
        'sample'
      )
    )
  );
  await allowed('Conta ainda sem UID pode ler o próprio platformAccount para bootstrap', () =>
    getDoc(
      doc(
        sessionBootstrap.db,
        'platformAccounts',
        identities.bootstrap.email
      )
    )
  );
  await allowed('Conta ainda sem UID pode ler metadados do próprio workspace', () =>
    getDoc(doc(sessionBootstrap.db, 'workspaces', 'workspace-bootstrap'))
  );
  await denied('Conta ainda sem UID não acessa coleção operacional', () =>
    getDoc(
      doc(
        sessionBootstrap.db,
        'workspaces',
        'workspace-bootstrap',
        'empenhos',
        'sample'
      )
    )
  );

  const preboundAccountRef = doc(
    sessionPrebound.db,
    'platformAccounts',
    identities.prebound.email
  );

  await allowed('Conta pré-vinculada inicializa firstLoginAt no primeiro acesso', () =>
    updateDoc(preboundAccountRef, {
      firstLoginAt: now(),
      lastLoginAt: now(),
      updatedAt: now(),
    })
  );

  await denied('Conta pré-vinculada não pode reescrever firstLoginAt depois do primeiro acesso', () =>
    updateDoc(preboundAccountRef, {
      firstLoginAt: '2099-01-01T00:00:00.000Z',
      lastLoginAt: now(),
      updatedAt: now(),
    })
  );

  await allowed('Conta pré-vinculada atualiza somente auditoria de logins posteriores', () =>
    updateDoc(preboundAccountRef, {
      lastLoginAt: now(),
      updatedAt: now(),
    })
  );

  console.log('\nSuspensão e adulteração');
  await denied('Setor suspenso não acessa dados operacionais', () =>
    getDoc(
      doc(
        sessionSuspended.db,
        'workspaces',
        'workspace-suspended',
        'empenhos',
        'sample'
      )
    )
  );
  await denied('Vínculo adulterado entre conta e workspace é bloqueado', () =>
    getDoc(
      doc(
        sessionTampered.db,
        'workspaces',
        'workspace-tampered',
        'empenhos',
        'sample'
      )
    )
  );

  console.log('\nProvisionamento administrativo real');
  const provisioningWorkspaceId = 'workspace-provisioning-real';
  const provisioningEmail = 'sector-provisioning@example.test';

  await allowed('Admin executa preflight e provisiona workspace + conta + contador na mesma transação', () =>
    runTransaction(admin.db, async (transaction) => {
      const workspaceRef = doc(admin.db, 'workspaces', provisioningWorkspaceId);
      const accountRef = doc(admin.db, 'platformAccounts', provisioningEmail);
      const counterRef = doc(
        admin.db,
        'workspaces',
        provisioningWorkspaceId,
        'settings',
        'termoRecebimentoCounter'
      );

      const [workspaceSnapshot, accountSnapshot, counterSnapshot] = await Promise.all([
        transaction.get(workspaceRef),
        transaction.get(accountRef),
        transaction.get(counterRef),
      ]);

      assert.equal(workspaceSnapshot.exists(), false);
      assert.equal(accountSnapshot.exists(), false);
      assert.equal(counterSnapshot.exists(), false);

      transaction.set(
        workspaceRef,
        workspace(provisioningWorkspaceId, provisioningEmail, 'active')
      );
      transaction.set(
        accountRef,
        account(provisioningEmail, provisioningWorkspaceId, null, 'active')
      );
      transaction.set(counterRef, { currentNumber: 0 });
    })
  );

  await denied('Admin não lê contador operacional depois que o workspace existe', () =>
    getDoc(
      doc(
        admin.db,
        'workspaces',
        provisioningWorkspaceId,
        'settings',
        'termoRecebimentoCounter'
      )
    )
  );

  console.log('\nAdministração sem bypass operacional');
  await allowed('Fundador continua acessando o workspace operacional HGeSM', () =>
    getDoc(doc(admin.db, 'workspaces', 'hgesm-aprov', 'empenhos', 'sample'))
  );
  await allowed('Administrador lista somente o diretório de workspaces', () =>
    getDocs(collection(admin.db, 'workspaces'))
  );
  await allowed('Administrador lista somente o diretório de contas da plataforma', () =>
    getDocs(collection(admin.db, 'platformAccounts'))
  );
  await denied('Setor externo não lista o diretório global de workspaces', () =>
    getDocs(collection(sessionA.db, 'workspaces'))
  );
  await denied('Setor externo não lista o diretório global de contas da plataforma', () =>
    getDocs(collection(sessionA.db, 'platformAccounts'))
  );
  await denied('Administrador não lê dados operacionais de setor externo', () =>
    getDoc(doc(admin.db, 'workspaces', 'workspace-a', 'empenhos', 'sample'))
  );
  await denied('Administrador não lista dados operacionais de setor externo', () =>
    getDocs(collection(admin.db, 'workspaces', 'workspace-a', 'empenhos'))
  );
  await denied('Administrador não grava dados operacionais de setor externo', () =>
    setDoc(doc(admin.db, 'workspaces', 'workspace-a', 'alerts', 'admin-bypass'), {
      marker: 'forbidden',
    })
  );

  await denied('Administrador não lê configuração Drive operacional de setor externo', () =>
    getDoc(
      doc(
        admin.db,
        'workspaces',
        'workspace-a',
        'settings',
        'documentStorage'
      )
    )
  );

  await ownerSet('empenhos/legacy-hardening', {
    id: 'legacy-hardening',
    marker: 'legacy-read-only',
  });
  await allowed('Fundador Google pode consultar legado raiz somente leitura', () =>
    getDoc(doc(admin.db, 'empenhos', 'legacy-hardening'))
  );
  await denied('Fundador não pode voltar a gravar no legado raiz', () =>
    setDoc(doc(admin.db, 'empenhos', 'legacy-hardening-write'), {
      id: 'legacy-hardening-write',
    })
  );
  await denied('Fundador autenticado por senha não acessa o legado raiz', () =>
    getDoc(doc(founderPassword.db, 'empenhos', 'legacy-hardening'))
  );

  console.log('\nTrilha de auditoria imutável');

  const workspaceAuditRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'auditEvents',
    'audit-workspace-001'
  );
  const validWorkspaceAudit = {
    eventVersion: 'emprovex_audit_v1',
    eventId: 'audit-workspace-001',
    workspaceId: 'workspace-a',
    ug: '160416',
    operation: 'ns.assign',
    source: 'manual',
    entityType: 'invoice',
    entityId: 'nf_11111111000191_audit-1',
    correlationId: 'audit-correlation-001',
    actorUid: sessionA.user.uid,
    actorEmail: identities.a.email,
    before: {},
    after: { numeroNS: '2026NS000001', nsUg: '160416' },
    metadata: {},
    createdAt: serverTimestamp(),
  };

  await allowed('Setor cria evento de auditoria válido no próprio workspace', () =>
    setDoc(workspaceAuditRef, validWorkspaceAudit)
  );
  await denied('Evento de auditoria do workspace não pode ser alterado', () =>
    updateDoc(workspaceAuditRef, {
      metadata: { adulterado: true },
    })
  );
  await denied('Evento de auditoria do workspace não pode ser excluído', () =>
    deleteDoc(workspaceAuditRef)
  );
  await denied('Setor não pode forjar actorUid em evento de auditoria', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'auditEvents',
        'audit-workspace-forged'
      ),
      {
        ...validWorkspaceAudit,
        eventId: 'audit-workspace-forged',
        actorUid: 'uid-forjado',
        createdAt: serverTimestamp(),
      }
    )
  );
  await denied('Setor A não cria auditoria dentro do workspace B', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-b',
        'auditEvents',
        'audit-cross-tenant'
      ),
      {
        ...validWorkspaceAudit,
        eventId: 'audit-cross-tenant',
        workspaceId: 'workspace-b',
        ug: '160417',
        createdAt: serverTimestamp(),
      }
    )
  );

  const platformAuditRef = doc(admin.db, 'platformAuditEvents', 'audit-platform-001');
  const validPlatformAudit = {
    eventVersion: 'emprovex_audit_v1',
    eventId: 'audit-platform-001',
    workspaceId: 'workspace-lifecycle',
    ug: '160416',
    operation: 'sector.status_change',
    source: 'admin',
    entityType: 'workspace',
    entityId: 'workspace-lifecycle',
    correlationId: 'audit-platform-correlation-001',
    actorUid: admin.user.uid,
    actorEmail: founderEmail,
    before: { status: 'active' },
    after: { status: 'disabled' },
    metadata: {},
    createdAt: serverTimestamp(),
  };
  await allowed('Administrador cria evento de auditoria administrativa', () =>
    setDoc(platformAuditRef, validPlatformAudit)
  );
  await denied('Evento de auditoria administrativa não pode ser alterado', () =>
    updateDoc(platformAuditRef, {
      metadata: { adulterado: true },
    })
  );
  await denied('Evento de auditoria administrativa não pode ser excluído', () =>
    deleteDoc(platformAuditRef)
  );
  await denied('Setor externo não cria evento na auditoria administrativa', () =>
    setDoc(
      doc(sessionA.db, 'platformAuditEvents', 'audit-platform-forged'),
      {
        ...validPlatformAudit,
        eventId: 'audit-platform-forged',
        actorUid: sessionA.user.uid,
        actorEmail: identities.a.email,
        createdAt: serverTimestamp(),
      }
    )
  );
  await allowed('Administrador pode listar a auditoria administrativa', () =>
    getDocs(collection(admin.db, 'platformAuditEvents'))
  );
  await denied('Setor externo não lê evento da auditoria administrativa', () =>
    getDoc(doc(sessionA.db, 'platformAuditEvents', 'audit-platform-001'))
  );
  await denied('Setor externo não lista a auditoria administrativa', () =>
    getDocs(collection(sessionA.db, 'platformAuditEvents'))
  );

  console.log('\nExclusão protegida de empenho');

  const deletionEmpenhoId = '2026NE-DEL-001';
  const deletionCnpj = '11111111000191';
  const deletionInvoiceKey = 'nf_11111111000191_del-001';
  const deletionNs = '2026NS008901';
  const deletionLockId = `empenhoDelete_${deletionEmpenhoId}`;
  const deletionLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    deletionLockId
  );
  const deletionEmpenhoRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'empenhos',
    deletionEmpenhoId
  );
  const deletionInvoiceRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'invoices',
    deletionInvoiceKey
  );
  const deletionAlertRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'alerts',
    'alert-del-001'
  );
  const deletionCronogramaRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'cronogramas',
    'cronograma-del-001'
  );

  await ownerSet(`workspaces/workspace-a/empenhos/${deletionEmpenhoId}`, {
    id: deletionEmpenhoId,
    supplier: 'Fornecedor Exclusão',
    supplierCnpj: deletionCnpj,
    description: 'Lifecycle protegido de exclusão',
    date: '2026-01-01',
    status: 'Ativo',
    items: [],
  });
  await ownerSet(`workspaces/workspace-a/invoices/${deletionInvoiceKey}`, {
    id: 'DEL-001',
    recordKey: deletionInvoiceKey,
    empenhoId: deletionEmpenhoId,
    supplier: 'Fornecedor Exclusão',
    supplierCnpj: deletionCnpj,
    issueDate: '2026-01-10',
    items: [],
    totalValue: 100,
  });
  await ownerSet('workspaces/workspace-a/alerts/alert-del-001', {
    id: 'alert-del-001',
    empenhoId: deletionEmpenhoId,
    type: 'ATENÇÃO',
    title: 'Alerta vinculado',
    subtitle: 'Teste',
    description: 'Teste',
    date: 'Agora',
  });
  await ownerSet('workspaces/workspace-a/cronogramas/cronograma-del-001', {
    id: 'cronograma-del-001',
    empenhoId: deletionEmpenhoId,
    dataCriacao: '2026-01-01',
    colunas: [],
    distribuicao: {},
  });

  await reserveSagNs(
    sessionA.db,
    sessionA.user.uid,
    'workspace-a',
    deletionInvoiceKey,
    'DEL-001',
    deletionEmpenhoId,
    deletionCnpj,
    deletionNs
  );
  const deletionNsLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(deletionNs)
  );

  await allowed('Setor cria lock técnico antes de excluir empenho', () =>
    setDoc(deletionLockRef, {
      id: deletionLockId,
      type: 'empenho-deletion-lock',
      workspaceId: 'workspace-a',
      empenhoId: deletionEmpenhoId,
      correlationId: 'delete-correlation-001',
      createdAt: now(),
      createdBy: sessionA.user.uid,
    })
  );

  await denied('Empenho bloqueado para alteração enquanto exclusão está em andamento', () =>
    updateDoc(deletionEmpenhoRef, {
      pregao: 'NAO-DEVE-GRAVAR',
      revision: 1,
      updatedAt: now(),
      updatedBy: sessionA.user.uid,
    })
  );

  await denied('Nova NF não entra no empenho depois do lock de exclusão', () =>
    setDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', 'nf_11111111000191_del-late'),
      {
        id: 'DEL-LATE',
        recordKey: 'nf_11111111000191_del-late',
        empenhoId: deletionEmpenhoId,
        supplier: 'Fornecedor Exclusão',
        supplierCnpj: deletionCnpj,
        issueDate: '2026-01-11',
        items: [],
        totalValue: 10,
      }
    )
  );

  await denied('Novo alerta estruturado não entra no empenho durante exclusão', () =>
    setDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'alerts', 'alert-del-late'),
      {
        id: 'alert-del-late',
        empenhoId: deletionEmpenhoId,
        type: 'ATENÇÃO',
        title: 'Tardio',
        subtitle: 'Teste',
        description: 'Teste',
        date: 'Agora',
      }
    )
  );

  await denied('Novo cronograma não entra no empenho durante exclusão', () =>
    setDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'cronogramas', 'cronograma-del-late'),
      {
        id: 'cronograma-del-late',
        empenhoId: deletionEmpenhoId,
        dataCriacao: '2026-01-02',
        colunas: [],
        distribuicao: {},
      }
    )
  );

  await denied('Empenho não pode ser apagado isoladamente mantendo o lock técnico', () =>
    deleteDoc(deletionEmpenhoRef)
  );

  const deletionAuditRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'auditEvents',
    'audit-empenho-delete-001'
  );

  await allowed('Empenho + NF + locks + vínculos são excluídos na mesma transação', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const [
        empenhoSnapshot,
        invoiceSnapshot,
        nsLockSnapshot,
        deletionLockSnapshot,
        alertSnapshot,
        cronogramaSnapshot,
      ] = await Promise.all([
        transaction.get(deletionEmpenhoRef),
        transaction.get(deletionInvoiceRef),
        transaction.get(deletionNsLockRef),
        transaction.get(deletionLockRef),
        transaction.get(deletionAlertRef),
        transaction.get(deletionCronogramaRef),
      ]);

      assert.equal(empenhoSnapshot.exists(), true);
      assert.equal(invoiceSnapshot.exists(), true);
      assert.equal(nsLockSnapshot.exists(), true);
      assert.equal(deletionLockSnapshot.exists(), true);
      assert.equal(alertSnapshot.exists(), true);
      assert.equal(cronogramaSnapshot.exists(), true);

      transaction.delete(deletionInvoiceRef);
      transaction.delete(deletionNsLockRef);
      transaction.delete(deletionAlertRef);
      transaction.delete(deletionCronogramaRef);
      transaction.delete(deletionEmpenhoRef);
      transaction.delete(deletionLockRef);
      transaction.set(deletionAuditRef, {
        eventVersion: 'emprovex_audit_v1',
        eventId: 'audit-empenho-delete-001',
        workspaceId: 'workspace-a',
        ug: '160416',
        operation: 'empenho.delete',
        source: 'system',
        entityType: 'empenho',
        entityId: deletionEmpenhoId,
        correlationId: 'delete-correlation-001',
        actorUid: sessionA.user.uid,
        actorEmail: identities.a.email,
        before: { empenhoId: deletionEmpenhoId },
        after: { deleted: true },
        metadata: { deletedInvoiceCount: 1, deletedNsLockCount: 1 },
        createdAt: serverTimestamp(),
      });
    })
  );

  const deletionAfter = await Promise.all([
    getDoc(deletionEmpenhoRef),
    getDoc(deletionInvoiceRef),
    getDoc(deletionNsLockRef),
    getDoc(deletionLockRef),
    getDoc(deletionAlertRef),
    getDoc(deletionCronogramaRef),
    getDoc(deletionAuditRef),
  ]);
  for (const snapshot of deletionAfter.slice(0, 6)) {
    assert.equal(snapshot.exists(), false);
  }
  assert.equal(deletionAfter[6].data()?.operation, 'empenho.delete');

  console.log('\nHardening transacional da importação SAG');
  const sagSupplierCnpj = '11111111000191';
  const sagEmpenhoId = '2026NE-SAG-001';
  const sagInvoiceAKey = 'nf_11111111000191_sag-a';
  const sagInvoiceBKey = 'nf_11111111000191_sag-b';
  const sagInvoiceRollbackKey = 'nf_11111111000191_sag-rollback';
  const sagInvoiceUgAKey = 'nf_11111111000191_sag-ug-a';
  const sagInvoiceUgBKey = 'nf_11111111000191_sag-ug-b';

  await ownerSet(`workspaces/workspace-a/empenhos/${sagEmpenhoId}`, {
    id: sagEmpenhoId,
    supplier: 'Fornecedor SAG',
    supplierCnpj: sagSupplierCnpj,
    description: 'Teste concorrencial SAG',
    date: '2026-01-01',
    status: 'Ativo',
    items: [],
  });

  for (const [recordKey, invoiceId] of [
    [sagInvoiceAKey, 'SAG-A'],
    [sagInvoiceBKey, 'SAG-B'],
    [sagInvoiceRollbackKey, 'SAG-ROLLBACK'],
    [sagInvoiceUgAKey, 'SAG-UG-A'],
    [sagInvoiceUgBKey, 'SAG-UG-B'],
  ]) {
    await ownerSet(`workspaces/workspace-a/invoices/${recordKey}`, {
      id: invoiceId,
      recordKey,
      empenhoId: sagEmpenhoId,
      supplier: 'Fornecedor SAG',
      supplierCnpj: sagSupplierCnpj,
      issueDate: '2026-01-10',
      items: [],
      totalValue: 100,
    });
  }

  const contestedNs = '2026NS009001';
  const concurrentReservations = await Promise.allSettled([
    reserveSagNs(
      sessionA.db,
      sessionA.user.uid,
      'workspace-a',
      sagInvoiceAKey,
      'SAG-A',
      sagEmpenhoId,
      sagSupplierCnpj,
      contestedNs
    ),
    reserveSagNs(
      sessionA.db,
      sessionA.user.uid,
      'workspace-a',
      sagInvoiceBKey,
      'SAG-B',
      sagEmpenhoId,
      sagSupplierCnpj,
      contestedNs
    ),
  ]);

  assert.equal(
    concurrentReservations.filter((item) => item.status === 'fulfilled').length,
    1,
    'Exatamente uma transação deve reservar a NS concorrida.'
  );
  assert.equal(
    concurrentReservations.filter((item) => item.status === 'rejected').length,
    1,
    'A segunda transação deve ser rejeitada pelo lock transacional.'
  );

  const contestedLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(contestedNs)
  );
  const contestedLock = await getDoc(contestedLockRef);
  assert.equal(contestedLock.exists(), true);
  const lockOwner = contestedLock.data().invoiceRecordKey;
  assert.ok(
    [sagInvoiceAKey, sagInvoiceBKey].includes(lockOwner),
    'O lock deve apontar para uma das NFs concorrentes.'
  );

  const [sagInvoiceA, sagInvoiceB] = await Promise.all([
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', sagInvoiceAKey)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', sagInvoiceBKey)),
  ]);
  assert.equal(
    [sagInvoiceA, sagInvoiceB].filter((snapshot) => snapshot.data()?.numeroNS === contestedNs).length,
    1,
    'A mesma NS não pode aparecer em duas NFs após corrida concorrente.'
  );

  const wrongWorkspaceUgNs = '2026NS009050';
  await denied('Setor não pode reservar NS com UG diferente da UG vinculada ao workspace', () =>
    reserveSagNs(
      sessionA.db,
      sessionA.user.uid,
      'workspace-a',
      sagInvoiceUgAKey,
      'SAG-UG-A',
      sagEmpenhoId,
      sagSupplierCnpj,
      wrongWorkspaceUgNs,
      '160415'
    )
  );

  await allowed('Setor reserva NS usando automaticamente a UG vinculada ao workspace', () =>
    reserveSagNs(
      sessionA.db,
      sessionA.user.uid,
      'workspace-a',
      sagInvoiceUgBKey,
      'SAG-UG-B',
      sagEmpenhoId,
      sagSupplierCnpj,
      wrongWorkspaceUgNs,
      '160416'
    )
  );

  const [wrongUgInvoice, canonicalUgInvoice, wrongUgLock, canonicalUgLock] = await Promise.all([
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', sagInvoiceUgAKey)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', sagInvoiceUgBKey)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'settings', sagLockId(wrongWorkspaceUgNs, '160415'))),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'settings', sagLockId(wrongWorkspaceUgNs, '160416'))),
  ]);
  assert.equal(wrongUgInvoice.data()?.numeroNS, undefined);
  assert.equal(canonicalUgInvoice.data()?.nsUg, '160416');
  assert.equal(wrongUgLock.exists(), false);
  assert.equal(canonicalUgLock.data()?.ug, '160416');

  const winnerId = lockOwner === sagInvoiceAKey ? 'SAG-A' : 'SAG-B';
  await allowed('Reimportação SAG pelo mesmo proprietário do lock é idempotente', () =>
    reserveSagNs(
      sessionA.db,
      sessionA.user.uid,
      'workspace-a',
      lockOwner,
      winnerId,
      sagEmpenhoId,
      sagSupplierCnpj,
      contestedNs
    )
  );

  await denied('Setor B não lê lock SAG do Setor A', () =>
    getDoc(
      doc(
        sessionB.db,
        'workspaces',
        'workspace-a',
        'settings',
        sagLockId(contestedNs)
      )
    )
  );

  await denied('Setor B não grava lock SAG no Setor A', () =>
    setDoc(
      doc(
        sessionB.db,
        'workspaces',
        'workspace-a',
        'settings',
        sagLockId('2026NS009002')
      ),
      {
        id: sagLockId('2026NS009002'),
        type: 'sag-ns-lock',
        workspaceId: 'workspace-a',
        ug: DEFAULT_NS_UG,
        numeroNS: '2026NS009002',
        invoiceRecordKey: sagInvoiceAKey,
        invoiceId: 'SAG-A',
        empenhoId: sagEmpenhoId,
        supplierCnpj: sagSupplierCnpj,
        createdAt: now(),
        updatedAt: now(),
        updatedBy: sessionB.user.uid,
      }
    )
  );

  await denied('Lock SAG não permite troca posterior do proprietário', () =>
    updateDoc(contestedLockRef, {
      invoiceRecordKey: sagInvoiceRollbackKey,
      updatedAt: now(),
      updatedBy: sessionA.user.uid,
    })
  );

  const rollbackNs = '2026NS009099';
  await denied('Lock SAG inválido cancela atomicamente a escrita da NF', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const invoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        sagInvoiceRollbackKey
      );
      const invalidLockRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'settings',
        sagLockId(rollbackNs)
      );

      await transaction.get(invoiceRef);
      transaction.set(invoiceRef, { numeroNS: rollbackNs, nsUg: DEFAULT_NS_UG }, { merge: true });
      transaction.set(invalidLockRef, {
        id: sagLockId(rollbackNs),
        type: 'sag-ns-lock',
        workspaceId: 'workspace-a',
        ug: DEFAULT_NS_UG,
        numeroNS: rollbackNs,
        updatedBy: sessionA.user.uid,
      });
    })
  );

  const rollbackInvoice = await getDoc(
    doc(
      sessionA.db,
      'workspaces',
      'workspace-a',
      'invoices',
      sagInvoiceRollbackKey
    )
  );
  assert.equal(
    rollbackInvoice.data()?.numeroNS,
    undefined,
    'A NF não pode ser alterada se a criação do lock falhar.'
  );

  console.log('\nHardening global NF ↔ NS ↔ lock');
  const rulesInvoiceKey = 'nf_11111111000191_rules-hardening';
  const rulesInvoiceId = 'RULES-HARDENING';
  const rulesNs = '2026NS009400';
  const rulesNsOther = '2026NS009401';

  await ownerSet(`workspaces/workspace-a/invoices/${rulesInvoiceKey}`, {
    id: rulesInvoiceId,
    recordKey: rulesInvoiceKey,
    empenhoId: sagEmpenhoId,
    supplier: 'Fornecedor SAG',
    supplierCnpj: sagSupplierCnpj,
    issueDate: '2026-01-14',
    items: [],
    totalValue: 140,
  });

  await denied('NF não recebe numeroNS diretamente sem lock correspondente', () =>
    updateDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', rulesInvoiceKey),
      { numeroNS: rulesNs }
    )
  );

  await denied('NF não pode ser criada já liquidada sem lock correspondente', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        'nf_11111111000191_rules-create'
      ),
      {
        id: 'RULES-CREATE',
        recordKey: 'nf_11111111000191_rules-create',
        empenhoId: sagEmpenhoId,
        supplier: 'Fornecedor SAG',
        supplierCnpj: sagSupplierCnpj,
        issueDate: '2026-01-14',
        items: [],
        totalValue: 141,
        numeroNS: '2026NS009402',
      }
    )
  );

  await denied('numeroNS fora do formato canônico é rejeitado pelas Rules', () =>
    updateDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', rulesInvoiceKey),
      { numeroNS: 'NS-9400' }
    )
  );

  await denied('Lock não pode nascer órfão sem NF correspondente', () =>
    setDoc(
      doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'settings',
        sagLockId('2026NS009403')
      ),
      {
        id: sagLockId('2026NS009403'),
        type: 'sag-ns-lock',
        workspaceId: 'workspace-a',
        ug: DEFAULT_NS_UG,
        numeroNS: '2026NS009403',
        invoiceRecordKey: 'nf_11111111000191_inexistente',
        invoiceId: 'INEXISTENTE',
        empenhoId: sagEmpenhoId,
        supplierCnpj: sagSupplierCnpj,
        createdAt: now(),
        updatedAt: now(),
        updatedBy: sessionA.user.uid,
      }
    )
  );

  await allowed('Transação coerente NF + lock continua autorizada', () =>
    reserveSagNs(
      sessionA.db,
      sessionA.user.uid,
      'workspace-a',
      rulesInvoiceKey,
      rulesInvoiceId,
      sagEmpenhoId,
      sagSupplierCnpj,
      rulesNs
    )
  );

  await allowed('Atualização comum da NF preserva NS quando o lock continua coerente', () =>
    updateDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', rulesInvoiceKey),
      { localizacaoAtual: 'COMISSAO' }
    )
  );

  await denied('Troca direta de NS sem novo lock é rejeitada', () =>
    updateDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', rulesInvoiceKey),
      { numeroNS: rulesNsOther }
    )
  );

  await denied('Remoção direta de NS sem liberar o lock é rejeitada', () =>
    updateDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', rulesInvoiceKey),
      { numeroNS: deleteField(), nsUg: deleteField() }
    )
  );

  await denied('Exclusão direta de NF com lock ativo é rejeitada', () =>
    deleteDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', rulesInvoiceKey)
    )
  );

  const rulesLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(rulesNs)
  );
  await allowed('Limpeza coerente remove NF e lock juntos após os testes de bypass', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const invoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        rulesInvoiceKey
      );
      const [invoiceSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(invoiceRef),
        transaction.get(rulesLockRef),
      ]);
      assert.equal(invoiceSnapshot.exists(), true);
      assert.equal(lockSnapshot.exists(), true);
      transaction.delete(invoiceRef);
      transaction.delete(rulesLockRef);
    })
  );

  const legacyRulesKey = 'nf_11111111000191_rules-legacy';
  const legacyRulesNs = '2026NS009404';
  await ownerSet(`workspaces/workspace-a/invoices/${legacyRulesKey}`, {
    id: 'RULES-LEGACY',
    empenhoId: sagEmpenhoId,
    supplier: 'Fornecedor SAG',
    supplierCnpj: sagSupplierCnpj,
    issueDate: '2026-01-14',
    items: [],
    totalValue: 142,
    numeroNS: legacyRulesNs,
  });

  const legacyRulesLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    legacySagLockId(legacyRulesNs)
  );
  const legacyRulesCreatedAt = now();
  await ownerSet(
    `workspaces/workspace-a/settings/${legacySagLockId(legacyRulesNs)}`,
    {
      id: legacySagLockId(legacyRulesNs),
      type: 'sag-ns-lock',
      workspaceId: 'workspace-a',
      numeroNS: legacyRulesNs,
      invoiceRecordKey: legacyRulesKey,
      invoiceId: 'RULES-LEGACY',
      empenhoId: sagEmpenhoId,
      supplierCnpj: sagSupplierCnpj,
      createdAt: legacyRulesCreatedAt,
      updatedAt: legacyRulesCreatedAt,
      updatedBy: 'legacy-seed',
    }
  );

  await allowed('Registro legado com NS pode reparar recordKey preservando lock legado existente', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const invoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        legacyRulesKey
      );
      const [invoiceSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(invoiceRef),
        transaction.get(legacyRulesLockRef),
      ]);
      assert.equal(invoiceSnapshot.exists(), true);
      assert.equal(lockSnapshot.exists(), true);

      transaction.set(
        invoiceRef,
        { recordKey: legacyRulesKey },
        { merge: true }
      );
      transaction.set(
        legacyRulesLockRef,
        {
          ...lockSnapshot.data(),
          updatedAt: now(),
          updatedBy: sessionA.user.uid,
        },
        { merge: false }
      );
    })
  );

  const [legacyRulesInvoiceAfter, legacyRulesLockAfter] = await Promise.all([
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', legacyRulesKey)),
    getDoc(legacyRulesLockRef),
  ]);
  assert.equal(legacyRulesInvoiceAfter.data()?.recordKey, legacyRulesKey);
  assert.equal(legacyRulesLockAfter.data()?.invoiceRecordKey, legacyRulesKey);

  await allowed('Limpeza do registro legado reparado preserva a invariância', () =>
    runTransaction(sessionA.db, async (transaction) => {
      transaction.delete(
        doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', legacyRulesKey)
      );
      transaction.delete(legacyRulesLockRef);
    })
  );

  console.log('\nCiclo de vida de NF + lock NS');
  const lifecycleOldKey = 'nf_11111111000191_lifecycle-old';
  const lifecycleNewKey = 'nf_11111111000191_lifecycle-new';
  const lifecycleNs = '2026NS009200';

  await ownerSet(`workspaces/workspace-a/invoices/${lifecycleOldKey}`, {
    id: 'LIFECYCLE-OLD',
    recordKey: lifecycleOldKey,
    empenhoId: sagEmpenhoId,
    supplier: 'Fornecedor SAG',
    supplierCnpj: sagSupplierCnpj,
    issueDate: '2026-01-15',
    items: [],
    totalValue: 150,
  });
  await allowed('NF de ciclo de vida recebe NS e lock antes da migração', () =>
    reserveSagNs(
      sessionA.db,
      sessionA.user.uid,
      'workspace-a',
      lifecycleOldKey,
      'LIFECYCLE-OLD',
      sagEmpenhoId,
      sagSupplierCnpj,
      lifecycleNs
    )
  );

  const lifecycleLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(lifecycleNs)
  );

  await denied('Lock NS ativo não pode ser excluído isoladamente enquanto a NF ainda o utiliza', () =>
    deleteDoc(lifecycleLockRef)
  );

  await allowed('Migração de recordKey move NF e proprietário do lock na mesma transação', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const oldRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        lifecycleOldKey
      );
      const newRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        lifecycleNewKey
      );
      const [oldSnapshot, newSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(oldRef),
        transaction.get(newRef),
        transaction.get(lifecycleLockRef),
      ]);

      assert.equal(oldSnapshot.exists(), true);
      assert.equal(newSnapshot.exists(), false);
      assert.equal(lockSnapshot.exists(), true);

      transaction.set(newRef, {
        ...oldSnapshot.data(),
        id: 'LIFECYCLE-NEW',
        recordKey: lifecycleNewKey,
        numeroNS: lifecycleNs,
      });
      transaction.delete(oldRef);
      transaction.set(
        lifecycleLockRef,
        {
          ...lockSnapshot.data(),
          invoiceRecordKey: lifecycleNewKey,
          invoiceId: 'LIFECYCLE-NEW',
          updatedAt: now(),
          updatedBy: sessionA.user.uid,
        },
        { merge: true }
      );
    })
  );

  const [oldAfterMigration, newAfterMigration, lockAfterMigration] = await Promise.all([
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', lifecycleOldKey)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', lifecycleNewKey)),
    getDoc(lifecycleLockRef),
  ]);
  assert.equal(oldAfterMigration.exists(), false);
  assert.equal(newAfterMigration.data()?.numeroNS, lifecycleNs);
  assert.equal(lockAfterMigration.data()?.invoiceRecordKey, lifecycleNewKey);
  assert.equal(lockAfterMigration.data()?.invoiceId, 'LIFECYCLE-NEW');

  await allowed('Exclusão de NF remove o lock correspondente na mesma transação', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const invoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        lifecycleNewKey
      );
      const [invoiceSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(invoiceRef),
        transaction.get(lifecycleLockRef),
      ]);
      assert.equal(invoiceSnapshot.exists(), true);
      assert.equal(lockSnapshot.exists(), true);
      transaction.delete(invoiceRef);
      transaction.delete(lifecycleLockRef);
    })
  );

  const [deletedLifecycleInvoice, deletedLifecycleLock] = await Promise.all([
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', lifecycleNewKey)),
    getDoc(lifecycleLockRef),
  ]);
  assert.equal(deletedLifecycleInvoice.exists(), false);
  assert.equal(deletedLifecycleLock.exists(), false);

  const manualRemovalKey = 'nf_11111111000191_manual-removal';
  const manualRemovalNs = '2026NS009201';
  await ownerSet(`workspaces/workspace-a/invoices/${manualRemovalKey}`, {
    id: 'MANUAL-REMOVAL',
    recordKey: manualRemovalKey,
    empenhoId: sagEmpenhoId,
    supplier: 'Fornecedor SAG',
    supplierCnpj: sagSupplierCnpj,
    issueDate: '2026-01-16',
    items: [],
    totalValue: 175,
  });
  await reserveSagNs(
    sessionA.db,
    sessionA.user.uid,
    'workspace-a',
    manualRemovalKey,
    'MANUAL-REMOVAL',
    sagEmpenhoId,
    sagSupplierCnpj,
    manualRemovalNs
  );
  const manualRemovalLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(manualRemovalNs)
  );

  await allowed('Remoção manual da NS pode liberar lock quando a NF deixa de usar a NS', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const invoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        manualRemovalKey
      );
      const [invoiceSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(invoiceRef),
        transaction.get(manualRemovalLockRef),
      ]);
      assert.equal(invoiceSnapshot.exists(), true);
      assert.equal(lockSnapshot.exists(), true);
      transaction.set(
        invoiceRef,
        { numeroNS: deleteField(), nsUg: deleteField() },
        { merge: true }
      );
      transaction.delete(manualRemovalLockRef);
    })
  );

  const [manualAfterRemoval, manualLockAfterRemoval] = await Promise.all([
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', manualRemovalKey)),
    getDoc(manualRemovalLockRef),
  ]);
  assert.equal(manualAfterRemoval.data()?.numeroNS, undefined);
  assert.equal(manualLockAfterRemoval.exists(), false);

  const metadataRefreshKey = 'nf_11111111000191_metadata-refresh';
  const metadataRefreshNs = '2026NS009202';
  await ownerSet(`workspaces/workspace-a/invoices/${metadataRefreshKey}`, {
    id: 'META-OLD',
    recordKey: metadataRefreshKey,
    empenhoId: sagEmpenhoId,
    supplier: 'Fornecedor SAG',
    supplierCnpj: sagSupplierCnpj,
    issueDate: '2026-01-17',
    items: [],
    totalValue: 190,
  });
  await reserveSagNs(
    sessionA.db,
    sessionA.user.uid,
    'workspace-a',
    metadataRefreshKey,
    'META-OLD',
    sagEmpenhoId,
    sagSupplierCnpj,
    metadataRefreshNs
  );
  const metadataRefreshLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(metadataRefreshNs)
  );

  await allowed('Mesmo recordKey pode atualizar metadados do lock somente junto da NF coerente', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const invoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        metadataRefreshKey
      );
      const [invoiceSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(invoiceRef),
        transaction.get(metadataRefreshLockRef),
      ]);
      assert.equal(invoiceSnapshot.exists(), true);
      assert.equal(lockSnapshot.exists(), true);

      transaction.set(
        invoiceRef,
        { ...invoiceSnapshot.data(), id: 'META-NEW' },
        { merge: false }
      );
      transaction.set(
        metadataRefreshLockRef,
        {
          ...lockSnapshot.data(),
          invoiceId: 'META-NEW',
          updatedAt: now(),
          updatedBy: sessionA.user.uid,
        },
        { merge: true }
      );
    })
  );

  const metadataRefreshLock = await getDoc(metadataRefreshLockRef);
  assert.equal(metadataRefreshLock.data()?.invoiceRecordKey, metadataRefreshKey);
  assert.equal(metadataRefreshLock.data()?.invoiceId, 'META-NEW');

  console.log('\nMigração de CNPJ do empenho + NFs + locks');
  const cnpjOld = '11111111000191';
  const cnpjNext = '22222222000191';
  const cnpjEmpenhoId = '2026NE-CNPJ-001';
  const cnpjInvoiceAOld = `nf_${cnpjOld}_c-a`;
  const cnpjInvoiceBOld = `nf_${cnpjOld}_c-b`;
  const cnpjInvoiceANext = `nf_${cnpjNext}_c-a`;
  const cnpjInvoiceBNext = `nf_${cnpjNext}_c-b`;
  const cnpjNs = '2026NS009300';

  await ownerSet(`workspaces/workspace-a/empenhos/${cnpjEmpenhoId}`, {
    id: cnpjEmpenhoId,
    supplier: 'Fornecedor CNPJ',
    supplierCnpj: cnpjOld,
    description: 'Migração CNPJ',
    date: '2026-01-01',
    status: 'Ativo',
    items: [],
  });
  for (const [recordKey, invoiceId] of [
    [cnpjInvoiceAOld, 'C-A'],
    [cnpjInvoiceBOld, 'C-B'],
  ]) {
    await ownerSet(`workspaces/workspace-a/invoices/${recordKey}`, {
      id: invoiceId,
      recordKey,
      empenhoId: cnpjEmpenhoId,
      supplier: 'Fornecedor CNPJ',
      supplierCnpj: cnpjOld,
      issueDate: '2026-01-18',
      items: [],
      totalValue: 200,
    });
  }
  await reserveSagNs(
    sessionA.db,
    sessionA.user.uid,
    'workspace-a',
    cnpjInvoiceAOld,
    'C-A',
    cnpjEmpenhoId,
    cnpjOld,
    cnpjNs
  );

  const cnpjLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(cnpjNs)
  );

  await allowed('CNPJ migra empenho, NFs e lock de NS na mesma transação', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const empenhoRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'empenhos',
        cnpjEmpenhoId
      );
      const oldARef = doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', cnpjInvoiceAOld);
      const oldBRef = doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', cnpjInvoiceBOld);
      const newARef = doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', cnpjInvoiceANext);
      const newBRef = doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', cnpjInvoiceBNext);

      const [empenhoSnapshot, oldA, oldB, newA, newB, lockSnapshot] = await Promise.all([
        transaction.get(empenhoRef),
        transaction.get(oldARef),
        transaction.get(oldBRef),
        transaction.get(newARef),
        transaction.get(newBRef),
        transaction.get(cnpjLockRef),
      ]);

      assert.equal(empenhoSnapshot.exists(), true);
      assert.equal(oldA.exists(), true);
      assert.equal(oldB.exists(), true);
      assert.equal(newA.exists(), false);
      assert.equal(newB.exists(), false);
      assert.equal(lockSnapshot.exists(), true);

      transaction.set(
        empenhoRef,
        {
          supplierCnpj: cnpjNext,
          revision: 1,
          updatedAt: now(),
          updatedBy: sessionA.user.uid,
        },
        { merge: true }
      );
      transaction.set(newARef, {
        ...oldA.data(),
        recordKey: cnpjInvoiceANext,
        supplierCnpj: cnpjNext,
      });
      transaction.set(newBRef, {
        ...oldB.data(),
        recordKey: cnpjInvoiceBNext,
        supplierCnpj: cnpjNext,
      });
      transaction.delete(oldARef);
      transaction.delete(oldBRef);
      transaction.set(
        cnpjLockRef,
        {
          ...lockSnapshot.data(),
          invoiceRecordKey: cnpjInvoiceANext,
          supplierCnpj: cnpjNext,
          updatedAt: now(),
          updatedBy: sessionA.user.uid,
        },
        { merge: true }
      );
    })
  );

  const [cnpjEmpenhoAfter, cnpjOldAAfter, cnpjOldBAfter, cnpjNewAAfter, cnpjNewBAfter, cnpjLockAfter] = await Promise.all([
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'empenhos', cnpjEmpenhoId)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', cnpjInvoiceAOld)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', cnpjInvoiceBOld)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', cnpjInvoiceANext)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', cnpjInvoiceBNext)),
    getDoc(cnpjLockRef),
  ]);
  assert.equal(cnpjEmpenhoAfter.data()?.supplierCnpj, cnpjNext);
  assert.equal(cnpjOldAAfter.exists(), false);
  assert.equal(cnpjOldBAfter.exists(), false);
  assert.equal(cnpjNewAAfter.data()?.supplierCnpj, cnpjNext);
  assert.equal(cnpjNewBAfter.data()?.supplierCnpj, cnpjNext);
  assert.equal(cnpjLockAfter.data()?.invoiceRecordKey, cnpjInvoiceANext);
  assert.equal(cnpjLockAfter.data()?.supplierCnpj, cnpjNext);

  const legacyUgEmpenhoId = '2026NE-CNPJ-LEGACY-UG';
  const legacyUgOldKey = '02574';
  const legacyUgNewKey = `nf_${cnpjNext}_02574`;
  const legacyUgRawNs = '922';
  const legacyUgCanonicalNs = '2026NS000922';
  const legacyUgLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(legacyUgCanonicalNs)
  );

  await ownerSet(`workspaces/workspace-a/empenhos/${legacyUgEmpenhoId}`, {
    id: legacyUgEmpenhoId,
    supplier: 'Fornecedor legado sem CNPJ',
    description: 'Migração CNPJ com NS legada',
    date: '2026-01-01',
    status: 'Ativo',
    items: [],
  });
  await ownerSet(`workspaces/workspace-a/invoices/${legacyUgOldKey}`, {
    id: '02574',
    recordKey: legacyUgOldKey,
    empenhoId: legacyUgEmpenhoId,
    supplier: 'Fornecedor legado sem CNPJ',
    issueDate: '2026-01-20',
    items: [],
    totalValue: 250,
    numeroNS: legacyUgRawNs,
  });

  await allowed('CNPJ saneia NS legada usando a UG da unidade na mesma transação', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const empenhoRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'empenhos',
        legacyUgEmpenhoId
      );
      const oldInvoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        legacyUgOldKey
      );
      const newInvoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        legacyUgNewKey
      );

      const [empenhoSnapshot, oldInvoiceSnapshot, newInvoiceSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(empenhoRef),
        transaction.get(oldInvoiceRef),
        transaction.get(newInvoiceRef),
        transaction.get(legacyUgLockRef),
      ]);

      assert.equal(empenhoSnapshot.exists(), true);
      assert.equal(oldInvoiceSnapshot.exists(), true);
      assert.equal(newInvoiceSnapshot.exists(), false);
      assert.equal(lockSnapshot.exists(), false);

      const timestamp = now();
      transaction.set(
        empenhoRef,
        {
          supplierCnpj: cnpjNext,
          revision: 1,
          updatedAt: timestamp,
          updatedBy: sessionA.user.uid,
        },
        { merge: true }
      );
      transaction.set(newInvoiceRef, {
        ...oldInvoiceSnapshot.data(),
        recordKey: legacyUgNewKey,
        supplierCnpj: cnpjNext,
        numeroNS: legacyUgCanonicalNs,
        nsUg: DEFAULT_NS_UG,
      });
      transaction.delete(oldInvoiceRef);
      transaction.set(legacyUgLockRef, {
        id: sagLockId(legacyUgCanonicalNs),
        type: 'sag-ns-lock',
        workspaceId: 'workspace-a',
        ug: DEFAULT_NS_UG,
        numeroNS: legacyUgCanonicalNs,
        invoiceRecordKey: legacyUgNewKey,
        invoiceId: '02574',
        empenhoId: legacyUgEmpenhoId,
        supplierCnpj: cnpjNext,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: sessionA.user.uid,
      });
    })
  );

  const [legacyUgEmpenhoAfter, legacyUgOldAfter, legacyUgNewAfter, legacyUgLockAfter] = await Promise.all([
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'empenhos', legacyUgEmpenhoId)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', legacyUgOldKey)),
    getDoc(doc(sessionA.db, 'workspaces', 'workspace-a', 'invoices', legacyUgNewKey)),
    getDoc(legacyUgLockRef),
  ]);
  assert.equal(legacyUgEmpenhoAfter.data()?.supplierCnpj, cnpjNext);
  assert.equal(legacyUgOldAfter.exists(), false);
  assert.equal(legacyUgNewAfter.data()?.numeroNS, legacyUgCanonicalNs);
  assert.equal(legacyUgNewAfter.data()?.nsUg, DEFAULT_NS_UG);
  assert.equal(legacyUgLockAfter.data()?.ug, DEFAULT_NS_UG);
  assert.equal(legacyUgLockAfter.data()?.invoiceRecordKey, legacyUgNewKey);

  const cnpjDeniedEmpenhoId = '2026NE-CNPJ-DENY';
  const cnpjDeniedKey = `nf_${cnpjOld}_deny`;
  const cnpjDeniedNs = '2026NS009301';
  await ownerSet(`workspaces/workspace-a/empenhos/${cnpjDeniedEmpenhoId}`, {
    id: cnpjDeniedEmpenhoId,
    supplier: 'Fornecedor CNPJ Deny',
    supplierCnpj: cnpjOld,
    description: 'Teste CNPJ deny',
    date: '2026-01-01',
    status: 'Ativo',
    items: [],
  });
  await ownerSet(`workspaces/workspace-a/invoices/${cnpjDeniedKey}`, {
    id: 'DENY',
    recordKey: cnpjDeniedKey,
    empenhoId: cnpjDeniedEmpenhoId,
    supplier: 'Fornecedor CNPJ Deny',
    supplierCnpj: cnpjOld,
    issueDate: '2026-01-19',
    items: [],
    totalValue: 210,
  });
  await reserveSagNs(
    sessionA.db,
    sessionA.user.uid,
    'workspace-a',
    cnpjDeniedKey,
    'DENY',
    cnpjDeniedEmpenhoId,
    cnpjOld,
    cnpjDeniedNs
  );
  const cnpjDeniedLockRef = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    sagLockId(cnpjDeniedNs)
  );

  await denied('Lock não aceita novo CNPJ se o empenho final não confirmar o mesmo CNPJ', () =>
    runTransaction(sessionA.db, async (transaction) => {
      const invoiceRef = doc(
        sessionA.db,
        'workspaces',
        'workspace-a',
        'invoices',
        cnpjDeniedKey
      );
      const [invoiceSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(invoiceRef),
        transaction.get(cnpjDeniedLockRef),
      ]);

      transaction.set(
        invoiceRef,
        { ...invoiceSnapshot.data(), supplierCnpj: cnpjNext },
        { merge: false }
      );
      transaction.set(
        cnpjDeniedLockRef,
        {
          ...lockSnapshot.data(),
          supplierCnpj: cnpjNext,
          updatedAt: now(),
          updatedBy: sessionA.user.uid,
        },
        { merge: true }
      );
    })
  );

  console.log('\nFormato estrutural do CNPJ alfanumérico');
  await allowed('Empenho aceita CNPJ alfanumérico oficial em forma canônica', () =>
    setDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'empenhos', '2026NE-CNPJ-ALFA'),
      {
        id: '2026NE-CNPJ-ALFA',
        supplier: 'Fornecedor Alfa',
        supplierCnpj: '00000000E08G12',
        description: 'CNPJ alfanumérico',
        date: '2026-09-19',
        status: 'Ativo',
        items: [],
        revision: 1,
        updatedAt: now(),
        updatedBy: sessionA.user.uid,
      }
    )
  );

  await denied('Empenho rejeita letras nas duas posições de DV do CNPJ', () =>
    setDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'empenhos', '2026NE-CNPJ-DV-ALFA'),
      {
        id: '2026NE-CNPJ-DV-ALFA',
        supplier: 'Fornecedor Inválido',
        supplierCnpj: '00000000E08GXY',
        description: 'DV inválido estruturalmente',
        date: '2026-09-19',
        status: 'Ativo',
        items: [],
        revision: 1,
        updatedAt: now(),
        updatedBy: sessionA.user.uid,
      }
    )
  );

  await denied('Empenho rejeita CNPJ com caractere fora do alfabeto oficial', () =>
    setDoc(
      doc(sessionA.db, 'workspaces', 'workspace-a', 'empenhos', '2026NE-CNPJ-SHAPE'),
      {
        id: '2026NE-CNPJ-SHAPE',
        supplier: 'Fornecedor Inválido',
        supplierCnpj: '00000000E08_12',
        description: 'Forma inválida',
        date: '2026-09-19',
        status: 'Ativo',
        items: [],
        revision: 1,
        updatedAt: now(),
        updatedBy: sessionA.user.uid,
      }
    )
  );

  console.log('\nListagem segura de settings para diagnóstico histórico');

  const ownNsLockQuery = query(
    collection(sessionA.db, 'workspaces', 'workspace-a', 'settings'),
    where(documentId(), '>=', 'sagNsLock_'),
    where(documentId(), '<', 'sagNsLock_\uf8ff')
  );
  const crossNsLockQuery = query(
    collection(sessionA.db, 'workspaces', 'workspace-b', 'settings'),
    where(documentId(), '>=', 'sagNsLock_'),
    where(documentId(), '<', 'sagNsLock_\uf8ff')
  );

  await allowed('Setor lista somente locks NS do próprio workspace para diagnóstico', () =>
    getDocs(ownNsLockQuery)
  );
  await denied('Setor não lista settings de outro workspace', () =>
    getDocs(crossNsLockQuery)
  );

  console.log('\nIsolamento do Google Drive / documentStorage');
  const validDriveSettings = {
    provider: 'google-drive',
    status: 'configured',
    workspaceId: 'workspace-a',
    accountEmail: identities.a.email,
    rootFolderId: 'root-folder-a-123',
    empenhosFolderId: 'empenhos-folder-a-123',
    invoicesFolderId: 'invoices-folder-a-123',
    configuredAt: now(),
    updatedAt: now(),
  };

  const driveRefA = doc(
    sessionA.db,
    'workspaces',
    'workspace-a',
    'settings',
    'documentStorage'
  );

  await allowed('Setor A configura documentStorage no próprio workspace', () =>
    setDoc(driveRefA, validDriveSettings)
  );
  await allowed('Setor A lê o próprio documentStorage', () => getDoc(driveRefA));
  await denied('Setor B não lê documentStorage do Setor A', () =>
    getDoc(
      doc(
        sessionB.db,
        'workspaces',
        'workspace-a',
        'settings',
        'documentStorage'
      )
    )
  );
  await denied('Setor B não configura documentStorage do Setor A', () =>
    setDoc(
      doc(
        sessionB.db,
        'workspaces',
        'workspace-a',
        'settings',
        'documentStorage'
      ),
      {
        ...validDriveSettings,
        accountEmail: identities.b.email,
        updatedAt: now(),
      }
    )
  );
  await denied('documentStorage rejeita workspaceId adulterado', () =>
    setDoc(driveRefA, {
      ...validDriveSettings,
      workspaceId: 'workspace-b',
      updatedAt: now(),
    })
  );
  await denied('documentStorage rejeita persistência de accessToken', () =>
    setDoc(driveRefA, {
      ...validDriveSettings,
      accessToken: 'token-que-nao-pode-ser-persistido',
      updatedAt: now(),
    })
  );
  await denied('documentStorage não pode ser excluído pelo setor', () =>
    deleteDoc(driveRefA)
  );

  console.log('\nFASE 5 — SISCOFIS / Marco Zero / Conciliação');

  const siscofisMarcoZeroRef = doc(
    admin.db,
    'warehouse',
    'hgesm-aprov',
    'siscofisSnapshots',
    'marco-zero'
  );
  const siscofisBaseRow = {
    rowId: 'linha-001',
    materialId: canonicalMaterialId,
    description: 'Arroz parboilizado',
    unit: { code: 'kg', label: null },
    siscofisQuantity: 12,
    emprovexQuantity: 12,
    projectedQuantity: 12,
    difference: 0,
    state: 'MATCHED',
    createsMaterial: false,
    issue: null,
  };
  const siscofisSummary = {
    totalRows: 1,
    matchedRows: 1,
    unresolvedRows: 0,
    divergentRows: 0,
    createsMaterials: 0,
  };
  const siscofisApplying = {
    schemaVersion: 'warehouse_siscofis_snapshot_v1',
    id: 'marco-zero',
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    kind: 'MARCO_ZERO',
    status: 'APPLYING',
    sourceHash: 'd'.repeat(64),
    importSchemaVersion: 'warehouse_siscofis_import_v1',
    sourceLabel: 'Posição SISCOFIS 22/09/2026',
    referenceDate: '2026-09-22',
    cutoffAt: '2026-09-23T12:00:00.000Z',
    actorUid: admin.user.uid,
    rows: [siscofisBaseRow],
    summary: siscofisSummary,
    movementIds: [],
    createdAt: serverTimestamp(),
    confirmedAt: null,
  };

  await allowed('Fundador cria Marco Zero SISCOFIS em estado APPLYING', () =>
    setDoc(siscofisMarcoZeroRef, siscofisApplying)
  );
  await allowed('Fundador conclui Marco Zero sem alterar identidade da importação', () =>
    updateDoc(siscofisMarcoZeroRef, {
      status: 'CONFIRMED',
      movementIds: ['mov_' + 'e'.repeat(64)],
      confirmedAt: serverTimestamp(),
    })
  );
  await denied('Marco Zero confirmado não pode voltar a ser alterado', () =>
    updateDoc(siscofisMarcoZeroRef, {
      status: 'APPLYING',
      confirmedAt: null,
    })
  );
  await denied('Snapshot SISCOFIS não pode ser excluído', () =>
    deleteDoc(siscofisMarcoZeroRef)
  );
  await denied('Setor externo não cria snapshot SISCOFIS nem no próprio workspace', () =>
    setDoc(
      doc(
        sessionA.db,
        'warehouse',
        'workspace-a',
        'siscofisSnapshots',
        'snapshot_' + 'a'.repeat(32)
      ),
      {
        ...siscofisApplying,
        id: 'snapshot_' + 'a'.repeat(32),
        workspaceId: 'workspace-a',
        ug: '123456',
        kind: 'SNAPSHOT',
        status: 'CONFIRMED',
        actorUid: sessionA.user.uid,
        movementIds: [],
        createdAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
      }
    )
  );
  await denied('Snapshot SISCOFIS rejeita campo fora do contrato', () =>
    setDoc(
      doc(
        admin.db,
        'warehouse',
        'hgesm-aprov',
        'siscofisSnapshots',
        'snapshot_' + 'b'.repeat(32)
      ),
      {
        ...siscofisApplying,
        id: 'snapshot_' + 'b'.repeat(32),
        kind: 'SNAPSHOT',
        status: 'CONFIRMED',
        movementIds: [],
        unexpectedField: true,
        createdAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
      }
    )
  );

  console.log('\nCiclo de vida administrativo');
  await denied('Admin não pode suspender somente o workspace', () =>
    updateDoc(doc(admin.db, 'workspaces', 'workspace-lifecycle'), {
      status: 'disabled',
      updatedAt: now(),
    })
  );

  await allowed('Admin vincula UG uma única vez a cadastro legado sem UG', async () => {
    const batch = writeBatch(admin.db);
    batch.update(doc(admin.db, 'workspaces', 'workspace-bootstrap'), {
      ug: '160499',
      updatedAt: now(),
    });
    batch.update(doc(admin.db, 'platformAccounts', identities.bootstrap.email), {
      ug: '160499',
      updatedAt: now(),
    });
    batch.set(doc(admin.db, 'platformUgIndex', '160499'), {
      ug: '160499',
      workspaceId: 'workspace-bootstrap',
      email: identities.bootstrap.email,
      createdAt: now(),
      createdBy: identities.founder.email,
    });
    await batch.commit();
  });

  const hardeningUgIndexRef = doc(admin.db, 'platformUgIndex', '160499');
  await allowed('Administrador lê o índice global de UG', () =>
    getDoc(hardeningUgIndexRef)
  );
  await denied('Setor externo não lê o índice global de UG', () =>
    getDoc(doc(sessionA.db, 'platformUgIndex', '160499'))
  );
  await denied('Índice global de UG não pode ser alterado depois de criado', () =>
    updateDoc(hardeningUgIndexRef, { email: 'adulterado@example.test' })
  );
  await denied('Índice global de UG não pode ser excluído', () =>
    deleteDoc(hardeningUgIndexRef)
  );

  await denied('UG já vinculada não pode ser substituída por outra UG', async () => {
    const batch = writeBatch(admin.db);
    batch.update(doc(admin.db, 'workspaces', 'workspace-bootstrap'), {
      ug: '160498',
      updatedAt: now(),
    });
    batch.update(doc(admin.db, 'platformAccounts', identities.bootstrap.email), {
      ug: '160498',
      updatedAt: now(),
    });
    await batch.commit();
  });

  await allowed('Admin suspende workspace + conta atomicamente', async () => {
    const batch = writeBatch(admin.db);
    batch.update(doc(admin.db, 'workspaces', 'workspace-lifecycle'), {
      status: 'disabled',
      updatedAt: now(),
    });
    batch.update(
      doc(admin.db, 'platformAccounts', identities.lifecycle.email),
      {
        status: 'disabled',
        updatedAt: now(),
      }
    );
    await batch.commit();
  });

  await denied('Setor perde acesso operacional após suspensão', () =>
    getDoc(
      doc(
        sessionLifecycle.db,
        'workspaces',
        'workspace-lifecycle',
        'empenhos',
        'sample'
      )
    )
  );

  await allowed('Admin reativa workspace + conta atomicamente', async () => {
    const batch = writeBatch(admin.db);
    batch.update(doc(admin.db, 'workspaces', 'workspace-lifecycle'), {
      status: 'active',
      updatedAt: now(),
    });
    batch.update(
      doc(admin.db, 'platformAccounts', identities.lifecycle.email),
      {
        status: 'active',
        updatedAt: now(),
      }
    );
    await batch.commit();
  });

  await allowed('Setor recupera acesso após reativação', () =>
    getDoc(
      doc(
        sessionLifecycle.db,
        'workspaces',
        'workspace-lifecycle',
        'empenhos',
        'sample'
      )
    )
  );

  await denied('Admin não altera firebaseUid de setor externo', () =>
    updateDoc(
      doc(admin.db, 'platformAccounts', identities.lifecycle.email),
      {
        firebaseUid: 'uid-admin-nao-pode-trocar',
        updatedAt: now(),
      }
    )
  );
  await denied('Admin não altera workspace fundador pelo lifecycle', () =>
    updateDoc(doc(admin.db, 'workspaces', 'hgesm-aprov'), {
      name: 'HGeSM alterado indevidamente',
      updatedAt: now(),
    })
  );

  console.log('\nFixture determinística para E2E de navegador');
  const browserFixtureTimestamp = now();

  await ownerSet('workspaces/workspace-lifecycle/empenhos/sample', {
    id: 'sample',
    supplier: 'Fornecedor E2E Lifecycle',
    supplierCnpj: '11111111000191',
    description: 'Empenho completo para jornada E2E de navegador',
    date: '2026-09-01',
    status: 'Ativo',
    classification: 'QR',
    pregao: '90001/2026',
    items: [
      {
        id: '1',
        name: 'Item E2E Lifecycle',
        unit: 'UN',
        quantity: 10,
        unitPrice: 20,
        received: 5,
      },
    ],
    userId: identities.lifecycle.uid,
  });

  await ownerSet(
    'workspaces/workspace-lifecycle/invoices/nf_11111111000191_1001',
    {
      id: '1001',
      empenhoId: 'sample',
      issueDate: '2026-06-15',
      items: [
        {
          itemId: '1',
          quantity: 5,
          unitPrice: 20,
          subtotal: 100,
        },
      ],
      totalValue: 100,
      supplier: 'Fornecedor E2E Lifecycle',
      supplierCnpj: '11111111000191',
      recordKey: 'nf_11111111000191_1001',
      registeredAt: browserFixtureTimestamp,
      userId: identities.lifecycle.uid,
    }
  );

  await ownerSet(
    'workspaces/workspace-lifecycle/invoices/nf_11111111000191_2002',
    {
      id: '2002',
      empenhoId: 'sample',
      issueDate: '2026-06-16',
      items: [
        {
          itemId: '1',
          quantity: 1,
          unitPrice: 20,
          subtotal: 20,
        },
      ],
      totalValue: 20,
      supplier: 'Fornecedor E2E Lifecycle',
      recordKey: 'nf_11111111000191_2002',
      registeredAt: browserFixtureTimestamp,
      userId: identities.lifecycle.uid,
    }
  );

  await ownerSet('workspaces/workspace-b/empenhos/sample', {
    id: 'sample',
    supplier: 'Fornecedor E2E Isolado B',
    supplierCnpj: '22222222000191',
    description: 'Empenho completo do segundo workspace E2E',
    date: '2026-09-02',
    status: 'Ativo',
    classification: 'QR',
    pregao: '90002/2026',
    items: [
      {
        id: '1',
        name: 'Item E2E B',
        unit: 'UN',
        quantity: 3,
        unitPrice: 50,
        received: 0,
      },
    ],
    userId: identities.b.uid,
  });

  await ownerSet('workspaces/workspace-lifecycle/empenhos/delete-e2e', {
    id: 'delete-e2e',
    supplier: 'Fornecedor E2E Delete',
    supplierCnpj: '22222222000191',
    description: 'Empenho para exclusão protegida E2E',
    date: '2026-09-03',
    status: 'Ativo',
    classification: 'QR',
    pregao: '90003/2026',
    items: [
      {
        id: '1',
        name: 'Item E2E Delete',
        unit: 'UN',
        quantity: 2,
        unitPrice: 25,
        received: 1,
      },
    ],
    userId: identities.lifecycle.uid,
  });

  await ownerSet(
    'workspaces/workspace-lifecycle/invoices/nf_22222222000191_3003',
    {
      id: '3003',
      empenhoId: 'delete-e2e',
      issueDate: '2026-06-17',
      items: [
        {
          itemId: '1',
          quantity: 1,
          unitPrice: 25,
          subtotal: 25,
        },
      ],
      totalValue: 25,
      supplier: 'Fornecedor E2E Delete',
      supplierCnpj: '22222222000191',
      recordKey: 'nf_22222222000191_3003',
      registeredAt: browserFixtureTimestamp,
      numeroNS: '2026NS008888',
      nsUg: '160416',
      userId: identities.lifecycle.uid,
    }
  );

  await ownerSet(
    'workspaces/workspace-lifecycle/settings/sagNsLock_160416_2026NS008888',
    {
      id: 'sagNsLock_160416_2026NS008888',
      type: 'sag-ns-lock',
      workspaceId: 'workspace-lifecycle',
      ug: '160416',
      numeroNS: '2026NS008888',
      invoiceRecordKey: 'nf_22222222000191_3003',
      invoiceId: '3003',
      empenhoId: 'delete-e2e',
      supplierCnpj: '22222222000191',
      createdAt: browserFixtureTimestamp,
      updatedAt: browserFixtureTimestamp,
      updatedBy: identities.lifecycle.uid,
    }
  );

  await ownerSet('workspaces/workspace-lifecycle/alerts/alert-delete-e2e', {
    id: 'alert-delete-e2e',
    empenhoId: 'delete-e2e',
    type: 'ATENÇÃO',
    title: 'Alerta E2E Delete',
    subtitle: 'Fornecedor E2E Delete',
    description: 'Vínculo estruturado para exclusão protegida.',
    date: 'Agora',
    userId: identities.lifecycle.uid,
  });

  await ownerSet('workspaces/workspace-lifecycle/cronogramas/cronograma-delete-e2e', {
    id: 'cronograma-delete-e2e',
    empenhoId: 'delete-e2e',
    dataCriacao: '2026-09-03',
    colunas: [],
    distribuicao: {},
    userId: identities.lifecycle.uid,
  });

  console.log('BROWSER E2E FIXTURE: READY');

  console.log('\nResumo');
  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok).length;
  console.log(`Cenários executados: ${results.length}`);
  console.log(`Aprovados: ${passed}`);
  console.log(`Falhos: ${failed}`);

  assert.equal(failed, 0);
  console.log('\nMULTI-TENANT SECURITY: READY');
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
