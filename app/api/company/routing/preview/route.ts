import {authorize,body,fail,ok} from '../../../../../lib/company/routing/http';
import {previewRoute} from '../../../../../lib/company/routing/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{const ctx=await authorize(request,'deliveryRoutes');return ok(await previewRoute(ctx,await body(request)));}
 catch(e){return fail(e);}
}
