import type {FinanceView,FinanceCredit,CommitmentRecord} from '../contracts';
import {money,displayDate,type CreditReportLine} from './creditPdf';
export const REPORT_TITLES:Record<string,string>={saldo:'Relatório de Execução do Crédito Registrado',prazos:'Relatório de Prazos e Pendências',nc:'Relatório Resumido de Notas de Crédito','nc-detalhe':'Relatório Detalhado de Notas de Crédito','ne-centro':'Relatório Detalhado de NEs por Centro de Custos',ne:'Relatório Detalhado de NEs por Centro de Custos'};
type Filters={type:string;nc?:string;center?:string;from?:string;to?:string};
const dateOfRegistration=(n:CommitmentRecord)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(n.createdAt));
const deadlineOrder=(a:FinanceCredit,b:FinanceCredit)=>(a.adminDeadline||a.deadline||'9999-12-31').localeCompare(b.adminDeadline||b.deadline||'9999-12-31')||a.id.localeCompare(b.id);
export function buildCreditReport(view:FinanceView,filters:Filters,today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())):CreditReportLine[]{
  const {type,nc,from,to}=filters;
  const center=view.member.role==='centro'?view.member.centerId||undefined:filters.center;
  const allCredits=view.credits.filter(c=>!nc||c.id===nc||c.number===nc||c.fullNumber===nc);
  const credits=allCredits.filter(c=>!center||c.balance.centers.some(x=>x.centerId===center&&(x.basisPoints>0||x.commitmentCount>0))).sort(deadlineOrder);
  const byCredit=new Map(credits.map(c=>[c.id,c]));
  const notes=view.commitments.filter(n=>byCredit.has(n.creditId)&&(!center||n.centerId===center)&&(!from||dateOfRegistration(n)>=from)&&(!to||dateOfRegistration(n)<=to));
  const lines:CreditReportLine[]=[];
  const add=(label:string,value:string,kind?:CreditReportLine['kind'],fields?:CreditReportLine['fields'])=>lines.push({label,value,...(kind?{kind}:{}),...(fields?{fields}:{})});
  const description=(label:string,value:string)=>{for(let i=0;i<value.length;i+=850)add(i===0?label:label+' (continuação)',value.slice(i,i+850));};
  const pct=(n:number,d:number)=>d>0?(100*n/d).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%':'N/A';
  const amounts=(c:FinanceCredit)=>{const x=center?c.balance.centers.find(x=>x.centerId===center):undefined;return {credit:x?.allocatedCents??c.balance.creditCents,used:x?.committedCents??c.balance.committedCents,rest:x?.availableCents??c.balance.availableCents};};
  const sum=(a:number,b:number)=>{const n=a+b;if(!Number.isSafeInteger(n))throw new Error('Total financeiro inválido.');return n;};
  const totals=(credit:number,used:number,rest:number)=>lines.push({label:'Valores financeiros',value:'',kind:'fields',fields:[{label:center?'Cota recebida':'Crédito recebido',value:money(credit)},{label:'Valor empenhado',value:money(used)},{label:rest<0?'Déficit':'Saldo não empenhado',value:money(rest)}]});
  const progress=(credit:number,used:number,rest:number)=>lines.push({label:'Percentual empenhado',value:pct(used,credit)+' empenhado | '+pct(rest,credit)+' de saldo'+(rest<0?' (DÉFICIT)':''),kind:'progress',percent:credit>0?100*used/credit:null});
  const days=(d:string|null|undefined)=>d?Math.round((Date.parse(d+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000):null;
  const state=(d:string|null|undefined)=>{const n=days(d);return n===null?'Não definido':n<0?'VENCIDO há '+(-n)+' dia(s)':n===0?'VENCE HOJE':n<=7?'VENCE EM '+n+' DIA(S)':'No prazo';};
  const urgency=(c:FinanceCredit)=>{const a=amounts(c);if(a.rest<0)return 0;if(a.rest===0)return 5;const d=days(c.deadline),adm=days(c.adminDeadline);return d!==null&&d<0?1:adm!==null&&adm<0?2:[d,adm].some(n=>n!==null&&n<=7)?3:4;};
  credits.sort((a,b)=>urgency(a)-urgency(b)||deadlineOrder(a,b));
  type CenterRow={id:string;share?:number;credit:number;used:number;rest:number};
  const cash=(n:number)=>money(n).replace(/^R\$\s*/,'');
  const table=(label:string,rows:CenterRow[],share:boolean)=>{
    if(!rows.length){add(label,'Nenhum centro com cota ou empenho registrado.');return;}
    lines.push({label,value:'',kind:'table',table:{headers:share?['Centro','Rateio','Cota (R$)','Empenh. (R$)','Saldo (R$)','Uso %','Saldo %']:['Centro','Cota (R$)','Empenh. (R$)','Saldo (R$)','Uso %','Saldo %'],weights:share?[25,15,33,33,34,22,24]:[34,37,37,38,19,21],rows:rows.map(x=>[x.id,...(share?[pct(x.share??0,10000)]:[]),cash(x.credit),cash(x.used),cash(x.rest),pct(x.used,x.credit),pct(x.rest,x.credit)])}});
  };
  const centerRows=(c:FinanceCredit):CenterRow[]=>c.balance.centers.filter(x=>(!center||x.centerId===center)&&(x.basisPoints>0||x.commitmentCount>0)).map(x=>({id:x.centerId,share:x.basisPoints,credit:x.allocatedCents,used:x.committedCents,rest:x.availableCents}));
  function consolidated(){
    const a=credits.reduce((v,c)=>{const x=amounts(c);return {credit:sum(v.credit,x.credit),used:sum(v.used,x.used),rest:sum(v.rest,x.rest)};},{credit:0,used:0,rest:0});
    totals(a.credit,a.used,a.rest);progress(a.credit,a.used,a.rest);
    add('Notas de crédito',String(credits.length));
    const overdue=credits.filter(c=>amounts(c).rest>0&&(days(c.deadline)??0)<0);
    const soon=credits.filter(c=>amounts(c).rest>0&&days(c.deadline)!==null&&days(c.deadline)!>=0&&days(c.deadline)!<=7);
    const administrative=credits.filter(c=>amounts(c).rest>0&&days(c.adminDeadline)!==null&&days(c.adminDeadline)!<=7);
    const missing=credits.filter(c=>amounts(c).rest>0&&!c.deadline);
    const attention=(label:string,items:FinanceCredit[])=>{if(items.length)add(label,items.length+' NC(s) | '+money(items.reduce((v,c)=>sum(v,amounts(c).rest),0))+' não empenhados');};
    attention('PRAZO OFICIAL VENCIDO',overdue);attention('Vence em até 7 dias',soon);attention('Prazo administrativo crítico',administrative);attention('Prazo oficial não definido',missing);
    const deficit=credits.filter(c=>amounts(c).rest<0);if(deficit.length)add('DÉFICIT',deficit.length+' NC(s) | '+money(deficit.reduce((v,c)=>sum(v,-amounts(c).rest),0)));
    if(!overdue.length&&!soon.length&&!administrative.length&&!missing.length&&!deficit.length)add('Prazos','Nenhuma pendência de prazo com saldo ou déficit nesta seleção.');
    const map=new Map<string,CenterRow>();for(const c of credits)for(const x of centerRows(c)){const v=map.get(x.id)??{id:x.id,credit:0,used:0,rest:0};map.set(x.id,{id:x.id,credit:sum(v.credit,x.credit),used:sum(v.used,x.used),rest:sum(v.rest,x.rest)});}
    table('Consolidado por centro de custos',[...map.values()].sort((a,b)=>a.id.localeCompare(b.id)),false);
    if(!center&&view.member.role==='gestor'){const n=credits.reduce((v,c)=>sum(v,c.balance.unallocatedCents),0);if(n)add('Crédito não distribuído',money(n));}
  }
  function summary(c:FinanceCredit){
    const a=amounts(c);
    add('NC '+c.number,'Emissão '+displayDate(c.issueDate)+' | Prazo para empenho '+displayDate(c.deadline)+' | Prazo administração '+displayDate(c.adminDeadline),'section');
    add('Situação dos prazos','Oficial: '+state(c.deadline)+' | Administrativo: '+state(c.adminDeadline));
    totals(a.credit,a.used,a.rest);progress(a.credit,a.used,a.rest);
    if(type!=='nc-detalhe'&&c.description){const desc=c.description.trim().replace(/\s+/g,' ');add('Finalidade',desc.length>200?desc.slice(0,197)+'...':desc);}
    table('Distribuição por centro de custos',centerRows(c),true);
    if(!center&&view.member.role==='gestor'&&c.balance.unallocatedCents)add('Crédito não distribuído',money(c.balance.unallocatedCents));
  }
  function ne(n:CommitmentRecord){
    add('NE '+n.number,'NC '+(byCredit.get(n.creditId)?.number||n.creditId)+' | Centro '+n.centerId+' | '+money(n.netCents),'section');
    add('Favorecido',n.supplier+' | Emissão '+displayDate(n.issueDate)+' | Cadastro '+displayDate(dateOfRegistration(n)));
    description('Finalidade',n.description);
    for(const d of n.budgetDifferences??[])add('Diferença com ciência — '+d.field,'NC '+(d.credit??'não informado')+' | NE '+(d.commitment??'não informado'));
  }
  if(type==='saldo'){
    add('Resumo financeiro do exercício','','section');consolidated();
    const t=view.totals;add('Registros',t.creditCount+' NCs | '+t.commitmentCount+' NEs | '+t.noCommitmentsCount+' NCs sem empenho');
  }else if(type==='prazos'){
    const alerts=new Map(view.alerts.map(a=>[a.creditId,a]));
    const pending=credits.filter(c=>alerts.has(c.id));
    add('Resumo de pendências','','section');add('NCs com pendências',String(pending.length),'metric');
    for(const c of pending){const a=alerts.get(c.id)!;summary(c);const flags=[a.overdue?'Prazo vencido':a.dueToday?'Vence hoje':a.dueWithinSevenDays?'Vence em '+a.daysRemaining+' dia(s)':a.deadlineMissing?'Prazo não informado':'',a.noCommitments?'Sem empenhos':'',a.overdrawn?'Déficit de saldo':'',a.overdrawnCenterIds.length?'Déficit em centro de custos':'',a.overdrawnCellIds.length?'Déficit em célula orçamentária':''].filter(Boolean);add('Pendências',flags.join(' | ')||'Conferir saldo');}
    add('Observação','Prazo vencido não representa recolhimento efetivo.');
  }else if(type==='nc'||type==='nc-detalhe'){
    add('Resumo da consulta','','section');if(nc)add('Filtro de NC',nc);
    consolidated();
    const byNe=new Map<string,CommitmentRecord[]>();for(const n of notes){const list=byNe.get(n.creditId)??[];list.push(n);byNe.set(n.creditId,list);}
    for(const c of credits){summary(c);if(type==='nc-detalhe'){description('Finalidade',c.description);add('Identificação','UG emitente '+c.issuingUg+' | UG favorecida '+c.beneficiaryUg+' | '+c.operation+' | '+c.decentralization+' | '+c.sourceSystem);
      if(view.member.role==='gestor'){add('Número completo',c.fullNumber);add('Total original do documento',c.documentTotalCents===null?'Não informado':money(c.documentTotalCents));for(const seq of c.sequences){add('Sequencial '+seq.sequence,money(seq.totalCents));for(const cell of seq.origin)add('Origem','UG '+cell.ug+' | Item '+cell.item+' | Num '+cell.num+' | Esfera '+cell.esfera+' | ND '+cell.nd+' | PI '+(cell.pi??'não informado')+' | PTRES '+cell.ptres+' | Fonte '+cell.fonte+' | UGR '+cell.ugr+' | '+money(cell.cents));}for(const cell of c.cells)add('Célula orçamentária','ND '+cell.nd+' | PI '+(cell.pi??'não informado')+' | PTRES '+cell.ptres+' | Fonte '+cell.fonte+' | UGR '+cell.ugr+' | Esfera '+cell.esfera+' | '+money(cell.cents));}
      if(view.member.role==='centro')add('Células orçamentárias','Dados globais reservados à gestão; valores limitados ao centro autorizado.');
      const entries=byNe.get(c.id)??[];add('Empenhos vinculados',String(entries.length));for(const centerId of [...new Set(entries.map(n=>n.centerId))].sort()){add('Centro '+centerId,'Empenhos vinculados','section');for(const n of entries.filter(n=>n.centerId===centerId))ne(n);}}
    }
    if(!credits.length)add('Resultado','Nenhuma NC encontrada para os filtros.');
  }else{
    add('Resumo da consulta','','section');add('Centro de custos',center||view.member.centerId||'Todos os autorizados');
    if(nc)add('Filtro de NC',nc);
    if(from||to)add('Período de cadastramento',(from?displayDate(from):'Sem início')+' até '+(to?displayDate(to):'Sem fim'));
    add('NEs selecionadas',String(notes.length),'metric');add('Total líquido selecionado',money(notes.reduce((sum,n)=>sum+n.netCents,0)),'metric');
    const groups=new Map<string,CommitmentRecord[]>();for(const n of notes){const list=groups.get(n.centerId)??[];list.push(n);groups.set(n.centerId,list);}
    for(const [id,entries] of [...groups].sort(([a],[b])=>a.localeCompare(b))){add('Centro '+id,entries.length+' NE(s) | '+money(entries.reduce((sum,n)=>sum+n.netCents,0)),'section');for(const n of entries.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)))ne(n);}
    if(!notes.length)add('Resultado','Nenhum empenho encontrado para os filtros.');
  }
  return lines;
}
