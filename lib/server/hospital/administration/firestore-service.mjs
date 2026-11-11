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

/** Administration: only nonclinical metadata, scoped counts, memberships and policy. */
export class HospitalAdministrationService {
 constructor(store,{userExists}={}){
  assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Firestore hospitalar indisponível');
  this.store=store;this.userExists=userExists;
 }
 async checkMember(scope,db=this.store){
  requireHospitalPermission(scope,'hospital:manage');
  const current=await db.findMembership(scope.organizationId,scope.uid);
  assertHospital(current?.active===true&&current.id===scope.membershipId
    &&current.ug===scope.ug&&current.roles.includes('HOSPITAL_ADMIN'),
    'FORBIDDEN','Vínculo administrativo revogado');
  return current;
 }
 async overview(scope){
  await this.checkMember(scope);
  const counts={unit:0,bed:0,map:0,meal:0,members:0};
  const units=await this.store.listOrgUnits(scope.organizationId);
  counts.unit=units.length;
  for(const unit of units){
    counts.bed+=await this.store.countRecords(scope.organizationId,unit.id,'bed');
    // Aggregation queries return ONLY count; never materialize clinical documents for Admin.
    counts.map+=await this.store.countRecords(scope.organizationId,unit.id,'map');
    counts.meal+=await this.store.countRecords(scope.organizationId,unit.id,'meal');
  }
  counts.members=(await this.store.listMemberships(scope.organizationId)).filter(x=>x.active).length;
  return {organizationId:scope.organizationId,ug:scope.ug,counts,scope:'AGGREGATES_ONLY'};
 }
 async listUnits(scope){
  await this.checkMember(scope);
  const org=scope.organizationId;
  const units=await this.store.listOrgUnits(org);
  return Promise.all(units.map(async u=>({...u,beds:await this.store.list(org,'bed',u.id)})));
 }
 async saveUnit(scope,{id,code,name,type,active=true,expectedRevision=0}){
  await this.checkMember(scope);
  assertHospital(typeof code==='string'&&/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(code),'INVALID','Sigla inválida');
  name=text(name,'Nome da unidade',100);
  assertHospital(validTypes.has(type),'INVALID','Tipo de unidade inválido');
  bool(active,'Status');if(id!==undefined)assertIdentifier(id);
  return this.store.transaction(async db=>{
    await this.checkMember(scope,db);
    const org=scope.organizationId;
    const previous=id?await db.get(org,'unit',id):null;
    if(id)assertHospital(previous,'NOT_FOUND','Unidade não encontrada');
    assertHospital((previous?.revision??0)===expectedRevision,'CONFLICT','Revisão obsoleta');
    const units=await db.listOrgUnits(org);
    assertHospital(!units.some(u=>u.id!==id&&(normalized(u.code)===normalized(code)||normalized(u.name)===normalized(name))),
      'CONFLICT','Sigla/nome já existentes');
    if(previous?.type!==type&&previous){
      assertHospital(!(await db.list(org,'bed',id)).length,'PRECONDITION','Unidade com leitos não pode mudar de tipo');
    }
    if(previous&&!active){
      assertHospital(!(await db.list(org,'admission',id)).some(a=>a.status==='ACTIVE'),
        'PRECONDITION','Unidade tem internações ativas');
      assertHospital(!(await db.listMemberships(org)).some(x=>x.active&&x.unitIds.includes(id)),
        'PRECONDITION','Unidade possui usuários vinculados');
    }
    const unitId=id??generated('unit');
    const next=await db.put(org,'unit',unitId,{id:unitId,organizationId:org,unitId,code,name,type,active},previous?.revision??0);
    await db.saveOrgUnit(org,next);
    await db.appendEvent(org,'hospital_admin',unitId,previous?'hospitalUnit.updated':'hospitalUnit.created',scope.uid,
      {before:previous,after:next});
    return next;
  });
 }
 async saveBed(scope,{id,unitId,label,active=true,expectedRevision=0}){
  await this.checkMember(scope);assertIdentifier(unitId);label=text(label,'Leito',60);bool(active,'Status');
  if(id!==undefined)assertIdentifier(id);
  return this.store.transaction(async db=>{
   await this.checkMember(scope,db);
   const org=scope.organizationId;
   const unit=await db.get(org,'unit',unitId);
   assertHospital(unit?.active&&unit.type==='CARE','INVALID','Leito exige unidade CARE');
   const previous=id?await db.get(org,'bed',id):null;
   if(id)assertHospital(previous?.unitId===unitId,'FORBIDDEN','Leito de outra unidade');
   assertHospital((previous?.revision??0)===expectedRevision,'CONFLICT','Versão obsoleta');
   const beds=await db.list(org,'bed',unitId);
   assertHospital(!beds.some(x=>x.id!==id&&normalized(x.label)===normalized(label)),'CONFLICT','Leito duplicado');
   if(previous&&!active)assertHospital(!await db.isBedOccupied(org,unitId,id),'PRECONDITION','Leito ocupado');
   const bedId=id??generated('bed');
   const next=await db.put(org,'bed',unitId,{id:bedId,organizationId:org,unitId,label,active},previous?.revision??0);
   await db.appendEvent(org,'hospital_admin',bedId,previous?'hospitalBed.updated':'hospitalBed.created',scope.uid,
     {unitId,active,oldRevision:previous?.revision??0});
   return next;
  });
 }
 async listMembers(scope){
  await this.checkMember(scope);
  return (await this.store.listMemberships(scope.organizationId)).sort((a,b)=>a.uid.localeCompare(b.uid));
 }
 async saveMember(scope,{uid,unitIds,roles,active=true,expectedRevision=0}){
  await this.checkMember(scope);assertIdentifier(uid);bool(active,'Status');
  assertHospital(uid!==scope.uid,'FORBIDDEN','Não alterar o próprio administrador');
  assertHospital(Array.isArray(roles)&&roles.length&&roles.length<=4&&new Set(roles).size===roles.length&&roles.every(x=>validRoles.has(x)),
    'INVALID','Papéis inválidos');
  assertHospital(Array.isArray(unitIds)&&unitIds.length<=100&&new Set(unitIds).size===unitIds.length,'INVALID','Unidades inválidas');
  assertHospital(typeof this.userExists==='function','UNAVAILABLE','Verificador de UID não configurado');
  let exists=false;try{exists=await this.userExists(uid)===true}catch{}
  assertHospital(exists,'PRECONDITION','UID não existe no Firebase hospitalar QA');
  return this.store.transaction(async db=>{
   await this.checkMember(scope,db);
   const org=scope.organizationId;
   const units=[];
   for(const unitId of unitIds){
     assertIdentifier(unitId);
     const unit=await db.get(org,'unit',unitId);
     assertHospital(unit?.active,'PRECONDITION','Unidade não habilitada');
     units.push(unit);
   }
   const types=new Set(units.map(u=>u.type));
   if(roles.includes('UNIT'))assertHospital(types.has('CARE'),'INVALID','Perfil assistencial requer CARE');
   if(roles.includes('KITCHEN'))assertHospital(types.has('KITCHEN'),'INVALID','Cozinha requer KITCHEN');
   if(roles.includes('NUTRITION'))assertHospital(types.has('NUTRITION'),'INVALID','Nutrição requer NUTRITION');
   const prev=await db.findMembership(org,uid);
   assertHospital((prev?.revision??0)===expectedRevision,'CONFLICT','Vínculo desatualizado');
   if(prev?.active&&prev.roles.includes('HOSPITAL_ADMIN')&&(!active||!roles.includes('HOSPITAL_ADMIN'))){
     const admins=await db.listMemberships(org);
     assertHospital(admins.some(x=>x.uid!==uid&&x.active&&x.roles.includes('HOSPITAL_ADMIN')),
       'PRECONDITION','Preserve um administrador hospitalar');
   }
   const result=await db.saveMembership(org,{id:prev?.id??generated('member'),uid,ug:scope.ug,
    roles,unitIds,active},expectedRevision);
   await db.appendEvent(org,'hospital_admin',result.id,prev?'hospitalMembership.updated':'hospitalMembership.created',
     scope.uid,{before:prev,after:result});
   return {...result,notification:'NOT_SENT',accountVerified:true};
  });
 }
 async revokeMember(scope,{uid,expectedRevision}){
  await this.checkMember(scope);assertIdentifier(uid);
  assertHospital(uid!==scope.uid,'FORBIDDEN','Não revogar próprio administrador');
  return this.store.transaction(async db=>{
   await this.checkMember(scope,db);
   const org=scope.organizationId,prev=await db.findMembership(org,uid);
   assertHospital(prev,'NOT_FOUND','Vínculo ausente');
   assertHospital(prev.revision===expectedRevision,'CONFLICT','Vínculo desatualizado');
   if(prev.active&&prev.roles.includes('HOSPITAL_ADMIN')){
     const members=await db.listMemberships(org);
     assertHospital(members.some(x=>x.uid!==uid&&x.active&&x.roles.includes('HOSPITAL_ADMIN')),
       'PRECONDITION','Último administrador não pode ser revogado');
   }
   const next=await db.saveMembership(org,{...prev,active:false},expectedRevision);
   await db.appendEvent(org,'hospital_admin',next.id,'hospitalMembership.revoked',scope.uid,
     {before:prev,after:next});
   return next;
  });
 }
 async getPolicy(scope){
  await this.checkMember(scope);
  return await this.store.get(scope.organizationId,'hospital_policy',settingsId)
    ??{...DEFAULT_HOSPITAL_POLICY,revision:0,source:'HGeSM_DEFAULTS_PENDING_INSTITUTIONAL_APPROVAL'};
 }
 async savePolicy(scope,{policy,expectedRevision=0}){
  await this.checkMember(scope);const validated=validatePolicy(policy);
  return this.store.transaction(async db=>{
   await this.checkMember(scope,db);
   const org=scope.organizationId,prev=await db.get(org,'hospital_policy',settingsId);
   assertHospital((prev?.revision??0)===expectedRevision,'CONFLICT','Política desatualizada');
   const next=await db.put(org,'hospital_policy',settingsUnit,{
     ...validated,id:settingsId,organizationId:org,unitId:settingsUnit,
     createdAt:prev?.createdAt??db.now(),updatedAt:db.now(),updatedBy:scope.uid
   },expectedRevision);
   await db.appendEvent(org,'hospital_admin','hospital_policy','hospitalPolicy.changed',scope.uid,
    {before:prev,after:next});
   return {...next,activation:'PENDING_W9_W0_ENGINE_INTEGRATION'};
  });
 }
 async auditList(scope,{limit=50}={}){
  await this.checkMember(scope);
  assertHospital(Number.isInteger(limit)&&limit>=1&&limit<=100,'INVALID','Limite inválido');
  return (await this.store.eventsOfKind(scope.organizationId,'hospital_admin',limit))
    .map(e=>({id:e.id,aggregateId:e.aggregateId,type:e.eventType,actorUid:e.actorUid,
     occurredAt:e.occurredAt,...e.payload}));
 }
}
