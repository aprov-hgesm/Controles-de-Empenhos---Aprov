// Exclusivamente no Playwright/Firebase Emulator: adapta o endpoint externo de
// cobrança ao projeto demo, sem modificar a implementação de produção.
const project = 'demo-emprovex-security';
const firestoreBase = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=fake-api-key';

function getField(row, name) {
  const field = row?.fields?.[name];
  if (field?.stringValue !== undefined) return field.stringValue;
  return null;
}

async function getTenantDoc(path, token) {
  const result = await fetch(firestoreBase + '/' + path, {
    headers: { authorization: 'Bearer ' + token },
    cache: 'no-store',
  });
  return result.ok ? await result.json() : null;
}

/** Registra mock **somente** do backend financeiro dependente de IAM real.
 * O mock verifica o token no Auth Emulator e aplica isolamento das Rules
 * reais no Firestore Emulator antes de permitir o status fictício exempt.
 */
export async function registerEmulatedBillingPortal(context) {
  if (process.env.GOOGLE_CLOUD_PROJECT !== project
    || process.env.EMPROVEX_E2E_BASE_URL !== 'http://127.0.0.1:3100') {
    throw new Error('BILLING_EMULATOR_INTERCEPT_FORBIDDEN_OUTSIDE_DEMO');
  }
  await context.route('**/api/billing/portal?view=access', async (route) => {
    const auth = route.request().headers().authorization ?? '';
    const token = /^Bearer (.+)$/.exec(auth)?.[1];
    const forbidden = (status = 403) => route.fulfill({
      status, contentType: 'application/json',
      body: JSON.stringify({ allowed: false, reason: 'emulator_denied' }),
    });
    if (!token) return forbidden(401);
    try {
      const identityResponse = await fetch(authUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      if (!identityResponse.ok) return forbidden(401);
      const identity = await identityResponse.json();
      const user = identity.users?.[0];
      const claims = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
      const email = user?.email?.trim().toLowerCase();
      if (!user?.localId || !email || user.emailVerified !== true || user.disabled
        || claims.aud !== project
        || claims.sub !== user.localId
        || claims.email_verified !== true
        || claims.email !== email
        || claims.firebase?.sign_in_provider !== 'password') return forbidden(401);
      const platform = await getTenantDoc('platformAccounts/' + encodeURIComponent(email), token);
      const workspaceId = getField(platform, 'workspaceId');
      if (getField(platform, 'firebaseUid') !== user.localId
        || getField(platform, 'status') !== 'active'
        || !/^workspace-(?:lifecycle|b)$/.test(workspaceId ?? '')) return forbidden();
      const [workspace, billing] = await Promise.all([
        getTenantDoc('workspaces/' + workspaceId, token),
        getTenantDoc('billingAccounts/' + workspaceId, token),
      ]);
      if (!workspace || !billing
        || getField(workspace, 'status') !== 'active'
        || getField(workspace, 'authorizedEmail') !== email
        || getField(billing, 'authorizedEmail') !== email
        || getField(billing, 'workspaceId') !== workspaceId
        || getField(billing, 'status') !== 'exempt'
        || getField(billing, 'ug') !== getField(workspace, 'ug')) return forbidden();
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          allowed: true, reason: 'vip', referenceMonth: '2026-10', amountCents: 0,
          graceUntil: null, canRequestGrace48: false, requestPending: false,
          requiresPayment: false,
        }),
      });
    } catch (error) {
      console.warn('E2E billing emulado rejeitado:', error);
      return forbidden(503);
    }
  });
}
