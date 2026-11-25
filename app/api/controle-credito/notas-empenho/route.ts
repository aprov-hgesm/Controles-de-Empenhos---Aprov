import { requireCreditMember } from '@/lib/server/creditControlAuth';
import {createHash} from 'node:crypto';
import {withCreditSharingLock} from '@/lib/server/creditSharingLock';
import {revokeCreditShares} from '@/lib/server/creditControlDocuments';
import { getCommitment, createCommitment, replaceCommitmentPdf , deleteCommitment } from '@/lib/server/creditControlStore';
import { response, failure, json, id, confirmNe, parseNe, fileFromDraft, object, integer, invalid, NE_MAX, CreditImportError } from '@/lib/server/creditControlImport';

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

export async function PATCH(request:Request){
  try{
    const member=await requireCreditMember(request,true);
    const body=await json(request,4*Math.ceil(NE_MAX/3)+128*1024);
    const bytes=fileFromDraft(object(body.draft),NE_MAX);
    const parsed=parseNe(bytes,member,true);
    if(parsed.warnings.some(w=>/diverge|divergência/i.test(w)))invalid('O total do PDF não confere com a lista de itens. Confira a impressão consolidada da NE antes de substituir.');
    const input={id:id(body.id),expectedRevision:integer(body.expectedRevision,'Revisão',1),confirmed:body.confirmed===true,documentHash:createHash('sha256').update(bytes).digest('hex'),number:parsed.number,issueDate:parsed.issueDate,supplierCnpj:parsed.supplierCnpj,netCents:parsed.netCents};
    return response(await withCreditSharingLock(member,'replace-ne',async()=>{
      const {commitment:n}=await getCommitment(member,input.id);
      if(!input.confirmed||n.revision!==input.expectedRevision||n.number!==input.number||n.issueDate!==input.issueDate||n.supplierCnpj.replace(/\D/g,'')!==input.supplierCnpj.replace(/\D/g,'')||input.netCents>n.netCents)invalid('Confira a revisão, identidade e novo valor da NE antes de substituir.');
      await revokeCreditShares(member,request,{entityKey:'ne:'+n.id+(n.generation?':'+n.generation:'')});
      return replaceCommitmentPdf(member,input);
    }));
  }catch(error){return failure(error);}
}

export async function DELETE(request:Request) {
  try {
    const member=await requireCreditMember(request,true);
    const body=await json(request);
    const input={id:id(body.id),expectedRevision:integer(body.expectedRevision,'Revisão',1),confirmed:body.confirmed===true};
    return response(await withCreditSharingLock(member,'delete-ne',async()=>{
      const {commitment:n}=await getCommitment(member,input.id);
      if(!input.confirmed||n.revision!==input.expectedRevision)invalid('Confirme a exclusão da revisão atual da NE.');
      await revokeCreditShares(member,request,{entityKey:'ne:'+n.id+(n.generation?':'+n.generation:'')});
      return deleteCommitment(member,input);
    }));
  }catch(error){return failure(error);}
}
