import { NextResponse } from 'next/server';
import { requireCompanyContext, companyErrorStatus } from '../../../../../lib/server/companyAuthz';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0', 'Vary':'Authorization, Cookie'};
/**
 * Deliberately disabled until W10 installs verified per-tenant guards for ALL
 * W1-W9 routes. It is unsafe to set an active-profile cookie while those routes
 * still resolve W0's singular workspace.
 */
export async function POST(request: Request) {
  try { await requireCompanyContext(request,{action:'company:read'}); }
  catch(e) {
    const status=companyErrorStatus(e);
    return NextResponse.json({ok:false,code:status===503?'PROFILE_UNAVAILABLE':'PROFILE_FORBIDDEN'}, {status,headers});
  }
  return NextResponse.json({ok:false,code:'PROFILE_INTEGRATION_REQUIRED'},
    {status:503,headers});
}
