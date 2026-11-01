import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { sendAdminDailyDigest } from '../../../../lib/server/adminDailyDigest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const headers = { 'Cache-Control': 'no-store, max-age=0' };

// Authenticates Google-signed Scheduler ID token, not caller-provided identity.
async function authorized(request: NextRequest) {
  const expectedEmail = process.env.EMPROVEX_ADMIN_DIGEST_SCHEDULER_EMAIL?.trim();
  const audience = process.env.EMPROVEX_ADMIN_DIGEST_OIDC_AUDIENCE?.trim();
  const authorization = request.headers.get('authorization') || '';
  if (!expectedEmail || !audience || !/^Bearer [^\s]+$/.test(authorization)) return false;
  try {
    const { payload } = await jwtVerify(authorization.slice(7), googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience,
      algorithms: ['RS256'],
      clockTolerance: '30s',
    });
    return payload.email === expectedEmail && payload.email_verified === true;
  } catch {
    return false;
  }
}
export async function POST(request: NextRequest) {
  if (process.env.EMPROVEX_ADMIN_DIGEST_ENABLED !== '1') {
    return NextResponse.json({ ok: false, code: 'DISABLED' }, { status: 503, headers });
  }
  if (!await authorized(request)) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401, headers });
  }
  try {
    const result = await sendAdminDailyDigest();
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    console.error('EMPROVEX_ADMIN_DIGEST_FAILED', {
      code: error instanceof Error ? error.message.slice(0, 100) : 'UNKNOWN',
    });
    return NextResponse.json({ ok: false, code: 'DIGEST_FAILED' }, { status: 503, headers });
  }
}
