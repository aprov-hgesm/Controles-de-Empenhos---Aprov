import {NextResponse} from 'next/server';
import {CompanyAuthorizationError,requireCompanyContext} from '../../server/companyAuthz';
import {CompanyAccessError} from '../../server/companySession';
import {InventoryError,id} from './engine.mjs';
import {InventoryStore} from './store';
import {executeInventory,getInventory,listInventoryEvents,inventoryActionFor} from './service';

const headers={'Cache-Control':'private, no-store, max-age=0'};
const ok=(result:unknown,status=200)=>NextResponse.json({ok:true,result},{headers,status});
const fail=(error:unknown)=>{
 if(error instanceof InventoryError||error instanceof CompanyAuthorizationError||error instanceof CompanyAccessError)
   return NextResponse.json({ok:false,code:error.code,error:error.code},{status:error.status,headers});
 return NextResponse.json({ok:false,code:'COMPANY_SESSION_UNAVAILABLE',error:'Serviço indisponível'},
   {status:503,headers});
};
const query=(request:Request)=>{
 const u=new URL(request.url),n=Number(u.searchParams.get('limit')||'20'),cursor=u.searchParams.get('cursor')||undefined;
 if(!Number.isInteger(n)||n<1||n>50)throw new InventoryError('INVALID_PAGE_SIZE',400);
 return {n,cursor};
};
export async function inventoryList(request:Request){
 try{
  const ctx=await requireCompanyContext(request,{action:'stockEvents:read'});
  const {n,cursor}=query(request),page=await (await InventoryStore.connect(ctx)).list('stockEvents',n,cursor);
  return ok({items:page.items.filter(v=>v.kind==='stock_projection'),nextCursor:page.nextCursor});
 }catch(error){return fail(error);}
}
export async function inventoryPost(request:Request){
 try {
  // Authenticate before parsing untrusted user JSON and reauthorize the fine-grained action afterward.
  await requireCompanyContext(request,{action:'company:read'});
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')||
    Number(request.headers.get('content-length')||0)>32768)throw new InventoryError('INVALID_CONTENT_TYPE',400);
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>32768)throw new InventoryError('BODY_TOO_LARGE',400);
  let body:unknown;
  try{body=JSON.parse(raw);}catch{throw new InventoryError('INVALID_JSON',400);}
  const kind=typeof body==='object'&&body!==null&&!Array.isArray(body)?
    String((body as {kind?:unknown}).kind||''):'';
  const ctx=await requireCompanyContext(request,{action:inventoryActionFor(kind)});
  return ok(await executeInventory(ctx,body,request.headers.get('idempotency-key')),201);
 }catch(error){return fail(error);}
}
export async function inventoryOne(request:Request,route:{params:Promise<{catalogItemId:string}>}){
 try{const ctx=await requireCompanyContext(request,{action:'stockEvents:read'});
  const {catalogItemId}=await route.params;
  return ok(await getInventory(ctx,id(catalogItemId)));
 }catch(error){return fail(error);}
}
export async function eventList(request:Request){
 try{const ctx=await requireCompanyContext(request,{action:'stockEvents:read'});
  const {n,cursor}=query(request);
  return ok(await listInventoryEvents(ctx,n,cursor));
 }catch(error){return fail(error);}
}
export async function allocationList(request:Request){
 try{const ctx=await requireCompanyContext(request,{action:'allocations:read'});
  const {n,cursor}=query(request),orderId=new URL(request.url).searchParams.get('orderId');
  if(orderId)id(orderId);
  const page=await (await InventoryStore.connect(ctx)).list('allocations',n,cursor);
  return ok({items:page.items.filter(v=>v.kind==='order_projection'&&(!orderId||v.customerOrderId===orderId)),
    nextCursor:page.nextCursor});
 }catch(error){return fail(error);}
}
