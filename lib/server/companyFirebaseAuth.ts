import { createRemoteJWKSet, jwtVerify } from 'jose';
import { FounderAuthError, verifyFirebaseRequest, type VerifiedFirebaseRequest } from './firebaseFounderAuth';
export { FounderAuthError } from './firebaseFounderAuth';
import companyConfig from '../../config/empresas-firebase-web.json';
import { assertCompanyRuntime } from './companyFirebaseRuntime';

const keys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
/** A principal-project Firebase token can never be accepted for company routes. */
export async function verifyCompanyFirebaseRequest(
  authorization: string | null,
): Promise<VerifiedFirebaseRequest> {
  try { assertCompanyRuntime(); }
  catch { throw new FounderAuthError('Ambiente empresarial indisponível.', 403); }

  // Strict demo-* loopback; legacy verifier performs its own emulator checks.
  if (process.env.EMPROVEX_E2E_SERVER_AUTH === '1') return verifyFirebaseRequest(authorization);

  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new FounderAuthError('Token empresarial ausente.', 401);
  const token = match[1];
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(token, keys, {
      issuer: 'https://securetoken.google.com/' + companyConfig.projectId,
      audience: companyConfig.projectId,
      algorithms: ['RS256'],
    }));
  } catch { throw new FounderAuthError('Token empresarial inválido.', 401); }
  const uid = claims.sub || '';
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  const firebase = claims.firebase && typeof claims.firebase === 'object' && !Array.isArray(claims.firebase)
    ? claims.firebase as Record<string, unknown> : {};
  const signInProvider = firebase.sign_in_provider;
  if (!uid || !email || claims.email_verified !== true
    || signInProvider !== 'password') {
    throw new FounderAuthError('Conta empresarial não autorizada.', 403);
  }
  return { uid, email, signInProvider, idToken: token, claims };
}
