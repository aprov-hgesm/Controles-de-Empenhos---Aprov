import {authorize,body,fail,ok,token} from '../../../../../lib/company/purchases/http';
import {getPurchase,updatePurchase} from '../../../../../lib/company/purchases/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Params={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Params){
  try{const ctx=await authorize(request,'purchaseOrders:read');return ok(await getPurchase(ctx,(await params).id));}
  catch(e){return fail(e);}
}
export async function PATCH(request:Request,{params}:Params){
  try{
    const ctx=await authorize(request,'purchaseOrders:write');
    const input=await body(request);
    const result=await updatePurchase(ctx,(await params).id,input,token(request));
    return ok(result);
  }catch(e){return fail(e);}
}
