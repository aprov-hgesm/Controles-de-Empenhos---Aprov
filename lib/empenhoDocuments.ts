'use client';

import type { User } from 'firebase/auth';
import { resolveDocumentStorageRef } from './documentStorage';
import {
  deleteWorkspaceDriveFile,
  fetchWorkspaceDrivePdf,
  uploadAndVerifyWorkspacePdf,
} from './googleDriveFiles';
import { requireWorkspaceDriveRuntime } from './workspaceDriveRuntime';
import type { EmpenhoPdfDocument } from './types';

export const MAX_EMPENHO_PDF_BYTES = 10 * 1024 * 1024;

type DocumentAction = 'view' | 'print' | 'download';

async function getAuthorizationHeader(user: User): Promise<Record<string, string>> {
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || 'Falha ao acessar o documento.';
  } catch {
    return 'Falha ao acessar o documento.';
  }
}

async function validatePdfBeforeUpload(file: File): Promise<void> {
  if (file.type !== 'application/pdf') {
    throw new Error('Selecione um arquivo no formato PDF.');
  }

  if (file.size <= 0 || file.size > MAX_EMPENHO_PDF_BYTES) {
    throw new Error('O PDF deve possuir no máximo 10 MB.');
  }

  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== '%PDF-') {
    throw new Error('O arquivo selecionado não possui uma assinatura PDF válida.');
  }
}

function createDriveLogicalPathname(workspaceId: string, empenhoId: string, fileId: string): string {
  const normalizedId = empenhoId.trim().toUpperCase();
  return `google-drive/${workspaceId}/empenhos/${normalizedId}/${fileId}`;
}

function fileIdFromDriveLogicalPathname(pathname: string): string | null {
  if (!pathname.startsWith('google-drive/')) return null;
  const parts = pathname.split('/');
  return parts.length >= 5 ? parts[parts.length - 1] || null : null;
}

export async function uploadEmpenhoPdf(
  user: User,
  empenhoId: string,
  file: File
): Promise<EmpenhoPdfDocument> {
  await validatePdfBeforeUpload(file);
  const runtime = requireWorkspaceDriveRuntime();

  const { file: driveFile, sha256 } = await uploadAndVerifyWorkspacePdf(
    runtime.session,
    runtime.settings.empenhosFolderId,
    file,
    file.name,
    {
      emprovexDocumentType: 'empenho',
      emprovexEmpenhoId: empenhoId.trim().toUpperCase(),
    }
  );

  return {
    id: crypto.randomUUID(),
    pathname: createDriveLogicalPathname(runtime.session.workspaceId, empenhoId, driveFile.id),
    originalName: file.name,
    contentType: 'application/pdf',
    size: driveFile.size || file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.email || user.uid,
    storage: {
      provider: 'google-drive',
      status: 'active',
      objectKey: driveFile.id,
      folderKey: runtime.settings.empenhosFolderId,
      workspaceId: runtime.session.workspaceId,
      sha256,
    },
  };
}

export async function deleteEmpenhoPdfUpload(
  user: User,
  empenhoId: string,
  pathnameOrDocument: string | EmpenhoPdfDocument
): Promise<void> {
  if (typeof pathnameOrDocument !== 'string') {
    const storage = resolveDocumentStorageRef(pathnameOrDocument);
    if (storage.provider === 'google-drive') {
      const runtime = requireWorkspaceDriveRuntime(storage.workspaceId);
      await deleteWorkspaceDriveFile(runtime.session, storage.objectKey);
      return;
    }
    pathnameOrDocument = pathnameOrDocument.pathname;
  }

  const driveFileId = fileIdFromDriveLogicalPathname(pathnameOrDocument);
  if (driveFileId) {
    const runtime = requireWorkspaceDriveRuntime();
    await deleteWorkspaceDriveFile(runtime.session, driveFileId);
    return;
  }

  const headers = await getAuthorizationHeader(user);
  const response = await fetch('/api/empenho-documents', {
    method: 'DELETE',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ empenhoId, pathname: pathnameOrDocument }),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(await readApiError(response));
  }
}

export async function fetchLegacyEmpenhoPdfBlob(
  user: User,
  empenhoId: string,
  pathname: string
): Promise<Blob> {
  const headers = await getAuthorizationHeader(user);
  const query = new URLSearchParams({ empenhoId, pathname });
  const response = await fetch(`/api/empenho-documents?${query.toString()}`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.blob();
}

export async function fetchEmpenhoPdfBlob(
  user: User,
  empenhoId: string,
  document: EmpenhoPdfDocument
): Promise<Blob> {
  const storage = resolveDocumentStorageRef(document);
  if (storage.status !== 'active') {
    throw new Error('O documento não está mais disponível no armazenamento ativo.');
  }

  if (storage.provider === 'google-drive') {
    const runtime = requireWorkspaceDriveRuntime(storage.workspaceId);
    return fetchWorkspaceDrivePdf(runtime.session, storage.objectKey);
  }

  return fetchLegacyEmpenhoPdfBlob(user, empenhoId, document.pathname);
}

function showLoadingMessage(target: Window, action: DocumentAction): void {
  const label = action === 'print' ? 'Preparando impressão segura…' : 'Abrindo documento seguro…';
  target.document.open();
  target.document.write(`<!doctype html><html lang="pt-BR"><head><title>Nota de Empenho</title></head><body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0b1c30;display:grid;place-items:center;height:100vh;margin:0"><p>${label}</p></body></html>`);
  target.document.close();
}

export async function runEmpenhoPdfAction(
  user: User,
  empenhoId: string,
  document: EmpenhoPdfDocument,
  action: DocumentAction
): Promise<void> {
  let targetWindow: Window | null = null;

  if (action !== 'download') {
    targetWindow = window.open('', '_blank');
    if (!targetWindow) {
      throw new Error('O navegador bloqueou a nova janela. Autorize pop-ups para o EMPROVEX.');
    }
    targetWindow.opener = null;
    showLoadingMessage(targetWindow, action);
  }

  try {
    const pdf = await fetchEmpenhoPdfBlob(user, empenhoId, document);
    const objectUrl = URL.createObjectURL(pdf);

    if (action === 'download') {
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.originalName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      return;
    }

    if (!targetWindow || targetWindow.closed) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('A janela do documento foi fechada antes do carregamento.');
    }

    targetWindow.location.replace(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60_000);

    if (action === 'print') {
      window.setTimeout(() => {
        try {
          targetWindow?.focus();
          targetWindow?.print();
        } catch {
          // A visualização permanece aberta para impressão pelo controle nativo do navegador.
        }
      }, 1_500);
    }
  } catch (error) {
    targetWindow?.close();
    throw error;
  }
}
