import {randomUUID} from 'node:crypto';
import {assertHospital, assertIdentifier, HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalOrganization, requireHospitalPermission} from '../core/auth.mjs';

export const FIRESTORE_HOSPITAL_PROJECT = 'cozinha-dietetica';
export const FIRESTORE_HOSPITAL_DATABASE = '(default)';
const METADATA = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default';
const ALLOWED_KINDS = Object.freeze({
  patient: ['patient:read','patient:write'],
  admission: ['admission:read','admission:write'],
  location_event: ['admission:read','admission:write'],
  medical_reference: ['patient:read','admission:write'],
  catalog_diet: ['map:read','hospital:manage'],
  map: ['map:read','map:write'],
  meal: ['meal:read','meal:write'],
  production_batch: ['meal:read','meal:production'],
  label: ['meal:read','meal:distribution'],
  delivery_event: ['meal:read','meal:distribution'],
  incident: ['map:read','incident:write'],
  nutrition_audit: ['nutrition:read','nutrition:write'],
  medical_review: ['nutrition:read','nutrition:write'],
});

function documentPath({organizationId,unitId,kind,id}) {
  [organizationId,unitId,id].forEach(value=>assertIdentifier(value));
  assertHospital(Object.hasOwn(ALLOWED_KINDS,kind),'INVALID','Coleção hospitalar desconhecida');
  return `organizations/${organizationId}/units/${unitId}/records/${kind}__${id}`;
}
function decodeDocument(doc, expected) {
  if (!doc || !doc.name || !doc.name.endsWith('/'+expected)) throw new HospitalError('UNAVAILABLE','Resposta Firestore inválida');
  const raw = doc.fields?.json?.stringValue;
  if (typeof raw !== 'string') throw new HospitalError('UNAVAILABLE','Documento sem corpo válido');
  let value;
  try {value=JSON.parse(raw)} catch {throw new HospitalError('UNAVAILABLE','Corpo Firestore inválido')}
  return {value,updateTime:doc.updateTime};
}
function documentValue(name,value,{organizationId,unitId,kind}) {
  assertHospital(value&&typeof value==='object'&&!Array.isArray(value),'INVALID','Registro inválido');
  assertHospital(value.organizationId===organizationId&&value.unitId===unitId,'FORBIDDEN','Registro fora da OM/unidade');
  const serialized=JSON.stringify(value);
  assertHospital(serialized.length<=100000,'INVALID','Registro excede limite hospitalar');
  return {name,fields:{
    organizationId:{stringValue:organizationId},
    unitId:{stringValue:unitId},
    kind:{stringValue:kind},
    json:{stringValue:serialized},
  }};
}

/**
 * This gateway is a SERVER-ONLY preparation for an isolated Cloud Run service.
 * W0-W9 SQLite services are synchronous and are NOT silently swapped with this
 * async Firestore client. No API route enables clinical writes in this phase.
 */
