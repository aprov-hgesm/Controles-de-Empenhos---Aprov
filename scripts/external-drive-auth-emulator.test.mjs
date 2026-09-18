#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const PROJECT_ID = 'demo-emprovex-drive-auth';
const API_KEY = 'fake-api-key';
const PASSWORD = 'Emprovex-Drive-Test!2026';
const AUTH_BASE = 'http://127.0.0.1:9099';
const EXTERNAL_EMAIL = 'drive.external@example.test';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const root = process.cwd();
const source = readFileSync(resolve(root, 'lib/googleDriveWorkspace.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'googleDriveWorkspace.ts',
}).outputText;

const externalContext = Object.freeze({
  status: 'sector',
  email: EXTERNAL_EMAIL,
  accountType: 'sector',
  workspaceId: 'workspace-drive-external',
  workspaceName: 'Workspace Drive External',
  institutionalProfile: {
    organizationName: 'Organização de Teste',
    sectionName: 'Aprovisionamento',
  },
  legacyDataMode: false,
  legacySettingsMode: false,
  canLoadOperationalData: true,
  resolutionSource: 'platform-directory',
});

let app;
let auth;
let externalUser;

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
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

async function createVerifiedPasswordUser(email) {
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
}

async function authSnapshot() {
  const user = auth.currentUser;
  assert.ok(user, 'A sessão Firebase externa precisa continuar ativa.');

  const tokenResult = await user.getIdTokenResult(false);
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    providerIds: user.providerData
      .map((provider) => provider.providerId)
      .filter(Boolean)
      .sort(),
    signInProvider: tokenResult.signInProvider,
    token: tokenResult.token,
  };
}

async function assertFirebasePasswordSessionPreserved(
  label,
  originalUser,
  beforeSnapshot
) {
  assert.equal(
    auth.currentUser,
    originalUser,
    `${label}: o objeto currentUser do Firebase foi substituído.`
  );

  const afterSnapshot = await authSnapshot();
  assert.deepEqual(
    afterSnapshot,
    beforeSnapshot,
    `${label}: a identidade/sessão Firebase mudou durante o OAuth Drive.`
  );
  assert.equal(
    afterSnapshot.signInProvider,
    'password',
    `${label}: sign_in_provider deixou de ser password.`
  );
}

async function createDriveHarness(scenario = {}) {
  const state = {
    firebaseReauthCalls: 0,
    initCalls: 0,
    requestCalls: 0,
    fetches: [],
  };

  const oauth2 = {
    initTokenClient(config) {
      state.initCalls += 1;
      return {
        requestAccessToken() {
          state.requestCalls += 1;

          if (scenario.popupError) {
            config.error_callback?.({ type: scenario.popupError });
            return;
          }

          config.callback(
            scenario.tokenResponse ?? {
              access_token: 'external-drive-token',
              expires_in: 3600,
              scope: DRIVE_SCOPE,
            }
          );
        },
      };
    },
    hasGrantedAllScopes() {
      return scenario.scopeGranted ?? true;
    },
  };

  const browserWindow = scenario.gisUnavailable
    ? {}
    : { google: { accounts: { oauth2 } } };

  const driveFetch = async (input, init = {}) => {
    const url = String(input);
    state.fetches.push({ url, init });

    if (!url.includes('/about?fields=user(emailAddress)')) {
      throw new Error(`Chamada Drive inesperada no teste de integração: ${url}`);
    }

    if (scenario.driveStatus) {
      return response(
        scenario.driveStatus,
        scenario.drivePayload ?? {
          error: {
            message: scenario.driveMessage ?? 'Drive request failed',
            errors: [{ reason: scenario.driveReason ?? 'unknown' }],
          },
        }
      );
    }

    return response(200, {
      user: {
        emailAddress: scenario.driveEmail ?? EXTERNAL_EMAIL,
      },
    });
  };

  const context = vm.createContext({
    console,
    process: { env: {} },
    window: browserWindow,
    fetch: driveFetch,
    Headers,
    URLSearchParams,
  });

  const firebaseModule = new vm.SyntheticModule(
    ['GoogleAuthProvider', 'reauthenticateWithPopup'],
    function initializeFirebaseModule() {
      this.setExport('GoogleAuthProvider', GoogleAuthProvider);
      this.setExport('reauthenticateWithPopup', async () => {
        state.firebaseReauthCalls += 1;
        throw new Error(
          'reauthenticateWithPopup não pode ser executado no fluxo Drive de setor externo.'
        );
      });
    },
    { context, identifier: 'firebase/auth' }
  );

  const platformIdentityModule = new vm.SyntheticModule(
    ['normalizePlatformEmail'],
    function initializePlatformIdentityModule() {
      this.setExport(
        'normalizePlatformEmail',
        (value) => String(value || '').trim().toLowerCase()
      );
    },
    { context, identifier: './platformIdentity' }
  );

  const module = new vm.SourceTextModule(transpiled, {
    context,
    identifier: 'file:///lib/googleDriveWorkspace.js',
  });

  await module.link(async (specifier) => {
    if (specifier === 'firebase/auth') return firebaseModule;
    if (specifier === './platformIdentity') return platformIdentityModule;
    throw new Error(`Import inesperado no harness de integração Drive: ${specifier}`);
  });

  await module.evaluate();

  return {
    state,
    connectGoogleDriveForWorkspace: module.namespace.connectGoogleDriveForWorkspace,
    assertWorkspaceGoogleDriveSessionActive:
      module.namespace.assertWorkspaceGoogleDriveSessionActive,
  };
}

