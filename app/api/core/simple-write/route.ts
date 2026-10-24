import {NextResponse} from 'next/server';
import {FounderAuthError} from '../../../../lib/server/firebaseFounderAuth';
import {verifyPlatformPrincipal,PlatformAuthorizationError} from '../../../../lib/server/platformAuthorization';
import {evaluateServerAuthorization} from '../../../../lib/server/authorizationPolicy';
import {writeOperationalSimple,SimpleWriteFailure,type SimpleResource} from '../../../../lib/server/coreSimpleWrites';
export const runtime='nodejs';export const dynamic='force-dynamic';
function reply(payload:unknown,status:number){
  return NextResponse.json(payload,{status,headers:{'cache-control':'private, no-store'}});
}
export async function POST(request:Request){
  try{
    const actor=await verifyPlatformPrincipal(request.headers.get('authorization'));
    const raw=await request.text();
    if(Buffer.byteLength(raw,'utf8')>24000)return reply({ok:false,error:'CORE_WRITE_TOO_LARGE'},413);
    let data:unknown;try{data=JSON.parse(raw)}catch{return reply({ok:false,error:'CORE_WRITE_INVALID_JSON'},400)}
    if(!data||typeof data!=='object'||Array.isArray(data)||
       Object.keys(data).sort().join(',')!=='action,payload,resource')
      return reply({ok:false,error:'CORE_WRITE_INVALID_JSON'},400);
    const body=data as {resource:unknown,action:unknown,payload:unknown};
    if(!['alerts','comissoes'].includes(String(body.resource))||
      !['save','delete'].includes(String(body.action)))
      return reply({ok:false,error:'CORE_WRITE_INVALID_ACTION'},400);
    if(body.action==='delete'&&body.resource!=='alerts')
      return reply({ok:false,error:'CORE_WRITE_INVALID_ACTION'},400);
    const capability=body.resource==='alerts'?'core.alerts.write':'core.comissoes.write';
    if(!evaluateServerAuthorization(actor,{capability}).allowed)
      return reply({ok:false,error:'CORE_WRITE_FORBIDDEN'},403);
    const result=await writeOperationalSimple(actor,body.resource as SimpleResource,
      body.action as 'save'|'delete',body.payload);
    return reply({ok:true,result},200);
  }catch(error){
    if(error instanceof FounderAuthError||error instanceof PlatformAuthorizationError)
      return reply({ok:false,error:'CORE_WRITE_UNAUTHORIZED'},error.status);
    if(error instanceof SimpleWriteFailure)return reply({ok:false,error:error.code},error.status);
    console.error('[core/simple-write] unavailable',error instanceof Error?error.name:'unknown');
    return reply({ok:false,error:'CORE_WRITE_UNAVAILABLE'},503);
  }
}
