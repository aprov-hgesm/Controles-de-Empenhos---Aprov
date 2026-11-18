import {randomUUID} from 'node:crypto';
import {assertHospital, assertIdentifier, HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';

const newId = prefix => prefix + '_' + randomUUID().replaceAll('-', '');
const clean = (value, label, max=160) => {
  assertHospital(typeof value==='string' && !!value.trim() && value.trim().length<=max,'INVALID',label+' inválido');
  return value.trim();
};
const optionalTime = value => {
  assertHospital(value==null || (typeof value==='string' && !Number.isNaN(Date.parse(value))),'INVALID','Horário inválido');
  return value ?? null;
};
const revision = value => assertHospital(Number.isInteger(value)&&value>0,'INVALID','expectedRevision obrigatório');
const record = (db,scope,kind,id,unitId) => {
  assertIdentifier(id);
  const found=db.get(scope.organizationId,kind,id);
  assertHospital(found && found.unitId===unitId,'NOT_FOUND','Registro não encontrado nesta unidade');
  return found;
};
const checkUnit = (scope,unitId,permission='admission:write') => requireHospitalPermission(scope,permission,unitId);
const activeAdmission = (db,o,patientId) => db.db.prepare(
  "SELECT body FROM records WHERE organization_id=? AND kind='admission' AND json_extract(body,'$.patientId')=? AND json_extract(body,'$.status')='ACTIVE' LIMIT 1"
).get(o,patientId);
const occupied = (db,o,unitId,bedId,excludeId=null) => {
  if (!bedId) return false;
  return !!db.db.prepare("SELECT id FROM records WHERE organization_id=? AND kind='admission' AND unit_id=? AND json_extract(body,'$.bedId')=? AND json_extract(body,'$.status')='ACTIVE' AND id<>? LIMIT 1").get(o,unitId,bedId,excludeId??'');
};
function assertBed(db,scope,unitId,bedId,excludeId=null) {
  if (bedId==null) return;
  assertIdentifier(bedId);
  const bed=record(db,scope,'bed',bedId,unitId);
  assertHospital(bed.active===true,'PRECONDITION','Leito inativo');
  assertHospital(!occupied(db,scope.organizationId,unitId,bedId,excludeId),'CONFLICT','Leito já ocupado');
}
function casMove(db,scope,kind,item,toUnitId,patch={}) {
  const next={...item,...patch,unitId:toUnitId,revision:item.revision+1};
  const result=db.db.prepare('UPDATE records SET unit_id=?, revision=?, body=? WHERE organization_id=? AND kind=? AND id=? AND revision=?')
    .run(toUnitId,next.revision,JSON.stringify(next),scope.organizationId,kind,item.id,item.revision);
  assertHospital(result.changes===1,'CONFLICT','Alteração concorrente');
  return next;
}
function audit(db,scope,admissionId,type,details={},effectiveAt=null) {
  return db.appendEvent(scope.organizationId,'admission',admissionId,type,scope.uid,details,effectiveAt);
}
const pending = s => !['DELIVERED','CANCELLED','SUSPENDED','SAFETY_BLOCKED'].includes(s);

/** Uses W0's canonical records, transactions, authorization and immutable journal, never a second patient registry. */
export class HospitalPatientsService {
  constructor(store) {
    assertHospital(store&&typeof store.transaction==='function'&&store.db,'UNAVAILABLE','Storage QA hospitalar indisponível');
    this.store=store;
    // Per-OM canonical institutional identifier. SQLite QA only; never runs a production migration.
    store.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_w2_patient_reference ON records(organization_id, upper(json_extract(body,'$.referenceCode'))) WHERE kind='patient'");
  }
  registerPatient(scope,{unitId,referenceCode,displayName,patientId}={}) {
    checkUnit(scope,unitId,'patient:write');
    const ref=clean(referenceCode,'Identificador institucional',80).toUpperCase();
    const name=displayName==null?'':clean(displayName,'Nome',160);
    const id=patientId??newId('pt');assertIdentifier(id);
    return this.store.transaction(db=>{
      const dupe=db.db.prepare("SELECT id,unit_id FROM records WHERE organization_id=? AND kind='patient' AND upper(json_extract(body,'$.referenceCode'))=? LIMIT 1").get(scope.organizationId,ref);
      assertHospital(!dupe,'CONFLICT','Identificador institucional já cadastrado');
      const result=db.put(scope.organizationId,'patient',unitId,{id,organizationId:scope.organizationId,unitId,referenceCode:ref,displayName:name,createdAt:db.now()});
      db.appendEvent(scope.organizationId,'patient',id,'patient/created',scope.uid,{unitId,fields:['referenceCode','displayName']});
      return result;
    });
  }
  updatePatient(scope,{unitId,patientId,displayName,expectedRevision}={}) {
    checkUnit(scope,unitId,'patient:write');revision(expectedRevision);
    const name=clean(displayName,'Nome',160);
    return this.store.transaction(db=>{
      const old=record(db,scope,'patient',patientId,unitId);
      const next=db.put(scope.organizationId,'patient',unitId,{...old,displayName:name},expectedRevision);
      db.appendEvent(scope.organizationId,'patient',patientId,'patient/updated',scope.uid,{changedFields:['displayName'],beforeRevision:old.revision,afterRevision:next.revision});
      return next;
    });
  }
  saveBed(scope,{unitId,bedId,label,active=true,expectedRevision}={}) {
    requireHospitalPermission(scope,'hospital:manage');
    assertHospital(scope.unitIds.includes(unitId),'FORBIDDEN','Unidade fora da gestão autorizada');
    assertIdentifier(bedId);const name=clean(label,'Identificação do leito',60);
    assertHospital(typeof active==='boolean','INVALID','Situação de leito inválida');
    return this.store.transaction(db=>{
      const old=db.get(scope.organizationId,'bed',bedId);
      if(old)assertHospital(old.unitId===unitId,'FORBIDDEN','Leito de outra unidade');
      const next=db.put(scope.organizationId,'bed',unitId,{id:bedId,organizationId:scope.organizationId,unitId,label:name,active},expectedRevision);
      db.appendEvent(scope.organizationId,'bed',bedId,'bed/configured',scope.uid,{unitId,active,beforeRevision:old?.revision??0,afterRevision:next.revision});
      return next;
    });
  }
  listBeds(scope,{unitId}={}) {
    checkUnit(scope,unitId,'admission:read');
    const beds=this.store.list(scope.organizationId,'bed',unitId);
    return beds.map(b=>({...b,occupied:occupied(this.store,scope.organizationId,unitId,b.id)}));
  }
  admit(scope,{patientId,unitId,bedId=null,admissionId,expectedPatientRevision}={}) {
    checkUnit(scope,unitId);
    assertIdentifier(patientId);const id=admissionId??newId('adm');assertIdentifier(id);
    return this.store.transaction(db=>{
      let patient=db.get(scope.organizationId,'patient',patientId);
      assertHospital(patient,'NOT_FOUND','Paciente não encontrado');
      if(patient.unitId!==unitId) {
        // Past episode in another unit: only cross-unit authorized personnel may reassign the canonical identity.
        checkUnit(scope,patient.unitId,'patient:write');
        assertHospital(Number.isInteger(expectedPatientRevision)&&expectedPatientRevision===patient.revision,'CONFLICT','Paciente alterado');
      }
      assertHospital(!activeAdmission(db,scope.organizationId,patientId),'CONFLICT','Paciente possui internação ativa');
      assertHospital(!db.get(scope.organizationId,'admission',id),'CONFLICT','Internação duplicada');
      assertBed(db,scope,unitId,bedId);
      if(patient.unitId!==unitId) patient=casMove(db,scope,'patient',patient,unitId);
      const admission=db.put(scope.organizationId,'admission',unitId,{
        id,organizationId:scope.organizationId,patientId,unitId,bedId,medicalReferenceId:null,
        status:'ACTIVE',fasting:false,allergyCodes:[],temporaryUnitId:null,
        plannedDischargeAt:null,createdAt:db.now(),dischargedAt:null
      });
      audit(db,scope,id,'patient/admission.updated',{action:'ADMITTED',unitId,bedId});
      return admission;
    });
  }
  getPatient(scope,{unitId,patientId}={}) {
    checkUnit(scope,unitId,'patient:read');
    return record(this.store,scope,'patient',patientId,unitId);
  }
  getAdmission(scope,{unitId,admissionId}={}) {
    checkUnit(scope,unitId,'admission:read');
    const a=record(this.store,scope,'admission',admissionId,unitId);
    const p=record(this.store,scope,'patient',a.patientId,unitId);
    return {admission:a,patient:p,medicalReferenceId:a.medicalReferenceId??null};
  }
  search(scope,{unitId,q='',status='ACTIVE',limit=20,offset=0}={}) {
    checkUnit(scope,unitId,'patient:read');
    assertHospital(typeof q==='string'&&q.length<=160,'INVALID','Pesquisa inválida');
    assertHospital(['ACTIVE','DISCHARGED','ALL'].includes(status),'INVALID','Filtro inválido');
    assertHospital(Number.isInteger(limit)&&limit>=1&&limit<=50&&Number.isInteger(offset)&&offset>=0&&offset<=10000,'INVALID','Paginação inválida');
    const needle=q.trim().toLocaleLowerCase('pt-BR');
    // Page scoped by server-trusted OM+unit; patient and admission remain independent entities.
    const patients=this.store.list(scope.organizationId,'patient',unitId);
    const admissions=this.store.list(scope.organizationId,'admission',unitId);
    const beds=new Map(this.store.list(scope.organizationId,'bed',unitId).map(b=>[b.id,b.label]));
    const byPatient=new Map();
    for(const a of admissions){const list=byPatient.get(a.patientId)??[];list.push(a);byPatient.set(a.patientId,list);}
    const rows=[];
    for(const p of patients){
      const episodes=byPatient.get(p.id)??[];
      const selected=episodes.filter(a=>status==='ALL'||a.status===status);
      if(!selected.length && status!=='ALL' && episodes.length)continue;
      for(const admission of selected.length?selected:[null]){
        const label=admission?.bedId?beds.get(admission.bedId)??'':'';
        if(needle&&!([p.displayName??'',p.referenceCode,label].some(v=>v.toLocaleLowerCase('pt-BR').includes(needle))))continue;
        rows.push({patient:p,admission,bedLabel:label,medicalReferenceId:admission?.medicalReferenceId??null});
      }
    }
    rows.sort((a,b)=>(b.admission?.createdAt??b.patient.createdAt).localeCompare(a.admission?.createdAt??a.patient.createdAt));
    return {items:rows.slice(offset,offset+limit),total:rows.length,limit,offset};
  }
  changeBed(scope,{unitId,admissionId,toBedId=null,expectedRevision}={}) {
    checkUnit(scope,unitId);revision(expectedRevision);
    return this.store.transaction(db=>{
      const a=record(db,scope,'admission',admissionId,unitId);
      assertHospital(a.status==='ACTIVE','PRECONDITION','Internação encerrada');
      assertBed(db,scope,unitId,toBedId,a.id);
      const next=db.put(scope.organizationId,'admission',unitId,{...a,bedId:toBedId},expectedRevision);
      audit(db,scope,a.id,'patient/bed.changed',{fromBedId:a.bedId,toBedId,unitId,revision:next.revision});
      return next;
    });
  }
  planTransfer(scope,{unitId,admissionId,toUnitId,toBedId=null,eventId,effectiveAt=null}={}) {
    checkUnit(scope,unitId);assertIdentifier(toUnitId);
    assertHospital(unitId!==toUnitId,'INVALID','Use alteração de leito para mesma unidade');
    optionalTime(effectiveAt);const id=eventId??newId('move');assertIdentifier(id);
    return this.store.transaction(db=>{
      const a=record(db,scope,'admission',admissionId,unitId);
      assertHospital(a.status==='ACTIVE','PRECONDITION','Internação encerrada');
      assertHospital(!db.get(scope.organizationId,'location_event',id),'CONFLICT','Evento existente');
      const event=db.put(scope.organizationId,'location_event',unitId,{
        id,organizationId:scope.organizationId,unitId,admissionId:a.id,fromUnitId:unitId,toUnitId,
        fromBedId:a.bedId,toBedId,status:'PLANNED',movementType:'TRANSFER',
        effectiveAt,recordedAt:db.now(),actorUid:scope.uid
      });
      audit(db,scope,a.id,'patient/location.planned',{eventId:id,fromUnitId:unitId,toUnitId},effectiveAt);
      return event;
    });
  }
  cancelTransfer(scope,{unitId,eventId,expectedRevision}={}) {
    checkUnit(scope,unitId);revision(expectedRevision);
    return this.store.transaction(db=>{
      const ev=record(db,scope,'location_event',eventId,unitId);
      assertHospital(ev.movementType==='TRANSFER'&&ev.status==='PLANNED','PRECONDITION','Transferência não está prevista');
      const next=db.put(scope.organizationId,'location_event',unitId,{...ev,status:'CANCELLED'},expectedRevision);
      audit(db,scope,ev.admissionId,'patient/location.cancelled',{eventId,fromUnitId:unitId,toUnitId:ev.toUnitId});
      return next;
    });
  }
  confirmTransfer(scope,{unitId,eventId,expectedRevision,admissionRevision}={}) {
    checkUnit(scope,unitId);revision(expectedRevision);revision(admissionRevision);
    return this.store.transaction(db=>{
      const ev=record(db,scope,'location_event',eventId,unitId);
      assertHospital(ev.movementType==='TRANSFER'&&ev.status==='PLANNED','PRECONDITION','Transferência não está prevista');
      checkUnit(scope,ev.toUnitId); // both origin and destination required, never transfer with source-only token
      const a=record(db,scope,'admission',ev.admissionId,unitId);
      assertHospital(a.status==='ACTIVE'&&a.revision===admissionRevision,'CONFLICT','Internação alterada');
      assertBed(db,scope,ev.toUnitId,ev.toBedId);
      const updatedEvent=db.put(scope.organizationId,'location_event',unitId,{...ev,status:'CONFIRMED'},expectedRevision);
      const newAdmission=casMove(db,scope,'admission',a,ev.toUnitId,{bedId:ev.toBedId,temporaryUnitId:null});
      const patient=record(db,scope,'patient',a.patientId,unitId);
      casMove(db,scope,'patient',patient,ev.toUnitId);
      // Diet reference follows the episode; never rewrites the medical prescription itself.
      if(a.medicalReferenceId){
        const ref=record(db,scope,'medical_reference',a.medicalReferenceId,unitId);
        casMove(db,scope,'medical_reference',ref,ev.toUnitId);
      }
      // One meal per admission/date/cycle/type remains enforced by W0 meal_keys.
      // Pending meals move to destination in suspended state: kitchen/destination must reconcile.
      for(const meal of db.list(scope.organizationId,'meal',unitId).filter(m=>m.admissionId===a.id&&pending(m.status))){
        casMove(db,scope,'meal',meal,ev.toUnitId,{status:'SUSPENDED',destinationUnitId:ev.toUnitId});
        db.appendEvent(scope.organizationId,'meal',meal.id,'meal.suspended',scope.uid,{reason:'PATIENT_TRANSFER',fromUnitId:unitId,toUnitId:ev.toUnitId});
      }
      audit(db,scope,a.id,'patient/admission.updated',{action:'TRANSFER_CONFIRMED',eventId,fromUnitId:unitId,toUnitId:ev.toUnitId,fromBedId:a.bedId,toBedId:ev.toBedId,notifiedUnits:[unitId,ev.toUnitId],notifyKitchen:true},ev.effectiveAt);
      return {event:updatedEvent,admission:newAdmission};
    });
  }
  temporaryDeparture(scope,{unitId,admissionId,toUnitId,eventId,expectedRevision}={}) {
    checkUnit(scope,unitId);revision(expectedRevision);assertIdentifier(toUnitId);
    const id=eventId??newId('temp');assertIdentifier(id);
    return this.store.transaction(db=>{
      const a=record(db,scope,'admission',admissionId,unitId);
      assertHospital(a.status==='ACTIVE'&&!a.temporaryUnitId,'PRECONDITION','Saída temporária não permitida');
      const next=db.put(scope.organizationId,'admission',unitId,{...a,temporaryUnitId:toUnitId},expectedRevision);
      audit(db,scope,a.id,'patient/location.temporary_departure',{eventId:id,fromUnitId:unitId,toUnitId,homeBedId:a.bedId,notifyKitchen:true});
      return next;
    });
  }
  temporaryReturn(scope,{unitId,admissionId,expectedRevision}={}) {
    checkUnit(scope,unitId);revision(expectedRevision);
    return this.store.transaction(db=>{
      const a=record(db,scope,'admission',admissionId,unitId);
      assertHospital(a.status==='ACTIVE'&&!!a.temporaryUnitId,'PRECONDITION','Paciente não está em saída temporária');
      const next=db.put(scope.organizationId,'admission',unitId,{...a,temporaryUnitId:null},expectedRevision);
      audit(db,scope,a.id,'patient/location.temporary_return',{fromUnitId:a.temporaryUnitId,toUnitId:unitId,homeBedId:a.bedId,notifyKitchen:true});
      return next;
    });
  }
  planDischarge(scope,{unitId,admissionId,plannedAt,expectedRevision}={}) {
    checkUnit(scope,unitId);revision(expectedRevision);optionalTime(plannedAt);
    assertHospital(!!plannedAt,'INVALID','Informe previsão');
    return this.store.transaction(db=>{
      const a=record(db,scope,'admission',admissionId,unitId);
      assertHospital(a.status==='ACTIVE','PRECONDITION','Internação encerrada');
      const next=db.put(scope.organizationId,'admission',unitId,{...a,plannedDischargeAt:plannedAt},expectedRevision);
      audit(db,scope,a.id,'patient/discharge.planned',{unitId,plannedAt,doesNotCancelMeals:true});
      return next;
    });
  }
  cancelDischarge(scope,{unitId,admissionId,expectedRevision}={}) {
    checkUnit(scope,unitId);revision(expectedRevision);
    return this.store.transaction(db=>{
      const a=record(db,scope,'admission',admissionId,unitId);
      assertHospital(a.status==='ACTIVE'&&!!a.plannedDischargeAt,'PRECONDITION','Sem alta prevista para cancelar');
      const next=db.put(scope.organizationId,'admission',unitId,{...a,plannedDischargeAt:null},expectedRevision);
      audit(db,scope,a.id,'patient/discharge.cancelled',{unitId});
      return next;
    });
  }
  confirmDischarge(scope,{unitId,admissionId,expectedRevision,outcome='DISCHARGE'}={}) {
    checkUnit(scope,unitId);revision(expectedRevision);
    assertHospital(['DISCHARGE','DEATH','OTHER'].includes(outcome),'INVALID','Desfecho inválido');
    // Death outcome requires institution-specific authorization; not enabled in R1.
    assertHospital(outcome==='DISCHARGE','PRECONDITION','Desfecho especial depende de protocolo institucional');
    return this.store.transaction(db=>{
      const a=record(db,scope,'admission',admissionId,unitId);
      assertHospital(a.status==='ACTIVE','PRECONDITION','Internação já encerrada');
      const next=db.put(scope.organizationId,'admission',unitId,{...a,status:'DISCHARGED',dischargedAt:db.now(),plannedDischargeAt:null,temporaryUnitId:null},expectedRevision);
      for(const meal of db.list(scope.organizationId,'meal',unitId).filter(m=>m.admissionId===a.id&&pending(m.status))){
        db.put(scope.organizationId,'meal',unitId,{...meal,status:'SUSPENDED'},meal.revision);
        db.appendEvent(scope.organizationId,'meal',meal.id,'meal.suspended',scope.uid,{reason:'PATIENT_DISCHARGED'});
      }
      audit(db,scope,a.id,'patient/admission.updated',{action:'DISCHARGED',unitId,notifyKitchen:true});
      return next;
    });
  }
  history(scope,{unitId,admissionId}={}) {
    checkUnit(scope,unitId,'admission:read');
    record(this.store,scope,'admission',admissionId,unitId);
    return this.store.events(scope.organizationId,'admission',admissionId).map(e=>({
      id:e.id,eventType:e.eventType,actorUid:e.actorUid,occurredAt:e.occurredAt,effectiveAt:e.effectiveAt,payload:e.payload
    }));
  }
  listNotices(scope,{unitId,limit=30}={}) {
    checkUnit(scope,unitId,'admission:read');
    assertHospital(Number.isInteger(limit)&&limit>0&&limit<=100,'INVALID','Limite inválido');
    // Secure, minimal projection of the immutable W0 journal, including destination events.
    const rows=this.store.db.prepare("SELECT id,type,occurred_at,payload FROM hospital_events WHERE organization_id=? AND kind='admission' AND type IN ('patient/admission.updated','patient/location.temporary_departure','patient/location.temporary_return') ORDER BY id DESC LIMIT 300").all(scope.organizationId);
    return rows.map(r=>({id:r.id,type:r.type,occurredAt:r.occurred_at,payload:JSON.parse(r.payload)}))
      .filter(e=>e.payload.notifyKitchen && (e.payload.unitId===unitId||e.payload.fromUnitId===unitId||e.payload.toUnitId===unitId||e.payload.notifiedUnits?.includes(unitId)))
      .slice(0,limit);
  }
}
