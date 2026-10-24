import {NextResponse} from 'next/server';
import {verifyPlatformPrincipal,PlatformAuthorizationError} from '../../../../../lib/server/platformAuthorization';
import {FounderAuthError} from '../../../../../lib/server/firebaseFounderAuth';
import {evaluateServerAuthorization} from '../../../../../lib/server/authorizationPolicy';
import {commitServerEmpenho} from '../../../../../lib/server/serverEmpenhoTransactions';
import {CoreTransactionError} from '../../../../../lib/server/coreFirestoreTransaction';
import {EmpenhoConcurrencyError} from '../../../../../lib/empenhoConcurrency';
export const runtime='nodejs';export const dynamic='force-dynamic';
function reply(body:unknown,status:number){return NextResponse.json(body,{status,headers:{'cache-control':'private, no-store'}});}
export async function POST(request:Request){
  try{
    const actor=await verifyPlatformPrincipal(request.headers.get('authorization'));
    if(!evaluateServerAuthorization(actor,{capability:'core.empenho.write'}).allowed)
      return reply({ok:false,error:'EMPENHO_FORBIDDEN'},403);
    const raw=await request.text();
    if(Buffer.byteLength(raw)>850000)return reply({ok:false,error:'EMPENHO_TOO_LARGE'},413);
    let body:unknown;try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'EMPENHO_INVALID_JSON'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body)
      ||Object.keys(body).sort().join(',')!=='empenho,mode')
      return reply({ok:false,error:'EMPENHO_INVALID_JSON'},400);
    const data=body as {mode:unknown,empenho:unknown};
    if(data.mode!=='create'&&data.mode!=='update')return reply({ok:false,error:'EMPENHO_INVALID_MODE'},400);
    const result=await commitServerEmpenho(actor,data.mode,data.empenho);
    return reply({ok:true,result},200);
  }catch(error){
    if(error instanceof FounderAuthError||error instanceof PlatformAuthorizationError)
      return reply({ok:false,error:'EMPENHO_UNAUTHORIZED'},error.status);
    if(error instanceof EmpenhoConcurrencyError)
      return reply({ok:false,error:error.code,message:error.message},409);
    if(error instanceof CoreTransactionError)
      return reply({ok:false,error:error.code},error.status);
    console.error('[empenho/transact] unavailable',error instanceof Error?error.name:'unexpected');
    return reply({ok:false,error:'EMPENHO_SERVER_UNAVAILABLE'},503);
  }
}
