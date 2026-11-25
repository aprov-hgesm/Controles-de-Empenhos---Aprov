import { requireCreditMember } from '@/lib/server/creditControlAuth';
import { documentKind, documentEntityId, documentError, documentJson, listDocuments, readDocumentForm, saveDocument } from '@/lib/server/creditControlDocuments';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const member=await requireCreditMember(request);
    const q=new URL(request.url).searchParams;
    return documentJson({documents:await listDocuments(member,documentKind(q.get('entityType')),documentEntityId(q.get('entityId')))});
  } catch(e){return documentError(e);}
}
export async function POST(request:Request) {
  try {
    const member=await requireCreditMember(request,true);
    const form=await readDocumentForm(request);
    if(form.get('entityType')==='ne')return Response.json({error:'O arquivamento de NE foi desativado.'},{status:422,headers:{'Cache-Control':'private, no-store'}});
    return documentJson({document:await saveDocument(member,request,form)});
  } catch(e){return documentError(e);}
}
