import { requireCreditMember } from '@/lib/server/creditControlAuth';
import { registerMovement } from '@/lib/server/creditControlStore';
import { creditJson, creditFailure, creditReadJson } from '@/lib/server/creditControlFinanceHttp';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    const member=await requireCreditMember(request,true);
    return creditJson(await registerMovement(member,await creditReadJson(request)));
  }catch(error){return creditFailure(error);}
}
