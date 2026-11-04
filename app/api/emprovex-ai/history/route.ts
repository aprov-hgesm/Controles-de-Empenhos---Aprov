import {NextRequest,NextResponse} from 'next/server';
import {prepareAiAccess} from '../../../../lib/emprovex-ai/authorize';
import {listHistory,createHistory} from '../../../../lib/emprovex-ai/conversation/historyStore';
import {AiExecutionError} from '../../../../lib/emprovex-ai/response';
import {FounderAuthError} from '../../../../lib/server/firebaseFounderAuth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
function fail(error:unknown){
 const status=error instanceof AiExecutionError?error.httpStatus:
  error instanceof FounderAuthError?error.status:503;
 const code=error instanceof AiExecutionError?error.code:
  error instanceof FounderAuthError?'AI_AUTHENTICATION_FAILED':'AI_HISTORY_UNAVAILABLE';
 return NextResponse.json({error:code},{status,headers});
}
export async function GET(request:NextRequest){
 try{
  const access=await prepareAiAccess(request.headers.get('authorization'));
  return NextResponse.json({threads:await listHistory(access)},{headers});
 }catch(e){return fail(e);}
}
export async function POST(request:NextRequest){
 try{
  const access=await prepareAiAccess(request.headers.get('authorization'));
  if(Number(request.headers.get('content-length')||0)>2048)
   return NextResponse.json({error:'AI_HISTORY_REQUEST_TOO_LARGE'},{status:413,headers});
  const raw=await request.text();
  if(raw.length>2048)return NextResponse.json({error:'AI_HISTORY_REQUEST_TOO_LARGE'},{status:413,headers});
  let input:unknown;try{input=JSON.parse(raw);}catch{return NextResponse.json({error:'AI_HISTORY_INVALID_BODY'},{status:400,headers});}
  const p=input as {firstMessage?:unknown}|null;
  if(!p||typeof p.firstMessage!=='string'||!p.firstMessage.trim()||p.firstMessage.length>1000)
   return NextResponse.json({error:'AI_HISTORY_INVALID_BODY'},{status:400,headers});
  const thread=await createHistory(access,p.firstMessage);
  return NextResponse.json({thread},{status:201,headers});
 }catch(e){return fail(e);}
}
