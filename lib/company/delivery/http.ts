import {NextResponse} from 'next/server';
import {CompanyAuthorizationError,requireCompanyContext} from '../../server/companyAuthz';
import {CompanyAccessError} from '../../server/companySession';
import {DeliveryError,validId} from './domain.mjs';
import {createDelivery,listDeliveries,getDelivery,updateDelivery,listSchedule,approveSchedule} from './service';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization','X-Content-Type-Options':'nosniff'};
function ok(result:unknown,status=200){return NextResponse.json({ok:true,result},{status,headers});}
function fail(e:unknown){
 if(e instanceof DeliveryError||e instanceof CompanyAuthorizationError||e instanceof CompanyAccessError)
  return NextResponse.json({ok:false,code:e.code,error:e.code},{status:e.status,headers});
 return NextResponse.json({ok:false,code:'COMPANY_SESSION_UNAVAILABLE',error:'Serviço temporariamente indisponível'},
  {status:503,headers});
}
async function json(req:Request) {
 if(!/^application\/json(?:\s*;.*)?$/i.test(req.headers.get('content-type')||''))throw new DeliveryError('JSON_REQUIRED',400);
 if(Number(req.headers.get('content-length')||0)>32768)throw new DeliveryError('BODY_TOO_LARGE',400);
 const raw=await req.text();
 if(Buffer.byteLength(raw,'utf8')>32768)throw new DeliveryError('BODY_TOO_LARGE',400);
 try{return JSON.parse(raw) as unknown;}catch{throw new DeliveryError('INVALID_JSON',400);}
}
function page(req:Request){
 const q=new URL(req.url).searchParams,n=Number(q.get('limit')||'20'),cursor=q.get('cursor')||'';
 if(!Number.isSafeInteger(n)||n<1||n>50||cursor.length>2048||/[\u0000-\u001f]/.test(cursor))
  throw new DeliveryError('INVALID_PAGING',400);
 return{n,cursor,q};
}
export async function deliveriesGet(req:Request){
 try{const ctx=await requireCompanyContext(req,{action:'deliveries:read'});
  const {n,cursor}=page(req);return ok(await listDeliveries(ctx,n,cursor));}
 catch(e){return fail(e);}
}
export async function deliveriesPost(req:Request){
 try{const ctx=await requireCompanyContext(req,{action:'deliveries:write'});
  return ok(await createDelivery(ctx,await json(req),req.headers.get('idempotency-key')),201);}
 catch(e){return fail(e);}
}
type Route={params:Promise<{id:string}>};
export async function deliveryGet(req:Request,route:Route){
 try{const ctx=await requireCompanyContext(req,{action:'deliveries:read'});
  const {id}=await route.params;return ok(await getDelivery(ctx,validId(id)));}
 catch(e){return fail(e);}
}
export async function deliveryPatch(req:Request,route:Route){
 try{const ctx=await requireCompanyContext(req,{action:'deliveries:write'});
  const {id}=await route.params;return ok(await updateDelivery(ctx,validId(id),await json(req),req.headers.get('idempotency-key')));}
 catch(e){return fail(e);}
}
export async function scheduleGet(req:Request){
 try{const ctx=await requireCompanyContext(req,{action:'deliveries:read'});
  // Timeline includes supplier prices/dates and W7 dispatch; a driver cannot read this domain.
  await requireCompanyContext(req,{action:'purchaseOrders:read'});
  await requireCompanyContext(req,{action:'allocations:read'});
  const {n,cursor,q}=page(req);
  return ok(await listSchedule(ctx,n,cursor,q.get('orderId')||undefined));}
 catch(e){return fail(e);}
}
export async function schedulePost(req:Request){
 try{const ctx=await requireCompanyContext(req,{action:'deliveries:write'});
  return ok(await approveSchedule(ctx,await json(req),req.headers.get('idempotency-key')));}
 catch(e){return fail(e);}
}
