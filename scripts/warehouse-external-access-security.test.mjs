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
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-security';
const API_KEY = 'fake-api-key';
const PASSWORD = 'Emprovex-Teste!2026';
const AUTH_BASE = 'http://127.0.0.1:9099';
const WAREHOUSE_DATABASE_ID = 'emprovex-warehouse';

const apps = [];

async function authRequest(path, body) {
  const response = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/${path}?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Auth emulator ${path} falhou: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function createVerifiedUser(email) {
  const created = await authRequest('accounts:signUp', {
    email,
    password: PASSWORD,
    returnSecureToken: true,
  });

  await authRequest('accounts:sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    idToken: created.idToken,
  });

  const codes = await fetch(
    `${AUTH_BASE}/emulator/v1/projects/${PROJECT_ID}/oobCodes`
  );
  const payload = await codes.json();
  const verification = [...(payload.oobCodes || [])]
    .reverse()
    .find((item) => item.email === email && item.requestType === 'VERIFY_EMAIL');

  if (!verification?.oobLink) {
    throw new Error(`Código de verificação não encontrado para ${email}.`);
  }

  const verified = await fetch(verification.oobLink);
  if (!verified.ok) {
    throw new Error(`Verificação de e-mail falhou para ${email}.`);
  }

  return created.localId;
}

async function setEmulatorCustomClaims(uid, claims) {
  // O Auth Emulator aceita o endpoint administrativo Identity Toolkit usado pelo
  // backend de produção. Isso permite testar as mesmas claims assinadas nas Rules.
  const response = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner',
      },
      body: JSON.stringify({
        localId: uid,
        customAttributes: JSON.stringify(claims),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Não foi possível aplicar custom claims no Auth Emulator: ${await response.text()}`
    );
  }
}

async function createSectorSession(label, email, workspaceId, ug, withClaims = true) {
  const uid = await createVerifiedUser(email);

  if (withClaims) {
    await setEmulatorCustomClaims(uid, {
      emprovexWarehouse: true,
      emprovexWarehouseVersion: 'v1',
      emprovexRole: 'sector',
      emprovexWorkspaceId: workspaceId,
      emprovexUg: ug,
    });
  }

  const app = initializeApp(
    {
      projectId: PROJECT_ID,
      apiKey: API_KEY,
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
    },
    `central-depositos-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  apps.push(app);

  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_BASE, { disableWarnings: true });
  const credential = await signInWithEmailAndPassword(auth, email, PASSWORD);
  const token = await credential.user.getIdTokenResult(true);

  assert.equal(token.signInProvider, 'password');
  if (withClaims) {
    assert.equal(token.claims.emprovexWorkspaceId, workspaceId);
    assert.equal(token.claims.emprovexUg, ug);
    assert.equal(token.claims.emprovexWarehouse, true);
  }

  const db = getFirestore(app, WAREHOUSE_DATABASE_ID);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { auth, db, user: credential.user };
}

function material(workspaceId, ug, id, description) {
  return {
    schemaVersion: 'warehouse_material_v1',
    id,
    workspaceId,
    ug,
    description,
    aliases: [],
    unit: { code: 'unit', label: null },
    status: 'active',
    conversions: [],
  };
}

async function expectDenied(label, operation) {
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
    throw error;
  }
  throw new Error('Esperava DENY, mas foi permitido: ' + label);
}

