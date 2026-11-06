import { NextResponse } from 'next/server';
import { getLegacyAuthorizedProfile } from '../../../../lib/company/profiles/server';
import { companyErrorStatus, requireCompanyContext } from '../../../../lib/server/companyAuthz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control':'private, no-store, max-age=0', 'Vary':'Authorization, Cookie' };
const reply = (payload: unknown, status = 200) => NextResponse.json(payload,{status,headers});

/** Read-only compatibility: W10's multi-link discovery is not integrated yet. */
export async function GET(request: Request) {
  try {
    const profile = await getLegacyAuthorizedProfile(request);
    return reply({ ok:true, profiles:[profile], activeCompanyId:profile.companyId,
      canSwitch:false, integrationPending:true });
  } catch(e) {
    const status = companyErrorStatus(e);
    return reply({ok:false,code:status===503?'PROFILE_UNAVAILABLE':'PROFILE_FORBIDDEN'},status);
  }
}
/** Additional CNPJ creation MUST use W10's transaction + verified ownership proof. */
export async function POST(request: Request) {
  try { await requireCompanyContext(request,{action:'company:write'}); }
  catch(e) {
    const status=companyErrorStatus(e);
    return reply({ok:false,code:status===503?'PROFILE_UNAVAILABLE':'PROFILE_FORBIDDEN'},status);
  }
  return reply({ok:false,code:'PROFILE_INTEGRATION_REQUIRED'},503);
}
