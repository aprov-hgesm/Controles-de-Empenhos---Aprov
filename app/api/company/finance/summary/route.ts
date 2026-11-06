import { authorize,failure,success } from '../../../../../lib/company/finance/http';
import { page } from '../../../../../lib/company/finance/store';
import { balance,cashflow } from '../../../../../lib/company/finance/model';
export const runtime='nodejs';export const dynamic='force-dynamic';
/** Bounded preview only. Never describe a first page as a company-wide balance. */
export async function GET(request:Request){
  try{
    const payable=await authorize(request,'payable',false);
    const receivable=await authorize(request,'receivable',false);
    const [a,b]=await Promise.all([page(payable,'payable',50,''),page(receivable,'receivable',50,'')]);
    const records=[...a.items,...b.items];
    return success({
      scope:'first_page_preview',complete:a.complete&&b.complete,
      outstandingPayableCents:a.items.reduce((sum,r)=>sum+balance(r).outstandingCents,0),
      outstandingReceivableCents:b.items.reduce((sum,r)=>sum+balance(r).outstandingCents,0),
      cashflow:cashflow(records),nextPayablesCursor:a.nextCursor,nextReceivablesCursor:b.nextCursor,
      warnings:['Não representa extrato bancário nem liquidação/atesto da OM.',
        'Totais cobrem somente a primeira página se complete=false.'],
    });
  }catch(e){return failure(e);}
}
