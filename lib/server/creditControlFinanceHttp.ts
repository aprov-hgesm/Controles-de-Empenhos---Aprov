import { NextResponse } from 'next/server';
import { CreditAccessError } from './creditControlAuth';
import { FounderAuthError } from './firebaseFounderAuth';
import { CreditStoreError } from './creditControlFirestore';

export function creditJson(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export function creditFailure(error:unknown){
  if(error instanceof CreditStoreError)return creditJson({error:error.message,code:error.code},error.status);
  if(error instanceof CreditAccessError||error instanceof FounderAuthError)
    return creditJson({error:error.message,code:error.status===401?'CREDIT_SESSION_INVALID':error.status===403?'CREDIT_FORBIDDEN':'CREDIT_UNAVAILABLE'},error.status);
  return creditJson({error:'Não foi possível concluir a operação financeira. Tente novamente.',code:'CREDIT_UNAVAILABLE'},503);
}
export async function creditReadJson(request:Request):Promise<unknown>{
  const invalid=()=>new CreditStoreError(422,'CREDIT_INVALID_INPUT','Dados JSON inválidos ou acima do limite.');
  const length=request.headers.get('content-length'),max=64*1024;
  if(length&&(!/^\d+$/.test(length)||Number(length)>max))throw invalid();
  if(!request.body)throw invalid();
  const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let size=0,raw='';
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>max){await reader.cancel();throw invalid();}
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
    return JSON.parse(raw);
  }catch{throw invalid();}finally{reader.releaseLock();}
}
