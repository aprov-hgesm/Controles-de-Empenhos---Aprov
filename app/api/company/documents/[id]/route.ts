import { NextResponse } from 'next/server';
import { requireCompanyContext } from '../../../../../lib/server/companyAuthz';
import { readDocument } from '../../../../../lib/company/documents/server';
import { publicDocument } from '../../../../../lib/company/documents/model';
import { companyDocumentErrorResponse, privateDocumentHeaders } from '../../../../../lib/company/documents/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'documents:read' });
    const { id } = await params;
    const document = await readDocument(ctx, id);
    await requireCompanyContext(request, { action: 'documents:read', resource: {
      companyId: document.companyId, workspaceId: document.workspaceId,
    } });
    return NextResponse.json({ ok: true, result: publicDocument(document) }, { headers: privateDocumentHeaders });
  } catch (error) { return companyDocumentErrorResponse(error); }
}
