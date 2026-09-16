import 'server-only';

export const MAX_EMPENHO_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_VERSIONS_IN_FIRESTORE = 25;

const EMPENHO_ID_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,63}$/;

export class DocumentValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'DocumentValidationError';
    this.status = status;
  }
}

export function normalizeEmpenhoId(value: unknown): string {
  const empenhoId = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!EMPENHO_ID_PATTERN.test(empenhoId)) {
    throw new DocumentValidationError('Número de empenho inválido.');
  }
  return empenhoId;
}

export function assertEmpenhoPath(pathname: unknown, empenhoId: string): string {
  if (typeof pathname !== 'string' || pathname.length > 220) {
    throw new DocumentValidationError('Caminho de documento inválido.');
  }

  const expectedPrefix = `empenhos/${empenhoId}/`;
  if (!pathname.startsWith(expectedPrefix) || !pathname.endsWith('.pdf')) {
    throw new DocumentValidationError('Documento não pertence ao empenho informado.', 403);
  }

  if (pathname.includes('..') || pathname.includes('\\')) {
    throw new DocumentValidationError('Caminho de documento inválido.');
  }

  return pathname;
}

export function sanitizePdfFilename(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : 'nota-de-empenho.pdf';
  const withoutControls = raw.replace(/[\u0000-\u001F\u007F]/g, '');
  const basename = withoutControls.split(/[\\/]/).pop() || 'nota-de-empenho.pdf';
  const safe = basename.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120).trim();
  const withExtension = safe.toLocaleLowerCase('pt-BR').endsWith('.pdf') ? safe : `${safe}.pdf`;
  return withExtension || 'nota-de-empenho.pdf';
}

export function documentValidationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof DocumentValidationError)) {
    return null;
  }

  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
}
