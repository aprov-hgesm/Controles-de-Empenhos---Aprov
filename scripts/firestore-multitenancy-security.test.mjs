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
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
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

  let sessionA = await createSession('a', identities.a.email);
  const sessionB = await createSession('b', identities.b.email);
  const sessionWrongUid = await createSession('wrong', identities.wrongUid.email);
  const sessionBootstrap = await createSession('bootstrap', identities.bootstrap.email);
  const sessionPrebound = await createSession('prebound', identities.prebound.email);
  const sessionSuspended = await createSession('suspended', identities.suspended.email);
  const sessionTampered = await createSession('tampered', identities.tampered.email);
  const sessionLifecycle = await createSession('lifecycle', identities.lifecycle.email);

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
  await denied('Administrador não lê dados operacionais de setor externo', () =>
    getDoc(doc(admin.db, 'workspaces', 'workspace-a', 'empenhos', 'sample'))
  );
  await denied('Administrador não grava dados operacionais de setor externo', () =>
    setDoc(doc(admin.db, 'workspaces', 'workspace-a', 'alerts', 'admin-bypass'), {
      marker: 'forbidden',
    })
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

      transaction.set(empenhoRef, { supplierCnpj: cnpjNext }, { merge: true });
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
      }
    )
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
