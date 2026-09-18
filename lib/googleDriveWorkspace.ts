'use client';

import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';

import { normalizePlatformEmail } from './platformIdentity';
import type { SectorWorkspaceContext } from './workspaceContext';

export const GOOGLE_DRIVE_WORKSPACE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'EMPROVEX';
export const GOOGLE_DRIVE_EMPENHOS_FOLDER_NAME = 'Notas de Empenho';
export const GOOGLE_DRIVE_INVOICES_FOLDER_NAME = 'Notas Fiscais';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const GOOGLE_IDENTITY_SERVICES_URL = 'https://accounts.google.com/gsi/client';

interface GoogleDriveAboutResponse {
  user?: {
    emailAddress?: string;
  };
}

interface GoogleOAuthTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  scope?: string;
}

interface GoogleOAuthTokenClient {
  requestAccessToken(config?: {
    prompt?: string;
    scope?: string;
    include_granted_scopes?: boolean;
    login_hint?: string;
  }): void;
}

interface GoogleOAuth2Api {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes?: boolean;
    prompt?: string;
    login_hint?: string;
    callback: (response: GoogleOAuthTokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }): GoogleOAuthTokenClient;
  hasGrantedAllScopes(response: GoogleOAuthTokenResponse, ...scopes: string[]): boolean;
}

type GoogleIdentityWindow = Window & {
  google?: {
    accounts?: {
      oauth2?: GoogleOAuth2Api;
    };
  };
};

export interface WorkspaceGoogleDriveSession {
  accessToken: string;
  email: string;
  workspaceId: string;
  connectedAt: string;
}

export interface WorkspaceGoogleDriveFolders {
  rootFolderId: string;
  empenhosFolderId: string;
  invoicesFolderId: string;
}

interface DriveListResponse<T> {
  files?: T[];
}

interface DriveApiErrorPayload {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

function escapeDriveQueryValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

async function readDriveError(response: Response): Promise<never> {
  let payload: DriveApiErrorPayload | undefined;
  try {
    payload = (await response.json()) as DriveApiErrorPayload;
  } catch {
    // Resposta sem JSON.
  }

  const reason = payload?.error?.errors?.[0]?.reason;
  if (reason === 'accessNotConfigured' || reason === 'serviceDisabled') {
    throw new Error('A Google Drive API ainda não está habilitada para o EMPROVEX.');
  }
  if (response.status === 401) {
    throw new Error('A autorização temporária do Google Drive expirou. Reconecte o Drive.');
  }
  if (response.status === 403) {
    throw new Error(payload?.error?.message || 'O Google recusou a operação no Drive deste setor.');
  }

  throw new Error(payload?.error?.message || `Falha na Google Drive API (HTTP ${response.status}).`);
}

async function driveFetch(
  accessToken: string,
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!response.ok) await readDriveError(response);
  return response;
}

function getGoogleOAuth2Api(): GoogleOAuth2Api {
  if (typeof window === 'undefined') {
    throw new Error('A autorização do Google Drive precisa ser iniciada no navegador.');
  }

  const oauth2 = (window as GoogleIdentityWindow).google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error(
      'O serviço de autorização do Google ainda está carregando. Aguarde alguns segundos e tente conectar o Drive novamente.'
    );
  }

  return oauth2;
}

function getGoogleOAuthClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error(
      'A autorização independente do Google Drive ainda não foi configurada para usuários externos.'
    );
  }
  return clientId;
}

function requestIndependentDriveAccessToken(expectedEmail: string): Promise<string> {
  const oauth2 = getGoogleOAuth2Api();
  const clientId = getGoogleOAuthClientId();

  return new Promise((resolve, reject) => {
    let settled = false;
    const rejectOnce = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_WORKSPACE_SCOPE,
      include_granted_scopes: false,
      prompt: 'consent select_account',
      login_hint: expectedEmail,
      callback: (response) => {
        if (settled) return;

        if (response.error) {
          rejectOnce(
            response.error_description
              || 'O Google não autorizou o acesso temporário ao Drive.'
          );
          return;
        }

        if (!response.access_token) {
          rejectOnce('O Google não retornou uma autorização temporária para a Drive API.');
          return;
        }

        if (!oauth2.hasGrantedAllScopes(response, GOOGLE_DRIVE_WORKSPACE_SCOPE)) {
          rejectOnce('A permissão necessária para usar o Google Drive não foi concedida.');
          return;
        }

        settled = true;
        resolve(response.access_token);
      },
      error_callback: (error) => {
        const detail = error.type === 'popup_closed'
          ? 'A janela de autorização do Google foi fechada antes da conclusão.'
          : error.type === 'popup_failed_to_open'
            ? 'O navegador bloqueou a janela de autorização do Google Drive.'
            : 'Não foi possível abrir a autorização do Google Drive.';
        rejectOnce(detail);
      },
    });

    tokenClient.requestAccessToken({
      prompt: 'consent select_account',
      scope: GOOGLE_DRIVE_WORKSPACE_SCOPE,
      include_granted_scopes: false,
      login_hint: expectedEmail,
    });
  });
}

async function readAuthorizedDriveEmail(accessToken: string): Promise<string> {
  const response = await driveFetch(
    accessToken,
    `${DRIVE_API_BASE}/about?fields=user(emailAddress)`
  );
  const payload = (await response.json()) as GoogleDriveAboutResponse;
  return normalizePlatformEmail(payload.user?.emailAddress || '');
}

