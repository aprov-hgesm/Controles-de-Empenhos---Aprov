import { authorize, fail, ok, paging } from '../../../../../lib/company/routing/http';
import { requireCompanyContext } from '../../../../../lib/server/companyAuthz';
import { listDeliveries } from '../../../../../lib/company/delivery/service';
import { toVerifiedDeliveryCandidate } from '../../../../../lib/company/integration/deliveryCandidates.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read-only server projection: W11 cannot create W9 shipments or infer an ETA.
 * Both live capabilities must be present; pagination is scoped by W9.
 */
export async function GET(request: Request) {
  try {
    const ctx = await authorize(request, 'deliveryRoutes');
    await requireCompanyContext(request, { action: 'deliveries:read' });
    const { limit, cursor } = paging(request);
    const page = await listDeliveries(ctx, limit, cursor);
    const items = page.items
      .map((row: unknown) => toVerifiedDeliveryCandidate(row, ctx.companyId))
      .filter((row: unknown) => row !== null);
    return ok({items,nextCursor:page.nextCursor ?? null});
  } catch (error) { return fail(error); }
}
