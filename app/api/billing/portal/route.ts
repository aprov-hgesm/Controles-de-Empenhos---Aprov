import { NextResponse } from 'next/server';
import { resolveBillingPortalSession, BillingPortalFailure } from '../../../../lib/server/billingPortalIdentity';
import { pilotEnabledFor } from '../../../../lib/server/payments/infinitepayPortalPilot.mjs';
import { readBillingCycleHistory } from '../../../../lib/server/billingRecentCycles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { workspace, account, email } = await resolveBillingPortalSession(request);
    const history = account?.status === 'exempt'
      ? { available: true, cycles: [] }
      : await readBillingCycleHistory(workspace.id);
    return NextResponse.json({
      workspaceName: workspace.name,
      accountStatus: account?.status ?? 'unavailable',
      accountExempt: account?.status === 'exempt',
      accountMonthlyCents: account?.monthlyPriceCents ?? null,
      trialEndsAt: account?.trialEndsAt || null,
      history,
      pilot: {
        enabled: Boolean(pilotEnabledFor({ email, workspaceId: workspace.id, env: process.env })),
        amountCents: 100,
        simulatedOnlyForExempt: true,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof BillingPortalFailure ? error.code : 'BILLING_PORTAL_UNAVAILABLE';
    const status = error instanceof BillingPortalFailure ? error.status : 503;
    return NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