async function runPreservationScenario(
  label,
  scenario,
  operation
) {
  const originalUser = auth.currentUser;
  assert.ok(originalUser, `${label}: usuário externo não autenticado.`);

  const beforeSnapshot = await authSnapshot();
  assert.equal(beforeSnapshot.signInProvider, 'password');

  const harness = await createDriveHarness(scenario);
  await operation(harness);

  assert.equal(
    harness.state.firebaseReauthCalls,
    0,
    `${label}: fluxo externo tentou reautenticar a sessão Firebase.`
  );

  await assertFirebasePasswordSessionPreserved(
    label,
    originalUser,
    beforeSnapshot
  );
}

before(async () => {
  await createVerifiedPasswordUser(EXTERNAL_EMAIL);

  app = initializeApp(
    {
      projectId: PROJECT_ID,
      apiKey: API_KEY,
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
    },
    `external-drive-auth-emulator-${Date.now()}`
  );

  auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_BASE, { disableWarnings: true });

  const credential = await signInWithEmailAndPassword(
    auth,
    EXTERNAL_EMAIL,
    PASSWORD
  );
  externalUser = credential.user;

  assert.equal(externalUser.emailVerified, true);
  const tokenResult = await externalUser.getIdTokenResult(true);
  assert.equal(
    tokenResult.signInProvider,
    'password',
    'Pré-condição inválida: setor externo precisa entrar com provider password.'
  );
});

after(async () => {
  try {
    if (auth?.currentUser) await signOut(auth);
  } finally {
    if (app) await deleteApp(app);
  }
});

test('Firebase Auth Emulator: conexão Drive bem-sucedida preserva integralmente a sessão password', async () => {
  await runPreservationScenario(
    'conexão bem-sucedida',
    {},
    async (harness) => {
      const session = await harness.connectGoogleDriveForWorkspace(
        externalUser,
        externalContext
      );
      assert.equal(session.email, EXTERNAL_EMAIL);
      assert.equal(session.workspaceId, externalContext.workspaceId);
      assert.equal(session.accessToken, 'external-drive-token');
    }
  );
});

