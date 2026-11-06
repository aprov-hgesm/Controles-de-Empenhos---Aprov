import {authorize,body,fail,ok,token} from '../../../../../lib/company/routing/http';
import {getRoute,changeRoute} from '../../../../../lib/company/routing/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Params={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Params){
 try{const ctx=await authorize(request,'deliveryRoutes');return ok(await getRoute(ctx,(await params).id));}
 catch(e){return fail(e);}
}
export async function PATCH(request:Request,{params}:Params){
 try{const ctx=await authorize(request,'deliveryRoutes',true);
 return ok(await changeRoute(ctx,(await params).id,await body(request),token(request)));}
 catch(e){return fail(e);}
}
