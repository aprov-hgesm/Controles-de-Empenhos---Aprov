import { requireCreditMember } from '@/lib/server/creditControlAuth';
import { getCommitment, createCommitment } from '@/lib/server/creditControlStore';
import { response, failure, json, id, confirmNe, NE_MAX, CreditImportError } from '@/lib/server/creditControlImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const member=await requireCreditMember(request);
    const result=await getCommitment(member,id(new URL(request.url).searchParams.get('id')));
    if(!result) throw new CreditImportError(404,'NOT_FOUND','NE não localizada ou não acessível.');
    return response(result);
  } catch(error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const member=await requireCreditMember(request,true);
    const body=await json(request,4*Math.ceil(NE_MAX/3)+128*1024);
    const input=confirmNe(body,member);
    return response(await createCommitment(member,input),201);
  } catch(error) { return failure(error); }
}
