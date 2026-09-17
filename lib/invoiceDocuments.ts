'use client';

import type { User } from 'firebase/auth';
import { resolveDocumentStorageRef } from './documentStorage';
import {
  deleteWorkspaceDriveFile,
  fetchWorkspaceDrivePdf,
  uploadAndVerifyWorkspacePdf,
} from './googleDriveFiles';
import { requireWorkspaceDriveRuntime } from './workspaceDriveRuntime';
import type { InvoicePdfDocument } from './types';

export const MAX_INVOICE_PDF_BYTES = 10 * 1024 * 1024;

type DocumentAction = 'view' | 'print' | 'download';

async function validatePdfBeforeUpload(file: File): Promise<void> {
  if (file.type !== 'application/pdf') {
    throw new Error('Selecione um arquivo no formato PDF.');
  }
  if (file.size <= 0 || file.size > MAX_INVOICE_PDF_BYTES) {
    throw new Error('O PDF deve possuir no máximo 10 MB.');
  }
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== '%PDF-') {
    throw new Error('O arquivo selecionado não possui uma assinatura PDF válida.');
  }
}

function createDriveLogicalPathname(
  workspaceId: string,
  empenhoId: string,
  invoiceId: string,
  fileId: string
): string {
  return `google-drive/${workspaceId}/notas-fiscais/${empenhoId.trim().toUpperCase()}/${invoiceId.trim().toUpperCase()}/${fileId}`;
}

function fileIdFromDriveLogicalPathname(pathname: string): string | null {
  if (!pathname.startsWith('google-drive/')) return null;
  const parts = pathname.split('/');
  return parts.length >= 6 ? parts[parts.length - 1] || null : null;
}

export async function uploadInvoicePdf(
  user: User,
  empenhoId: string,
  invoiceId: string,
  file: File
): Promise<InvoicePdfDocument> {
  await validatePdfBeforeUpload(file);
  const runtime = requireWorkspaceDriveRuntime();

  const { file: driveFile, sha256 } = await uploadAndVerifyWorkspacePdf(
    runtime.session,
    runtime.settings.invoicesFolderId,
    file,
    file.name,
    {
      emprovexDocumentType: 'invoice',
      emprovexEmpenhoId: empenhoId.trim().toUpperCase(),
      emprovexInvoiceId: invoiceId.trim().toUpperCase(),
    }
  );

  return {
    id: crypto.randomUUID(),
    pathname: createDriveLogicalPathname(runtime.session.workspaceId, empenhoId, invoiceId, driveFile.id),
    originalName: file.name,
    contentType: 'application/pdf',
    size: driveFile.size || file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.email || user.uid,
    empenhoId,
    invoiceId,
    storage: {
      provider: 'google-drive',
      status: 'active',
      objectKey: driveFile.id,
      folderKey: runtime.settings.invoicesFolderId,
      workspaceId: runtime.session.workspaceId,
      sha256,
    },
  };
}

export async function deleteInvoicePdfUpload(
  user: User,
  empenhoId: string,
  invoiceId: string,
  pathnameOrDocument: string | InvoicePdfDocument
): Promise<void> {
  void user;
  void empenhoId;
  void invoiceId;

  if (typeof pathnameOrDocument !== 'string') {
    const storage = resolveDocumentStorageRef(pathnameOrDocument);
    const runtime = requireWorkspaceDriveRuntime(storage.workspaceId);
    await deleteWorkspaceDriveFile(runtime.session, storage.objectKey);
    return;
  }

  const driveFileId = fileIdFromDriveLogicalPathname(pathnameOrDocument);
  if (!driveFileId) {
    throw new Error('Documento sem referência válida do Google Drive.');
  }
  const runtime = requireWorkspaceDriveRuntime();
  await deleteWorkspaceDriveFile(runtime.session, driveFileId);
}

export async function fetchInvoicePdfBlob(user: User, document: InvoicePdfDocument): Promise<Blob> {
  void user;
  const storage = resolveDocumentStorageRef(document);
  if (storage.status !== 'active') {
    throw new Error('O documento não está mais disponível no armazenamento ativo.');
  }
  const runtime = requireWorkspaceDriveRuntime(storage.workspaceId);
  return fetchWorkspaceDrivePdf(runtime.session, storage.objectKey);
}

function showLoadingMessage(target: Window, action: DocumentAction): void {
  const label = action === 'print' ? 'Preparando impressão segura…' : 'Abrindo documento seguro…';
  target.document.open();
  target.document.write(`<!doctype html><html lang="pt-BR"><head><title>Nota Fiscal</title></head><body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0b1c30;display:grid;place-items:center;height:100vh;margin:0"><p>${label}</p></body></html>`);
  target.document.close();
}

export async function runInvoicePdfAction(
  user: User,
  document: InvoicePdfDocument,
  action: DocumentAction
): Promise<void> {
  let targetWindow: Window | null = null;
  if (action !== 'download') {
    targetWindow = window.open('', '_blank');
    if (!targetWindow) throw new Error('O navegador bloqueou a nova janela. Autorize pop-ups para o EMPROVEX.');
    targetWindow.opener = null;
    showLoadingMessage(targetWindow, action);
  }

  try {
    const pdf = await fetchInvoicePdfBlob(user, document);
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
