import { createHash, randomUUID } from 'node:crypto';

import { SignJWT, decodeJwt, importPKCS8 } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import { buildInitialBillingAccount } from '../billing';
import { HGESM_SECTOR_EMAIL, HGESM_UG, HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import {
  FOUNDER_AUTH_PROVIDER,
  isValidPlatformEmail,
  isValidUnitUg,
  isValidWorkspaceId,
  normalizePlatformEmail,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import {
  buildProvisionedSectorRecords,
  MAX_SECTOR_PASSWORD_LENGTH,
  MIN_SECTOR_PASSWORD_LENGTH,
  validateSectorProvisioningInput,
  type CreateSectorWorkspaceInput,
  type SectorProvisioningResult,
} from '../sectorProvisioning';
import {
  createInitialWorkspaceTermCounter,
  WORKSPACE_TERM_COUNTER_SETTINGS_ID,
} from '../workspaceProvisioning';

type FailureCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'SERVER_CONFIGURATION'
  | 'UPSTREAM_ERROR'
  | 'RECOVERY_REQUIRED';

export class SectorProvisioningFailure extends Error {
  constructor(
    message: string,
    public readonly code: FailureCode,
    public readonly httpStatus: number,
    public readonly recoveryRequired = false
  ) {
    super(message);
    this.name = 'SectorProvisioningFailure';
  }
}

interface ServiceAccountCredentials {
  project_id?: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface GoogleApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface IdentityToolkitUser {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  providerUserInfo?: Array<{ providerId?: string }>;
}

interface FounderSession {
  uid: string;
  email: string;
}

export interface SectorDeletionResult {
  workspaceId: string;
  email: string;
  firebaseAuthDeleted: boolean;
}

export interface SectorPasswordResetResult {
  workspaceId: string;
  email: string;
  firebaseUid: string;
}

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

interface ProvisioningLockState {
  operationId: string;
  workspaceId: string;
  ug: string;
  email: string;
  phase: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  firebaseUid?: string;
  authUserReused?: boolean;
  recoveryRequired?: boolean;
  failureCode?: string;
}

const PROJECT_ID = firebaseConfig.projectId;
const API_KEY = firebaseConfig.apiKey;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId;
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

let accessTokenCache: AccessTokenCache | null = null;

function parseServiceAccountCredentials(): ServiceAccountCredentials {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();

  if (!raw) {
    throw new SectorProvisioningFailure(
      'O provisionamento seguro ainda não está configurado no servidor.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  let parsed: Partial<ServiceAccountCredentials>;
  try {
    parsed = JSON.parse(raw) as Partial<ServiceAccountCredentials>;
  } catch {
    throw new SectorProvisioningFailure(
      'A credencial administrativa do Firebase está inválida no servidor.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  const clientEmail = parsed.client_email?.trim();
  const privateKey = parsed.private_key?.replace(/\\n/g, '\n').trim();

  if (!clientEmail || !privateKey) {
    throw new SectorProvisioningFailure(
      'A credencial administrativa do Firebase está incompleta no servidor.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  if (parsed.project_id && parsed.project_id !== PROJECT_ID) {
    throw new SectorProvisioningFailure(
      'A credencial administrativa pertence a outro projeto Firebase.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  return {
    project_id: parsed.project_id,
    client_email: clientEmail,
    private_key: privateKey,
    token_uri: parsed.token_uri || TOKEN_URI,
  };
}

async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAt - 60_000 > now) {
    return accessTokenCache.token;
  }

  const serviceAccount = parseServiceAccountCredentials();
  const tokenUri = serviceAccount.token_uri || TOKEN_URI;
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');
  const issuedAt = Math.floor(now / 1000);

  const assertion = await new SignJWT({ scope: CLOUD_PLATFORM_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 3600)
    .sign(privateKey);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  const payload = await readJson<Record<string, unknown>>(response);
  const token = typeof payload.access_token === 'string' ? payload.access_token : '';
  const expiresIn = Number(payload.expires_in || 3600);

  if (!response.ok || !token) {
    throw new SectorProvisioningFailure(
      'Não foi possível autorizar o serviço administrativo do Firebase.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  accessTokenCache = {
    token,
    expiresAt: now + Math.max(300, expiresIn) * 1000,
  };

  return token;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function googleErrorMessage(payload: GoogleApiErrorPayload): string {
  return payload.error?.message || payload.error?.status || 'GOOGLE_API_ERROR';
}

async function identityToolkitAdminRequest<T>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}${separator}key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  );

  const payload = await readJson<T & GoogleApiErrorPayload>(response);
  if (!response.ok) {
    const error = new Error(googleErrorMessage(payload));
    error.name = 'IdentityToolkitAdminError';
    throw error;
  }

  return payload;
}

export async function verifyFounderSession(idToken: string): Promise<FounderSession> {
  if (!idToken.trim()) {
    throw new SectorProvisioningFailure('Sessão administrativa ausente.', 'UNAUTHORIZED', 401);
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  );

  const payload = await readJson<{ users?: IdentityToolkitUser[] } & GoogleApiErrorPayload>(response);
  const user = payload.users?.[0];

  if (!response.ok || !user?.localId || !user.email) {
    throw new SectorProvisioningFailure('Sessão administrativa inválida.', 'UNAUTHORIZED', 401);
  }

  let tokenClaims: ReturnType<typeof decodeJwt>;
  try {
    tokenClaims = decodeJwt(idToken);
  } catch {
    throw new SectorProvisioningFailure('Sessão administrativa inválida.', 'UNAUTHORIZED', 401);
  }

  const firebaseClaim = tokenClaims.firebase as { sign_in_provider?: string } | undefined;
  const normalizedEmail = normalizePlatformEmail(user.email);
  const expectedIssuer = `https://securetoken.google.com/${PROJECT_ID}`;

  if (
    tokenClaims.aud !== PROJECT_ID
    || tokenClaims.iss !== expectedIssuer
    || tokenClaims.sub !== user.localId
    || normalizedEmail !== HGESM_SECTOR_EMAIL
    || user.emailVerified !== true
    || user.disabled === true
    || firebaseClaim?.sign_in_provider !== FOUNDER_AUTH_PROVIDER
  ) {
    throw new SectorProvisioningFailure(
      'A sessão atual não possui permissão administrativa para provisionar setores.',
      'FORBIDDEN',
      403
    );
  }

  return {
    uid: user.localId,
    email: normalizedEmail,
  };
}

async function lookupAuthUserByEmail(
  accessToken: string,
  email: string
): Promise<IdentityToolkitUser | null> {
  try {
    const payload = await identityToolkitAdminRequest<{ users?: IdentityToolkitUser[] }>(
      `projects/${encodeURIComponent(PROJECT_ID)}/accounts:lookup`,
      accessToken,
      { email: [email] }
    );
    return payload.users?.[0] || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('USER_NOT_FOUND')) return null;
    throw error;
  }
}

async function createAuthUser(
  accessToken: string,
  input: CreateSectorWorkspaceInput
): Promise<IdentityToolkitUser> {
  return identityToolkitAdminRequest<IdentityToolkitUser>(
    `projects/${encodeURIComponent(PROJECT_ID)}/accounts`,
    accessToken,
    {
      email: normalizePlatformEmail(input.authorizedEmail),
      password: input.initialPassword,
      emailVerified: true,
      disabled: false,
      displayName: input.workspaceName.trim(),
    }
  );
}

async function updateExistingAuthUserForPassword(
  accessToken: string,
  user: IdentityToolkitUser,
  input: CreateSectorWorkspaceInput
): Promise<void> {
  await identityToolkitAdminRequest<IdentityToolkitUser>(
    `projects/${encodeURIComponent(PROJECT_ID)}/accounts:update`,
    accessToken,
    {
      localId: user.localId,
      password: input.initialPassword,
      emailVerified: true,
      disableUser: false,
    }
  );
}

async function deleteAuthUser(accessToken: string, uid: string): Promise<void> {
  await identityToolkitAdminRequest<Record<string, never>>(
    `projects/${encodeURIComponent(PROJECT_ID)}/accounts:delete`,
    accessToken,
    { localId: uid }
  );
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: 'NULL_VALUE' }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: toFirestoreFields(value as Record<string, unknown>),
      },
    };
  }

  throw new Error('Valor não suportado pelo encoder Firestore do provisionamento.');
}

function toFirestoreFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, toFirestoreValue(fieldValue)])
  );
}

