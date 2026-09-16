'use client';

import type { User } from 'firebase/auth';
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

function createPrivatePathname(empenhoId: string): string {
  const normalizedId = empenhoId.trim().toUpperCase();
  return `empenhos/${normalizedId}/${Date.now()}-${crypto.randomUUID()}.pdf`;
}

export async function uploadEmpenhoPdf(
  user: User,
  empenhoId: string,
  file: File
): Promise<EmpenhoPdfDocument> {
  await validatePdfBeforeUpload(file);
  const { upload } = await import('@vercel/blob/client');
  const headers = await getAuthorizationHeader(user);
  const pathname = createPrivatePathname(empenhoId);

  const blob = await upload(pathname, file, {
    access: 'private',
    handleUploadUrl: '/api/empenho-documents/upload',
    clientPayload: JSON.stringify({ empenhoId }),
    headers,
    contentType: 'application/pdf',
    multipart: false,
  });

  try {
    const finalizeResponse = await fetch('/api/empenho-documents', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        empenhoId,
        pathname: blob.pathname,
        originalName: file.name,
      }),
    });

    if (!finalizeResponse.ok) {
      throw new Error(await readApiError(finalizeResponse));
    }

    const payload = (await finalizeResponse.json()) as { document: EmpenhoPdfDocument };
    return payload.document;
  } catch (error) {
    await fetch('/api/empenho-documents', {
      method: 'DELETE',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ empenhoId, pathname: blob.pathname }),
    }).catch(() => undefined);
    throw error;
  }
}

export async function deleteEmpenhoPdfUpload(
  user: User,
  empenhoId: string,
  pathname: string
): Promise<void> {
  const headers = await getAuthorizationHeader(user);
  await fetch('/api/empenho-documents', {
    method: 'DELETE',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ empenhoId, pathname }),
  });
}

async function fetchEmpenhoPdf(
  user: User,
  empenhoId: string,
  document: EmpenhoPdfDocument
): Promise<Blob> {
  const headers = await getAuthorizationHeader(user);
  const query = new URLSearchParams({
    empenhoId,
    pathname: document.pathname,
  });
  const response = await fetch(`/api/empenho-documents?${query.toString()}`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.blob();
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
    const pdf = await fetchEmpenhoPdf(user, empenhoId, document);
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
