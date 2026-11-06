import { NextResponse } from 'next/server';
import { requireCompanyContext, companyErrorStatus, type CompanyAuthorizedContext } from '../../server/companyAuthz';
import { SupplierValidationError } from './domain';
import { SupplierServiceError } from './store';

const responseHeaders = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization', 'X-Content-Type-Options': 'nosniff' };
export async function authorize(request: Request, action: 'sourceSuppliers:read'|'sourceSuppliers:write'|'catalogItems:read'|'catalogItems:write'): Promise<CompanyAuthorizedContext> {
  return requireCompanyContext(request,{action});
}
export async function readBody(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type') ?? '')) throw new SupplierServiceError('JSON_REQUIRED',400);
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 64000) throw new SupplierServiceError('BODY_TOO_LARGE',400);
  const text = await request.text();
  if (text.length > 64000) throw new SupplierServiceError('BODY_TOO_LARGE',400);
  try { return JSON.parse(text) as unknown; } catch { throw new SupplierServiceError('INVALID_JSON',400); }
}
export const idempotencyKey = (request: Request) => request.headers.get('idempotency-key') || '';
export function paging(request: Request) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit') ?? '20';
  if (!/^\d{1,2}$/.test(rawLimit)) throw new SupplierServiceError('INVALID_PAGING',400);
  return { search: url.searchParams.get('q') || '', cursor: url.searchParams.get('cursor') || '', limit: Number(rawLimit) };
}
export function ok<T>(result: T, status = 200) { return NextResponse.json({ok:true,result},{status,headers:responseHeaders}); }
export function fail(error: unknown) {
  if (error instanceof SupplierValidationError) return NextResponse.json({ok:false,code:error.code,error:'Dados inválidos para a operação.'},{status:400,headers:responseHeaders});
  if (error instanceof SupplierServiceError) return NextResponse.json({ok:false,code:error.code,error:'Operação empresarial não concluída.'},{status:error.status,headers:responseHeaders});
  const status = companyErrorStatus(error);
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'COMPANY_SESSION_UNAVAILABLE';
  return NextResponse.json({ok:false,code,error:'Acesso empresarial indisponível ou não autorizado.'},{status,headers:responseHeaders});
}
