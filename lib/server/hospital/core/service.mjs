import {createHash} from 'node:crypto';
import {assertHospital,assertDate,assertIdentifier,classifyMealTiming,assertMealReleaseSafe,nextMealStatus,nextMapStatus,nextLocationStatus,nextNutritionAuditStatus} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission,requireHospitalOrganization} from './auth.mjs';
const id=(kind,value)=>`${kind}_${createHash('sha256').update(value).digest('hex').slice(0,24)}`;
const permittedTypes=new Set(['patient','admission','medical_reference','catalog_diet','map','meal','location_event','nutrition_audit','incident','production_batch','delivery_event']);
function hash(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex')}
function safeString(s,name){assertHospital(typeof s==='string'&&s.trim().length>0&&s.length<=1000,'INVALID',`${name} obrigatório`);return s.trim()}
/** A server-only, transaction-backed domain service. No unauthenticated method and no HTTP exposure of QA seeding. */
export class HospitalCoreService {
  constructor(store){assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Hospital storage indisponível');this.store=store}
  get(scope,kind,recordId,unitId){
    assertHospital(permittedTypes.has(kind),'INVALID','Tipo inválido');assertIdentifier(recordId);requireHospitalPermission(scope,kind==='nutrition_audit'?'nutrition:read':kind==='map'?'map:read':kind==='meal'?'meal:read':kind==='incident'?'incident:write':kind==='production_batch'?'meal:production':kind==='delivery_event'?'meal:distribution':'admission:read',unitId);
    const result=this.store.get(scope.organizationId,kind,recordId);
    assertHospital(result&&result.unitId===unitId,'NOT_FOUND','Registro não encontrado na unidade permitida');return result;
  }
  list(scope,kind,unitId){
    assertHospital(permittedTypes.has(kind),'INVALID','Tipo inválido');requireHospitalPermission(scope,kind==='nutrition_audit'?'nutrition:read':kind==='map'?'map:read':kind==='meal'?'meal:read':'admission:read',unitId);
    return this.store.list(scope.organizationId,kind,unitId);
  }
  createPatient(scope,{patientId,unitId,referenceCode}){
    requireHospitalPermission(scope,'patient:write',unitId);assertIdentifier(patientId);safeString(referenceCode,'Referência do paciente');
    return this.store.transaction(db=>{const result=db.put(scope.organizationId,'patient',unitId,{id:patientId,organizationId:scope.organizationId,unitId,referenceCode,createdAt:db.now()});db.appendEvent(scope.organizationId,'patient',patientId,'patient/created',scope.uid,{unitId});return result});
  }
  upsertDietCatalogItem(scope,{catalogItemId,code,label,restrictionCodes=[]}){
    requireHospitalPermission(scope,'hospital:manage');assertIdentifier(catalogItemId);assertIdentifier(code);safeString(label,'Nome da dieta');assertHospital(Array.isArray(restrictionCodes)&&restrictionCodes.every(x=>typeof x==='string'),'INVALID','Restrições inválidas');
    return this.store.transaction(db=>{const prev=db.get(scope.organizationId,'catalog_diet',catalogItemId);const result=db.put(scope.organizationId,'catalog_diet','hospital_catalog',{id:catalogItemId,organizationId:scope.organizationId,unitId:'hospital_catalog',code,label,restrictionCodes,active:true},prev?.revision);db.appendEvent(scope.organizationId,'catalog_diet',catalogItemId,'dietCatalog.updated',scope.uid,{code});return result});
  }
  createAdmission(scope,{admissionId,patientId,unitId,bedId=null,medicalReferenceId=null,fasting=false,allergyCodes=[]}){
    requireHospitalPermission(scope,'admission:write',unitId);assertIdentifier(admissionId);assertIdentifier(patientId);if(bedId!==null)assertIdentifier(bedId);assertHospital(Array.isArray(allergyCodes)&&allergyCodes.every(v=>typeof v==='string'),'INVALID','Restrições inválidas');
    return this.store.transaction(db=>{
      assertHospital(!db.get(scope.organizationId,'admission',admissionId),'CONFLICT','Internação já existe');
      this.get(scope,'patient',patientId,unitId);
      const result=db.put(scope.organizationId,'admission',unitId,{id:admissionId,organizationId:scope.organizationId,patientId,unitId,bedId,medicalReferenceId,status:'ACTIVE',fasting:!!fasting,allergyCodes,createdAt:db.now()});
      db.appendEvent(scope.organizationId,'admission',admissionId,'patient/admission.updated',scope.uid,{unitId,status:'ACTIVE'});return result;
    });
  }
  updateClinicalSafety(scope,{admissionId,unitId,fasting,allergyCodes,expectedRevision}){
    requireHospitalPermission(scope,'admission:write',unitId);assertHospital(typeof fasting==='boolean'&&Array.isArray(allergyCodes),'INVALID','Regras clínicas inválidas');
    return this.store.transaction(db=>{const admission=this.get(scope,'admission',admissionId,unitId);const result=db.put(scope.organizationId,'admission',unitId,{...admission,fasting,allergyCodes},expectedRevision);
      // Existing unsafe meals remain auditable but must not be released after the change.
      for(const meal of db.list(scope.organizationId,'meal',unitId).filter(m=>m.admissionId===admissionId&&!['DELIVERED','CANCELLED','SUSPENDED','SAFETY_BLOCKED'].includes(m.status))){
        if(fasting||allergyCodes.some(code=>meal.dietRestrictionCodes.includes(code))){
          db.put(scope.organizationId,'meal',unitId,{...meal,status:'SAFETY_BLOCKED'},meal.revision);
          db.appendEvent(scope.organizationId,'meal',meal.id,'meal.suspended',scope.uid,{reason:'CLINICAL_SAFETY_CHANGED'});
        }
      }
      db.appendEvent(scope.organizationId,'admission',admissionId,'dietReference.updated',scope.uid,{fasting,allergyCodes});return result;
    });
  }
  recordMedicalDiet(scope,{referenceId,admissionId,unitId,catalogItemId,sourceRef,prescribedAt}){
    requireHospitalPermission(scope,'admission:write',unitId);assertIdentifier(referenceId);assertIdentifier(catalogItemId);safeString(sourceRef,'Referência médica');assertHospital(!Number.isNaN(Date.parse(prescribedAt)),'INVALID','Data da prescrição inválida');
    return this.store.transaction(db=>{const admission=this.get(scope,'admission',admissionId,unitId);
      const catalog=db.get(scope.organizationId,'catalog_diet',catalogItemId);assertHospital(catalog&&catalog.active,'PRECONDITION','Dieta não existe no catálogo hospitalar');
      const result=db.put(scope.organizationId,'medical_reference',unitId,{id:referenceId,organizationId:scope.organizationId,unitId,admissionId,catalogItemId,sourceRef,prescribedAt,enteredByUid:scope.uid,createdAt:db.now()});
      db.put(scope.organizationId,'admission',unitId,{...admission,medicalReferenceId:referenceId},admission.revision);
      db.appendEvent(scope.organizationId,'admission',admissionId,'dietReference.updated',scope.uid,{referenceId,catalogItemId});return result;
    });
  }
  createDraftMap(scope,{unitId,localDate,cycleId}){
    requireHospitalPermission(scope,'map:write',unitId);assertDate(localDate);classifyMealTiming({cycleId,localDate,at:new Date()});
    const mapId=id('map',`${scope.organizationId}|${unitId}|${localDate}|${cycleId}`);
    return this.store.transaction(db=>{const existing=db.get(scope.organizationId,'map',mapId);if(existing)return existing;
      const result=db.put(scope.organizationId,'map',unitId,{id:mapId,organizationId:scope.organizationId,unitId,localDate,cycleId,status:'DRAFT',createdAt:db.now(),submittedAt:null,closedAt:null});
      db.appendEvent(scope.organizationId,'map',mapId,'map.created',scope.uid,{localDate,cycleId,unitId});return result;
    });
  }
  addMealRequest(scope,{mapId,admissionId,mealType,dietCode,medicalReferenceId,idempotencyKey,reason=null,effectiveAt=null}){
    assertIdentifier(idempotencyKey,'idempotencyKey');assertIdentifier(mapId);assertIdentifier(admissionId);assertIdentifier(medicalReferenceId);assertIdentifier(dietCode,'dietCode');
    const map=this.store.get(scope.organizationId,'map',mapId);assertHospital(map,'NOT_FOUND','Mapa não encontrado');requireHospitalPermission(scope,'meal:write',map.unitId);
    const input={mapId,admissionId,mealType,dietCode,medicalReferenceId,reason,effectiveAt};
    return this.store.transaction(db=>db.idempotent(scope.organizationId,'meal.create',idempotencyKey,hash(input),()=>{
      const current=db.get(scope.organizationId,'map',mapId);assertHospital(current&&current.unitId===map.unitId,'NOT_FOUND','Mapa fora de escopo');
      const admission=this.get(scope,'admission',admissionId,map.unitId);
      assertHospital(admission.status==='ACTIVE','PRECONDITION','Internação não ativa');
      const med=this.get(scope,'medical_reference',medicalReferenceId,map.unitId);
      assertHospital(med.admissionId===admissionId&&med.catalogItemId===dietCode&&admission.medicalReferenceId===med.id,'PRECONDITION','Dieta não corresponde à referência médica vigente');
      const catalog=db.get(scope.organizationId,'catalog_diet',dietCode);assertHospital(catalog&&catalog.active,'PRECONDITION','Dieta inexistente no catálogo');
      const timing=classifyMealTiming({cycleId:current.cycleId,localDate:current.localDate,at:db.now(),mealType});
      if(timing.principalDeliveryTolerancePassed&&mealType==='PRIMARY')assertHospital(false,'PRECONDITION','Principal após tolerância: encaminhar excepcionalidade clínica; fluxo regular apenas secundária');
      assertHospital(current.status==='DRAFT'||(current.status!=='DRAFT'&&typeof reason==='string'&&reason.trim()),'PRECONDITION','Adendo após envio exige justificativa');
      const existingId=db.getMealKey(scope.organizationId,admissionId,current.localDate,current.cycleId,mealType);
      if(existingId){const existing=db.get(scope.organizationId,'meal',existingId);assertHospital(existing&&existing.dietCode===dietCode&&existing.mapId===mapId,'CONFLICT','Já existe refeição com dados diferentes');return existing}
      const mealId=id('meal',`${scope.organizationId}|${admissionId}|${current.localDate}|${current.cycleId}|${mealType}`);
      const status=admission.fasting||admission.allergyCodes.some(code=>catalog.restrictionCodes.includes(code))?'SAFETY_BLOCKED':'REQUESTED';
      const result=db.put(scope.organizationId,'meal',map.unitId,{id:mealId,organizationId:scope.organizationId,unitId:map.unitId,mapId,admissionId,localDate:current.localDate,cycleId:current.cycleId,mealType,dietCode,dietRestrictionCodes:catalog.restrictionCodes,medicalReferenceId,status,requestedAt:db.now(),effectiveAt,advisory:timing.recommendation});
      db.ensureMealUnique(scope.organizationId,admissionId,current.localDate,current.cycleId,mealType,mealId);
      db.appendEvent(scope.organizationId,'meal',mealId,status==='SAFETY_BLOCKED'?'meal.suspended':'meal.requested',scope.uid,{timing,reason:reason||null,status},effectiveAt);
      if(current.status!=='DRAFT')this._snapshot(db,scope,current,'AMENDMENT',reason);
      return result;
    }));
  }
  _snapshot(db,scope,map,kind,reason=null){const meals=db.list(scope.organizationId,'meal',map.unitId).filter(m=>m.mapId===map.id);const versions=db.listMapVersions(scope.organizationId,map.id);const version=versions.length+1;
    const snap=db.saveMapVersion(scope.organizationId,map.id,version,kind,{map,meals},reason,scope.uid);
    db.appendEvent(scope.organizationId,'map',map.id,kind==='AMENDMENT'?'map.amended':'map.submitted',scope.uid,{version,kind,reason});return snap;
  }
  submitMap(scope,{mapId,expectedRevision,reason=null}){return this._advanceMap(scope,{mapId,expectedRevision,next:'SUBMITTED',reason})}
  closeMap(scope,{mapId,expectedRevision}){return this._advanceMap(scope,{mapId,expectedRevision,next:'CLOSED'})}
  _advanceMap(scope,{mapId,expectedRevision,next,reason}){
    const map=this.store.get(scope.organizationId,'map',mapId);assertHospital(map,'NOT_FOUND','Mapa não encontrado');requireHospitalPermission(scope,'map:write',map.unitId);
    return this.store.transaction(db=>{const current=this.get(scope,'map',mapId,map.unitId);nextMapStatus(current.status,next);
      const result=db.put(scope.organizationId,'map',map.unitId,{...current,status:next,submittedAt:next==='SUBMITTED'?db.now():current.submittedAt,closedAt:next==='CLOSED'?db.now():null},expectedRevision);
      this._snapshot(db,scope,result,next==='SUBMITTED'?'SUBMISSION':'CLOSE',reason);return result;
    });
  }
  advanceMeal(scope,{mealId,unitId,next,expectedRevision}){
    requireHospitalPermission(scope,['PREPARING','READY'].includes(next)?'meal:production':'meal:distribution',unitId);
    return this.store.transaction(db=>{const meal=this.get(scope,'meal',mealId,unitId);nextMealStatus(meal.status,next);
      const admission=db.get(scope.organizationId,'admission',meal.admissionId);
      assertHospital(admission&&admission.unitId===unitId&&admission.status==='ACTIVE','PRECONDITION','Internação fora da unidade ou encerrada');
      if(!['SUSPENDED','CANCELLED','SAFETY_BLOCKED'].includes(next))assertMealReleaseSafe({fasting:admission.fasting,allergyCodes:admission.allergyCodes,dietRestrictionCodes:meal.dietRestrictionCodes});
      const updated=db.put(scope.organizationId,'meal',unitId,{...meal,status:next},expectedRevision);
      const event=next==='PREPARING'?'meal.production.started':next==='READY'?'meal.production.completed':next==='DISPATCHED'?'meal.dispatched':next==='RECEIVED_BY_UNIT'?'meal.received':next==='DELIVERED'?'meal.delivered':'meal.suspended';
      db.appendEvent(scope.organizationId,'meal',meal.id,event,scope.uid,{from:meal.status,to:next});return updated;
    });
  }
  planTransfer(scope,{eventId,admissionId,fromUnitId,toUnitId,effectiveAt=null}){
    requireHospitalPermission(scope,'admission:write',fromUnitId);assertIdentifier(eventId);assertIdentifier(toUnitId);
    return this.store.transaction(db=>{this.get(scope,'admission',admissionId,fromUnitId);const result=db.put(scope.organizationId,'location_event',fromUnitId,{id:eventId,organizationId:scope.organizationId,unitId:fromUnitId,admissionId,fromUnitId,toUnitId,status:'PLANNED',effectiveAt,recordedAt:db.now(),actorUid:scope.uid});db.appendEvent(scope.organizationId,'admission',admissionId,'patient/location.planned',scope.uid,{eventId,fromUnitId,toUnitId},effectiveAt);return result});
  }
  confirmTransfer(scope,{eventId,fromUnitId,expectedRevision}){
    requireHospitalPermission(scope,'admission:write',fromUnitId);
    return this.store.transaction(db=>{const event=this.get(scope,'location_event',eventId,fromUnitId);requireHospitalPermission(scope,'admission:write',event.toUnitId);nextLocationStatus(event.status,'CONFIRMED');const admission=this.get(scope,'admission',event.admissionId,fromUnitId);
      const updated=db.put(scope.organizationId,'location_event',fromUnitId,{...event,status:'CONFIRMED'},expectedRevision);
      // Move admission record atomically (re-key its authorized unit); old unit cannot read it anymore.
      const patient=db.get(scope.organizationId,'patient',admission.patientId);
      if(patient&&patient.unitId===fromUnitId){const updatedPatient={...patient,unitId:event.toUnitId,revision:patient.revision+1};db.db.prepare('UPDATE records SET unit_id=?,revision=?,body=? WHERE organization_id=? AND kind=? AND id=? AND revision=?').run(event.toUnitId,updatedPatient.revision,JSON.stringify(updatedPatient),scope.organizationId,'patient',patient.id,patient.revision);}
      const move={...admission,unitId:event.toUnitId};db.db.prepare('UPDATE records SET unit_id=?,revision=?,body=? WHERE organization_id=? AND kind=? AND id=? AND revision=?').run(event.toUnitId,admission.revision+1,JSON.stringify({...move,revision:admission.revision+1}),scope.organizationId,'admission',admission.id,admission.revision);
      for(const meal of db.list(scope.organizationId,'meal',fromUnitId).filter(m=>m.admissionId===admission.id&&!['DELIVERED','CANCELLED','SUSPENDED','SAFETY_BLOCKED'].includes(m.status))){db.put(scope.organizationId,'meal',fromUnitId,{...meal,status:'SUSPENDED'},meal.revision);db.appendEvent(scope.organizationId,'meal',meal.id,'meal.suspended',scope.uid,{reason:'PATIENT_TRANSFER'});}
      db.appendEvent(scope.organizationId,'admission',admission.id,'patient/admission.updated',scope.uid,{fromUnitId,toUnitId:event.toUnitId,confirmed:true},event.effectiveAt);return updated;
    });
  }
  openNutritionAudit(scope,{auditId,unitId,admissionId,observation}){
    requireHospitalPermission(scope,'nutrition:write',unitId);assertIdentifier(auditId);safeString(observation,'Observação');
    return this.store.transaction(db=>{this.get(scope,'admission',admissionId,unitId);const result=db.put(scope.organizationId,'nutrition_audit',unitId,{id:auditId,organizationId:scope.organizationId,unitId,admissionId,status:'IDENTIFIED',observation,actorUid:scope.uid,createdAt:db.now()});db.appendEvent(scope.organizationId,'nutrition_audit',auditId,'nutritionAudit.opened',scope.uid,{admissionId});return result;});
  }
  transitionNutritionAudit(scope,{auditId,unitId,next,expectedRevision}){
    requireHospitalPermission(scope,'nutrition:write',unitId);return this.store.transaction(db=>{const audit=this.get(scope,'nutrition_audit',auditId,unitId);nextNutritionAuditStatus(audit.status,next);const result=db.put(scope.organizationId,'nutrition_audit',unitId,{...audit,status:next},expectedRevision);db.appendEvent(scope.organizationId,'nutrition_audit',auditId,next==='CLOSED'?'nutritionAudit.closed':'nutritionAudit.updated',scope.uid,{next});return result;});
  }
  auditTrail(scope,{kind,recordId,unitId}){requireHospitalPermission(scope,'audit:read');requireHospitalOrganization(scope,scope.organizationId);
    assertHospital(typeof unitId==='string'&&scope.unitIds.includes(unitId),'FORBIDDEN','Unidade fora da auditoria');const row=this.store.get(scope.organizationId,kind,recordId);assertHospital(row&&row.unitId===unitId,'NOT_FOUND','Registro não encontrado');return this.store.events(scope.organizationId,kind,recordId);}
  listMapVersions(scope,{mapId,unitId}){this.get(scope,'map',mapId,unitId);return this.store.listMapVersions(scope.organizationId,mapId)}
}
