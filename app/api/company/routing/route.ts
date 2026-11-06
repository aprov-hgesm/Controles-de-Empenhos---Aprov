import {authorize,body,fail,ok,paging,token} from '../../../../lib/company/routing/http';
import {createRoute,listRoutes} from '../../../../lib/company/routing/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const ctx=await authorize(request,'deliveryRoutes');const p=paging(request);
  return ok(await listRoutes(ctx,p.limit,p.cursor));}catch(e){return fail(e);}
}
export async function POST(request:Request){
 try{const ctx=await authorize(request,'deliveryRoutes',true);
  const result=await createRoute(ctx,await body(request),token(request));
  return ok(result,result.replayed?200:201);}catch(e){return fail(e);}
}
