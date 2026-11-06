import { authorize,directionFromBook,failure,idempotency,readBody,success } from '../../../../../../lib/company/finance/http';
import { cancel,one } from '../../../../../../lib/company/finance/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
type C={params:Promise<{book:string;id:string}>};
export async function GET(request:Request,{params}:C){
  try{const {book,id}=await params;const direction=directionFromBook(book);
    const ctx=await authorize(request,direction,false);return success(await one(ctx,direction,id));
  }catch(e){return failure(e);}
}
export async function PATCH(request:Request,{params}:C){
  try{const {book,id}=await params;const direction=directionFromBook(book);
    const ctx=await authorize(request,direction,true);const data=await readBody(request);
    const result=await cancel(ctx,direction,id,data,idempotency(request));
    return success(result.result);
  }catch(e){return failure(e);}
}