export class HospitalFirestoreGateway {
  constructor({fetchImpl=globalThis.fetch, identityProvider, qa=false}={}) {
    assertHospital(qa===true&&process.env.NODE_ENV!=='production','UNAVAILABLE','Firestore hospitalar apenas para QA isolado');
    assertHospital(process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1','UNAVAILABLE','Firestore QA não autorizado');
    assertHospital(process.env.HOSPITAL_FIRESTORE_PROJECT_ID===FIRESTORE_HOSPITAL_PROJECT,'UNAVAILABLE','Projeto clínico incorreto');
    assertHospital(typeof fetchImpl==='function','UNAVAILABLE','HTTP indisponível');
    this.fetchImpl=fetchImpl;
    this.identityProvider=identityProvider??(()=>metadataIdentity(fetchImpl));
    this.root=`https://firestore.googleapis.com/v1/projects/${FIRESTORE_HOSPITAL_PROJECT}/databases/${encodeURIComponent(FIRESTORE_HOSPITAL_DATABASE)}/documents`;
  }
  async request(path,{method='GET',body}={}) {
    const identity=await this.identityProvider();
    const expected=process.env.HOSPITAL_FIRESTORE_SERVICE_ACCOUNT_EMAIL?.trim();
    assertHospital(expected&&expected.endsWith('@cozinha-dietetica.iam.gserviceaccount.com')
      && identity?.email===expected,'UNAVAILABLE','Identidade de serviço hospitalar não autorizada');
    assertHospital(typeof identity.accessToken==='string'&&identity.accessToken.length>20,'UNAVAILABLE','Token IAM indisponível');
    const response=await this.fetchImpl(this.root+path,{
      method,
      headers:{Authorization:`Bearer ${identity.accessToken}`,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(8000),
    });
    if(response.status===404)return null;
    if(response.status===409||response.status===412)throw new HospitalError('CONFLICT','Conflito de versão hospitalar');
    if(!response.ok)throw new HospitalError('UNAVAILABLE','Firestore hospitalar indisponível');
    return response.json();
  }
  #authorized(scope,kind,unitId,write=false) {
    assertHospital(scope&&typeof scope.organizationId==='string','UNAUTHORIZED','Escopo necessário');
    requireHospitalOrganization(scope,scope.organizationId);
    assertHospital(Object.hasOwn(ALLOWED_KINDS,kind),'INVALID','Tipo de registro inválido');
    const permission=ALLOWED_KINDS[kind][write?1:0];
    requireHospitalPermission(scope,permission,permission==='hospital:manage'?undefined:unitId);
    return scope.organizationId;
  }
  async get(scope,{kind,unitId,id}) {
    const organizationId=this.#authorized(scope,kind,unitId,false);
    const path=documentPath({organizationId,unitId,kind,id});
    const result=await this.request('/'+path.split('/').map(encodeURIComponent).join('/'));
    if(result===null)return null;
    const doc=decodeDocument(result,kind+'__'+id);
    assertHospital(doc.value.organizationId===organizationId&&doc.value.unitId===unitId,'FORBIDDEN','Registro hospitalar divergente');
    return doc;
  }
  async list(scope,{kind,unitId,pageSize=50,pageToken}={}) {
    const organizationId=this.#authorized(scope,kind,unitId,false);
    assertHospital(Number.isInteger(pageSize)&&pageSize>=1&&pageSize<=100,'INVALID','Página inválida');
    if(pageToken!==undefined)assertHospital(typeof pageToken==='string'&&pageToken.length<1000,'INVALID','Cursor inválido');
    const prefix=`organizations/${organizationId}/units/${unitId}/records`;
    const q=new URLSearchParams({pageSize:String(pageSize)});
    if(pageToken)q.set('pageToken',pageToken);
    const result=await this.request('/'+prefix.split('/').map(encodeURIComponent).join('/')+'?'+q.toString());
    const records=[];
    for(const doc of result?.documents??[]) {
      if(doc.fields?.kind?.stringValue!==kind)continue;
      const leaf=doc.name?.split('/').pop()??'';
      if(!leaf.startsWith(kind+'__'))continue;
      const record=decodeDocument(doc,leaf);
      assertHospital(record.value.organizationId===organizationId&&record.value.unitId===unitId,'FORBIDDEN','Registro fora da unidade');
      records.push(record);
    }
    return {records,nextPageToken:result?.nextPageToken??null};
  }
  /** Atomic record+audit event with create-if-absent or Firestore updateTime CAS. */
  async writeWithAudit(scope,{kind,unitId,id,value,actorUid,eventType,expectedUpdateTime}) {
    const organizationId=this.#authorized(scope,kind,unitId,true);
    assertIdentifier(id);
    assertHospital(actorUid===scope.uid,'FORBIDDEN','Autor divergente');
    assertHospital(typeof eventType==='string'&&/^[a-z][a-z0-9_.:-]{1,80}$/.test(eventType),'INVALID','Evento inválido');
    if(expectedUpdateTime!==undefined) {
      assertHospital(typeof expectedUpdateTime==='string'&&Number.isFinite(Date.parse(expectedUpdateTime)),'INVALID','Versão inválida');
    }
    const path=documentPath({organizationId,unitId,kind,id});
    const name=this.root.slice(0,-'/documents'.length)+'/documents/'+path;
    const eventId=randomUUID();
    const eventName=`${this.root}/organizations/${organizationId}/units/${unitId}/audit/${eventId}`;
    const event={organizationId,unitId,kind,aggregateId:id,eventType,actorUid};
    const writes=[
      {update:documentValue(name,value,{organizationId,unitId,kind}),
        currentDocument:expectedUpdateTime?{updateTime:expectedUpdateTime}:{exists:false}},
      {update:{name:eventName,fields:{json:{stringValue:JSON.stringify(event)}}},currentDocument:{exists:false},
       updateTransforms:[{fieldPath:'recordedAt',setToServerValue:'REQUEST_TIME'}]},
    ];
    const result=await this.request(':commit',{method:'POST',body:{writes}});
    assertHospital(Array.isArray(result?.writeResults)&&result.writeResults.length===2,'UNAVAILABLE','Commit não confirmado');
    return {id,organizationId,unitId,updateTime:result.writeResults[0].updateTime,eventId};
  }
}

async function metadataIdentity(fetchImpl) {
  const headers={'Metadata-Flavor':'Google'};
  const [email,token]=await Promise.all([
    fetchImpl(METADATA+'/email',{headers,signal:AbortSignal.timeout(3000)}),
    fetchImpl(METADATA+'/token',{headers,signal:AbortSignal.timeout(3000)}),
  ]);
  if(!email.ok||!token.ok)throw new HospitalError('UNAVAILABLE','Identidade Cloud Run indisponível');
  const [address,credential]=await Promise.all([email.text(),token.json()]);
  return {email:address.trim(),accessToken:credential.access_token};
}