test('Firebase Auth Emulator: conta Google incorreta não altera a sessão password', async () => {
  await runPreservationScenario(
    'conta Google incorreta',
    { driveEmail: 'outra.conta@example.test' },
    async (harness) => {
      await assert.rejects(
        () => harness.connectGoogleDriveForWorkspace(externalUser, externalContext),
        /não corresponde à conta autorizada/
      );
    }
  );
});

test('Firebase Auth Emulator: popup fechado não altera a sessão password', async () => {
  await runPreservationScenario(
    'popup fechado',
    { popupError: 'popup_closed' },
    async (harness) => {
      await assert.rejects(
        () => harness.connectGoogleDriveForWorkspace(externalUser, externalContext),
        /janela de autorização do Google foi fechada/
      );
    }
  );
});

test('Firebase Auth Emulator: popup bloqueado não altera a sessão password', async () => {
  await runPreservationScenario(
    'popup bloqueado',
    { popupError: 'popup_failed_to_open' },
    async (harness) => {
      await assert.rejects(
        () => harness.connectGoogleDriveForWorkspace(externalUser, externalContext),
        /navegador bloqueou a janela/
      );
    }
  );
});

test('Firebase Auth Emulator: access_denied não altera a sessão password', async () => {
  await runPreservationScenario(
    'access_denied',
    {
      tokenResponse: {
        error: 'access_denied',
      },
    },
    async (harness) => {
      await assert.rejects(
        () => harness.connectGoogleDriveForWorkspace(externalUser, externalContext),
        /cancelada ou recusada/
      );
    }
  );
});

test('Firebase Auth Emulator: Drive 401 não altera a sessão password', async () => {
  await runPreservationScenario(
    'Drive 401',
    {
      driveStatus: 401,
      drivePayload: {
        error: {
          message: 'Invalid Credentials',
          errors: [{ reason: 'authError' }],
        },
      },
    },
    async (harness) => {
      await assert.rejects(
        () => harness.connectGoogleDriveForWorkspace(externalUser, externalContext),
        /autorização temporária do Google Drive expirou/
      );
    }
  );
});

test('Firebase Auth Emulator: Drive 403 não altera a sessão password', async () => {
  await runPreservationScenario(
    'Drive 403',
    {
      driveStatus: 403,
      drivePayload: {
        error: {
          message: 'Operação recusada pelo Drive.',
          errors: [{ reason: 'forbidden' }],
        },
      },
    },
    async (harness) => {
      await assert.rejects(
        () => harness.connectGoogleDriveForWorkspace(externalUser, externalContext),
        /Operação recusada pelo Drive/
      );
    }
  );
});

test('Firebase Auth Emulator: GIS indisponível não altera a sessão password', async () => {
  await runPreservationScenario(
    'GIS indisponível',
    { gisUnavailable: true },
    async (harness) => {
      await assert.rejects(
        () => harness.connectGoogleDriveForWorkspace(externalUser, externalContext),
        /serviço de autorização do Google ainda está carregando/
      );
    }
  );
});

test('Firebase Auth Emulator: token dentro da margem de expiração não altera a sessão password', async () => {
  await runPreservationScenario(
    'token expirando',
    {
      tokenResponse: {
        access_token: 'external-drive-token-expiring',
        expires_in: 30,
        scope: DRIVE_SCOPE,
      },
    },
    async (harness) => {
      const session = await harness.connectGoogleDriveForWorkspace(
        externalUser,
        externalContext
      );
      assert.throws(
        () => harness.assertWorkspaceGoogleDriveSessionActive(session),
        /autorização temporária do Google Drive expirou/
      );
    }
  );
});

test('Firebase Auth Emulator: invariantes finais da sessão externa permanecem password', async () => {
  assert.equal(auth.currentUser, externalUser);
  const snapshot = await authSnapshot();
  assert.equal(snapshot.uid, externalUser.uid);
  assert.equal(snapshot.email, EXTERNAL_EMAIL);
  assert.equal(snapshot.emailVerified, true);
  assert.equal(snapshot.signInProvider, 'password');
  assert.deepEqual(snapshot.providerIds, ['password']);
});
