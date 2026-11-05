import { authorize, fail, idempotencyKey, ok, paging, readBody } from '../../../../lib/company/suppliers/http';
import { createCatalogItem, listCompanyRecords } from '../../../../lib/company/suppliers/store';
import type { CatalogItem } from '../../../../lib/company/suppliers/domain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { const ctx = await authorize(request,'catalogItems:read'); const p = paging(request); return ok(await listCompanyRecords<CatalogItem>(ctx,'catalogItems',p.search,p.cursor,p.limit)); }
  catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try { const ctx = await authorize(request,'catalogItems:write'); const payload = await readBody(request); const result = await createCatalogItem(ctx,payload,idempotencyKey(request)); return ok(result.result,result.replay ? 200 : 201); }
  catch (error) { return fail(error); }
}
