import { authorize, fail, idempotencyKey, ok, readBody } from '../../../../../lib/company/suppliers/http';
import { getCompanyRecord, updateCatalogItem } from '../../../../../lib/company/suppliers/store';
import type { CatalogItem } from '../../../../../lib/company/suppliers/domain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = {params: Promise<{id:string}>};
export async function GET(request: Request, {params}: RouteContext) {
  try { const ctx = await authorize(request,'catalogItems:read'); return ok(await getCompanyRecord<CatalogItem>(ctx,'catalogItems',(await params).id)); }
  catch (error) { return fail(error); }
}
export async function PATCH(request: Request, {params}: RouteContext) {
  try { const ctx = await authorize(request,'catalogItems:write'); const payload = await readBody(request); const result = await updateCatalogItem(ctx,(await params).id,payload,idempotencyKey(request)); return ok(result.result); }
  catch (error) { return fail(error); }
}
