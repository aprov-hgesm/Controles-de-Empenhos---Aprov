import {createHash} from 'node:crypto';
import {assertDate,assertHospital,assertIdentifier,classifyMealTiming,localClock,CYCLES,HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission,requireHospitalOrganization} from '../core/auth.mjs';

const VIEWS=new Set(['maps','production','timeliness','occurrences','nutrition','waste']);
const MAX_ROWS=5000, MAX_UNITS=20, MAX_DAYS=31;
const ISO=/^\d{4}-\d{2}-\d{2}$/;
const NUM_FIELDS=['planned','sent','preparing','ready','dispatched','received','delivered','cancelled','suspended'];
const toDate=(v)=>typeof v==='string'&&ISO.test(v)?assertDate(v):null;
const dateOf=(v)=>{try{return localClock(v).date}catch{return null}};
const stamp=(v)=>{const t=Date.parse(v);return Number.isFinite(t)?t:null};
const safeText=(s)=>typeof s==='string'?s.slice(0,150):'';
const author=(scope,uid)=>uid?createHash('sha256').update(scope.organizationId+':'+uid).digest('hex').slice(0,12):null;
const isValidDate=(date)=>!!toDate(date);
const parse=(s)=>JSON.parse(s);

function validateFilters(scope,filters,view){
  assertHospital(filters&&typeof filters==='object'&&!Array.isArray(filters),'INVALID','Filtros inválidos');
  if(filters.organizationId!==undefined)assertHospital(filters.organizationId===scope.organizationId,'FORBIDDEN','OM fora do escopo');
  if(filters.ug!==undefined)assertHospital(filters.ug===scope.ug,'FORBIDDEN','UG fora do escopo');
  const today=dateOf(new Date());
  const from=toDate(filters.from||filters.localDate||today);
  const to=toDate(filters.to||filters.localDate||from);
  assertHospital(from&&to&&from<=to,'INVALID','Período inválido');
  assertHospital((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000<MAX_DAYS,'INVALID','Máximo de 31 dias por consulta');
  const units=filters.unitId?[filters.unitId]:[...scope.unitIds];
  assertHospital(units.length>0&&units.length<=MAX_UNITS,'INVALID','Selecione até 20 unidades autorizadas');
  for(const u of units){
    assertIdentifier(u,'unitId');
    requireHospitalPermission(scope,view==='nutrition'?'nutrition:read':'map:read',u);
  }
  if(filters.cycleId!==undefined)assertHospital(Object.hasOwn(CYCLES,filters.cycleId),'INVALID','Ciclo inválido');
  if(filters.mealType!==undefined)assertHospital(['PRIMARY','SECONDARY'].includes(filters.mealType),'INVALID','Refeição inválida');
  if(filters.late!==undefined)assertHospital(typeof filters.late==='boolean','INVALID','Filtro de atraso inválido');
  for(const f of ['dietCode','status','bedId','consistency','route','restriction','eventType','incidentType']){
    if(filters[f]!==undefined)assertHospital(typeof filters[f]==='string'&&filters[f].length<=128,'INVALID','Filtro '+f+' inválido');
  }
  return {organizationId:scope.organizationId,from,to,units,cycleId:filters.cycleId||null,mealType:filters.mealType||null,dietCode:filters.dietCode||null,status:filters.status||null,
    bedId:filters.bedId||null,consistency:filters.consistency||null,route:filters.route||null,restriction:filters.restriction||null,
    late:filters.late,eventType:filters.eventType||null,incidentType:filters.incidentType||null};
}
function batch(ids,size=100){const out=[];for(let i=0;i<ids.length;i+=size)out.push(ids.slice(i,i+size));return out}
function placeholders(count){return Array(count).fill('?').join(',')}
function countArray(rows,field){return rows.reduce((n,r)=>n+(Number(r[field])||0),0)}
function summarize(rows){const obj={};for(const key of NUM_FIELDS)obj[key]=countArray(rows,key);return obj}
function newCounters(key){return {...key,planned:0,sent:0,preparing:0,ready:0,dispatched:0,received:0,delivered:0,cancelled:0,suspended:0}}
function formatDur(from,to){const x=stamp(from),y=stamp(to);return x!==null&&y!==null&&y>=x?Math.round((y-x)/60000*100)/100:null}
function finiteAverage(values){const n=values.filter(x=>typeof x==='number'&&Number.isFinite(x));return n.length?Math.round(n.reduce((a,b)=>a+b,0)/n.length*100)/100:null}

export class HospitalReportingService {
  constructor(store){
    assertHospital(store&&typeof store.list==='function'&&typeof store.listMapVersions==='function',
      'UNAVAILABLE','Relatórios requerem Firestore hospitalar');
    this.store=store;
  }
  async _records(kind,f,dated=true){
    let rows=[];
    for(const unit of f.units){
      const docs=await this.store.list(f.organizationId,kind,unit);
      rows.push(...docs.filter(x=>!dated||x.localDate>=f.from&&x.localDate<=f.to));
      if(rows.length>MAX_ROWS)return {items:rows.slice(0,MAX_ROWS),partial:true};
    }
    rows.sort((a,b)=>a.id.localeCompare(b.id));
    return {items:rows,partial:false};
  }
  async _events(scope,kind,records){
    const result=new Map();
    for(const record of records){
      const all=await this.store.events(scope.organizationId,kind,record.id);
      result.set(record.id,all.map(e=>({
        id:e.id,type:e.eventType,actorRef:author(scope,e.actorUid),
        occurredAt:e.occurredAt,effectiveAt:e.effectiveAt,payload:e.payload
      })));
    }
    return result;
  }
  async _versions(scope,maps){
    const out=new Map();
    for(const map of maps)out.set(map.id,await this.store.listMapVersions(scope.organizationId,map.id));
    return out;
  }
    async _filterMeals(meals,filters,scope){
    const result=[];
    for(const m of meals){
      if(filters.cycleId&&m.cycleId!==filters.cycleId)continue;
      if(filters.mealType&&m.mealType!==filters.mealType)continue;
      if(filters.dietCode&&m.dietCode!==filters.dietCode)continue;
      if(filters.status&&m.status!==filters.status)continue;
      if(filters.consistency&&m.consistency!==filters.consistency)continue;
      if(filters.route&&m.route!==filters.route)continue;
      if(filters.restriction&&!(m.dietRestrictionCodes||[]).includes(filters.restriction))continue;
      if(filters.bedId){
        const adm=await this.store.get(scope.organizationId,'admission',m.admissionId);
        // Only current bed can be reported. No fabricated historical location.
        if(!adm||adm.unitId!==m.unitId||adm.bedId!==filters.bedId)continue;
      }
      if(filters.late!==undefined){
        const late=!classifyMealTiming({cycleId:m.cycleId,localDate:m.localDate,
          at:m.requestedAt,mealType:m.mealType}).mapOnTime;
        if(late!==filters.late)continue;
      }
      result.push(m);
    }
    return result;
  }
    async query(scope,{view='maps',filters={},page=1,pageSize=50,exportAll=false}={}){
    assertHospital(VIEWS.has(view),'INVALID','Relatório desconhecido');
    assertHospital(Number.isInteger(page)&&page>=1&&page<=10000,'INVALID','Página inválida');
    assertHospital(Number.isInteger(pageSize)&&pageSize>=1&&pageSize<=(exportAll?MAX_ROWS:100),'INVALID','Limite de página inválido');
    requireHospitalOrganization(scope,scope.organizationId);
    const f=validateFilters(scope,filters,view);
    const maps=await this._records('map',f);
    const meals=await this._records('meal',f);
    const selected=await this._filterMeals(meals.items,f,scope);
    const v=await this._versions(scope,maps.items);
    const e=await this._events(scope,'meal',selected);
    let rows=[],extra={};
    if(view==='maps'){
      rows=maps.items.filter(m=>!f.cycleId||m.cycleId===f.cycleId).flatMap(m=>{
        const versions=v.get(m.id)||[];
        if(!versions.length)return [{unitId:m.unitId,localDate:m.localDate,cycleId:m.cycleId,mapStatus:m.status,version:null,versionKind:'DRAFT',items:0,addedItems:0,recordedAt:null,submittedAt:m.submittedAt,submittedWithinDeadline:null,actorRef:null}];
        let previous=new Set();
        return versions.map(one=>{
          const current=new Set((one.snapshot?.meals||[]).map(x=>x.id));
          const added=[...current].filter(id=>!previous.has(id)).length;
          previous=current;
          const sent=classifyMealTiming({cycleId:m.cycleId,localDate:m.localDate,at:one.recordedAt});
          return {unitId:m.unitId,localDate:m.localDate,cycleId:m.cycleId,mapStatus:one.snapshot?.map?.status||m.status,version:one.version,versionKind:one.kind,items:current.size,addedItems:added,recordedAt:one.recordedAt,submittedAt:one.snapshot?.map?.submittedAt||null,submittedWithinDeadline:one.kind==='SUBMISSION'?sent.mapOnTime:null,actorRef:author(scope,one.actorUid)};
        });
      });
      // Consolidation uses ORIGINAL submission snapshots separately from later amendments.
      // Each meal identity is counted once in its own map, never once per version.
      const consolidated=new Map();
      for(const m of maps.items.filter(m=>!f.cycleId||m.cycleId===f.cycleId)){
        const key=m.localDate+'|'+m.cycleId;
        if(!consolidated.has(key))consolidated.set(key,{localDate:m.localDate,cycleId:m.cycleId,unitsWithMap:0,originalSubmittedItems:0,latestRegisteredItems:0,amendments:0});
        const total=consolidated.get(key),all=v.get(m.id)||[];
        const submitted=all.find(one=>one.kind==='SUBMISSION');
        const newest=all.at(-1);
        total.unitsWithMap++;
        total.originalSubmittedItems+=new Set((submitted?.snapshot?.meals||[]).map(x=>x.id)).size;
        total.latestRegisteredItems+=new Set((newest?.snapshot?.meals||[]).map(x=>x.id)).size;
        total.amendments+=all.filter(x=>x.kind==='AMENDMENT').length;
      }
      extra={maps:maps.items.filter(m=>!f.cycleId||m.cycleId===f.cycleId).length,
        versions:rows.filter(x=>x.version!==null).length,adendos:rows.filter(x=>x.versionKind==='AMENDMENT').length,
        consolidated:[...consolidated.values()]};
    }
    else if(view==='production'||view==='waste'){
      const groups=new Map();
      const mapSent=new Map();
      for(const [id,arr] of v)mapSent.set(id,new Set(arr.flatMap(x=>(x.snapshot?.meals||[]).map(m=>m.id))));
      for(const m of selected){
        const key=[m.localDate,m.cycleId,m.unitId,m.dietCode,m.mealType].join('|');
        if(!groups.has(key))groups.set(key,newCounters({localDate:m.localDate,cycleId:m.cycleId,unitId:m.unitId,dietCode:m.dietCode,mealType:m.mealType}));
        const g=groups.get(key),events=e.get(m.id)||[],types=new Set(events.map(x=>x.type));
        g.planned++;
        if(mapSent.get(m.mapId)?.has(m.id))g.sent++;
        if(types.has('meal.production.started'))g.preparing++;
        if(types.has('meal.production.completed'))g.ready++;
        if(types.has('meal.dispatched'))g.dispatched++;
        if(types.has('meal.received'))g.received++;
        if(types.has('meal.delivered'))g.delivered++;
        if(m.status==='CANCELLED')g.cancelled++;
        if(m.status==='SUSPENDED'||m.status==='SAFETY_BLOCKED')g.suspended++;
        if(view==='waste'){
          const ready=types.has('meal.production.completed'),delivered=types.has('meal.delivered');
          g.cancelledBeforePreparation=(g.cancelledBeforePreparation||0)+(m.status==='CANCELLED'&&!ready?1:0);
          g.cancelledAfterPreparation=(g.cancelledAfterPreparation||0)+(m.status==='CANCELLED'&&ready?1:0);
          g.readyNotDelivered=(g.readyNotDelivered||0)+(ready&&!delivered?1:0);
          g.measuredQuantity=null;
          g.measurementStatus='NOT_RECORDED';
        }
      }
      rows=[...groups.values()].sort((a,b)=>[a.localDate,a.cycleId,a.unitId,a.dietCode,a.mealType].join('|').localeCompare([b.localDate,b.cycleId,b.unitId,b.dietCode,b.mealType].join('|')));
      extra=summarize(rows);
      if(view==='waste')extra={...extra,cancelledBeforePreparation:countArray(rows,'cancelledBeforePreparation'),cancelledAfterPreparation:countArray(rows,'cancelledAfterPreparation'),readyNotDeliveredPotential:countArray(rows,'readyNotDelivered'),measuredQuantity:null,measurementStatus:'NOT_RECORDED'};
    }
    else if(view==='timeliness'){
      const groups=new Map();
      for(const m of maps.items.filter(m=>!f.cycleId||m.cycleId===f.cycleId)){
        const key=[m.localDate,m.cycleId,m.unitId].join('|');
        groups.set(key,{unitId:m.unitId,localDate:m.localDate,cycleId:m.cycleId,mapDue:CYCLES[m.cycleId].mapDue,principalTolerance:CYCLES[m.cycleId].primaryTolerance,submittedOnTime:0,submittedLate:0,notSubmitted:0,extraordinary:0,primaryDeliveredWithinTolerance:0,primaryDeliveredAfterTolerance:0,primaryNotDelivered:0,secondaryDelivered:0,prepMinutes:[],dispatchToDeliveryMinutes:[]});
        const g=groups.get(key),submission=(v.get(m.id)||[]).find(x=>x.kind==='SUBMISSION');
        if(!submission)g.notSubmitted++;
        else if(classifyMealTiming({cycleId:m.cycleId,localDate:m.localDate,at:submission.recordedAt}).mapOnTime)g.submittedOnTime++;
        else g.submittedLate++;
      }
      for(const m of selected){
        const g=groups.get([m.localDate,m.cycleId,m.unitId].join('|'));if(!g)continue;
        const events=e.get(m.id)||[];
        if(!classifyMealTiming({cycleId:m.cycleId,localDate:m.localDate,at:m.requestedAt}).mapOnTime)g.extraordinary++;
        const delivered=events.find(x=>x.type==='meal.delivered');
        const started=events.find(x=>x.type==='meal.production.started');
        const ready=events.find(x=>x.type==='meal.production.completed');
        const dispatched=events.find(x=>x.type==='meal.dispatched');
        const prep=formatDur(started?.occurredAt,ready?.occurredAt);
        const delivery=formatDur(dispatched?.occurredAt,delivered?.occurredAt);
        if(prep!==null)g.prepMinutes.push(prep);
        if(delivery!==null)g.dispatchToDeliveryMinutes.push(delivery);
        if(m.mealType==='SECONDARY'){if(delivered)g.secondaryDelivered++;continue}
        if(!delivered){g.primaryNotDelivered++;continue}
        const stage=classifyMealTiming({cycleId:m.cycleId,localDate:m.localDate,at:delivered.occurredAt});
        if(stage.principalDeliveryTolerancePassed)g.primaryDeliveredAfterTolerance++;
        else g.primaryDeliveredWithinTolerance++;
      }
      rows=[...groups.values()].map(x=>{const {prepMinutes,dispatchToDeliveryMinutes,...rest}=x;return {...rest,averagePrepMinutes:finiteAverage(prepMinutes),averageDispatchToDeliveryMinutes:finiteAverage(dispatchToDeliveryMinutes)}});
      extra={mapsReported:rows.length,lateSubmissions:countArray(rows,'submittedLate'),extraordinaryRequests:countArray(rows,'extraordinary'),primaryDeliveredAfterTolerance:countArray(rows,'primaryDeliveredAfterTolerance')};
    }
    else if(view==='nutrition'){
      const audits=await this._records('nutrition_finding',f,false);
      const ev=await this._events(scope,'nutrition_finding',audits.items);
      rows=audits.items.filter(a=>dateOf(a.createdAt)>=f.from&&dateOf(a.createdAt)<=f.to).map(a=>{
        const updates=ev.get(a.id)||[];
        const contact=updates.find(x=>x.type==='nutritionAudit.updated'&&x.payload?.next==='CONTACTED');
        const closure=updates.find(x=>x.type==='nutritionAudit.closed');
        return {unitId:a.unitId,status:a.status,createdAt:a.createdAt,contactedAt:contact?.occurredAt||null,closedAt:closure?.occurredAt||null,responseMinutes:null,medicalResponseRecorded:false,actorRef:author(scope,a.createdBy),inconformityRecorded:true};
      });
      extra={audits:rows.length,inconformities:rows.length,contacts:rows.filter(x=>x.contactedAt).length,closed:rows.filter(x=>x.closedAt).length,medicalResponsesRecorded:0,averageMedicalResponseMinutes:null};
      extra.partial=audits.partial;
    }
    else if(view==='occurrences'){
      const mapEvents=await this._events(scope,'map',maps.items);
      const admissionIds=new Set(selected.map(m=>m.admissionId));
      const admissions=await this._records('admission',f,false);
      const related=admissions.items.filter(a=>admissionIds.has(a.id));
      const admissionEvents=await this._events(scope,'admission',related);
      const occurrences=[];
      const push=(unitId,category,ev,detail)=>{
        if(dateOf(ev.occurredAt)<f.from||dateOf(ev.occurredAt)>f.to)return;
        if(f.eventType&&ev.type!==f.eventType)return;
        occurrences.push({unitId,category,eventType:ev.type,occurredAt:ev.occurredAt,actorRef:ev.actorRef,detail:safeText(detail),evidenceEventId:ev.id,administrativeAttribution:null});
      };
      for(const m of maps.items)for(const event of mapEvents.get(m.id)||[])if(event.type==='map.amended')push(m.unitId,'MAP_AMENDMENT',event,'Adendo com versão preservada');
      for(const m of selected)for(const event of e.get(m.id)||[]){
        if(event.type==='meal.suspended')push(m.unitId,'SUSPENSION',event,safeText(event.payload?.reason||event.payload?.to));
        if(event.type==='meal.requested'&&event.payload?.timing?.mapOnTime===false)push(m.unitId,'LATE_REQUEST',event,'Solicitação posterior ao prazo do mapa');
      }
      for(const a of related)for(const event of admissionEvents.get(a.id)||[])if(event.type==='patient/admission.updated'&&event.payload?.confirmed)push(a.unitId,'CONFIRMED_TRANSFER',event,'Transferência registrada');
      const incidents=await this._records('incident',f,false);
      for(const inc of incidents.items)if(dateOf(inc.createdAt)>=f.from&&dateOf(inc.createdAt)<=f.to&&(!f.incidentType||inc.type===f.incidentType)){
        occurrences.push({unitId:inc.unitId,category:'INCIDENT',eventType:inc.type,occurredAt:inc.createdAt,actorRef:null,detail:'Ocorrência registrada',evidenceEventId:null,administrativeAttribution:null});
      }
      rows=occurrences.sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||String(a.evidenceEventId).localeCompare(String(b.evidenceEventId)));
      extra={occurrences:rows.length,lateRequests:rows.filter(x=>x.category==='LATE_REQUEST').length,amendments:rows.filter(x=>x.category==='MAP_AMENDMENT').length,incidents:rows.filter(x=>x.category==='INCIDENT').length,automaticBlame:false};
      extra.partial=incidents.partial||admissions.partial;
    }
    const partial=maps.partial||meals.partial||!!extra.partial;
    const total=rows.length,start=(page-1)*pageSize;
    return {view,filters:{...f,organizationId:scope.organizationId,ug:scope.ug,timezone:'America/Sao_Paulo'},rows:rows.slice(start,start+pageSize),summary:extra,page,pageSize,total,totalPages:Math.ceil(total/pageSize),partial,generatedAt:new Date().toISOString(),source:'W10_FIRESTORE_QA_EMULATOR',auditTimezone:'UTC',estimatedReadRows:maps.items.length+meals.items.length+rows.length,notice:partial?'Limite de leitura atingido: totais parciais, reduza o período':'Totais baseados exclusivamente em eventos e registros disponíveis; sem atribuição automática de responsabilidade'};
  }
}
