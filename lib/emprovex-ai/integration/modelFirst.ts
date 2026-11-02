/** R3: LFM3 interprets first. Never accepts permissions, reads Firestore, or calls W3.
 * A proposed query is untrusted until W5 guards + W3 contract and identity authorization.
 */
import {aiLfm3Enabled} from './environment';
import type {Lfm3Outcome} from './lfm3';
import type {ContextRefs} from '../context/types';
export type ModelFirstDecision=
 |{kind:'operational';intent:string;params:Record<string,unknown>}
 |{kind:'conversation';answer:string}
 |{kind:'unsupported';answer:string};
export type ModelFirstOutcome=Lfm3Outcome|'model_operational'|'model_conversation'|'model_unsupported';
export type ModelFirstReporter=(outcome:ModelFirstOutcome)=>void;
const MODEL='lfm3:1.7b-q4_K_M';
const MAX_BODY=12000;
function origin():string|null {
 const value=process.env.EMPROVEX_AI_LFM3_URL;
 if(!value)return null;
 try {
  const u=new URL(value);
  return u.protocol==='https:'&&u.hostname.endsWith('.run.app')&&!u.username&&!u.password&&
   !u.port&&u.pathname==='/'&&!u.search&&!u.hash?u.origin:null;
 }catch{return null;}
}
function parseObject(value:string):Record<string,unknown>|null{
 try {const v:unknown=JSON.parse(value);return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;}
 catch{return null;}
}
const kinds=['operational','conversation','unsupported'];
export async function interpretFirstWithLfm3(message:string,context:ContextRefs={},report?:ModelFirstReporter):Promise<ModelFirstDecision|null> {
 const reject=(outcome:ModelFirstOutcome):null=>{report?.(outcome);return null;};
 if(!aiLfm3Enabled()||!message.trim()||message.length>1000)return reject('disabled');
 const url=origin();if(!url)return reject('url_invalid');
 try{
  const meta=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience='+
   encodeURIComponent(url)+'&format=full',{cache:'no-store',headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(1800)});
  if(!meta.ok)return reject('identity_unavailable');
  const token=(await meta.text()).trim();
  if(token.length>16000||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return reject('identity_invalid');
  const response=await fetch(url+'/api/chat',{
   method:'POST',cache:'no-store',
   headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({
    model:MODEL,stream:false,think:false,
    format:{type:'object',additionalProperties:false,required:['kind','intent','params','answer'],properties:{
     kind:{type:'string',enum:kinds},intent:{type:'string'},params:{type:'object'},answer:{type:'string'}}},
    options:{temperature:0.1,num_predict:320},
    messages:[
     {role:'system',content:
       'Você é Eleonor, a assistente do EMPROVEX. Classifique TODA pergunta antes de agir. '+
       'Devolva SOMENTE JSON com kind, intent, params e answer. '+
       'kind=operational se o usuário quer consultar saldos, empenhos, fornecedores, notas fiscais, cronogramas ou estoques do sistema: '+
       'use uma intenção permitida e os parâmetros explícitos na pergunta (sem criar números, nomes ou filtros), answer vazio. '+
       'Exemplo: pergunta Detalhe o fornecedor Alfa -> {"kind":"operational","intent":"supplier_contact_find","params":{"nameQuery":"Alfa"},"answer":""}. '+
       'kind=conversation para conversa, explicação geral, criação e revisão de textos; forneça answer em português com no máximo 900 caracteres, intent vazio, params vazio. '+
       'kind=unsupported se pedirem modificar dados, informações privadas, saldos sem consulta, fatos atuais sem fonte, ou ação fora das ferramentas. '+
       'Não alegue ter acesso a dados, registros, fontes ou ações executadas. Nunca invente resultados do EMPROVEX. '+
       'Se o usuário pedir ajuda sobre uma função do sistema, não invente passo a passo; peça a tela/funcionalidade ou fonte aprovada. '+
       'Responda com clareza e personalidade profissional discreta.'},
     {role:'user',content:JSON.stringify({question:message,context,allowedIntents:[
      'supplier_contact_find','commitment_get','commitment_total_balance',
      'commitment_previous_open_list','schedule_sent_history_list',
      'invoice_registration_period_list','invoice_operational_pending_list',
      'warehouse_stock_get','warehouse_material_locations_list']})}
    ]
   }),signal:AbortSignal.timeout(30000)});
  if(!response.ok)return reject('model_http_error');
  const raw=await response.text();if(raw.length>MAX_BODY)return reject('model_invalid_response');
  const envelope=parseObject(raw);if(!envelope)return reject('model_invalid_response');
  if(envelope.done_reason==='length')return reject('model_truncated');
  const msg=envelope.message;
  if(!msg||typeof msg!=='object'||Array.isArray(msg))return reject('model_invalid_response');
  const text=(msg as Record<string,unknown>).content;
  if(typeof text!=='string'||text.length>MAX_BODY)return reject('model_invalid_response');
  const value=parseObject(text);
  if(!value||!kinds.includes(String(value.kind))||
    typeof value.intent!=='string'||typeof value.answer!=='string'||
    !value.params||typeof value.params!=='object'||Array.isArray(value.params))return reject('model_invalid_response');
  if(value.kind==='operational'){
   report?.('model_operational');
   return {kind:'operational',intent:value.intent,params:value.params as Record<string,unknown>};
  }
  if(value.answer.length>900||!value.answer.trim())return reject('model_invalid_response');
  const answer=value.answer.replace(/[<>\u0000-\u001f\u007f]/g,'').trim();
  if(!answer)return reject('model_invalid_response');
  report?.(value.kind==='conversation'?'model_conversation':'model_unsupported');
  return value.kind==='conversation'?{kind:'conversation',answer}:{kind:'unsupported',answer};
 }catch(error){
  // Never emit tokens, prompts or model text. Distinguish timeout from other failures.
  return reject(error instanceof Error && (error.name==='TimeoutError'||error.name==='AbortError')?'request_timeout':'request_failed');
 }
}
