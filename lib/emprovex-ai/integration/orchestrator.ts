/** Fluxo autenticação -> W4 -> parser e autorização W3 -> resposta sem LLM. */
import {interpret} from '../context';
import {parseAiQuery,AiInputError,type AiResponse} from '../contracts';
import {prepareAiAccess} from '../authorize';
import {executeAuthorizedAiQuery} from '../query';
import {AiExecutionError} from '../response';
import {sessionForRequest,restoreContext,sealContext} from './session';
import {presentAiResponse} from './response';

export type AiAskInput={message:string;contextToken?:string};
export type AiAskPayload={
 version:'emprovex.ai.ask.v1';status:'ok'|'partial'|'empty'|'ambiguous'|'clarify'|'unsupported'|'rejected'|'out_of_scope'|'fallback_unavailable';
 route:string;intent:string;answer:string;reason:string;
 query?:{version:string;intent:string;params:Record<string,unknown>};
 result?:AiResponse;contextToken?:string;filterAudit?:{requested:string[];represented:string[];unhandled:string[]};
 metrics:{authenticationMs:number;interpretationMs:number;contractValidationMs:number;w3ExecutionMs:number;
  responseMs:number;totalMs:number;examinedDocuments:number;qwenCalls:0};
};
export function parseAskInput(input:unknown):AiAskInput {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new AiInputError('AI_INVALID_OBJECT');
 const p=input as Record<string,unknown>;
 if(Object.keys(p).some(k=>!['message','contextToken'].includes(k)))throw new AiInputError('AI_UNEXPECTED_PARAMETER');
 if(typeof p.message!=='string'||!p.message.trim()||p.message.length>1000)
   throw new AiInputError('AI_INVALID_MESSAGE');
 if(p.contextToken!==undefined&&(typeof p.contextToken!=='string'||p.contextToken.length>4096))
   throw new AiInputError('AI_CONTEXT_INVALID');
 return {message:p.message,...(p.contextToken!==undefined?{contextToken:p.contextToken as string}:{})};
}
export async function runAiAsk(args:{
 authorization:string|null;input:AiAskInput;sessionCookie?:string;now?:Date;
}):Promise<{payload:AiAskPayload;cookie:string;setCookie:boolean}>{
 const start=Date.now(),now=args.now||new Date();
 // Autorização de identidade, vinculo workspace/UG e billing antes de qualquer consulta operacional.
 const access=await prepareAiAccess(args.authorization);
 const authenticationMs=Date.now()-start;
 const cookieState=sessionForRequest(args.sessionCookie,access.uid,access.workspaceId,now.getTime());
 const previous=restoreContext(args.input.contextToken,cookieState.session,now.getTime());
 const interpreted=interpret({message:args.input.message,now,
   scope:{sessionId:cookieState.session.sid,workspaceId:access.workspaceId},previous});
 const interpretationMs=interpreted.metrics.durationMs;
 let contractValidationMs=0,w3ExecutionMs=0,responseMs=0,examinedDocuments=0;
 let status:AiAskPayload['status'],answer:string;
 let result:AiResponse|undefined,query:AiAskPayload['query'],contextToken:string|undefined;
 const route=interpreted.route;
 if(route==='DETERMINISTIC'){
   // Nenhum filtro solicitado pode desaparecer na fronteira W4 -> W3.
   const audit=interpreted.filterAudit;
   if(!audit||audit.unhandled.length||audit.requested.some(x=>!audit.represented.includes(x)))
     throw new AiExecutionError('AI_FILTER_GUARD_BLOCKED',422);
   if(!interpreted.query)throw new AiExecutionError('AI_W4_QUERY_MISSING',422);
   const validationStart=Date.now();
   const validated=parseAiQuery(interpreted.query);
   contractValidationMs=Date.now()-validationStart;
   query=validated;
   const executionStart=Date.now();
   result=await executeAuthorizedAiQuery(access,validated);
   w3ExecutionMs=Date.now()-executionStart;
   examinedDocuments=result.metrics.examinedDocuments;
   const presentationStart=Date.now();
   answer=presentAiResponse(result);
   responseMs=Date.now()-presentationStart;
   status=result.status==='ok'?'ok':result.status==='partial'?'partial':
     result.status==='empty'?'empty':result.status==='ambiguous'?'ambiguous':'rejected';
   if(status==='ok'&&interpreted.nextContext)
     contextToken=sealContext(interpreted.nextContext,cookieState.session,now.getTime());
 }else if(route==='CLARIFY'){
   status='clarify';answer=interpreted.question||'Poderia esclarecer a identificação da consulta?';
   if(interpreted.nextContext)contextToken=sealContext(interpreted.nextContext,cookieState.session,now.getTime());
 }else if(route==='UNSUPPORTED'){
   status='unsupported';answer='Esta consulta ainda não está disponível nos contratos operacionais desta fase.';
 }else if(route==='REJECT_MUTATION'){
   status='rejected';answer='O EMPROVEX AI desta fase realiza apenas consultas, sem alterar registros.';
 }else if(route==='MODEL_ELIGIBLE'){
   status='fallback_unavailable';answer='Esta solicitação exige interpretação adicional, ainda indisponível nesta fase sem modelo generativo.';
 }else{
   status='out_of_scope';answer='Posso consultar informações operacionais do EMPROVEX, dentro dos contratos disponíveis.';
 }
 const payload:AiAskPayload={version:'emprovex.ai.ask.v1',status,route,intent:interpreted.intent,
   answer,reason:interpreted.reason,...(query?{query}:{}),...(result?{result}:{}),
   ...(contextToken?{contextToken}:{}),
   ...(interpreted.filterAudit?{filterAudit:interpreted.filterAudit}:{}),
   metrics:{authenticationMs,interpretationMs,contractValidationMs,w3ExecutionMs,responseMs,
     totalMs:Date.now()-start,examinedDocuments,qwenCalls:0}};
 return {payload,cookie:cookieState.cookie,setCookie:cookieState.newCookie};
}
