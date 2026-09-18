import { createHash, randomUUID } from 'node:crypto';

import { SignJWT, decodeJwt, importPKCS8 } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import { HGESM_SECTOR_EMAIL } from '../hgesmWorkspace';
import {
  FOUNDER_AUTH_PROVIDER,
  normalizePlatformEmail,
  normalizeWorkspaceId,
} from '../platformIdentity';
import {
  buildProvisionedSectorRecords,
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

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

interface ProvisioningLockState {
  operationId: string;
  workspaceId: string;
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

function lockDocumentIds(email: string, workspaceId: string): [string, string] {
  const emailHash = createHash('sha256').update(email).digest('hex');
  return [
    `platformProvisioningLocks/email-${emailHash}`,
    `platformProvisioningLocks/workspace-${workspaceId}`,
  ];
}

function lockWrites(
  lockPaths: [string, string],
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
): Promise<[string, string]> {
  const paths = lockDocumentIds(state.email, state.workspaceId);
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
  lockPaths: [string, string],
  state: ProvisioningLockState
): Promise<void> {
  await commitFirestoreWrites(accessToken, lockWrites(lockPaths, state));
}

async function releaseProvisioningLocks(
  accessToken: string,
  lockPaths: [string, string]
): Promise<void> {
  await commitFirestoreWrites(
    accessToken,
    lockPaths.map((path) => ({ delete: firestoreDocumentName(path) }))
  );
}

async function createSectorDirectory(
  accessToken: string,
  result: Pick<SectorProvisioningResult, 'workspace' | 'account'>
): Promise<void> {
  const termCounter = createInitialWorkspaceTermCounter();
  const workspacePath = `workspaces/${result.workspace.id}`;
  const accountPath = `platformAccounts/${result.account.email}`;
  const counterPath = `workspaces/${result.workspace.id}/settings/${WORKSPACE_TERM_COUNTER_SETTINGS_ID}`;

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
  email: string
): Promise<void> {
  await commitFirestoreWrites(accessToken, [
    { delete: firestoreDocumentName(`workspaces/${workspaceId}/settings/${WORKSPACE_TERM_COUNTER_SETTINGS_ID}`) },
    { delete: firestoreDocumentName(`platformAccounts/${email}`) },
    { delete: firestoreDocumentName(`workspaces/${workspaceId}`) },
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
  const accessToken = await getGoogleAccessToken();
  const operationId = randomUUID();
  const now = new Date().toISOString();

  let lockPaths: [string, string] | null = null;
  let createdAuthUser = false;
  let directoryCreated = false;
  let authUserReused = false;
  let firebaseUid = '';
  let lockState: ProvisioningLockState = {
    operationId,
    workspaceId,
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

    await createSectorDirectory(accessToken, {
      workspace: records.workspace,
      account: records.account,
    });
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
        await deleteSectorDirectory(accessToken, workspaceId, email);
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
