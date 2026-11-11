import {createRemoteJWKSet, jwtVerify} from 'jose';

export const HOSPITAL_PROJECT_ID = 'cozinha-dietetica';
const FIREBASE_ISSUER = `https://securetoken.google.com/${HOSPITAL_PROJECT_ID}`;
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL), {timeoutDuration: 5000});

/**
 * Verify signed Firebase Auth ID tokens for the dedicated hospital project,
 * then check the live Identity Toolkit user record for disabled/revoked state.
 *
 * Does not use the default EMPROVEX Firebase app, service-account key files,
 * client-supplied role claims, or a permissive fail-open fallback.
 * Verification failures must be mapped to 401, not logged with the token.
 */
export async function verifyHospitalFirebaseIdToken(token, {
  verifyJwt = (t) => jwtVerify(t, jwks, {
    issuer: FIREBASE_ISSUER,
    audience: HOSPITAL_PROJECT_ID,
    algorithms: ['RS256'],
    clockTolerance: 5,
  }),
  fetchAccount = globalThis.fetch,
} = {}) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 16000) {
    throw new Error('HOSPITAL_INVALID_TOKEN');
  }
  const key = process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY?.trim();
  if (!key) throw new Error('HOSPITAL_AUTH_UNCONFIGURED');
  if (process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID
      && process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID !== HOSPITAL_PROJECT_ID) {
    throw new Error('HOSPITAL_PROJECT_MISMATCH');
  }
  const {payload} = await verifyJwt(token);
  if (payload.iss !== FIREBASE_ISSUER
      || payload.aud !== HOSPITAL_PROJECT_ID
      || typeof payload.sub !== 'string'
      || payload.sub.length < 1 || payload.sub.length > 128
      || !Number.isInteger(payload.auth_time)
      || payload.auth_time < 1) {
    throw new Error('HOSPITAL_CLAIMS_REJECTED');
  }
  const response = await fetchAccount(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({idToken: token}),
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response?.ok) throw new Error('HOSPITAL_ACCOUNT_CHECK_FAILED');
  const result = await response.json();
  const account = Array.isArray(result?.users)
    ? result.users.find(user => user.localId === payload.sub)
    : null;
  // validSince marks the oldest allowed auth_time. Reject missing/invalid
  // revocation evidence instead of silently accepting an offline JWT.
  const validSince = Number(account?.validSince);
  if (!account || account.disabled === true
      || !Number.isSafeInteger(validSince) || validSince < 0
      || payload.auth_time < validSince) {
    throw new Error('HOSPITAL_ACCOUNT_DISABLED_OR_REVOKED');
  }
  return Object.freeze({uid: payload.sub});
}
