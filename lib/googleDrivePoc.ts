'use client';

import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';

export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_POC_FOLDER_NAME = 'EMPROVEX-TESTE';
export const MAX_DRIVE_POC_PDF_BYTES = 10 * 1024 * 1024;

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface GoogleDriveSession {
  accessToken: string;
  email: string;
  connectedAt: string;
}

export interface DrivePocFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
}

interface DriveListResponse<T> {
  files?: T[];
}

interface DriveApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

function driveErrorMessage(status: number, payload?: DriveApiErrorPayload): string {
  const reason = payload?.error?.errors?.[0]?.reason;
  const message = payload?.error?.message;

  if (reason === 'accessNotConfigured' || reason === 'serviceDisabled') {
    return 'A Google Drive API ainda não está habilitada no projeto Google Cloud do EMPROVEX.';
  }
  if (status === 401) {
    return 'A sessão temporária do Google Drive expirou. Reconecte o Drive e tente novamente.';
  }
  if (status === 403) {
    return message || 'O Google recusou esta operação no Drive. Confirme a permissão drive.file e a conta conectada.';
  }
  return message || `Falha na Google Drive API (HTTP ${status}).`;
}

async function readDriveError(response: Response): Promise<never> {
  let payload: DriveApiErrorPayload | undefined;
  try {
    payload = (await response.json()) as DriveApiErrorPayload;
  } catch {
    // O corpo pode não ser JSON em falhas de rede/proxy.
  }
  throw new Error(driveErrorMessage(response.status, payload));
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

export async function connectGoogleDrive(user: User): Promise<GoogleDriveSession> {
  const provider = new GoogleAuthProvider();
  provider.addScope(GOOGLE_DRIVE_FILE_SCOPE);
  provider.setCustomParameters({
    prompt: 'consent select_account',
    ...(user.email ? { login_hint: user.email } : {}),
  });

  const result = await reauthenticateWithPopup(user, provider);
  if (result.user.uid !== user.uid || result.user.email !== user.email) {
    throw new Error('O Google Drive deve ser conectado com a mesma Conta Google autenticada no EMPROVEX.');
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) {
    throw new Error('O Google não retornou um token temporário para a Drive API.');
  }

  return {
    accessToken,
    email: result.user.email || '',
    connectedAt: new Date().toISOString(),
  };
}

function escapeDriveQueryValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

export async function ensureDrivePocFolder(accessToken: string): Promise<{ id: string; name: string }> {
  const query = [
    `name = '${escapeDriveQueryValue(DRIVE_POC_FOLDER_NAME)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    `appProperties has { key='emprovexPoc' and value='true' }`,
  ].join(' and ');

  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    pageSize: '10',
    fields: 'files(id,name)',
  });
  const listResponse = await driveFetch(
    accessToken,
    `${DRIVE_API_BASE}/files?${params.toString()}`
  );
  const listed = (await listResponse.json()) as DriveListResponse<{ id: string; name: string }>;
  const existing = listed.files?.[0];
  if (existing) return existing;

  const createResponse = await driveFetch(accessToken, `${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_POC_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: {
        emprovexPoc: 'true',
        ownerApp: 'EMPROVEX',
      },
    }),
  });
  return createResponse.json() as Promise<{ id: string; name: string }>;
}

export async function validateDrivePocPdf(file: File): Promise<void> {
  if (file.type !== 'application/pdf') {
    throw new Error('Selecione um arquivo PDF para o teste do Google Drive.');
  }
  if (file.size <= 0 || file.size > MAX_DRIVE_POC_PDF_BYTES) {
    throw new Error('O PDF de teste deve possuir no máximo 10 MB.');
  }
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== '%PDF-') {
    throw new Error('O arquivo não possui uma assinatura PDF válida.');
  }
}

export async function uploadDrivePocPdf(
  accessToken: string,
  folderId: string,
  file: File
): Promise<DrivePocFile> {
  await validateDrivePocPdf(file);

  const boundary = `emprovex_${crypto.randomUUID()}`;
  const metadata = {
    name: file.name,
    mimeType: 'application/pdf',
    parents: [folderId],
    appProperties: {
      emprovexPoc: 'true',
      ownerApp: 'EMPROVEX',
    },
  };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: 'id,name,mimeType,size,createdTime,modifiedTime',
  });
  const response = await driveFetch(
    accessToken,
    `${DRIVE_UPLOAD_API_BASE}/files?${params.toString()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  return response.json() as Promise<DrivePocFile>;
}

export async function listDrivePocFiles(
  accessToken: string,
  folderId: string
): Promise<DrivePocFile[]> {
  const params = new URLSearchParams({
    q: `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false`,
    spaces: 'drive',
    pageSize: '100',
    orderBy: 'createdTime desc',
    fields: 'files(id,name,mimeType,size,createdTime,modifiedTime)',
  });
  const response = await driveFetch(
    accessToken,
    `${DRIVE_API_BASE}/files?${params.toString()}`
  );
  const payload = (await response.json()) as DriveListResponse<DrivePocFile>;
  return payload.files || [];
}

export async function downloadDrivePocFile(
  accessToken: string,
  fileId: string
): Promise<Blob> {
  const response = await driveFetch(
    accessToken,
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`
  );
  return response.blob();
}

export async function deleteDrivePocFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await driveFetch(
    accessToken,
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE' }
  );
}
