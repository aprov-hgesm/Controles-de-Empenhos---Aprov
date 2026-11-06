import { acceptCompanyInvitation } from '../../../../../lib/server/companyMembership';
import { readMemberBody, okMember, memberFailure } from '../../../../../lib/server/companyMembership/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-time narrow invitation claim: not a data API or session gateway.
 * Requires valid Firebase Auth UID, verified email and secret invitation.
 * W0 guard still blocks members from other operational routes until integration.
 */
export async function POST(request: Request) {
  try {
    const body = await readMemberBody(request);
    return okMember(await acceptCompanyInvitation(request.headers.get('authorization'), {
      companyId: body.companyId, invitationToken: body.invitationToken,
    }));
  } catch (e) { return memberFailure(e); }
}
