import { NextResponse } from 'next/server';
import { CompanyAuthorizationError } from '../../server/companyAuthz';
import { CompanyAccessError } from '../../server/companySession';
import { CompanyDocumentError } from './model';

export const privateDocumentHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
export function companyDocumentErrorResponse(error: unknown) {
  const recognized = error instanceof CompanyDocumentError
    || error instanceof CompanyAuthorizationError || error instanceof CompanyAccessError;
  const status = recognized ? error.status : 503;
  const code = recognized ? error.code : 'DOCUMENT_SERVICE_UNAVAILABLE';
  return NextResponse.json({ ok: false, code }, { status, headers: privateDocumentHeaders });
}
export function checkBodyLimit(request: Request, maxBytes = 13 * 1024 * 1024) {
  const len = request.headers.get('content-length');
  if (len && Number(len) > maxBytes) throw new CompanyDocumentError('DOCUMENT_SIZE_INVALID', 413);
}
