import { requireCreditMember } from '@/lib/server/creditControlAuth';
import { documentError, documentJson, downloadDocument, synchronizeCreditShare } from '@/lib/server/creditControlDocuments';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const member=await requireCreditMember(request);
    const {id}=await context.params;
    return await downloadDocument(member,request,id);
  } catch(e){return documentError(e);}
}

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{const member=await requireCreditMember(request,true);const {id}=await context.params;return documentJson({document:await synchronizeCreditShare(member,request,id)});}catch(e){return documentError(e);}
}
