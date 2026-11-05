import { requireCompanyContext } from '../../../../../lib/server/companyAuthz';
import {
  changeCompanyMemberRoles, revokeCompanyMember,
} from '../../../../../lib/server/companyMembership';
import { readMemberBody, okMember, memberFailure } from '../../../../../lib/server/companyMembership/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, route: { params: Promise<{memberId: string}> }) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'members:write' });
    const { memberId } = await route.params;
    const input = await readMemberBody(request);
    return okMember(await changeCompanyMemberRoles(ctx, memberId, input.roles));
  } catch (e) { return memberFailure(e); }
}
export async function DELETE(request: Request, route: { params: Promise<{memberId: string}> }) {
  try {
    const ctx = await requireCompanyContext(request, { action: 'members:write' });
    const { memberId } = await route.params;
    return okMember(await revokeCompanyMember(ctx, memberId));
  } catch (e) { return memberFailure(e); }
}
