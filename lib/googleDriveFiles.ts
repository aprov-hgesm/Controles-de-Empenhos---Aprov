'use client';

import {
  assertWorkspaceGoogleDriveSessionActive,
  type WorkspaceGoogleDriveSession,
} from './googleDriveWorkspace';
import { assertWorkspacePdfIsSafeForStorage } from './pdfSecurity';
import { clearWorkspaceDriveRuntime } from './workspaceDriveRuntime';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface WorkspaceDrivePdfFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

interface DriveApiErrorPayload {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

async function readDriveError(response: Response): Promise<never> {
  let payload: DriveApiErrorPayload | undefined;
  try {
    payload = (await response.json()) as DriveApiErrorPayload;
  } catch {
    // Resposta sem JSON.
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
  session: WorkspaceGoogleDriveSession,
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  assertWorkspaceGoogleDriveSessionActive(session);

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  const response = await fetch(input, { ...init, headers, cache: 'no-store' });

  if (response.status === 401) {
    clearWorkspaceDriveRuntime('expired');
  }
  if (!response.ok) await readDriveError(response);
  return response;
}

function safeFileName(value: string): string {
  const trimmed = value.trim() || 'documento.pdf';
  const withoutControls = trimmed.replace(/[\u0000-\u001f\u007f]/g, '');
  return withoutControls.replace(/[\\/]+/g, '-').slice(0, 180) || 'documento.pdf';
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function uploadWorkspacePdf(
  session: WorkspaceGoogleDriveSession,
  folderId: string,
  blob: Blob,
  originalName: string,
  appProperties: Record<string, string>
): Promise<WorkspaceDrivePdfFile> {
  await assertWorkspacePdfIsSafeForStorage(blob);

  const boundary = `emprovex_${crypto.randomUUID().replaceAll('-', '')}`;
  const metadata = {
    name: safeFileName(originalName),
    mimeType: 'application/pdf',
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
    `\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await driveFetch(
    session,
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,size,mimeType,parents,appProperties`,
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
    parents?: string[];
    appProperties?: Record<string, string>;
  };

  return {
    id: payload.id,
    name: payload.name,
    size: Number(payload.size || blob.size),
    mimeType: payload.mimeType,
    parents: payload.parents,
    appProperties: payload.appProperties,
  };
}

export async function fetchWorkspaceDrivePdf(
  session: WorkspaceGoogleDriveSession,
  fileId: string
): Promise<Blob> {
  const response = await driveFetch(
    session,
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`
  );
  const blob = await response.blob();
  const normalized = blob.type === 'application/pdf'
    ? blob
    : new Blob([blob], { type: 'application/pdf' });
  await assertWorkspacePdfIsSafeForStorage(normalized);
  return normalized;
}

export async function getWorkspaceDrivePdfMetadata(
  session: WorkspaceGoogleDriveSession,
  fileId: string
): Promise<WorkspaceDrivePdfFile> {
  const response = await driveFetch(
    session,
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,size,mimeType,parents,appProperties`
  );
  const payload = await response.json() as {
    id: string;
    name: string;
    size?: string;
    mimeType: string;
    parents?: string[];
    appProperties?: Record<string, string>;
  };
  return {
    id: payload.id,
    name: payload.name,
    size: Number(payload.size || 0),
    mimeType: payload.mimeType,
    parents: payload.parents,
    appProperties: payload.appProperties,
  };
}

export async function deleteWorkspaceDriveFile(
  session: WorkspaceGoogleDriveSession,
  fileId: string
): Promise<void> {
  await driveFetch(session, `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
}

export async function uploadAndVerifyWorkspacePdf(
  session: WorkspaceGoogleDriveSession,
  folderId: string,
  blob: Blob,
  originalName: string,
  appProperties: Record<string, string>
): Promise<{ file: WorkspaceDrivePdfFile; sha256: string }> {
  const sourceSha256 = await sha256Blob(blob);
  const file = await uploadWorkspacePdf(session, folderId, blob, originalName, appProperties);

  try {
    const metadata = await getWorkspaceDrivePdfMetadata(session, file.id);
    if (metadata.mimeType !== 'application/pdf') {
      throw new Error('O arquivo gravado no Google Drive não foi reconhecido como PDF.');
    }
    if (metadata.size !== blob.size) {
      throw new Error('O tamanho do PDF gravado no Google Drive diverge do arquivo original.');
    }

    const downloaded = await fetchWorkspaceDrivePdf(session, file.id);
    const downloadedSha256 = await sha256Blob(downloaded);
    if (downloadedSha256 !== sourceSha256) {
      throw new Error('A verificação SHA-256 do PDF migrado para o Google Drive falhou.');
    }

    return { file: metadata, sha256: sourceSha256 };
  } catch (error) {
    await deleteWorkspaceDriveFile(session, file.id).catch(() => undefined);
    throw error;
  }
}
