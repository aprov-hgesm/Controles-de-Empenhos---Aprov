import {authorize,fail,ok,paging} from '../../../../../../lib/company/purchases/http';
import {listPurchaseEvents} from '../../../../../../lib/company/purchases/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Params={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Params){
  try{
    const ctx=await authorize(request,'purchaseOrders:read');
    const p=paging(request);
    return ok(await listPurchaseEvents(ctx,(await params).id,p.limit,p.cursor));
  }catch(e){return fail(e);}
}
