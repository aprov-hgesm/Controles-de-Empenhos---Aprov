import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import { HGESM_SECTOR_EMAIL } from '../hgesmWorkspace';
import { normalizePlatformEmail } from '../platformIdentity';

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const FIREBASE_ISSUER = `https://securetoken.google.com/${firebaseConfig.projectId}`;

export class FounderAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
    this.name = 'FounderAuthError';
  }
}

function readBearerToken(authorization: string | null): string {
  if (!authorization) {
    throw new FounderAuthError('Token de autenticação ausente.', 401);
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new FounderAuthError('Token de autenticação inválido.', 401);
  }

  return token;
}

function verifiedEmail(payload: JWTPayload): string {
  const email = typeof payload.email === 'string'
    ? normalizePlatformEmail(payload.email)
    : '';
  const emailVerified = payload.email_verified === true;

  if (!email || !emailVerified) {
    throw new FounderAuthError('Conta Firebase sem e-mail verificado.', 403);
  }

  return email;
}

export async function verifyFounderFirebaseRequest(
  authorization: string | null
): Promise<{ uid: string; email: string }> {
  const token = readBearerToken(authorization);

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: FIREBASE_ISSUER,
      audience: firebaseConfig.projectId,
      algorithms: ['RS256'],
    }));
  } catch {
    throw new FounderAuthError('Sessão Firebase inválida ou expirada.', 401);
  }

  const email = verifiedEmail(payload);
  if (email !== HGESM_SECTOR_EMAIL) {
    throw new FounderAuthError('Acesso reservado à conta fundadora.', 403);
  }

  if (!payload.sub) {
    throw new FounderAuthError('Token Firebase sem identidade de usuário.', 401);
  }

  return {
    uid: payload.sub,
    email,
  };
}