function firestoreDocumentName(path: string): string {
  return `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${path}`;
}

interface FirestoreWrite {
  update?: {
    name: string;
    fields: Record<string, FirestoreValue>;
  };
  delete?: string;
  currentDocument?: {
    exists?: boolean;
  };
}

async function commitFirestoreWrites(
  accessToken: string,
  writes: FirestoreWrite[]
): Promise<void> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents:commit`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ writes }),
      cache: 'no-store',
    }
  );

  const payload = await readJson<GoogleApiErrorPayload>(response);
  if (!response.ok) {
    const message = googleErrorMessage(payload);
    const error = new Error(message);
    error.name = 'FirestoreAdminError';
    throw error;
  }
}

interface ServerPlatformAuditInput {
  operation:
    | 'sector.create'
    | 'sector.password_reset'
    | 'sector.delete';
  workspaceId: string;
  ug?: string | null;
  correlationId: string;
  actor: FounderSession;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function serverPlatformAuditWrite(input: ServerPlatformAuditInput): FirestoreWrite {
  const eventId = randomUUID();
  return {
    update: {
      name: firestoreDocumentName(`platformAuditEvents/${eventId}`),
      fields: toFirestoreFields({
        eventVersion: 'emprovex_audit_v1',
        eventId,
        workspaceId: input.workspaceId,
        ug: input.ug || null,
        operation: input.operation,
        source: 'admin',
        entityType: 'workspace',
        entityId: input.workspaceId,
        correlationId: input.correlationId,
        actorUid: input.actor.uid,
        actorEmail: input.actor.email,
        before: input.before || {},
        after: input.after || {},
        metadata: input.metadata || {},
        createdAt: new Date(),
      }),
    },
    currentDocument: { exists: false },
  };
}

async function appendServerPlatformAuditEvent(
  accessToken: string,
  input: ServerPlatformAuditInput
): Promise<void> {
  await commitFirestoreWrites(accessToken, [serverPlatformAuditWrite(input)]);
}

interface FirestoreDocumentPayload {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

function encodeFirestoreDocumentPath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function firestoreStringField(
  fields: Record<string, FirestoreValue> | undefined,
  key: string
): string {
  const value = fields?.[key];
  return value && 'stringValue' in value ? value.stringValue : '';
}

async function readFirestoreDocument(
  accessToken: string,
  path: string
): Promise<FirestoreDocumentPayload | null> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents/${encodeFirestoreDocumentPath(path)}`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );

  if (response.status === 404) return null;

  const payload = await readJson<FirestoreDocumentPayload & GoogleApiErrorPayload>(response);
  if (!response.ok) {
    const error = new Error(googleErrorMessage(payload));
    error.name = 'FirestoreAdminError';
    throw error;
  }

  return payload;
}

