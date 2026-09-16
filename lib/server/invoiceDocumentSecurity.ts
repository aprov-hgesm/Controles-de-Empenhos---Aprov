import 'server-only';

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

  if (pathname.includes('..') || pathname.includes('\\')) {
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

  if (pathname.includes('..') || pathname.includes('\\')) {
    throw new DocumentValidationError('Caminho de documento inválido.');
  }

  return pathname;
}

export function sanitizeInvoicePdfFilename(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : 'nota-fiscal.pdf';
  const withoutControls = raw.replace(/[\u0000-\u001F\u007F]/g, '');
  const basename = withoutControls.split(/[\\/]/).pop() || 'nota-fiscal.pdf';
  const safe = basename.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120).trim();
  const withExtension = safe.toLocaleLowerCase('pt-BR').endsWith('.pdf') ? safe : `${safe}.pdf`;
  return withExtension || 'nota-fiscal.pdf';
}
