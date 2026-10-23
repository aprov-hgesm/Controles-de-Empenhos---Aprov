/**
 * Cloud Run managed-identity OAuth access token. This is NOT a Firebase user ID
 * token and NOT an OIDC audience token for invokers. No private keys or ADC JSON.
 * All requests go exclusively to the fixed metadata-server host.
 *
 * The target's IAM and access to production must be audited separately.
 * @param {{env?:Record<string,string|undefined>, fetchImpl?:typeof fetch}} options
 */
export async function getCloudRunManagedAccessToken(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const fail = (reason) => { throw new Error('CLOUD_RUN_ADC_' + reason); };
  if (!env.K_SERVICE || env.EMPROVEX_RUNTIME_TARGET !== 'cloud-run-staging')
    fail('RUNTIME_NOT_AUTHORIZED');
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)
    fail('PRIVATE_KEYS_FORBIDDEN');
  const expectedProject = env.EMPROVEX_CLOUD_PROJECT_ID?.trim();
  const expectedIdentity = env.EMPROVEX_CLOUD_SERVICE_ACCOUNT_EMAIL?.trim().toLowerCase();
  if (!expectedProject || !expectedIdentity ||
      !expectedIdentity.endsWith('@' + expectedProject + '.iam.gserviceaccount.com'))
    fail('EXPECTED_IDENTITY_MISSING');

  const base = 'http://metadata.google.internal/computeMetadata/v1/';
  const headers = { 'Metadata-Flavor': 'Google' };
  async function fetchMetadata(path, json = false) {
    let response;
    try {
      response = await fetchImpl(base + path, { headers, cache: 'no-store',
        signal: AbortSignal.timeout(2500) });
    } catch { fail('METADATA_UNAVAILABLE'); }
    if (!response.ok) fail('METADATA_HTTP_' + response.status);
    try { return json ? await response.json() : await response.text(); }
    catch { fail('METADATA_MALFORMED'); }
  }

  // Bind actual metadata project and attached service-account identity before
  // asking the metadata server to mint the OAuth token.
  const actualProject = (await fetchMetadata('project/project-id')).trim();
  if (actualProject !== expectedProject) fail('PROJECT_MISMATCH');
  const actualIdentity = (await fetchMetadata('instance/service-accounts/default/email')).trim().toLowerCase();
  if (actualIdentity !== expectedIdentity) fail('SERVICE_ACCOUNT_MISMATCH');

  const payload = await fetchMetadata('instance/service-accounts/default/token', true);
  if (!payload || typeof payload !== 'object' ||
      payload.token_type?.toLowerCase() !== 'bearer' ||
      typeof payload.access_token !== 'string' ||
      !payload.access_token ||
      !Number.isFinite(Number(payload.expires_in)) || Number(payload.expires_in) <= 0)
    fail('TOKEN_INVALID');
  // A metadata token must have Google API OAuth scope, never an ID-token audience.
  if (payload.scope && !String(payload.scope).split(/\s+/)
    .includes('https://www.googleapis.com/auth/cloud-platform')) fail('SCOPE_INVALID');
  return payload.access_token;
}
