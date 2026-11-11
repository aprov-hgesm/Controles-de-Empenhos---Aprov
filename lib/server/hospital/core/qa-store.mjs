import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {resolve,sep} from 'node:path';
import {assertHospital,assertIdentifier,HospitalError} from '../../../../features/hospital/core/domain.mjs';

// QA ONLY; separate file-based SQLite DB, never Firestore logistics/companies or production.
const SCHEMA=`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS hospital_organizations (id TEXT PRIMARY KEY, ug TEXT NOT NULL UNIQUE, active INTEGER NOT NULL CHECK(active IN(0,1)), body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (organization_id TEXT NOT NULL, id TEXT NOT NULL, uid TEXT NOT NULL, ug TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN(0,1)), roles_json TEXT NOT NULL, unit_ids_json TEXT NOT NULL, PRIMARY KEY(organization_id,id),UNIQUE(organization_id,uid),FOREIGN KEY(organization_id) REFERENCES hospital_organizations(id));
CREATE TABLE IF NOT EXISTS records (organization_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,unit_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=1),body TEXT NOT NULL,PRIMARY KEY(organization_id,kind,id),FOREIGN KEY(organization_id) REFERENCES hospital_organizations(id));
CREATE INDEX IF NOT EXISTS idx_hospital_records_unit ON records(organization_id,kind,unit_id);
CREATE TABLE IF NOT EXISTS meal_keys (organization_id TEXT NOT NULL,admission_id TEXT NOT NULL,local_date TEXT NOT NULL,cycle_id TEXT NOT NULL,meal_type TEXT NOT NULL,meal_id TEXT NOT NULL,PRIMARY KEY(organization_id,admission_id,local_date,cycle_id,meal_type));
CREATE TABLE IF NOT EXISTS map_versions (organization_id TEXT NOT NULL,map_id TEXT NOT NULL,version INTEGER NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(organization_id,map_id,version));
CREATE TRIGGER IF NOT EXISTS hospital_map_version_no_update BEFORE UPDATE ON map_versions BEGIN SELECT RAISE(ABORT,'immutable map version'); END;
CREATE TRIGGER IF NOT EXISTS hospital_map_version_no_delete BEFORE DELETE ON map_versions BEGIN SELECT RAISE(ABORT,'immutable map version'); END;
CREATE TABLE IF NOT EXISTS hospital_events (id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id TEXT NOT NULL,kind TEXT NOT NULL,aggregate_id TEXT NOT NULL,type TEXT NOT NULL,actor_uid TEXT NOT NULL,occurred_at TEXT NOT NULL,effective_at TEXT,payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_hospital_events_lookup ON hospital_events(organization_id,kind,aggregate_id,id);
CREATE TRIGGER IF NOT EXISTS hospital_events_no_update BEFORE UPDATE ON hospital_events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
CREATE TRIGGER IF NOT EXISTS hospital_events_no_delete BEFORE DELETE ON hospital_events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
CREATE TABLE IF NOT EXISTS hospital_idempotency (organization_id TEXT NOT NULL,operation TEXT NOT NULL,idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(organization_id,operation,idempotency_key));
PRAGMA user_version=1;`;
const kinds=new Set(['unit','bed','patient','admission','medical_reference','catalog_diet','map','meal','production_batch','label','location_event','delivery_event','incident','nutrition_audit','medical_review']);
function json(value){return JSON.stringify(value)}
function parse(s){return s===undefined?null:JSON.parse(s)}
export class HospitalQAStore {
  constructor({filename,qa=false}={}) {
    assertHospital(qa===true&&process.env.NODE_ENV!=='production','UNAVAILABLE','SQLite é exclusivo para QA local');
    assertHospital(typeof filename==='string'&&(filename===':memory:'||resolve(filename).startsWith(resolve(tmpdir())+sep)),'UNAVAILABLE','Banco QA deve estar em /tmp');
    this.db=new DatabaseSync(filename);
    this.db.exec('PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;');
    this.db.exec(SCHEMA);
  }
  close(){this.db.close()}
  /** BEGIN IMMEDIATE + SQLite PK/UNIQUE constraints guarantee atomicity across independent connections. */
  transaction(run){this.db.exec('BEGIN IMMEDIATE');try{const result=run(this);this.db.exec('COMMIT');return result}catch(e){this.db.exec('ROLLBACK');throw e}}
  now(){return new Date().toISOString()}
  /** QA seed method accepts ONLY synthetic fixtures. Never expose as HTTP endpoint. */
  seedOrganization(org){assertIdentifier(org.id);assertIdentifier(org.ug);this.db.prepare('INSERT INTO hospital_organizations(id,ug,active,body) VALUES(?,?,?,?)').run(org.id,org.ug,org.active===false?0:1,json(org));}
  seedMembership(m){assertIdentifier(m.id);assertIdentifier(m.uid);assertIdentifier(m.organizationId);this.db.prepare('INSERT INTO memberships(organization_id,id,uid,ug,active,roles_json,unit_ids_json) VALUES(?,?,?,?,?,?,?)').run(m.organizationId,m.id,m.uid,m.ug,m.active?1:0,json(m.roles),json(m.unitIds));}
  findOrganization(id){const row=this.db.prepare('SELECT body FROM hospital_organizations WHERE id=? AND active=1').get(id);return row?parse(row.body):null}
  findMembership(organizationId,uid){const row=this.db.prepare('SELECT * FROM memberships WHERE organization_id=? AND uid=?').get(organizationId,uid);return row?{id:row.id,uid:row.uid,organizationId:row.organization_id,ug:row.ug,active:row.active===1,roles:parse(row.roles_json),unitIds:parse(row.unit_ids_json)}:null}
  get(organizationId,kind,id){assertHospital(kinds.has(kind),'INVALID','Tipo desconhecido');const row=this.db.prepare('SELECT body FROM records WHERE organization_id=? AND kind=? AND id=?').get(organizationId,kind,id);return row?parse(row.body):null}
  list(organizationId,kind,unitId){assertHospital(kinds.has(kind),'INVALID','Tipo desconhecido');return this.db.prepare('SELECT body FROM records WHERE organization_id=? AND kind=? AND unit_id=? ORDER BY id').all(organizationId,kind,unitId).map(row=>parse(row.body))}
  put(organizationId,kind,unitId,value,expectedRevision=undefined){assertHospital(kinds.has(kind),'INVALID','Tipo desconhecido');assertIdentifier(value.id);assertIdentifier(organizationId);assertIdentifier(unitId);
    assertHospital(value.organizationId===organizationId&&value.unitId===unitId,'FORBIDDEN','Persistência fora da OM/unidade');
    const previous=this.get(organizationId,kind,value.id);
    if(previous){assertHospital(Number.isInteger(expectedRevision)&&previous.revision===expectedRevision,'CONFLICT','Versão obsoleta');const next={...value,revision:previous.revision+1};this.db.prepare('UPDATE records SET revision=?,body=? WHERE organization_id=? AND kind=? AND id=? AND revision=?').run(next.revision,json(next),organizationId,kind,value.id,expectedRevision);return next}
    assertHospital(expectedRevision===undefined||expectedRevision===0,'CONFLICT','Objeto inexistente para versão indicada');
    const next={...value,revision:1};this.db.prepare('INSERT INTO records(organization_id,kind,id,unit_id,revision,body) VALUES(?,?,?,?,?,?)').run(organizationId,kind,value.id,unitId,1,json(next));return next;
  }
  saveMapVersion(organizationId,mapId,version,kind,snapshot,reason,actorUid){const body={organizationId,mapId,version,kind,snapshot,reason:reason??null,actorUid,recordedAt:this.now()};this.db.prepare('INSERT INTO map_versions(organization_id,map_id,version,kind,body) VALUES(?,?,?,?,?)').run(organizationId,mapId,version,kind,json(body));return body}
  listMapVersions(organizationId,mapId){return this.db.prepare('SELECT body FROM map_versions WHERE organization_id=? AND map_id=? ORDER BY version').all(organizationId,mapId).map(row=>parse(row.body))}
  ensureMealUnique(o,admission,date,cycle,type,id){this.db.prepare('INSERT INTO meal_keys(organization_id,admission_id,local_date,cycle_id,meal_type,meal_id) VALUES(?,?,?,?,?,?)').run(o,admission,date,cycle,type,id)}
  getMealKey(o,admission,date,cycle,type){const row=this.db.prepare('SELECT meal_id FROM meal_keys WHERE organization_id=? AND admission_id=? AND local_date=? AND cycle_id=? AND meal_type=?').get(o,admission,date,cycle,type);return row?.meal_id??null}
  appendEvent(o,kind,id,type,uid,payload,effectiveAt=null){assertHospital(!effectiveAt||!Number.isNaN(Date.parse(effectiveAt)),'INVALID','effectiveAt inválido');const occurredAt=this.now();const res=this.db.prepare('INSERT INTO hospital_events(organization_id,kind,aggregate_id,type,actor_uid,occurred_at,effective_at,payload) VALUES(?,?,?,?,?,?,?,?)').run(o,kind,id,type,uid,occurredAt,effectiveAt,json(payload));return {id:Number(res.lastInsertRowid),organizationId:o,aggregateKind:kind,aggregateId:id,eventType:type,actorUid:uid,occurredAt,effectiveAt,payload};}
  events(o,kind,id){return this.db.prepare('SELECT * FROM hospital_events WHERE organization_id=? AND kind=? AND aggregate_id=? ORDER BY id').all(o,kind,id).map(row=>({id:row.id,organizationId:o,aggregateKind:row.kind,aggregateId:row.aggregate_id,eventType:row.type,actorUid:row.actor_uid,occurredAt:row.occurred_at,effectiveAt:row.effective_at,payload:parse(row.payload)}))}
  idempotent(o,operation,key,requestHash,fn){assertIdentifier(key,'idempotencyKey');const row=this.db.prepare('SELECT * FROM hospital_idempotency WHERE organization_id=? AND operation=? AND idempotency_key=?').get(o,operation,key);
    if(row){assertHospital(row.request_hash===requestHash,'CONFLICT','Idempotency key reutilizada com dados distintos');return parse(row.response)}
    const response=fn();this.db.prepare('INSERT INTO hospital_idempotency(organization_id,operation,idempotency_key,request_hash,response) VALUES(?,?,?,?,?)').run(o,operation,key,requestHash,json(response));return response;
  }
}
