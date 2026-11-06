import {authorize,body,fail,ok,paging,token} from '../../../../lib/company/purchases/http';
import {createPurchase,listPurchases,previewPurchaseNeed} from '../../../../lib/company/purchases/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const p=paging(request);
    const ctx=await authorize(request,p.needFor?'customerOrders:read':'purchaseOrders:read');
    return ok(p.needFor?await previewPurchaseNeed(ctx,p.needFor):await listPurchases(ctx,p.limit,p.cursor));
  }catch(e){return fail(e);}
}
export async function POST(request:Request){
  try{
    const ctx=await authorize(request,'purchaseOrders:write');
    const input=await body(request);
    const result=await createPurchase(ctx,input,token(request));
    return ok(result,result.replayed?200:201);
  }catch(e){return fail(e);}
}