async function listFirestoreCollectionIds(
  accessToken: string,
  documentPath: string
): Promise<string[]> {
  const collectionIds: string[] = [];
  let pageToken = '';

  do {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents/${encodeFirestoreDocumentPath(documentPath)}:listCollectionIds`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          pageSize: 1000,
          ...(pageToken ? { pageToken } : {}),
        }),
        cache: 'no-store',
      }
    );

    const payload = await readJson<{
      collectionIds?: string[];
      nextPageToken?: string;
    } & GoogleApiErrorPayload>(response);

    if (response.status === 404) return collectionIds;
    if (!response.ok) {
      const error = new Error(googleErrorMessage(payload));
      error.name = 'FirestoreAdminError';
      throw error;
    }

    collectionIds.push(...(payload.collectionIds || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  return collectionIds;
}

async function listFirestoreDocuments(
  accessToken: string,
  parentDocumentPath: string,
  collectionId: string
): Promise<string[]> {
  const documentPaths: string[] = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents/${encodeFirestoreDocumentPath(parentDocumentPath)}/${encodeURIComponent(collectionId)}?${params.toString()}`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    const payload = await readJson<{
      documents?: FirestoreDocumentPayload[];
      nextPageToken?: string;
    } & GoogleApiErrorPayload>(response);

    if (response.status === 404) return documentPaths;
    if (!response.ok) {
      const error = new Error(googleErrorMessage(payload));
      error.name = 'FirestoreAdminError';
      throw error;
    }

    for (const document of payload.documents || []) {
      const marker = '/documents/';
      const markerIndex = document.name?.indexOf(marker) ?? -1;
      if (markerIndex >= 0 && document.name) {
        documentPaths.push(document.name.slice(markerIndex + marker.length));
      }
    }

    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  return documentPaths;
}

async function deleteFirestoreDocumentTree(
  accessToken: string,
  documentPath: string
): Promise<void> {
  const childCollections = await listFirestoreCollectionIds(accessToken, documentPath);

  for (const collectionId of childCollections) {
    const childDocuments = await listFirestoreDocuments(
      accessToken,
      documentPath,
      collectionId
    );

    for (const childDocumentPath of childDocuments) {
      await deleteFirestoreDocumentTree(accessToken, childDocumentPath);
    }
  }

  await commitFirestoreWrites(accessToken, [
    { delete: firestoreDocumentName(documentPath) },
  ]);
}

function lockDocumentIds(email: string, workspaceId: string, ug?: string): string[] {
  const emailHash = createHash('sha256').update(email).digest('hex');
  return [
    `platformProvisioningLocks/email-${emailHash}`,
    `platformProvisioningLocks/workspace-${workspaceId}`,
    ...(isValidUnitUg(ug) ? [`platformProvisioningLocks/ug-${normalizeUnitUg(ug)}`] : []),
  ];
}

function lockWrites(
  lockPaths: string[],
  state: ProvisioningLockState,
  createOnly = false
): FirestoreWrite[] {
  return lockPaths.map((path) => ({
    update: {
      name: firestoreDocumentName(path),
      fields: toFirestoreFields(state as unknown as Record<string, unknown>),
    },
    ...(createOnly ? { currentDocument: { exists: false } } : {}),
  }));
}

async function acquireProvisioningLocks(
  accessToken: string,
  state: ProvisioningLockState
): Promise<string[]> {
  const paths = lockDocumentIds(state.email, state.workspaceId, state.ug);
  try {
    await commitFirestoreWrites(accessToken, lockWrites(paths, state, true));
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('ALREADY_EXISTS') || message.includes('FAILED_PRECONDITION')) {
      throw new SectorProvisioningFailure(
        'Já existe um provisionamento em andamento para este e-mail ou identificador de setor.',
        'CONFLICT',
        409
      );
    }
    throw error;
  }
  return paths;
}

