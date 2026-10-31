import {NextResponse,type NextRequest} from 'next/server';
import {runAiAsk,parseAskInput} from '../../../../lib/emprovex-ai/integration/orchestrator';
import {AI_SESSION_COOKIE} from '../../../../lib/emprovex-ai/integration/session';
import {AiInputError} from '../../../../lib/emprovex-ai/contracts';
import {AiExecutionError} from '../../../../lib/emprovex-ai/response';
import {FounderAuthError} from '../../../../lib/server/firebaseFounderAuth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'no-store, private','x-content-type-options':'nosniff'};
export async function POST(request:NextRequest){
 // Mesmo com variavel configurada incorretamente, produção Vercel fica sempre bloqueada.
 if(process.env.VERCEL_ENV==='production'||process.env.EMPROVEX_AI_W45_ENABLED!=='1')
   return NextResponse.json({error:'AI_EXPERIMENT_DISABLED'},{status:404,headers});
 try{
   if(Number(request.headers.get('content-length')||0)>8192)
     throw new AiInputError('AI_REQUEST_TOO_LARGE',413);
   const raw=await request.text();
   if(raw.length>8192)throw new AiInputError('AI_REQUEST_TOO_LARGE',413);
   let value:unknown;
   try{value=JSON.parse(raw);}catch{throw new AiInputError('AI_INVALID_JSON');}
   const input=parseAskInput(value);
   const {payload,cookie,setCookie}=await runAiAsk({
     authorization:request.headers.get('authorization'),input,
     sessionCookie:request.cookies.get(AI_SESSION_COOKIE)?.value
   });
   const response=NextResponse.json(payload,{status:200,headers});
   if(setCookie)response.cookies.set(AI_SESSION_COOKIE,cookie,{
     httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',
     path:'/api/emprovex-ai',maxAge:7200
   });
   return response;
 }catch(error){
   const status=error instanceof AiInputError?error.status:
     error instanceof AiExecutionError?error.httpStatus:
     error instanceof FounderAuthError?error.status:503;
   const code=error instanceof AiInputError?error.code:
     error instanceof AiExecutionError?error.code:
     error instanceof FounderAuthError?'AI_AUTHENTICATION_FAILED':'AI_UNAVAILABLE';
   console.warn('emprovex_ai_w45_rejected',{code,status});
   return NextResponse.json({error:code},{status,headers});
 }
}
