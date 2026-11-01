/** Fluxo autenticação -> W4 -> parser e autorização W3 -> resposta sem LLM. */
import {interpret,validateModelCandidate} from '../context';
import {aiLfm3Enabled} from './environment';
import {proposeWithLfm3} from './lfm3';
import {guardLfm3Candidate} from './lfm3Guard';
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
  responseMs:number;totalMs:number;examinedDocuments:number;qwenCalls:0;lfm3Calls:number};
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
 let lfm3Calls=0,modelAudit:AiAskPayload['filterAudit']|undefined;
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
   // The model only proposes; W5 validation, filter guard, W3 schema and
   // workspace-bound W3 executor remain the only authority.
   status='fallback_unavailable';
   answer='Não consegui interpretar esta consulta com segurança. Tente reformular a pergunta.';
   if(aiLfm3Enabled()&&interpreted.model){
     lfm3Calls=1;
     const proposed=await proposeWithLfm3(interpreted.model);
     if(proposed!==null){
       const candidate=validateModelCandidate(proposed,route);
       if(candidate){
         const decision=guardLfm3Candidate({
           query:candidate,interpretation:interpreted,message:args.input.message,previous
         });
         modelAudit=decision.audit;
         if(decision.ok){
           try {
             const validationStart=Date.now();
             const validated=parseAiQuery(candidate);
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
           }catch(error){
             // W3 read errors are never turned into success or out-of-scope data.
             if(error instanceof AiInputError){
               query=undefined;status='clarify';
               answer='Preciso de uma identificação mais precisa para consultar estes dados.';
             }else throw error;
           }
         }else{
           status='clarify';
           answer='Há filtros ou identificadores que não posso confirmar. Reformule a consulta com os dados necessários.';
         }
       }else{
         status='clarify';
         answer='A interpretação não corresponde aos contratos permitidos. Reformule a consulta.';
       }
     }
   }
 }else{
   status='out_of_scope';answer='Posso consultar informações operacionais do EMPROVEX, dentro dos contratos disponíveis.';
 }
 const payload:AiAskPayload={version:'emprovex.ai.ask.v1',status,route,intent:interpreted.intent,
   answer,reason:interpreted.reason,...(query?{query}:{}),...(result?{result}:{}),
   ...(contextToken?{contextToken}:{}),
   ...(modelAudit?{filterAudit:modelAudit}:
     interpreted.filterAudit?{filterAudit:interpreted.filterAudit}:{}),
   metrics:{authenticationMs,interpretationMs,contractValidationMs,w3ExecutionMs,responseMs,
     totalMs:Date.now()-start,examinedDocuments,qwenCalls:0,lfm3Calls}};
 return {payload,cookie:cookieState.cookie,setCookie:cookieState.newCookie};
}
