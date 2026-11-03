/** Fluxo autenticação -> W4 -> parser e autorização W3 -> resposta sem LLM. */
import {interpret,validateModelCandidate} from '../context';
import {interpretFirstWithLfm3,type ModelFirstOutcome} from './modelFirst';
import {historyEnabled,createHistory,getHistory,appendHistory} from '../conversation/historyStore';
import {startClarification,continueClarification,startMaterialResolution} from './clarification';
import {aiLfm3Enabled,aiConversationalModelEnabled} from './environment';
import {planConversation} from '../conversation/engine';
import {proposeWithLfm3,respondConversationally,type Lfm3Outcome} from './lfm3';
import {guardLfm3Candidate} from './lfm3Guard';
import {parseAiQuery,AiInputError,type AiResponse} from '../contracts';
import {prepareAiAccess} from '../authorize';
import {executeAuthorizedAiQuery} from '../query';
import {AiExecutionError} from '../response';
import {sessionForRequest,restoreContext,sealContext} from './session';
import {presentAiResponse} from './response';

export type AiAskInput={message:string;contextToken?:string;conversationId?:string};
export type AiAskPayload={
 version:'emprovex.ai.ask.v1';status:'ok'|'partial'|'empty'|'ambiguous'|'clarify'|'unsupported'|'rejected'|'out_of_scope'|'fallback_unavailable';
 route:string;intent:string;answer:string;reason:string;
 conversationId?:string;
 historyStatus?:'saved'|'unavailable'|'disabled';
 query?:{version:string;intent:string;params:Record<string,unknown>};
 result?:AiResponse;contextToken?:string;filterAudit?:{requested:string[];represented:string[];unhandled:string[]};
 metrics:{authenticationMs:number;interpretationMs:number;contractValidationMs:number;w3ExecutionMs:number;
  responseMs:number;totalMs:number;historyMs:number;lfm3Ms:number;examinedDocuments:number;qwenCalls:0;lfm3Calls:number;
  modelFirstOutcome:'not_attempted'|'skipped_safe_writing'|ModelFirstOutcome;
  modelOutcome:'not_attempted'|Lfm3Outcome|'candidate_rejected'|'filter_rejected'|'query_accepted'};
};
export function parseAskInput(input:unknown):AiAskInput {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new AiInputError('AI_INVALID_OBJECT');
 const p=input as Record<string,unknown>;
 if(Object.keys(p).some(k=>!['message','contextToken','conversationId'].includes(k)))throw new AiInputError('AI_UNEXPECTED_PARAMETER');
 if(typeof p.message!=='string'||!p.message.trim()||p.message.length>1000)
   throw new AiInputError('AI_INVALID_MESSAGE');
 if(p.conversationId!==undefined&&
   (typeof p.conversationId!=='string'||! /^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(p.conversationId)))
   throw new AiInputError('AI_HISTORY_INVALID_ID');
 if(p.contextToken!==undefined&&(typeof p.contextToken!=='string'||p.contextToken.length>4096))
   throw new AiInputError('AI_CONTEXT_INVALID');
 return {message:p.message,...(p.contextToken!==undefined?{contextToken:p.contextToken as string}:{}),
 ...(p.conversationId!==undefined?{conversationId:p.conversationId as string}:{})};
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
 // History must never block AI inference or a valid W3 read on a storage outage.
 // Preserve 4xx owner/ID errors; fail soft only for storage/unavailable errors.
 const historyStart=Date.now();
 const historyActive=historyEnabled();
 let historyStatus:'saved'|'unavailable'|'disabled'=historyActive?'unavailable':'disabled';
 let conversationId=args.input.conversationId;
 let historyWritable=false;
 let createdHistory:Awaited<ReturnType<typeof createHistory>>|undefined;
 if(historyActive){
   try{
     if(conversationId)await getHistory(access,conversationId);
     else {createdHistory=await createHistory(access,args.input.message);
       conversationId=createdHistory.id;}
     historyWritable=true;
   }catch(error){
     if(args.input.conversationId && error instanceof AiExecutionError &&
        error.httpStatus>=400 && error.httpStatus<500)
       throw error; // An explicitly selected thread cannot silently switch identity.
     console.warn('emprovex_ai_history_unavailable',{
       phase:'prepare',code:error instanceof AiExecutionError?error.code:'AI_HISTORY_STORAGE_FAILURE'
     });
     conversationId=undefined;
   }
 }
 let historyMs=historyActive?Date.now()-historyStart:0;
 // W4 is an immutable safety preflight, never the authority for unknown language.
 // Harmless writing bypasses a redundant model classification to save CPU and latency.
 // Every operational request still reaches the LFM3 classifier before W5/W3 execution.
 const interpreted=interpret({message:args.input.message,now,
   scope:{sessionId:cookieState.session.sid,workspaceId:access.workspaceId},previous});
 const interpretationMs=interpreted.metrics.durationMs;
 // A user reply to a typed, signed clarification is a continuation, not a new
 // natural-language query. Always let W4 security veto attempted mutations.
 const unsafeReply=interpreted.route==='REJECT_MUTATION'||
   interpreted.route==='UNSUPPORTED'||
   ['UNTRUSTED_INSTRUCTION','CLIENT_SCOPE_OVERRIDE_FORBIDDEN'].includes(interpreted.reason);
 const priorClarification=previous?.pending&&!unsafeReply
   ?continueClarification(previous.pending,args.input.message):null;
 const clarification=priorClarification?.kind==='new_request'
   ?startClarification(interpreted,args.input.message)
   :priorClarification||startClarification(interpreted,args.input.message);
 const conversation=planConversation({message:args.input.message,
   operational:{route:interpreted.route,reason:interpreted.reason,intent:interpreted.intent},
   previous:previous?.conversation,now});
 const operationalSignal=/\b(?:empenho|empenhos|fornecedor|fornecedores|nota fiscal|notas fiscais|nf|nfs|estoque|deposito|material|materiais|cronograma|saldo|ug|siafi|siscofis|pagamento|financeiro|cadastro|fatura)\b/i.test(args.input.message);
 const safeCreativeWriting=conversation?.modelEligible===true && conversation.family==='writing' &&
   !operationalSignal && conversation.mode!=='critical' &&
   !/\b(?:com dados|dados do|saldo|valores?|empenhos?|notas? fiscais?|movimentacoes?|extrato|pagamento|senha|token|cpf|cnpj|conta bancaria|dados pessoais)\b/i.test(args.input.message);
 const directWriter=process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED==='1' &&
   safeCreativeWriting&&aiConversationalModelEnabled();
 const modelFirstAttempted=process.env.EMPROVEX_AI_R3_MODEL_FIRST_ENABLED==='1'&&
   aiLfm3Enabled()&&!directWriter&&!clarification&&
   // W4 already resolved a safe query or blocked a mutation: skip costly reclassification.
   !['DETERMINISTIC','REJECT_MUTATION','UNSUPPORTED'].includes(interpreted.route);
 let modelFirstOutcome:AiAskPayload['metrics']['modelFirstOutcome']=directWriter?'skipped_safe_writing':'not_attempted';
 const modelStart=Date.now();
 const modelFirst=modelFirstAttempted?await interpretFirstWithLfm3(
   args.input.message,previous?.refs,(outcome)=>{modelFirstOutcome=outcome}
 ):null;
 let lfm3Ms=modelFirstAttempted?Date.now()-modelStart:0;
 // The following diagnostics contain only constant outcome codes, not model text or tokens.
 if(modelFirstAttempted && modelFirst && modelFirstOutcome==='not_attempted')
   modelFirstOutcome=modelFirst.kind==='operational'?'model_operational':
     modelFirst.kind==='conversation'?'model_conversation':'model_unsupported';
 let contractValidationMs=0,w3ExecutionMs=0,responseMs=0,examinedDocuments=0;
 let status:AiAskPayload['status'],answer:string;
 let result:AiResponse|undefined,query:AiAskPayload['query'],contextToken:string|undefined;
 let lfm3Calls=modelFirstAttempted?1:0,modelAudit:AiAskPayload['filterAudit']|undefined;
 let modelOutcome:AiAskPayload['metrics']['modelOutcome']='not_attempted';
 if(modelFirst)modelOutcome=modelFirst.kind==='operational'?'model_json_received':
   modelFirst.kind==='conversation'?'model_answer_accepted':'candidate_rejected';
 const recordModelOutcome=(outcome:Lfm3Outcome)=>{modelOutcome=outcome;};
 const highRiskRoute=['UNSUPPORTED','REJECT_MUTATION'].includes(interpreted.route);
 const modelOperational=modelFirst?.kind==='operational' && !highRiskRoute && interpreted.route!=='DETERMINISTIC' &&
   (operationalSignal||interpreted.route==='MODEL_ELIGIBLE');
 const modelConversation=modelFirst?.kind==='conversation' &&
   (safeCreativeWriting||(!operationalSignal &&
     !['DETERMINISTIC','MODEL_ELIGIBLE','UNSUPPORTED','REJECT_MUTATION'].includes(interpreted.route))) &&
   conversation?.mode!=='critical' &&
   !/\b(?:senha|token|cpf|cnpj|conta bancaria|dados pessoais|invadir|fraudar|falsificar|roubar)\b/i.test(args.input.message);
 const route=clarification?.kind==='ready'?'DETERMINISTIC':
   clarification?'CLARIFY':
   modelConversation?'CONVERSATIONAL':modelOperational?'MODEL_ELIGIBLE':
   conversation?'CONVERSATIONAL':interpreted.route;
 if(modelConversation){
   status='ok';answer=modelFirst!.kind==='conversation'?modelFirst.answer:'';
   lfm3Calls=1;
   contextToken=sealContext({
     sessionId:cookieState.session.sid,workspaceId:access.workspaceId,
     updatedAt:now.getTime(),refs:{},
     conversation:{topic:'general',intent:'model_response'}
   },cookieState.session,now.getTime());
 }else if(conversation&&route==='CONVERSATIONAL'){
   // No W3 queries, authorizations, cached results or operational references
   // are exported through a conversation. Only a typed topic is retained.
   status=conversation.status;answer=conversation.answer;
   if(conversation.modelEligible&&aiConversationalModelEnabled()&&(!modelFirstAttempted||!modelFirst)){
     lfm3Calls=1;
     const generationStart=Date.now();
     const generated=await respondConversationally(args.input.message,recordModelOutcome);
     lfm3Ms+=Date.now()-generationStart;
     if(generated){answer=generated;status='ok';}
   }
   contextToken=sealContext({
     sessionId:cookieState.session.sid,workspaceId:access.workspaceId,
     updatedAt:now.getTime(),refs:{},
     conversation:{topic:conversation.topic,intent:conversation.intent}
   },cookieState.session,now.getTime());
 }else if(route==='DETERMINISTIC'){
   // A resumed query is constructed solely from validated slots in a sealed
   // context; both paths still require strict W3 schema + authorization.
   if(clarification?.kind!=='ready'){
     const audit=interpreted.filterAudit;
     if(!audit||audit.unhandled.length||audit.requested.some(x=>!audit.represented.includes(x)))
       throw new AiExecutionError('AI_FILTER_GUARD_BLOCKED',422);
     if(!interpreted.query)throw new AiExecutionError('AI_W4_QUERY_MISSING',422);
   }
   const validationStart=Date.now();
   const validated=parseAiQuery(clarification?.kind==='ready'?clarification.query:interpreted.query);
   contractValidationMs=Date.now()-validationStart;
   query=validated;
   const executionStart=Date.now();
   try{
     result=await executeAuthorizedAiQuery(access,validated);
   }catch(error){
     if(clarification?.kind==='ready'&&previous?.pending?.kind==='commitment_item_balance'&&
        error instanceof AiExecutionError&&error.code==='AI_ITEM_NOT_FOUND'){
       // A wrong user-supplied itemId is never reported as a legitimate zero balance.
       status='clarify';
       answer='Esse itemId não foi encontrado na NE informada. Confira o código do item e informe o itemId correto.';
       contextToken=sealContext({
         sessionId:cookieState.session.sid,workspaceId:access.workspaceId,
         updatedAt:now.getTime(),refs:{},
         pending:{...previous.pending,step:'item'}
       },cookieState.session,now.getTime());
     }else throw error;
   }
   w3ExecutionMs=Date.now()-executionStart;
   if(result){
     examinedDocuments=result.metrics.examinedDocuments;
     const presentationStart=Date.now();
     answer=presentAiResponse(result);
     responseMs=Date.now()-presentationStart;
     status=result.status==='ok'?'ok':result.status==='partial'?'partial':
       result.status==='empty'?'empty':result.status==='ambiguous'?'ambiguous':'rejected';
     if(status==='ok'&&interpreted.nextContext&&clarification?.kind!=='ready')
       contextToken=sealContext(interpreted.nextContext,cookieState.session,now.getTime());
     if(clarification?.kind==='ready'&&status==='ok')
       contextToken=sealContext({
         sessionId:cookieState.session.sid,workspaceId:access.workspaceId,
         updatedAt:now.getTime(),refs:{
           ...(typeof validated.params.commitmentId==='string'?{commitmentId:validated.params.commitmentId}:{}),
           ...(typeof validated.params.materialQuery==='string'?{materialQuery:validated.params.materialQuery}:{})
         }
       },cookieState.session,now.getTime());
     if(clarification?.kind==='ready'&&result.status==='empty'&&
        validated.intent==='commitment_total_balance'){
       status='clarify';
       answer='Não encontrei essa NE nos registros autorizados. Confira o número e informe a NE completa.';
       contextToken=sealContext({
         sessionId:cookieState.session.sid,workspaceId:access.workspaceId,
         updatedAt:now.getTime(),refs:{},
         pending:{
           kind:previous?.pending?.kind==='commitment_item_balance'?'commitment_item_balance':'commitment_balance',
           step:'ne',
           ...(previous?.pending?.materialLabel?{materialLabel:previous.pending.materialLabel}:{})
         }
       },cookieState.session,now.getTime());
     }
   }
 }else if(route==='CLARIFY'){
   if(clarification?.kind==='cancel'){
     status='ok';answer='Consulta cancelada. Pode fazer uma nova pergunta quando desejar.';
   }else if(clarification?.kind==='question'){
     status='clarify';answer=clarification.question;
     contextToken=sealContext({
       sessionId:cookieState.session.sid,workspaceId:access.workspaceId,
       updatedAt:now.getTime(),refs:{},pending:clarification.pending
     },cookieState.session,now.getTime());
   }else{
     status='clarify';answer=interpreted.question||'Poderia esclarecer a identificação da consulta?';
     if(interpreted.nextContext)contextToken=sealContext(interpreted.nextContext,cookieState.session,now.getTime());
   }
 }else if(route==='UNSUPPORTED'){
   status='unsupported';answer='Esta consulta ainda não está disponível nos contratos operacionais desta fase.';
 }else if(route==='REJECT_MUTATION'){
   status='rejected';answer='O EMPROVEX AI desta fase realiza apenas consultas, sem alterar registros.';
 }else if(route==='MODEL_ELIGIBLE'){
   // The model only proposes; W5 validation, filter guard, W3 schema and
   // workspace-bound W3 executor remain the only authority.
   status='fallback_unavailable';
   answer='Não consegui interpretar esta consulta com segurança. Tente reformular a pergunta.';
   if(aiLfm3Enabled()&&(modelOperational||(!modelFirstAttempted&&interpreted.model))){
     lfm3Calls=1;
     const proposalStart=Date.now();
     const proposed=modelOperational&&modelFirst?.kind==='operational'?{intent:modelFirst.intent,params:modelFirst.params}:
       await proposeWithLfm3(interpreted.model!,recordModelOutcome);
     if(!modelOperational)lfm3Ms+=Date.now()-proposalStart;
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
             modelOutcome='query_accepted';
           }catch(error){
             // W3 read errors are never turned into success or out-of-scope data.
             if(error instanceof AiInputError){
               query=undefined;status='clarify';
               answer='Preciso de uma identificação mais precisa para consultar estes dados.';
             }else throw error;
           }
         }else{
           modelOutcome='filter_rejected';
           status='clarify';
           answer='Há filtros ou identificadores que não posso confirmar. Reformule a consulta com os dados necessários.';
         }
       }else{
         modelOutcome='candidate_rejected';
         status='clarify';
         answer='A interpretação não corresponde aos contratos permitidos. Reformule a consulta.';
       }
     }
   }
 }else{
   status='out_of_scope';answer='Posso consultar informações operacionais do EMPROVEX, dentro dos contratos disponíveis.';
 }
 // If the user supplied an itemId to answer a question about a named material,
 // do not return a balance for an unrelated item. W3 is the source of the description.
 if(result&&result.status==='ok'&&clarification?.kind==='ready'&&
   previous?.pending?.kind==='commitment_item_balance'&&previous.pending.materialLabel){
   const data=result.data;
   const record=data&&typeof data==='object'&&!Array.isArray(data)?
     data as Record<string,unknown>:null;
   const items=Array.isArray(record?.items)?record.items:[];
   const first=items[0];
   const actual=first&&typeof first==='object'&&!Array.isArray(first)?
     (first as Record<string,unknown>).description:undefined;
   if(typeof actual==='string'&&actual.trim()){
     const normalized=(x:string)=>x.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')
       .toLocaleLowerCase('pt-BR').trim();
     const expectedName=normalized(previous.pending.materialLabel);
     const actualName=normalized(actual);
     if(!actualName.includes(expectedName)&&!expectedName.includes(actualName)){
       status='clarify';
       answer='O itemId informado pertence a um item diferente do material solicitado. Confira o itemId correspondente e informe o código correto.';
       result=undefined;
       contextToken=sealContext({
         sessionId:cookieState.session.sid,workspaceId:access.workspaceId,
         updatedAt:now.getTime(),refs:{},pending:{...previous.pending,step:'item'}
       },cookieState.session,now.getTime());
     }
   }
 }
 // A genuinely ambiguous or unresolved warehouse material requires a canonical
 // identifier; never silently assume zero from partial catalogue coverage.
 if(query&&result&&
    (result.status==='ambiguous'||(result.status==='partial'&&result.data===null))){
   const refinement=startMaterialResolution(query.intent,query,result.status,result.coverage);
   if(refinement?.kind==='question'){
     status='clarify';answer=refinement.question;
     contextToken=sealContext({
       sessionId:cookieState.session.sid,workspaceId:access.workspaceId,
       updatedAt:now.getTime(),refs:{},pending:refinement.pending
     },cookieState.session,now.getTime());
   }
 }
 const payload:AiAskPayload={version:'emprovex.ai.ask.v1',status,route,intent:conversation?.intent||interpreted.intent,
   answer,reason:conversation?.reason||interpreted.reason,...(query?{query}:{}),...(result?{result}:{}),
   ...(contextToken?{contextToken}:{}),
   ...(modelAudit?{filterAudit:modelAudit}:
     interpreted.filterAudit?{filterAudit:interpreted.filterAudit}:{}),
   metrics:{authenticationMs,interpretationMs,contractValidationMs,w3ExecutionMs,responseMs,
     totalMs:Date.now()-start,historyMs,lfm3Ms,examinedDocuments,qwenCalls:0,lfm3Calls,modelFirstOutcome,modelOutcome}};
 if(historyActive && historyWritable && conversationId){
    const appendStart=Date.now();
    try{
      await appendHistory(access,conversationId,args.input.message,answer,{status,route},createdHistory);
      historyStatus='saved';
      payload.conversationId=conversationId;
    }catch(error){
      // The model/W3 answer has already succeeded: an audit-store outage must
      // be clearly disclosed, but must not discard the answer.
      console.warn('emprovex_ai_history_unavailable',{
        phase:'append',code:error instanceof AiExecutionError?error.code:'AI_HISTORY_STORAGE_FAILURE'
      });
    }
    historyMs+=Date.now()-appendStart;
  }
  payload.historyStatus=historyStatus;
  payload.metrics.historyMs=historyMs;
  payload.metrics.totalMs=Date.now()-start;
  // Safe diagnostic summary: no query parameters, answers, identifiers or user text.
  console.info('emprovex_ai_ask_perf',{
    route,status,totalMs:payload.metrics.totalMs,w4Ms:interpretationMs,
    lfm3Ms,historyMs,w3Ms:w3ExecutionMs,lfm3Calls,examinedDocuments,
    outcome:modelOutcome
  });
  return {payload,cookie:cookieState.cookie,setCookie:cookieState.newCookie};
}
