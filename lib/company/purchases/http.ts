import {NextResponse} from 'next/server';
import {requireCompanyContext,companyErrorStatus,type CompanyAuthorizedContext} from '../../server/companyAuthz';
import {PurchaseError} from './domain';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization','X-Content-Type-Options':'nosniff'};
const buckets=new Map<string,{count:number;window:number}>();
/** Defense in depth per Node instance. W10 must add distributed rate limit before multi-instance pilot. */
export function throttle(ctx:CompanyAuthorizedContext,now=Date.now()):void {
  const identity=ctx.companyId+'|'+ctx.uid;
  const window=Math.floor(now/60000);
  if(buckets.size>2000)for(const [id,v] of buckets)if(v.window!==window)buckets.delete(id);
  const prev=buckets.get(identity);
  const count=prev?.window===window?prev.count+1:1;
  buckets.set(identity,{count,window});
  if(count>30)throw new PurchaseError('RATE_LIMITED',429);
}
export async function authorize(req:Request,action:'purchaseOrders:read'|'purchaseOrders:write'|'customerOrders:read') {
  const ctx=await requireCompanyContext(req,{action});
  if(action==='purchaseOrders:write')throttle(ctx);
  return ctx;
}
export async function body(req:Request):Promise<unknown>{
  if(!/^application\/json(?:\s*;.*)?$/i.test(req.headers.get('content-type')||''))throw new PurchaseError('JSON_REQUIRED',400);
  const stated=Number(req.headers.get('content-length')||0);
  if(!Number.isFinite(stated)||stated>65536)throw new PurchaseError('BODY_TOO_LARGE',400);
  const source=await req.text();
  if(Buffer.byteLength(source,'utf8')>65536)throw new PurchaseError('BODY_TOO_LARGE',400);
  try{return JSON.parse(source) as unknown;}catch{throw new PurchaseError('INVALID_JSON',400);}
}
export const token=(req:Request)=>req.headers.get('idempotency-key');
export function paging(req:Request){
  const query=new URL(req.url).searchParams;
  const raw=query.get('limit')||'20';
  if(!/^\d{1,2}$/.test(raw))throw new PurchaseError('INVALID_PAGING',400);
  return{limit:Number(raw),cursor:query.get('cursor')||'',needFor:query.get('needFor')||''};
}
export function ok(result:unknown,status=200){return NextResponse.json({ok:true,result},{status,headers});}
export function fail(error:unknown){
  if(error instanceof PurchaseError)return NextResponse.json({ok:false,code:error.code,error:'Operação de compra não concluída.'},
    {status:error.status,headers});
  const status=companyErrorStatus(error);
  const code=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'COMPANY_SESSION_UNAVAILABLE';
  return NextResponse.json({ok:false,code,error:'Acesso empresarial indisponível.'},{status,headers});
}
