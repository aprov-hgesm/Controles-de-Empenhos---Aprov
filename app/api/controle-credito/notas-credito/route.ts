import { requireCreditMember } from '@/lib/server/creditControlAuth';
import {withCreditSharingLock} from '@/lib/server/creditSharingLock';
import {revokeCreditShares} from '@/lib/server/creditControlDocuments';
import { getCredit, createCredit, updateCredit , deleteCredit } from '@/lib/server/creditControlStore';
import { response, failure, json, id, integer, allocations, deadline, string, optionalAck, confirmNc, invalid, NC_MAX, CreditImportError } from '@/lib/server/creditControlImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const member=await requireCreditMember(request);
    const result=await getCredit(member,id(new URL(request.url).searchParams.get('id')));
    if(!result) throw new CreditImportError(404,'NOT_FOUND','NC não localizada ou não acessível.');
    return response(result);
  } catch(error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const member=await requireCreditMember(request,true);
    const body=await json(request,4*Math.ceil(NC_MAX/3)+128*1024);
    const input=confirmNc(body,member);
    return response(await createCredit(member,input),201);
  } catch(error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const member=await requireCreditMember(request,true);
    const body=await json(request);
    if(body.allocations===undefined&&body.deadline===undefined&&body.adminDeadline===undefined&&body.description===undefined) invalid('Informe o que deseja alterar.');
    const input={
      id:id(body.id),expectedRevision:integer(body.expectedRevision,'Revisão'),
      ...(body.allocations!==undefined?{allocations:allocations(body.allocations)}:{}),
      ...(body.deadline!==undefined?{deadline:deadline(body.deadline)}:{}),
      ...(body.adminDeadline!==undefined?{adminDeadline:deadline(body.adminDeadline)}:{}),
      ...(body.description!==undefined?{description:string(body.description,'Descrição')}:{}),
      acknowledgeDeficit:optionalAck(body.acknowledgeDeficit),
    };
    return response(await updateCredit(member,input));
  } catch(error) { return failure(error); }
}

export async function DELETE(request:Request) {
  try {
    const member=await requireCreditMember(request,true);
    const body=await json(request);
    const input={id:id(body.id),expectedRevision:integer(body.expectedRevision,'Revisão',1),confirmed:body.confirmed===true,expectedCommitmentCount:integer(body.expectedCommitmentCount,'Quantidade de empenhos')};
    return response(await withCreditSharingLock(member,'delete-nc',async()=>{
      const current=await getCredit(member,input.id);
      if(!input.confirmed||current.credit.revision!==input.expectedRevision||current.balance.commitmentCount!==input.expectedCommitmentCount||input.expectedCommitmentCount>200)invalid('Confirme a revisão e quantidade de empenhos da NC atual.');
      await revokeCreditShares(member,request,{creditId:input.id});
      return deleteCredit(member,input);
    }));
  }catch(error){return failure(error);}
}
