/**
 * W12 — núcleo independente e fail-closed de perfis multi-CNPJ.
 * `principal` deve vir de verificação Auth ativa no servidor (W10), jamais de JSON do cliente.
 * `links` é índice de descoberta e NUNCA concede autoridade.
 */
export class ProfileError extends Error {
  constructor(code, status = 403) { super(code); this.name = 'ProfileError'; this.code = code; this.status = status; }
}
export const validCompanyId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{1,79}$/.test(id);
const validUid = uid => typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !/[\/\x00-\x1f]/.test(uid);
const validEmail = e => typeof e === 'string' && e.length < 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e === e.trim().toLowerCase();
export function assertVerifiedCompanyPrincipal(principal) {
  if (!principal || principal.verified !== true || principal.active !== true || principal.emailVerified !== true
    || principal.provider !== 'password' || principal.accountType !== 'company'
    || !validUid(principal.uid) || !validEmail(principal.email)) {
    throw new ProfileError('PROFILE_IDENTITY_FORBIDDEN', 403);
  }
  return principal;
}
export function normalizeCnpj(value) {
  if (typeof value !== 'string') throw new ProfileError('PROFILE_INVALID_CNPJ', 400);
  const cnpj = value.toUpperCase().replace(/[.\/\-\s]/g, '');
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) throw new ProfileError('PROFILE_INVALID_CNPJ', 400);
  const calc = length => {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const n = weights.reduce((sum,w,i)=>sum+(cnpj.charCodeAt(i)-48)*w,0) % 11;
    return n < 2 ? 0 : 11-n;
  };
  if (calc(12) !== Number(cnpj[12]) || calc(13) !== Number(cnpj[13])) throw new ProfileError('PROFILE_INVALID_CNPJ', 400);
  return cnpj;
}
function safeWorkspace(workspace, companyId) {
  if (!workspace || workspace.id !== companyId || workspace.workspaceType !== 'company'
    || workspace.status !== 'active' || workspace.companyProfile?.registrationStatus !== 'active') {
    throw new ProfileError('PROFILE_NOT_AUTHORIZED', 403);
  }
  const name = workspace.companyProfile.tradeName || workspace.companyProfile.legalName || workspace.name;
  if (typeof name !== 'string' || !name.trim()) throw new ProfileError('PROFILE_INTEGRITY_ERROR', 503);
  const cnpj = normalizeCnpj(workspace.companyProfile.cnpj);
  return { companyId, workspaceId:companyId, name:name.trim(), cnpj,
    legalName:workspace.companyProfile.legalName || name };
}
function memberAllowed(member, principal, companyId, action, permitsAction) {
  return member && member.companyId === companyId && member.workspaceId === companyId
    && member.firebaseUid === principal.uid && member.email === principal.email
    && member.status === 'active' && Array.isArray(member.roles) && member.roles.length > 0
    && permitsAction(member.roles, 'active', action) === true;
}
/** W10 supplies real Firestore directory and live W3 RBAC. Never pass browser-supplied adapters. */
export async function authorizeCompanyProfile(principalInput, companyId, services, action = 'company:read') {
  const principal = assertVerifiedCompanyPrincipal(principalInput);
  if (!validCompanyId(companyId) || typeof action !== 'string' || !/^[A-Za-z]+:[A-Za-z]+$/.test(action)) {
    throw new ProfileError('PROFILE_INVALID_INPUT', 400);
  }
  if (!services || !['readWorkspace','readOwner','readMember','verifyCnpjBinding','permitsAction','isKnownAction']
    .every(key => typeof services[key] === 'function')) throw new ProfileError('PROFILE_INTEGRATION_REQUIRED',503);
  // The W0/W10 server action registry is authoritative. Owner is not a grant for arbitrary action strings.
  if (services.isKnownAction(action) !== true) throw new ProfileError('PROFILE_NOT_AUTHORIZED',403);
  let w, owner, member;
  try {
    [w,owner,member] = await Promise.all([
      services.readWorkspace(companyId), services.readOwner(companyId), services.readMember(companyId,principal),
    ]);
  } catch { throw new ProfileError('PROFILE_DIRECTORY_UNAVAILABLE',503); }
  const profile = safeWorkspace(w,companyId);
  let binding;
  try { binding = await services.verifyCnpjBinding(profile.cnpj, companyId); }
  catch { throw new ProfileError('PROFILE_DIRECTORY_UNAVAILABLE',503); }
  if (binding !== true) throw new ProfileError('PROFILE_NOT_AUTHORIZED',403);
  const isOwner = owner && owner.companyId === companyId && owner.workspaceId === companyId
    && owner.firebaseUid === principal.uid && owner.email === principal.email && owner.status === 'active';
  const isMember = memberAllowed(member,principal,companyId,action,services.permitsAction);
  if (!isOwner && !isMember) throw new ProfileError('PROFILE_NOT_AUTHORIZED',403);
  return {...profile, role:isOwner?'owner':'member', rights:isOwner?['*']:[...member.roles]};
}
/** Indexed candidates are verified LIVE, including company status, owner/member and CNPJ index. */
export async function listAuthorizedCompanyProfiles(principalInput, services) {
  const principal = assertVerifiedCompanyPrincipal(principalInput);
  if (typeof services?.listCandidateIds !== 'function') throw new ProfileError('PROFILE_INTEGRATION_REQUIRED',503);
  let ids;
  try { ids = await services.listCandidateIds(principal); }
  catch { throw new ProfileError('PROFILE_DIRECTORY_UNAVAILABLE',503); }
  if (!Array.isArray(ids) || ids.length>32 || ids.some(id=>!validCompanyId(id))) {
    throw new ProfileError('PROFILE_INTEGRITY_ERROR',503);
  }
  const profiles=[];
  for (const id of [...new Set(ids)]) {
    try { profiles.push(await authorizeCompanyProfile(principal,id,services)); }
    catch(e) {
      if (e instanceof ProfileError && e.status===403) continue; // revoked/suspended/index stale
      throw e; // never return partially trusted results during outages
    }
  }
  return profiles.sort((a,b)=>a.companyId.localeCompare(b.companyId));
}
/** Selection is a choice only. Authorization is recomputed every request after W10's guard patch. */
export async function selectAuthorizedCompanyProfile(principal, requestedCompanyId, services) {
  return authorizeCompanyProfile(principal,requestedCompanyId,services,'company:read');
}
/** Defensive tenant scope invariant for W10 API adapters. */
export function assertSameProfileResource(profile, resource) {
  if (!profile || !resource || resource.companyId !== profile.companyId
    || resource.workspaceId !== profile.companyId) throw new ProfileError('PROFILE_NOT_AUTHORIZED',403);
}
