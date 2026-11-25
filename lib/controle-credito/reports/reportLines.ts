import type {FinanceView,FinanceCredit,CommitmentRecord} from '../contracts';
import {money,displayDate,type CreditReportLine} from './creditPdf';
export const REPORT_TITLES:Record<string,string>={saldo:'Relatório de Execução do Crédito Registrado',prazos:'Relatório de Prazos e Pendências',nc:'Relatório de NCs Cadastradas','nc-detalhe':'Relatório Detalhado de NC','ne-centro':'Relatório Detalhado de NEs por Centro de Custos',ne:'Relatório Detalhado de NEs por Centro de Custos'};
type Filters={type:string;nc?:string;center?:string;from?:string;to?:string};
const dateOfRegistration=(n:CommitmentRecord)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(n.createdAt));
const deadlineOrder=(a:FinanceCredit,b:FinanceCredit)=>(a.deadline??'9999-12-31').localeCompare(b.deadline??'9999-12-31')||a.id.localeCompare(b.id);
export function buildCreditReport(view:FinanceView,filters:Filters):CreditReportLine[]{
  const {type,nc,center,from,to}=filters;
  const allCredits=view.credits.filter(c=>!nc||c.id===nc||c.number===nc||c.fullNumber===nc);
  const credits=[...allCredits].sort(deadlineOrder);
  const byCredit=new Map(credits.map(c=>[c.id,c]));
  const notes=view.commitments.filter(n=>byCredit.has(n.creditId)&&(!center||n.centerId===center)&&(!from||dateOfRegistration(n)>=from)&&(!to||dateOfRegistration(n)<=to));
  const lines:CreditReportLine[]=[];
  const add=(label:string,value:string,kind?:CreditReportLine['kind'],fields?:CreditReportLine['fields'])=>lines.push({label,value,...(kind?{kind}:{}),...(fields?{fields}:{})});
  const description=(label:string,value:string)=>{for(let i=0;i<value.length;i+=850)add(i===0?label:label+' (continuação)',value.slice(i,i+850));};
  const totals=(credit:number,committed:number,available:number)=>{add('Crédito registrado',money(credit),'metric');add('Empenhado',money(committed),'metric');add('Saldo disponível',money(available),'metric');};
  function summary(c:FinanceCredit){
    add('NC '+c.number,'Emissão '+displayDate(c.issueDate)+' | Prazo para empenho '+displayDate(c.deadline),'section');
    add('Execução',money(c.balance.creditCents)+' recebido/destinado | '+money(c.balance.committedCents)+' empenhado | '+money(c.balance.availableCents)+' disponível','fields',[{label:'Recebido / destinado',value:money(c.balance.creditCents)},{label:'Empenhado',value:money(c.balance.committedCents)},{label:'Saldo disponível',value:money(c.balance.availableCents)}]);
  }
  function ne(n:CommitmentRecord){
    add('NE '+n.number,'NC '+(byCredit.get(n.creditId)?.number||n.creditId)+' | Centro '+n.centerId+' | '+money(n.netCents),'section');
    add('Favorecido',n.supplier+' | Emissão '+displayDate(n.issueDate)+' | Cadastro '+displayDate(dateOfRegistration(n)));
    description('Finalidade',n.description);
    for(const d of n.budgetDifferences??[])add('Diferença com ciência — '+d.field,'NC '+(d.credit??'não informado')+' | NE '+(d.commitment??'não informado'));
  }
  if(type==='saldo'){
    const t=view.totals;
    add('Resumo financeiro do exercício','','section');totals(t.creditCents,t.committedCents,t.availableCents);
    add('Percentual empenhado',t.creditCents>0?(100*t.committedCents/t.creditCents).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%':'Não aplicável');
    add('Registros',t.creditCount+' NCs | '+t.commitmentCount+' NEs | '+t.noCommitmentsCount+' NCs sem empenho');
    if(view.member.role==='gestor')add('Não distribuído',money(t.unallocatedCents));
    const perCenter=new Map<string,{credit:number;committed:number;available:number}>();
    for(const c of credits)for(const x of c.balance.centers){const acc=perCenter.get(x.centerId)??{credit:0,committed:0,available:0};acc.credit+=x.allocatedCents;acc.committed+=x.committedCents;acc.available+=x.availableCents;perCenter.set(x.centerId,acc);}
    add('Distribuição por centro de custos','','section');for(const [id,x] of [...perCenter].sort(([a],[b])=>a.localeCompare(b))){add('Centro '+id,view.centers?.find(c=>c.id===id)?.name||'','section');add('Execução do centro',money(x.credit)+' destinado | '+money(x.committed)+' empenhado | '+money(x.available)+' disponível','fields',[{label:'Destinado',value:money(x.credit)},{label:'Empenhado',value:money(x.committed)},{label:'Saldo disponível',value:money(x.available)}]);}
  }else if(type==='prazos'){
    const alerts=new Map(view.alerts.map(a=>[a.creditId,a]));
    const pending=credits.filter(c=>alerts.has(c.id));
    add('Resumo de pendências','','section');add('NCs com pendências',String(pending.length),'metric');
    for(const c of pending){const a=alerts.get(c.id)!;summary(c);const flags=[a.overdue?'Prazo vencido':a.dueToday?'Vence hoje':a.dueWithinSevenDays?'Vence em '+a.daysRemaining+' dia(s)':a.deadlineMissing?'Prazo não informado':'',a.noCommitments?'Sem empenhos':'',a.overdrawn?'Déficit de saldo':'',a.overdrawnCenterIds.length?'Déficit em centro de custos':'',a.overdrawnCellIds.length?'Déficit em célula orçamentária':''].filter(Boolean);add('Pendências',flags.join(' | ')||'Conferir saldo');}
    add('Observação','Prazo vencido não representa recolhimento efetivo.');
  }else if(type==='nc'||type==='nc-detalhe'){
    add('Resumo da consulta','','section');if(nc)add('Filtro de NC',nc);
    add('Notas de crédito',String(credits.length),'metric');
    const byNe=new Map<string,CommitmentRecord[]>();for(const n of notes){const list=byNe.get(n.creditId)??[];list.push(n);byNe.set(n.creditId,list);}
    for(const c of credits){summary(c);description('Finalidade',c.description);
      if(view.member.role==='gestor')for(const cell of c.cells)add('Célula orçamentária','ND '+cell.nd+' | PI '+(cell.pi??'não informado')+' | PTRES '+cell.ptres+' | '+money(cell.cents));
      if(view.member.role==='centro')add('Células orçamentárias','Dados globais reservados à gestão; valores limitados ao centro autorizado.');
      if(type==='nc-detalhe'){const entries=byNe.get(c.id)??[];add('Empenhos vinculados',String(entries.length));for(const n of entries)ne(n);}
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
