import {NextResponse} from 'next/server';
import {FounderAuthError} from '../../../../../lib/server/firebaseFounderAuth';
import {verifyPlatformPrincipal,PlatformAuthorizationError} from '../../../../../lib/server/platformAuthorization';
import {evaluateServerAuthorization} from '../../../../../lib/server/authorizationPolicy';
import {deleteCommissionsServer,CommissionDeleteError} from '../../../../../lib/server/coreCommissionDelete';
export const runtime='nodejs';export const dynamic='force-dynamic';
function reply(body:unknown,status:number){return NextResponse.json(body,{status,headers:{'cache-control':'private, no-store'}});}
export async function POST(request:Request){
  try{
    const actor=await verifyPlatformPrincipal(request.headers.get('authorization'));
    if(!evaluateServerAuthorization(actor,{capability:'core.comissoes.delete'}).allowed)
      return reply({ok:false,error:'COMMISSION_UNAUTHORIZED'},403);
    const raw=await request.text();
    if(Buffer.byteLength(raw)>30000)return reply({ok:false,error:'COMMISSION_TOO_LARGE'},413);
    let body:unknown;try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'COMMISSION_INVALID_JSON'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='ids')
      return reply({ok:false,error:'COMMISSION_INVALID_JSON'},400);
    const count=await deleteCommissionsServer(actor,(body as {ids:unknown}).ids);
    return reply({ok:true,deleted:count},200);
  }catch(error){
    if(error instanceof FounderAuthError||error instanceof PlatformAuthorizationError)
      return reply({ok:false,error:'COMMISSION_UNAUTHORIZED'},error.status);
    if(error instanceof CommissionDeleteError)return reply({ok:false,error:error.code},error.status);
    console.error('[core/commissions] unavailable',error instanceof Error?error.name:'error');
    return reply({ok:false,error:'COMMISSION_UNAVAILABLE'},503);
  }
}
