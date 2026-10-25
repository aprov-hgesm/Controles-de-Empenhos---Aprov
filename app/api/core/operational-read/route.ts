import {NextResponse} from 'next/server';
import {FounderAuthError} from '../../../../lib/server/firebaseFounderAuth';
import {verifyPlatformPrincipal,PlatformAuthorizationError} from '../../../../lib/server/platformAuthorization';
import {evaluateServerAuthorization} from '../../../../lib/server/authorizationPolicy';
import {CORE_READ_COLLECTIONS,listOperationalServer,CoreReadFailure,type CoreReadCollection} from '../../../../lib/server/coreOperationalRead';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function reply(payload:unknown,status:number) {
  return NextResponse.json(payload,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
export async function GET(request:Request) {
  try {
    const principal=await verifyPlatformPrincipal(request.headers.get('authorization'));
    const decision=evaluateServerAuthorization(principal,{capability:'core.operational.read'});
    if(!decision.allowed)return reply({ok:false,error:'CORE_READ_UNAUTHORIZED'},403);
    const input=new URL(request.url).searchParams;
    const resource=input.get('resource')||'';
    if([...input.keys()].some(k=>k!=='resource')||
       !CORE_READ_COLLECTIONS.includes(resource as CoreReadCollection))
      return reply({ok:false,error:'CORE_READ_INVALID_RESOURCE'},400);
    const items=await listOperationalServer(principal,resource as CoreReadCollection);
    return reply({ok:true,items},200);
  }catch(error){
    if(error instanceof FounderAuthError||error instanceof PlatformAuthorizationError)
      return reply({ok:false,error:'CORE_READ_UNAUTHORIZED'},error.status);
    if(error instanceof CoreReadFailure)return reply({ok:false,error:error.code},error.status);
    console.error('[core/operational-read] unavailable',error instanceof Error?error.name:'error');
    return reply({ok:false,error:'CORE_READ_UNAVAILABLE'},503);
  }
}
