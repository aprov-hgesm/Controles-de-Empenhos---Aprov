import { SignJWT, importPKCS8 } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';

const PROJECT_ID = firebaseConfig.projectId;
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const IDENTITY_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';

interface ServiceAccountCredentials {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  token_uri?: string;
}

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

let accessTokenCache: AccessTokenCache | null = null;

export interface FirebaseAuthBackupUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  disabled: boolean;
  displayName: string;
  photoUrl: string;
  createdAt: string;
  lastLoginAt: string;
  lastRefreshAt: string;
  validSince: string;
  customAttributes: string;
  providers: Array<{
    providerId: string;
    federatedId: string;
    email: string;
    displayName: string;
  }>;
}

export interface FirebaseAuthMetadataBackup {
  format: 'emprovex-firebase-auth-backup';
  schemaVersion: 1;
  mode: 'metadata-only';
  projectId: string;
  createdAt: string;
  userCount: number;
  passwordHashIncluded: false;
  passwordSaltIncluded: false;
  passwordUsersRequireResetAfterCatastrophicRestore: boolean;
  users: FirebaseAuthBackupUser[];
}

function parseServiceAccount(): Required<Pick<ServiceAccountCredentials, 'client_email' | 'private_key'>> & {
  token_uri: string;
} {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error('A credencial administrativa do Firebase não está configurada no servidor.');
  }

  let parsed: ServiceAccountCredentials;
  try {
    parsed = JSON.parse(raw) as ServiceAccountCredentials;
  } catch {
    throw new Error('A credencial administrativa do Firebase possui JSON inválido.');
  }

  if (!parsed.client_email?.trim() || !parsed.private_key?.trim()) {
    throw new Error('A credencial administrativa do Firebase está incompleta.');
  }
  if (parsed.project_id && parsed.project_id !== PROJECT_ID) {
    throw new Error('A credencial administrativa pertence a outro projeto Firebase.');
  }

  return {
    client_email: parsed.client_email.trim(),
    private_key: parsed.private_key.replace(/\\n/g, '\n').trim(),
    token_uri: parsed.token_uri?.trim() || TOKEN_URI,
  };
}

async function getGoogleAdminAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAt - 60_000 > now) {
    return accessTokenCache.token;
  }

  const credentials = parseServiceAccount();
  const privateKey = await importPKCS8(credentials.private_key, 'RS256');
  const issuedAt = Math.floor(now / 1000);
  const assertion = await new SignJWT({ scope: CLOUD_PLATFORM_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.client_email)
    .setAudience(credentials.token_uri)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 3600)
    .sign(privateKey);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || 'Não foi possível autorizar o backup administrativo do Firebase Auth.');
  }

  const expiresIn = Number(payload.expires_in || 3600);
  accessTokenCache = {
    token: payload.access_token,
    expiresAt: now + Math.max(300, expiresIn) * 1000,
  };
  return payload.access_token;
}

interface IdentityToolkitUser {
  localId?: string;
  email?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  displayName?: string;
  photoUrl?: string;
  createdAt?: string;
  lastLoginAt?: string;
  lastRefreshAt?: string;
  validSince?: string;
  customAttributes?: string;
  providerUserInfo?: Array<{
    providerId?: string;
    federatedId?: string;
    email?: string;
    displayName?: string;
  }>;
  passwordHash?: string;
  salt?: string;
  passwordUpdatedAt?: number;
}

interface BatchGetResponse {
  users?: IdentityToolkitUser[];
  nextPageToken?: string;
  error?: {
    message?: string;
  };
}

function sanitizeUser(user: IdentityToolkitUser): FirebaseAuthBackupUser | null {
  const uid = user.localId?.trim() || '';
  if (!uid) return null;

  return {
    uid,
    email: user.email?.trim().toLowerCase() || '',
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    displayName: user.displayName || '',
    photoUrl: user.photoUrl || '',
    createdAt: user.createdAt || '',
    lastLoginAt: user.lastLoginAt || '',
    lastRefreshAt: user.lastRefreshAt || '',
    validSince: user.validSince || '',
    customAttributes: user.customAttributes || '',
    providers: (user.providerUserInfo || []).map((provider) => ({
      providerId: provider.providerId || '',
      federatedId: provider.federatedId || '',
      email: provider.email || '',
      displayName: provider.displayName || '',
    })),
  };
}

export async function createFirebaseAuthMetadataBackup(): Promise<FirebaseAuthMetadataBackup> {
  const accessToken = await getGoogleAdminAccessToken();
  const users: FirebaseAuthBackupUser[] = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ maxResults: '1000' });
    if (pageToken) params.set('nextPageToken', pageToken);

    const response = await fetch(
      `${IDENTITY_TOOLKIT_BASE}/projects/${encodeURIComponent(PROJECT_ID)}/accounts:batchGet?${params.toString()}`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );
    const payload = await response.json() as BatchGetResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || 'Não foi possível listar os usuários do Firebase Auth.');
    }

    for (const rawUser of payload.users || []) {
      // passwordHash/salt nunca são copiados para a estrutura de backup.
      const sanitized = sanitizeUser(rawUser);
      if (sanitized) users.push(sanitized);
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  users.sort((a, b) => a.email.localeCompare(b.email) || a.uid.localeCompare(b.uid));

  return {
    format: 'emprovex-firebase-auth-backup',
    schemaVersion: 1,
    mode: 'metadata-only',
    projectId: PROJECT_ID,
    createdAt: new Date().toISOString(),
    userCount: users.length,
    passwordHashIncluded: false,
    passwordSaltIncluded: false,
    passwordUsersRequireResetAfterCatastrophicRestore: users.some((user) =>
      user.providers.some((provider) => provider.providerId === 'password')
    ),
    users,
  };
}
