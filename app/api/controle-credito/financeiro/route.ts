import { requireCreditMember } from '@/lib/server/creditControlAuth';
import { listFinance, listFinanceCommitments, listCreditChoices, listCreditCommitments } from '@/lib/server/creditControlStore';
import { creditJson, creditFailure } from '@/lib/server/creditControlFinanceHttp';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const member=await requireCreditMember(request);
    const params=new URL(request.url).searchParams;
    const filters={year:params.get('year')??undefined,cursor:params.get('cursor')??undefined,limit:params.get('limit')??undefined,sort:params.get('sort')??undefined,center:params.get('center')??undefined,search:params.get('search')??undefined};
    const mode=params.get('mode');
    if(mode==='nc-linked')return creditJson(await listCreditCommitments(member,params.get('creditId')||'',filters.center));
    if(mode==='nc-choices')return creditJson(await listCreditChoices(member,filters.year||new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(new Date())));
    if(mode==='ne-list')return creditJson(await listFinanceCommitments(member,filters));
    return creditJson(await listFinance(member,{...filters,...(mode==='nc-list'?{kind:'nc' as const}:{})}));
  }catch(error){return creditFailure(error);}
}
