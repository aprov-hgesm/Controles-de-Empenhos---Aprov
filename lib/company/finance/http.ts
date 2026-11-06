import { NextResponse } from 'next/server';
import { requireCompanyContext, companyErrorStatus, type CompanyAuthorizedContext } from '../../server/companyAuthz';
import { FinanceError, type FinanceDirection } from './model';

export function directionFromBook(book:string):FinanceDirection{
  if(book==='payables')return 'payable';
  if(book==='receivables')return 'receivable';
  throw new FinanceError('FINANCE_NOT_FOUND',404);
}
export async function authorize(request:Request,direction:FinanceDirection,write:boolean):Promise<CompanyAuthorizedContext>{
  return requireCompanyContext(request,{action:(direction==='payable'?'accountsPayable':'accountsReceivable')+(write?':write':':read') as
    'accountsPayable:write'|'accountsPayable:read'|'accountsReceivable:write'|'accountsReceivable:read'});
}
export async function readBody(request:Request):Promise<unknown>{
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new FinanceError('FINANCE_JSON_REQUIRED',400);
  const length=Number(request.headers.get('content-length')||'0');
  if(!Number.isFinite(length)||length>16384)throw new FinanceError('FINANCE_BODY_TOO_LARGE',400);
  let body:string;
  try{body=await request.text();}catch{throw new FinanceError('FINANCE_INVALID_INPUT',400);}
  if(new TextEncoder().encode(body).byteLength>16384)throw new FinanceError('FINANCE_BODY_TOO_LARGE',400);
  try{return JSON.parse(body) as unknown;}catch{throw new FinanceError('FINANCE_INVALID_INPUT',400);}
}
export const privateHeaders={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
export function success(result:unknown,status=200){return NextResponse.json({ok:true,result},{status,headers:privateHeaders});}
export function failure(error:unknown){
  let status:number=503,code='FINANCE_UNAVAILABLE';
  if(error instanceof FinanceError){status=error.status;code=error.code;}
  else if(error&&typeof error==='object'&&'status' in error&&'code' in error){
    status=companyErrorStatus(error);code=String(error.code).slice(0,80);
  }
  return NextResponse.json({ok:false,code,error:code},{status,headers:privateHeaders});
}
export function idempotency(request:Request){return request.headers.get('idempotency-key')||'';}
