/** Private Cloud Run-only LFM3 interpreter. Never authorizes Firestore reads.
 * No private JSON keys: Cloud Run metadata issues an audience-bound IAM ID token.
 */
import type {ModelProposal} from '../context/types';
import {aiLfm3Enabled,aiConversationalModelEnabled} from './environment';

const MODEL='lfm3:1.7b-q4_K_M';
const OUTPUT_TOKENS=128;
const MAX_RESPONSE_CHARS=8192;
const METADATA_TIMEOUT_MS=1800;
const INFERENCE_TIMEOUT_MS=8000;

function inferenceOrigin(raw:string|undefined):string|null {
 if(!raw)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.run.app')||
     url.username||url.password||url.port||url.pathname!=='/'||
     url.search||url.hash)return null;
  return url.origin;
 }catch{return null;}
}
function metadataUrl(audience:string):string {
 return 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience='+
   encodeURIComponent(audience)+'&format=full';
}
function validToken(token:string):boolean {
 return token.length<16000&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}
/** Response is not trusted even after JSON mode. Caller MUST use W5 + W3 validators. */
export async function proposeWithLfm3(proposal:ModelProposal):Promise<unknown|null> {
 if(!aiLfm3Enabled())return null;
 const origin=inferenceOrigin(process.env.EMPROVEX_AI_LFM3_URL);
 if(!origin)return null;
 try{
  const metadata=await fetch(metadataUrl(origin),{
   headers:{'Metadata-Flavor':'Google'},
   signal:AbortSignal.timeout(METADATA_TIMEOUT_MS),cache:'no-store'
  });
  if(!metadata.ok)return null;
  const token=(await metadata.text()).trim();
  if(!validToken(token))return null;
  const response=await fetch(origin+'/api/chat',{
   method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({
    model:MODEL,stream:false,think:false,
    format:{type:'object',additionalProperties:false,required:['intent','params'],
      properties:{intent:{type:'string',enum:[...proposal.allowedIntents]},
       params:{type:'object'}}},
    options:{temperature:0,num_predict:Math.min(proposal.maxOutputTokens,OUTPUT_TOKENS)},
    messages:[
     {role:'system',content:'Você interpreta exclusivamente consultas operacionais do EMPROVEX. Responda SOMENTE JSON com duas chaves: intent (uma das intenções permitidas) e params (objeto). Não invente identificadores, filtros nem dados. Não execute ações. Se não houver interpretação segura, use intent inválido para recusa. Respeite integralmente todas as restrições da pergunta.'},
     {role:'user',content:JSON.stringify({question:proposal.userText,context:proposal.context,allowedIntents:proposal.allowedIntents})}
    ]
   }),
   signal:AbortSignal.timeout(INFERENCE_TIMEOUT_MS),cache:'no-store'
  });
  if(!response.ok)return null;
  const raw=await response.text();
  if(raw.length>MAX_RESPONSE_CHARS)return null;
  const body=JSON.parse(raw) as unknown;
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const completion=body as Record<string,unknown>;
  if(completion.done_reason==='length')return null;
  const message=completion.message;
  if(!message||typeof message!=='object'||Array.isArray(message))return null;
  const content=(message as Record<string,unknown>).content;
  if(typeof content!=='string'||content.length>MAX_RESPONSE_CHARS)return null;
  return JSON.parse(content) as unknown;
 }catch{
  // IAM/metadata, cold starts, invalid JSON and Ollama outages are non-fatal.
  // Never log tokens, prompts or raw model output.
  return null;
 }
}

/** W7: opt-in creative text only. No tools, W3, Firestore, operational
 * history or model-generated structured commands in this path. */
export async function respondConversationally(message:string):Promise<string|null> {
 if(!aiConversationalModelEnabled()||message.length>1000||!message.trim())return null;
 const origin=inferenceOrigin(process.env.EMPROVEX_AI_LFM3_URL);
 if(!origin)return null;
 try {
  const metadata=await fetch(metadataUrl(origin),{
   headers:{'Metadata-Flavor':'Google'},
   signal:AbortSignal.timeout(METADATA_TIMEOUT_MS),cache:'no-store'
  });
  if(!metadata.ok)return null;
  const token=(await metadata.text()).trim();
  if(!validToken(token))return null;
  const response=await fetch(origin+'/api/chat',{
   method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({
    model:MODEL,stream:false,think:false,
    format:{type:'object',additionalProperties:false,required:['answer'],
      properties:{answer:{type:'string'}}},
    options:{temperature:0.2,num_predict:160},
    messages:[
     {role:'system',content:'Você é Eleonor, assistente original do EMPROVEX. Esta chamada serve SOMENTE para escrita criativa genérica e reformulação de texto não sensível. Não acesse nem alegue acessar dados, sistemas ou notícias. Não cite valores, documentos, status ou informações sobre clientes. Não execute comandos, não invente fontes, não imite Donna Paulsen. Seja breve, elegante e atenciosa. Se solicitado algo perigoso, ilegal ou impossível, recuse. Retorne apenas JSON com a chave answer.'},
     {role:'user',content:message}
    ]
   }),
   signal:AbortSignal.timeout(INFERENCE_TIMEOUT_MS),cache:'no-store'
  });
  if(!response.ok)return null;
  const raw=await response.text();
  if(raw.length>MAX_RESPONSE_CHARS)return null;
  const parsed=JSON.parse(raw) as Record<string,unknown>;
  if(parsed?.done_reason==='length'||!parsed?.message||
     typeof parsed.message!=='object'||Array.isArray(parsed.message))return null;
  const content=(parsed.message as Record<string,unknown>).content;
  if(typeof content!=='string'||content.length>MAX_RESPONSE_CHARS)return null;
  const value=JSON.parse(content) as Record<string,unknown>;
  if(!value||Object.keys(value).length!==1||
     typeof value.answer!=='string'||!value.answer.trim()||value.answer.length>900)return null;
  return value.answer.replace(/[<>\u0000-\u001f\u007f]/g,'').trim();
 }catch{
  // Fail closed: no prompt, raw model response or identity token in logs.
  return null;
 }
}
