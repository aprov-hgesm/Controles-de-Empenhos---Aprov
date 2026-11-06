import {NextResponse} from 'next/server';
import {requireCompanyContext,companyErrorStatus} from '../../server/companyAuthz';
import {RoutingError} from '../geo/core.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization',
  'X-Content-Type-Options':'nosniff'};
export async function authorize(request:Request,kind:'deliveryRoutes'|'vehicles',write=false){
 return requireCompanyContext(request,{action:kind+':'+(write?'write':'read') as
   'deliveryRoutes:read'|'deliveryRoutes:write'|'vehicles:read'|'vehicles:write'});
}
export async function body(request:Request){
 if(!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type')||''))
   throw new RoutingError('JSON_REQUIRED');
 const len=Number(request.headers.get('content-length')||0);
 if(!Number.isSafeInteger(len)||len>131072)throw new RoutingError('BODY_TOO_LARGE',413);
 const str=await request.text();
 if(Buffer.byteLength(str,'utf8')>131072)throw new RoutingError('BODY_TOO_LARGE',413);
 try{return JSON.parse(str) as unknown;}catch{throw new RoutingError('INVALID_JSON');}
}
export function paging(req:Request){
 const q=new URL(req.url).searchParams;
 const limit=q.get('limit')||'20',cursor=q.get('cursor')||'';
 if(!/^\d{1,2}$/.test(limit)||Number(limit)<1||Number(limit)>50||cursor.length>2048)
   throw new RoutingError('INVALID_PAGING');
 return{limit:Number(limit),cursor};
}
export function ok(result:unknown,status=200){
 return NextResponse.json({ok:true,result},{status,headers});
}
export function fail(err:unknown){
 const status=err instanceof RoutingError?err.status:companyErrorStatus(err);
 const code=err instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(err.message)?err.message:
  'COMPANY_DIRECTORY_UNAVAILABLE';
 return NextResponse.json({ok:false,code,error:'Não foi possível concluir a operação de rotas.'},
  {status,headers});
}
export const token=(req:Request)=>req.headers.get('idempotency-key');
