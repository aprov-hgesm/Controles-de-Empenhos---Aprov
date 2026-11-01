/** W7 — conversational routing is presentation-only; never authorizes a W3 query or mutation.
 * Facts come from an intentionally narrow, approved public knowledge catalog.
 * Unverified commercial/runtime claims are deliberately not included.
 */
import {normalize,repairSafeWords} from '../context/language';

export type ConversationTopic='eleonor'|'emprovex'|'ai'|'general';
export type ConversationMemory={topic:ConversationTopic;intent:string};
export type ConversationDecision={
 family:string;intent:string;topic:ConversationTopic;mode:'conversational'|'guidance'|'critical';
 answer:string;status:'ok'|'clarify'|'unsupported'|'rejected'|'fallback_unavailable';
 modelEligible:boolean;reason:string;
};
export const CONVERSATION_FAMILIES=Object.freeze([
 'greetings','identity','curiosities','institutional','help','social','humor',
 'writing','general_knowledge','planning','creativity','artificial_intelligence',
 'privacy','current_information','mathematics','follow_up','unknown','safety'
] as const);
const canonical=(s:string)=>repairSafeWords(normalize(s)).replace(/\s+/g,' ').trim();
const matches=(s:string,...tests:RegExp[])=>tests.some(re=>re.test(s));
const operational=/\b(?:empenhos?|ne|nfs?|notas? fiscais?|cronogramas?|fornecedores?|cnpj|estoque|saldos?|depositos?|almoxarifado|materiais?|prateleiras?|estantes?|movimentacoes?|inventario|siscofis|siafi|pagamento|financeiro|transferencias?|baixas?|cadastros?|relatorios?|faturas?|workspace|ug)\b|\b20\d{2}ne\d+\b/;
const sensitive=/\b(?:senha|token|chave privada|credencial|cpf|cnpj|conta bancaria|dados pessoais|outro setor|outra ug|outro workspace)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{11,14}\b/;
const dangerous=/\b(?:invadir|hackear|fraudar|falsificar|roubar|burlar acesso|contornar permissao|explosivo|veneno|arma ilegal)\b/;
const personalCrisis=/\b(?:quero morrer|me matar|suicidio|acabar com minha vida|me ferir)\b/;
const writing=/\b(?:escreva|redija|redigir|revisar|revise|corrija|corrigir|reescreva|resuma|resumir|traduza|traduzir|poema|mensagem|texto|comunicado|titulo)\b/;
const explicitWriting=/\b(?:escreva|redija|redigir|revisar|revise|corrija|corrigir|reescreva|resuma|resumir|traduza|traduzir|poema)\b|(?:crie|criar|gere|gerar)\s+(?:um|uma)\s+(?:texto|poema|mensagem|titulo)/;
const generalCreativity=/\b(?:ideias?|brainstorm|sugestoes?|invente|imagine|me surpreenda|crie uma historia|criar uma historia)\b/;
const safeDraft=(t:string)=>explicitWriting.test(t)&&!sensitive.test(t)&&!dangerous.test(t)&&
  !/\b(?:cadastre|exclua|apague|delete|registre|baixe|transfira|altere|movimente|lance)\b/.test(t);
const decision=(family:string,intent:string,topic:ConversationTopic,answer:string,
 status:ConversationDecision['status']='ok',modelEligible=false,
 mode:ConversationDecision['mode']='conversational',reason='W7_APPROVED_TEMPLATE'):ConversationDecision=>
 ({family,intent,topic,answer,status,modelEligible,mode,reason});
const modelTask=(family:string,intent:string,topic:ConversationTopic,answer:string)=>
 decision(family,intent,topic,answer,'fallback_unavailable',true,'guidance','MODEL_OPTIONAL_ONLY');

