import { requireCompanyContext } from '../../../../../../lib/server/companyAuthz';
import { downloadDocument, readDocument } from '../../../../../../lib/company/documents/server';
import { safeFilename } from '../../../../../../lib/company/documents/model';
import { companyDocumentErrorResponse, privateDocumentHeaders } from '../../../../../../lib/company/documents/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Bearer-only streaming proxy: never exposes GCS object URL or signed public URL. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'documents:read' });
    const { id } = await params;
    const document = await readDocument(ctx, id);
    await requireCompanyContext(request, { action: 'documents:read', resource: {
      companyId: document.companyId, workspaceId: document.workspaceId,
    } });
    const bytes = await downloadDocument(ctx, document);
    return new Response(new Uint8Array(bytes).buffer as ArrayBuffer, {
      status: 200,
      headers: {
        ...privateDocumentHeaders, 'Content-Type': document.mediaType,
        'Content-Disposition': 'attachment; filename="' + safeFilename(document.displayName).replace(/[^\x20-\x7e]/g, '_') + '"',
        'Content-Length': String(bytes.byteLength),
      },
    });
  } catch (error) { return companyDocumentErrorResponse(error); }
}
