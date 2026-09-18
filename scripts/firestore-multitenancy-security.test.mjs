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
  doc,
  getDoc,
  getFirestore,
  runTransaction,
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
  return {
    id,
    name: `Workspace ${id}`,
    status,
    authorizedEmail: email,
    institutionalProfile: {
      organizationName: `Organização ${id}`,
      organizationShortName: id.toUpperCase(),
      sectionName: 'Aprovisionamento',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'aprov1hgesm@gmail.com',
    ...extra,
  };
}

function account(email, workspaceId, uid, status = 'active', authProvider = 'password') {
  return {
    email,
    ...(authProvider ? { authProvider } : {}),
    ...(uid ? { firebaseUid: uid } : {}),
    accountType: 'sector',
    workspaceId,
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
  authProvider = 'password'
) {
  await ownerSet(`workspaces/${id}`, workspace(id, email, status));
  await ownerSet(
    `platformAccounts/${email}`,
    account(email, accountWorkspaceId, uid, status, authProvider)
  );
  await ownerSet(`workspaces/${id}/empenhos/sample`, {
    id: 'sample',
    ownerWorkspaceId: id,
    marker: `seed-${id}`,
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
  await seedWorkspace('workspace-b', identities.b.email, identities.b.uid);
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
