import { authorize, fail, idempotencyKey, ok, readBody } from '../../../../../lib/company/suppliers/http';
import { getCompanyRecord, updateSourceSupplier } from '../../../../../lib/company/suppliers/store';
import type { SourceSupplier } from '../../../../../lib/company/suppliers/domain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = {params: Promise<{id:string}>};
export async function GET(request: Request, {params}: RouteContext) {
  try { const ctx = await authorize(request,'sourceSuppliers:read'); return ok(await getCompanyRecord<SourceSupplier>(ctx,'sourceSuppliers',(await params).id)); }
  catch (error) { return fail(error); }
}
export async function PATCH(request: Request, {params}: RouteContext) {
  try { const ctx = await authorize(request,'sourceSuppliers:write'); const payload = await readBody(request); const result = await updateSourceSupplier(ctx,(await params).id,payload,idempotencyKey(request)); return ok(result.result); }
  catch (error) { return fail(error); }
}
