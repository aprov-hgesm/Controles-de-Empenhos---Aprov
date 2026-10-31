import { NextResponse, type NextRequest } from 'next/server';
import { executeAiQuery } from '../../../../lib/emprovex-ai/query';
import { AiInputError } from '../../../../lib/emprovex-ai/contracts';
import { AiExecutionError } from '../../../../lib/emprovex-ai/response';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'no-store, private'};
export async function POST(request:NextRequest){
  try {
    if(Number(request.headers.get('content-length')||0)>16384)
      return NextResponse.json({error:'AI_REQUEST_TOO_LARGE'},{status:413,headers});
    const raw=await request.text();
    if(raw.length>16384)return NextResponse.json({error:'AI_REQUEST_TOO_LARGE'},{status:413,headers});
    let parsed:unknown;
    try{parsed=JSON.parse(raw);}catch{return NextResponse.json({error:'AI_INVALID_JSON'},{status:400,headers});}
    const result=await executeAiQuery(request.headers.get('authorization'),parsed);
    return NextResponse.json(result,{status:200,headers});
  } catch(error) {
    const status=error instanceof AiInputError?error.status
      :error instanceof AiExecutionError?error.httpStatus
      :error instanceof FounderAuthError?error.status:503;
    const code=error instanceof AiInputError?error.code
      :error instanceof AiExecutionError?error.code
      :error instanceof FounderAuthError?'AI_AUTHENTICATION_FAILED':'AI_UNAVAILABLE';
    console.warn('emprovex_ai_rejected',{code,status});
    return NextResponse.json({error:code},{status,headers});
  }
}
