/**
 * W10-III — Emulated, administrator-approved second-CNPJ provisioning.
 * Never creates a second Firebase Auth account or overwrites W0 singular indexes.
 * Real registrations remain OFF until independent commercial/security approval.
 */
import { createHash, randomUUID } from 'node:crypto';
import { ProfileError, normalizeCnpj, validCompanyId } from './core.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (code,status=403) => {throw new ProfileError(code,status);};
export function profileApprovalPath(uid,companyId,cnpj) {
  if(typeof uid!=='string'||uid.length<2||uid.length>128||/[\/]/.test(uid)
    ||!validCompanyId(companyId))fail('PROFILE_INVALID_INPUT',400);
  return 'companyRepresentationApprovals/'+hash(uid+'|'+companyId+'|'+normalizeCnpj(cnpj));
}
function documentIdempotency(companyId,uid,key) {
  return 'supplierCompanyWorkspaces/'+companyId+'/profileRegistrationIdempotency/'+hash(uid+':'+key);
}
function approvalValid(doc,command,now) {
  const p=doc?.value;
  if(!p||p.status!=='approved'||p.proofType!=='administrative-verification'
    ||p.uid!==command.uid||p.email!==command.email
    ||p.cnpj!==command.cnpj||p.proposedCompanyId!==command.proposedCompanyId
    ||p.legalName!==command.legalName||typeof p.approvedByUid!=='string'||p.approvedByUid.length<2
    ||typeof p.approvedByEmail!=='string'||!p.approvedByEmail.includes('@')
    ||typeof p.evidenceSha256!=='string'||!/^[a-f0-9]{64}$/.test(p.evidenceSha256)
    ||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=now()
    ||typeof p.responsibleName!=='string'||!p.responsibleName.trim()
    ||typeof p.city!=='string'||!p.city.trim()
    ||typeof p.state!=='string'||!/^[A-Z]{2}$/.test(p.state))
    fail('PROFILE_REPRESENTATION_REQUIRED',403);
  return p;
}
export function createQaAdditionalCompanyRegistry({read,commit,now=Date.now}={}) {
  if(typeof read!=='function'||typeof commit!=='function'||typeof now!=='function')
    fail('PROFILE_INTEGRATION_REQUIRED',503);
  return Object.freeze({
    async verifyLegalRepresentation({uid,email,cnpj,proposedCompanyId}) {
      try {
        const d=await read(profileApprovalPath(uid,proposedCompanyId,cnpj));
        // W12 validates legalName against approval when the actual registration commits.
        return d?.value?.status==='approved' && d.value.uid===uid
          && d.value.email===email && d.value.cnpj===cnpj
          && d.value.proposedCompanyId===proposedCompanyId
          && d.value.proofType==='administrative-verification'
          && Number.isFinite(Date.parse(d.value.expiresAt))&&Date.parse(d.value.expiresAt)>now()
          && typeof d.value.approvedByUid==='string'&&d.value.approvedByUid.length>1
          && /^[a-f0-9]{64}$/.test(d.value.evidenceSha256||'');
      } catch(e) {if(e instanceof ProfileError)throw e;fail('PROFILE_DIRECTORY_UNAVAILABLE',503);}
    },
    async commitAdditionalCompany(command) {
      if(!command||!validCompanyId(command.primaryCompanyId)
        ||!validCompanyId(command.proposedCompanyId)
        ||command.primaryCompanyId===command.proposedCompanyId
        ||!/[a-z0-9_-]{2,128}/i.test(command.uid||'')
        ||!/^[a-f0-9]{64}$/.test(command.requestHash||'')
        ||!/^[A-Za-z0-9_-]{16,128}$/.test(command.idempotencyKey||''))fail('PROFILE_INVALID_INPUT',400);
      const cnpj=normalizeCnpj(command.cnpj);
      const idemPath=documentIdempotency(command.proposedCompanyId,command.uid,command.idempotencyKey);
      let previous;
      try{previous=await read(idemPath);}catch{fail('PROFILE_DIRECTORY_UNAVAILABLE',503);}
      if(previous){
        if(previous.value.uid!==command.uid||previous.value.requestHash!==command.requestHash)
          fail('PROFILE_IDEMPOTENCY_CONFLICT',409);
        return{companyId:command.proposedCompanyId,cnpj,outcome:'replayed'};
      }
      const approvalPath=profileApprovalPath(command.uid,command.proposedCompanyId,cnpj);
      const linkPath='companyProfileUidLinks/'+command.uid;
      let approval,links;
      try{
        [approval,links]=await Promise.all([read(approvalPath),read(linkPath)]);
      }catch{fail('PROFILE_DIRECTORY_UNAVAILABLE',503);}
      const proof=approvalValid(approval,{...command,cnpj},now);
      if(proof.usedAt)fail('PROFILE_REPRESENTATION_REQUIRED',403);
      if(links&&(links.value.uid!==command.uid||links.value.email!==command.email
        ||!Array.isArray(links.value.companyIds)||links.value.companyIds.length>30
        ||links.value.companyIds.some(x=>!validCompanyId(x))))fail('PROFILE_INTEGRITY_ERROR',503);
      const companies=[...new Set([...(links?.value.companyIds||[]),command.primaryCompanyId,command.proposedCompanyId])];
      if(companies.length>32)fail('PROFILE_LIMIT',409);
      const at=new Date(now()).toISOString();
      const profile={legalName:proof.legalName,cnpj,responsibleName:proof.responsibleName,
        city:proof.city,state:proof.state,accessEmail:command.email,
        registrationStatus:'active'};
      const ws={id:command.proposedCompanyId,workspaceType:'company',
        name:proof.legalName,status:'active',authorizedEmail:command.email,
        companyProfile:profile,createdAt:at,updatedAt:at,createdBy:proof.approvedByEmail};
      const owner={companyId:command.proposedCompanyId,workspaceId:command.proposedCompanyId,
        firebaseUid:command.uid,email:command.email,status:'active',
        createdAt:at,approvedByUid:proof.approvedByUid,evidenceSha256:proof.evidenceSha256};
      const auditId=randomUUID();
      const writes=[
        {path:'workspaces/'+command.proposedCompanyId,value:ws,precondition:{exists:false}},
        {path:'platformCnpjIndex/'+cnpj,value:{cnpj,workspaceId:command.proposedCompanyId,
          email:command.email,firebaseUid:command.uid,createdAt:at},precondition:{exists:false}},
        {path:'supplierCompanyWorkspaces/'+command.proposedCompanyId+'/ownerBinding/primary',
          value:owner,precondition:{exists:false}},
        {path:linkPath,value:{uid:command.uid,email:command.email,companyIds:companies,
          revision:(links?.value.revision||0)+1,updatedAt:at},
          precondition:links?{updateTime:links.updateTime}:{exists:false}},
        {path:approvalPath,value:{...proof,usedAt:at,usedForUid:command.uid,
          usedForCompanyId:command.proposedCompanyId},
          precondition:{updateTime:approval.updateTime}},
        {path:idemPath,value:{uid:command.uid,companyId:command.proposedCompanyId,
          cnpj,requestHash:command.requestHash,createdAt:at},precondition:{exists:false}},
        {path:'supplierCompanyWorkspaces/'+command.proposedCompanyId+'/auditEvents/'+auditId,
          value:{eventId:auditId,companyId:command.proposedCompanyId,
            actorUid:command.uid,action:'profile.second_cnpj_qa',
            entityType:'workspace',entityId:command.proposedCompanyId,
            approvalEvidence:proof.evidenceSha256,occurredAt:at},
          precondition:{exists:false}},
      ];
      try {await commit(writes);return{companyId:command.proposedCompanyId,cnpj,outcome:'created'};}
      catch(error){
        // Ambiguous commit response: only an exact idempotency match may replay.
        let maybe;
        try{maybe=await read(idemPath);}catch{fail('PROFILE_DIRECTORY_UNAVAILABLE',503);}
        if(maybe){
          if(maybe.value.uid!==command.uid||maybe.value.requestHash!==command.requestHash)
            fail('PROFILE_IDEMPOTENCY_CONFLICT',409);
          return{companyId:command.proposedCompanyId,cnpj,outcome:'replayed'};
        }
        if(error?.code==='CONFLICT'||error?.status===409)fail('PROFILE_CONFLICT',409);
        fail('PROFILE_DIRECTORY_UNAVAILABLE',503);
      }
    },
  });
}