async function connectExternalWorkspaceDrive(
  context: SectorWorkspaceContext,
  expectedEmail: string
): Promise<WorkspaceGoogleDriveSession> {
  const accessToken = await requestIndependentDriveAccessToken(expectedEmail);
  const returnedEmail = await readAuthorizedDriveEmail(accessToken);

  if (!returnedEmail || returnedEmail !== expectedEmail) {
    throw new Error(
      'Conecte o Google Drive usando a mesma Conta Google autorizada para este setor.'
    );
  }

  return {
    accessToken,
    email: returnedEmail,
    workspaceId: context.workspaceId,
    connectedAt: new Date().toISOString(),
  };
}

async function connectFounderDriveSession(
  user: User,
  context: SectorWorkspaceContext,
  expectedEmail: string
): Promise<WorkspaceGoogleDriveSession> {
  // Setores externos entram no EMPROVEX por e-mail/senha. A autorização
  // do Drive precisa ser independente para não trocar o sign_in_provider da
  // sessão Firebase e disparar a revogação fail-closed do workspace.
  if (context.resolutionSource === 'platform-directory') {
    return connectExternalWorkspaceDrive(context, expectedEmail);
  }

  // O workspace fundador legado continua usando o fluxo Firebase consolidado.
  return connectFounderDriveSession(user, context, expectedEmail);
}

export async function connectGoogleDriveForWorkspace(
  user: User,
  context: SectorWorkspaceContext
): Promise<WorkspaceGoogleDriveSession> {
  const expectedEmail = normalizePlatformEmail(context.email);
  const currentEmail = normalizePlatformEmail(user.email || '');

  if (!currentEmail || currentEmail !== expectedEmail) {
    throw new Error('A conta Firebase atual não corresponde à conta autorizada deste workspace.');
  }

  const provider = new GoogleAuthProvider();
  provider.addScope(GOOGLE_DRIVE_WORKSPACE_SCOPE);
  provider.setCustomParameters({
    prompt: 'consent select_account',
    login_hint: context.email,
  });

  const result = await reauthenticateWithPopup(user, provider);
  const returnedEmail = normalizePlatformEmail(result.user.email || '');

  if (result.user.uid !== user.uid || returnedEmail !== expectedEmail) {
    throw new Error('Conecte o Google Drive usando a mesma Conta Google autorizada para este setor.');
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) {
    throw new Error('O Google não retornou uma autorização temporária para a Drive API.');
  }

  return {
    accessToken,
    email: returnedEmail,
    workspaceId: context.workspaceId,
    connectedAt: new Date().toISOString(),
  };
}

async function findFolder(
  accessToken: string,
  workspaceId: string,
  role: 'root' | 'empenhos' | 'invoices',
  parentId?: string
): Promise<{ id: string; name: string } | null> {
  const clauses = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    `appProperties has { key='emprovexWorkspaceId' and value='${escapeDriveQueryValue(workspaceId)}' }`,
    `appProperties has { key='emprovexFolderRole' and value='${role}' }`,
  ];
  if (parentId) clauses.push(`'${escapeDriveQueryValue(parentId)}' in parents`);

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    spaces: 'drive',
    pageSize: '10',
    fields: 'files(id,name)',
  });
  const response = await driveFetch(accessToken, `${DRIVE_API_BASE}/files?${params.toString()}`);
  const payload = (await response.json()) as DriveListResponse<{ id: string; name: string }>;
  return payload.files?.[0] || null;
}

async function createFolder(
  accessToken: string,
  workspaceId: string,
  role: 'root' | 'empenhos' | 'invoices',
  name: string,
  parentId?: string
): Promise<{ id: string; name: string }> {
  const response = await driveFetch(accessToken, `${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
      appProperties: {
        ownerApp: 'EMPROVEX',
        emprovexWorkspaceId: workspaceId,
        emprovexFolderRole: role,
      },
    }),
  });
  return response.json() as Promise<{ id: string; name: string }>;
}

async function ensureFolder(
  accessToken: string,
  workspaceId: string,
  role: 'root' | 'empenhos' | 'invoices',
  name: string,
  parentId?: string
): Promise<{ id: string; name: string }> {
  const existing = await findFolder(accessToken, workspaceId, role, parentId);
  if (existing) return existing;
  return createFolder(accessToken, workspaceId, role, name, parentId);
}

export async function ensureWorkspaceGoogleDriveFolders(
  session: WorkspaceGoogleDriveSession
): Promise<WorkspaceGoogleDriveFolders> {
  const root = await ensureFolder(
    session.accessToken,
    session.workspaceId,
    'root',
    GOOGLE_DRIVE_ROOT_FOLDER_NAME
  );
  const empenhos = await ensureFolder(
    session.accessToken,
    session.workspaceId,
    'empenhos',
    GOOGLE_DRIVE_EMPENHOS_FOLDER_NAME,
    root.id
  );
  const invoices = await ensureFolder(
    session.accessToken,
    session.workspaceId,
    'invoices',
    GOOGLE_DRIVE_INVOICES_FOLDER_NAME,
    root.id
  );

  return {
    rootFolderId: root.id,
    empenhosFolderId: empenhos.id,
    invoicesFolderId: invoices.id,
  };
}
