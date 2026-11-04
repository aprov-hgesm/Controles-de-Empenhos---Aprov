import { NextRequest, NextResponse } from 'next/server';
import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import { readTrustedAlmoxSnapshot } from '../../../../lib/server/almoxarifadoPreview';
import { previewAlmoxSyntheticRequest, AlmoxIntegrationError } from '../../../../lib/almoxarifado/integration';
import { parseAlmoxHumanChoices } from '../../../../lib/almoxarifado/humanChoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY = 2_850_000;
function response(status:number, body:Record<string,unknown>) {
  return NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});
}
/** Read-only. Real SISCOFIS files are rejected by the W2 synthetic-layout gate. */
export async function POST(request:NextRequest) {
  try {
    const declared = Number(request.headers.get('content-length') || 0);
    if (!Number.isFinite(declared) || declared > MAX_BODY)
      return response(413,{ok:false,error:'ALMOX_SOURCE_TOO_LARGE'});
    // Resolve signed identity before parsing user-controlled contents.
    const access = await verifyWarehouseRequest(request.headers.get('authorization'));
    if (access.sectorType !== 'almoxarifado')
      return response(403,{ok:false,error:'ALMOX_IDENTITY_DENIED'});
    const raw = await request.text();
    if (Buffer.byteLength(raw,'utf8') > MAX_BODY)
      return response(413,{ok:false,error:'ALMOX_SOURCE_TOO_LARGE'});
    let payload:unknown;
    try { payload=JSON.parse(raw); } catch {
      return response(400,{ok:false,error:'ALMOX_INVALID_JSON'});
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return response(400,{ok:false,error:'ALMOX_INVALID_INPUT'});
    const x=payload as Record<string,unknown>;
    if (Object.keys(x).some(key => !['base64','format','filename','choices'].includes(key))
      || typeof x.base64 !== 'string' || x.base64.length > 2_796_208
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(x.base64)
      || (x.format !== 'TXT' && x.format !== 'PDF')
      || (x.filename !== undefined && x.filename !== null &&
          (typeof x.filename !== 'string' || x.filename.length > 120))) {
      return response(400,{ok:false,error:'ALMOX_INVALID_INPUT'});
    }
    let choices:ReturnType<typeof parseAlmoxHumanChoices>;
    try { choices=parseAlmoxHumanChoices(x.choices); } catch {
      return response(400,{ok:false,error:'ALMOX_CHOICES_INVALID'});
    }
    const source=Buffer.from(x.base64,'base64');
    if (!source.length || source.length > 2*1024*1024)
      return response(413,{ok:false,error:'ALMOX_SOURCE_TOO_LARGE'});
    const snapshot=await readTrustedAlmoxSnapshot(access);
    const preview=await previewAlmoxSyntheticRequest({
      access,source,format:x.format,filename:typeof x.filename === 'string' ? x.filename : null,
      snapshot,choices,organizationName:'OM - UG '+access.ug,
    });
    if (!preview.ok) return response(422,{ok:false,error:preview.issue.code,issue:preview.issue});
    return response(200,{ok:true,result:preview});
  } catch(e) {
    if(e instanceof WarehouseAccessError || e instanceof FounderAuthError)
      return response(e.status,{ok:false,error:'ALMOX_UNAUTHORIZED'});
    if(e instanceof AlmoxIntegrationError)
      return response(e.status,{ok:false,error:e.code});
    if(e instanceof WarehouseStoreError)
      return response(e.status,{ok:false,error:e.code});
    if(e instanceof SectorProvisioningFailure)
      return response(503,{ok:false,error:'ALMOX_CONFIGURATION'});
    console.error('[almox/preview] failed:',e instanceof Error?e.name:'unknown');
    return response(503,{ok:false,error:'ALMOX_PREVIEW_UNAVAILABLE'});
  }
}
