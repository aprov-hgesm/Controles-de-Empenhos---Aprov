import { del, get } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import {
  assertInvoiceUploadPath,
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
    const invoiceId = normalizeInvoiceId(url.searchParams.get('invoiceId'));
    const pathname = assertInvoiceUploadPath(url.searchParams.get('pathname'), empenhoId, invoiceId);
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
    const body = (await request.json()) as { empenhoId?: unknown; invoiceId?: unknown; pathname?: unknown };
    const empenhoId = normalizeEmpenhoId(body.empenhoId);
    const invoiceId = normalizeInvoiceId(body.invoiceId);
    const pathname = assertInvoiceUploadPath(body.pathname, empenhoId, invoiceId);
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
