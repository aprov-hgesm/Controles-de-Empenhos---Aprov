#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const source = readFileSync(resolve(root, 'lib/googleDriveWorkspace.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'googleDriveWorkspace.ts',
}).outputText;

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const EXPECTED_EMAIL = 'setor.externo@gmail.com';

const externalContext = Object.freeze({
  status: 'sector',
  email: EXPECTED_EMAIL,
  accountType: 'sector',
  workspaceId: 'setor-externo',
  workspaceName: 'Setor Externo',
  institutionalProfile: {
    organizationName: 'Organização Externa',
    sectionName: 'Aprovisionamento',
  },
  legacyDataMode: false,
  legacySettingsMode: false,
  canLoadOperationalData: true,
  resolutionSource: 'platform-directory',
});

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

async function createHarness(scenario = {}) {
  const state = {
    firebaseMutations: [],
    initCalls: 0,
    requestCalls: 0,
    initConfig: null,
    requestConfig: null,
    scopeChecks: 0,
    fetches: [],
    founderProvider: null,
  };

  const oauth2 = {
    initTokenClient(config) {
      state.initCalls += 1;
      state.initConfig = config;
      return {
        requestAccessToken(configOverride) {
          state.requestCalls += 1;
          state.requestConfig = configOverride;

          if (scenario.popupError) {
            config.error_callback?.({ type: scenario.popupError });
            return;
          }

          config.callback(
            scenario.tokenResponse ?? {
              access_token: 'external-drive-token',
              scope: DRIVE_SCOPE,
            }
          );
        },
      };
    },
    hasGrantedAllScopes() {
      state.scopeChecks += 1;
      return scenario.scopeGranted ?? true;
    },
  };

  const browserWindow = scenario.gisUnavailable
    ? {}
    : { google: { accounts: { oauth2 } } };

  const fetchMock = async (input, init = {}) => {
    state.fetches.push({ input: String(input), init });

    if (!String(input).includes('/about?fields=user(emailAddress)')) {
      throw new Error(`Unexpected Drive request during OAuth test: ${String(input)}`);
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
        emailAddress: scenario.driveEmail ?? EXPECTED_EMAIL,
      },
    });
  };

  const context = vm.createContext({
    console,
    process: { env: {} },
    window: browserWindow,
    fetch: fetchMock,
    Headers,
    URLSearchParams,
  });

  class MockGoogleAuthProvider {
    constructor() {
      this.scopes = [];
      this.customParameters = {};
    }

    addScope(scope) {
      this.scopes.push(scope);
    }

    setCustomParameters(parameters) {
      this.customParameters = parameters;
    }

    static credentialFromResult(result) {
      return {
        accessToken: result.__accessToken ?? 'founder-drive-token',
      };
    }
  }

  const reauthenticateWithPopup = async (user, provider) => {
    state.firebaseMutations.push('reauthenticateWithPopup');
    state.founderProvider = provider;
    return {
      user: {
        uid: user.uid,
        email: user.email,
      },
      __accessToken: scenario.founderAccessToken ?? 'founder-drive-token',
    };
  };

  const signOut = async () => {
    state.firebaseMutations.push('signOut');
  };

  const signInWithPopup = async () => {
    state.firebaseMutations.push('signInWithPopup');
    throw new Error('signInWithPopup must not be used by external Drive OAuth');
  };

  const linkWithPopup = async () => {
    state.firebaseMutations.push('linkWithPopup');
    throw new Error('linkWithPopup must not be used by external Drive OAuth');
  };

  const reauthenticateWithCredential = async () => {
    state.firebaseMutations.push('reauthenticateWithCredential');
    throw new Error('reauthenticateWithCredential must not be used by external Drive OAuth');
  };

  const firebaseModule = new vm.SyntheticModule(
    [
      'GoogleAuthProvider',
      'reauthenticateWithPopup',
      'signOut',
      'signInWithPopup',
      'linkWithPopup',
      'reauthenticateWithCredential',
    ],
    function initializeFirebaseModule() {
      this.setExport('GoogleAuthProvider', MockGoogleAuthProvider);
      this.setExport('reauthenticateWithPopup', reauthenticateWithPopup);
      this.setExport('signOut', signOut);
      this.setExport('signInWithPopup', signInWithPopup);
      this.setExport('linkWithPopup', linkWithPopup);
      this.setExport('reauthenticateWithCredential', reauthenticateWithCredential);
    },
    { context, identifier: 'firebase/auth' }
  );

  const platformIdentityModule = new vm.SyntheticModule(
    ['normalizePlatformEmail'],
    function initializePlatformIdentityModule() {
      this.setExport('normalizePlatformEmail', (value) => String(value || '').trim().toLowerCase());
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
    throw new Error(`Unexpected module import in Drive OAuth harness: ${specifier}`);
  });

  await module.evaluate();

  return {
    state,
    connectGoogleDriveForWorkspace: module.namespace.connectGoogleDriveForWorkspace,
  };
}

function externalUser(email = EXPECTED_EMAIL) {
  return Object.freeze({
    uid: 'firebase-sector-uid',
    email,
  });
}

async function expectExternalFailure(scenario, expectedMessage) {
  const harness = await createHarness(scenario);

  await assert.rejects(
    () => harness.connectGoogleDriveForWorkspace(externalUser(), externalContext),
    expectedMessage
  );

  assert.deepEqual(
    harness.state.firebaseMutations,
    [],
    'Uma falha do OAuth/Drive externo não pode alterar a sessão Firebase.'
  );

  return harness;
}

