import { NextResponse } from 'next/server';
import { CreditAccessError, requireCreditMember } from '@/lib/server/creditControlAuth';
import { FounderAuthError } from '@/lib/server/firebaseFounderAuth';
import { parseSagCreditHtml } from '@/lib/controle-credito/sagCreditHtml.mjs';
import { parseEmpenhoPdfBytes } from '@/lib/server/empenhoPdfParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function response(body: unknown, status=200) {
  return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
}
function failure(error: unknown) {
  if (error instanceof CreditAccessError || error instanceof FounderAuthError) return response({error:error.message},error.status);
  return response({error:'Não foi possível concluir a operação.'},503);
}
async function readBounded(request: Request, max: number): Promise<Uint8Array> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length)||Number(length)>max)) throw new CreditAccessError(413,'Arquivo excede o limite.');
  if (!request.body) throw new CreditAccessError(400,'Arquivo não informado.');
  const reader=request.body.getReader();
  const chunks: Uint8Array[]=[]; let total=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>max){await reader.cancel();throw new CreditAccessError(413,'Arquivo excede o limite.');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  if(!total) throw new CreditAccessError(400,'Arquivo vazio.');
  return new Uint8Array(Buffer.concat(chunks,total));
}
export async function GET(request: Request) {
  try {return response({member:await requireCreditMember(request)});} catch(error){return failure(error);}
}
export async function POST(request: Request) {
  try{
    const member=await requireCreditMember(request,true);
    const kind=request.headers.get('x-credit-document-kind');
    if(kind!=='nc'&&kind!=='ne') return response({error:'Tipo de documento inválido.'},400);
    const bytes=await readBounded(request,kind==='nc'?1_000_000:10*1024*1024);
    try{
      if(kind==='nc'){
        const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
        return response({result:parseSagCreditHtml(html,member.ug)});
      }
      if(Buffer.from(bytes.subarray(0,5)).toString('ascii')!=='%PDF-') return response({error:'Selecione uma NE em PDF.'},422);
      const result=parseEmpenhoPdfBytes(bytes);
      if(result.ug!==member.ug) return response({error:'UG da NE incompatível; conferir no documento.'},422);
      return response({result});
    }catch(error){
      return response({error:error instanceof Error?error.message.slice(0,240):'Documento não reconhecido.'},422);
    }
  }catch(error){return failure(error);}
}
