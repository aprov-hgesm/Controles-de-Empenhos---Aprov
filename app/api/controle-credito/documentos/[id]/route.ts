import { requireCreditMember } from '@/lib/server/creditControlAuth';
import { documentError, downloadDocument } from '@/lib/server/creditControlDocuments';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const member=await requireCreditMember(request);
    const {id}=await context.params;
    return await downloadDocument(member,request,id);
  } catch(e){return documentError(e);}
}
