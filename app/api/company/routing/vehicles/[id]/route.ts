import {authorize,body,fail,ok,token} from '../../../../../../lib/company/routing/http';
import {saveVehicle} from '../../../../../../lib/company/routing/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Params={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Params){
 try{const ctx=await authorize(request,'vehicles',true);const id=(await params).id;
  return ok(await saveVehicle(ctx,await body(request),token(request),id));}
 catch(e){return fail(e);}
}