async function main() {
  console.log('Central de Depósitos — segurança multi-tenant externa\n');

  const a = await createSectorSession(
    'a',
    'warehouse-a@example.test',
    'workspace-a',
    '160500'
  );
  const b = await createSectorSession(
    'b',
    'warehouse-b@example.test',
    'workspace-b',
    '160501'
  );
  const noClaims = await createSectorSession(
    'no-claims',
    'warehouse-no-claims@example.test',
    'workspace-c',
    '160502',
    false
  );

  const idA = 'mat_' + 'a'.repeat(32);
  const refA = doc(a.db, 'warehouse', 'workspace-a', 'materials', idA);

  await setDoc(
    refA,
    material('workspace-a', '160500', idA, 'Material do workspace A')
  );
  console.log('  [PASS] ALLOW — setor A grava no próprio workspace/UG');

  const own = await getDoc(refA);
  assert.equal(own.exists(), true);
  console.log('  [PASS] ALLOW — setor A lê o próprio workspace');

  const visualRefA = doc(
    a.db,
    'warehouse',
    'workspace-a',
    'settings',
    'landing-visual-layout'
  );
  await setDoc(visualRefA, {
    schemaVersion: 'warehouse_landing_visual_layout_v1',
    workspaceId: 'workspace-a',
    ug: '160500',
    arrangementJson: JSON.stringify({
      ['dep_' + 'd'.repeat(32)]: {
        offsetX: 42,
        offsetY: -18,
        scale: 1.15,
        rotation: 15,
      },
    }),
    updatedBy: a.user.uid,
    updatedAt: serverTimestamp(),
  });
  console.log('  [PASS] ALLOW — setor A salva a disposição visual do próprio workspace');

  const ownVisual = await getDoc(visualRefA);
  assert.equal(ownVisual.exists(), true);
  console.log('  [PASS] ALLOW — setor A lê a própria disposição visual');

  await expectDenied('setor B não lê a disposição visual do workspace A', () =>
    getDoc(
      doc(
        b.db,
        'warehouse',
        'workspace-a',
        'settings',
        'landing-visual-layout'
      )
    )
  );

  await expectDenied('setor A não salva disposição visual em workspace B', () =>
    setDoc(
      doc(
        a.db,
        'warehouse',
        'workspace-b',
        'settings',
        'landing-visual-layout'
      ),
      {
        schemaVersion: 'warehouse_landing_visual_layout_v1',
        workspaceId: 'workspace-b',
        ug: '160501',
        arrangementJson: '{}',
        updatedBy: a.user.uid,
        updatedAt: serverTimestamp(),
      }
    )
  );

  await expectDenied('setor A não salva disposição visual com UG diferente', () =>
    setDoc(visualRefA, {
      schemaVersion: 'warehouse_landing_visual_layout_v1',
      workspaceId: 'workspace-a',
      ug: '160501',
      arrangementJson: '{}',
      updatedBy: a.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  await expectDenied('disposição visual acima do limite de payload é rejeitada', () =>
    setDoc(visualRefA, {
      schemaVersion: 'warehouse_landing_visual_layout_v1',
      workspaceId: 'workspace-a',
      ug: '160500',
      arrangementJson: 'x'.repeat(24001),
      updatedBy: a.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  await expectDenied('setor B não lê workspace A', () =>
    getDoc(doc(b.db, 'warehouse', 'workspace-a', 'materials', idA))
  );

  const crossWorkspaceId = 'mat_' + 'b'.repeat(32);
  await expectDenied('setor A não grava em workspace B', () =>
    setDoc(
      doc(a.db, 'warehouse', 'workspace-b', 'materials', crossWorkspaceId),
      material('workspace-b', '160501', crossWorkspaceId, 'Tentativa cruzada')
    )
  );

  const wrongUgId = 'mat_' + 'c'.repeat(32);
  await expectDenied('setor A não grava UG diferente da claim assinada', () =>
    setDoc(
      doc(a.db, 'warehouse', 'workspace-a', 'materials', wrongUgId),
      material('workspace-a', '160501', wrongUgId, 'UG adulterada')
    )
  );

  await expectDenied('sessão password sem claims não acessa warehouse', () =>
    getDoc(doc(noClaims.db, 'warehouse', 'workspace-a', 'materials', idA))
  );

  console.log('\nCENTRAL DE DEPÓSITOS EXTERNAL SECURITY: READY');
}

try {
  await main();
} finally {
  for (const app of apps) {
    try {
      const auth = getAuth(app);
      if (auth.currentUser) await signOut(auth);
    } catch {
      // cleanup best effort
    }
    try {
      await deleteApp(app);
    } catch {
      // cleanup best effort
    }
  }
}
