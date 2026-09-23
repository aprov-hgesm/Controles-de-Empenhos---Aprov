import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import { HGESM_SECTOR_EMAIL } from '../hgesmWorkspace';
import {
  FOUNDER_AUTH_PROVIDER,
  normalizePlatformEmail,
} from '../platformIdentity';

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const FIREBASE_ISSUER = `https://securetoken.google.com/${firebaseConfig.projectId}`;

function emulatorAuthContext(): { projectId: string; issuer: string } | null {
  const enabled = process.env.EMPROVEX_E2E_SERVER_AUTH === '1';
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim() || '';
  const projectId = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim() || '';
  const localEmulator = emulatorHost === '127.0.0.1:9099' || emulatorHost === 'localhost:9099';

  if (!enabled || !localEmulator || !projectId.startsWith('demo-')) return null;

  return {
    projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  };
}

function decodeVerifiedEmulatorPayload(token: string): JWTPayload {
  const context = emulatorAuthContext();
  if (!context) {
    throw new FounderAuthError('Sessão Firebase inválida ou expirada.', 401);
  }

  let payload: JWTPayload;
  try {
    payload = decodeJwt(token);
  } catch {
    throw new FounderAuthError('Sessão Firebase inválida ou expirada.', 401);
  }

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const now = Math.floor(Date.now() / 1000);

  if (
    payload.iss !== context.issuer
    || !audience.includes(context.projectId)
    || (typeof payload.exp === 'number' && payload.exp <= now)
  ) {
    throw new FounderAuthError('Sessão Firebase inválida ou expirada.', 401);
  }

  return payload;
}

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

function verifiedSignInProvider(payload: JWTPayload): string {
  const firebaseClaim = payload.firebase;
  if (!firebaseClaim || typeof firebaseClaim !== 'object' || Array.isArray(firebaseClaim)) {
    return '';
  }

  const provider = (firebaseClaim as Record<string, unknown>).sign_in_provider;
  return typeof provider === 'string' ? provider : '';
}

export async function verifyFounderFirebaseRequest(
  authorization: string | null
): Promise<{ uid: string; email: string }> {
  const token = readBearerToken(authorization);

  let payload: JWTPayload;
  const emulatorContext = emulatorAuthContext();

  if (emulatorContext) {
    payload = decodeVerifiedEmulatorPayload(token);
  } else {
    try {
      ({ payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: firebaseConfig.projectId,
        algorithms: ['RS256'],
      }));
    } catch {
      throw new FounderAuthError('Sessão Firebase inválida ou expirada.', 401);
    }
  }

  const email = verifiedEmail(payload);
  if (email !== HGESM_SECTOR_EMAIL) {
    throw new FounderAuthError('Acesso reservado à conta fundadora.', 403);
  }

  if (verifiedSignInProvider(payload) !== FOUNDER_AUTH_PROVIDER) {
    throw new FounderAuthError('A conta fundadora exige autenticação Google.', 403);
  }

  if (!payload.sub) {
    throw new FounderAuthError('Token Firebase sem identidade de usuário.', 401);
  }

  return {
    uid: payload.sub,
    email,
  };
}
