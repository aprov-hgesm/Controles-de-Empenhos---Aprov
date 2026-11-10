// Values must match a deliberately separate Cloud Run deployment and SA.
// The runtime may live in an existing BILLED host project, but it must access
// only Firestore in emprovex-empresas; never attach the institutional SA.
export const COMPANY_RUN_SERVICE = 'emprovex-empresas';
const ACCOUNT = /^emprovex-empresas-runtime@[a-z][a-z0-9-]{4,62}\.iam\.gserviceaccount\.com$/;

export function isConfiguredCompanyRuntime(env = {}) {
  if (env.EMPROVEX_COMPANY_ISOLATED_RUNTIME !== '1'
      || env.EMPROVEX_COMPANY_RUNTIME_PROJECT_ID !== 'emprovex-empresas') return false;
  const hosted = env.NODE_ENV === 'production' || Boolean(env.K_SERVICE || env.VERCEL);
  if (!hosted) return true; // Local demo-* emulator suites only; server transport rejects live.
  return env.K_SERVICE === COMPANY_RUN_SERVICE
    && Boolean(env.K_REVISION)
    && !env.VERCEL
    && !env.GOOGLE_APPLICATION_CREDENTIALS
    && typeof env.EMPROVEX_COMPANY_SERVICE_ACCOUNT_EMAIL === 'string'
    && ACCOUNT.test(env.EMPROVEX_COMPANY_SERVICE_ACCOUNT_EMAIL);
}

const EMAIL_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email';
let approvedEmail = '';

export async function assertAttachedCompanyServiceAccount({
  env = process.env, fetchImpl = globalThis.fetch,
} = {}) {
  const expected = env.EMPROVEX_COMPANY_SERVICE_ACCOUNT_EMAIL || '';
  if (!isConfiguredCompanyRuntime(env) || !env.K_SERVICE || !expected) {
    throw new Error('COMPANY_SERVICE_IDENTITY_REQUIRED');
  }
  if (approvedEmail === expected) return;
  const response = await fetchImpl(EMAIL_URL, {
    headers: { 'Metadata-Flavor': 'Google' },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || (await response.text()).trim() !== expected) {
    throw new Error('COMPANY_SERVICE_IDENTITY_MISMATCH');
  }
  approvedEmail = expected;
}

export function resetCompanyServiceIdentityForTests() { approvedEmail = ''; }
