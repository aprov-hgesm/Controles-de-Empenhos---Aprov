import {NextRequest,NextResponse} from 'next/server';
import {prepareAiAccess} from '../../../../../lib/emprovex-ai/authorize';
import {getHistory,renameHistory,deleteHistory} from '../../../../../lib/emprovex-ai/conversation/historyStore';
import {AiExecutionError} from '../../../../../lib/emprovex-ai/response';
import {FounderAuthError} from '../../../../../lib/server/firebaseFounderAuth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
type Params={params:Promise<{id:string}>};
function fail(e:unknown){
 const status=e instanceof AiExecutionError?e.httpStatus:
  e instanceof FounderAuthError?e.status:503;
 const code=e instanceof AiExecutionError?e.code:
  e instanceof FounderAuthError?'AI_AUTHENTICATION_FAILED':'AI_HISTORY_UNAVAILABLE';
 return NextResponse.json({error:code},{status,headers});
}
export async function GET(req:NextRequest,ctx:Params){
 try{
  const access=await prepareAiAccess(req.headers.get('authorization'));
  return NextResponse.json({thread:await getHistory(access,(await ctx.params).id)},{headers});
 }catch(e){return fail(e);}
}
export async function PATCH(req:NextRequest,ctx:Params){
 try{
  const access=await prepareAiAccess(req.headers.get('authorization'));
  if(Number(req.headers.get('content-length')||0)>512)
   return NextResponse.json({error:'AI_HISTORY_INVALID_TITLE'},{status:400,headers});
  const raw=await req.text();
  if(raw.length>512)return NextResponse.json({error:'AI_HISTORY_INVALID_TITLE'},{status:400,headers});
  let value:unknown;try{value=JSON.parse(raw);}catch{return NextResponse.json({error:'AI_HISTORY_INVALID_BODY'},{status:400,headers});}
  const p=value as {title?:unknown}|null;
  if(!p||typeof p.title!=='string'||p.title.length>72)
   return NextResponse.json({error:'AI_HISTORY_INVALID_TITLE'},{status:400,headers});
  const id=(await ctx.params).id;
  await renameHistory(access,id,p.title);
  return NextResponse.json({ok:true},{headers});
 }catch(e){return fail(e);}
}
export async function DELETE(req:NextRequest,ctx:Params){
 try{
  const access=await prepareAiAccess(req.headers.get('authorization'));
  await deleteHistory(access,(await ctx.params).id);
  return NextResponse.json({ok:true},{headers});
 }catch(e){return fail(e);}
}
