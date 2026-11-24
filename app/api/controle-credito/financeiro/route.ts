import { requireCreditMember } from '@/lib/server/creditControlAuth';
import { listFinance } from '@/lib/server/creditControlStore';
import { creditJson, creditFailure } from '@/lib/server/creditControlFinanceHttp';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const member=await requireCreditMember(request);
    const params=new URL(request.url).searchParams;
    return creditJson(await listFinance(member,{year:params.get('year')??undefined,
      cursor:params.get('cursor')??undefined,limit:params.get('limit')??undefined}));
  }catch(error){return creditFailure(error);}
}
