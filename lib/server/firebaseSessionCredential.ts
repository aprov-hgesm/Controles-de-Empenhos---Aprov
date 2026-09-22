import { decodeJwt, createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import {
  SESSION_AUTHORIZATION_VERSION,
  SESSION_LEASE_VERSION,
  SESSION_SLOT_IDS,
  type WorkspaceSessionSlotId,
} from '../platformCapacity';
import { normalizePlatformEmail, normalizeUnitUg } from '../platformIdentity';

const FIREBASE_CUSTOM_TOKEN_AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
const E2E_EMULATORS = process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1';
const E2E_PROJECT_ID = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim() || '';
const PROJECT_ID = E2E_EMULATORS && E2E_PROJECT_ID
  ? E2E_PROJECT_ID
  : firebaseConfig.projectId;
const DATABASE_ID = E2E_EMULATORS
  ? '(default)'
  : firebaseConfig.firestoreDatabaseId;
const FIREBASE_ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const FIRESTORE_BASE = E2E_EMULATORS
  ? `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const PASSWORD_BOOTSTRAP_MAX_AGE_SECONDS = 5 * 60;

export interface WorkspaceSessionCredentialRequest {
  workspaceId: string;
  ug: string;
  slotId: WorkspaceSessionSlotId;
  sessionId: string;
  browserInstanceId: string;
}

export interface VerifiedFirebaseSectorIdentity {
  uid: string;
  email: string;
  provider: 'password' | 'custom';
  authTime: number;
  token: string;
  payload: JWTPayload;
}

export class SessionCredentialError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN'
      | 'INVALID_SESSION'
      | 'SESSION_REVOKED'
      | 'SESSION_EXPIRED'
      | 'SERVER_NOT_CONFIGURED',
    public readonly status: 400 | 401 | 403 | 409 | 503
  ) {
    super(message);
    this.name = 'SessionCredentialError';
  }
}

function readBearerToken(authorization: string | null): string {
  if (!authorization) {
    throw new SessionCredentialError('Token de autenticação ausente.', 'UNAUTHENTICATED', 401);
  }
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new SessionCredentialError('Token de autenticação inválido.', 'UNAUTHENTICATED', 401);
  }
  return token;
}

function readProvider(payload: JWTPayload): string {
  const firebaseClaim = payload.firebase;
  if (!firebaseClaim || typeof firebaseClaim !== 'object' || Array.isArray(firebaseClaim)) return '';
  const provider = (firebaseClaim as Record<string, unknown>).sign_in_provider;
  return typeof provider === 'string' ? provider : '';
}

function numericClaim(payload: JWTPayload, name: string): number {
  const value = payload[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringClaim(payload: JWTPayload, name: string): string {
  const value = payload[name];
  return typeof value === 'string' ? value : '';
}

function assertTokenEnvelope(payload: JWTPayload): void {
  if (payload.aud !== PROJECT_ID) {
    throw new SessionCredentialError('Token Firebase emitido para outro projeto.', 'UNAUTHENTICATED', 401);
  }
  if (payload.iss !== FIREBASE_ISSUER) {
    throw new SessionCredentialError('Emissor do token Firebase é inválido.', 'UNAUTHENTICATED', 401);
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new SessionCredentialError('Sessão Firebase expirada.', 'UNAUTHENTICATED', 401);
  }
}

export async function verifyFirebaseSectorRequest(
  authorization: string | null
): Promise<VerifiedFirebaseSectorIdentity> {
  const token = readBearerToken(authorization);

  let payload: JWTPayload;
  try {
    if (E2E_EMULATORS) {
      payload = decodeJwt(token);
      assertTokenEnvelope(payload);
    } else {
      ({ payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: PROJECT_ID,
        algorithms: ['RS256'],
      }));
    }
  } catch (error) {
    if (error instanceof SessionCredentialError) throw error;
    throw new SessionCredentialError(
      'Sessão Firebase inválida ou expirada.',
      'UNAUTHENTICATED',
      401
    );
  }

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string'
    ? normalizePlatformEmail(payload.email)
    : '';
  const emailVerified = payload.email_verified === true;
  const provider = readProvider(payload);

  if (!uid || !email || !emailVerified) {
    throw new SessionCredentialError(
      'A sessão Firebase não possui identidade verificada.',
      'FORBIDDEN',
      403
    );
  }
  if (provider !== 'password' && provider !== 'custom') {
    throw new SessionCredentialError(
      'Provedor de autenticação não autorizado para sessão operacional.',
      'FORBIDDEN',
      403
    );
  }

  return {
    uid,
    email,
    provider,
    authTime: numericClaim(payload, 'auth_time'),
    token,
    payload,
  };
}

function validateRequestedSession(
  identity: VerifiedFirebaseSectorIdentity,
  request: WorkspaceSessionCredentialRequest
): void {
  if (
    !request.workspaceId
    || !/^\d{6}$/.test(request.ug)
    || !SESSION_SLOT_IDS.includes(request.slotId)
    || request.sessionId.length <= 8
    || request.browserInstanceId.length <= 8
  ) {
    throw new SessionCredentialError(
      'Identidade operacional da sessão é inválida.',
      'INVALID_SESSION',
      400
    );
  }

  if (identity.provider === 'password') {
    const now = Math.floor(Date.now() / 1000);
    if (
      identity.authTime <= 0
      || identity.authTime > now + 60
      || now - identity.authTime > PASSWORD_BOOTSTRAP_MAX_AGE_SECONDS
    ) {
      throw new SessionCredentialError(
        'A autenticação inicial ficou antiga. Faça login novamente para abrir uma nova sessão.',
        'UNAUTHENTICATED',
        401
      );
    }
    return;
  }

  if (
    stringClaim(identity.payload, 'emprovexSessionVersion') !== SESSION_AUTHORIZATION_VERSION
    || stringClaim(identity.payload, 'emprovexSessionId') !== request.sessionId
    || stringClaim(identity.payload, 'emprovexBrowserInstanceId') !== request.browserInstanceId
    || stringClaim(identity.payload, 'emprovexWorkspaceId') !== request.workspaceId
    || normalizeUnitUg(stringClaim(identity.payload, 'emprovexUg')) !== request.ug
    || stringClaim(identity.payload, 'emprovexSourceProvider') !== 'password'
  ) {
    throw new SessionCredentialError(
      'A credencial atual não pode assumir outra sessão operacional.',
      'FORBIDDEN',
      403
    );
  }
}

type FirestoreRestValue = {
  stringValue?: string;
  timestampValue?: string;
};

interface FirestoreRestDocument {
  fields?: Record<string, FirestoreRestValue>;
  error?: { message?: string };
}

function restString(fields: Record<string, FirestoreRestValue>, key: string): string {
  return fields[key]?.stringValue || '';
}

function restTimestamp(fields: Record<string, FirestoreRestValue>, key: string): number {
  const value = fields[key]?.timestampValue || '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readFirestoreDocument(
  token: string,
  path: string
): Promise<{ exists: boolean; fields: Record<string, FirestoreRestValue> }> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${FIRESTORE_BASE}/${encodedPath}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (response.status === 404) return { exists: false, fields: {} };

  const payload = await response.json() as FirestoreRestDocument;
  if (!response.ok) {
    const permissionDenied = response.status === 401 || response.status === 403;
    throw new SessionCredentialError(
      permissionDenied
        ? 'A sessão não possui autorização para validar o lease operacional.'
        : payload.error?.message || 'Não foi possível validar o lease operacional.',
      permissionDenied ? 'FORBIDDEN' : 'INVALID_SESSION',
      permissionDenied ? 403 : 409
    );
  }

  return {
    exists: true,
    fields: payload.fields || {},
  };
}

async function assertActiveSessionLease(
  identity: VerifiedFirebaseSectorIdentity,
  request: WorkspaceSessionCredentialRequest
): Promise<void> {
  const [slot, revocation] = await Promise.all([
    readFirestoreDocument(
      identity.token,
      `workspaces/${request.workspaceId}/sessionSlots/${request.slotId}`
    ),
    readFirestoreDocument(
      identity.token,
      `workspaces/${request.workspaceId}/sessionRevocations/${request.sessionId}`
    ),
  ]);

  if (revocation.exists) {
    throw new SessionCredentialError(
      'Esta sessão foi encerrada pela administração. Faça login novamente.',
      'SESSION_REVOKED',
      403
    );
  }

  if (!slot.exists) {
    throw new SessionCredentialError(
      'A vaga desta sessão não está mais ativa.',
      'INVALID_SESSION',
      409
    );
  }

  const fields = slot.fields;
  if (
    restString(fields, 'leaseVersion') !== SESSION_LEASE_VERSION
    || restString(fields, 'slotId') !== request.slotId
    || restString(fields, 'sessionId') !== request.sessionId
    || restString(fields, 'workspaceId') !== request.workspaceId
    || normalizeUnitUg(restString(fields, 'ug')) !== request.ug
    || restString(fields, 'uid') !== identity.uid
    || normalizePlatformEmail(restString(fields, 'accountEmail')) !== identity.email
    || restString(fields, 'browserInstanceId') !== request.browserInstanceId
  ) {
    throw new SessionCredentialError(
      'O lease ativo não corresponde à identidade apresentada.',
      'INVALID_SESSION',
      409
    );
  }

  if (restTimestamp(fields, 'expiresAt') <= Date.now()) {
    throw new SessionCredentialError(
      'O lease desta sessão expirou.',
      'SESSION_EXPIRED',
      409
    );
  }
}

interface ServiceAccountCredentials {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function parseServiceAccount(): { clientEmail: string; privateKey: string } {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new SessionCredentialError(
      'A assinatura server-side de sessões não está configurada.',
      'SERVER_NOT_CONFIGURED',
      503
    );
  }

  let parsed: ServiceAccountCredentials;
  try {
    parsed = JSON.parse(raw) as ServiceAccountCredentials;
  } catch {
    throw new SessionCredentialError(
      'A credencial administrativa do Firebase possui JSON inválido.',
      'SERVER_NOT_CONFIGURED',
      503
    );
  }

  const clientEmail = parsed.client_email?.trim() || '';
  const privateKey = parsed.private_key?.replace(/\\n/g, '\n').trim() || '';
  if (!clientEmail || !privateKey || (parsed.project_id && parsed.project_id !== PROJECT_ID)) {
    throw new SessionCredentialError(
      'A credencial administrativa do Firebase está incompleta ou pertence a outro projeto.',
      'SERVER_NOT_CONFIGURED',
      503
    );
  }

  return { clientEmail, privateKey };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

async function createSessionCustomToken(
  identity: VerifiedFirebaseSectorIdentity,
  request: WorkspaceSessionCredentialRequest
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    emprovexSessionVersion: SESSION_AUTHORIZATION_VERSION,
    emprovexSessionId: request.sessionId,
    emprovexSessionSlotId: request.slotId,
    emprovexBrowserInstanceId: request.browserInstanceId,
    emprovexWorkspaceId: request.workspaceId,
    emprovexUg: request.ug,
    emprovexSourceProvider: 'password',
  };

  if (E2E_EMULATORS) {
    const header = base64UrlJson({ alg: 'none', typ: 'JWT' });
    const payload = base64UrlJson({
      iss: 'emprovex-e2e@example.test',
      sub: 'emprovex-e2e@example.test',
      aud: FIREBASE_CUSTOM_TOKEN_AUDIENCE,
      iat: now,
      exp: now + 3600,
      uid: identity.uid,
      claims,
    });
    return `${header}.${payload}.`;
  }

  const credentials = parseServiceAccount();
  const privateKey = await importPKCS8(credentials.privateKey, 'RS256');

  return new SignJWT({
    uid: identity.uid,
    claims,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.clientEmail)
    .setSubject(credentials.clientEmail)
    .setAudience(FIREBASE_CUSTOM_TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}

export async function issueWorkspaceSessionCredential(
  authorization: string | null,
  request: WorkspaceSessionCredentialRequest
): Promise<{
  customToken: string;
  sessionVersion: typeof SESSION_AUTHORIZATION_VERSION;
  sessionId: string;
  slotId: WorkspaceSessionSlotId;
}> {
  const identity = await verifyFirebaseSectorRequest(authorization);
  validateRequestedSession(identity, request);
  await assertActiveSessionLease(identity, request);
  const customToken = await createSessionCustomToken(identity, request);

  return {
    customToken,
    sessionVersion: SESSION_AUTHORIZATION_VERSION,
    sessionId: request.sessionId,
    slotId: request.slotId,
  };
}
