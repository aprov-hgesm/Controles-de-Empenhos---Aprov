import {authorize,body,fail,ok,paging,token} from '../../../../../lib/company/routing/http';
import {listVehicles,saveVehicle} from '../../../../../lib/company/routing/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const ctx=await authorize(request,'vehicles');const p=paging(request);
  return ok(await listVehicles(ctx,p.limit,p.cursor));}catch(e){return fail(e);}
}
export async function POST(request:Request){
 try{const ctx=await authorize(request,'vehicles',true);
  const result=await saveVehicle(ctx,await body(request),token(request));
  return ok(result,result.replayed?200:201);}catch(e){return fail(e);}
}