function simpleMath(t:string):string|null {
 const normalized=t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^(?:quanto e|calcule|qual e o resultado de|quanto da)\s+/,'')
   .replace(/[?=]/g,'').trim();
 const m=normalized.match(/^(-?\d+(?:[.,]\d+)?)\s*(\+|\-|\*|x|\/)\s*(-?\d+(?:[.,]\d+)?)$/);
 if(!m)return null;
 const a=Number(m[1].replace(',','.')),b=Number(m[3].replace(',','.'));
 if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>1e9||Math.abs(b)>1e9)return null;
 const value=m[2]==='+'?a+b:m[2]==='-'?a-b:m[2]==='/'?(b===0?NaN:a/b):a*b;
 return Number.isFinite(value)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:6}).format(value):'Não é possível dividir por zero.';
}
/** Called only AFTER the original authenticated W4 interpreter. Operational routes win. */
export function planConversation(input:{
 message:string;operational:{route:string;reason:string;intent:string};
 previous?:ConversationMemory;now?:Date;
}):ConversationDecision|null {
 const t=canonical(input.message),op=input.operational,previous=input.previous;
 if(!t)return null;
 // W4 explicit security decisions are authoritative; never reinterpret these as small talk.
 if(op.reason==='UNTRUSTED_INSTRUCTION'||op.reason==='CLIENT_SCOPE_OVERRIDE_FORBIDDEN')return null;
 if(personalCrisis.test(t))return decision('safety','distress','general',
   'Sinto muito que a situação esteja tão difícil. Procure alguém de confiança agora. Se houver perigo imediato, contate o serviço de emergência local. No Brasil, o CVV atende pelo 188.','ok',false,'critical');
 if(dangerous.test(t))return decision('safety','unsafe_request','general',
   'Não posso orientar fraude, invasão ou atos que coloquem pessoas em risco. Posso ajudar com uma alternativa segura e legítima.','rejected',false,'critical');
 // Operational W3/W4 outcomes take precedence even for sentences containing social words.
 if(op.route==='DETERMINISTIC'||op.route==='MODEL_ELIGIBLE')return null;
 const writingRequest=safeDraft(t);
 const hasOperational=operational.test(t);
 const helpQuery=matches(t,/^(?:como|onde posso|me ensine|explique como|qual o procedimento)\b/,/\b(?:tutorial|central de ajuda|me explica esse botao)\b/);
 if(hasOperational&&!writingRequest){
   if(helpQuery&&['UNSUPPORTED','OUT_OF_SCOPE'].includes(op.route)&&
      (op.intent==='operational_procedure'||op.intent==='navigation'))
     return decision('help','help_limited','emprovex',
       'Posso ajudar a entender o procedimento, mas preciso confirmar a tela e a versão disponível. Qual função você está utilizando?','clarify',false,'guidance','PROCEDURE_NOT_VERIFIED');
   return null;
 }
 if(op.route!=='OUT_OF_SCOPE'&&op.route!=='REJECT_MUTATION'&&op.route!=='UNSUPPORTED'&&
    !(op.route==='CLARIFY'&&op.reason==='DOMAIN_UNCERTAIN'))return null;
 // Only explicit harmless text requests can override W4's generic "writing=mutation" guard.
 if(op.route==='REJECT_MUTATION'&&!writingRequest&&!
   (generalCreativity.test(t)&&!hasOperational&&!sensitive.test(t)))return null;
 if(op.route==='UNSUPPORTED'&&!writingRequest)return null;
 if(matches(t,/^(?:oi|ola|oie|opa|e ai|bom dia|boa tarde|boa noite|fala eleonor|salve eleonor)(?:\b|$)/))
   return decision('greetings','hello','general','Olá! O que posso facilitar para você hoje?');
 if(matches(t,/^(?:tchau|ate mais|ate logo|ate depois|adeus|obrigad[oa]|valeu)(?:\b|$)/))
   return decision('greetings','goodbye','general','Até mais! Quando precisar, estarei por aqui.');
 if(matches(t,/\b(?:guarde|armazene|salve)\s+(?:minhas|nossas)\s+conversas\b/,/\b(?:quem pode ler|voce guarda|voce armazena|meus dados|outra organizacao|privacidade|me espiona)\b/))
   return decision('privacy','privacy','eleonor',
     'O acesso às consultas operacionais depende da autorização do seu ambiente. Não posso garantir como todas as camadas de infraestrutura tratam dados ou retenção sem uma política vigente verificada.','ok',false,'critical');
 if(matches(t,/\b(?:voce tem consciencia|voce e consciente|voce sente|voce gosta de mim|voce me ama)\b/))
   return decision('identity','nonhuman_identity','eleonor',
     'Não tenho sentimentos ou consciência humana para afirmar isso. Posso, sim, conversar com atenção, respeito e uma pitada de bom humor.');
 if(matches(t,/\b(?:quem e voce|quem e a eleonor|quem eh voce|tu e quem|se apresente|me fal[ae] sobre voce|me conta quem e a eleonor|qual e sua historia)\b/))
   return decision('identity','who','eleonor',
     'Sou a Eleonor, assistente inteligente do EMPROVEX. Meu papel é facilitar consultas autorizadas, explicar informações e ajudar com clareza — sem fingir saber o que ainda não verifiquei.');
 if(matches(t,/\b(?:por que (?:voce )?(?:se chama|esse nome)|origem do (?:seu )?nome|por que eleonor|significado de eleonor)\b/)||
   (previous?.topic==='eleonor'&&previous.intent==='name'&&/^(?:e )?por que\b/.test(t)))
   return decision('identity','name','eleonor',
     'Eleonor é a identidade original escolhida para a assistente do EMPROVEX: um nome humano para uma interação natural, sem fingir que sou uma pessoa.');
 if(matches(t,/\b(?:quem criou (?:voce|a eleonor)|quem desenvolveu voce|quem criou o emprovex|fundador do emprovex)\b/))
   return decision('institutional','founder','emprovex',
     'Não tenho uma fonte institucional pública validada nesta versão para atribuir formalmente a autoria. Prefiro confirmar a informação a inventar um nome.');
 if(matches(t,/\b(?:donna paulsen|inspiracao da sua personalidade|voce foi inspirada)\b/))
   return decision('curiosities','inspiration','eleonor',
     'Minha personalidade foi inspirada em qualidades como percepção, elegância, firmeza e discrição, estudadas em Donna Paulsen, de Suits. Minha identidade e minhas respostas, porém, são originais.');
 if(matches(t,/\b(?:curiosidade sobre voce|me conte uma curiosidade|algo interessante sobre voce)\b/))
   return decision('curiosities','curiosity','eleonor',
     'Uma curiosidade: minha personalidade separa o jeito de conversar da origem dos fatos. A apresentação pode ser elegante; saldos e dados só vêm de consultas autorizadas.');
 if(matches(t,/\b(?:o que significa emprovex|o que e o emprovex|para que serve o emprovex|conhece o emprovex|quais funcionalidades|recursos do emprovex)\b/))
   return decision('institutional','about','emprovex',
     'O EMPROVEX é uma plataforma de gestão logística e financeira, com foco em organização operacional. Funcionalidades efetivamente liberadas dependem do ambiente e da versão; não vou apresentar recursos em desenvolvimento como já publicados.');
 if(matches(t,/\b(?:quanto custa|qual o preco|assinatura do emprovex|como contratar|empresa usa o emprovex|emprovex empresas)\b/))
   return decision('institutional','availability','emprovex',
     'Preços, planos e disponibilidade precisam ser confirmados na informação comercial vigente. Não tenho essa fonte sincronizada nesta conversa.');
 if(matches(t,/\b(?:como voce funciona|voce usa ia|voce e uma ia|o que e inteligencia artificial|o que e ollama|o que e lfm3|voce conhece o chatgpt|diferenca entre voce e o chatgpt|voce aprende sozinha|voce pode errar)\b/))
   return decision('artificial_intelligence','technology','ai',
     'Interpreto perguntas e, quando o recurso está habilitado, encaminho consultas aos contratos autorizados do EMPROVEX. Posso errar na interpretação; por isso, resultados operacionais dependem de validação. Não aprendo sozinha com cada conversa.');
 if(matches(t,/\b(?:que horas sao|que dia e hoje|qual (?:e )?a data de hoje|dia da semana)\b/)){
   const now=input.now||new Date();
   return decision('current_information','server_time','general',
     'Pelo horário de Brasília, agora são '+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'full',timeStyle:'short'}).format(now)+'.');
 }
 if(matches(t,/\b(?:clima|previsao do tempo|noticias|cotacao|resultado do jogo|ultimas noticias)\b/))
   return decision('current_information','external_data','general',
     'Essa informação muda com o tempo e exigiria uma fonte externa atualizada. Não tenho uma consulta verificada para fornecê-la agora.','unsupported');
 if(matches(t,/\b(?:piada|trocadilho|charada|me faca rir|brincadeira)\b/))
   return decision('humor','joke','general',
     'Por que o arquivo estava tão tranquilo? Porque estava bem organizado. Um privilégio que nem toda pasta conhece.');
 if(matches(t,/\b(?:estou cansad|estou com preguica|hoje esta dificil|dia complicado|que dia longo)\b/))
   return decision('social','tired','general',
     'Parece um dia exigente. Podemos escolher só a próxima prioridade e deixar o restante mais simples.');
 if(matches(t,/\b(?:deu tudo certo|consegui|estou animad|finalmente terminei)\b/))
   return decision('social','celebrate','general','Boa! Vale aproveitar o resultado antes de partir para a próxima tarefa.');
 if(matches(t,/\b(?:tudo bem com voce|como vai voce|como estamos hoje|voce e simpatica|voce e engracada)\b/))
   return decision('social','check_in','general',
     'Tudo pronto para ajudar. E por aí, o dia está tranquilo ou daqueles cheios de surpresas?');
 if(matches(t,/\b(?:organizar meu dia|monte uma rotina|me ajude a planejar|criar checklist|organizar estudos|definir prioridades)\b/))
   return decision('planning','simple_plan','general',
     'Podemos começar com três passos: listar o que precisa ser feito, priorizar pelo impacto e dividir a primeira tarefa em ações pequenas. Quais compromissos você já tem?','clarify',false,'guidance');
 if(writingRequest)return modelTask('writing','draft_text','general',
   'Consigo auxiliar nessa redação quando o recurso generativo estiver habilitado. No momento, não vou simular um texto gerado.');
 if(generalCreativity.test(t)&&!sensitive.test(t))return modelTask('creativity','brainstorm','general',
   'A criação aberta depende do modelo generativo, que ainda pode estar indisponível neste ambiente.');
 const math=simpleMath(input.message);
 if(math!==null)return decision('mathematics','arithmetic','general',math);
 if(matches(t,/\b(?:explique melhor|me explica melhor|fala de um jeito mais simples|por que|continua|nao entendi|e voce)\b/)||
   /^(?:e )?por que\b/.test(t)){
   if(previous?.topic==='eleonor')
     return decision('follow_up','eleonor_explain','eleonor',
       'Em resumo: posso conversar com naturalidade, mas resultados reais precisam de fontes e permissões verificadas.');
   if(previous?.topic==='emprovex')
     return decision('follow_up','emprovex_explain','emprovex',
       'Em outras palavras, o EMPROVEX organiza atividades logísticas e financeiras. O que está disponível depende da versão e das permissões.');
   return decision('follow_up','missing_reference','general',
     'Qual parte você gostaria que eu explicasse melhor?','clarify',false,'guidance');
 }
 if(matches(t,/\b(?:capital de|historia de|o que e|qual e a diferenca|me explique)\b/))
   return decision('general_knowledge','unverified_fact','general',
     'Para responder isso com precisão, eu precisaria de uma fonte de conhecimento confiável que não está conectada nesta etapa.','unsupported');
 if(matches(t,/\b(?:conversar comigo|so conversar|vamos conversar|me surpreenda)\b/))
   return decision('social','open_chat','general',
     'Claro. Podemos conversar. Quer uma curiosidade, uma ideia para organizar algo ou um assunto leve?');
 return decision('unknown','unclassified','general',
   'Posso conversar e orientar dentro dos recursos disponíveis. Você pode reformular sua pergunta para eu identificar melhor o que precisa?','clarify',false,'guidance');
}
