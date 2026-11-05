import { authorize, fail, idempotencyKey, ok, paging, readBody } from '../../../../lib/company/suppliers/http';
import { createSourceSupplier, listCompanyRecords } from '../../../../lib/company/suppliers/store';
import type { SourceSupplier } from '../../../../lib/company/suppliers/domain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { const ctx = await authorize(request,'sourceSuppliers:read'); const p = paging(request); return ok(await listCompanyRecords<SourceSupplier>(ctx,'sourceSuppliers',p.search,p.cursor,p.limit)); }
  catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try { const ctx = await authorize(request,'sourceSuppliers:write'); const payload = await readBody(request); const result = await createSourceSupplier(ctx,payload,idempotencyKey(request)); return ok(result.result,result.replay ? 200 : 201); }
  catch (error) { return fail(error); }
}
