'use client';

import {
  assertWorkspaceGoogleDriveSessionActive,
  type WorkspaceGoogleDriveSession,
} from './googleDriveWorkspace';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const GOOGLE_DRIVE_BACKUPS_FOLDER_NAME = 'Backups';
export const GOOGLE_DRIVE_RECOVERY_ROOT_NAME = 'EMPROVEX - Recuperação';
export const GOOGLE_DRIVE_AUTH_BACKUPS_FOLDER_NAME = 'Firebase Auth';

export interface WorkspaceBackupDriveFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdTime: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

interface DriveApiErrorPayload {
  error?: {
    message?: string;
  };
}

function escapeDriveQueryValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

async function readDriveError(response: Response): Promise<never> {
  let payload: DriveApiErrorPayload | undefined;
  try {
    payload = await response.json() as DriveApiErrorPayload;
  } catch {
    // Resposta sem JSON.
  }

  if (response.status === 401) {
    throw new Error('A autorização temporária do Google Drive expirou. Reconecte o Drive.');
  }
  if (response.status === 403) {
    throw new Error(payload?.error?.message || 'O Google recusou a operação de backup no Drive.');
  }

  throw new Error(payload?.error?.message || `Falha na Google Drive API (HTTP ${response.status}).`);
}

async function driveFetch(
  session: WorkspaceGoogleDriveSession,
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  assertWorkspaceGoogleDriveSessionActive(session);

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${session.accessToken}`);

  const response = await fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) await readDriveError(response);
  return response;
}

async function findFolder(
  session: WorkspaceGoogleDriveSession,
  role: string,
  parentId?: string
): Promise<{ id: string; name: string } | null> {
  const clauses = [
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
    `appProperties has { key='ownerApp' and value='EMPROVEX' }`,
    `appProperties has { key='emprovexWorkspaceId' and value='${escapeDriveQueryValue(session.workspaceId)}' }`,
    `appProperties has { key='emprovexFolderRole' and value='${escapeDriveQueryValue(role)}' }`,
  ];
  if (parentId) clauses.push(`'${escapeDriveQueryValue(parentId)}' in parents`);

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    spaces: 'drive',
    pageSize: '10',
    fields: 'files(id,name)',
  });

  const response = await driveFetch(
    session,
    `${DRIVE_API_BASE}/files?${params.toString()}`
  );
  const payload = await response.json() as { files?: Array<{ id: string; name: string }> };
  return payload.files?.[0] || null;
}

async function createFolder(
  session: WorkspaceGoogleDriveSession,
  role: string,
  name: string,
  parentId?: string
): Promise<{ id: string; name: string }> {
  const response = await driveFetch(session, `${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
      appProperties: {
        ownerApp: 'EMPROVEX',
        emprovexWorkspaceId: session.workspaceId,
        emprovexFolderRole: role,
      },
    }),
  });

  return response.json() as Promise<{ id: string; name: string }>;
}

async function ensureFolder(
  session: WorkspaceGoogleDriveSession,
  role: string,
  name: string,
  parentId?: string
): Promise<{ id: string; name: string }> {
  return (await findFolder(session, role, parentId))
    || createFolder(session, role, name, parentId);
}

export async function ensureWorkspaceBackupFolder(
  session: WorkspaceGoogleDriveSession,
  rootFolderId: string
): Promise<string> {
  const folder = await ensureFolder(
    session,
    'backups',
    GOOGLE_DRIVE_BACKUPS_FOLDER_NAME,
    rootFolderId
  );
  return folder.id;
}

export async function ensureFounderAuthBackupFolder(
  session: WorkspaceGoogleDriveSession
): Promise<string> {
  const root = await ensureFolder(
    session,
    'recovery-root',
    GOOGLE_DRIVE_RECOVERY_ROOT_NAME
  );
  const auth = await ensureFolder(
    session,
    'firebase-auth-backups',
    GOOGLE_DRIVE_AUTH_BACKUPS_FOLDER_NAME,
    root.id
  );
  return auth.id;
}

function safeBackupFileName(value: string): string {
  return value
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .slice(0, 180);
}

export async function uploadBackupBlob(
  session: WorkspaceGoogleDriveSession,
  folderId: string,
  blob: Blob,
  fileName: string,
  appProperties: Record<string, string>
): Promise<WorkspaceBackupDriveFile> {
  const boundary = `emprovex_backup_${crypto.randomUUID().replaceAll('-', '')}`;
  const metadata = {
    name: safeBackupFileName(fileName),
    mimeType: blob.type || 'application/gzip',
    parents: [folderId],
    appProperties: {
      ownerApp: 'EMPROVEX',
      emprovexWorkspaceId: session.workspaceId,
      ...appProperties,
    },
  };

  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await driveFetch(
    session,
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,size,mimeType,createdTime,parents,appProperties`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  const payload = await response.json() as {
    id: string;
    name: string;
    size?: string;
    mimeType: string;
    createdTime?: string;
    parents?: string[];
    appProperties?: Record<string, string>;
  };

  return {
    id: payload.id,
    name: payload.name,
    size: Number(payload.size || blob.size),
    mimeType: payload.mimeType,
    createdTime: payload.createdTime || new Date().toISOString(),
    parents: payload.parents,
    appProperties: payload.appProperties,
  };
}

export async function listWorkspaceBackupFiles(
  session: WorkspaceGoogleDriveSession,
  folderId: string
): Promise<WorkspaceBackupDriveFile[]> {
  const clauses = [
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    'trashed = false',
    `appProperties has { key='ownerApp' and value='EMPROVEX' }`,
    `appProperties has { key='emprovexWorkspaceId' and value='${escapeDriveQueryValue(session.workspaceId)}' }`,
    `appProperties has { key='emprovexFileType' and value='workspace-backup' }`,
  ];

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    spaces: 'drive',
    pageSize: '100',
    orderBy: 'createdTime desc',
    fields: 'files(id,name,size,mimeType,createdTime,parents,appProperties)',
  });

  const response = await driveFetch(
    session,
    `${DRIVE_API_BASE}/files?${params.toString()}`
  );
  const payload = await response.json() as {
    files?: Array<{
      id: string;
      name: string;
      size?: string;
      mimeType: string;
      createdTime?: string;
      parents?: string[];
      appProperties?: Record<string, string>;
    }>;
  };

  return (payload.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    size: Number(file.size || 0),
    mimeType: file.mimeType,
    createdTime: file.createdTime || '',
    parents: file.parents,
    appProperties: file.appProperties,
  }));
}

export async function fetchBackupBlob(
  session: WorkspaceGoogleDriveSession,
  fileId: string
): Promise<Blob> {
  const response = await driveFetch(
    session,
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`
  );
  return response.blob();
}

export async function deleteBackupFile(
  session: WorkspaceGoogleDriveSession,
  fileId: string
): Promise<void> {
  await driveFetch(
    session,
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE' }
  );
}
