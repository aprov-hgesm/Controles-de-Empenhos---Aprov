/**
 * Domain-specific server writes for alerts and commission definitions.
 * Never offers a generic Firestore path, or writes to invoices, NS or balances.
 */
import firebaseConfig from '../../firebase-applet-config.json';
import {getGoogleAccessToken} from './sectorProvisioningAdmin';
import type {VerifiedPlatformPrincipal} from './platformAuthorization';
export type SimpleResource='alerts'|'comissoes';
export class SimpleWriteFailure extends Error{
  constructor(public readonly code:string,public readonly status:number){
    super(code);this.name='SimpleWriteFailure';
  }
}
const idPattern=/^[A-Za-z0-9_-]{1,160}$/;
const alertTypes=new Set(['INFORMATIVO','CRÍTICO','ATENÇÃO','ESTOQUE ZERADO']);
const alertStatuses=new Set(['NOVO','LIDO','RESOLVIDO','ARQUIVADO']);
const alertSources=new Set(['EMPENHO','NOTA_FISCAL','SISTEMA']);
type RecordData=Record<string,unknown>;
function checkText(value:unknown,max=3000):string{
  if(typeof value!=='string'||value.length>max||value.includes('\u0000'))
    throw new SimpleWriteFailure('CORE_WRITE_INVALID_VALUE',400);
  return value;
}
function normalize(resource:SimpleResource,payload:unknown,uid:string):RecordData{
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
    throw new SimpleWriteFailure('CORE_WRITE_INVALID_DOCUMENT',400);
  const data=payload as RecordData;
  const id=checkText(data.id,160);
  if(!idPattern.test(id))throw new SimpleWriteFailure('CORE_WRITE_INVALID_ID',400);
  if(resource==='alerts'){
    const allowed=new Set(['id','empenhoId','type','status','source','title','subtitle',
      'description','date','createdAt','readAt','resolvedAt','archivedAt','userId']);
    if(Object.keys(data).some(k=>!allowed.has(k))||!alertTypes.has(String(data.type)))
      throw new SimpleWriteFailure('CORE_WRITE_INVALID_ALERT',400);
    if(data.status!==undefined&&!alertStatuses.has(String(data.status)) ||
      data.source!==undefined&&!alertSources.has(String(data.source)))
      throw new SimpleWriteFailure('CORE_WRITE_INVALID_ALERT',400);
    const result:RecordData={id,type:data.type,userId:uid};
    for(const key of ['empenhoId','status','source','title','subtitle',
      'description','date','createdAt','readAt','resolvedAt','archivedAt']){
      if(data[key]!==undefined)result[key]=checkText(data[key],key==='description'?6000:500);
    }
    for(const key of ['title','subtitle','description','date'])
      if(result[key]===undefined)throw new SimpleWriteFailure('CORE_WRITE_INVALID_ALERT',400);
    return result;
  }
  const allowed=new Set(['id','mesReferencia','boletimNumero','boletimData',
    'presidente','auxiliares','userId']);
  if(Object.keys(data).some(k=>!allowed.has(k))||
    !/^\d{4}-\d{2}$/.test(String(data.mesReferencia))||
    !data.presidente||typeof data.presidente!=='object'||Array.isArray(data.presidente)||
    !Array.isArray(data.auxiliares)||data.auxiliares.length>12)
    throw new SimpleWriteFailure('CORE_WRITE_INVALID_COMMISSION',400);
  const member=(source:unknown)=>{
    if(!source||typeof source!=='object'||Array.isArray(source))
      throw new SimpleWriteFailure('CORE_WRITE_INVALID_MEMBER',400);
    const v=source as RecordData;
    if(Object.keys(v).some(k=>!['postoGraduacao','nomeCompleto'].includes(k)))
      throw new SimpleWriteFailure('CORE_WRITE_INVALID_MEMBER',400);
    return {postoGraduacao:checkText(v.postoGraduacao,140),
      nomeCompleto:checkText(v.nomeCompleto,250)};
  };
  return {id,mesReferencia:data.mesReferencia,
    boletimNumero:checkText(data.boletimNumero,160),
    boletimData:checkText(data.boletimData,160),
    presidente:member(data.presidente),
    auxiliares:data.auxiliares.map(member),userId:uid};
}
function encode(value:unknown):RecordData{
  if(value===null)return {nullValue:'NULL_VALUE'};
  if(typeof value==='string')return {stringValue:value};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new SimpleWriteFailure('CORE_WRITE_INVALID_VALUE',400);
    return Number.isSafeInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  }
  if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
  if(value&&typeof value==='object')return {mapValue:{fields:encodeFields(value as RecordData)}};
  throw new SimpleWriteFailure('CORE_WRITE_INVALID_VALUE',400);
}
function encodeFields(data:RecordData){
  return Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined)
    .map(([key,value])=>[key,encode(value)]));
}
function connection(){
  const host=process.env.FIRESTORE_EMULATOR_HOST?.trim()||'';
  const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim()||'';
  if(process.env.EMPROVEX_E2E_SERVER_AUTH==='1'){
    if(process.env.NODE_ENV==='production'||!project.startsWith('demo-')
      ||!/^(localhost|127\.0\.0\.1):\d{2,5}$/.test(host))
      throw new SimpleWriteFailure('CORE_WRITE_INVALID_CONFIG',503);
    return {root:'http://'+host+'/v1/projects/'+encodeURIComponent(project)
      +'/databases/(default)/documents',token:'owner'};
  }
  return {root:'https://firestore.googleapis.com/v1/projects/'
    +encodeURIComponent(firebaseConfig.projectId)+'/databases/'
    +encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents',token:null};
}
export async function writeOperationalSimple(
  actor:VerifiedPlatformPrincipal,resource:SimpleResource,
  action:'save'|'delete',input:unknown,
):Promise<{id:string}>{
  if(resource!=='alerts'&&resource!=='comissoes')
    throw new SimpleWriteFailure('CORE_WRITE_FORBIDDEN',403);
  if(action==='delete'&&resource!=='alerts')
    throw new SimpleWriteFailure('CORE_WRITE_FORBIDDEN',403);
  const payload=action==='save'?normalize(resource,input,actor.uid):null;
  const id=action==='save'?String(payload!.id):checkText(input,160);
  if(!idPattern.test(id))throw new SimpleWriteFailure('CORE_WRITE_INVALID_ID',400);
  const cfg=connection();
  const token=cfg.token||await getGoogleAccessToken();
  const path='workspaces/'+actor.workspaceId+'/'+resource+'/'+id;
  const authorization='Bearer '+token;
  if(action==='delete'){
    const response=await fetch(cfg.root+'/'+path,{
      method:'DELETE',headers:{authorization},cache:'no-store',
    });
    if(response.status!==404&&!response.ok)throw new SimpleWriteFailure('CORE_WRITE_UNAVAILABLE',503);
    return {id};
  }
  const existing=await fetch(cfg.root+'/'+path,{headers:{authorization},cache:'no-store'});
  if(existing.status!==404&&!existing.ok)throw new SimpleWriteFailure('CORE_WRITE_UNAVAILABLE',503);
  const current=existing.ok?await existing.json() as {updateTime?:string}:null;
  if(current&&!current.updateTime)throw new SimpleWriteFailure('CORE_WRITE_INVALID_STATE',503);
  const documentName=cfg.root.slice(cfg.root.indexOf('/projects/')+1)+'/'+path;
  const commit=await fetch(cfg.root+':commit',{
    method:'POST',headers:{authorization,'content-type':'application/json'},
    body:JSON.stringify({writes:[{update:{name:documentName,fields:encodeFields(payload!)},
      currentDocument:current?{updateTime:current.updateTime}:{exists:false}}]}),
    cache:'no-store',
  });
  if(commit.status===409||commit.status===412)
    throw new SimpleWriteFailure('CORE_WRITE_CONFLICT',409);
  if(!commit.ok)throw new SimpleWriteFailure('CORE_WRITE_UNAVAILABLE',503);
  return {id};
}
