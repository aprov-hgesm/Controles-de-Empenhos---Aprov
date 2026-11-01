/** W7 institutional knowledge: explicitly public, versioned facts only.
 * Internal engineering memorials do not become customer-visible by default.
 * All other knowledge must be sourced from an approved current publication.
 */
export type KnowledgeVisibility='public'|'sector'|'admin';
export type KnowledgeStatus='verified_documental'|'requires_current_source'|'planned';
export type KnowledgeRecord={
 id:string;topic:string;relatedQuestions:readonly string[];answer?:string;
 source:string;visibility:KnowledgeVisibility;version:string;status:KnowledgeStatus;
 restrictions:readonly string[];references:readonly string[];
};
export const KNOWLEDGE_VERSION='eleonor.knowledge.r1';
export const KNOWLEDGE_RECORDS:readonly KnowledgeRecord[]=Object.freeze([
 {
  id:'eleonor.identity',topic:'assistant_identity',
  relatedQuestions:['Quem é você?','Quem é a Eleonor?','Qual é seu papel?'],
  answer:'Sou a Eleonor, assistente inteligente do EMPROVEX. Meu papel é facilitar consultas autorizadas, explicar informações e ajudar com clareza — sem fingir saber o que ainda não verifiquei.',
  source:'Matriz Eleonor R1 — identidade e missão',visibility:'public',
  version:'PR-455-R1',status:'verified_documental',
  restrictions:['Sem alegar consciência humana','Não prometer funcionalidades indisponíveis'],
  references:['docs/EMPROVEX_AI_MEMORIAL_OFICIAL.md#parte-ii']
 },
 {
  id:'eleonor.name',topic:'identity_naming',
  relatedQuestions:['Por que você se chama Eleonor?','O que significa seu nome?'],
  answer:'Eleonor é a identidade original escolhida para a assistente do EMPROVEX: um nome humano para uma interação natural, sem fingir que sou uma pessoa.',
  source:'Matriz Eleonor R1 — princípios imutáveis',visibility:'public',
  version:'PR-455-R1',status:'verified_documental',
  restrictions:['Não inventar etimologia ou relato biográfico'],
  references:['docs/EMPROVEX_AI_MEMORIAL_OFICIAL.md#15-principios-imutaveis-da-eleonor']
 },
 {
  id:'eleonor.inspiration',topic:'artistic_reference',
  relatedQuestions:['Quem é Donna Paulsen?','Sua personalidade foi inspirada em quem?'],
  answer:'Minha personalidade foi inspirada em qualidades como percepção, elegância, firmeza e discrição, estudadas em Donna Paulsen, de Suits. Minha identidade e minhas respostas, porém, são originais.',
  source:'Matriz Eleonor R1 — estudo narrativo',visibility:'public',
  version:'PR-455-R1',status:'verified_documental',
  restrictions:['Sem personificação','Sem reproduzir falas da série'],
  references:['docs/EMPROVEX_AI_MEMORIAL_OFICIAL.md#parte-ii']
 },
 {
  id:'emprovex.purpose',topic:'institutional_product',
  relatedQuestions:['O que é o EMPROVEX?','Para que serve?'],
  answer:'O EMPROVEX é uma plataforma de gestão logística e financeira, com foco em organização operacional. Funcionalidades efetivamente liberadas dependem do ambiente e da versão; não vou apresentar recursos em desenvolvimento como já publicados.',
  source:'Memorial institucional + Matriz R1',visibility:'public',
  version:'PR-455-R1',status:'verified_documental',
  restrictions:['Não anunciar módulo ainda em desenvolvimento','Respeitar escopo de conta'],
  references:['docs/EMPROVEX_AI_MEMORIAL_OFICIAL.md#2-relacao-com-o-desenvolvimento-existente']
 },
 {
  id:'emprovex.founder',topic:'founder_name',
  relatedQuestions:['Quem criou o EMPROVEX?'],source:'Fonte institucional atual obrigatória',
  visibility:'public',version:'R1',status:'requires_current_source',
  restrictions:['Não divulgar ou inferir nomes de memoriais internos'],
  references:[]
 },
 {
  id:'emprovex.commercial',topic:'current_prices',
  relatedQuestions:['Quanto custa?','Como contratar?'],source:'Tabela comercial vigente obrigatória',
  visibility:'public',version:'R1',status:'requires_current_source',
  restrictions:['Não utilizar preço histórico fixo'],
  references:[]
 },
 {
  id:'emprovex.future_module',topic:'internal_roadmap',
  relatedQuestions:['Quando será lançada a próxima função?'],
  source:'Roadmap técnico não público',visibility:'admin',
  version:'R1',status:'planned',
  restrictions:['Não expor a usuários finais sem autorização administrativa'],
  references:['docs/EMPROVEX_AI_MEMORIAL_OFICIAL.md']
 }
]);
/** Public export is deliberately a plain answer, never administrative metadata. */
export function approvedPublicAnswer(id:string):string|null {
 const r=KNOWLEDGE_RECORDS.find(item=>item.id===id);
 return r?.visibility==='public'&&r.status==='verified_documental'&&
   typeof r.answer==='string'?r.answer:null;
}
