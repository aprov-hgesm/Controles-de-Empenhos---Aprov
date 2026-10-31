/** Lightweight, bounded pt-BR lexical layer; original identifiers are never rewritten. */
export const WORDS={
  commitment:['empenho','empenhos','empeno','empenus','nota de empenho','ne'],
  invoice:['nota fiscal','notas fiscais','nf','nfs','notta fisca','nóta fiscal'],
  schedule:['cronograma','cronogramas','crongrama','programacao de entrega'],
  supplier:['fornecedor','fornecedores','empresa','cnpj','firma'],
  stock:['estoque','saldo fisico','quantidade','temos','disponivel','material','materiais','produto','produtos'],
  location:['onde','localizacao','localizado','armazenado','deposito','camara fria','estante','prateleira','freezer','geladeira'],
  contact:['contato','telefone','email','e-mail','whatsapp','numero de telefone'],
  balance:['saldo','resta','restante','quanto falta','a liquidar','valor disponivel','tem saldo','falta entregar','pra receber','para receber','a receber','ainda tem pra receber'],
  register:['cadastradas','cadastrados','registradas','registrados','lancadas','inseridas'],
  issued:['emitida','emitidas','emissao','emitidos','emitido'],
  sent:['enviado','enviados','enviamos','enviada','envio','remessa'],
  writing:['exclua','excluir','apague','apagar','delete','deletar','altere','alterar','modifique','edite','editar','cadastre','cadastrar',
    'crie','criar','gere','gerar','envie','enviar','transfira','transferir','movimente','movimentar','baixe','baixar','registre','registrar'],
  late:['atrasadas','atrasados','atraso','vencidas','vencidos','pendentes']
} as const;
export function normalize(text:string):string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[“”‘’]/g,"'").replace(/[^a-z0-9á-ú\s./@-]/gi,' ').replace(/\s+/g,' ').trim();
}
export const has=(text:string,words:readonly string[])=>words.some(w=>(' '+text+' ').includes(' '+normalize(w)+' '));
export const matchAny=(text:string,expressions:readonly string[])=>expressions.some(e=>text.includes(normalize(e)));
export function relativePeriod(t:string):{kind:'relative';value:string}|null {
  const table:[string,string][]=[
    ['semana retrasada','two_weeks_ago'],['semana passada','last_week'],
    ['ultima semana','last_week'],['esta semana','this_week'],
    ['mes passado','last_month'],['este mes','this_month'],
    ['anteontem','day_before_yesterday'],['ontem','yesterday'],['hoje','today'],
    ['amanha','tomorrow'],['ultimos 30 dias','last_30_days'],
    ['ultimos trinta dias','last_30_days'],['ultimos 7 dias','last_7_days'],
    ['ultimos sete dias','last_7_days'],
    ['exercicio anterior','previous_exercise'],['exercicio atual','this_exercise']
  ];
  for(const [phrase,value] of table)if(t.includes(phrase))return {kind:'relative',value};
  return null;
}
/** Fuzzy correction applies only to approved non-critical vocabulary. */
const SPELLING:Readonly<Record<string,string>>={
  'empeno':'empenho','empenus':'empenhos','crongrama':'cronograma',
  'fornecedo':'fornecedor','forneçedor':'fornecedor',
  'notta':'nota','fisca':'fiscal','estoqeu':'estoque',
  'sald':'saldo','ontm':'ontem','cadastrda':'cadastrada'
};
export function repairSafeWords(t:string):string {
  return t.split(' ').map(w=>/\d|[@/._-]/.test(w)?w:(SPELLING[w]||w)).join(' ');
}

/** Absolute dd/mm/yyyy date range. Inclusive request dates -> exclusive W3 end date. */
export function parsePeriod(text:string):{kind:'relative';value:string}|{start:string;endExclusive:string}|null {
 const rel=relativePeriod(text);if(rel)return rel;
 const m=text.match(/\b(?:entre|de)\s+(\d{1,2})\/(\d{1,2})\/(20\d{2})\s+(?:e|a|ate)\s+(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
 if(!m)return null;
 const date=(d:string,mo:string,y:string)=>{
   const day=Number(d),month=Number(mo),year=Number(y);
   if(month<1||month>12||day<1||day>31)return null;
   const t=new Date(Date.UTC(year,month-1,day));
   if(t.getUTCFullYear()!==year||t.getUTCMonth()!==month-1||t.getUTCDate()!==day)return null;
   return t.toISOString().slice(0,10);
 };
 const start=date(m[1],m[2],m[3]),end=date(m[4],m[5],m[6]);
 if(!start||!end||start>end||Date.parse(end)-Date.parse(start)>365*86400000)return null;
 const endExclusive=new Date(Date.parse(end+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 return {start,endExclusive};
}
