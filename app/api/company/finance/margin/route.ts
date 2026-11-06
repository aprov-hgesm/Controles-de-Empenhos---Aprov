import { authorize,failure,readBody,success } from '../../../../../lib/company/finance/http';
import { estimateMargin,FinanceError } from '../../../../../lib/company/finance/model';
export const runtime='nodejs';export const dynamic='force-dynamic';
/** A manual projection: sale from W1 is NOT a cost, W6/W7 integration pending. */
export async function POST(request:Request){
  try{await authorize(request,'receivable',false);
    const body=await readBody(request);
    if(!body||typeof body!=='object'||Array.isArray(body))throw new FinanceError('FINANCE_INVALID_INPUT',400);
    return success(estimateMargin(body as Parameters<typeof estimateMargin>[0]));
  }catch(e){return failure(e);}
}
