import {randomUUID} from 'node:crypto';
import {HospitalError, assertHospital, assertIdentifier, CYCLES} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';

const validRoles = new Set(['UNIT', 'KITCHEN', 'NUTRITION', 'HOSPITAL_ADMIN']);
const validTypes = new Set(['CARE', 'KITCHEN', 'NUTRITION']);
const settingsKind = 'hospital_policy';
const settingsId = 'current';
const settingsUnit = 'hospital_policy';
const json = JSON.stringify;
const decode = JSON.parse;
const fail = (code, message) => {throw new HospitalError(code, message);};
const text = (value, name, max = 120) => {
  assertHospital(typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= max, 'INVALID', `${name} inválido`);
  return value.trim();
};
const optionalText = (value, name, max = 320) => {
  assertHospital(typeof value === 'string' && value.length <= max, 'INVALID', `${name} inválido`);
  return value.trim();
};
const bool = (value, field) => {assertHospital(typeof value === 'boolean', 'INVALID', `${field} inválido`); return value;};
const time = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const mins = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const fromMins = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const normalized = value => value.normalize('NFKC').toLocaleLowerCase('pt-BR');
const generated = prefix => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const defaultCycles = ['06','10','16'].map(id => CYCLES[id]).map(({id,mapDue,primaryName,secondaryName}) => ({id,mapDue,primaryTolerance:fromMins(mins(mapDue)+30),primaryName,secondaryName,notifyAt:fromMins(mins(mapDue)-30)}));
export const DEFAULT_HOSPITAL_POLICY = Object.freeze({
  timezone:'America/Sao_Paulo', cycles:defaultCycles, toleranceMinutes:30,
  extraordinary:'SECONDARY_OR_CLINICAL_ESCALATION', clinicalApprovalRequired:true,
  contingency:'MANUAL_LOG_AND_RECONCILE', labelCopies:1, requireTwoPatientIdentifiers:true,
  alertsEnabled:true, effectiveFrom:'2026-11-11', catalogOwner:'W3', reportingOwner:'W8',
});
function rows(db, org, kind) {
  return db.db.prepare('SELECT body FROM records WHERE organization_id=? AND kind=? ORDER BY id').all(org,kind).map(r=>decode(r.body));
}
function eventVersion(db, org, id) {
  const found = db.db.prepare("SELECT MAX(id) AS id FROM hospital_events WHERE organization_id=? AND kind='hospital_admin' AND aggregate_id=?").get(org,id);
  return Number(found?.id ?? 0);
}
function record(db, org, kind, id) {
  const r=db.db.prepare('SELECT body FROM records WHERE organization_id=? AND kind=? AND id=?').get(org,kind,id);
  return r?decode(r.body):null;
}
function savedPolicy(db, org) {return record(db,org,settingsKind,settingsId);}
function requireRevision(actual,expected) {
  assertHospital(Number.isSafeInteger(expected)&&expected>=0&&expected===actual,'CONFLICT','Versão desatualizada; recarregue antes de salvar');
}
function checkMember(scope, db) {
  requireHospitalPermission(scope,'hospital:manage');
  const current=db.findMembership(scope.organizationId,scope.uid);
  assertHospital(current && current.active && current.id===scope.membershipId && current.ug===scope.ug && current.roles.includes('HOSPITAL_ADMIN'), 'FORBIDDEN','Vínculo administrativo revogado ou alterado');
  return current;
}
function audit(db, scope, id, action, previous, next) {
  return db.appendEvent(scope.organizationId,'hospital_admin',id,action,scope.uid,{before:previous,after:next});
}
function checkOrgUnits(db, org, unitIds, roles) {
  assertHospital(Array.isArray(unitIds)&&unitIds.length<=100 && new Set(unitIds).size===unitIds.length,'INVALID','Unidades duplicadas/inválidas');
  const units = unitIds.map(id=>{
    assertIdentifier(id,'unitId');
    const unit=db.get(org,'unit',id);
    assertHospital(unit && unit.active,'INVALID','Unidade inativa ou de outra OM');
    return unit;
  });
  const types=new Set(units.map(u=>u.type));
  if(roles.includes('UNIT'))assertHospital(types.has('CARE'),'INVALID','Perfil assistencial requer unidade CARE');
  if(roles.includes('KITCHEN'))assertHospital(types.has('KITCHEN'),'INVALID','Perfil Cozinha requer unidade KITCHEN');
  if(roles.includes('NUTRITION'))assertHospital(types.has('NUTRITION'),'INVALID','Perfil Nutrição requer unidade NUTRITION');
  return units;
}
function validatePolicy(input) {
  assertHospital(input && typeof input==='object' && !Array.isArray(input),'INVALID','Política obrigatória');
  assertHospital(typeof input.timezone==='string'&&input.timezone.length<=80,'INVALID','Fuso inválido');
  try{new Intl.DateTimeFormat('en-US',{timeZone:input.timezone});}catch{fail('INVALID','Fuso IANA desconhecido');}
  assertHospital(input.toleranceMinutes===30,'INVALID','Tolerância de 30 minutos é regra vinculante no R1');
  assertHospital(Array.isArray(input.cycles)&&input.cycles.length===3,'INVALID','Exatamente três ciclos obrigatórios');
  const cycles=input.cycles.map((cycle,index)=>{
    const canonical=defaultCycles[index];
    assertHospital(cycle?.id===canonical.id&&time(cycle.mapDue)&&time(cycle.notifyAt),'INVALID','Horário/ciclo inválido');
    assertHospital(mins(cycle.mapDue)+30<1440&&cycle.primaryTolerance===fromMins(mins(cycle.mapDue)+30),'INVALID','Tolerância deve ser 30 minutos após mapa');
    return {id:cycle.id,mapDue:cycle.mapDue,primaryTolerance:cycle.primaryTolerance,notifyAt:cycle.notifyAt,primaryName:text(cycle.primaryName,'Refeição principal',80),secondaryName:text(cycle.secondaryName,'Refeição secundária',80)};
  });
  assertHospital(mins(cycles[0].mapDue)<mins(cycles[1].mapDue)&&mins(cycles[1].mapDue)<mins(cycles[2].mapDue),'INVALID','Ordem dos mapas inválida');
  assertHospital(input.extraordinary==='SECONDARY_OR_CLINICAL_ESCALATION','INVALID','Exceção clínica não pode ser autoaprovada');
  assertHospital(input.clinicalApprovalRequired===true,'INVALID','Exceção clínica exige protocolo');
  assertHospital(input.contingency==='MANUAL_LOG_AND_RECONCILE','INVALID','Contingência exige reconciliação');
  assertHospital(Number.isInteger(input.labelCopies)&&input.labelCopies>=1&&input.labelCopies<=3,'INVALID','Quantidade de etiquetas inválida');
  assertHospital(input.requireTwoPatientIdentifiers===true,'INVALID','Identificação positiva é obrigatória');
  const effectiveFrom=input.effectiveFrom;
  assertHospital(typeof effectiveFrom==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) && !Number.isNaN(Date.parse(`${effectiveFrom}T12:00:00Z`)),'INVALID','Data de vigência inválida');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:input.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  // Future-only policy: past maps and frozen snapshots stay unchanged.
  assertHospital(effectiveFrom>today,'PRECONDITION','Nova política deve entrar em vigor após a data atual');
  return {...DEFAULT_HOSPITAL_POLICY, timezone:input.timezone,cycles,toleranceMinutes:30,extraordinary:input.extraordinary, clinicalApprovalRequired:true, contingency:input.contingency,labelCopies:input.labelCopies,requireTwoPatientIdentifiers:true,alertsEnabled:bool(input.alertsEnabled,'Alertas'),effectiveFrom};
}
/** W7 uses W0's transactional QA SQLite and its immutable journal; no parallel clinical ledger. */
export class HospitalAdministrationService {
  constructor(store,{userExists}={}) {
    assertHospital(store?.db && typeof store.transaction==='function','UNAVAILABLE','Store hospitalar indisponível');
    this.store=store;
    this.userExists=userExists;
  }
  overview(scope) {
    checkMember(scope,this.store);
    const org=scope.organizationId;
    const counts={};
    for(const kind of ['unit','bed','map','meal'])counts[kind]=Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM records WHERE organization_id=? AND kind=?').get(org,kind).n);
    counts.members=Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM memberships WHERE organization_id=? AND active=1').get(org).n);
    return {organizationId:org,ug:scope.ug,counts,scope:'AGGREGATES_ONLY'};
  }
  listUnits(scope) {
    checkMember(scope,this.store);
    const org=scope.organizationId;
    return rows(this.store,org,'unit').map(u=>({...u,beds:rows(this.store,org,'bed').filter(b=>b.unitId===u.id)}));
  }
  saveUnit(scope,{id,code,name,type,active=true,expectedRevision=0}) {
    checkMember(scope,this.store);
    assertHospital(typeof code==='string'&&/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(code),'INVALID','Sigla deve ter 2 a 12 caracteres maiúsculos');
    name=text(name,'Nome da unidade',100);
    assertHospital(validTypes.has(type),'INVALID','Tipo de unidade inválido');bool(active,'Status');
    if(id!==undefined)assertIdentifier(id);
    return this.store.transaction(db=>{
      checkMember(scope,db);
      const org=scope.organizationId;
      const previous=id?db.get(org,'unit',id):null;
      if(id)assertHospital(previous,'NOT_FOUND','Unidade não encontrada');
      requireRevision(previous?.revision??0,expectedRevision);
      assertHospital(!rows(db,org,'unit').some(u=>u.id!==id&&(normalized(u.code)===normalized(code)||normalized(u.name)===normalized(name))), 'CONFLICT','Sigla/nome já utilizados na OM');
      if(previous && previous.type!==type)assertHospital(!rows(db,org,'bed').some(b=>b.unitId===id),'PRECONDITION','Unidade com leitos não pode mudar de tipo');
      if(previous && !active) {
        const currentAdmissions=rows(db,org,'admission').filter(a=>a.unitId===id && a.status==='ACTIVE');
        assertHospital(currentAdmissions.length===0,'PRECONDITION','Unidade tem internações ativas');
        const activeMembers=db.db.prepare('SELECT unit_ids_json FROM memberships WHERE organization_id=? AND active=1').all(org);
        assertHospital(!activeMembers.some(m=>decode(m.unit_ids_json).includes(id)),'PRECONDITION','Unidade possui usuários habilitados');
      }
      const unitId=id??generated('unit');
      const next=db.put(org,'unit',unitId,{id:unitId,organizationId:org,unitId,code,name,type,active},previous?.revision??0);
      audit(db,scope,unitId,previous?'hospitalUnit.updated':'hospitalUnit.created',previous,next);
      return next;
    });
  }
  saveBed(scope,{id,unitId,label,active=true,expectedRevision=0}) {
    checkMember(scope,this.store);assertIdentifier(unitId,'unitId');label=text(label,'Leito',60);bool(active,'Status');if(id!==undefined)assertIdentifier(id);
    return this.store.transaction(db=>{
      checkMember(scope,db);const org=scope.organizationId;
      const unit=db.get(org,'unit',unitId);
      assertHospital(unit?.active && unit.type==='CARE','INVALID','Leitos somente em unidade assistencial ativa');
      const previous=id?db.get(org,'bed',id):null;
      if(id)assertHospital(previous&&previous.unitId===unitId,'FORBIDDEN','Leito fora da unidade');
      requireRevision(previous?.revision??0,expectedRevision);
      assertHospital(!rows(db,org,'bed').some(b=>b.id!==id&&b.unitId===unitId&&normalized(b.label)===normalized(label)),'CONFLICT','Leito duplicado');
      if(previous && !active)assertHospital(!rows(db,org,'admission').some(a=>a.status==='ACTIVE'&&a.bedId===id),'PRECONDITION','Leito ocupado por internação ativa');
      const bedId=id??generated('bed');
      const next=db.put(org,'bed',unitId,{id:bedId,organizationId:org,unitId,label,active},previous?.revision??0);
      audit(db,scope,bedId,previous?'hospitalBed.updated':'hospitalBed.created',previous,next);
      return next;
    });
  }
  listMembers(scope) {
    checkMember(scope,this.store);const org=scope.organizationId;
    return this.store.db.prepare('SELECT * FROM memberships WHERE organization_id=? ORDER BY uid').all(org).map(row=>({id:row.id,uid:row.uid,organizationId:org,ug:row.ug,active:!!row.active,unitIds:decode(row.unit_ids_json),roles:decode(row.roles_json),revision:eventVersion(this.store,org,row.id)}));
  }
  async saveMember(scope,{uid,unitIds,roles,active=true,expectedRevision=0}) {
    checkMember(scope,this.store);assertIdentifier(uid,'uid');bool(active,'Status');
    assertHospital(Array.isArray(roles)&&roles.length>0&&roles.length<=4&&new Set(roles).size===roles.length&&roles.every(r=>validRoles.has(r)),'INVALID','Papéis inválidos');
    assertHospital(uid!==scope.uid,'FORBIDDEN','Não é permitido alterar o próprio vínculo administrativo');
    assertHospital(typeof this.userExists==='function','UNAVAILABLE','Provedor Firebase não configurado para comprovar UID');
    // Firebase account check, never send or claim an e-mail invitation.
    let exists=false;
    try{exists=await this.userExists(uid)===true;}catch{exists=false;}
    assertHospital(exists,'PRECONDITION','UID não corresponde a conta Firebase existente');
    return this.store.transaction(db=>{
      checkMember(scope,db);const org=scope.organizationId;
      checkOrgUnits(db,org,unitIds,roles);
      const previous=db.findMembership(org,uid);
      const id=previous?.id??generated('member');
      requireRevision(eventVersion(db,org,id),expectedRevision);
      const next={id,uid,organizationId:org,ug:scope.ug,unitIds,roles,active};
      if(previous?.active && previous.roles.includes('HOSPITAL_ADMIN') && (!active || !roles.includes('HOSPITAL_ADMIN'))) {
        const otherAdmins=db.db.prepare('SELECT roles_json FROM memberships WHERE organization_id=? AND active=1 AND uid<>?').all(org,uid);
        assertHospital(otherAdmins.some(m=>decode(m.roles_json).includes('HOSPITAL_ADMIN')),'PRECONDITION','Preserve ao menos um administrador hospitalar ativo');
      }
      if(previous) {
        const update=db.db.prepare('UPDATE memberships SET active=?,roles_json=?,unit_ids_json=? WHERE organization_id=? AND id=? AND uid=? AND ug=?').run(active?1:0,json(roles),json(unitIds),org,id,uid,scope.ug);
        assertHospital(update.changes===1,'CONFLICT','Vínculo alterado por outra operação');
      } else db.db.prepare('INSERT INTO memberships(organization_id,id,uid,ug,active,roles_json,unit_ids_json) VALUES(?,?,?,?,?,?,?)').run(org,id,uid,scope.ug,active?1:0,json(roles),json(unitIds));
      const event=audit(db,scope,id,previous?'hospitalMembership.updated':'hospitalMembership.created',previous,next);
      return {...next,revision:event.id,notification:'NOT_SENT',accountVerified:true};
    });
  }
  revokeMember(scope,{uid,expectedRevision}) {
    checkMember(scope,this.store);assertIdentifier(uid,'uid');
    assertHospital(uid!==scope.uid,'FORBIDDEN','Não é permitido revogar o próprio vínculo');
    return this.store.transaction(db=>{
      checkMember(scope,db);const org=scope.organizationId;
      const previous=db.findMembership(org,uid);
      assertHospital(previous,'NOT_FOUND','Vínculo não encontrado');
      requireRevision(eventVersion(db,org,previous.id),expectedRevision);
      if(previous.roles.includes('HOSPITAL_ADMIN')&&previous.active) {
        const admins=db.db.prepare('SELECT roles_json FROM memberships WHERE organization_id=? AND active=1 AND uid<>?').all(org,uid);
        assertHospital(admins.some(r=>decode(r.roles_json).includes('HOSPITAL_ADMIN')),'PRECONDITION','Não é possível revogar o último administrador hospitalar');
      }
      db.db.prepare('UPDATE memberships SET active=0 WHERE organization_id=? AND uid=?').run(org,uid);
      const next={...previous,active:false};
      const event=audit(db,scope,previous.id,'hospitalMembership.revoked',previous,next);
      return {...next,revision:event.id};
    });
  }
  getPolicy(scope) {
    checkMember(scope,this.store);
    const row=savedPolicy(this.store,scope.organizationId);
    return row??{...DEFAULT_HOSPITAL_POLICY,revision:0,source:'HGeSM_DEFAULTS_PENDING_INSTITUTIONAL_APPROVAL'};
  }
  savePolicy(scope,{policy,expectedRevision=0}) {
    checkMember(scope,this.store);const validated=validatePolicy(policy);
    return this.store.transaction(db=>{
      checkMember(scope,db);const org=scope.organizationId;
      const previous=savedPolicy(db,org);
      requireRevision(previous?.revision??0,expectedRevision);
      const next={...validated,organizationId:org,id:settingsId,unitId:settingsUnit,revision:(previous?.revision??0)+1,createdAt:previous?.createdAt??db.now(),updatedAt:db.now(),updatedBy:scope.uid};
      if(previous) {
        const written=db.db.prepare('UPDATE records SET revision=?,body=? WHERE organization_id=? AND kind=? AND id=? AND revision=?').run(next.revision,json(next),org,settingsKind,settingsId,expectedRevision);
        assertHospital(written.changes===1,'CONFLICT','Política foi alterada em paralelo');
      } else db.db.prepare('INSERT INTO records(organization_id,kind,id,unit_id,revision,body) VALUES(?,?,?,?,?,?)').run(org,settingsKind,settingsId,settingsUnit,1,json(next));
      audit(db,scope,'hospital_policy','hospitalPolicy.changed',previous,next);
      return {...next,activation:'PENDING_W9_W0_ENGINE_INTEGRATION'};
    });
  }
  auditList(scope,{limit=50}={}) {
    checkMember(scope,this.store);
    assertHospital(Number.isInteger(limit)&&limit>=1&&limit<=100,'INVALID','Limite inválido');
    return this.store.db.prepare("SELECT id,aggregate_id,type,actor_uid,occurred_at,payload FROM hospital_events WHERE organization_id=? AND kind='hospital_admin' ORDER BY id DESC LIMIT ?").all(scope.organizationId,limit).map(r=>({id:r.id,aggregateId:r.aggregate_id,type:r.type,actorUid:r.actor_uid,occurredAt:r.occurred_at,...decode(r.payload)}));
  }
}
