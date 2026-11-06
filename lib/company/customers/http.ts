import { NextResponse } from 'next/server';
import { CompanyAuthorizationError, requireCompanyContext } from '../../server/companyAuthz';
import { CompanyAccessError } from '../../server/companySession';
import { W1Error } from './model';
import { createRecord, getRecord, listRecords, updateRecord, type Domain } from './service';

type Params = {params:Promise<{id:string}>};
const headers={'Cache-Control':'private, no-store, max-age=0'};
function respond(result:unknown,status=200) {
  return NextResponse.json({ok:true,result},{status,headers});
}
function errorResult(e:unknown) {
  if (e instanceof W1Error || e instanceof CompanyAuthorizationError || e instanceof CompanyAccessError) {
    return NextResponse.json({ok:false,code:e.code,error:e.code},{status:e.status,headers});
  }
  return NextResponse.json({ok:false,code:'COMPANY_SESSION_UNAVAILABLE',
    error:'Serviço temporariamente indisponível.'},{status:503,headers});
}
async function limitedJson(request:Request):Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new W1Error('INVALID_CONTENT_TYPE',400);
  }
  const declared=Number(request.headers.get('content-length') || 0);
  if (declared>65536) throw new W1Error('INVALID_INPUT',400);
  const raw=await request.text();
  if (new TextEncoder().encode(raw).length>65536) throw new W1Error('INVALID_INPUT',400);
  try { return JSON.parse(raw) as unknown; }
  catch { throw new W1Error('INVALID_INPUT',400); }
}
async function authorize(request:Request,domain:Domain,mode:'read'|'write') {
  return requireCompanyContext(request,{action:domain+':'+mode as
    'publicCustomers:read'|'publicCustomers:write'|'commitments:read'|'commitments:write'|
    'customerOrders:read'|'customerOrders:write'});
}
export function collectionRoutes(domain:Domain) {
  return {
    GET:async(request:Request)=>{
      try {
        const ctx=await authorize(request,domain,'read');
        const url=new URL(request.url), n=url.searchParams.get('limit');
        const limit=n===null ? 20 : Number(n);
        if (!Number.isInteger(limit)) throw new W1Error('INVALID_INPUT',400);
        const cursor=url.searchParams.get('cursor') || undefined;
        return respond(await listRecords(ctx,domain,limit,cursor));
      } catch (e) {return errorResult(e);}
    },
    POST:async(request:Request)=>{
      try {
        const ctx=await authorize(request,domain,'write');
        const body=await limitedJson(request);
        return respond(await createRecord(ctx,domain,body,request.headers.get('idempotency-key')),201);
      } catch (e) {return errorResult(e);}
    },
  };
}
export function itemRoutes(domain:Domain) {
  return {
    GET:async(request:Request,route:Params)=>{
      try {
        const ctx=await authorize(request,domain,'read');
        const {id}=await route.params;
        return respond(await getRecord(ctx,domain,id));
      } catch(e) {return errorResult(e);}
    },
    PATCH:async(request:Request,route:Params)=>{
      try {
        const ctx=await authorize(request,domain,'write');
        const {id}=await route.params;
        const body=await limitedJson(request);
        return respond(await updateRecord(ctx,domain,id,body,request.headers.get('idempotency-key')));
      } catch(e) {return errorResult(e);}
    },
  };
}