test('external Drive OAuth succeeds without mutating the Firebase password session', async () => {
  const harness = await createHarness();

  const session = await harness.connectGoogleDriveForWorkspace(
    externalUser(),
    externalContext
  );

  assert.equal(session.accessToken, 'external-drive-token');
  assert.equal(session.email, EXPECTED_EMAIL);
  assert.equal(session.workspaceId, externalContext.workspaceId);
  assert.equal(typeof session.connectedAt, 'string');
  assert.deepEqual(harness.state.firebaseMutations, []);
  assert.equal(harness.state.initCalls, 1);
  assert.equal(harness.state.requestCalls, 1);
  assert.equal(harness.state.fetches.length, 1);
  assert.equal(harness.state.initConfig.client_id.length > 20, true);
  assert.equal(harness.state.initConfig.scope, DRIVE_SCOPE);
  assert.equal(harness.state.initConfig.include_granted_scopes, false);
  assert.equal(harness.state.initConfig.login_hint, EXPECTED_EMAIL);
});

test('wrong Google account is rejected and Firebase session remains untouched', async () => {
  await expectExternalFailure(
    { driveEmail: 'outra.conta@gmail.com' },
    /mesma Conta Google autorizada/
  );
});

test('closed OAuth popup does not sign the external user out', async () => {
  const harness = await expectExternalFailure(
    { popupError: 'popup_closed' },
    /janela de autorização do Google foi fechada/
  );
  assert.equal(harness.state.fetches.length, 0);
});

test('blocked OAuth popup does not sign the external user out', async () => {
  const harness = await expectExternalFailure(
    { popupError: 'popup_failed_to_open' },
    /navegador bloqueou a janela de autorização/
  );
  assert.equal(harness.state.fetches.length, 0);
});

test('OAuth access denial does not sign the external user out', async () => {
  const harness = await expectExternalFailure(
    {
      tokenResponse: {
        error: 'access_denied',
        error_description: 'O usuário recusou o acesso ao Google Drive.',
      },
    },
    /recusou o acesso ao Google Drive/
  );
  assert.equal(harness.state.fetches.length, 0);
});

test('missing access token fails closed without touching Firebase Auth', async () => {
  const harness = await expectExternalFailure(
    { tokenResponse: {} },
    /não retornou uma autorização temporária/
  );
  assert.equal(harness.state.fetches.length, 0);
});

test('missing drive.file grant fails closed without touching Firebase Auth', async () => {
  const harness = await expectExternalFailure(
    { scopeGranted: false },
    /permissão necessária para usar o Google Drive não foi concedida/
  );
  assert.equal(harness.state.fetches.length, 0);
});

test('GIS unavailable in the browser preserves the external Firebase session', async () => {
  const harness = await expectExternalFailure(
    { gisUnavailable: true },
    /serviço de autorização do Google ainda está carregando/
  );
  assert.equal(harness.state.initCalls, 0);
  assert.equal(harness.state.fetches.length, 0);
});

test('Drive API 401 requests reconnection without signing the user out', async () => {
  await expectExternalFailure(
    {
      driveStatus: 401,
      drivePayload: {
        error: {
          message: 'Invalid Credentials',
          errors: [{ reason: 'authError' }],
        },
      },
    },
    /autorização temporária do Google Drive expirou/
  );
});

test('Drive API 403 remains a Drive error and does not become a Firebase logout', async () => {
  await expectExternalFailure(
    {
      driveStatus: 403,
      drivePayload: {
        error: {
          message: 'Drive API recusou a operação.',
          errors: [{ reason: 'forbidden' }],
        },
      },
    },
    /Drive API recusou a operação/
  );
});

test('Firebase user/workspace email mismatch stops before OAuth and preserves the session', async () => {
  const harness = await createHarness();

  await assert.rejects(
    () => harness.connectGoogleDriveForWorkspace(
      externalUser('usuario.diferente@gmail.com'),
      externalContext
    ),
    /conta Firebase atual não corresponde/
  );

  assert.deepEqual(harness.state.firebaseMutations, []);
  assert.equal(harness.state.initCalls, 0);
  assert.equal(harness.state.fetches.length, 0);
});

test('founder path keeps the consolidated Firebase Google reauthentication flow', async () => {
  const founderEmail = 'aprov1hgesm@gmail.com';
  const harness = await createHarness();

  const session = await harness.connectGoogleDriveForWorkspace(
    Object.freeze({ uid: 'founder-uid', email: founderEmail }),
    Object.freeze({
      ...externalContext,
      email: founderEmail,
      workspaceId: 'hgesm-aprov',
      resolutionSource: 'legacy-hgesm-bootstrap',
    })
  );

  assert.equal(session.email, founderEmail);
  assert.equal(session.accessToken, 'founder-drive-token');
  assert.deepEqual(harness.state.firebaseMutations, ['reauthenticateWithPopup']);
  assert.equal(harness.state.initCalls, 0);
  assert.equal(harness.state.founderProvider.scopes.includes(DRIVE_SCOPE), true);
});

test('external OAuth source boundary contains no Firebase session mutation primitive', () => {
  const requestStart = source.indexOf('function requestIndependentDriveAccessToken(');
  const founderStart = source.indexOf('async function connectFounderDriveSession(');

  assert.notEqual(requestStart, -1, 'Fluxo de token independente não foi localizado.');
  assert.notEqual(founderStart, -1, 'Fluxo fundador não foi localizado.');
  assert.equal(founderStart > requestStart, true);

  const externalSurface = source.slice(requestStart, founderStart);
  for (const forbidden of [
    'reauthenticateWithPopup',
    'reauthenticateWithCredential',
    'signOut(',
    'signInWithPopup',
    'linkWithPopup',
    'updateCurrentUser',
  ]) {
    assert.equal(
      externalSurface.includes(forbidden),
      false,
      `Primitiva Firebase proibida no OAuth externo: ${forbidden}`
    );
  }
});
