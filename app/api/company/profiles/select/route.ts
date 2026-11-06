import { NextResponse } from 'next/server';
import { companyErrorStatus } from '../../../../../lib/server/companyAuthz';
import { selectCompanyProfile } from '../../../../../lib/server/companyProfiles/integration';
import { PROFILE_COOKIE, profileSetCookie } from '../../../../../lib/company/profiles/selection.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0', 'Vary':'Authorization, Cookie'};
export async function POST(request: Request) {
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')
      || Number(request.headers.get('content-length') || 0) > 1024) {
      return NextResponse.json({ok:false,code:'PROFILE_INVALID_INPUT'},{status:400,headers});
    }
    const body = await request.json() as { companyId?: unknown };
    const selected = await selectCompanyProfile(request,body.companyId);
    const reply = NextResponse.json({ok:true,activeCompanyId:selected.activeCompanyId},{headers});
    reply.headers.set('Set-Cookie',profileSetCookie(selected.cookie));
    return reply;
  } catch(e) {
    const status=companyErrorStatus(e);
    return NextResponse.json({ok:false,code:status===503?'PROFILE_UNAVAILABLE':'PROFILE_FORBIDDEN'}, {status,headers});
  }
}
