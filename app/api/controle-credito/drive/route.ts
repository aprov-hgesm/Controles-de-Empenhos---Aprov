import {requireCreditMember} from '@/lib/server/creditControlAuth';
import {connectCreditStorage,documentError,documentJson} from '@/lib/server/creditControlDocuments';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{const member=await requireCreditMember(request,true);await connectCreditStorage(member,request);return documentJson({connected:true});}
  catch(error){return documentError(error);}
}
