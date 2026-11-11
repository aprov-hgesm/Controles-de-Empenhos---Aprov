import { createHash, randomUUID } from 'node:crypto';
import { HospitalError, assertHospital, assertIdentifier, assertDate } from '../../../../features/hospital/core/domain.mjs';
import { requireHospitalPermission } from '../core/auth.mjs';

const categoriesDefault = ['DOCUMENTATION','DIET_MISMATCH','ALLERGY','FASTING','DELIVERY','OTHER'];
const risksDefault = ['LOW','MODERATE','HIGH','CRITICAL'];
const statuses = ['IDENTIFIED','CONTACTED','FOLLOW_UP','CLOSED'];
const channels = ['PHONE','IN_PERSON','INSTITUTIONAL_EMAIL','OTHER'];
const text = (value, name, max = 1000) => { assertHospital(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, 'INVALID', `${name} obrigatório (máx. ${max})`); return value.trim(); };
const optionalText = (value, name, max=500) => value == null || value === '' ? null : text(value,name,max);
const time = (value, name) => { assertHospital(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'INVALID', `${name} inválido`); assertHospital(Date.parse(value) <= Date.now()+300000, 'INVALID', `${name} futuro não permitido`); return new Date(value).toISOString(); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const parse = row => row ? JSON.parse(row.body) : null;
const safeLimit = n => Math.min(100,Math.max(1,Number.isInteger(Number(n)) ? Number(n) : 30));
const header = ['caseId','unitId','category','risk','status','openedAt','updatedAt','closedAt','medicalContacts','answeredContacts','firstResponseHours'];
const csvSafe = value => {const raw=String(value ?? ''); const neutral=/^[\s]*[=+@\-\t\r]/.test(raw)?`'${raw}`:raw; return `"${neutral.replace(/"/g,'""')}"`;};

/** Only operates on W0's local QA SQLite connection; no Cloud Run or production datastore. */
export class NutritionAuditService {
  constructor(store) {
    assertHospital(store?.db && typeof store.transaction === 'function' && typeof store.get === 'function', 'UNAVAILABLE','Storage hospitalar QA indisponível');
    this.store = store;
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS nutrition_findings(organization_id TEXT NOT NULL,unit_id TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(organization_id,id));
      CREATE INDEX IF NOT EXISTS nutrition_findings_scope ON nutrition_findings(organization_id,unit_id,id);
      CREATE TABLE IF NOT EXISTS nutrition_contacts(organization_id TEXT NOT NULL,unit_id TEXT NOT NULL,id TEXT NOT NULL,finding_id TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(organization_id,id));
      CREATE INDEX IF NOT EXISTS nutrition_contacts_finding ON nutrition_contacts(organization_id,finding_id);
      CREATE TABLE IF NOT EXISTS nutrition_catalog(organization_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS nutrition_history(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id TEXT NOT NULL,unit_id TEXT NOT NULL,aggregate_kind TEXT NOT NULL,aggregate_id TEXT NOT NULL,event_type TEXT NOT NULL,actor_uid TEXT NOT NULL,occurred_at TEXT NOT NULL,body TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS nutrition_history_scope ON nutrition_history(organization_id,unit_id,aggregate_kind,aggregate_id,id);
      CREATE TRIGGER IF NOT EXISTS nutrition_history_immutable_update BEFORE UPDATE ON nutrition_history BEGIN SELECT RAISE(ABORT,'immutable nutrition history'); END;
      CREATE TRIGGER IF NOT EXISTS nutrition_history_immutable_delete BEFORE DELETE ON nutrition_history BEGIN SELECT RAISE(ABORT,'immutable nutrition history'); END;`);
  }
  _unit(scope, unitId, write = false) {assertIdentifier(unitId,'unitId'); requireHospitalPermission(scope,write?'nutrition:write':'nutrition:read',unitId); return scope.organizationId;}
  _admission(scope,unitId,admissionId) {assertIdentifier(admissionId,'admissionId'); const a=this.store.get(scope.organizationId,'admission',admissionId);assertHospital(a && a.unitId === unitId,'NOT_FOUND','Internação não encontrada na unidade autorizada');return a;}
  _finding(scope,unitId,findingId) {assertIdentifier(findingId,'findingId');const f=parse(this.store.db.prepare('SELECT body FROM nutrition_findings WHERE organization_id=? AND unit_id=? AND id=?').get(scope.organizationId,unitId,findingId));assertHospital(f,'NOT_FOUND','Achado não encontrado');return f;}
  _contact(scope,unitId,contactId) {assertIdentifier(contactId,'contactId');const c=parse(this.store.db.prepare('SELECT body FROM nutrition_contacts WHERE organization_id=? AND unit_id=? AND id=?').get(scope.organizationId,unitId,contactId));assertHospital(c,'NOT_FOUND','Contato médico não encontrado');return c;}
  _history(scope,unitId,kind,id,event,details) {const at=this.store.now();this.store.db.prepare('INSERT INTO nutrition_history(organization_id,unit_id,aggregate_kind,aggregate_id,event_type,actor_uid,occurred_at,body) VALUES(?,?,?,?,?,?,?,?)').run(scope.organizationId,unitId,kind,id,event,scope.uid,at,JSON.stringify(details));this.store.appendEvent(scope.organizationId,kind,id,event,scope.uid,{unitId, ...details});return at;}
  catalog(scope,unitId) {this._unit(scope,unitId); const row=parse(this.store.db.prepare('SELECT body FROM nutrition_catalog WHERE organization_id=?').get(scope.organizationId));return row??{revision:0,categories:categoriesDefault,risks:risksDefault};}
  configureCatalog(scope,{categories,risks,expectedRevision=0}) {requireHospitalPermission(scope,'hospital:manage');const codes=a=>Array.isArray(a)&&a.length>0&&a.length<=30&&new Set(a).size===a.length&&a.every(x=>typeof x==='string' && /^[A-Z][A-Z0-9_]{1,39}$/.test(x));assertHospital(codes(categories)&&codes(risks),'INVALID','Catálogo inválido');assertHospital(Number.isInteger(expectedRevision)&&expectedRevision>=0,'INVALID','Versão inválida');return this.store.transaction(db=>{const row=db.db.prepare('SELECT * FROM nutrition_catalog WHERE organization_id=?').get(scope.organizationId);assertHospital((row?.revision??0)===expectedRevision,'CONFLICT','Catálogo foi alterado');const out={revision:expectedRevision+1,categories,risks};db.db.prepare('INSERT INTO nutrition_catalog(organization_id,revision,body) VALUES(?,?,?) ON CONFLICT(organization_id) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(scope.organizationId,out.revision,JSON.stringify(out));db.appendEvent(scope.organizationId,'nutrition_catalog',scope.organizationId,'nutritionCatalog.updated',scope.uid,{revision:out.revision});return out;});}
  createFinding(scope,{unitId,admissionId,medicalReferenceId=null,category,risk,evidence,recommendation,escalation=null,idempotencyKey}) {
    this._unit(scope,unitId,true);const admission=this._admission(scope,unitId,admissionId);assertIdentifier(idempotencyKey,'idempotencyKey');
    const cat=this.catalog(scope,unitId);assertHospital(cat.categories.includes(category)&&cat.risks.includes(risk),'INVALID','Categoria/risco fora do catálogo institucional');
    const evidenceValue=text(evidence,'Evidência mínima',500),recommendationValue=text(recommendation,'Recomendação',500),escalationValue=optionalText(escalation,'Encaminhamento',500);
    if(risk==='CRITICAL') assertHospital(!!escalationValue,'PRECONDITION','Achado crítico exige encaminhamento assistencial; não bloqueia mapas');
    if(medicalReferenceId) {assertIdentifier(medicalReferenceId,'medicalReferenceId');const ref=this.store.get(scope.organizationId,'medical_reference',medicalReferenceId);assertHospital(ref&&ref.unitId===unitId&&ref.admissionId===admission.id,'NOT_FOUND','Referência médica fora da internação');}
    const input={unitId,admissionId,medicalReferenceId,category,risk,evidence:evidenceValue,recommendation:recommendationValue,escalation:escalationValue};
    return this.store.transaction(db=>db.idempotent(scope.organizationId,`nutrition.finding:${scope.uid}`,idempotencyKey,hash(input),()=>{
      this._admission(scope,unitId,admissionId);const id=`nf_${randomUUID()}`,now=db.now();
      const finding={id,organizationId:scope.organizationId,unitId,admissionId,medicalReferenceId,category,risk,status:'IDENTIFIED',evidence:evidenceValue,recommendation:recommendationValue,escalation:escalationValue,createdAt:now,updatedAt:now,closedAt:null,createdBy:scope.uid,revision:1};
      db.db.prepare('INSERT INTO nutrition_findings(organization_id,unit_id,id,revision,body) VALUES(?,?,?,?,?)').run(scope.organizationId,unitId,id,1,JSON.stringify(finding));
      this._history(scope,unitId,'nutrition_finding',id,'nutritionAudit.opened',{category,risk,admissionId,medicalReferenceId,criticalEscalationRequired:risk==='CRITICAL'});return finding;
    }));
  }
  transitionFinding(scope,{unitId,findingId,next,reason,expectedRevision}) {
    this._unit(scope,unitId,true);text(reason,'Motivo',500);assertHospital(Number.isInteger(expectedRevision),'INVALID','expectedRevision obrigatório');
    return this.store.transaction(db=>{const f=this._finding(scope,unitId,findingId);
      assertHospital(f.revision===expectedRevision,'CONFLICT','Versão do achado obsoleta');
      assertHospital((f.status==='IDENTIFIED'&&['FOLLOW_UP','CLOSED'].includes(next))||(f.status==='CONTACTED'&&['FOLLOW_UP','CLOSED'].includes(next))||(f.status==='FOLLOW_UP'&&next==='CLOSED'),'PRECONDITION','Transição de achado não permitida. Contato confirmado usa operação própria');
      const now=db.now(),updated={...f,status:next,revision:f.revision+1,updatedAt:now,closedAt:next==='CLOSED'?now:null};
      db.db.prepare('UPDATE nutrition_findings SET revision=?,body=? WHERE organization_id=? AND unit_id=? AND id=? AND revision=?').run(updated.revision,JSON.stringify(updated),scope.organizationId,unitId,findingId,expectedRevision);
      this._history(scope,unitId,'nutrition_finding',findingId,next==='CLOSED'?'nutritionAudit.closed':'nutritionAudit.updated',{from:f.status,to:next,reason:text(reason,'Motivo',500)});return updated;
    });
  }
  recordMedicalContact(scope,{unitId,findingId,physicianRef,channel,contactedAt,requestNote,contactConfirmed,idempotencyKey}) {
    this._unit(scope,unitId,true);assertIdentifier(idempotencyKey,'idempotencyKey');
    assertHospital(contactConfirmed===true,'PRECONDITION','Registrar somente contato médico efetivamente realizado fora da plataforma');
    assertHospital(channels.includes(channel),'INVALID','Canal externo inválido');const requestedAt=time(contactedAt,'Data do contato');
    const physician=text(physicianRef,'Profissional',160),note=text(requestNote,'Solicitação de revisão',500);
    const input={unitId,findingId,physician,channel,requestedAt,note};
    return this.store.transaction(db=>db.idempotent(scope.organizationId,`nutrition.contact:${scope.uid}`,idempotencyKey,hash(input),()=>{
      const finding=this._finding(scope,unitId,findingId);assertHospital(finding.status!=='CLOSED','PRECONDITION','Achado encerrado');
      const id=`mr_${randomUUID()}`,now=db.now();const record={id,organizationId:scope.organizationId,unitId,findingId,physicianRef:physician,channel,contactedAt:requestedAt,requestNote:note,status:'REQUESTED',responseNote:null,respondedAt:null,createdAt:now,updatedAt:now,revision:1,registeredBy:scope.uid};
      db.db.prepare('INSERT INTO nutrition_contacts(organization_id,unit_id,id,finding_id,revision,body) VALUES(?,?,?,?,?,?)').run(scope.organizationId,unitId,id,findingId,1,JSON.stringify(record));
      this._history(scope,unitId,'nutrition_contact',id,'medicalReview.contacted',{findingId,channel,contactedAt:requestedAt,physicianRef:physician});
      if(finding.status==='IDENTIFIED') {const f={...finding,status:'CONTACTED',revision:finding.revision+1,updatedAt:now};db.db.prepare('UPDATE nutrition_findings SET revision=?,body=? WHERE organization_id=? AND id=? AND revision=?').run(f.revision,JSON.stringify(f),scope.organizationId,findingId,finding.revision);this._history(scope,unitId,'nutrition_finding',findingId,'nutritionAudit.updated',{from:'IDENTIFIED',to:'CONTACTED',contactId:id});}
      return record;
    }));
  }
  recordMedicalResponse(scope,{unitId,contactId,respondedAt,responseNote,responseConfirmed,expectedRevision}) {
    this._unit(scope,unitId,true);assertHospital(responseConfirmed===true,'PRECONDITION','Resposta somente após confirmação de recebimento real');
    const answer=text(responseNote,'Retorno médico',500),at=time(respondedAt,'Data do retorno');assertHospital(Number.isInteger(expectedRevision),'INVALID','expectedRevision obrigatório');
    return this.store.transaction(db=>{const current=this._contact(scope,unitId,contactId);assertHospital(current.revision===expectedRevision,'CONFLICT','Versão do contato obsoleta');assertHospital(current.status==='REQUESTED','PRECONDITION','Contato já respondido/encerrado');assertHospital(Date.parse(at)>=Date.parse(current.contactedAt),'INVALID','Retorno anterior ao contato');
      const updated={...current,status:'ANSWERED',responseNote:answer,respondedAt:at,revision:current.revision+1,updatedAt:db.now()};db.db.prepare('UPDATE nutrition_contacts SET revision=?,body=? WHERE organization_id=? AND unit_id=? AND id=? AND revision=?').run(updated.revision,JSON.stringify(updated),scope.organizationId,unitId,contactId,expectedRevision);
      this._history(scope,unitId,'nutrition_contact',contactId,'medicalReview.answered',{findingId:current.findingId,respondedAt:at});return updated;
    });
  }
  closeMedicalContact(scope,{unitId,contactId,expectedRevision,reason}) {
    this._unit(scope,unitId,true);const why=text(reason,'Motivo de encerramento',500);assertHospital(Number.isInteger(expectedRevision),'INVALID','expectedRevision obrigatório');
    return this.store.transaction(db=>{const c=this._contact(scope,unitId,contactId);assertHospital(c.revision===expectedRevision,'CONFLICT','Versão do contato obsoleta');assertHospital(c.status!=='CLOSED','PRECONDITION','Contato já encerrado');const updated={...c,status:'CLOSED',revision:c.revision+1,updatedAt:db.now()};db.db.prepare('UPDATE nutrition_contacts SET revision=?,body=? WHERE organization_id=? AND id=? AND revision=?').run(updated.revision,JSON.stringify(updated),scope.organizationId,contactId,expectedRevision);this._history(scope,unitId,'nutrition_contact',contactId,'medicalReview.closed',{reason:why,wasAnswered:!!c.respondedAt});return updated;});
  }
  listFindings(scope,{unitId,category,risk,status,from,to,admissionId,limit=30,offset=0}={}) {
    this._unit(scope,unitId);assertHospital(Number.isInteger(Number(offset))&&Number(offset)>=0&&Number(offset)<=100000,'INVALID','Página inválida');
    if(from) assertDate(from);if(to) assertDate(to);if(from&&to) assertHospital(from<=to,'INVALID','Período invertido');
    const rows=this.store.db.prepare('SELECT body FROM nutrition_findings WHERE organization_id=? AND unit_id=? ORDER BY id').all(scope.organizationId,unitId).map(r=>JSON.parse(r.body));
    const filtered=rows.filter(f=>(!category||f.category===category)&&(!risk||f.risk===risk)&&(!status||f.status===status)&&(!admissionId||f.admissionId===admissionId)&&(!from||f.createdAt.slice(0,10)>=from)&&(!to||f.createdAt.slice(0,10)<=to)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    return {total:filtered.length,items:filtered.slice(Number(offset),Number(offset)+safeLimit(limit))};
  }
  listMedicalContacts(scope,{unitId,findingId,status,limit=100}={}) {this._unit(scope,unitId);const rows=this.store.db.prepare('SELECT body FROM nutrition_contacts WHERE organization_id=? AND unit_id=? ORDER BY id').all(scope.organizationId,unitId).map(r=>JSON.parse(r.body));return rows.filter(c=>(!findingId||c.findingId===findingId)&&(!status||c.status===status)).sort((a,b)=>b.contactedAt.localeCompare(a.contactedAt)).slice(0,safeLimit(limit));}
  readHistory(scope,{unitId,kind,id}={}) {this._unit(scope,unitId);assertHospital(['nutrition_finding','nutrition_contact'].includes(kind),'INVALID','Histórico inválido');assertIdentifier(id);if(kind==='nutrition_finding')this._finding(scope,unitId,id);else this._contact(scope,unitId,id);return this.store.db.prepare('SELECT id,event_type,actor_uid,occurred_at,body FROM nutrition_history WHERE organization_id=? AND unit_id=? AND aggregate_kind=? AND aggregate_id=? ORDER BY id').all(scope.organizationId,unitId,kind,id).map(r=>({id:r.id,eventType:r.event_type,actorUid:r.actor_uid,occurredAt:r.occurred_at,details:JSON.parse(r.body)}));}
  readPatientDiet(scope,{unitId,admissionId}={}) {
    this._unit(scope,unitId);const a=this._admission(scope,unitId,admissionId);const p=this.store.get(scope.organizationId,'patient',a.patientId);
    assertHospital(p&&p.unitId===unitId,'NOT_FOUND','Paciente fora do escopo');
    const references=this.store.list(scope.organizationId,'medical_reference',unitId).filter(x=>x.admissionId===a.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    const events=this.store.events(scope.organizationId,'admission',a.id).filter(e=>['dietReference.updated','patient/admission.updated'].includes(e.eventType));
    const versions=references.map((r,index)=>({id:r.id,catalogItemId:r.catalogItemId,sourceRef:r.sourceRef,prescribedAt:r.prescribedAt,enteredByUid:r.enteredByUid,createdAt:r.createdAt,previousCatalogItemId:index?references[index-1].catalogItemId:null}));
    return {admissionId:a.id,unitId,referenceCode:p.referenceCode,fasting:a.fasting,allergyCodes:a.allergyCodes,activeMedicalReferenceId:a.medicalReferenceId,versions,events:events.map(e=>({eventType:e.eventType,actorUid:e.actorUid,occurredAt:e.occurredAt})),metadata:{consistency:'NOT_AVAILABLE_IN_W0',route:'NOT_AVAILABLE_IN_W0'}};
  }
  listPatients(scope,{unitId,limit=50}={}) {this._unit(scope,unitId);return this.store.list(scope.organizationId,'admission',unitId).slice(0,safeLimit(limit)).map(a=>({admissionId:a.id,unitId:a.unitId,fasting:a.fasting,medicalReferenceId:a.medicalReferenceId,status:a.status}));}
  listAlerts(scope,{unitId,limit=60}={}) {
    this._unit(scope,unitId);const admissions=new Set(this.store.list(scope.organizationId,'admission',unitId).map(a=>a.id));const meals=new Set(this.store.list(scope.organizationId,'meal',unitId).map(m=>m.id));const maps=new Set(this.store.list(scope.organizationId,'map',unitId).map(m=>m.id));
    const allowed=new Set(['dietReference.updated','meal.suspended','map.amended','patient/admission.updated']);
    const rows=this.store.db.prepare('SELECT id,kind,aggregate_id,type,occurred_at FROM hospital_events WHERE organization_id=? ORDER BY id DESC LIMIT 500').all(scope.organizationId);
    return rows.filter(e=>allowed.has(e.type)&&((e.kind==='admission'&&admissions.has(e.aggregate_id))||(e.kind==='meal'&&meals.has(e.aggregate_id))||(e.kind==='map'&&maps.has(e.aggregate_id)))).slice(0,safeLimit(limit)).map(e=>({id:e.id,type:e.type,occurredAt:e.occurred_at,unitId}));
  }
  summary(scope,{unitId,from,to}={}) {this._unit(scope,unitId);const rows=this.store.db.prepare('SELECT body FROM nutrition_findings WHERE organization_id=? AND unit_id=?').all(scope.organizationId,unitId).map(r=>JSON.parse(r.body)).filter(f=>(!from||f.createdAt.slice(0,10)>=from)&&(!to||f.createdAt.slice(0,10)<=to));const ids=new Set(rows.map(f=>f.id));const contacts=this.store.db.prepare('SELECT body FROM nutrition_contacts WHERE organization_id=? AND unit_id=?').all(scope.organizationId,unitId).map(r=>JSON.parse(r.body)).filter(c=>ids.has(c.findingId));const hours=contacts.filter(c=>c.respondedAt).map(c=>(Date.parse(c.respondedAt)-Date.parse(c.contactedAt))/3600000);return {total:rows.length,pending:rows.filter(f=>f.status!=='CLOSED').length,critical:rows.filter(f=>f.risk==='CRITICAL'&&f.status!=='CLOSED').length,contactsPending:contacts.filter(c=>c.status==='REQUESTED').length,answered:hours.length,averageResponseHours:hours.length?Math.round(hours.reduce((a,b)=>a+b,0)/hours.length*10)/10:null};}
  reportCsv(scope,{unitId,from,to}={}) {this._unit(scope,unitId);const rows=this.store.db.prepare('SELECT body FROM nutrition_findings WHERE organization_id=? AND unit_id=? ORDER BY id').all(scope.organizationId,unitId).map(r=>JSON.parse(r.body)).filter(f=>(!from||f.createdAt.slice(0,10)>=from)&&(!to||f.createdAt.slice(0,10)<=to));const contacts=this.store.db.prepare('SELECT body FROM nutrition_contacts WHERE organization_id=? AND unit_id=?').all(scope.organizationId,unitId).map(r=>JSON.parse(r.body));const out=rows.map(f=>{const linked=contacts.filter(c=>c.findingId===f.id),first=linked.find(c=>c.respondedAt);return [f.id,f.unitId,f.category,f.risk,f.status,f.createdAt,f.updatedAt,f.closedAt,linked.length,linked.filter(c=>c.respondedAt).length,first?Math.round((Date.parse(first.respondedAt)-Date.parse(first.contactedAt))/3600000*10)/10:''];});return '\ufeff'+[header,...out].map(row=>row.map(csvSafe).join(',')).join('\r\n')+'\r\n';}
}
