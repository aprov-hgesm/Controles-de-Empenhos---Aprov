import { authorize,directionFromBook,failure,idempotency,readBody,success } from '../../../../../lib/company/finance/http';
import { createObligation,page } from '../../../../../lib/company/finance/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
type C={params:Promise<{book:string}>};
export async function GET(request:Request,{params}:C){
  try{const direction=directionFromBook((await params).book);
    const ctx=await authorize(request,direction,false);const url=new URL(request.url);
    const limit=Number(url.searchParams.get('limit')??20),cursor=url.searchParams.get('cursor')??'';
    return success(await page(ctx,direction,limit,cursor));
  }catch(e){return failure(e);}
}
export async function POST(request:Request,{params}:C){
  try{const direction=directionFromBook((await params).book);
    const ctx=await authorize(request,direction,true);const data=await readBody(request);
    const result=await createObligation(ctx,direction,data,idempotency(request));
    return success(result.result,result.replay?200:201);
  }catch(e){return failure(e);}
}
