import { requireCreditMember } from '@/lib/server/creditControlAuth';
import { response, failure, invalid, readBounded, parseNc, parseNe, NC_MAX, NE_MAX } from '@/lib/server/creditControlImport';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return response({member:await requireCreditMember(request)}); }
  catch(error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const member=await requireCreditMember(request,true);
    const kind=request.headers.get('x-credit-document-kind');
    if(kind!=='nc'&&kind!=='ne') invalid('Tipo de documento inválido.','DOCUMENT_KIND');
    const bytes=await readBounded(request,kind==='nc'?NC_MAX:NE_MAX);
    return response({result:kind==='nc'?parseNc(bytes,member):parseNe(bytes,member)});
  } catch(error) { return failure(error); }
}
