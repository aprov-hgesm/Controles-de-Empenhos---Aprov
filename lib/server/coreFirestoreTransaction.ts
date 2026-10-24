/**
 * Firestore REST transactional adapter, exclusively server-side and path bounded.
 * There is no caller-controlled Firestore path or generic read/write HTTP endpoint.
 */
import firebaseConfig from '../../firebase-applet-config.json';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

export type CoreTxValue = string | number | boolean | null | CoreTxValue[] |
  { [key:string]: CoreTxValue | undefined };
type Encoded = Record<string,unknown>;
export interface CoreTxDocument {
  path:string;
  data:Record<string,unknown>;
  updateTime:string;
}
export class CoreTransactionError extends Error {
  constructor(public readonly code:string,public readonly status:number){
    super(code);this.name='CoreTransactionError';
  }
}
function validatePath(path:string){
  const parts=path.split('/');
  if(parts.length!==4 || parts[0]!=='workspaces'
    || !/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(parts[1])
    || !['empenhos','settings'].includes(parts[2])
    || !/^[A-Za-z0-9_-]{1,160}$/.test(parts[3])
    || (parts[2]==='settings'&&!parts[3].startsWith('empenhoDelete_')))
    throw new CoreTransactionError('CORE_INVALID_TRANSACTION_PATH',400);
}
function context(){
  if(process.env.EMPROVEX_E2E_SERVER_AUTH==='1'){
    const host=process.env.FIRESTORE_EMULATOR_HOST?.trim()||'';
    const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim()||'';
    if(process.env.NODE_ENV==='production'
      ||!/^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host)
      ||!project.startsWith('demo-'))
      throw new CoreTransactionError('CORE_TRANSACTION_EMULATOR_DENIED',503);
    return {project,base:'http://'+host+'/v1/projects/'+encodeURIComponent(project)
      +'/databases/(default)/documents',emulator:true};
  }
  return {project:firebaseConfig.projectId,base:'https://firestore.googleapis.com/v1/projects/'
    +encodeURIComponent(firebaseConfig.projectId)+'/databases/'
    +encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents',emulator:false};
}
function encode(value:CoreTxValue):Encoded {
  if(value===null)return {nullValue:'NULL_VALUE'};
  if(typeof value==='string')return {stringValue:value};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new CoreTransactionError('CORE_INVALID_NUMBER',400);
    return Number.isSafeInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  }
  if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
  return {mapValue:{fields:encodeFields(value)}};
}
function encodeFields(value:Record<string,CoreTxValue|undefined>):Record<string,Encoded>{
  return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined)
    .map(([k,v])=>[k,encode(v as CoreTxValue)]));
}
function decode(value:Encoded):unknown{
  if('stringValue' in value)return value.stringValue;
  if('integerValue' in value)return Number(value.integerValue);
  if('doubleValue' in value)return Number(value.doubleValue);
  if('booleanValue' in value)return value.booleanValue;
  if('nullValue' in value)return null;
  if('timestampValue' in value)return value.timestampValue;
  if('arrayValue' in value)return ((value.arrayValue as {values?:Encoded[]}).values||[]).map(decode);
  if('mapValue' in value)return decodeFields((value.mapValue as {fields?:Record<string,Encoded>}).fields||{});
  throw new CoreTransactionError('CORE_INVALID_FIRESTORE_VALUE',503);
}
function decodeFields(fields:Record<string,Encoded>):Record<string,unknown>{
  return Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,decode(v)]));
}
function parseBatch(raw:string):Array<Record<string,unknown>>{
  const content=raw.trim();
  if(!content)throw new CoreTransactionError('CORE_EMPTY_TRANSACTION_READ',503);
  if(content.startsWith('[')){
    const list=JSON.parse(content) as unknown;
    if(!Array.isArray(list))throw new CoreTransactionError('CORE_INVALID_TRANSACTION_READ',503);
    return list as Record<string,unknown>[];
  }
  return content.split(/\r?\n/).filter(Boolean)
    .map(s=>JSON.parse(s) as Record<string,unknown>);
}
export async function coreDocumentTransaction<T>(
  paths:string[],
  build:(docs:ReadonlyMap<string,CoreTxDocument|null>)=>{result:T,
    writes:Array<{path:string,data:Record<string,CoreTxValue|undefined>}>},
):Promise<T>{
  if(paths.length<1||paths.length>12||new Set(paths).size!==paths.length)
    throw new CoreTransactionError('CORE_INVALID_TRANSACTION_SET',400);
  paths.forEach(validatePath);
  const c=context(),token=c.emulator?'owner':await getGoogleAccessToken();
  const header={authorization:'Bearer '+token,'content-type':'application/json'};
  const name=(path:string)=>'projects/'+c.project+'/databases/'
    +(c.emulator?'(default)':firebaseConfig.firestoreDatabaseId)+'/documents/'+path;
  async function post(suffix:string,data:unknown){
    let response:Response;
    try{response=await fetch(c.base+suffix,{method:'POST',headers:header,
      body:JSON.stringify(data),cache:'no-store'});}catch{
      throw new CoreTransactionError('CORE_FIRESTORE_UNAVAILABLE',503);
    }
    if(!response.ok){
      if(response.status===409||response.status===412)
        throw new CoreTransactionError('CORE_CONCURRENT_MODIFICATION',409);
      throw new CoreTransactionError('CORE_FIRESTORE_UNAVAILABLE',503);
    }
    return response;
  }
  const begun=await post(':beginTransaction',{options:{readWrite:{}}});
  const tokenData=await begun.json() as {transaction?:string};
  const tx=tokenData.transaction;
  if(!tx)throw new CoreTransactionError('CORE_TRANSACTION_UNAVAILABLE',503);
  let committed=false;
  try{
    const rows=parseBatch(await (await post(':batchGet',{
      documents:paths.map(name),transaction:tx,
    })).text());
    const read=new Map<string,CoreTxDocument|null>();
    for(const row of rows){
      const found=row.found as {name?:string,fields?:Record<string,Encoded>,updateTime?:string}|undefined;
      const full=found?.name||row.missing;
      if(typeof full!=='string')throw new CoreTransactionError('CORE_READ_MALFORMED',503);
      const path=paths.find(p=>name(p)===full);
      if(!path||read.has(path))throw new CoreTransactionError('CORE_READ_SCOPE_VIOLATION',503);
      read.set(path,found?{path,data:decodeFields(found.fields||{}),updateTime:found.updateTime||''}:null);
    }
    if(read.size!==paths.length)throw new CoreTransactionError('CORE_READ_INCOMPLETE',503);
    const plan=build(read);
    if(!plan.writes.length)return plan.result;
    if(plan.writes.length>8||new Set(plan.writes.map(w=>w.path)).size!==plan.writes.length)
      throw new CoreTransactionError('CORE_INVALID_WRITE_SET',400);
    const writes=plan.writes.map(w=>{
      if(!read.has(w.path)||!w.path.includes('/empenhos/'))
        throw new CoreTransactionError('CORE_INVALID_WRITE_SET',400);
      const existing=read.get(w.path);
      return {update:{name:name(w.path),fields:encodeFields(w.data)},
        currentDocument:existing?{updateTime:existing.updateTime}:{exists:false}};
    });
    await post(':commit',{writes,transaction:tx});
    committed=true;
    return plan.result;
  }finally{
    if(!committed)await post(':rollback',{transaction:tx}).catch(()=>undefined);
  }
}
