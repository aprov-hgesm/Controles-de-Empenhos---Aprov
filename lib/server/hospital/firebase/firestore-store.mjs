import {createHash, randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {assertHospital, assertIdentifier, HospitalError} from '../../../../features/hospital/core/domain.mjs';

/**
 * W10: Firestore-native, server-only repository for isolated emulator QA.
 * This module NEVER contacts the real project: the host must be loopback and
 * NODE_ENV must not be production. Client SDK credentials are not accepted.
 *
 * All multi-document commands use Firestore beginTransaction -> read -> commit.
 * Pending writes are visible within a transaction and committed atomically.
 * Snapshots, versions, audit events and idempotency records are create-only.
 */
const KINDS=new Set([
  'unit','bed','patient','admission','medical_reference','catalog_diet','map',
  'meal','production_batch','label','location_event','delivery_event','incident',
  'nutrition_audit','medical_review',
  'nutrition_finding','nutrition_contact','nutrition_catalog','hospital_settings'
]);
const hash=value=>createHash('sha256').update(value).digest('hex');
const prefix='organizations/';
const txScope=new AsyncLocalStorage();
const safePart=value=>encodeURIComponent(assertIdentifier(value));
const parseJson=value=>JSON.parse(value);
const MAX_PAGE=150;
const MAX_SCAN=5000;

export class HospitalFirestoreStore {
  constructor({fetchImpl=globalThis.fetch,host=process.env.FIRESTORE_EMULATOR_HOST,project='demo-cozinha-dietetica'}={}) {
    assertHospital(process.env.NODE_ENV!=='production'
      && process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1',
      'UNAVAILABLE','Firestore hospitalar reservado para QA isolado');
    assertHospital(typeof host==='string' && /^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host),
      'UNAVAILABLE','Emulador Firestore local obrigatório');
    assertHospital(project==='demo-cozinha-dietetica','UNAVAILABLE','Projeto hospitalar divergente');
    assertHospital(typeof fetchImpl==='function','UNAVAILABLE','HTTP do emulador indisponível');
    this.fetchImpl=fetchImpl;
    this.nameRoot='projects/'+project+'/databases/(default)/documents';
    this.root='http://'+host+'/v1/'+this.nameRoot;
  }
  close() {}
  now(){return new Date().toISOString()}
  async http(path,{method='GET',body,missing=false}={}) {
    let response;
    try {
      response=await this.fetchImpl(this.root+path,{
        method,cache:'no-store',
        headers:{'Authorization':'Bearer owner','Content-Type':'application/json'},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),
        signal:AbortSignal.timeout(10000),
      });
    } catch {throw new HospitalError('UNAVAILABLE','Emulador Firestore indisponível')}
    if(response.status===404&&missing)return null;
    if(response.status===409||response.status===412)
      throw new HospitalError('CONFLICT','Conflito transacional Firestore');
    if(!response.ok){
      // Diagnostic code only: the store accepts demo-* and loopback emulator, never clinical production.
      const safeStatus=response.status;
      const errorBody=await response.text();
      throw new HospitalError('UNAVAILABLE',`Emulador Firestore HTTP ${safeStatus}: ${errorBody.slice(0,350)}`);
    }
    const raw=await response.text();
    if(!raw.trim())return {};
    try{return JSON.parse(raw)}
    catch{
      try{return raw.trim().split('\n').map(line=>JSON.parse(line))}
      catch{throw new HospitalError('UNAVAILABLE','Resposta Firestore inválida')}
    }
  }
  full(path){return this.nameRoot+'/'+path}
  _tx(){return txScope.getStore()??null}
  _assertOrg(o){return safePart(o)}
  _recordPath(o,unit,kind,id){
    assertHospital(KINDS.has(kind),'INVALID','Tipo de registro inválido');
    return prefix+this._assertOrg(o)+'/units/'+safePart(unit)+'/records/'+safePart(kind+'__'+id);
  }
  _pointerPath(o,kind,id){return prefix+this._assertOrg(o)+'/recordPointers/'+safePart(kind+'__'+id)}
  _path(o,collection,id){return prefix+this._assertOrg(o)+'/'+collection+'/'+safePart(id)}
  async _raw(path) {
    const tx=this._tx();
    if(tx?.overlay.has(path))return tx.overlay.get(path);
    if(tx?.cache.has(path))return tx.cache.get(path);
    const result=tx
      ? await this.http(':batchGet',{method:'POST',body:{documents:[this.full(path)],transaction:tx.token}})
      : await this.http('/'+path,{missing:true});
    const entry=tx?(Array.isArray(result)?result[0]:result):result;
    const doc=entry?.found??(!entry?.missing?entry:null);
    const value=doc?.fields?.json?.stringValue;
    const read=value===undefined?null:{body:parseJson(value),updateTime:doc.updateTime};
    if(tx)tx.cache.set(path,read);
    return read;
  }
  _write(path,body,{create=false}={}) {
    const tx=this._tx();
    assertHospital(tx,'UNAVAILABLE','Escrita Firestore exige transação nativa');
    assertHospital(tx.writes.size<450,'PRECONDITION','Comando transacional excede limite seguro');
    const current=tx.overlay.has(path)?tx.overlay.get(path):tx.cache.get(path);
    tx.overlay.set(path,{body,updateTime:current?.updateTime});
    const update={name:this.full(path),fields:{json:{stringValue:JSON.stringify(body)}}};
    if(path.includes('/records/'))update.fields.kind={stringValue:path.split('/').pop().split('__')[0]};
    if(path.includes('/events/')){
      update.fields.aggregateKind={stringValue:body.aggregateKind};
      update.fields.aggregateId={stringValue:body.aggregateId};
    }
    tx.writes.set(path,{update,currentDocument:create?{exists:false}:current?.updateTime
      ?{updateTime:current.updateTime}:{exists:false}});
  }
  _delete(path) {
    const tx=this._tx();
    assertHospital(tx,'UNAVAILABLE','Exclusão exige transação');
    const current=tx.overlay.has(path)?tx.overlay.get(path):tx.cache.get(path);
    assertHospital(current,'NOT_FOUND','Documento a mover não existe');
    tx.overlay.set(path,null);
    tx.writes.set(path,{delete:this.full(path),currentDocument:current.updateTime
      ?{updateTime:current.updateTime}:{exists:true}});
  }
  async transaction(fn) {
    assertHospital(typeof fn==='function','INVALID','Comando inválido');
    assertHospital(!this._tx(),'PRECONDITION','Transação aninhada não permitida');
    for(let attempt=0;attempt<3;attempt++){
      let token;
      try{
        const begun=await this.http(':beginTransaction',{method:'POST',body:{options:{readWrite:{}}}});
        token=begun?.transaction;
        assertHospital(typeof token==='string','UNAVAILABLE','Transação não iniciada');
        const state={token,writes:new Map(),overlay:new Map(),cache:new Map()};
        const result=await txScope.run(state,()=>fn(this));
        const writes=[...state.writes.values()];
        // Even read-only transactions are explicitly ended and never make a write.
        if(writes.length)await this.http(':commit',{method:'POST',body:{transaction:token,writes}});
        else await this.http(':rollback',{method:'POST',body:{transaction:token}});
        return result;
      }catch(error){
        if(token)try{await this.http(':rollback',{method:'POST',body:{transaction:token}})}catch{}
        if(error instanceof HospitalError&&error.code==='CONFLICT'&&attempt<2)continue;
        throw error;
      }
    }
    throw new HospitalError('CONFLICT','Concorrência hospitalar: tente novamente');
  }
  async seedOrganization(org) {
    assertIdentifier(org.id);assertIdentifier(org.ug);
    return this.transaction(async db=>{
      const path=db._path(org.id,'config','meta');
      assertHospital(!await db._raw(path),'CONFLICT','Organização já cadastrada');
      db._write(path,{...org,active:org.active!==false},{create:true});
    });
  }
  async seedMembership(m) {
    assertIdentifier(m.uid);assertIdentifier(m.organizationId);assertIdentifier(m.id);
    return this.transaction(async db=>{
      const path=db._path(m.organizationId,'memberships',m.uid);
      assertHospital(!await db._raw(path),'CONFLICT','Vínculo já cadastrado');
      db._write(path,m,{create:true});
    });
  }
  async findOrganization(o) {
    return (await this._raw(this._path(o,'config','meta')))?.body??null;
  }
  async findMembership(o,uid) {
    return (await this._raw(this._path(o,'memberships',uid)))?.body??null;
  }
  async get(o,kind,id) {
    assertHospital(KINDS.has(kind),'INVALID','Tipo de registro inválido');
    const pointer=(await this._raw(this._pointerPath(o,kind,id)))?.body;
    if(!pointer)return null;
    const document=(await this._raw(this._recordPath(o,pointer.unitId,kind,id)))?.body??null;
    assertHospital(!document||document.organizationId===o&&document.unitId===pointer.unitId,
      'UNAVAILABLE','Índice hospitalar incoerente');
    return document;
  }
  async put(o,kind,unitId,value,expectedRevision=undefined){
    assertHospital(this._tx(),'UNAVAILABLE','put exige Firestore transaction');
    assertHospital(KINDS.has(kind),'INVALID','Tipo inválido');
    assertIdentifier(o);assertIdentifier(unitId);assertIdentifier(value.id);
    assertHospital(value.organizationId===o&&value.unitId===unitId,'FORBIDDEN','OM/unidade divergente');
    const previous=await this.get(o,kind,value.id);
    const pointerPath=this._pointerPath(o,kind,value.id);
    if(previous){
      assertHospital(Number.isInteger(expectedRevision)&&previous.revision===expectedRevision,
        'CONFLICT','Versão hospitalar obsoleta');
      const next={...value,revision:previous.revision+1};
      if(previous.unitId!==unitId) {
        this._delete(this._recordPath(o,previous.unitId,kind,value.id));
        this._write(this._recordPath(o,unitId,kind,value.id),next,{create:true});
      }else this._write(this._recordPath(o,unitId,kind,value.id),next);
      this._write(pointerPath,{unitId,revision:next.revision});
      return next;
    }
    assertHospital(expectedRevision===undefined||expectedRevision===0,'CONFLICT','Registro não existe na revisão indicada');
    const next={...value,revision:1};
    this._write(this._recordPath(o,unitId,kind,value.id),next,{create:true});
    this._write(pointerPath,{unitId,revision:1},{create:true});
    return next;
  }
  async _query(path,{kind,eventKind,aggregateId,pageSize=MAX_PAGE,limit=MAX_SCAN}={}) {
    const found=[];
    let after;
    while(true){
      const structuredQuery={
        from:[{collectionId:path.split('/').pop()}],
        orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],
        limit:Math.min(pageSize,limit+1-found.length),
      };
      const terms=[];
      if(kind)terms.push({fieldFilter:{field:{fieldPath:'kind'},op:'EQUAL',value:{stringValue:kind}}});
      if(eventKind)terms.push({fieldFilter:{field:{fieldPath:'aggregateKind'},op:'EQUAL',value:{stringValue:eventKind}}});
      if(aggregateId)terms.push({fieldFilter:{field:{fieldPath:'aggregateId'},op:'EQUAL',value:{stringValue:aggregateId}}});
      if(terms.length===1)structuredQuery.where=terms[0];
      else if(terms.length>1)structuredQuery.where={compositeFilter:{op:'AND',filters:terms}};
      if(after)structuredQuery.startAt={values:[{referenceValue:after}],before:false};
      const tx=this._tx();
      const parent=path.slice(0,path.lastIndexOf('/'));
      const results=await this.http('/'+parent+':runQuery',{method:'POST',body:{
        structuredQuery,...(tx?{transaction:tx.token}:{})}});
      const docs=(Array.isArray(results)?results:[results]).map(x=>x?.document).filter(Boolean);
      for(const doc of docs){
        if(kind&&doc.fields?.kind?.stringValue!==kind)continue;
        const body=doc.fields?.json?.stringValue;
        assertHospital(typeof body==='string','UNAVAILABLE','Registro Firestore inválido');
        found.push({body:parseJson(body),name:doc.name,updateTime:doc.updateTime});
      }
      assertHospital(found.length<=limit,'PRECONDITION','Consulta excede limite seguro: filtre o escopo');
      if(docs.length<structuredQuery.limit)break;
      after=docs[docs.length-1].name;
    }
    const overlay=this._tx()?.overlay;
    if(overlay){
      const map=new Map(found.map(x=>[x.name,x]));
      for(const [key,val] of overlay) {
        if(key.startsWith(path+'/')) {
          const name=this.full(key);
          if(!val)map.delete(name);
          else if(!kind||val.body?.kind===kind||key.split('/').pop()?.startsWith(kind+'__'))
            map.set(name,{body:val.body,name,updateTime:val.updateTime});
        }
      }
      return [...map.values()].map(x=>x.body);
    }
    return found.map(x=>x.body);
  }
  async list(o,kind,unitId){
    assertHospital(KINDS.has(kind),'INVALID','Tipo inválido');
    const path=prefix+this._assertOrg(o)+'/units/'+safePart(unitId)+'/records';
    // The record document ID begins with kind__, so no cross-kind disclosure.
    return (await this._query(path,{kind})).filter(v=>v?.organizationId===o&&v.unitId===unitId);
  }
  async listMapVersions(o,mapId){
    const path=prefix+this._assertOrg(o)+'/maps/'+safePart(mapId)+'/versions';
    return (await this._query(path)).sort((a,b)=>a.version-b.version);
  }
  async saveMapVersion(o,mapId,version,kind,snapshot,reason,actorUid){
    const path=prefix+this._assertOrg(o)+'/maps/'+safePart(mapId)+'/versions/'+String(version).padStart(6,'0');
    assertHospital(!await this._raw(path),'CONFLICT','Versão imutável já gravada');
    const body={organizationId:o,mapId,version,kind,snapshot,reason:reason??null,actorUid,recordedAt:this.now()};
    this._write(path,body,{create:true});
    this._tx().writes.get(path).updateTransforms=[{fieldPath:'recordedAtServer',setToServerValue:'REQUEST_TIME'}];
    // Domain-owned immutable event feeds; no global clinical event queries from UI.
    const pointer=(await this._raw(this._pointerPath(o,kind,id)))?.body;
    const unit=payload?.unitId??pointer?.unitId??null;
    const targets=new Set([unit,payload?.fromUnitId,payload?.toUnitId,...(Array.isArray(payload?.notifiedUnits)?payload.notifiedUnits:[])]);
    for(const target of targets){
      if(!target)continue;
      assertIdentifier(target);
      const eventPath=prefix+this._assertOrg(o)+'/units/'+safePart(target)+'/unitEvents/'+eventId;
      this._write(eventPath,{...body,unitId:target},{create:true});
      if(kind==='admission'&&payload?.notifyKitchen){
        const noticePath=prefix+this._assertOrg(o)+'/units/'+safePart(target)+'/notices/'+eventId;
        this._write(noticePath,{id:eventId,type,occurredAt:body.occurredAt,payload},{create:true});
      }
    }
    return body;
  }
  _mealKey(o,admission,date,cycle,type){
    return this._path(o,'mealKeys',hash([admission,date,cycle,type].join('|')));
  }
  async getMealKey(o,admission,date,cycle,type){
    return (await this._raw(this._mealKey(o,admission,date,cycle,type)))?.body?.mealId??null;
  }
  async ensureMealUnique(o,admission,date,cycle,type,id){
    const path=this._mealKey(o,admission,date,cycle,type);
    assertHospital(!await this._raw(path),'CONFLICT','Refeição duplicada');
    this._write(path,{organizationId:o,mealId:id},{create:true});
  }
  async appendEvent(o,kind,id,type,uid,payload,effectiveAt=null){
    assertHospital(!effectiveAt||!Number.isNaN(Date.parse(effectiveAt)),'INVALID','effectiveAt inválido');
    const eventId=randomUUID();
    const body={id:eventId,organizationId:o,aggregateKind:kind,aggregateId:id,eventType:type,
      actorUid:uid,occurredAt:this.now(),effectiveAt,payload};
    const path=this._path(o,'events',eventId);
    this._write(path,body,{create:true});
    this._tx().writes.get(path).updateTransforms=[{fieldPath:'recordedAtServer',setToServerValue:'REQUEST_TIME'}];
    return body;
  }
  async events(o,kind,id){
    const all=await this._query(prefix+this._assertOrg(o)+'/events',{eventKind:kind,aggregateId:id,limit:MAX_SCAN});
    return all.filter(e=>e.aggregateKind===kind&&e.aggregateId===id)
      .sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id.localeCompare(b.id));
  }
  async idempotent(o,operation,key,requestHash,fn){
    assertIdentifier(key,'idempotencyKey');
    const path=this._path(o,'idempotency',hash(operation+'|'+key));
    const row=(await this._raw(path))?.body;
    if(row){
      assertHospital(row.requestHash===requestHash,'CONFLICT','Idempotência reutilizada com payload diferente');
      return row.response;
    }
    const response=await fn();
    this._write(path,{organizationId:o,operation,key,requestHash,response},{create:true});
    return response;
  }
  /**
   * Unique institutional patient reference, active admission and occupied beds
   * are protected by create-only Firestore documents in the SAME transaction.
   */
  _patientRefPath(o,reference){return this._path(o,'patientReferences',hash(String(reference).toUpperCase()))}
  async getPatientReference(o,reference){
    return (await this._raw(this._patientRefPath(o,reference)))?.body?.patientId??null;
  }
  async reservePatientReference(o,reference,patientId){
    const path=this._patientRefPath(o,reference);
    const existing=(await this._raw(path))?.body;
    assertHospital(!existing||existing.patientId===patientId,'CONFLICT','Identificador institucional duplicado');
    if(!existing)this._write(path,{reference:String(reference).toUpperCase(),patientId},{create:true});
  }
  _activePath(o,patientId){return this._path(o,'activeAdmissions',patientId)}
  async getActiveAdmission(o,patientId){
    const id=(await this._raw(this._activePath(o,patientId)))?.body?.admissionId;
    return id?await this.get(o,'admission',id):null;
  }
  async reserveActiveAdmission(o,patientId,admissionId){
    const path=this._activePath(o,patientId);
    assertHospital(!await this._raw(path),'CONFLICT','Paciente já possui internação ativa');
    this._write(path,{admissionId,patientId},{create:true});
  }
  async releaseActiveAdmission(o,patientId,admissionId){
    const path=this._activePath(o,patientId);
    const row=(await this._raw(path))?.body;
    assertHospital(row?.admissionId===admissionId,'CONFLICT','Internação ativa divergente');
    this._delete(path);
  }
  _bedPath(o,unit,bed){return this._path(o,'occupiedBeds',hash(unit+'|'+bed))}
  async isBedOccupied(o,unit,bed,excludedId=null){
    if(!bed)return false;
    const id=(await this._raw(this._bedPath(o,unit,bed)))?.body?.admissionId;
    return Boolean(id&&id!==excludedId);
  }
  async reserveBed(o,unit,bed,admissionId){
    if(!bed)return;
    const path=this._bedPath(o,unit,bed);
    const existing=(await this._raw(path))?.body;
    assertHospital(!existing||existing.admissionId===admissionId,'CONFLICT','Leito ocupado');
    if(!existing)this._write(path,{unitId:unit,bedId:bed,admissionId},{create:true});
  }
  async releaseBed(o,unit,bed,admissionId){
    if(!bed)return;
    const path=this._bedPath(o,unit,bed);
    const existing=(await this._raw(path))?.body;
    assertHospital(existing?.admissionId===admissionId,'CONFLICT','Reserva de leito divergente');
    this._delete(path);
  }
  async move(o,kind,id,toUnitId,expectedRevision,patch={}){
    const previous=await this.get(o,kind,id);
    assertHospital(previous&&previous.revision===expectedRevision,'CONFLICT','Revisão alterada');
    return this.put(o,kind,toUnitId,{...previous,...patch,unitId:toUnitId},expectedRevision);
  }
  async listMemberships(o){
    return this._query(prefix+this._assertOrg(o)+'/memberships',{limit:1000});
  }
  async saveMembership(o,m,expectedRevision=0){
    assertIdentifier(m.uid);
    const path=this._path(o,'memberships',m.uid);
    const prior=(await this._raw(path))?.body;
    assertHospital(prior?.revision===expectedRevision||!prior&&expectedRevision===0,'CONFLICT','Vínculo concorrente');
    const next={...m,organizationId:o,revision:expectedRevision+1};
    this._write(path,next,{create:!prior});
    return next;
  }
  async listNotices(o,unit,limit=30){
    const rows=await this._query(prefix+this._assertOrg(o)+'/units/'+safePart(unit)+'/notices',{limit:Math.min(1000,Math.max(limit,50))});
    return rows.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,limit);
  }
  async listUnitEvents(o,unit,limit=500){
    const rows=await this._query(prefix+this._assertOrg(o)+'/units/'+safePart(unit)+'/unitEvents',{limit:Math.min(MAX_SCAN,Math.max(limit,100))});
    return rows.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,limit);
  }

}