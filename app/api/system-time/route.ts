import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const serverNowMs = Date.now();

  return NextResponse.json(
    {
      serverNowMs,
      serverNowIso: new Date(serverNowMs).toISOString(),
      source: 'emprovex-server',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    }
  );
}
