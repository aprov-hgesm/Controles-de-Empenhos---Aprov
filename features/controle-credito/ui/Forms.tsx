'use client';
import {useState,type ReactNode,type FormEvent} from 'react';
import {calculateCreditBalance} from '@/lib/controle-credito/creditBalance';
import type {SagHtmlCreditDraft} from '@/lib/controle-credito/sagCreditHtml.mjs';
import type {ParsedEmpenhoPdfResult} from '@/lib/server/empenhoPdfParser';
import {api,json,importDocument,money,cents,cells,isoDate,localDate,errorText,type Credit,type Center,type Commitment,type Balance,type Member,type NcPreview,type NePreview} from '../client';
import type {User} from 'firebase/auth';

export const panel='rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm';
export const input='block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';
export const button='rounded-lg bg-[#16334d] px-4 py-2 font-semibold text-white disabled:opacity-50';
export const secondary='rounded-lg border border-slate-300 px-3 py-2 font-semibold text-[#16334d] disabled:opacity-50';
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="block min-w-0 space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>;}
export function Notice({children}:{children:ReactNode}){return <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{children}</p>;}
type Runner=<T>(task:(signal:AbortSignal)=>Promise<T>)=>Promise<T|undefined>;
type Common={user:User;run:Runner;busy:boolean;done:()=>void};
const cellFields=['item','num','esfera','ptres','fonte','nd','ugr','pi'] as const;
const cellLabels={item:'Item',num:'Número',esfera:'Esfera',ptres:'PTRES',fonte:'Fonte',nd:'ND',ugr:'UGR',pi:'PI'};
function blankCell(ug:string){return {ug,item:'',num:'',esfera:'',ptres:'',fonte:'',nd:'',ugr:'',pi:'',cents:0};}
function blankDraft(ug:string):SagHtmlCreditDraft{return {number:'',fullNumber:'',issuingUg:'',beneficiaryUg:ug,issueDate:'',operation:'',decentralization:'',sourceSystem:'manual',description:'',deadline:null,documentTotalCents:0,totalCents:0,sequences:[{sequence:'1',totalCents:0,origin:[],destination:[blankCell(ug)]}],warnings:[],requiresReview:true};}
function percent(value:string){if(!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value||'0'))throw new Error('Percentual inválido.');return Math.round(Number((value||'0').replace(',','.'))*100);}
export function Rateio({centers,total,initial=[],commitments=[],onChange}:{centers:Center[];total:number;initial?:Credit['allocations'];commitments?:Commitment[];onChange:(allocations:Credit['allocations'],balance:Balance|null)=>void}){
  const [shares,setShares]=useState<Record<string,string>>(()=>Object.fromEntries(initial.map(a=>[a.centerId,String(a.basisPoints/100)])));
  const ids=[...new Set([...centers.filter(c=>c.active).map(c=>c.id),...initial.map(a=>a.centerId),...commitments.map(c=>c.centerId)])];
  const compute=(values:Record<string,string>)=>{try{const a=ids.map(centerId=>({centerId,basisPoints:percent(values[centerId]||'0')})).filter(a=>a.basisPoints>0);return {a,b:calculateCreditBalance(total,a,commitments)};}catch{return {a:[],b:null};}};
  const result=compute(shares);
  function update(values:Record<string,string>){setShares(values);const {a,b}=compute(values);onChange(a,b);}
  return <fieldset className="space-y-2"><legend className="font-bold">Distribuição entre centros de custos</legend>
    {!ids.length&&<Notice>Cadastre centros de custos para distribuir o crédito. É possível manter saldo não distribuído.</Notice>}
    {ids.map(id=><div key={id} className="grid grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] items-center gap-2 text-sm"><label htmlFor={'rateio-'+id}>{centers.find(c=>c.id===id)?.name||id}</label><input id={'rateio-'+id} className={input} type="number" min="0" max="100" step="0.01" value={shares[id]||''} placeholder="0" onChange={e=>update({...shares,[id]:e.target.value})}/><span className="text-right">{result.b?money(result.b.centers.find(c=>c.centerId===id)?.allocatedCents??0):'—'}</span></div>)}
    <button type="button" className={secondary} disabled={!centers.some(c=>c.active)} onClick={()=>{const active=centers.filter(c=>c.active);const q=Math.floor(10000/active.length),r=10000%active.length;update(Object.fromEntries(active.map((c,i)=>[c.id,String((q+(i<r?1:0))/100)])));}}>Distribuir igualmente</button>
    {result.b?<><p>Saldo não distribuído: <strong>{money(result.b.unallocatedCents)}</strong></p>{result.b.overdrawnCenterIds.length>0&&<Notice>Déficit previsto nos centros: {result.b.overdrawnCenterIds.join(', ')}. Confira antes de confirmar.</Notice>}</>:<Notice>Rateio inválido. O limite total é 100%.</Notice>}
  </fieldset>;
}
function ReviewCells({draft,onChange,manual}:{draft:SagHtmlCreditDraft;onChange:(d:SagHtmlCreditDraft)=>void;manual:boolean}){
  function update(si:number,ci:number,key:string,value:string){
    const sequences=draft.sequences.map((s,i)=>i!==si?s:{...s,destination:s.destination.map((c,j)=>j!==ci?c:{...c,[key]:key==='cents'?Math.round(Number(value)*100):value})}).map(s=>({...s,totalCents:s.destination.reduce((a,c)=>a+c.cents,0)}));
    const totalCents=sequences.reduce((a,s)=>a+s.totalCents,0);onChange({...draft,sequences,totalCents,documentTotalCents:manual?totalCents:draft.documentTotalCents});
  }
  return <div className="space-y-3">{draft.sequences.map((s,si)=><fieldset key={si} className="rounded-lg border p-3 space-y-3"><legend className="font-semibold">Sequencial {s.sequence}</legend>{s.destination.map((c,ci)=><div key={ci} className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
    {cellFields.map(k=><Field key={k} label={cellLabels[k]}><input className={input} value={c[k]??''} required readOnly={!manual&&Boolean(c[k])} onChange={e=>update(si,ci,k,e.target.value)}/></Field>)}
    <Field label="Valor (R$)"><input className={input} type="number" min="0.01" step="0.01" required readOnly={!manual} value={c.cents?c.cents/100:''} onChange={e=>update(si,ci,'cents',e.target.value)}/></Field>
    {manual&&s.destination.length>1&&<button type="button" className={secondary} onClick={()=>{const sequences=draft.sequences.map((x,i)=>i===si?{...x,destination:x.destination.filter((_,j)=>j!==ci)}:x).map(x=>({...x,totalCents:x.destination.reduce((a,b)=>a+b.cents,0)}));const totalCents=sequences.reduce((a,b)=>a+b.totalCents,0);onChange({...draft,sequences,totalCents,documentTotalCents:totalCents});}}>Remover célula</button>}
    </div>)}{manual&&<button type="button" className={secondary} onClick={()=>onChange({...draft,sequences:draft.sequences.map((x,i)=>i===si?{...x,destination:[...x.destination,blankCell(draft.beneficiaryUg)]}:x)})}>Adicionar célula</button>}</fieldset>)}</div>;
}
export function NcForm({user,run,busy,done,member,centers}:{member:Member;centers:Center[]}&Common){
  const [source,setSource]=useState<'html'|'manual'>('html');
  const [draft,setDraft]=useState<SagHtmlCreditDraft|null>(null);
  const [proof,setProof]=useState<NcPreview|null>(null);
  const [allocation,setAllocation]=useState<Credit['allocations']>([]);
  const [valid,setValid]=useState(true);
  const [review,setReview]=useState(false);
  function switchMode(mode:'html'|'manual'){setSource(mode);setDraft(mode==='manual'?blankDraft(member.ug):null);setProof(null);setAllocation([]);setValid(true);setReview(false);}
  async function load(file:File){setDraft(null);setProof(null);setAllocation([]);setValid(true);setReview(false);await run(async signal=>{const p=await importDocument<SagHtmlCreditDraft>(user,'nc',file,signal);setProof(p);setDraft(p.result);});}
  async function save(e:FormEvent){e.preventDefault();if(!draft||!review||!valid)return;await run(async signal=>{const data={...draft,fullNumber:source==='manual'?draft.issuingUg+draft.number:draft.fullNumber,...(proof?.draftToken?{draftToken:proof.draftToken}:{}),...(proof?.token?{token:proof.token}:{}),...(proof?.proof?{proof:proof.proof}:{})};await api(user,'/notas-credito',signal,json('POST',{source,draft:data,allocations:allocation,deadline:draft.deadline,description:draft.description}));done();});}
  return <section className={panel+' space-y-4'}><h2 className="text-xl font-bold">Cadastrar nota de crédito</h2><div className="flex flex-wrap gap-2"><button className={source==='html'?button:secondary} disabled={busy} onClick={()=>switchMode('html')}>Importar HTML SAG</button><button className={source==='manual'?button:secondary} disabled={busy} onClick={()=>switchMode('manual')}>Cadastro manual</button></div>
  {source==='html'&&<Field label="Arquivo HTML original"><input className={input} type="file" accept=".html,.htm,text/html" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);e.target.value='';}}/></Field>}
  {draft&&<form className="space-y-4" onSubmit={save}><fieldset disabled={busy} className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">
  <Field label="Número da NC"><input className={input} required readOnly={source==='html'} value={draft.number} onChange={e=>setDraft({...draft,number:e.target.value.toUpperCase()})}/></Field>
  <Field label="UG emitente"><input className={input} required readOnly={source==='html'} value={draft.issuingUg} pattern="[0-9]{6}" onChange={e=>setDraft({...draft,issuingUg:e.target.value})}/></Field>
  <Field label="UG favorecida"><input className={input} readOnly value={member.ug}/></Field>
  <Field label="Emissão"><input className={input} required readOnly={source==='html'} type="date" value={isoDate(draft.issueDate)} onChange={e=>setDraft({...draft,issueDate:e.target.value})}/></Field>
  <Field label="Prazo de empenho (quando informado)"><input className={input} type="date" value={draft.deadline||''} onChange={e=>setDraft({...draft,deadline:e.target.value||null})}/></Field>
  <Field label="Operação"><input className={input} required readOnly={source==='html'} value={draft.operation} onChange={e=>setDraft({...draft,operation:e.target.value})}/></Field>
  <Field label="Descentralização"><input className={input} readOnly={source==='html'} value={draft.decentralization} onChange={e=>setDraft({...draft,decentralization:e.target.value})}/></Field>
  </div><Field label="Finalidade / observações"><textarea className={input} required value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></Field>
  {draft.warnings.map((w,i)=><Notice key={i}>{w}</Notice>)}<ReviewCells draft={draft} onChange={setDraft} manual={source==='manual'}/>
  <p className="font-bold">Total da UG: {money(draft.totalCents)}</p>
  <Rateio key={source} centers={centers} total={draft.totalCents} onChange={(a,b)=>{setAllocation(a);setValid(!!b);}}/>
  <label className="flex gap-2 items-start"><input type="checkbox" required checked={review} onChange={e=>setReview(e.target.checked)}/> Conferi os dados da NC, as células, o prazo e a distribuição.</label>
  <button className={button} disabled={busy||!valid||!review||draft.totalCents<=0}>Registrar crédito</button></fieldset></form>}</section>;
}
export function EditNc({user,run,busy,done,credit,balance,centers}:{credit:Credit;balance:Balance;centers:Center[]}&Common){
  const [allocations,setAllocations]=useState(credit.allocations);
  const [deadline,setDeadline]=useState(credit.deadline||'');
  const [description,setDescription]=useState(credit.description);
  const [preview,setPreview]=useState<Balance|null>(balance);
  const [ack,setAck]=useState(false);
  // Apenas os totais por centro retornados no detalhe autorizado; nunca inferir por página de NEs.
  const commitments=balance.centers.filter(c=>c.committedCents>0).map(c=>({id:'preview-'+c.centerId,centerId:c.centerId,netCents:c.committedCents} as Commitment));
  const deficit=!!preview?.overdrawnCenterIds.length||!!preview?.overdrawn;
  async function save(e:FormEvent){e.preventDefault();if(!preview||deficit&&!ack)return;await run(async signal=>{await api(user,'/notas-credito',signal,json('PATCH',{id:credit.id,expectedRevision:credit.revision,allocations,deadline:deadline||null,description,acknowledgeDeficit:ack}));done();});}
  return <form className={panel+' space-y-4'} onSubmit={save}><h2 className="font-bold text-xl">Editar {credit.number}</h2><fieldset disabled={busy} className="space-y-4"><Field label="Prazo"><input className={input} type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></Field><Field label="Observações"><textarea className={input} value={description} onChange={e=>setDescription(e.target.value)}/></Field><Rateio centers={centers} total={credit.totalCents} initial={credit.allocations} commitments={commitments} onChange={(a,b)=>{setAllocations(a);setPreview(b);setAck(false);}}/>{deficit&&<label className="flex gap-2"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} required/>Confirmo a conciliação do déficit decorrente do rateio.</label>}<button className={button} disabled={busy||!preview||deficit&&!ack}>Salvar alterações</button></fieldset></form>;
}
export function NeForm({user,run,busy,done,credits,centers}:{credits:Credit[];centers:Center[]}&Common){
  const [preview,setPreview]=useState<NePreview|null>(null);
  const [draft,setDraft]=useState<ParsedEmpenhoPdfResult|null>(null);
  const [creditId,setCreditId]=useState('');
  const [centerId,setCenterId]=useState('');
  const [cellId,setCellId]=useState('');
  const [detail,setDetail]=useState<{credit:Credit;balance:Balance}|null>(null);
  const [review,setReview]=useState(false);
  const [ack,setAck]=useState(false);
  const selected=detail?.credit.id===creditId?detail:null;
  const selectedCell=selected&&cells(selected.credit).find(c=>c.cellId===cellId);
  const centerBalance=selected?.balance.centers.find(c=>c.centerId===centerId);
  const amount=draft?Math.round(draft.valorTotal*100):0;
  const deficit=!!selected&&!!centerId&&(amount>selected.balance.availableCents||amount>(centerBalance?.availableCents??0));
  const fields=[['naturezaDespesa','nd','ND'],['planoInterno','pi','PI'],['ptres','ptres','PTRES'],['fonteRecurso','fonte','Fonte'],['ugr','ugr','UGR']] as const;
  const mismatches=draft&&selectedCell?fields.filter(([a,b])=>!draft[a]||draft[a]!==selectedCell[b]):[];
  async function load(file:File){setPreview(null);setDraft(null);setReview(false);setAck(false);await run(async signal=>{const p=await importDocument<ParsedEmpenhoPdfResult>(user,'ne',file,signal);setPreview(p);setDraft(p.result);});}
  async function selectCredit(id:string){setCreditId(id);setCellId('');setDetail(null);setReview(false);setAck(false);if(id)await run(async signal=>{setDetail(await api(user,'/notas-credito?id='+encodeURIComponent(id),signal));});}
  async function save(e:FormEvent){e.preventDefault();if(!draft||!selected||!selectedCell||!centerId||!review||deficit&&!ack)return;await run(async signal=>{await api(user,'/notas-empenho',signal,json('POST',{draft:{...draft,...(preview?.draftToken?{draftToken:preview.draftToken}:{}),...(preview?.token?{token:preview.token}:{}),...(preview?.proof?{proof:preview.proof}:{})},creditId,centerId,cellId,acknowledgeDeficit:ack,expectedCreditRevision:selected.credit.revision}));done();});}
  return <section className={panel+' space-y-4'}><h2 className="text-xl font-bold">Registrar nota de empenho</h2><Field label="PDF da NE"><input className={input} type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);e.target.value='';}}/></Field>
  {draft&&<form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><p className="font-bold">{draft.id} · {money(amount)}</p><p>{draft.supplier} · {draft.supplierCnpj} · {localDate(draft.date)}</p><p className="whitespace-pre-wrap">{draft.description}</p><p>NC sugerida pelo PDF: {draft.notaCredito||'Não identificada'}. Selecione e confira o vínculo.</p>{draft.warnings.map((w,i)=><Notice key={i}>{w}</Notice>)}
  <Field label="Nota de crédito"><select className={input} required value={creditId} onChange={e=>void selectCredit(e.target.value)}><option value="">Selecione</option>{credits.map(c=><option key={c.id} value={c.id}>{c.number} — {money(c.totalCents)}</option>)}</select></Field>
  <Field label="Centro de custos"><select className={input} required value={centerId} onChange={e=>{setCenterId(e.target.value);setReview(false);setAck(false);}}><option value="">Selecione</option>{centers.filter(c=>c.active).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></Field>
  <Field label="Célula orçamentária"><select className={input} required value={cellId} onChange={e=>{setCellId(e.target.value);setReview(false);}}><option value="">Selecione</option>{selected&&cells(selected.credit).map(c=><option key={c.cellId} value={c.cellId}>{c.nd} · {c.pi} · {c.ptres} · {money(c.cents)}</option>)}</select></Field>
  <div className="grid gap-2 sm:grid-cols-3">{fields.map(([k,b,label])=><Field key={k} label={label+' da NE'}><input className={input} required value={draft[k]||''} readOnly={Boolean(preview?.result[k])} onChange={e=>{setDraft({...draft,[k]:e.target.value});setReview(false);}}/>{selectedCell&&<span className="text-xs text-slate-500">NC: {selectedCell[b]||'Não informado'}</span>}</Field>)}</div>
  {mismatches.length>0&&<Notice>Confira divergências ou campos ausentes: {mismatches.map(x=>x[2]).join(', ')}. A validação final é feita pelo servidor.</Notice>}
  {selected&&<p>Saldo global: {money(selected.balance.availableCents)} · Saldo do centro: {money(centerBalance?.availableCents??0)}</p>}
  {deficit&&<label className="flex gap-2"><input type="checkbox" checked={ack} required onChange={e=>setAck(e.target.checked)}/> A NE já foi emitida e exige registro com conciliação explícita do déficit; não é planejamento de novo gasto.</label>}
  <label className="flex gap-2"><input type="checkbox" checked={review} required onChange={e=>setReview(e.target.checked)}/> Conferi o documento, o centro, a NC e a célula.</label><button className={button} disabled={busy||!selectedCell||!review||deficit&&!ack}>Registrar empenho</button></fieldset></form>}</section>;
}
export function MovementForm({user,run,busy,done,entityType,entityId,revision}:{entityType:'nc'|'ne';entityId:string;revision:number}&Common){
  const [kind,setKind]=useState('reforco');const [amount,setAmount]=useState('');const [reference,setReference]=useState('');const [reason,setReason]=useState('');const [ack,setAck]=useState(false);const [review,setReview]=useState(false);const [error,setError]=useState('');
  async function save(e:FormEvent){e.preventDefault();setError('');try{const amountCents=cents(amount);await run(async signal=>{await api(user,'/movimentacoes',signal,json('POST',{entityType,entityId,kind,amountCents,reference,reason,expectedRevision:revision,acknowledgeDeficit:ack}));done();});}catch(e){setError(errorText(e));}}
  return <form className={panel+' space-y-3'} onSubmit={save}><h3 className="font-bold">Registrar movimento financeiro</h3><fieldset disabled={busy} className="space-y-3"><Field label="Tipo"><select className={input} value={kind} onChange={e=>setKind(e.target.value)}><option value="reforco">Reforço</option><option value="anulacao">Anulação</option>{entityType==='nc'&&<option value="recolhimento">Recolhimento efetivo</option>}</select></Field><Field label="Valor (R$)"><input className={input} required value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)}/></Field><Field label="Referência do documento"><input className={input} required value={reference} onChange={e=>setReference(e.target.value)}/></Field><Field label="Motivo"><textarea className={input} required value={reason} onChange={e=>setReason(e.target.value)}/></Field><label className="flex gap-2"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> Reconheço eventual déficit de obrigação existente após conciliação.</label><label className="flex gap-2"><input type="checkbox" required checked={review} onChange={e=>setReview(e.target.checked)}/> Confirmo o movimento efetivamente ocorrido.</label>{error&&<Notice>{error}</Notice>}<button className={button} disabled={busy||!review}>Registrar movimento</button></fieldset></form>;
}
