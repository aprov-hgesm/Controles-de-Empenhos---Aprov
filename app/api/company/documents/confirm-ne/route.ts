import { NextResponse } from 'next/server';
import { requireCompanyContext } from '../../../../../lib/server/companyAuthz';
import { parseEmpenhoPdfBytes } from '../../../../../lib/server/empenhoPdfParser';
import {
  CompanyDocumentError, extractedNeReview, sha256, validateUpload, validateNeReview,
} from '../../../../../lib/company/documents/model';
import { saveDocument } from '../../../../../lib/company/documents/server';
import { checkBodyLimit, companyDocumentErrorResponse, privateDocumentHeaders } from '../../../../../lib/company/documents/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reupload and reparse on server; a preview alone can never create a commitment. */
export async function POST(request: Request) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'documents:write' });
    checkBodyLimit(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new CompanyDocumentError('DOCUMENT_FILE_REQUIRED', 400);
    if (form.get('confirmed') !== 'true') throw new CompanyDocumentError('NE_HUMAN_CONFIRMATION_REQUIRED', 422);
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateUpload(file, bytes, 'ne');
    const hash = sha256(bytes);
    if (form.get('sourceSha256') !== hash) throw new CompanyDocumentError('NE_SOURCE_CHANGED', 409);
    let parsed;
    try { parsed = parseEmpenhoPdfBytes(bytes); }
    catch { throw new CompanyDocumentError('NE_PDF_UNRECOGNIZED', 422); }
    const extraction = extractedNeReview(parsed);
    const raw = form.get('review');
    if (typeof raw !== 'string' || raw.length > 150_000) throw new CompanyDocumentError('NE_REVIEW_INVALID', 422);
    let decoded: unknown;
    try { decoded = JSON.parse(raw); }
    catch { throw new CompanyDocumentError('NE_REVIEW_INVALID', 422); }
    const review = validateNeReview(decoded);
    const extractedIds = extraction.items.map(x => x.id).sort().join('|');
    const reviewedIds = review.items.map(x => x.id).sort().join('|');
    if (extractedIds !== reviewedIds) throw new CompanyDocumentError('NE_REVIEW_ITEM_MISMATCH', 422);
    const type = form.get('referenceType');
    const referenceId = form.get('referenceId');
    if ((type !== null || referenceId !== null) &&
      (type !== 'commitments' || typeof referenceId !== 'string')) {
      throw new CompanyDocumentError('DOCUMENT_REFERENCE_INVALID', 400);
    }
    const saved = await saveDocument({
      ctx, file, kind: 'ne',
      referenceType: type === 'commitments' ? type : null,
      referenceId: typeof referenceId === 'string' ? referenceId : null,
      idempotencyKey: request.headers.get('idempotency-key') || '',
      review, originalExtraction: extraction,
    });
    return NextResponse.json({ ok: true, result: saved },
      { status: saved.replayed ? 200 : 201, headers: privateDocumentHeaders });
  } catch (error) { return companyDocumentErrorResponse(error); }
}
