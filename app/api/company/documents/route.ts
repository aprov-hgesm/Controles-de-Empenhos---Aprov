import { NextResponse } from 'next/server';
import { requireCompanyContext } from '../../../../lib/server/companyAuthz';
import { CompanyDocumentError, type CompanyDocumentKind, type CompanyReference } from '../../../../lib/company/documents/model';
import { listDocuments, saveDocument } from '../../../../lib/company/documents/server';
import { checkBodyLimit, companyDocumentErrorResponse, privateDocumentHeaders } from '../../../../lib/company/documents/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'documents:read' });
    const pageToken = new URL(request.url).searchParams.get('pageToken') || undefined;
    const result = await listDocuments(ctx, pageToken);
    return NextResponse.json({ ok: true, result }, { headers: privateDocumentHeaders });
  } catch (error) { return companyDocumentErrorResponse(error); }
}

/** Upload attachments; NE must go through import-ne -> confirm-ne. */
export async function POST(request: Request) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'documents:write' });
    checkBodyLimit(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new CompanyDocumentError('DOCUMENT_FILE_REQUIRED', 400);
    const kind = form.get('kind');
    if (kind !== 'purchase' && kind !== 'proof' && kind !== 'other') {
      throw new CompanyDocumentError('DOCUMENT_KIND_INVALID', 400);
    }
    const referenceType = form.get('referenceType');
    const referenceId = form.get('referenceId');
    if (!(['commitments', 'purchaseOrders', 'deliveries'] as unknown[]).includes(referenceType)
      || typeof referenceId !== 'string') throw new CompanyDocumentError('DOCUMENT_REFERENCE_INVALID', 400);
    const saved = await saveDocument({
      ctx, file, kind: kind as CompanyDocumentKind,
      referenceType: referenceType as CompanyReference, referenceId,
      idempotencyKey: request.headers.get('idempotency-key') || '',
    });
    return NextResponse.json({ ok: true, result: saved },
      { status: saved.replayed ? 200 : 201, headers: privateDocumentHeaders });
  } catch (error) { return companyDocumentErrorResponse(error); }
}
