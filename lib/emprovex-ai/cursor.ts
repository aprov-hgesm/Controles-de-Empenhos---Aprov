/** Cursor autenticado, com expiração e escopo. Falha fechada sem segredo server-side. */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AiInputError } from './contracts';
import type { AiAccess } from './authorize';
type CursorPayload={uid:string;ws:string;intent:string;fingerprint:string;
  id:string;value:string;exp:number};
function key():string {
  const secret=process.env.EMPROVEX_AI_CURSOR_SECRET||'';
  if(secret.length<32)throw new AiInputError('AI_PAGINATION_NOT_CONFIGURED',503);
  return secret;
}
function fingerprint(filters:Record<string,unknown>):string {
  const ordered=Object.fromEntries(Object.entries(filters).filter(([k])=>k!=='cursor').sort(([a],[b])=>a.localeCompare(b)));
  return createHmac('sha256',key()).update(JSON.stringify(ordered)).digest('hex');
}
export function makeAiCursor(access:AiAccess,intent:string,filters:Record<string,unknown>,
  id:string,value=''):string|null {
  if((process.env.EMPROVEX_AI_CURSOR_SECRET||'').length<32)return null;
  const payload:CursorPayload={uid:access.uid,ws:access.workspaceId,intent,fingerprint:fingerprint(filters),
    id,value,exp:Date.now()+10*60*1000};
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig=createHmac('sha256',key()).update(body).digest('base64url');
  return body+'.'+sig;
}
export function parseAiCursor(value:string,access:AiAccess,intent:string,
  filters:Record<string,unknown>):{id:string;fieldValue:string} {
  const [body,sig,extra]=value.split('.');
  if(!body||!sig||extra)throw new AiInputError('AI_CURSOR_INVALID');
  const mac=createHmac('sha256',key()).update(body).digest();
  let expected:Buffer;
  try{expected=Buffer.from(sig,'base64url');}
  catch{throw new AiInputError('AI_CURSOR_INVALID');}
  if(mac.length!==expected.length||!timingSafeEqual(mac,expected))
    throw new AiInputError('AI_CURSOR_FORBIDDEN',403);
  let cursor:CursorPayload;
  try{cursor=JSON.parse(Buffer.from(body,'base64url').toString('utf8')) as CursorPayload;}
  catch{throw new AiInputError('AI_CURSOR_INVALID');}
  if(cursor.uid!==access.uid||cursor.ws!==access.workspaceId||cursor.intent!==intent
    ||cursor.fingerprint!==fingerprint(filters)||cursor.exp<Date.now()
    ||typeof cursor.id!=='string'||!/^[A-Za-z0-9_-]{1,130}$/.test(cursor.id)
    ||typeof cursor.value!=='string'||cursor.value.length>64)
    throw new AiInputError('AI_CURSOR_FORBIDDEN',403);
  return {id:cursor.id,fieldValue:cursor.value};
}
