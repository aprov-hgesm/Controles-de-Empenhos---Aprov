/**
 * W10-III durable, tenant-private reservation and CAS adapter for W14.
 * Pure store logic; the injected transport owns privileged Firestore credentials.
 * Real WLG and automatic fiscal submission are NOT enabled by this module.
 */
import { createHash, randomUUID } from 'node:crypto';
const hashed = input => createHash('sha256').update(input).digest('hex');
const ID = /^[a-zA-Z0-9_-]{2,100}$/;
export class FiscalStoreError extends Error {
  constructor(code, status=503) { super(code); this.name='FiscalStoreError'; this.code=code; this.status=status; }
}
function root(companyId) {
  if (typeof companyId!=='string' || !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(companyId))
    throw new FiscalStoreError('NFE_TENANT_INVALID',403);
  return 'supplierCompanyWorkspaces/'+companyId;
}
function assertRecord(record) {
  const prefix=root(record?.companyId);
  if (!record || record.workspaceId!==record.companyId || !ID.test(record.id||'')
    || !ID.test(record.idempotencyKey||'') || !/^[a-f0-9]{64}$/.test(record.fingerprint||'')
    || !Number.isSafeInteger(record.revision) || record.revision<1)
    throw new FiscalStoreError('NFE_STORE_RECORD_INVALID',422);
  return prefix;
}
function isConflict(error) { return error?.code==='CONFLICT' || error?.status===409; }
/** Never hash a client-controlled reservation prefix. Rebuild from immutable
 * issue identity; otherwise different numberKey strings can reserve the same NF. */
export function fiscalNumberKey(record) {
  assertRecord(record);
  if (!/^\\d{14}$/.test(record.issuerCnpj || '')
    || !['homologacao','producao'].includes(record.environment)
    || !Number.isSafeInteger(record.series) || record.series < 1 || record.series > 999
    || !Number.isSafeInteger(record.number) || record.number < 1 || record.number > 999999999) {
    throw new FiscalStoreError('NFE_RESERVATION_INVALID',422);
  }
  return [record.companyId,record.issuerCnpj,record.environment,record.series,record.number].join(':');
}
export function createFiscalStore({read,commit}) {
  if(typeof read!=='function' || typeof commit!=='function')
    throw new FiscalStoreError('NFE_DURABLE_TRANSPORT_REQUIRED');
  async function get(path) {
    try { return await read(path); }
    catch(e) { if(e instanceof FiscalStoreError)throw e; throw new FiscalStoreError('NFE_STORE_UNAVAILABLE'); }
  }
  return Object.freeze({
    async reserve(record,meta) {
      const prefix=assertRecord(record);
      const expectedNumberKey=fiscalNumberKey(record);
      if (!meta || meta.idempotencyKey!==record.idempotencyKey || meta.fingerprint!==record.fingerprint
        || meta.numberKey!==expectedNumberKey) throw new FiscalStoreError('NFE_RESERVATION_INVALID',422);
      const idemPath=prefix+'/fiscalIdempotency/'+hashed('issue:'+meta.idempotencyKey);
      const numberPath=prefix+'/fiscalNumberReservations/'+hashed(meta.numberKey);
      const docPath=prefix+'/fiscalDocuments/'+record.id;
      const prior=await get(idemPath);
      if (prior) {
        if(prior.value.fingerprint!==meta.fingerprint || prior.value.companyId!==record.companyId)
          throw new FiscalStoreError('NFE_IDEMPOTENCY_CONFLICT',409);
        const result=await get(prefix+'/fiscalDocuments/'+prior.value.documentId);
        if(!result || result.value.companyId!==record.companyId
          || result.value.fingerprint!==meta.fingerprint)
          throw new FiscalStoreError('NFE_STORE_INTEGRITY',503);
        return result.value;
      }
      const auditId=randomUUID();
      const writes=[
        {path:docPath,value:record,precondition:{exists:false}},
        {path:idemPath,value:{companyId:record.companyId,documentId:record.id,
          fingerprint:meta.fingerprint,keyHash:hashed(meta.idempotencyKey)},precondition:{exists:false}},
        {path:numberPath,value:{companyId:record.companyId,documentId:record.id,
          numberKeyHash:hashed(meta.numberKey)},precondition:{exists:false}},
        {path:prefix+'/auditEvents/'+auditId,
          value:{companyId:record.companyId,eventId:auditId,action:'fiscal.reserve',
            entityId:record.id,actorUid:record.createdByUid,occurredAt:record.createdAt,
            beforeRevision:null,afterRevision:record.revision},precondition:{exists:false}},
      ];
      try { await commit(writes); return record; }
      catch(e) {
        if (!isConflict(e)) throw new FiscalStoreError('NFE_STORE_UNAVAILABLE');
        // Commit may have succeeded with a lost HTTP response; read idempotency
        // before returning conflict, never allocate another number or send POST.
        const replay=await get(idemPath);
        if (replay) {
          if (replay.value.fingerprint!==meta.fingerprint || replay.value.companyId!==record.companyId)
            throw new FiscalStoreError('NFE_IDEMPOTENCY_CONFLICT',409);
          const same=await get(prefix+'/fiscalDocuments/'+replay.value.documentId);
          if (same && same.value.companyId===record.companyId && same.value.fingerprint===meta.fingerprint)
            return same.value;
          throw new FiscalStoreError('NFE_STORE_INTEGRITY',503);
        }
        throw new FiscalStoreError('NFE_NUMBER_RESERVED',409);
      }
    },
    async read(companyId,id) {
      const prefix=root(companyId);
      if (!ID.test(id||'')) throw new FiscalStoreError('NFE_INVALID_ID',422);
      const entry=await get(prefix+'/fiscalDocuments/'+id);
      if(!entry)return null;
      if(entry.value.companyId!==companyId || entry.value.workspaceId!==companyId)
        throw new FiscalStoreError('NFE_TENANT_FORBIDDEN',403);
      return entry.value;
    },
    async cas(companyId,id,expectedRevision,next) {
      const prefix=root(companyId);
      if(!ID.test(id||'') || !Number.isSafeInteger(expectedRevision))
        throw new FiscalStoreError('NFE_INVALID_INPUT',422);
      if(!next || next.companyId!==companyId || next.id!==id || next.revision!==expectedRevision+1)
        throw new FiscalStoreError('NFE_CAS_SCOPE_INVALID',403);
      assertRecord(next);
      const path=prefix+'/fiscalDocuments/'+id;
      const before=await get(path);
      if(!before || before.value.companyId!==companyId
        || before.value.workspaceId!==companyId
        || before.value.revision!==expectedRevision) return null;
      // Reserve critical identity and immutable business fields across all revisions.
      for(const f of ['issuerCnpj','connectionId','environment','series','number','orderId',
        'idempotencyKey','fingerprint','reservationId','createdByUid']) {
        if(next[f]!==before.value[f]) throw new FiscalStoreError('NFE_IMMUTABLE_FIELD_CHANGED',403);
      }
      const eventId=randomUUID();
      try {
        await commit([
          {path,value:next,precondition:{updateTime:before.updateTime}},
          {path:prefix+'/auditEvents/'+eventId,
            value:{companyId,eventId,action:'fiscal.transition',entityId:id,
              actorUid:next.audit?.at(-1)?.uid||next.createdByUid,
              occurredAt:next.updatedAt,beforeRevision:expectedRevision,afterRevision:next.revision},
            precondition:{exists:false}},
        ]);
        return next;
      } catch(e) {
        if(isConflict(e))return null;
        throw new FiscalStoreError('NFE_STORE_UNAVAILABLE');
      }
    },
  });
}
