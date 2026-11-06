import { requireCompanyContext } from '../../../../lib/server/companyAuthz';
import {
  listCompanyMembers, inviteCompanyMember,
} from '../../../../lib/server/companyMembership';
import { readMemberBody, okMember, memberFailure } from '../../../../lib/server/companyMembership/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'members:read' });
    const url = new URL(request.url);
    const size = Number(url.searchParams.get('limit') || '25');
    const cursor = url.searchParams.get('cursor') || '';
    return okMember(await listCompanyMembers(ctx, size, cursor));
  } catch (e) { return memberFailure(e); }
}
export async function POST(request: Request) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'members:write' });
    const body = await readMemberBody(request);
    return okMember(await inviteCompanyMember(ctx, { email: body.email, roles: body.roles }), 201);
  } catch (e) { return memberFailure(e); }
}
