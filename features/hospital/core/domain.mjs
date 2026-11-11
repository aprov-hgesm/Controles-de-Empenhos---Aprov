/** Pure, timezone-deterministic hospital R1 domain engine. No patient information is logged. */
export const HOSPITAL_TIMEZONE = 'America/Sao_Paulo';
export const CYCLES = Object.freeze({
  '06': Object.freeze({ id:'06', timezone:HOSPITAL_TIMEZONE, mapDue:'06:00', primaryTolerance:'06:30', primaryName:'Café da manhã', secondaryName:'Lanche da manhã' }),
  '10': Object.freeze({ id:'10', timezone:HOSPITAL_TIMEZONE, mapDue:'10:00', primaryTolerance:'10:30', primaryName:'Almoço', secondaryName:'Lanche da tarde' }),
  '16': Object.freeze({ id:'16', timezone:HOSPITAL_TIMEZONE, mapDue:'16:00', primaryTolerance:'16:30', primaryName:'Jantar', secondaryName:'Ceia' }),
});
export class HospitalError extends Error {
  constructor(code,message) { super(message); this.name='HospitalError'; this.code=code; }
  toJSON() { return { ok:false, error:{code:this.code,message:this.message} }; }
}
export function assertHospital(condition,code,message) { if(!condition) throw new HospitalError(code,message); }
export function assertIdentifier(s,field='id') { assertHospital(typeof s==='string' && /^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$/.test(s),'INVALID',`${field} inválido`); return s; }
export function assertDate(s) { assertHospital(typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s,'INVALID','Data local inválida'); return s; }
const localFormat=new Intl.DateTimeFormat('en-CA',{timeZone:HOSPITAL_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function localClock(at) {
  const instant = at instanceof Date ? at : new Date(at);
  assertHospital(!Number.isNaN(instant.getTime()),'INVALID','Timestamp inválido');
  const parts=Object.fromEntries(localFormat.formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,minuteOfDay:Number(parts.hour)*60+Number(parts.minute)};
}
export function classifyMealTiming({cycleId,localDate,at,mealType='PRIMARY'}) {
  assertDate(localDate); const c=CYCLES[cycleId]; assertHospital(!!c,'INVALID','Ciclo desconhecido');
  assertHospital(mealType==='PRIMARY'||mealType==='SECONDARY','INVALID','Tipo de refeição inválido');
  const clock=localClock(at);
  const due=Number(c.mapDue.slice(0,2))*60;
  const tolerance=due+30;
  const delta=clock.date.localeCompare(localDate);
  const onTime=delta<0||(delta===0&&clock.minuteOfDay<=due);
  const pastTolerance=delta>0||(delta===0&&clock.minuteOfDay>tolerance);
  const stage=onTime?'ON_TIME':pastTolerance?'AFTER_TOLERANCE':'LATE_BEFORE_TOLERANCE';
  return {cycleId,localDate,stage,mapOnTime:onTime,principalDeliveryTolerancePassed:pastTolerance,
    recommendation:onTime?'ROUTINE':pastTolerance?'SECONDARY_OR_CLINICAL_ESCALATION':'KITCHEN_REVIEW',
    requestedMealType:mealType,
    /** Deadline for map submission is never moved by the 30-minute primary delivery tolerance. */
    requiresAmendment:!onTime};
}
export function assertMealReleaseSafe({fasting,allergyCodes=[],dietRestrictionCodes=[]}) {
  assertHospital(fasting!==true,'PRECONDITION','Jejum ativo: bloquear liberação e acionar a assistência');
  const restrictions=new Set(dietRestrictionCodes);
  assertHospital(!allergyCodes.some(code=>restrictions.has(code)),'PRECONDITION','Alergia crítica incompatível: bloquear liberação e acionar a assistência');
}
const mealTransitions={REQUESTED:['PREPARING','SUSPENDED','CANCELLED','SAFETY_BLOCKED'],PREPARING:['READY','SUSPENDED','CANCELLED','SAFETY_BLOCKED'],READY:['DISPATCHED','SUSPENDED','CANCELLED','SAFETY_BLOCKED'],DISPATCHED:['RECEIVED_BY_UNIT','SUSPENDED','SAFETY_BLOCKED'],RECEIVED_BY_UNIT:['DELIVERED','SUSPENDED','SAFETY_BLOCKED'],DELIVERED:[],SUSPENDED:['REQUESTED','CANCELLED','SAFETY_BLOCKED'],CANCELLED:[],SAFETY_BLOCKED:['SUSPENDED']};
export function nextMealStatus(current,next) { assertHospital((mealTransitions[current]||[]).includes(next),'PRECONDITION',`Transição de refeição ${current} → ${next} não permitida`); return next; }
export function nextMapStatus(current,next) { assertHospital((current==='DRAFT'&&next==='SUBMITTED')||(current==='SUBMITTED'&&next==='CLOSED'),'PRECONDITION','Transição de mapa inválida'); return next; }
export function nextLocationStatus(current,next) { assertHospital(current==='PLANNED'&&['CONFIRMED','CANCELLED'].includes(next),'PRECONDITION','Transição de localização inválida'); return next; }
export function nextNutritionAuditStatus(current,next) { const transitions={IDENTIFIED:['CONTACTED','FOLLOW_UP','CLOSED'],CONTACTED:['FOLLOW_UP','CLOSED'],FOLLOW_UP:['CLOSED'],CLOSED:[]};assertHospital((transitions[current]||[]).includes(next),'PRECONDITION','Transição de auditoria inválida');return next; }
