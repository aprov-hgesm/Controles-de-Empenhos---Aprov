import { NextResponse } from 'next/server';
import { companyErrorStatus, requireCompanyContext } from '../../../../../lib/server/companyAuthz';
import { getDocument } from '../../../../../lib/server/companyMembership/firestore';
import { normalizeCnpj } from '../../../../../lib/company/fiscal/wlg/index.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control':'private, no-store, max-age=0', 'Vary':'Authorization, Cookie',
  'X-Content-Type-Options':'nosniff' };
const failure = (error: unknown) => NextResponse.json({ok:false,code:'WLG_CONNECTION_UNAVAILABLE'},
  {status:companyErrorStatus(error),headers});
/** Status metadata ONLY; immutable tenant-bound Firestore documents, no secrets or tokens. */
export async function GET(request: Request) {
  try {
    const ctx = await requireCompanyContext(request, {action:'fiscal:read'});
    const root = 'supplierCompanyWorkspaces/' + ctx.companyId + '/fiscalConnections/wlg';
    const [stored,workspace] = await Promise.all([
      getDocument<Record<string,unknown>>(root),
      getDocument<Record<string,unknown>>('workspaces/' + ctx.companyId),
    ]);
    if(!workspace || workspace.value.id!==ctx.companyId || workspace.value.status!=='active')
      return NextResponse.json({ok:false,code:'WLG_WORKSPACE_FORBIDDEN'},{status:403,headers});
    if(!stored)return NextResponse.json({ok:true,connection:null,status:'not_configured'},{headers});
    const connection=stored.value;
    const profile=workspace.value.companyProfile as Record<string,unknown> | undefined;
    if(connection.companyId!==ctx.companyId || connection.workspaceId!==ctx.companyId
      || connection.provider!=='wlg' || !profile || typeof profile.cnpj!=='string'
      || normalizeCnpj(connection.cnpj)!==normalizeCnpj(profile.cnpj))
      return NextResponse.json({ok:false,code:'WLG_CONNECTION_INTEGRITY'},{status:503,headers});
    const verification=connection.verification as Record<string,unknown> | undefined;
    // Never expose providerEmpresaId, credentialRef, tokens or fiscal data from another CNPJ.
    return NextResponse.json({ok:true,connection:{provider:'wlg',
      status:connection.status,environment:connection.environment,
      issuerCnpj:profile.cnpj,
      verifiedAt:typeof verification?.verifiedAt==='string'?verification.verifiedAt:null,
      credentialVersion:typeof connection.credentialVersion==='number'?connection.credentialVersion:null,
    }},{headers});
  } catch(error) {return failure(error);}
}
/** WLG configuration requires issuer proof and secret vault not yet provisioned. */
export async function POST(request: Request) {
  try { await requireCompanyContext(request,{action:'fiscal:configure'}); }
  catch(error) {return failure(error);}
  return NextResponse.json({ok:false,code:'WLG_CONFIGURATION_DISABLED'},{status:503,headers});
}
export const PUT=POST;
export const DELETE=POST;
