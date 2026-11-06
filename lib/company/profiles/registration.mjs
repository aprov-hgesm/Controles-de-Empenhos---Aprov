import { createHash } from 'node:crypto';
import { ProfileError, assertVerifiedCompanyPrincipal, authorizeCompanyProfile, normalizeCnpj, validCompanyId } from './core.mjs';
/** Transactional registration contract. W10 owns persistence and company provisioning. */
export async function requestAdditionalCompany(principalInput, command, services) {
  const principal=assertVerifiedCompanyPrincipal(principalInput);
  if (!command || !validCompanyId(command.primaryCompanyId) || !validCompanyId(command.proposedCompanyId)
    || command.primaryCompanyId===command.proposedCompanyId
    || typeof command.legalName!=='string' || !command.legalName.trim() || command.legalName.length>200
    || typeof command.idempotencyKey!=='string' || !/^[A-Za-z0-9_-]{16,128}$/.test(command.idempotencyKey)) {
    throw new ProfileError('PROFILE_INVALID_INPUT',400);
  }
  const cnpj=normalizeCnpj(command.cnpj);
  const owner=await authorizeCompanyProfile(principal,command.primaryCompanyId,services,'company:write');
  if (owner.role!=='owner') throw new ProfileError('PROFILE_NOT_AUTHORIZED',403);
  if (typeof services.verifyLegalRepresentation!=='function' || typeof services.commitAdditionalCompany!=='function') {
    throw new ProfileError('PROFILE_INTEGRATION_REQUIRED',503);
  }
  // Verification is a privileged, one-use approval maintained by W10, never a self-asserted client checkbox.
  let approved;
  try { approved=await services.verifyLegalRepresentation({
    uid:principal.uid,email:principal.email,cnpj,proposedCompanyId:command.proposedCompanyId,
  }); } catch { throw new ProfileError('PROFILE_DIRECTORY_UNAVAILABLE',503); }
  if (approved!==true) throw new ProfileError('PROFILE_REPRESENTATION_REQUIRED',403);
  const legalName=command.legalName.trim();
  const canonical={uid:principal.uid,email:principal.email,cnpj,primaryCompanyId:owner.companyId,
    proposedCompanyId:command.proposedCompanyId,legalName};
  const requestHash=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  try {
    // W10 adapter MUST atomically lock CNPJ, workspace ID and (UID, idempotencyKey),
    // bind the already-existing UID, audit, and leave singular W0 indices unchanged.
    const result=await services.commitAdditionalCompany({
      ...canonical,requestHash,idempotencyKey:command.idempotencyKey,
    });
    if (!result || result.companyId!==command.proposedCompanyId || result.cnpj!==cnpj
      || !['created','replayed'].includes(result.outcome)) throw new ProfileError('PROFILE_INTEGRITY_ERROR',503);
    return result;
  } catch(e) {
    if (e instanceof ProfileError) throw e;
    throw new ProfileError('PROFILE_DIRECTORY_UNAVAILABLE',503);
  }
}
