from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise RuntimeError(f"Trecho esperado não encontrado em {path}: {old[:120]!r}")
    if content.count(old) != 1:
        raise RuntimeError(f"Trecho não é único em {path}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


# -----------------------------------------------------------------------------
# Tipos
# -----------------------------------------------------------------------------
replace_once(
    "lib/types.ts",
    """export interface Empenho {\n""",
    """export interface InvoicePdfDocument {\n  id: string;\n  pathname: string;\n  originalName: string;\n  contentType: 'application/pdf';\n  size: number;\n  uploadedAt: string;\n  uploadedBy: string;\n  empenhoId: string;\n  invoiceId: string;\n}\n\nexport interface Empenho {\n""",
)
replace_once(
    "lib/types.ts",
    """  numeroNS?: string; // Número identificador do comprovante de liquidação (Nota de Sistema)\n}\n""",
    """  numeroNS?: string; // Número identificador do comprovante de liquidação (Nota de Sistema)\n  notaFiscalPdf?: InvoicePdfDocument;\n  notaFiscalPdfVersions?: InvoicePdfDocument[];\n}\n""",
)

# -----------------------------------------------------------------------------
# Segurança server-side para documentos de NF
# -----------------------------------------------------------------------------
write(
    "lib/server/invoiceDocumentSecurity.ts",
    """import 'server-only';

import {
  DocumentValidationError,
  documentValidationErrorResponse,
  isBlobConfigured,
  normalizeEmpenhoId,
} from './empenhoDocumentSecurity';

export { documentValidationErrorResponse, isBlobConfigured, normalizeEmpenhoId };

export const MAX_INVOICE_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_INVOICE_DOCUMENT_VERSIONS = 25;

const INVOICE_ID_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,79}$/;

export function normalizeInvoiceId(value: unknown): string {
  const invoiceId = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!INVOICE_ID_PATTERN.test(invoiceId)) {
    throw new DocumentValidationError('Número da Nota Fiscal inválido.');
  }
  return invoiceId;
}

export function assertInvoiceUploadPath(pathname: unknown, empenhoId: string, invoiceId: string): string {
  if (typeof pathname !== 'string' || pathname.length > 300) {
    throw new DocumentValidationError('Caminho de documento inválido.');
  }

  const expectedPrefix = `notas-fiscais/${empenhoId}/${invoiceId}/`;
  if (!pathname.startsWith(expectedPrefix) || !pathname.endsWith('.pdf')) {
    throw new DocumentValidationError('Documento não pertence à Nota Fiscal informada.', 403);
  }

  if (pathname.includes('..') || pathname.includes('\\\\')) {
    throw new DocumentValidationError('Caminho de documento inválido.');
  }

  return pathname;
}

export function assertStoredInvoicePath(pathname: unknown, empenhoId: string): string {
  if (typeof pathname !== 'string' || pathname.length > 300) {
    throw new DocumentValidationError('Caminho de documento inválido.');
  }

  const expectedPrefix = `notas-fiscais/${empenhoId}/`;
  if (!pathname.startsWith(expectedPrefix) || !pathname.endsWith('.pdf')) {
    throw new DocumentValidationError('Documento não pertence ao empenho informado.', 403);
  }

  if (pathname.includes('..') || pathname.includes('\\\\')) {
    throw new DocumentValidationError('Caminho de documento inválido.');
  }

  return pathname;
}

export function sanitizeInvoicePdfFilename(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : 'nota-fiscal.pdf';
  const withoutControls = raw.replace(/[\\u0000-\\u001F\\u007F]/g, '');
  const basename = withoutControls.split(/[\\\\/]/).pop() || 'nota-fiscal.pdf';
  const safe = basename.replace(/[^\\p{L}\\p{N}._ -]/gu, '_').slice(0, 120).trim();
  const withExtension = safe.toLocaleLowerCase('pt-BR').endsWith('.pdf') ? safe : `${safe}.pdf`;
  return withExtension || 'nota-fiscal.pdf';
}
""",
)

# -----------------------------------------------------------------------------
# API privada de documentos de NF
# -----------------------------------------------------------------------------
write(
    "app/api/invoice-documents/route.ts",
    """import { del, get } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import {
  assertInvoiceUploadPath,
  assertStoredInvoicePath,
  documentValidationErrorResponse,
  isBlobConfigured,
  MAX_INVOICE_PDF_BYTES,
  normalizeEmpenhoId,
  normalizeInvoiceId,
  sanitizeInvoicePdfFilename,
} from '../../../lib/server/invoiceDocumentSecurity';
import {
  authenticationErrorResponse,
  requireAuthorizedFirebaseUser,
} from '../../../lib/server/firebaseIdToken';
import type { InvoicePdfDocument } from '../../../lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function configurationError(): Response | null {
  if (!isBlobConfigured()) {
    return Response.json(
      { error: 'Vercel Blob privado ainda não foi conectado ao projeto.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return null;
}

async function hasPdfSignature(stream: ReadableStream<Uint8Array>): Promise<boolean> {
  const reader = stream.getReader();
  const bytes: number[] = [];
  try {
    while (bytes.length < 5) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const byte of value) {
        bytes.push(byte);
        if (bytes.length === 5) break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return String.fromCharCode(...bytes) === '%PDF-';
}

function privateDocumentHeaders(contentLength: number): HeadersInit {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Type': 'application/pdf',
    'Content-Length': String(contentLength),
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

export async function GET(request: Request): Promise<Response> {
  const configurationFailure = configurationError();
  if (configurationFailure) return configurationFailure;

  try {
    await requireAuthorizedFirebaseUser(request);
    const url = new URL(request.url);
    const empenhoId = normalizeEmpenhoId(url.searchParams.get('empenhoId'));
    normalizeInvoiceId(url.searchParams.get('invoiceId'));
    const pathname = assertStoredInvoicePath(url.searchParams.get('pathname'), empenhoId);
    const result = await get(pathname, { access: 'private', useCache: false });

    if (!result || result.statusCode !== 200) {
      return Response.json(
        { error: 'Documento não encontrado.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return new Response(result.stream, {
      status: 200,
      headers: privateDocumentHeaders(result.blob.size),
    });
  } catch (error) {
    const authenticationFailure = authenticationErrorResponse(error);
    if (authenticationFailure) return authenticationFailure;
    const validationFailure = documentValidationErrorResponse(error);
    if (validationFailure) return validationFailure;
    console.error('Falha ao recuperar documento da Nota Fiscal no Blob privado.');
    return Response.json(
      { error: 'Não foi possível recuperar o documento.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const configurationFailure = configurationError();
  if (configurationFailure) return configurationFailure;

  try {
    const user = await requireAuthorizedFirebaseUser(request);
    const body = (await request.json()) as {
      empenhoId?: unknown;
      invoiceId?: unknown;
      pathname?: unknown;
      originalName?: unknown;
    };
    const empenhoId = normalizeEmpenhoId(body.empenhoId);
    const invoiceId = normalizeInvoiceId(body.invoiceId);
    const pathname = assertInvoiceUploadPath(body.pathname, empenhoId, invoiceId);
    const originalName = sanitizeInvoicePdfFilename(body.originalName);
    const result = await get(pathname, { access: 'private', useCache: false });

    if (!result || result.statusCode !== 200) {
      return Response.json(
        { error: 'Upload não encontrado para validação.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const isValidPdf =
      result.blob.contentType === 'application/pdf' &&
      result.blob.size > 0 &&
      result.blob.size <= MAX_INVOICE_PDF_BYTES &&
      (await hasPdfSignature(result.stream));

    if (!isValidPdf) {
      await del(pathname).catch(() => undefined);
      return Response.json(
        { error: 'O arquivo enviado não é um PDF válido.' },
        { status: 415, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const document: InvoicePdfDocument = {
      id: randomUUID(),
      pathname,
      originalName,
      contentType: 'application/pdf',
      size: result.blob.size,
      uploadedAt: result.blob.uploadedAt.toISOString(),
      uploadedBy: user.email,
      empenhoId,
      invoiceId,
    };

    return Response.json({ document }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const authenticationFailure = authenticationErrorResponse(error);
    if (authenticationFailure) return authenticationFailure;
    const validationFailure = documentValidationErrorResponse(error);
    if (validationFailure) return validationFailure;
    console.error('Falha ao validar documento da Nota Fiscal no Blob privado.');
    return Response.json(
      { error: 'Não foi possível validar o PDF enviado.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const configurationFailure = configurationError();
  if (configurationFailure) return configurationFailure;

  try {
    await requireAuthorizedFirebaseUser(request);
    const body = (await request.json()) as { empenhoId?: unknown; pathname?: unknown };
    const empenhoId = normalizeEmpenhoId(body.empenhoId);
    const pathname = assertStoredInvoicePath(body.pathname, empenhoId);
    await del(pathname);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const authenticationFailure = authenticationErrorResponse(error);
    if (authenticationFailure) return authenticationFailure;
    const validationFailure = documentValidationErrorResponse(error);
    if (validationFailure) return validationFailure;
    console.error('Falha ao remover documento da Nota Fiscal no Blob privado.');
    return Response.json(
      { error: 'Não foi possível remover o documento.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
""",
)

write(
    "app/api/invoice-documents/upload/route.ts",
    """import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  assertInvoiceUploadPath,
  documentValidationErrorResponse,
  isBlobConfigured,
  MAX_INVOICE_PDF_BYTES,
  normalizeEmpenhoId,
  normalizeInvoiceId,
} from '../../../../lib/server/invoiceDocumentSecurity';
import {
  authenticationErrorResponse,
  requireAuthorizedFirebaseUser,
} from '../../../../lib/server/firebaseIdToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UploadClientPayload {
  empenhoId: string;
  invoiceId: string;
}

function configurationError(): Response | null {
  if (!isBlobConfigured()) {
    return Response.json(
      { error: 'Vercel Blob privado ainda não foi conectado ao projeto.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const configurationFailure = configurationError();
  if (configurationFailure) return configurationFailure;

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        await requireAuthorizedFirebaseUser(request);

        let payload: UploadClientPayload;
        try {
          payload = JSON.parse(clientPayload || '') as UploadClientPayload;
        } catch {
          throw new Error('Dados de upload inválidos.');
        }

        const empenhoId = normalizeEmpenhoId(payload.empenhoId);
        const invoiceId = normalizeInvoiceId(payload.invoiceId);
        assertInvoiceUploadPath(pathname, empenhoId, invoiceId);

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_INVOICE_PDF_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
        };
      },
    });

    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const authenticationFailure = authenticationErrorResponse(error);
    if (authenticationFailure) return authenticationFailure;
    const validationFailure = documentValidationErrorResponse(error);
    if (validationFailure) return validationFailure;
    console.error('Falha ao autorizar upload de documento da Nota Fiscal.');
    return Response.json(
      { error: 'Não foi possível autorizar o envio do PDF.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
""",
)

# -----------------------------------------------------------------------------
# Cliente de documentos de NF
# -----------------------------------------------------------------------------
write(
    "lib/invoiceDocuments.ts",
    """'use client';

import type { User } from 'firebase/auth';
import type { InvoicePdfDocument } from './types';

export const MAX_INVOICE_PDF_BYTES = 10 * 1024 * 1024;

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
  if (file.size <= 0 || file.size > MAX_INVOICE_PDF_BYTES) {
    throw new Error('O PDF deve possuir no máximo 10 MB.');
  }
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== '%PDF-') {
    throw new Error('O arquivo selecionado não possui uma assinatura PDF válida.');
  }
}

function createPrivatePathname(empenhoId: string, invoiceId: string): string {
  const normalizedEmpenhoId = empenhoId.trim().toUpperCase();
  const normalizedInvoiceId = invoiceId.trim().toUpperCase();
  return `notas-fiscais/${normalizedEmpenhoId}/${normalizedInvoiceId}/${Date.now()}-${crypto.randomUUID()}.pdf`;
}

export async function uploadInvoicePdf(
  user: User,
  empenhoId: string,
  invoiceId: string,
  file: File
): Promise<InvoicePdfDocument> {
  await validatePdfBeforeUpload(file);
  const { upload } = await import('@vercel/blob/client');
  const headers = await getAuthorizationHeader(user);
  const pathname = createPrivatePathname(empenhoId, invoiceId);

  const blob = await upload(pathname, file, {
    access: 'private',
    handleUploadUrl: '/api/invoice-documents/upload',
    clientPayload: JSON.stringify({ empenhoId, invoiceId }),
    headers,
    contentType: 'application/pdf',
    multipart: false,
  });

  try {
    const finalizeResponse = await fetch('/api/invoice-documents', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ empenhoId, invoiceId, pathname: blob.pathname, originalName: file.name }),
    });
    if (!finalizeResponse.ok) throw new Error(await readApiError(finalizeResponse));
    const payload = (await finalizeResponse.json()) as { document: InvoicePdfDocument };
    return payload.document;
  } catch (error) {
    await fetch('/api/invoice-documents', {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ empenhoId, pathname: blob.pathname }),
    }).catch(() => undefined);
    throw error;
  }
}

export async function deleteInvoicePdfUpload(
  user: User,
  empenhoId: string,
  pathname: string
): Promise<void> {
  const headers = await getAuthorizationHeader(user);
  const response = await fetch('/api/invoice-documents', {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ empenhoId, pathname }),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(await readApiError(response));
  }
}

async function fetchInvoicePdf(user: User, document: InvoicePdfDocument): Promise<Blob> {
  const headers = await getAuthorizationHeader(user);
  const query = new URLSearchParams({
    empenhoId: document.empenhoId,
    invoiceId: document.invoiceId,
    pathname: document.pathname,
  });
  const response = await fetch(`/api/invoice-documents?${query.toString()}`, {
    headers,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.blob();
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
    const pdf = await fetchInvoicePdf(user, document);
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
""",
)

# -----------------------------------------------------------------------------
# Componente visual separado para documento da Nota Fiscal
# -----------------------------------------------------------------------------
write(
    "components/InvoiceDocumentActions.tsx",
    """'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { User } from 'firebase/auth';
import { Download, Eye, FileText, Loader2, Printer, ShieldCheck, Upload } from 'lucide-react';
import {
  deleteInvoicePdfUpload,
  runInvoicePdfAction,
  uploadInvoicePdf,
} from '../lib/invoiceDocuments';
import type { Invoice, InvoicePdfDocument } from '../lib/types';

type ToastType = 'success' | 'error' | 'info';

interface InvoiceDocumentActionsProps {
  invoice: Invoice;
  user: User | null;
  onDocumentUploaded: (invoiceId: string, document: InvoicePdfDocument) => Promise<void>;
  onNotify: (message: string, type?: ToastType) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

export function InvoiceDocumentActions({
  invoice,
  user,
  onDocumentUploaded,
  onNotify,
}: InvoiceDocumentActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyAction, setBusyAction] = useState<'upload' | 'view' | 'print' | 'download' | null>(null);
  const currentDocument = invoice.notaFiscalPdf;

  const executeAction = async (action: 'view' | 'print' | 'download') => {
    if (!user || !currentDocument) return;
    setBusyAction(action);
    try {
      await runInvoicePdfAction(user, currentDocument, action);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Falha ao abrir o documento.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    let uploadedDocument: InvoicePdfDocument | null = null;
    setBusyAction('upload');
    try {
      uploadedDocument = await uploadInvoicePdf(user, invoice.empenhoId, invoice.id, file);
      await onDocumentUploaded(invoice.id, uploadedDocument);
      onNotify(
        currentDocument ? 'Nova versão do documento da Nota Fiscal anexada com segurança.' : 'Documento da Nota Fiscal anexado com segurança.',
        'success'
      );
    } catch (error) {
      if (uploadedDocument) {
        await deleteInvoicePdfUpload(user, uploadedDocument.empenhoId, uploadedDocument.pathname).catch(() => undefined);
      }
      onNotify(error instanceof Error ? error.message : 'Falha ao anexar o PDF.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-emerald-100 shadow-sm">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            {currentDocument ? <FileText className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-[#0b1c30]">Documento — Nota Fiscal</h4>
            {currentDocument ? (
              <>
                <p className="text-xs font-semibold text-gray-600 truncate mt-0.5">{currentDocument.originalName}</p>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  {formatBytes(currentDocument.size)} • {invoice.notaFiscalPdfVersions?.length || 1} versão(ões) protegida(s)
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 font-medium mt-0.5">Nenhum PDF da Nota Fiscal anexado.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentDocument && (
            <>
              <button type="button" onClick={() => executeAction('view')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-blue-100 bg-blue-50 text-[#00288e] hover:bg-blue-100 disabled:opacity-50 text-xs font-bold transition-all" title="Visualizar Nota Fiscal">
                {busyAction === 'view' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Visualizar
              </button>
              <button type="button" onClick={() => executeAction('print')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 text-xs font-bold transition-all" title="Imprimir Nota Fiscal sem baixar">
                {busyAction === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />} Imprimir
              </button>
              <button type="button" onClick={() => executeAction('download')} disabled={busyAction !== null} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 text-xs font-bold transition-all" title="Baixar Nota Fiscal">
                {busyAction === 'download' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar
              </button>
            </>
          )}
          <button type="button" onClick={() => inputRef.current?.click()} disabled={!user || busyAction !== null} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 text-xs font-bold transition-all">
            {busyAction === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {currentDocument ? 'Substituir PDF' : 'Anexar PDF'}
          </button>
        </div>
      </div>
    </section>
  );
}
""",
)

# -----------------------------------------------------------------------------
# Hook de Notas Fiscais: upload no ato do cadastro + persistência + limpeza
# -----------------------------------------------------------------------------
replace_once(
    "features/notas-fiscais/hooks/useNotasFiscaisActions.ts",
    """import type { Alert, Comissao, Empenho, Invoice, InvoiceItem } from '../../../lib/types';\nimport { saveAlert, saveEmpenho, saveInvoice, removeInvoice, removeComissao, saveComissao } from '../../../lib/firebaseSync';\n""",
    """import type { Alert, Comissao, Empenho, Invoice, InvoiceItem, InvoicePdfDocument } from '../../../lib/types';\nimport { saveAlert, saveEmpenho, saveInvoice, removeInvoice, removeComissao, saveComissao } from '../../../lib/firebaseSync';\nimport { deleteInvoicePdfUpload, uploadInvoicePdf } from '../../../lib/invoiceDocuments';\n""",
)
replace_once(
    "features/notas-fiscais/hooks/useNotasFiscaisActions.ts",
    """  // Save or Edit registered Invoice (\"Salvar Recebimento\")\n  const handleSaveInvoice = async () => {\n""",
    """  const removeInvoiceDocuments = async (invoice: Invoice) => {\n    if (!user) return;\n    const documents = [\n      ...(invoice.notaFiscalPdfVersions || []),\n      ...(invoice.notaFiscalPdf ? [invoice.notaFiscalPdf] : []),\n    ].filter((document, index, all) => all.findIndex((item) => item.pathname === document.pathname) === index);\n    await Promise.allSettled(\n      documents.map((document) => deleteInvoicePdfUpload(user, document.empenhoId, document.pathname))\n    );\n  };\n\n  // Save or Edit registered Invoice (\"Salvar Recebimento\")\n  const handleSaveInvoice = async (invoicePdfFile?: File | null): Promise<boolean> => {\n""",
)
# Returns de validação dentro do fluxo de cadastro
for old in [
    """      showToast('Selecione um empenho válido.', 'error');\n      return;\n""",
    """      showToast('Por favor, insira o número da Nota Fiscal.', 'error');\n      return;\n""",
    """      showToast(`A Nota Fiscal nº ${cleanNfNum} já está cadastrada no sistema! Utilize o botão de edição na lista de notas para alterá-la.`, 'error');\n      return;\n""",
    """      showToast('Por favor, insira a quantidade para pelo menos um item da NF.', 'error');\n      return;\n""",
    """      showToast(`A quantidade inserida para \"${exceededItemName}\" excede o saldo disponível do empenho!`, 'error');\n      return;\n""",
]:
    replace_once("features/notas-fiscais/hooks/useNotasFiscaisActions.ts", old, old.replace("return;", "return false;"))

replace_once(
    "features/notas-fiscais/hooks/useNotasFiscaisActions.ts",
    """     // Process & update database state\n    const invoiceTotal = enteredItems.reduce((sum, item) => sum + item.subtotal, 0);\n     const invoiceToSave: Invoice = {\n""",
    """     // Process & update database state\n    const invoiceTotal = enteredItems.reduce((sum, item) => sum + item.subtotal, 0);\n\n    let uploadedInvoicePdf: InvoicePdfDocument | undefined;\n    if (invoicePdfFile) {\n      if (!user) {\n        showToast('Faça login novamente antes de anexar o PDF da Nota Fiscal.', 'error');\n        return false;\n      }\n      try {\n        uploadedInvoicePdf = await uploadInvoicePdf(user, selectedNFCommitmentId, cleanNfNum, invoicePdfFile);\n      } catch (error) {\n        showToast(error instanceof Error ? error.message : 'Falha ao anexar o PDF da Nota Fiscal.', 'error');\n        return false;\n      }\n    }\n\n    const previousPdfVersions = editingInvoice?.notaFiscalPdfVersions ||\n      (editingInvoice?.notaFiscalPdf ? [editingInvoice.notaFiscalPdf] : []);\n    const nextPdfVersions = uploadedInvoicePdf\n      ? [...previousPdfVersions, uploadedInvoicePdf]\n          .filter((document, index, all) => all.findIndex((item) => item.pathname === document.pathname) === index)\n          .slice(-25)\n      : editingInvoice?.notaFiscalPdfVersions;\n    const currentInvoicePdf = uploadedInvoicePdf || editingInvoice?.notaFiscalPdf;\n\n     const invoiceToSave: Invoice = {\n""",
)
replace_once(
    "features/notas-fiscais/hooks/useNotasFiscaisActions.ts",
    """      ...(editingInvoice?.termoNumero ? { termoNumero: editingInvoice.termoNumero } : {}),\n    };\n""",
    """      ...(editingInvoice?.termoNumero ? { termoNumero: editingInvoice.termoNumero } : {}),\n      ...(currentInvoicePdf ? { notaFiscalPdf: currentInvoicePdf } : {}),\n      ...(nextPdfVersions?.length ? { notaFiscalPdfVersions: nextPdfVersions } : {}),\n    };\n""",
)
replace_once(
    "features/notas-fiscais/hooks/useNotasFiscaisActions.ts",
    """    // Redirect to accompanying subtab of Notas Fiscais\n    setNfSubTab('acompanhar');\n  };\n\n  const handleEditInvoice = (invoice: Invoice) => {\n""",
    """    // Redirect to accompanying subtab of Notas Fiscais\n    setNfSubTab('acompanhar');\n    return true;\n  };\n\n  const handleInvoiceDocumentUploaded = async (invoiceId: string, document: InvoicePdfDocument) => {\n    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId);\n    if (!targetInvoice) {\n      throw new Error('Nota Fiscal não encontrada para vincular o documento.');\n    }\n\n    const priorVersions = targetInvoice.notaFiscalPdfVersions ||\n      (targetInvoice.notaFiscalPdf ? [targetInvoice.notaFiscalPdf] : []);\n    const versions = [...priorVersions, document]\n      .filter((item, index, all) => all.findIndex((candidate) => candidate.pathname === item.pathname) === index)\n      .slice(-25);\n    const updatedInvoice: Invoice = {\n      ...targetInvoice,\n      notaFiscalPdf: document,\n      notaFiscalPdfVersions: versions,\n    };\n\n    setInvoices((current) => current.map((invoice) => invoice.id === invoiceId ? updatedInvoice : invoice));\n    if (user) await saveInvoice(user.uid, updatedInvoice);\n  };\n\n  const handleEditInvoice = (invoice: Invoice) => {\n""",
)
replace_once(
    "features/notas-fiscais/hooks/useNotasFiscaisActions.ts",
    """     if (user) {\n      try {\n        await Promise.all([\n          updatedTargetEmpenho ? saveEmpenho(user.uid, updatedTargetEmpenho) : Promise.resolve(),\n          removeInvoice(user.uid, invoice.id),\n        ]);\n""",
    """     if (user) {\n      try {\n        await removeInvoiceDocuments(invoice);\n        await Promise.all([\n          updatedTargetEmpenho ? saveEmpenho(user.uid, updatedTargetEmpenho) : Promise.resolve(),\n          removeInvoice(user.uid, invoice.id),\n        ]);\n""",
)
replace_once(
    "features/notas-fiscais/hooks/useNotasFiscaisActions.ts",
    """    if (user) {\n      try {\n        const promises = [\n          ...updatedEmpenhos.map(emp => saveEmpenho(user.uid, emp)),\n          ...invoices.map(inv => removeInvoice(user.uid, inv.id))\n        ];\n""",
    """    if (user) {\n      try {\n        await Promise.all(invoices.map((invoice) => removeInvoiceDocuments(invoice)));\n        const promises = [\n          ...updatedEmpenhos.map(emp => saveEmpenho(user.uid, emp)),\n          ...invoices.map(inv => removeInvoice(user.uid, inv.id))\n        ];\n""",
)
replace_once(
    "features/notas-fiscais/hooks/useNotasFiscaisActions.ts",
    """    handleSaveInvoice,\n    handleEditInvoice,\n""",
    """    handleSaveInvoice,\n    handleInvoiceDocumentUploaded,\n    handleEditInvoice,\n""",
)

# -----------------------------------------------------------------------------
# View: campo no cadastro e separação visual NF x Nota de Empenho
# -----------------------------------------------------------------------------
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """import React from 'react';\nimport { EmpenhoDocumentActions } from '../../../components/EmpenhoDocumentActions';\n""",
    """import React, { useRef, useState } from 'react';\nimport { EmpenhoDocumentActions } from '../../../components/EmpenhoDocumentActions';\nimport { InvoiceDocumentActions } from '../../../components/InvoiceDocumentActions';\nimport { MAX_INVOICE_PDF_BYTES } from '../../../lib/invoiceDocuments';\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """import { AlertTriangle, ArrowUpDown, Calendar, Check, CheckCircle2, Clock, Edit, FileDown, FileText, Package, Save, Search, Trash2, UserCheck, Users } from 'lucide-react';\n""",
    """import { AlertTriangle, ArrowUpDown, Calendar, Check, CheckCircle2, Clock, Edit, FileDown, FileText, Loader2, Package, Save, Search, Trash2, Upload, UserCheck, Users, X } from 'lucide-react';\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """  handleEmpenhoDocumentUploaded: (...args: any[]) => any;\n  handleMarkComissao: (...args: any[]) => any;\n""",
    """  handleEmpenhoDocumentUploaded: (...args: any[]) => any;\n  handleInvoiceDocumentUploaded: (...args: any[]) => any;\n  handleMarkComissao: (...args: any[]) => any;\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """handleEditInvoice, handleEmpenhoDocumentUploaded, handleMarkComissao""",
    """handleEditInvoice, handleEmpenhoDocumentUploaded, handleInvoiceDocumentUploaded, handleMarkComissao""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """  const { comissaoAux1Nome, comissaoAux1Posto, comissaoAux2Nome, comissaoAux2Posto, comissaoAux3Nome, comissaoAux3Posto, comissaoBoletimDate, comissaoBoletimNum, comissaoMes, comissaoPresNome, comissaoPresPosto, comissoes, editingInvoice, empenhos, formatDateOnly, formatDateTime, handleDeleteAllComissoes, handleDeleteAllInvoices, handleDeleteInvoice, handleDownloadTermoRecebimento, handleEditInvoice, handleEmpenhoDocumentUploaded, handleInvoiceDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleSaveComissao, handleSaveInvoice, invoices, nfDate, nfEmpenhoFilter, nfMonthFilter, nfNumber, nfQuantities, nfSearch, nfSortOrder, nfSubTab, nfTramitacaoFilter, selectedNFCommitmentId, setActiveTab, setComissaoAux1Nome, setComissaoAux1Posto, setComissaoAux2Nome, setComissaoAux2Posto, setComissaoAux3Nome, setComissaoAux3Posto, setComissaoBoletimDate, setComissaoBoletimNum, setComissaoMes, setComissaoPresNome, setComissaoPresPosto, setComissoes, setEditingEmpenhoId, setEditingInvoice, setNfDate, setNfEmpenhoFilter, setNfMonthFilter, setNfNumber, setNfQuantities, setNfSearch, setNfSortOrder, setNfSubTab, setNfTramitacaoFilter, setSelectedNFCommitmentId, showToast, uniqueNfMonths, user } = context;\n  return (\n""",
    """  const { comissaoAux1Nome, comissaoAux1Posto, comissaoAux2Nome, comissaoAux2Posto, comissaoAux3Nome, comissaoAux3Posto, comissaoBoletimDate, comissaoBoletimNum, comissaoMes, comissaoPresNome, comissaoPresPosto, comissoes, editingInvoice, empenhos, formatDateOnly, formatDateTime, handleDeleteAllComissoes, handleDeleteAllInvoices, handleDeleteInvoice, handleDownloadTermoRecebimento, handleEditInvoice, handleEmpenhoDocumentUploaded, handleInvoiceDocumentUploaded, handleMarkComissao, handleMarkTesouraria, handleSaveComissao, handleSaveInvoice, invoices, nfDate, nfEmpenhoFilter, nfMonthFilter, nfNumber, nfQuantities, nfSearch, nfSortOrder, nfSubTab, nfTramitacaoFilter, selectedNFCommitmentId, setActiveTab, setComissaoAux1Nome, setComissaoAux1Posto, setComissaoAux2Nome, setComissaoAux2Posto, setComissaoAux3Nome, setComissaoAux3Posto, setComissaoBoletimDate, setComissaoBoletimNum, setComissaoMes, setComissaoPresNome, setComissaoPresPosto, setComissoes, setEditingEmpenhoId, setEditingInvoice, setNfDate, setNfEmpenhoFilter, setNfMonthFilter, setNfNumber, setNfQuantities, setNfSearch, setNfSortOrder, setNfSubTab, setNfTramitacaoFilter, setSelectedNFCommitmentId, showToast, uniqueNfMonths, user } = context;\n  const nfPdfInputRef = useRef<HTMLInputElement>(null);\n  const [nfPdfFile, setNfPdfFile] = useState<File | null>(null);\n  const [isSavingInvoice, setIsSavingInvoice] = useState(false);\n\n  const handleNfPdfSelection = (event: React.ChangeEvent<HTMLInputElement>) => {\n    const file = event.target.files?.[0];\n    event.target.value = '';\n    if (!file) return;\n    if (file.type !== 'application/pdf' || !file.name.toLocaleLowerCase('pt-BR').endsWith('.pdf')) {\n      showToast('Selecione um arquivo PDF válido para a Nota Fiscal.', 'error');\n      return;\n    }\n    if (file.size <= 0 || file.size > MAX_INVOICE_PDF_BYTES) {\n      showToast('O PDF da Nota Fiscal deve possuir no máximo 10 MB.', 'error');\n      return;\n    }\n    setNfPdfFile(file);\n  };\n\n  return (\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """                  onClick={() => setNfSubTab('cadastrar')}\n""",
    """                  onClick={() => { setNfPdfFile(null); setNfSubTab('cadastrar'); }}\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """                                <EmpenhoDocumentActions\n                                  empenho={empenhos.find((emp) => emp.id === inv.empenhoId)}\n                                  user={user}\n                                  variant=\"compact\"\n                                  onDocumentUploaded={handleEmpenhoDocumentUploaded}\n                                  onNotify={showToast}\n                                />\n""",
    """""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """                                  onClick={() => handleEditInvoice(inv)}\n""",
    """                                  onClick={() => { setNfPdfFile(null); handleEditInvoice(inv); }}\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """                          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4 pt-1\">\n""",
    """                          <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-3\">\n                            <InvoiceDocumentActions\n                              invoice={inv}\n                              user={user}\n                              onDocumentUploaded={handleInvoiceDocumentUploaded}\n                              onNotify={showToast}\n                            />\n                            <EmpenhoDocumentActions\n                              empenho={empenhos.find((emp) => emp.id === inv.empenhoId)}\n                              user={user}\n                              variant=\"panel\"\n                              onDocumentUploaded={handleEmpenhoDocumentUploaded}\n                              onNotify={showToast}\n                            />\n                          </div>\n\n                          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4 pt-1\">\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """                              onClick={() => setNfSubTab('cadastrar')}\n""",
    """                              onClick={() => { setNfPdfFile(null); setNfSubTab('cadastrar'); }}\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """                          setEditingInvoice(null);\n                          setNfNumber('');\n""",
    """                          setEditingInvoice(null);\n                          setNfPdfFile(null);\n                          setNfNumber('');\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """                    </div>\n                  </section>\n\n                  {/* Step 3: Items reconciliation table */}\n""",
    """                    </div>\n\n                    <div className=\"rounded-xl border border-emerald-100 bg-emerald-50/40 p-4\">\n                      <input ref={nfPdfInputRef} type=\"file\" accept=\"application/pdf,.pdf\" className=\"hidden\" onChange={handleNfPdfSelection} />\n                      <div className=\"flex flex-col sm:flex-row sm:items-center justify-between gap-3\">\n                        <div className=\"min-w-0\">\n                          <p className=\"text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5\"><FileText className=\"w-4 h-4\" /> Documento — Nota Fiscal</p>\n                          {nfPdfFile ? (\n                            <p className=\"text-xs font-semibold text-gray-700 truncate mt-1\">{nfPdfFile.name} • {(nfPdfFile.size / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB</p>\n                          ) : editingInvoice?.notaFiscalPdf ? (\n                            <p className=\"text-xs font-semibold text-gray-600 truncate mt-1\">Atual: {editingInvoice.notaFiscalPdf.originalName}. Selecione outro PDF somente para substituir.</p>\n                          ) : (\n                            <p className=\"text-xs text-gray-500 font-medium mt-1\">Opcional. Anexe o PDF digitalizado da NF; o arquivo ficará em armazenamento privado.</p>\n                          )}\n                        </div>\n                        <div className=\"flex items-center gap-2 flex-shrink-0\">\n                          {nfPdfFile && (\n                            <button type=\"button\" onClick={() => setNfPdfFile(null)} className=\"inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-100 bg-white text-rose-600 hover:bg-rose-50 text-xs font-bold\">\n                              <X className=\"w-3.5 h-3.5\" /> Remover\n                            </button>\n                          )}\n                          <button type=\"button\" onClick={() => nfPdfInputRef.current?.click()} className=\"inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold\">\n                            <Upload className=\"w-3.5 h-3.5\" /> {nfPdfFile || editingInvoice?.notaFiscalPdf ? 'Selecionar outro PDF' : 'Anexar PDF'}\n                          </button>\n                        </div>\n                      </div>\n                    </div>\n                  </section>\n\n                  {/* Step 3: Items reconciliation table */}\n""",
)
replace_once(
    "features/notas-fiscais/components/NotasFiscaisView.tsx",
    """                                onClick={handleSaveInvoice}\n                                className=\"h-12 px-6 sm:px-8 bg-[#00288e] text-white rounded-full font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all duration-100 hover:bg-[#1e40af] flex items-center gap-2\"\n                              >\n                                <Save className=\"w-4 h-4\" /> Salvar Recebimento\n""",
    """                                onClick={async () => {\n                                  if (isSavingInvoice) return;\n                                  setIsSavingInvoice(true);\n                                  try {\n                                    const saved = await handleSaveInvoice(nfPdfFile);\n                                    if (saved) setNfPdfFile(null);\n                                  } finally {\n                                    setIsSavingInvoice(false);\n                                  }\n                                }}\n                                disabled={isSavingInvoice}\n                                className=\"h-12 px-6 sm:px-8 bg-[#00288e] text-white rounded-full font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all duration-100 hover:bg-[#1e40af] flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait\"\n                              >\n                                {isSavingInvoice ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Save className=\"w-4 h-4\" />} {isSavingInvoice ? 'Salvando e enviando PDF…' : 'Salvar Recebimento'}\n""",
)

# -----------------------------------------------------------------------------
# Wiring na page
# -----------------------------------------------------------------------------
replace_once(
    "app/page.tsx",
    """    handleSaveInvoice,\n    handleEditInvoice,\n""",
    """    handleSaveInvoice,\n    handleInvoiceDocumentUploaded,\n    handleEditInvoice,\n""",
)
replace_once(
    "app/page.tsx",
    """handleEditInvoice, handleEmpenhoDocumentUploaded, handleMarkComissao""",
    """handleEditInvoice, handleEmpenhoDocumentUploaded, handleInvoiceDocumentUploaded, handleMarkComissao""",
)

print('Invoice PDF documents v16 applied successfully.')
