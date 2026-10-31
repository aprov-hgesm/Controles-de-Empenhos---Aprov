/** W4.5: sessao e contexto autenticados; sem armazenamento global ou banco novo. */
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {AiExecutionError} from '../response';
import type {ShortContext,ContextRefs} from '../context/types';

export const AI_SESSION_COOKIE='emprovex_ai_session';
const CONTEXT_TTL=10*60*1000,SESSION_TTL=2*60*60*1000;
type Session={uid:string;ws:string;sid:string;iat:number;exp:number};
type Context={uid:string;ws:string;sid:string;updatedAt:number;exp:number;refs:ContextRefs};
const allowedRefs=['commitmentId','materialQuery','supplierName','supplierCnpj'];
const ne=/^\d{4}NE\d{1,10}$/;
const safeText=/^[^<>\u0000-\u001f\u007f]{2,120}$/;
function key():string {
 const k=process.env.EMPROVEX_AI_W45_CONTEXT_SECRET||'';
 if(k.length<32)throw new AiExecutionError('AI_CONTEXT_NOT_CONFIGURED',503);
 return k;
}
function signature(purpose:'session'|'context',body:string):Buffer {
 return createHmac('sha256',key()).update('W45:'+purpose+':'+body).digest();
}
function issue(purpose:'session'|'context',data:object):string {
 const body=Buffer.from(JSON.stringify(data)).toString('base64url');
 return body+'.'+signature(purpose,body).toString('base64url');
}
function read(purpose:'session'|'context',token:string):Record<string,unknown> {
 if(typeof token!=='string'||token.length>4096||!token||!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(token))
   throw new AiExecutionError('AI_CONTEXT_FORBIDDEN',403);
 const [body,sig]=token.split('.');
 const expected=signature(purpose,body);
 const provided=Buffer.from(sig,'base64url');
 if(expected.length!==provided.length||!timingSafeEqual(expected,provided))
   throw new AiExecutionError('AI_CONTEXT_FORBIDDEN',403);
 try {
   const parsed=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('shape');
   return parsed as Record<string,unknown>;
 }catch {throw new AiExecutionError('AI_CONTEXT_FORBIDDEN',403);}
}
function validSession(v:Record<string,unknown>,uid:string,ws:string,now:number):v is Session {
 return v.uid===uid&&v.ws===ws&&typeof v.sid==='string'&&/^[a-f0-9]{32}$/.test(v.sid)&&
   typeof v.iat==='number'&&Number.isFinite(v.iat)&&v.iat<=now+30000&&
   typeof v.exp==='number'&&v.exp>now&&v.exp-v.iat<=SESSION_TTL;
}
export function sessionForRequest(cookie:string|undefined,uid:string,ws:string,now=Date.now()):
 {session:Session;cookie:string;newCookie:boolean} {
 if(cookie){
   try{
     const decoded=read('session',cookie);
     if(validSession(decoded,uid,ws,now))return {session:decoded,cookie,newCookie:false};
   }catch{/* cookies perdidos/invalidos nao se tornam autoridade */ }
 }
 const session:Session={uid,ws,sid:randomBytes(16).toString('hex'),iat:now,exp:now+SESSION_TTL};
 return {session,cookie:issue('session',session),newCookie:true};
}
function validRefs(value:unknown):value is ContextRefs {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const o=value as Record<string,unknown>,keys=Object.keys(o);
 return keys.length<=4&&keys.every(k=>allowedRefs.includes(k)&&typeof o[k]==='string'&&
   (k==='commitmentId'?ne.test(o[k] as string):k==='supplierCnpj'?/^\d{14}$/.test(o[k] as string):safeText.test(o[k] as string)));
}
/** Invalidar alteracoes e uso entre sessoes; expirado => contexto vazio, sem leitura. */
export function restoreContext(token:string|undefined,session:Session,now=Date.now()):ShortContext|undefined {
 if(!token)return undefined;
 const c=read('context',token);
 if(c.uid!==session.uid||c.ws!==session.ws||c.sid!==session.sid)
   throw new AiExecutionError('AI_CONTEXT_FORBIDDEN',403);
 if(typeof c.exp!=='number'||!Number.isFinite(c.exp)||typeof c.updatedAt!=='number'||
   !Number.isFinite(c.updatedAt)||c.updatedAt>now+30000||c.exp-c.updatedAt>CONTEXT_TTL||
   !validRefs(c.refs))
   throw new AiExecutionError('AI_CONTEXT_FORBIDDEN',403);
 if(c.exp<=now||now-c.updatedAt>CONTEXT_TTL)return undefined;
 return {sessionId:session.sid,workspaceId:session.ws,updatedAt:c.updatedAt,refs:c.refs};
}
export function sealContext(context:ShortContext,session:Session,now=Date.now()):string {
 if(context.sessionId!==session.sid||context.workspaceId!==session.ws||
   !validRefs(context.refs)||!Number.isFinite(context.updatedAt)||
   context.updatedAt>now+30000||now-context.updatedAt>CONTEXT_TTL)
   throw new AiExecutionError('AI_CONTEXT_INVALID',503);
 const payload:Context={uid:session.uid,ws:session.ws,sid:session.sid,updatedAt:context.updatedAt,
   exp:context.updatedAt+CONTEXT_TTL,refs:context.refs};
 return issue('context',payload);
}
