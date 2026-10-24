import { NextRequest, NextResponse } from 'next/server';
import { verifyWarehouseRequest, WarehouseAccessError } from '../../../../lib/server/warehouseAccess';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { SectorProvisioningFailure } from '../../../../lib/server/sectorProvisioningAdmin';
import { bindWarehouseMobileTrust, WarehouseMobileTrustError } from '../../../../lib/server/warehouseMobileTrust.mjs';
import { WarehouseStoreError } from '../../../../lib/server/warehouseFirestoreTransaction';
import { warehouseMobileReadServer } from '../../../../lib/server/warehouseMobileRead';

export const runtime='nodejs';
export const dynamic='force-dynamic';
function reply(status:number,body:Record<string,unknown>) {
  return NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});
}
export async function POST(request:NextRequest) {
  try {
    const declared=Number(request.headers.get('content-length')||0);
    if(!Number.isFinite(declared)||declared>4096)return reply(413,{ok:false,error:'WAREHOUSE_MOBILE_READ_TOO_LARGE'});
    const raw=await request.text();
    if(Buffer.byteLength(raw,'utf8')>4096)return reply(413,{ok:false,error:'WAREHOUSE_MOBILE_READ_TOO_LARGE'});
    let body:unknown;
    try{body=JSON.parse(raw);}catch{return reply(400,{ok:false,error:'WAREHOUSE_MOBILE_READ_INVALID_JSON'});}
    if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{ok:false,error:'WAREHOUSE_MOBILE_READ_INVALID'});
    const input=body as Record<string,unknown>;
    if(Object.keys(input).sort().join(',')!=='read,workspaceId')
      return reply(400,{ok:false,error:'WAREHOUSE_MOBILE_READ_INVALID'});
    const verified=await verifyWarehouseRequest(request.headers.get('authorization'));
    const trusted=bindWarehouseMobileTrust(verified,{workspaceId:input.workspaceId,action:'MOBILE_READ'});
    const result=await warehouseMobileReadServer(trusted,input.read);
    return reply(200,{ok:true,result});
  }catch(e) {
    if(e instanceof WarehouseAccessError||e instanceof FounderAuthError)
      return reply(e.status,{ok:false,error:'WAREHOUSE_MOBILE_READ_UNAUTHORIZED'});
    if(e instanceof WarehouseMobileTrustError)
      return reply(e.status,{ok:false,error:e.message});
    if(e instanceof WarehouseStoreError)
      return reply(e.status,{ok:false,error:e.code});
    if(e instanceof SectorProvisioningFailure)
      return reply(503,{ok:false,error:'WAREHOUSE_MOBILE_READ_CONFIGURATION'});
    console.error('[warehouse/mobile-read] failed:',e instanceof Error?e.name:'unknown');
    return reply(503,{ok:false,error:'WAREHOUSE_MOBILE_READ_UNAVAILABLE'});
  }
}
