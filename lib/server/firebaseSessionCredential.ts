import { randomUUID } from 'node:crypto';

import { decodeJwt, createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import {
  SESSION_AUTHORIZATION_VERSION,
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

export interface WorkspaceSessionCredentialRequest {
  workspaceId: string;
  ug: string;
}

export interface WorkspaceSessionCredentialIdentity {
  workspaceId: string;
  ug: string;
  slotId: WorkspaceSessionSlotId;
  sessionId: string;
  browserInstanceId: string;
}

export interface VerifiedFirebaseSectorIdentity {
  uid: string;
  email: string;
  provider: 'password';
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
      | 'SESSION_CAPACITY_EXCEEDED'
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

function assertTokenEnvelope(payload: JWTPayload): void {
  if (payload.aud !== PROJECT_ID) {
    throw new SessionCredentialError('Token Firebase emitido para outro projeto.', 'UNAUTHENTICATED', 401);
  }
  if (payload.iss !== FIREBASE_ISSUER) {
    throw new SessionCredentialError('Emissor do token Firebase é inválido.', 'UNAUTHENTICATED', 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof payload.exp !== 'number'
    || payload.exp <= now
    || (typeof payload.iat === 'number' && payload.iat > now + 60)
  ) {
    throw new SessionCredentialError('Sessão Firebase inválida ou expirada.', 'UNAUTHENTICATED', 401);
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
        clockTolerance: 60,
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
  if (provider !== 'password') {
    throw new SessionCredentialError(
      'Somente o login inicial por e-mail e senha pode abrir uma nova sessão operacional.',
      'FORBIDDEN',
      403
    );
  }

  return {
    uid,
    email,
    provider: 'password',
    token,
    payload,
  };
}

function validateRequestedWorkspace(request: WorkspaceSessionCredentialRequest): void {
  if (
    !request
    || typeof request.workspaceId !== 'string'
    || request.workspaceId.length === 0
    || typeof request.ug !== 'string'
    || !/^\d{6}$/.test(request.ug)
  ) {
    throw new SessionCredentialError(
      'Workspace/UG da sessão operacional são inválidos.',
      'INVALID_SESSION',
      400
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
        ? 'A identidade não possui autorização para abrir esta sessão operacional.'
        : payload.error?.message || 'Não foi possível consultar a capacidade de sessões.',
      permissionDenied ? 'FORBIDDEN' : 'INVALID_SESSION',
      permissionDenied ? 403 : 409
    );
  }

  return {
    exists: true,
    fields: payload.fields || {},
  };
}

async function resolveBootstrapIdentity(
  identity: VerifiedFirebaseSectorIdentity,
  request: WorkspaceSessionCredentialRequest
): Promise<WorkspaceSessionCredentialIdentity> {
  const accountPath = `platformAccounts/${identity.email}`;
  const workspacePath = `workspaces/${request.workspaceId}`;
  const slotPaths = SESSION_SLOT_IDS.map(
    (slotId) => `workspaces/${request.workspaceId}/sessionSlots/${slotId}`
  );

  const [account, workspace, ...slots] = await Promise.all([
    readFirestoreDocument(identity.token, accountPath),
    readFirestoreDocument(identity.token, workspacePath),
    ...slotPaths.map((path) => readFirestoreDocument(identity.token, path)),
  ]);

  if (!account.exists || !workspace.exists) {
    throw new SessionCredentialError(
      'Conta ou workspace operacional não estão disponíveis.',
      'FORBIDDEN',
      403
    );
  }

  const accountFields = account.fields;
  const workspaceFields = workspace.fields;
  const accountProvider = restString(accountFields, 'authProvider') || 'password';
  const accountUg = normalizeUnitUg(restString(accountFields, 'ug'));
  const workspaceUg = normalizeUnitUg(restString(workspaceFields, 'ug'));

  if (
    restString(accountFields, 'accountType') !== 'sector'
    || restString(accountFields, 'status') !== 'active'
    || restString(accountFields, 'email') !== identity.email
    || restString(accountFields, 'workspaceId') !== request.workspaceId
    || restString(accountFields, 'firebaseUid') !== identity.uid
    || accountProvider !== 'password'
    || accountUg !== request.ug
    || restString(workspaceFields, 'id') !== request.workspaceId
    || restString(workspaceFields, 'status') !== 'active'
    || restString(workspaceFields, 'authorizedEmail') !== identity.email
    || workspaceUg !== request.ug
  ) {
    throw new SessionCredentialError(
      'Conta, UID, workspace ou UG não correspondem à identidade autenticada.',
      'FORBIDDEN',
      403
    );
  }

  const now = Date.now();
  const availableIndex = slots.findIndex((slot) => {
    if (!slot.exists) return true;
    const expiresAt = restTimestamp(slot.fields, 'expiresAt');
    return expiresAt > 0 && expiresAt <= now;
  });

  if (availableIndex < 0) {
    throw new SessionCredentialError(
      'Limite de acessos simultâneos atingido. Encerre uma das sessões ativas para continuar.',
      'SESSION_CAPACITY_EXCEEDED',
      409
    );
  }

  return {
    workspaceId: request.workspaceId,
    ug: request.ug,
    slotId: SESSION_SLOT_IDS[availableIndex],
    sessionId: `session-${randomUUID()}`,
    browserInstanceId: `browser-${randomUUID()}`,
  };
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
  session: WorkspaceSessionCredentialIdentity
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    emprovexSessionVersion: SESSION_AUTHORIZATION_VERSION,
    emprovexSessionId: session.sessionId,
    emprovexSessionSlotId: session.slotId,
    emprovexBrowserInstanceId: session.browserInstanceId,
    emprovexWorkspaceId: session.workspaceId,
    emprovexUg: session.ug,
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
  slotId: WorkspaceSessionSlotId;
  sessionId: string;
  browserInstanceId: string;
}> {
  const identity = await verifyFirebaseSectorRequest(authorization);
  validateRequestedWorkspace(request);

  // O servidor escolhe somente um slot ausente/expirado e gera a identidade
  // lógica. Um token password jamais pode pedir ou adotar sessionId/slot de outra
  // sessão legítima do mesmo UID.
  const session = await resolveBootstrapIdentity(identity, request);
  const customToken = await createSessionCustomToken(identity, session);

  return {
    customToken,
    sessionVersion: SESSION_AUTHORIZATION_VERSION,
    slotId: session.slotId,
    sessionId: session.sessionId,
    browserInstanceId: session.browserInstanceId,
  };
}
