/** Periodos determinísticos ancorados no relógio do servidor e no fuso São Paulo. */
import { AiInputError, type AiPeriod } from './contracts';
const ZONE='America/Sao_Paulo';
const DAY=86400000;
function dateInZone(now:Date):string {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return part('year')+'-'+part('month')+'-'+part('day');
}
function shift(date:string,n:number):string{
  return new Date(Date.parse(date+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
}
function monday(date:string):string {
  const weekday=new Date(date+'T00:00:00Z').getUTCDay();
  return shift(date,-((weekday+6)%7));
}
function monthStart(date:string):string{return date.slice(0,7)+'-01';}
function nextMonth(date:string):string {
  const start=monthStart(date);
  const d=new Date(start+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);
  return d.toISOString().slice(0,10);
}
export function resolveRelativeAiPeriod(value:string,now:Date=new Date()):AiPeriod {
  const today=dateInZone(now),week=monday(today),month=monthStart(today);
  switch(value){
    case 'today':return {start:today,endExclusive:shift(today,1)};
    case 'yesterday':return {start:shift(today,-1),endExclusive:today};
    case 'day_before_yesterday':return {start:shift(today,-2),endExclusive:shift(today,-1)};
    case 'tomorrow':return {start:shift(today,1),endExclusive:shift(today,2)};
    case 'this_week':return {start:week,endExclusive:shift(week,7)};
    case 'last_week':return {start:shift(week,-7),endExclusive:week};
    case 'two_weeks_ago':return {start:shift(week,-14),endExclusive:shift(week,-7)};
    case 'this_month':return {start:month,endExclusive:nextMonth(month)};
    case 'last_month':return {start:monthStart(shift(month,-1)),endExclusive:month};
    case 'last_7_days':return {start:shift(today,-6),endExclusive:shift(today,1)};
    case 'last_30_days':return {start:shift(today,-29),endExclusive:shift(today,1)};
    case 'this_exercise':return {start:today.slice(0,4)+'-01-01',endExclusive:(Number(today.slice(0,4))+1)+'-01-01'};
    case 'previous_exercise':return {start:(Number(today.slice(0,4))-1)+'-01-01',endExclusive:today.slice(0,4)+'-01-01'};
    default:throw new AiInputError('AI_RELATIVE_PERIOD_UNSUPPORTED');
  }
}
function validDate(s:string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
    && !Number.isNaN(Date.parse(s+'T00:00:00Z'))
    && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
}
export function resolveAiPeriod(input:unknown,now:Date=new Date()):AiPeriod{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new AiInputError('AI_INVALID_PERIOD');
  const p=input as Record<string,unknown>,keys=Object.keys(p);
  if('kind' in p){
    if(keys.some(k=>!['kind','value'].includes(k))||p.kind!=='relative'||typeof p.value!=='string')
      throw new AiInputError('AI_INVALID_RELATIVE_PERIOD');
    return resolveRelativeAiPeriod(p.value,now);
  }
  if(keys.some(k=>!['start','endExclusive'].includes(k))
    ||typeof p.start!=='string'||typeof p.endExclusive!=='string'
    ||!validDate(p.start)||!validDate(p.endExclusive)||p.start>=p.endExclusive
    ||Date.parse(p.endExclusive)-Date.parse(p.start)>366*DAY)
    throw new AiInputError('AI_INVALID_PERIOD');
  return {start:p.start,endExclusive:p.endExclusive};
}
/** Inicio do dia operacional em UTC; não depende do timezone da Vercel. */
export function operationalMidnightUtc(date:string):string{
  let candidate=Date.parse(date+'T00:00:00Z');
  for(let i=0;i<3;i++){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(candidate));
    const val=(kind:string)=>Number(parts.find(x=>x.type===kind)?.value||0);
    const observed=Date.UTC(val('year'),val('month')-1,val('day'),val('hour'),val('minute'),val('second'));
    const wanted=Date.parse(date+'T00:00:00Z');
    const next=candidate+(wanted-observed);
    if(next===candidate)break;
    candidate=next;
  }
  return new Date(candidate).toISOString();
}
