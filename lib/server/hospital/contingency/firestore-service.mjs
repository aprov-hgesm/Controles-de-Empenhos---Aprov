import {createHash,randomUUID} from 'node:crypto';
import {assertHospital,assertIdentifier} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';

/**
 * Downtime paper re-entry is a PENDING AUDIT record, never a delivery event.
 * The physical form remains the institutional source until review. In particular,
 * this service NEVER mutates meal.status or fabricates a delivered timestamp.
 * Uses the canonical W10 Firestore transaction + immutable event journal.
 */
const stages=new Set(['REQUESTED_EXTERNALLY','PREPARED_EXTERNALLY','DISPATCHED_EXTERNALLY',
  'RECEIVED_EXTERNALLY','DELIVERY_REPORTED','NON_DELIVERY','SAFETY_INCIDENT']);
const reasons=new Set(['SYSTEM_OUTAGE','NETWORK_OUTAGE','SHIFT_HANDOVER','EMERGENCY','OTHER']);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const safeReference=value=>{
  assertHospital(typeof value==='string'&&/^QA_[A-Za-z0-9_-]{6,70}$/.test(value),
    'INVALID','Referência externa opaca obrigatória (QA_)');
  return value;
};
function historicalInstant(value){
  assertHospital(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    'INVALID','Horário efetivo com fuso obrigatório');
  const timestamp=Date.parse(value),now=Date.now();
  assertHospital(Number.isFinite(timestamp)&&timestamp<=now+5*60_000
    &&timestamp>=now-14*86400_000,'INVALID','Horário efetivo fora da janela de auditoria');
  return new Date(timestamp).toISOString();
}
export class HospitalContingencyService {
  constructor(store){
    assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Firestore QA indisponível');
    this.store=store;
  }
  async registerExternalRecord(scope,payload={}){
    const {unitId,admissionId,mealId=null,externalRecordRef,stage,reasonCode,effectiveAt,
      identifiersChecked=false}=payload;
    assertIdentifier(unitId,'unitId');assertIdentifier(admissionId,'admissionId');
    requireHospitalPermission(scope,'incident:write',unitId);
    if(mealId!==null)assertIdentifier(mealId,'mealId');
    safeReference(externalRecordRef);
    assertHospital(stages.has(stage),'INVALID','Etapa externa inválida');
    assertHospital(reasons.has(reasonCode),'INVALID','Motivo padronizado obrigatório');
    assertHospital(typeof identifiersChecked==='boolean','INVALID','Conferência inválida');
    if(stage==='DELIVERY_REPORTED')
      assertHospital(identifiersChecked,'PRECONDITION','Relato de entrega exige confirmação de dois identificadores');
    const declaredAt=historicalInstant(effectiveAt);
    const input={unitId,admissionId,mealId,externalRecordRef,stage,reasonCode,
      effectiveAt:declaredAt,identifiersChecked,actorUid:scope.uid};
    return this.store.transaction(async db=>db.idempotent(scope.organizationId,
      'w12.contingency.external',externalRecordRef,digest(input),async()=>{
      const admission=await db.get(scope.organizationId,'admission',admissionId);
      assertHospital(admission&&admission.unitId===unitId,'NOT_FOUND','Internação fora da unidade');
      if(mealId){
        const meal=await db.get(scope.organizationId,'meal',mealId);
        assertHospital(meal&&meal.unitId===unitId&&meal.admissionId===admissionId,
          'NOT_FOUND','Refeição fora da internação/unidade');
      }
      const now=db.now(),id='incident_'+randomUUID();
      const incident=await db.put(scope.organizationId,'incident',unitId,{
        id,organizationId:scope.organizationId,unitId,admissionId,mealId,
        type:'DOWNTIME_RECONCILIATION',stage,reasonCode,
        externalRecordHash:digest(scope.organizationId+':'+externalRecordRef),
        identifiersChecked,claimedEffectiveAt:declaredAt,
        status:'PENDING_INSTITUTIONAL_REVIEW',createdAt:now,actorUid:scope.uid
      });
      await db.appendEvent(scope.organizationId,'incident',id,'hospital.contingency.recorded',
        scope.uid,{unitId,admissionId,mealId,stage,reasonCode,
          effectiveTimeIsDeclared:true,reviewRequired:true},declaredAt);
      return {incidentId:incident.id,status:incident.status,claimedEffectiveAt:declaredAt,
        recordedAt:now,deliveryConfirmedBySystem:false,reviewRequired:true};
    }));
  }
}
