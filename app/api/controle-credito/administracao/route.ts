import { NextResponse } from 'next/server';
import { requireCreditMember, creditAuthFailure, CreditAccessError } from '@/lib/server/creditControlAuth';
import { listCreditAdministration, mutateCreditAdministration } from '@/lib/server/creditControlMembers';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
function failure(error:unknown){const f=creditAuthFailure(error);return respond({error:f.error},f.status);}
export async function GET(request:Request){
  try{return respond(await listCreditAdministration(await requireCreditMember(request)));}
  catch(error){return failure(error);}
}
export async function POST(request:Request){
  try{
    const member=await requireCreditMember(request,true);
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new CreditAccessError(422,'Envie os dados em JSON.');
    if(!request.body)throw new CreditAccessError(422,'Dados não informados.');
    const reader=request.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
        if(size>16384){await reader.cancel();throw new CreditAccessError(422,'Dados excedem o limite permitido.');}
        text+=decoder.decode(value,{stream:true});}
      text+=decoder.decode();
    }catch(error){if(error instanceof CreditAccessError)throw error;throw new CreditAccessError(422,'Dados inválidos.');}
    finally{reader.releaseLock();}
    let body:unknown;try{body=JSON.parse(text);}catch{throw new CreditAccessError(422,'JSON inválido.');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw new CreditAccessError(422,'Dados inválidos.');
    return respond(await mutateCreditAdministration(member,body as Record<string,unknown>));
  }catch(error){return failure(error);}
}
