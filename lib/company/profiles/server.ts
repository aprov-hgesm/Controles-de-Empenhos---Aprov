import { requireCompanyContext, type CompanyAuthorizedContext } from '../../server/companyAuthz';
import { readIdentityDocument } from '../../server/companyMembership/firestore';
import { normalizeCnpj } from './core.mjs';

export type CompanyProfileSummary = {
  companyId: string;
  workspaceId: string;
  cnpj: string;
  name: string;
  legalName: string;
  role: 'owner' | 'member';
};
/**
 * W12 compatibility endpoint: returns ONLY the W0/W10 currently authorized tenant.
 * Multi-tenant enumeration requires the additive UID-links and per-tenant live
 * authorization adapter from W10. Never enumerate global workspace collections.
 */
export async function getLegacyAuthorizedProfile(request: Request): Promise<CompanyProfileSummary> {
  const ctx: CompanyAuthorizedContext = await requireCompanyContext(request, { action: 'company:read' });
  const stored = await readIdentityDocument('workspaces', ctx.companyId);
  const ws = stored?.value;
  const profile = ws?.companyProfile as Record<string, unknown> | undefined;
  if (!ws || ws.id !== ctx.companyId || ws.workspaceType !== 'company'
    || ws.status !== 'active' || profile?.registrationStatus !== 'active') {
    throw new Error('PROFILE_DIRECTORY_INTEGRITY');
  }
  const cnpj = normalizeCnpj(profile?.cnpj);
  const cnpjIndex = await readCompanyCnpjBinding(cnpj);
  if (!cnpjIndex || cnpjIndex.workspaceId !== ctx.companyId || cnpjIndex.cnpj !== cnpj) {
    throw new Error('PROFILE_CNPJ_INTEGRITY');
  }
  const legalName = typeof profile?.legalName === 'string' ? profile.legalName.trim() : '';
  const name = typeof profile?.tradeName === 'string' && profile.tradeName.trim()
    ? profile.tradeName.trim() : (legalName || ctx.companyName);
  if (!legalName || !name) throw new Error('PROFILE_DIRECTORY_INTEGRITY');
  return { companyId:ctx.companyId, workspaceId:ctx.companyId,
    cnpj, name, legalName, role:ctx.role };
}
/** The W0 CNPJ index is unique; this is a privileged server lookup only. */
async function readCompanyCnpjBinding(cnpj: string): Promise<{workspaceId: unknown; cnpj: unknown} | null> {
  // Do not change W0's directory or extend its shared collection union.
  const { getDocument } = await import('../../server/companyMembership/firestore');
  const doc = await getDocument<Record<string, unknown>>('platformCnpjIndex/' + cnpj);
  return doc?.value ?? null;
}
