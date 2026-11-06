import { authorize,directionFromBook,failure,idempotency,readBody,success } from '../../../../../../../lib/company/finance/http';
import { recordEntry } from '../../../../../../../lib/company/finance/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
type C={params:Promise<{book:string;id:string}>};
export async function POST(request:Request,{params}:C){
  try{const {book,id}=await params;const direction=directionFromBook(book);
    const ctx=await authorize(request,direction,true);const data=await readBody(request);
    const result=await recordEntry(ctx,direction,id,data,idempotency(request));
    return success(result.result,result.replay?200:201);
  }catch(e){return failure(e);}
}
