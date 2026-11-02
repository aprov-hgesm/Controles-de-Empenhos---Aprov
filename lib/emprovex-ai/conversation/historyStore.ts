/** Eleonor R3 conversation history: server-only Firestore REST, never a client SDK.
 * This collection is deliberately absent from Firestore client Rules (deny by default).
 * Scoped by authenticated Firebase UID + workspace, including founder access.
 * Conversation content is personal data: do not write prompts/responses to logs.
 */
import {createHash,randomUUID} from 'node:crypto';
import firebaseConfig from '../../../firebase-applet-config.json';
import type {AiAccess} from '../authorize';
import {aiProductionPilotEnabled} from '../integration/environment';
import {AiExecutionError} from '../response';

export type HistoryMessage={id:string;role:'user'|'assistant';text:string;at:string;status?:string;route?:string};
export type HistoryThread={id:string;title:string;createdAt:string;updatedAt:string;messages:HistoryMessage[]};
export type HistorySummary=Omit<HistoryThread,'messages'>&{messageCount:number};
const MAX_THREADS=50, MAX_MESSAGES=120, MAX_TEXT=2200;
const COLLECTION='eleonorHistory';
const ROOT='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)+
 '/databases/'+encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents';
const ID=/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i;

export function historyEnabled():boolean {
 return process.env.EMPROVEX_AI_HISTORY_ENABLED==='1' && aiProductionPilotEnabled() &&
   process.env.K_SERVICE==='emprovex-cloudrun-candidate' &&
   process.env.K_CONFIGURATION==='emprovex-cloudrun-candidate';
}
function enabled():void {
 if(!historyEnabled())throw new AiExecutionError('AI_HISTORY_DISABLED',503);
}
function scope(access:AiAccess):string {
 return createHash('sha256').update(access.workspaceId+'\u0000'+access.uid).digest('hex');
}
function collection(access:AiAccess):string {return ROOT+'/'+COLLECTION+'/'+scope(access)+'/threads';}
function doc(access:AiAccess,id:string):string {
 if(!ID.test(id))throw new AiExecutionError('AI_HISTORY_INVALID_ID',400);
 return collection(access)+'/'+id;
}
function title(value:string):string {
 const cleaned=value.replace(/[\u0000-\u001f\u007f<>]/g,' ').trim().slice(0,72);
 if(!cleaned)throw new AiExecutionError('AI_HISTORY_INVALID_TITLE',400);
 return cleaned;
}
type FS={name?:string;updateTime?:string;fields?:Record<string,{stringValue?:string;integerValue?:string}>};
function field(x:FS,k:string):string{return x.fields?.[k]?.stringValue||'';}
function unpack(x:FS,access:AiAccess):HistoryThread {
 if(field(x,'workspaceId')!==access.workspaceId || field(x,'uid')!==access.uid)
   throw new AiExecutionError('AI_HISTORY_SCOPE_FORBIDDEN',403);
 let messages:unknown;
 try{messages=JSON.parse(field(x,'messagesJson'));}catch{throw new AiExecutionError('AI_HISTORY_CORRUPT',503);}
 if(!Array.isArray(messages)||messages.length>MAX_MESSAGES)
   throw new AiExecutionError('AI_HISTORY_CORRUPT',503);
 return {id:(x.name||'').split('/').pop()||'',title:field(x,'title'),
   createdAt:field(x,'createdAt'),updatedAt:field(x,'updatedAt'),messages:messages as HistoryMessage[]};
}
function pack(access:AiAccess,t:HistoryThread):FS {
 return {fields:{
  uid:{stringValue:access.uid},workspaceId:{stringValue:access.workspaceId},
  title:{stringValue:t.title},createdAt:{stringValue:t.createdAt},
  updatedAt:{stringValue:t.updatedAt},messagesJson:{stringValue:JSON.stringify(t.messages)}
 }};
}
async function request(url:string,access:AiAccess,method='GET',body?:unknown):Promise<Response>{
 const response=await fetch(url,{method,cache:'no-store',
  headers:{Authorization:'Bearer '+access.googleToken,...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 if(response.status===401||response.status===403)
   throw new AiExecutionError('AI_HISTORY_STORAGE_FORBIDDEN',503);
 if(!response.ok&&response.status!==404&&response.status!==409&&response.status!==412)
   throw new AiExecutionError('AI_HISTORY_STORAGE_UNAVAILABLE',503);
 return response;
}
async function read(access:AiAccess,id:string):Promise<{thread:HistoryThread;updateTime:string}|null>{
 enabled();
 const r=await request(doc(access,id),access);
 if(r.status===404)return null;
 const raw=await r.json() as FS;
 return {thread:unpack(raw,access),updateTime:raw.updateTime||''};
}
export async function getHistory(access:AiAccess,id:string):Promise<HistoryThread>{
 const value=await read(access,id);
 if(!value)throw new AiExecutionError('AI_HISTORY_NOT_FOUND',404);
 return value.thread;
}
export async function listHistory(access:AiAccess):Promise<HistorySummary[]>{
 enabled();
 const params=new URLSearchParams({pageSize:String(MAX_THREADS+1),orderBy:'updatedAt desc'});
 const r=await request(collection(access)+'?'+params.toString(),access);
 if(r.status===404)return [];
 const parsed=await r.json() as {documents?:FS[]};
 const rows=(parsed.documents||[]).map(x=>unpack(x,access));
 return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,MAX_THREADS)
  .map(({messages,...t})=>({...t,messageCount:messages.length}));
}
export async function createHistory(access:AiAccess,firstMessage:string):Promise<HistoryThread>{
 enabled();
 const count=await listHistory(access);
 if(count.length>=MAX_THREADS)throw new AiExecutionError('AI_HISTORY_LIMIT_REACHED',409);
 const id=randomUUID(),now=new Date().toISOString();
 const t:HistoryThread={id,title:title(firstMessage),createdAt:now,updatedAt:now,messages:[]};
 const r=await request(collection(access)+'?documentId='+id,access,'POST',pack(access,t));
 if(!r.ok)throw new AiExecutionError('AI_HISTORY_CREATE_FAILED',503);
 return t;
}
export async function appendHistory(access:AiAccess,id:string,userText:string,
 assistantText:string,meta:{status:string;route:string}):Promise<void>{
 const current=await read(access,id);
 if(!current)throw new AiExecutionError('AI_HISTORY_NOT_FOUND',404);
 const t=current.thread;
 if(t.messages.length+2>MAX_MESSAGES)
   throw new AiExecutionError('AI_HISTORY_MESSAGE_LIMIT',409);
 const at=new Date().toISOString();
 const added:HistoryMessage[]=[
  {id:randomUUID(),role:'user',text:userText.slice(0,1000),at},
  {id:randomUUID(),role:'assistant',text:assistantText.slice(0,MAX_TEXT),at,status:meta.status,route:meta.route}
 ];
 t.messages.push(...added);t.updatedAt=at;
 const params=new URLSearchParams({'currentDocument.updateTime':current.updateTime});
 const r=await request(doc(access,id)+'?'+params.toString(),access,'PATCH',pack(access,t));
 if(r.status===409||r.status===412)throw new AiExecutionError('AI_HISTORY_CONFLICT',409);
 if(!r.ok)throw new AiExecutionError('AI_HISTORY_SAVE_FAILED',503);
}
export async function renameHistory(access:AiAccess,id:string,newTitle:string):Promise<void>{
 const current=await read(access,id);
 if(!current)throw new AiExecutionError('AI_HISTORY_NOT_FOUND',404);
 current.thread.title=title(newTitle);current.thread.updatedAt=new Date().toISOString();
 const params=new URLSearchParams({'currentDocument.updateTime':current.updateTime});
 const r=await request(doc(access,id)+'?'+params.toString(),access,'PATCH',pack(access,current.thread));
 if(r.status===409||r.status===412)throw new AiExecutionError('AI_HISTORY_CONFLICT',409);
 if(!r.ok)throw new AiExecutionError('AI_HISTORY_SAVE_FAILED',503);
}
export async function deleteHistory(access:AiAccess,id:string):Promise<void>{
 const current=await read(access,id);
 if(!current)throw new AiExecutionError('AI_HISTORY_NOT_FOUND',404);
 const params=new URLSearchParams({'currentDocument.updateTime':current.updateTime});
 const r=await request(doc(access,id)+'?'+params.toString(),access,'DELETE');
 if(r.status===409||r.status===412)throw new AiExecutionError('AI_HISTORY_CONFLICT',409);
 if(!r.ok)throw new AiExecutionError('AI_HISTORY_DELETE_FAILED',503);
}
