import { requireCompanyContext } from '../../../../../../../lib/server/companyAuthz';
import { companyEntity } from '../../../../../../../lib/company/documents/server';
import { getDelivery } from '../../../../../../../lib/company/delivery/service';
import { CompanyDocumentError } from '../../../../../../../lib/company/documents/model';
import { generateCompanyPdf, validatePdfSource, type ExportKind } from '../../../../../../../lib/company/documents/exportPdf';
import { companyDocumentErrorResponse, privateDocumentHeaders } from '../../../../../../../lib/company/documents/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** GET is read-only; never persists generated copies or records a message as sent. */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { kind, id } = await params;
    if (kind !== 'purchase-order' && kind !== 'packing-list') throw new CompanyDocumentError('PDF_KIND_INVALID', 400);
    const collection = kind === 'purchase-order' ? 'purchaseOrders' : 'deliveries';
    const ctx = await requireCompanyContext(request, { action: kind === 'purchase-order' ? 'purchaseOrders:read' : 'deliveries:read' });
    // W9 driver-scoped read blocks access to another driver's packing list.
    const record = kind === 'packing-list' ? await getDelivery(ctx, id) : await companyEntity(ctx, collection, id);
    await requireCompanyContext(request, {
      action: kind === 'purchase-order' ? 'purchaseOrders:read' : 'deliveries:read',
      resource: { companyId: String(record.companyId), workspaceId: String(record.workspaceId) },
    });
    const raw = record.pdfSnapshot;
    if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).id !== id) {
      throw new CompanyDocumentError('PDF_SNAPSHOT_NOT_READY', 422);
    }
    const source = validatePdfSource(raw, ctx.companyId);
    const result = generateCompanyPdf(kind as ExportKind, source);
    return new Response(new Uint8Array(result).buffer as ArrayBuffer, {
      status: 200, headers: {
        ...privateDocumentHeaders, 'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="' + kind + '-' + id + '.pdf"',
      },
    });
  } catch (error) { return companyDocumentErrorResponse(error); }
}
