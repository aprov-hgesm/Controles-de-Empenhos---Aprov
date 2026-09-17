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
