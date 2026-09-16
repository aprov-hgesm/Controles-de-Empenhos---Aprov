import 'server-only';

import { createRemoteJWKSet, jwtVerify } from 'jose';
import firebaseConfig from '../../firebase-applet-config.json';

const GOOGLE_FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const DEFAULT_AUTHORIZED_EMAIL = 'aprov1hgesm@gmail.com';

export interface AuthorizedFirebaseUser {
  uid: string;
  email: string;
}

class AuthenticationError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.status = status;
  }
}

function getAuthorizedEmails(): Set<string> {
  const configured = process.env.EMPENHO_DOCUMENT_AUTHORIZED_EMAILS || DEFAULT_AUTHORIZED_EMAIL;
  return new Set(
    configured
      .split(',')
      .map((email) => email.trim().toLocaleLowerCase('pt-BR'))
      .filter(Boolean)
  );
}

export async function requireAuthorizedFirebaseUser(
  request: Request
): Promise<AuthorizedFirebaseUser> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new AuthenticationError('Autenticação obrigatória.');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new AuthenticationError('Token de autenticação ausente.');
  }

  const projectId = firebaseConfig.projectId;

  try {
    const { payload } = await jwtVerify(token, GOOGLE_FIREBASE_JWKS, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });

    const uid = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email.toLocaleLowerCase('pt-BR') : '';
    const emailVerified = payload.email_verified === true;

    if (!uid || !email || !emailVerified) {
      throw new AuthenticationError('Conta Google não verificada.');
    }

    if (!getAuthorizedEmails().has(email)) {
      throw new AuthenticationError('Usuário sem autorização para acessar documentos.', 403);
    }

    return { uid, email };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Sessão inválida ou expirada.');
  }
}

export function authenticationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthenticationError)) {
    return null;
  }

  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
