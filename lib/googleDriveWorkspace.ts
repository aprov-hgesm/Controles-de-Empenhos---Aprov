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
export const GOOGLE_DRIVE_ACCOUNT_SELECTION_PROMPT = 'select_account';

interface GoogleDriveAboutResponse {
  user?: {
    emailAddress?: string;
  };
}

interface GoogleOAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
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

export const GOOGLE_DRIVE_TOKEN_EXPIRY_SAFETY_MS = 60_000;
export const WORKSPACE_DRIVE_RECONNECT_REQUIRED_MESSAGE =
  'A autorização temporária do Google Drive expirou. Reconecte o Drive para continuar usando os documentos.';

export interface WorkspaceGoogleDriveSession {
  accessToken: string;
  email: string;
  workspaceId: string;
  connectedAt: string;
  /**
   * Mantido apenas em memória. Setores externos recebem esse valor a partir
   * de expires_in do Google Identity Services; nunca é persistido no Firestore.
   */
  expiresAt?: string;
}

export function getWorkspaceGoogleDriveSessionRemainingMs(
  session: WorkspaceGoogleDriveSession,
  nowMs: number = Date.now()
): number | null {
  if (!session.expiresAt) return null;
  const expiresAtMs = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAtMs)) return 0;
  return expiresAtMs - GOOGLE_DRIVE_TOKEN_EXPIRY_SAFETY_MS - nowMs;
}

export function isWorkspaceGoogleDriveSessionExpired(
  session: WorkspaceGoogleDriveSession,
  nowMs: number = Date.now()
): boolean {
  const remainingMs = getWorkspaceGoogleDriveSessionRemainingMs(session, nowMs);
  return remainingMs !== null && remainingMs <= 0;
}

