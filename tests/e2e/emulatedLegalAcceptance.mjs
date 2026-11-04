// Exclusivo dos testes Playwright com Firebase Emulator.
// O endpoint real usa Google IAM e banco nomeado não disponíveis no sandbox.
// Não adiciona nenhum desvio ao código da aplicação.
const project = 'demo-emprovex-security';
const root = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
const authEndpoint = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=fake-api-key';
const bundle = {
  legalBundleVersion: 'saas-r4-2026-10-27',
  termsVersion: 'terms-2026-10-27-r2',
  privacyVersion: 'privacy-2026-10-27-r2',
};
const stringField = (document, name) => document?.fields?.[name]?.stringValue ?? '';
const encoded = (value) => encodeURIComponent(value);
const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });

async function readAsUser(path, token) {
  const response = await fetch(root + '/' + path, {
    headers: { authorization: 'Bearer ' + token },
    cache: 'no-store',
  });
  return response.ok ? response.json() : null;
}

export async function registerEmulatedLegalAcceptance(context) {
  if (process.env.GOOGLE_CLOUD_PROJECT !== project
    || process.env.EMPROVEX_E2E_BASE_URL !== 'http://127.0.0.1:3100') {
    throw new Error('LEGAL_EMULATOR_INTERCEPT_FORBIDDEN_OUTSIDE_DEMO');
  }
  await context.route('**/api/legal-acceptance**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname !== '/api/legal-acceptance') return route.continue();
    const reply = (body, status = 200) => route.fulfill(json(body, status));
    const token = /^Bearer (.+)$/.exec(request.headers().authorization ?? '')?.[1];
    if (!token) return reply({ code: 'LEGAL_AUTH_REQUIRED' }, 401);

    try {
      const authResponse = await fetch(authEndpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      if (!authResponse.ok) return reply({ code: 'LEGAL_AUTH_REJECTED' }, 401);
      const user = (await authResponse.json()).users?.[0];
      const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
      const email = user?.email?.toLowerCase().trim();
      if (!user?.localId || !email || user.emailVerified !== true || user.disabled
        || claims.aud !== project || claims.sub !== user.localId
        || claims.email !== email || claims.email_verified !== true
        || claims.firebase?.sign_in_provider !== 'password') {
        return reply({ code: 'LEGAL_IDENTITY_INVALID' }, 403);
      }
      const method = request.method();
      let workspaceId;
      if (method === 'GET') workspaceId = url.searchParams.get('workspaceId');
      else if (method === 'POST') {
        const body = request.postDataJSON();
        if (!body || body.confirm !== true || typeof body.workspaceId !== 'string'
          || Object.keys(body).some(key => !['confirm', 'workspaceId'].includes(key))) {
          return reply({ code: 'LEGAL_CONFIRMATION_REQUIRED' }, 400);
        }
        workspaceId = body.workspaceId;
      } else return reply({ code: 'LEGAL_METHOD_DENIED' }, 405);
      if (!/^(?:workspace-(?:lifecycle|b)|qa-almox-w1)$/.test(workspaceId ?? '')) {
        return reply({ code: 'LEGAL_WORKSPACE_INVALID' }, 403);
      }
      // Estes GETs usam o token real do usuário e as Rules do emulador.
      const [workspace, account] = await Promise.all([
        readAsUser('workspaces/' + workspaceId, token),
        readAsUser('platformAccounts/' + encoded(email), token),
      ]);
      if (!workspace || !account
        || stringField(workspace, 'id') !== workspaceId
        || stringField(workspace, 'status') !== 'active'
        || stringField(workspace, 'authorizedEmail') !== email
        || stringField(account, 'firebaseUid') !== user.localId
        || stringField(account, 'workspaceId') !== workspaceId
        || stringField(account, 'accountType') !== 'sector'
        || stringField(account, 'status') !== 'active'
        || stringField(account, 'authProvider') !== 'password'
        || stringField(account, 'ug') !== stringField(workspace, 'ug')) {
        return reply({ code: 'LEGAL_WORKSPACE_DENIED' }, 403);
      }

      const documentId = encoded(user.localId + '__' + bundle.legalBundleVersion);
      const acceptancePath = `workspaces/${workspaceId}/legalAcceptances/${documentId}`;
      // Apenas o teste atua como servidor IAM no emulador — jamais permitir
      // gravação direta de aceite pelo cliente em produção.
      const readCurrent = async () => {
        const response = await fetch(root + '/' + acceptancePath, {
          headers: { authorization: 'Bearer owner' },
        });
        return response.ok ? response.json() : null;
      };
      const accepted = (record) => record
        && stringField(record, 'uid') === user.localId
        && stringField(record, 'email') === email
        && stringField(record, 'workspaceId') === workspaceId
        && stringField(record, 'ug') === stringField(workspace, 'ug')
        && stringField(record, 'legalBundleVersion') === bundle.legalBundleVersion
        && stringField(record, 'termsVersion') === bundle.termsVersion
        && stringField(record, 'privacyVersion') === bundle.privacyVersion
        && stringField(record, 'schemaVersion') === 'emprovex_legal_acceptance_v1';

      const current = await readCurrent();
      if (accepted(current)) return reply({ accepted: true, created: false, versions: bundle });
      if (method === 'GET') return reply({ accepted: false });
      if (current) return reply({ code: 'LEGAL_ACCEPTANCE_MISMATCH' }, 403);

      const entry = {
        schemaVersion: 'emprovex_legal_acceptance_v1', workspaceId,
        uid: user.localId, email, ug: stringField(workspace, 'ug'),
        ...bundle,
      };
      const response = await fetch(root + '/' + acceptancePath + '?currentDocument.exists=false', {
        method: 'PATCH',
        headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
        body: JSON.stringify({ fields: Object.fromEntries(Object.entries(entry).map(
          ([key, val]) => [key, { stringValue: val }]
        )) }),
      });
      if (!response.ok) {
        if (accepted(await readCurrent())) return reply({ accepted: true, created: false, versions: bundle });
        return reply({ code: 'LEGAL_ACCEPTANCE_SAVE_FAILED' }, 503);
      }
      return reply({ accepted: true, created: true, versions: bundle });
    } catch (error) {
      console.error('E2E LEGAL EMULATOR:', error);
      return reply({ code: 'LEGAL_EMULATOR_UNAVAILABLE' }, 503);
    }
  });
}
