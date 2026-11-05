import { NextResponse } from 'next/server';
import { requireCompanyContext } from '../../../../../lib/server/companyAuthz';
import { parseEmpenhoPdfBytes } from '../../../../../lib/server/empenhoPdfParser';
import {
  CompanyDocumentError, extractedNeReview, sha256, validateUpload,
} from '../../../../../lib/company/documents/model';
import { checkBodyLimit, companyDocumentErrorResponse, privateDocumentHeaders } from '../../../../../lib/company/documents/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Preview only: no Firestore mutation, file storage or acceptance of extracted values. */
export async function POST(request: Request) {
  try {
    await requireCompanyContext(request, { action: 'documents:write' });
    checkBodyLimit(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new CompanyDocumentError('DOCUMENT_FILE_REQUIRED', 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateUpload(file, bytes, 'ne');
    let parsed;
    try { parsed = parseEmpenhoPdfBytes(bytes); }
    catch { throw new CompanyDocumentError('NE_PDF_UNRECOGNIZED', 422); }
    return NextResponse.json({
      ok: true,
      result: {
        extracted: extractedNeReview(parsed), sourceSha256: sha256(bytes),
        warnings: parsed.warnings, pageCount: parsed.pageCountDetected,
        requiresHumanConfirmation: true, persisted: false,
      },
    }, { headers: privateDocumentHeaders });
  } catch (error) { return companyDocumentErrorResponse(error); }
}