export function assertWorkspaceGoogleDriveSessionActive(
  session: WorkspaceGoogleDriveSession,
  nowMs: number = Date.now()
): void {
  if (isWorkspaceGoogleDriveSessionExpired(session, nowMs)) {
    throw new Error(WORKSPACE_DRIVE_RECONNECT_REQUIRED_MESSAGE);
  }
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

const DEFAULT_GOOGLE_OAUTH_CLIENT_ID =
  '943599311487-u07f8gm4t2opgacr3albafmop8uj4h7u.apps.googleusercontent.com';

function getGoogleOAuthClientId(): string {
  const configuredClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim();
  return configuredClientId || DEFAULT_GOOGLE_OAUTH_CLIENT_ID;
}

interface IndependentDriveAccessToken {
  accessToken: string;
  expiresAt: string;
}

function googleOAuthTokenErrorMessage(response: GoogleOAuthTokenResponse): string {
  switch (response.error) {
    case 'access_denied':
      return 'A autorização do Google Drive foi cancelada ou recusada. Sua sessão no EMPROVEX continua ativa; tente novamente quando quiser.';
    case 'interaction_required':
    case 'login_required':
      return 'O Google precisa que você confirme a conta antes de continuar. Tente novamente e selecione a Conta Google autorizada deste setor.';
    case 'consent_required':
      return 'O Google precisa confirmar a permissão do Drive. Tente novamente e conclua a autorização exibida pelo Google.';
    default:
      return response.error_description?.trim()
        || 'O Google não autorizou o acesso temporário ao Drive. Tente novamente.';
  }
}

function googleOAuthPopupErrorMessage(error: { type?: string }): string {
  if (error.type === 'popup_closed') {
    return 'A janela de autorização do Google foi fechada antes da conclusão. Sua sessão no EMPROVEX continua ativa.';
  }
  if (error.type === 'popup_failed_to_open') {
    return 'O navegador bloqueou a janela de autorização do Google Drive. Permita pop-ups para o EMPROVEX e tente novamente.';
  }
  return 'Não foi possível abrir a autorização do Google Drive. Sua sessão no EMPROVEX continua ativa; tente novamente.';
}

function requestIndependentDriveAccessToken(expectedEmail: string): Promise<IndependentDriveAccessToken> {
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
      prompt: GOOGLE_DRIVE_ACCOUNT_SELECTION_PROMPT,
      login_hint: expectedEmail,
      callback: (response) => {
        if (settled) return;

        if (response.error) {
          rejectOnce(googleOAuthTokenErrorMessage(response));
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

        const expiresInSeconds = Number(response.expires_in);
        if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
          rejectOnce('O Google não informou a validade da autorização temporária do Drive. Reconecte e tente novamente.');
          return;
        }

        settled = true;
        resolve({
          accessToken: response.access_token,
          expiresAt: new Date(Date.now() + (expiresInSeconds * 1000)).toISOString(),
        });
      },
      error_callback: (error) => {
        rejectOnce(googleOAuthPopupErrorMessage(error));
      },
    });

    tokenClient.requestAccessToken({
      prompt: GOOGLE_DRIVE_ACCOUNT_SELECTION_PROMPT,
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
  const token = await requestIndependentDriveAccessToken(expectedEmail);
  const returnedEmail = await readAuthorizedDriveEmail(token.accessToken);

  if (!returnedEmail || returnedEmail !== expectedEmail) {
    throw new Error(
      'A Conta Google selecionada não corresponde à conta autorizada deste setor. Selecione a conta correta e tente novamente.'
    );
  }

  return {
    accessToken: token.accessToken,
    email: returnedEmail,
    workspaceId: context.workspaceId,
    connectedAt: new Date().toISOString(),
    expiresAt: token.expiresAt,
  };
}

async function connectFounderDriveSession(
  user: User,
  context: SectorWorkspaceContext,
  expectedEmail: string
): Promise<WorkspaceGoogleDriveSession> {
  const provider = new GoogleAuthProvider();
  provider.addScope(GOOGLE_DRIVE_WORKSPACE_SCOPE);
  provider.setCustomParameters({
    prompt: GOOGLE_DRIVE_ACCOUNT_SELECTION_PROMPT,
    login_hint: context.email,
  });

  const result = await reauthenticateWithPopup(user, provider);
  const returnedEmail = normalizePlatformEmail(result.user.email || '');

  if (result.user.uid !== user.uid || returnedEmail !== expectedEmail) {
    throw new Error('A Conta Google selecionada não corresponde à conta autorizada deste setor. Selecione a conta correta e tente novamente.');
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

export async function connectGoogleDriveForWorkspace(
  user: User,
  context: SectorWorkspaceContext
): Promise<WorkspaceGoogleDriveSession> {
  const expectedEmail = normalizePlatformEmail(context.email);
  const currentEmail = normalizePlatformEmail(user.email || '');

  if (!currentEmail || currentEmail !== expectedEmail) {
    throw new Error('A conta Firebase atual não corresponde à conta autorizada deste workspace.');
  }

  // Setores externos entram no EMPROVEX por e-mail/senha. A autorização do
  // Google Drive usa OAuth independente para preservar o sign_in_provider=password
  // da sessão Firebase e impedir logout por fail-closed do workspace.
  if (context.resolutionSource === 'platform-directory') {
    return connectExternalWorkspaceDrive(context, expectedEmail);
  }

  // O workspace fundador legado mantém o fluxo Firebase/Google já consolidado.
  return connectFounderDriveSession(user, context, expectedEmail);
}

export const PLATFORM_RECOVERY_DRIVE_WORKSPACE_ID = 'platform-recovery';

export async function connectFounderRecoveryDrive(
  expectedEmailInput: string
): Promise<WorkspaceGoogleDriveSession> {
  const expectedEmail = normalizePlatformEmail(expectedEmailInput);
  if (!expectedEmail) {
    throw new Error('A conta fundadora não possui e-mail válido para autorizar o Drive de recuperação.');
  }

  const token = await requestIndependentDriveAccessToken(expectedEmail);
  const returnedEmail = await readAuthorizedDriveEmail(token.accessToken);
  if (returnedEmail !== expectedEmail) {
    throw new Error('A Conta Google selecionada não corresponde à conta fundadora autenticada.');
  }

  return {
    accessToken: token.accessToken,
    email: returnedEmail,
    workspaceId: PLATFORM_RECOVERY_DRIVE_WORKSPACE_ID,
    connectedAt: new Date().toISOString(),
    expiresAt: token.expiresAt,
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
  assertWorkspaceGoogleDriveSessionActive(session);
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
