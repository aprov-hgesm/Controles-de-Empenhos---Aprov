'use client';
import {useEffect,useState} from 'react';
import type {User} from 'firebase/auth';
import {api,query,money,localDate,errorText,cancelled,cells,type Credit,type Balance,type Commitment} from '../client';
import {CreditProfileAvatar} from './CreditProfileAvatar';
import {secondary} from './Forms';
export type Nc=Credit & {balance:Balance};
export const percentage=(n:number,d:number)=>d>0?(100*n/d).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%':'—';
export function Quota({name,total,used,saldo,share}:{name:string;total:number;used:number;saldo:number;share?:number}){
  const ratio=total>0?Math.max(0,Math.min(100,100*used/total)):0;
  return <div className="rounded-xl border border-slate-200 p-3 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{name}</strong><span className="text-xs">{share!==undefined?'Rateio '+(share/100).toLocaleString('pt-BR')+'% · ':''}{money(total)}</span></div><div className="h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-label={'Consumo '+name} aria-valuenow={Math.round(ratio)} aria-valuemin={0} aria-valuemax={100}><div className={'h-full rounded-full '+(saldo<0?'bg-red-600':'bg-blue-700')} style={{width:ratio+'%'}}/></div><div className="flex flex-wrap justify-between gap-2 text-xs"><span>Empenhado {percentage(used,total)} · {money(used)}</span><span className={saldo<0?'font-bold text-red-700':''}>Saldo {percentage(saldo,total)} · {money(saldo)}</span></div></div>;
}
function Due({label,date,today,remaining}:{label:string;date?:string|null;today:string;remaining:number}){
  const days=date?Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000):null;
  const text=remaining<=0?'Sem saldo pendente':days===null?'Não informado':days<0?'Vencido':days===0?'Vence hoje':days+' dia(s) restante(s)';
  return <div className={'rounded-xl border p-3 '+(remaining>0&&days!==null&&days<0?'border-red-200 bg-red-50 text-red-800':remaining>0&&days!==null&&days<=7?'border-amber-200 bg-amber-50 text-amber-900':'border-slate-200 bg-slate-50')}><p className="text-xs font-bold">{label}</p><strong>{localDate(date)}</strong><p className="text-xs">{text}</p></div>;
}
export function LinkedNotes({user,nc,center,version,onOpen,onDelete}:{user:User;nc:Nc;center:string;version:number;onOpen:(n:Commitment)=>void;onDelete?:(n:Commitment)=>void}){
  const [notes,setNotes]=useState<Commitment[]|null>(null),[error,setError]=useState('');
  useEffect(()=>{const c=new AbortController();setNotes(null);setError('');void api<{commitments:Commitment[]}>(user,'/financeiro'+query({mode:'nc-linked',creditId:nc.id,center}),c.signal).then(v=>{if(!c.signal.aborted)setNotes(v.commitments);}).catch(e=>{if(!cancelled(e)&&!c.signal.aborted)setError(errorText(e));});return()=>c.abort();},[user,nc.id,center,version]);
  return <div className="space-y-2">{error?<p role="alert">{error}</p>:notes===null?<p role="status">Carregando empenhos...</p>:notes.length?notes.map(n=><div key={n.id} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><strong>{n.number} · {n.centerId}</strong><strong>{money(n.netCents)}</strong></div><p className="text-xs">{localDate(n.issueDate)} · {n.supplier}</p><p className="text-sm whitespace-pre-wrap">{n.description}</p><div className="mt-2 flex gap-2"><button className={secondary} onClick={()=>onOpen(n)}>Detalhar NE</button>{onDelete&&<button className={secondary} onClick={()=>onDelete(n)}>Excluir NE</button>}</div></div>):<p>Nenhum empenho vinculado.</p>}</div>;
}
export function CreditNcCard({nc,center,today,children,actions,report}:{nc:Nc;center?:string;today:string;children?:React.ReactNode;actions?:React.ReactNode;report?:(detail:boolean)=>void}){
  const [expanded,setExpanded]=useState(false);
  const b=nc.balance,selected=center?b.centers.find(x=>x.centerId===center):undefined;
  const remaining=selected?.availableCents??b.availableCents;
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase text-slate-500">Nota de Crédito · UG emitente {nc.issuingUg}</p><h3 className="font-mono text-xl font-bold">{nc.number}</h3><p className="text-sm">Emissão: {localDate(nc.issueDate)}</p></div><strong className="text-lg">{money(selected?.allocatedCents??b.creditCents)}</strong></div><div className="grid gap-2 sm:grid-cols-2"><Due label="Prazo para empenho (NC)" date={nc.deadline} today={today} remaining={remaining}/><Due label="Prazo da Administração" date={nc.adminDeadline} today={today} remaining={remaining}/></div>
  {!center&&<Quota name="Execução geral da NC" total={b.creditCents} used={b.committedCents} saldo={b.availableCents}/>}
  {b.centers.filter(x=>!center||x.centerId===center).map(x=><div key={x.centerId} className="flex items-start gap-2"><CreditProfileAvatar profile={x.centerId} size={36}/><div className="flex-1 min-w-0"><Quota name={x.centerId} total={x.allocatedCents} used={x.committedCents} saldo={x.availableCents} share={x.basisPoints}/></div></div>)}
  {!center&&b.unallocatedCents>0&&<p className="text-xs">Não distribuído: {money(b.unallocatedCents)}</p>}
  <div className="flex flex-wrap gap-2"><button className={secondary} aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)}>{expanded?'Recolher':'Detalhar NC'}</button>{report&&<><button className={secondary} onClick={()=>report(false)}>PDF resumido</button><button className={secondary} onClick={()=>report(true)}>PDF detalhado</button></>}{actions}</div>
  {expanded&&<div className="space-y-2 border-t pt-3"><p className="whitespace-pre-wrap text-sm">{nc.description}</p><p className="text-xs">UG favorecida {nc.beneficiaryUg} · {nc.operation} · {nc.decentralization} · {nc.sourceSystem}</p>{cells(nc).map((c,i)=><p className="text-xs" key={c.cellId||i}>ND {c.nd} · PI {c.pi} · PTRES {c.ptres} · Fonte {c.fonte} · UGR {c.ugr} · {money(c.cents)}</p>)}{children}</div>}</article>;
}
