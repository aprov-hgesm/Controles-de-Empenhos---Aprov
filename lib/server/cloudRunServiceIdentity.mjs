// EMPROVEX Cloud Run R7 — short-lived OAuth2 tokens from the attached service identity.
// No key files, user-provided credentials, public routes, or token logging.
const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const TOKEN_REFRESH_MARGIN_MS = 60_000;

let tokenCache = null;

export function isCloudRunRuntime(env = process.env) {
  return Boolean(env?.K_SERVICE && env?.K_REVISION);
}

export async function getCloudRunAccessToken({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  if (!isCloudRunRuntime(env)) {
    throw new Error('CLOUD_RUN_SERVICE_IDENTITY_NOT_AVAILABLE');
  }
  const timestamp = now();
  if (tokenCache && tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS > timestamp) {
    return tokenCache.token;
  }
  // This endpoint is only accessible from Google-managed environments. Never
  // accept a metadata URL, host or service-account selector from request data.
  const response = await fetchImpl(METADATA_TOKEN_URL, {
    method: 'GET',
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('CLOUD_RUN_SERVICE_IDENTITY_UNAVAILABLE');
  }
  const payload = await response.json();
  const token = payload?.access_token;
  const seconds = Number(payload?.expires_in);
  if (typeof token !== 'string' || token.length < 20 ||
      !Number.isFinite(seconds) || seconds <= 60) {
    throw new Error('CLOUD_RUN_SERVICE_IDENTITY_INVALID_TOKEN');
  }
  tokenCache = { token, expiresAt: timestamp + seconds * 1000 };
  return token;
}

// Test-only cache reset; does not expose any token.
export function resetCloudRunTokenCacheForTests() {
  tokenCache = null;
}
