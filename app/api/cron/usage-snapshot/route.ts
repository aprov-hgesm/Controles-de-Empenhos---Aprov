import { NextRequest, NextResponse } from 'next/server';

import {
  isGoogleCloudMonitoringConfigured,
  loadPreviousFirebaseBillingDayObservation,
} from '../../../../lib/server/googleCloudMonitoring';
import { persistGlobalUsageObservation } from '../../../../lib/server/globalUsageHistory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorizedCron(request)) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      }
    );
  }

  if (!isGoogleCloudMonitoringConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: 'CLOUD_MONITORING_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  try {
    const observation = await loadPreviousFirebaseBillingDayObservation();
    const persisted = await persistGlobalUsageObservation(observation);

    return NextResponse.json({
      ok: true,
      persisted,
      dayStartedAt: observation.snapshot.windowStartedAt,
      dayEndedAt: observation.snapshot.windowEndedAt,
      billableReadUnits: observation.snapshot.billableReadUnits,
      readUnitsDailyLimit: observation.snapshot.billingReference.readUnitsDailyLimit,
    });
  } catch (error) {
    console.error('Falha na consolidação diária automática de consumo.', {
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        ok: false,
        code: 'USAGE_SNAPSHOT_FAILED',
      },
      { status: 502 }
    );
  }
}
