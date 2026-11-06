import { NextResponse } from 'next/server';
import { CompanyMembershipError, membershipHttpError } from './index';
import { CompanyAccessError } from '../companySession';
import { CompanyAuthorizationError } from '../companyAuthz';

const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };
export function okMember<T>(result: T, status = 200) {
  return NextResponse.json({ ok: true, result }, { status, headers: HEADERS });
}
export function memberFailure(e: unknown) {
  const mapped = membershipHttpError(e);
  if (mapped) return NextResponse.json({ ok: false, code: mapped.code },
    { status: mapped.status, headers: HEADERS });
  if (e instanceof CompanyAuthorizationError || e instanceof CompanyAccessError) {
    return NextResponse.json({ ok: false, code: e.code },
      { status: e.status, headers: HEADERS });
  }
  return NextResponse.json({ ok: false, code: 'COMPANY_DIRECTORY_UNAVAILABLE' },
    { status: 503, headers: HEADERS });
}
export async function readMemberBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) throw new CompanyMembershipError('COMPANY_INVALID_INPUT', 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) throw new CompanyMembershipError('COMPANY_INVALID_INPUT', 400);
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally { reader.releaseLock(); }
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch { throw new CompanyMembershipError('COMPANY_INVALID_INPUT', 400); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CompanyMembershipError('COMPANY_INVALID_INPUT', 400);
  }
  return parsed as Record<string, unknown>;
}
