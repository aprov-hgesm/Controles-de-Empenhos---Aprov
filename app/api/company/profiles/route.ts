import { NextResponse } from 'next/server';
import { getCompanyProfiles, registerAdditionalCompanyQa } from '../../../../lib/server/companyProfiles/integration';
import { companyErrorStatus, requireCompanyContext } from '../../../../lib/server/companyAuthz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control':'private, no-store, max-age=0', 'Vary':'Authorization, Cookie' };
const reply = (payload: unknown, status = 200) => NextResponse.json(payload,{status,headers});

/** Read-only compatibility: W10's multi-link discovery is not integrated yet. */
export async function GET(request: Request) {
  try {
    return reply(await getCompanyProfiles(request));
  } catch(e) {
    const status = companyErrorStatus(e);
    return reply({ok:false,code:status===503?'PROFILE_UNAVAILABLE':'PROFILE_FORBIDDEN'},status);
  }
}
/** QA-only proof-backed, all-or-nothing additional company registration. */
export async function POST(request: Request) {
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')
      || Number(request.headers.get('content-length') || 0) > 2048) {
      return reply({ok:false,code:'PROFILE_INVALID_INPUT'},400);
    }
    const body = await request.json() as {
      proposedCompanyId?: unknown; legalName?: unknown;
      cnpj?: unknown; idempotencyKey?: unknown;
    };
    const result = await registerAdditionalCompanyQa(request,body);
    return reply({ok:true,result},result.outcome==='created'?201:200);
  } catch(e) {
    const status = e && typeof e==='object' && 'status' in e &&
      [400,401,403,409,503].includes(Number(e.status))
      ? Number(e.status) : companyErrorStatus(e);
    return reply({ok:false,code:status===409?'PROFILE_CONFLICT':status===400?
      'PROFILE_INVALID_INPUT':status===503?'PROFILE_UNAVAILABLE':'PROFILE_FORBIDDEN'},status);
  }
}