async function updateProvisioningLocks(
  accessToken: string,
  lockPaths: string[],
  state: ProvisioningLockState
): Promise<void> {
  await commitFirestoreWrites(accessToken, lockWrites(lockPaths, state));
}

async function releaseProvisioningLocks(
  accessToken: string,
  lockPaths: string[]
): Promise<void> {
  await commitFirestoreWrites(
    accessToken,
    lockPaths.map((path) => ({ delete: firestoreDocumentName(path) }))
  );
}

async function createSectorDirectory(
  accessToken: string,
  result: Pick<SectorProvisioningResult, 'workspace' | 'account'>,
  founder: FounderSession,
  correlationId: string,
  grantTrial: boolean
): Promise<void> {
  const termCounter = createInitialWorkspaceTermCounter();
  const workspacePath = `workspaces/${result.workspace.id}`;
  const accountPath = `platformAccounts/${result.account.email}`;
  const counterPath = `workspaces/${result.workspace.id}/settings/${WORKSPACE_TERM_COUNTER_SETTINGS_ID}`;
  const ug = normalizeUnitUg(result.workspace.ug);
  if (!isValidUnitUg(ug) || ug !== normalizeUnitUg(result.account.ug)) {
    throw new SectorProvisioningFailure(
      'A UG do workspace e da conta operacional precisa ser válida e idêntica.',
      'INVALID_INPUT',
      400
    );
  }
  const ugIndexPath = `platformUgIndex/${ug}`;
  const billingPath = `billingAccounts/${result.workspace.id}`;
  const billingAccount = buildInitialBillingAccount(
    result.workspace,
    founder.email,
    grantTrial
  );

  try {
    await commitFirestoreWrites(accessToken, [
      {
        update: {
          name: firestoreDocumentName(workspacePath),
          fields: toFirestoreFields(result.workspace as unknown as Record<string, unknown>),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: firestoreDocumentName(accountPath),
          fields: toFirestoreFields(result.account as unknown as Record<string, unknown>),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: firestoreDocumentName(counterPath),
          fields: toFirestoreFields(termCounter as unknown as Record<string, unknown>),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: firestoreDocumentName(ugIndexPath),
          fields: toFirestoreFields({
            ug,
            workspaceId: result.workspace.id,
            email: result.account.email,
            createdAt: result.workspace.createdAt,
            createdBy: result.workspace.createdBy,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: firestoreDocumentName(billingPath),
          fields: toFirestoreFields(billingAccount as unknown as Record<string, unknown>),
        },
        currentDocument: { exists: false },
      },
      serverPlatformAuditWrite({
        operation: 'sector.create',
        workspaceId: result.workspace.id,
        ug,
        correlationId,
        actor: founder,
        before: {},
        after: {
          email: result.account.email,
          ug,
          status: result.workspace.status,
          firebaseUid: result.account.firebaseUid || null,
        },
        metadata: {
          authProvider: result.account.authProvider || 'password',
          grantTrial,
          billingMode: 'observe',
        },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('ALREADY_EXISTS') || message.includes('FAILED_PRECONDITION')) {
      throw new SectorProvisioningFailure(
        'Já existe um setor, conta operacional ou configuração residual com estes dados.',
        'CONFLICT',
        409
      );
    }
    throw error;
  }
}

async function deleteSectorDirectory(
  accessToken: string,
  workspaceId: string,
  email: string,
  ug?: string
): Promise<void> {
  const normalizedUg = normalizeUnitUg(ug);
  await commitFirestoreWrites(accessToken, [
    { delete: firestoreDocumentName(`workspaces/${workspaceId}/settings/${WORKSPACE_TERM_COUNTER_SETTINGS_ID}`) },
    { delete: firestoreDocumentName(`workspaces/${workspaceId}/sessionSlots/slot-1`) },
    { delete: firestoreDocumentName(`workspaces/${workspaceId}/sessionSlots/slot-2`) },
    { delete: firestoreDocumentName(`platformAccounts/${email}`) },
    { delete: firestoreDocumentName(`billingAccounts/${workspaceId}`) },
    { delete: firestoreDocumentName(`workspaces/${workspaceId}`) },
    ...(isValidUnitUg(normalizedUg)
      ? [{ delete: firestoreDocumentName(`platformUgIndex/${normalizedUg}`) }]
      : []),
  ]);
}

function normalizeProvisioningError(
  error: unknown,
  recoveryRequired = false
): SectorProvisioningFailure {
  if (error instanceof SectorProvisioningFailure) {
    if (!recoveryRequired || error.recoveryRequired) return error;
    return new SectorProvisioningFailure(error.message, 'RECOVERY_REQUIRED', 500, true);
  }

  const message = error instanceof Error ? error.message : '';
  const configurationIssue =
    message.includes('PERMISSION_DENIED')
    || message.includes('SERVICE_DISABLED')
    || message.includes('IAM_PERMISSION_DENIED')
    || message.includes('invalid_grant');

  if (recoveryRequired) {
    return new SectorProvisioningFailure(
      'O provisionamento ficou em estado de recuperação e exige revisão administrativa.',
      'RECOVERY_REQUIRED',
      500,
      true
    );
  }

  if (configurationIssue) {
    return new SectorProvisioningFailure(
      'O serviço administrativo do Firebase não possui as permissões necessárias para provisionar o setor.',
      'SERVER_CONFIGURATION',
      503
    );
  }

  return new SectorProvisioningFailure(
    'Não foi possível concluir o provisionamento seguro do setor.',
    'UPSTREAM_ERROR',
    502
  );
}

export async function resetSectorPasswordWithAuth(
  workspaceIdInput: string,
  emailInput: string,
  newPassword: string,
  founder: FounderSession
): Promise<SectorPasswordResetResult> {
  const workspaceId = normalizeWorkspaceId(workspaceIdInput);
  const email = normalizePlatformEmail(emailInput);

  if (
    !isValidWorkspaceId(workspaceId)
    || !isValidPlatformEmail(email)
    || newPassword.length < MIN_SECTOR_PASSWORD_LENGTH
    || newPassword.length > MAX_SECTOR_PASSWORD_LENGTH
  ) {
    throw new SectorProvisioningFailure(
      `A nova senha deve possuir entre ${MIN_SECTOR_PASSWORD_LENGTH} e ${MAX_SECTOR_PASSWORD_LENGTH} caracteres.`,
      'INVALID_INPUT',
      400
    );
  }

  if (workspaceId === HGESM_WORKSPACE_ID || email === HGESM_SECTOR_EMAIL) {
    throw new SectorProvisioningFailure(
      'A credencial do workspace fundador do HGeSM não pode ser alterada por este fluxo.',
      'FORBIDDEN',
      403
    );
  }

  if (founder.email !== HGESM_SECTOR_EMAIL) {
    throw new SectorProvisioningFailure(
      'A sessão atual não possui permissão administrativa para redefinir credenciais.',
      'FORBIDDEN',
      403
    );
  }

  const accessToken = await getGoogleAccessToken();
  const workspaceDocument = await readFirestoreDocument(
    accessToken,
    `workspaces/${workspaceId}`
  );
  const accountDocument = await readFirestoreDocument(
    accessToken,
    `platformAccounts/${email}`
  );

  if (!workspaceDocument || !accountDocument) {
    throw new SectorProvisioningFailure(
      'O diretório do setor está incompleto e precisa ser revisado antes da redefinição de senha.',
      'CONFLICT',
      409
    );
  }

  const workspaceEmail = normalizePlatformEmail(
    firestoreStringField(workspaceDocument.fields, 'authorizedEmail')
  );
  const accountEmail = normalizePlatformEmail(
    firestoreStringField(accountDocument.fields, 'email')
  );
  const accountWorkspaceId = normalizeWorkspaceId(
    firestoreStringField(accountDocument.fields, 'workspaceId')
  );
  const accountType = firestoreStringField(accountDocument.fields, 'accountType');
  const boundUid = firestoreStringField(accountDocument.fields, 'firebaseUid');

  if (
    workspaceEmail !== email
    || accountEmail !== email
    || accountWorkspaceId !== workspaceId
    || accountType !== 'sector'
  ) {
    throw new SectorProvisioningFailure(
      'O vínculo entre a conta e o workspace não é consistente.',
      'CONFLICT',
      409
    );
  }

  const authUser = await lookupAuthUserByEmail(accessToken, email);
  if (!authUser?.localId) {
    throw new SectorProvisioningFailure(
      'A identidade Firebase deste setor não foi localizada.',
      'CONFLICT',
      409
    );
  }

  if (boundUid && boundUid !== authUser.localId) {
    throw new SectorProvisioningFailure(
      'O UID do Firebase diverge do vínculo registrado no diretório do setor.',
      'CONFLICT',
      409
    );
  }

  await identityToolkitAdminRequest<IdentityToolkitUser>(
    `projects/${encodeURIComponent(PROJECT_ID)}/accounts:update`,
    accessToken,
    {
      localId: authUser.localId,
      password: newPassword,
      emailVerified: true,
      disableUser: false,
    }
  );

  await appendServerPlatformAuditEvent(accessToken, {
    operation: 'sector.password_reset',
    workspaceId,
    ug: normalizeUnitUg(firestoreStringField(workspaceDocument.fields, 'ug')) || null,
    correlationId: randomUUID(),
    actor: founder,
    before: {
      credentialState: 'existing',
    },
    after: {
      credentialState: 'password-reset',
    },
    metadata: {
      email,
      firebaseUid: authUser.localId,
    },
  });

  return {
    workspaceId,
    email,
    firebaseUid: authUser.localId,
  };
}

export async function deleteSectorWorkspaceWithAuth(
  workspaceIdInput: string,
  emailInput: string,
  founder: FounderSession
): Promise<SectorDeletionResult> {
  const workspaceId = normalizeWorkspaceId(workspaceIdInput);
  const email = normalizePlatformEmail(emailInput);

  if (!isValidWorkspaceId(workspaceId) || !isValidPlatformEmail(email)) {
    throw new SectorProvisioningFailure(
      'Os dados do setor informados para exclusão são inválidos.',
      'INVALID_INPUT',
      400
    );
  }

  if (workspaceId === HGESM_WORKSPACE_ID || email === HGESM_SECTOR_EMAIL) {
    throw new SectorProvisioningFailure(
      'O workspace fundador do HGeSM não pode ser excluído.',
      'FORBIDDEN',
      403
    );
  }

  if (founder.email !== HGESM_SECTOR_EMAIL) {
    throw new SectorProvisioningFailure(
      'A sessão atual não possui permissão administrativa para excluir setores.',
      'FORBIDDEN',
      403
    );
  }

  const accessToken = await getGoogleAccessToken();
  const deletionCorrelationId = randomUUID();
  const workspacePath = `workspaces/${workspaceId}`;
  const accountPath = `platformAccounts/${email}`;

  const baseLockPaths = lockDocumentIds(email, workspaceId);
  const [workspaceDocument, accountDocument, emailLockDocument, workspaceLockDocument] = await Promise.all([
    readFirestoreDocument(accessToken, workspacePath),
    readFirestoreDocument(accessToken, accountPath),
    readFirestoreDocument(accessToken, baseLockPaths[0]),
    readFirestoreDocument(accessToken, baseLockPaths[1]),
  ]);

  const workspaceUg = normalizeUnitUg(
    firestoreStringField(workspaceDocument?.fields, 'ug')
  );
  const accountUg = normalizeUnitUg(
    firestoreStringField(accountDocument?.fields, 'ug')
  );
  if (workspaceUg && accountUg && workspaceUg !== accountUg) {
    throw new SectorProvisioningFailure(
      'A UG do workspace diverge da UG da conta operacional. Revise a identidade antes da exclusão.',
      'CONFLICT',
      409
    );
  }
  const storedUg = workspaceUg || accountUg;
  const lockPaths = lockDocumentIds(email, workspaceId, storedUg);

  if (!workspaceDocument && !accountDocument && !emailLockDocument && !workspaceLockDocument) {
    throw new SectorProvisioningFailure(
      'Não existe cadastro ou resíduo de provisionamento correspondente a este setor.',
      'CONFLICT',
      409
    );
  }

  if (workspaceDocument) {
    const storedEmail = normalizePlatformEmail(
      firestoreStringField(workspaceDocument.fields, 'authorizedEmail')
    );
    if (storedEmail && storedEmail !== email) {
      throw new SectorProvisioningFailure(
        'O e-mail informado não corresponde ao workspace selecionado.',
        'CONFLICT',
        409
      );
    }
  }

  if (accountDocument) {
    const storedWorkspaceId = normalizeWorkspaceId(
      firestoreStringField(accountDocument.fields, 'workspaceId')
    );
    const accountType = firestoreStringField(accountDocument.fields, 'accountType');

    if (
      (storedWorkspaceId && storedWorkspaceId !== workspaceId)
      || (accountType && accountType !== 'sector')
    ) {
      throw new SectorProvisioningFailure(
        'A conta informada não corresponde ao workspace selecionado.',
        'CONFLICT',
        409
      );
    }
  }

  const authUser = await lookupAuthUserByEmail(accessToken, email);
  const cleanupErrors: string[] = [];

  try {
    await deleteFirestoreDocumentTree(accessToken, workspacePath);
  } catch (error) {
    cleanupErrors.push(
      `workspace: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    await commitFirestoreWrites(accessToken, [
      { delete: firestoreDocumentName(accountPath) },
      ...(isValidUnitUg(storedUg)
        ? [{ delete: firestoreDocumentName(`platformUgIndex/${storedUg}`) }]
        : []),
    ]);
  } catch (error) {
    cleanupErrors.push(
      `platformAccount/UG index: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    await releaseProvisioningLocks(accessToken, lockPaths);
  } catch (error) {
    cleanupErrors.push(
      `locks: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let firebaseAuthDeleted = false;
  if (authUser?.localId) {
    try {
      await deleteAuthUser(accessToken, authUser.localId);
      firebaseAuthDeleted = true;
    } catch (error) {
      cleanupErrors.push(
        `firebaseAuth: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (cleanupErrors.length > 0) {
    console.error('EMPROVEX sector deletion requires recovery.', {
      workspaceId,
      email,
      errors: cleanupErrors,
    });
    throw new SectorProvisioningFailure(
      'A exclusão foi iniciada, mas alguns resíduos não puderam ser removidos. Execute a recuperação administrativa antes de reutilizar este e-mail ou identificador.',
      'RECOVERY_REQUIRED',
      500,
      true
    );
  }

  await appendServerPlatformAuditEvent(accessToken, {
    operation: 'sector.delete',
    workspaceId,
    ug: storedUg || null,
    correlationId: deletionCorrelationId,
    actor: founder,
    before: {
      email,
      ug: storedUg || null,
      firebaseUid: authUser?.localId || null,
    },
    after: {
      deleted: true,
      firebaseAuthDeleted,
    },
    metadata: {
      directoryDeleted: true,
      locksReleased: true,
    },
  });

  return {
    workspaceId,
    email,
    firebaseAuthDeleted,
  };
}

export async function provisionSectorWorkspaceWithAuth(
  input: CreateSectorWorkspaceInput,
  founder: FounderSession
): Promise<SectorProvisioningResult> {
  const validationErrors = validateSectorProvisioningInput(input);
  if (validationErrors.length > 0) {
    throw new SectorProvisioningFailure(validationErrors[0], 'INVALID_INPUT', 400);
  }

  const email = normalizePlatformEmail(input.authorizedEmail);
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const ug = normalizeUnitUg(input.ug);
  if (ug === HGESM_UG) {
    throw new SectorProvisioningFailure(
      'A UG 160416 já pertence ao workspace fundador do HGeSM.',
      'CONFLICT',
      409
    );
  }
  const accessToken = await getGoogleAccessToken();
  const operationId = randomUUID();
  const now = new Date().toISOString();

  let lockPaths: string[] | null = null;
  let createdAuthUser = false;
  let directoryCreated = false;
  let authUserReused = false;
  let firebaseUid = '';
  let lockState: ProvisioningLockState = {
    operationId,
    workspaceId,
    ug,
    email,
    phase: 'acquiring-lock',
    createdBy: founder.email,
    createdAt: now,
    updatedAt: now,
  };

  try {
    lockPaths = await acquireProvisioningLocks(accessToken, {
      ...lockState,
      phase: 'locked',
    });

    let authUser = await lookupAuthUserByEmail(accessToken, email);

    if (authUser) {
      if (authUser.disabled) {
        throw new SectorProvisioningFailure(
          'O usuário Firebase existente para este e-mail está desativado e precisa ser revisado antes do provisionamento.',
          'CONFLICT',
          409
        );
      }
      if (!authUser.localId) {
        throw new Error('AUTH_USER_WITHOUT_UID');
      }
      firebaseUid = authUser.localId;
      authUserReused = true;
    } else {
      try {
        authUser = await createAuthUser(accessToken, input);
        firebaseUid = authUser.localId;
        createdAuthUser = true;
      } catch (createError) {
        const createMessage = createError instanceof Error ? createError.message : '';
        if (!createMessage.includes('EMAIL_EXISTS')) throw createError;

        authUser = await lookupAuthUserByEmail(accessToken, email);
        if (!authUser?.localId) throw createError;
        firebaseUid = authUser.localId;
        authUserReused = true;
      }
    }

    if (!firebaseUid) {
      throw new Error('AUTH_USER_WITHOUT_UID');
    }

    lockState = {
      ...lockState,
      phase: 'auth-ready',
      firebaseUid,
      authUserReused,
      updatedAt: new Date().toISOString(),
    };
    await updateProvisioningLocks(accessToken, lockPaths, lockState);

    const records = buildProvisionedSectorRecords(
      input,
      founder.email,
      firebaseUid,
      new Date().toISOString()
    );

    await createSectorDirectory(
      accessToken,
      {
        workspace: records.workspace,
        account: records.account,
      },
      founder,
      operationId,
      input.grantTrial
    );
    directoryCreated = true;

    lockState = {
      ...lockState,
      phase: 'directory-ready',
      updatedAt: new Date().toISOString(),
    };
    await updateProvisioningLocks(accessToken, lockPaths, lockState);

    if (authUserReused && authUser) {
      // Esta é a última etapa mutável do caminho de sucesso para um usuário
      // existente. Depois que a senha é aplicada não executamos mais nenhuma
      // gravação crítica, evitando rollback impossível da credencial anterior.
      await updateExistingAuthUserForPassword(accessToken, authUser, input);
    }

    try {
      await releaseProvisioningLocks(accessToken, lockPaths);
    } catch (cleanupError) {
      console.error('EMPROVEX provisioning completed but lock cleanup failed.', {
        operationId,
        workspaceId,
        email,
        firebaseUid,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    return {
      workspace: records.workspace,
      account: records.account,
      authUserReused,
    };
  } catch (error) {
    let recoveryRequired = false;

    if (directoryCreated) {
      try {
        await deleteSectorDirectory(accessToken, workspaceId, email, ug);
        directoryCreated = false;
      } catch (rollbackError) {
        recoveryRequired = true;
        console.error('EMPROVEX provisioning directory rollback failed.', {
          operationId,
          workspaceId,
          email,
          firebaseUid,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    }

    if (createdAuthUser && !directoryCreated && firebaseUid) {
      try {
        await deleteAuthUser(accessToken, firebaseUid);
        createdAuthUser = false;
      } catch (rollbackError) {
        recoveryRequired = true;
        console.error('EMPROVEX provisioning Auth rollback failed.', {
          operationId,
          workspaceId,
          email,
          firebaseUid,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    }

    if (lockPaths) {
      if (recoveryRequired) {
        try {
          await updateProvisioningLocks(accessToken, lockPaths, {
            ...lockState,
            phase: 'recovery-required',
            recoveryRequired: true,
            failureCode: error instanceof SectorProvisioningFailure ? error.code : 'UPSTREAM_ERROR',
            updatedAt: new Date().toISOString(),
          });
        } catch (lockError) {
          console.error('EMPROVEX provisioning recovery marker failed.', {
            operationId,
            workspaceId,
            email,
            firebaseUid,
            error: lockError instanceof Error ? lockError.message : String(lockError),
          });
        }
      } else {
        try {
          await releaseProvisioningLocks(accessToken, lockPaths);
        } catch (lockError) {
          recoveryRequired = true;
          console.error('EMPROVEX provisioning lock rollback failed.', {
            operationId,
            workspaceId,
            email,
            firebaseUid,
            error: lockError instanceof Error ? lockError.message : String(lockError),
          });
        }
      }
    }

    throw normalizeProvisioningError(error, recoveryRequired);
  }
}
