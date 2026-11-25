'use client';
import {useMemo,useState,type ReactNode,type FormEvent} from 'react';
import {CreditRecordPicker} from './CreditRecordPicker';
import {useCreditChoices} from './useCreditChoices';
import {calculateCreditBalance} from '@/lib/controle-credito/creditBalance';
import type {SagHtmlCreditDraft} from '@/lib/controle-credito/sagCreditHtml.mjs';
import type {ParsedEmpenhoPdfResult} from '@/lib/server/empenhoPdfParser';
import {api,json,importDocument,money,cents,cells,isoDate,localDate,errorText,type Credit,type Center,type Commitment,type Balance,type Member,type NcPreview,type NePreview} from '../client';
import type {User} from 'firebase/auth';
import {useCreditDrive} from '../documents/CreditDriveProvider';
import {CreditProfileAvatar} from './CreditProfileAvatar';

export const panel='rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(15,23,42,0.045)]';
export const input='block w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
export const button='rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:opacity-50';
export const secondary='rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-blue-50 disabled:opacity-50';
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="block min-w-0 space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>;}
export function Notice({children}:{children:ReactNode}){return <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{children}</p>;}
type Runner=<T>(task:(signal:AbortSignal)=>Promise<T>)=>Promise<T|undefined>;
type Common={user:User;run:Runner;busy:boolean;done:(message?:string)=>void};
const cellFields=['item','num','esfera','ptres','fonte','nd','ugr','pi'] as const;
const cellLabels={item:'Item',num:'Número',esfera:'Esfera',ptres:'PTRES',fonte:'Fonte',nd:'ND',ugr:'UGR',pi:'PI'};
async function archiveImported(user:User,kind:'nc'|'ne',id:string,file:File|null,signal:AbortSignal,drive:ReturnType<typeof useCreditDrive>){
  if(!file)return 'Cadastro confirmado. Você poderá anexar o original posteriormente na consulta do registro.';
  if(!drive.available())return 'Cadastro confirmado. Conecte o Drive para anexar o original na consulta do registro.';
  try{const body=new FormData();body.set('entityType',kind);body.set('entityId',id);body.set('file',file.type?file:new File([file],file.name,{type:kind==='nc'?'text/html':'application/pdf'}));const result=await api<{document:{shareState?:string;shareCount?:number;shareWarning?:string}}>(user,'/documentos',signal,{method:'POST',headers:drive.headers(),body});return result.document.shareWarning||('Cadastro confirmado e original arquivado no Google Drive.'+(kind==='ne'?(result.document.shareState==='shared'?' Acesso ao original concedido ao centro de custos.':' Nenhuma conta do centro recebeu acesso; sincronize o documento após cadastrar a conta.') : ''));}
  catch(e){if(signal.aborted)throw e;return 'Cadastro financeiro confirmado. Arquivamento pendente: '+errorText(e)+' Consulte o registro para reenviar o original.';}
}
function blankCell(ug:string){return {ug,item:'',num:'',esfera:'',ptres:'',fonte:'',nd:'',ugr:'',pi:'',cents:0};}
function blankDraft(ug:string):SagHtmlCreditDraft{return {number:'',fullNumber:'',issuingUg:'',beneficiaryUg:ug,issueDate:'',operation:'DESCENTRALIZACAO',decentralization:'PROVISAO',sourceSystem:'MANUAL',description:'',deadline:null,documentTotalCents:0,totalCents:0,sequences:[{sequence:'1',totalCents:0,origin:[blankCell(ug)],destination:[blankCell(ug)]}],warnings:[],requiresReview:true};}
function percent(value:string){if(!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value||'0'))throw new Error('Percentual inválido.');return Math.round(Number((value||'0').replace(',','.'))*100);}
export function Rateio({centers,total,initial=[],commitments=[],onChange}:{centers:Center[];total:number;initial?:Credit['allocations'];commitments?:Commitment[];onChange:(allocations:Credit['allocations'],balance:Balance|null)=>void}){
  const [shares,setShares]=useState<Record<string,string>>(()=>Object.fromEntries(initial.map(a=>[a.centerId,String(a.basisPoints/100)])));
  const ids=[...new Set([...centers.filter(c=>c.active).map(c=>c.id),...initial.map(a=>a.centerId),...commitments.map(c=>c.centerId)])];
  const compute=(values:Record<string,string>)=>{try{const a=ids.map(centerId=>({centerId,basisPoints:percent(values[centerId]||'0')})).filter(a=>a.basisPoints>0);return {a,b:calculateCreditBalance(total,a,commitments)};}catch{return {a:[],b:null};}};
  const result=compute(shares);
  function update(values:Record<string,string>){setShares(values);const {a,b}=compute(values);onChange(a,b);}
  return <fieldset className="space-y-2"><legend className="font-bold">Distribuição entre centros de custos</legend>
    {!ids.length&&<Notice>Cadastre centros de custos para distribuir o crédito. É possível manter saldo não distribuído.</Notice>}
    {ids.map(id=><div key={id} className="grid grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] items-center gap-2 text-sm"><label htmlFor={'rateio-'+id} className="flex min-w-0 items-center gap-2"><CreditProfileAvatar profile={id} size={32}/><span className="break-words">{centers.find(c=>c.id===id)?.name||id}</span></label><input id={'rateio-'+id} className={input} type="number" min="0" max="100" step="0.01" value={shares[id]||''} placeholder="0" onChange={e=>update({...shares,[id]:e.target.value})}/><span className="text-right">{result.b?money(result.b.centers.find(c=>c.centerId===id)?.allocatedCents??0):'—'}</span></div>)}
    <button type="button" className={secondary} disabled={!centers.some(c=>c.active)} onClick={()=>{const active=centers.filter(c=>c.active);const q=Math.floor(10000/active.length),r=10000%active.length;update(Object.fromEntries(active.map((c,i)=>[c.id,String((q+(i<r?1:0))/100)])));}}>Distribuir igualmente</button>
    {result.b?<><p>Saldo não distribuído: <strong>{money(result.b.unallocatedCents)}</strong></p>{result.b.overdrawnCenterIds.length>0&&<Notice>Déficit previsto nos centros: {result.b.overdrawnCenterIds.join(', ')}. Confira antes de confirmar.</Notice>}</>:<Notice>Rateio inválido. O limite total é 100%.</Notice>}
  </fieldset>;
}
async function fileBase64(file:File,signal:AbortSignal):Promise<string>{
  const bytes=new Uint8Array(await file.arrayBuffer());if(signal.aborted)throw new DOMException('Operação cancelada','AbortError');
  let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);
}
function ReviewCells({draft,onChange,manual,original}:{draft:SagHtmlCreditDraft;onChange:(d:SagHtmlCreditDraft)=>void;manual:boolean;original?:SagHtmlCreditDraft}){
  function change(sequences:SagHtmlCreditDraft['sequences']){
    const next=sequences.map(s=>({...s,totalCents:s.destination.reduce((a,c)=>a+c.cents,0)}));
    const totalCents=next.reduce((a,s)=>a+s.totalCents,0);onChange({...draft,sequences:next,totalCents,documentTotalCents:manual?totalCents:draft.documentTotalCents});
  }
  function update(si:number,side:'origin'|'destination',ci:number,key:string,value:string){
    change(draft.sequences.map((s,i)=>i!==si?s:{...s,[side]:s[side].map((c,j)=>j!==ci?c:{...c,[key]:key==='cents'?Math.round(Number(value)*100):value.toUpperCase()})}));
  }
  return <div className="space-y-3">{draft.sequences.map((s,si)=><fieldset key={si} className="rounded-lg border p-3 space-y-3"><legend className="font-semibold">Sequencial {s.sequence}</legend>
    {manual&&<Field label="Número do sequencial"><input className={input} required pattern="[0-9]+" value={s.sequence} onChange={e=>change(draft.sequences.map((x,i)=>i===si?{...x,sequence:e.target.value}:x))}/></Field>}
    {(['origin','destination'] as const).map(side=><div key={side} className="space-y-2"><h4 className="font-semibold">{side==='origin'?'Origem':'Destino'}</h4>{s[side].map((c,ci)=><div key={ci} className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
    {cellFields.map(k=><Field key={k} label={cellLabels[k]}><input className={input} value={c[k]??''} required={manual||side==='destination'&&k==='pi'} readOnly={!manual&&(side==='origin'||k!=='pi'||Boolean(original?.sequences[si]?.destination[ci]?.pi))} onChange={e=>update(si,side,ci,k,e.target.value)}/></Field>)}
    <Field label="Valor (R$)"><input className={input} type="number" min="0.01" step="0.01" required readOnly={!manual} value={c.cents?c.cents/100:''} onChange={e=>update(si,side,ci,'cents',e.target.value)}/></Field>
    {manual&&s[side].length>1&&<button type="button" className={secondary} onClick={()=>change(draft.sequences.map((x,i)=>i===si?{...x,[side]:x[side].filter((_,j)=>j!==ci)}:x))}>Remover célula</button>}
    </div>)}{manual&&<button type="button" className={secondary} onClick={()=>change(draft.sequences.map((x,i)=>i===si?{...x,[side]:[...x[side],blankCell(draft.beneficiaryUg)]}:x))}>Adicionar célula</button>}</div>)}
    {manual&&s.origin.reduce((a,b)=>a+b.cents,0)!==s.totalCents&&<Notice>Os totais de origem e destino precisam coincidir.</Notice>}
    {manual&&draft.sequences.length>1&&<button type="button" className={secondary} onClick={()=>change(draft.sequences.filter((_,i)=>i!==si))}>Remover sequencial</button>}
    </fieldset>)}{manual&&<button type="button" className={secondary} onClick={()=>change([...draft.sequences,{sequence:String(draft.sequences.length+1),totalCents:0,origin:[blankCell(draft.beneficiaryUg)],destination:[blankCell(draft.beneficiaryUg)]}])}>Adicionar sequencial</button>}</div>;
}
export function NcForm({user,run,busy,done,member,centers}:{member:Member;centers:Center[]}&Common){
  const drive=useCreditDrive();
  const [adminDeadline,setAdminDeadline]=useState('');
  const [source,setSource]=useState<'html'|'manual'>('html');
  const [draft,setDraft]=useState<SagHtmlCreditDraft|null>(null);
  const [proof,setProof]=useState<NcPreview|null>(null);const [originalFile,setOriginalFile]=useState<File|null>(null);
  const [allocation,setAllocation]=useState<Credit['allocations']>([]);
  const [valid,setValid]=useState(true);
  const [review,setReview]=useState(false);
  function switchMode(mode:'html'|'manual'){setSource(mode);setDraft(mode==='manual'?blankDraft(member.ug):null);setProof(null);setOriginalFile(null);setAllocation([]);setValid(true);setReview(false);}
  async function load(file:File){setDraft(null);setProof(null);setAllocation([]);setValid(true);setReview(false);await run(async signal=>{const p=await importDocument<SagHtmlCreditDraft>(user,'nc',file,signal);setProof(p);setOriginalFile(file);setDraft(p.result);});}
  async function save(e:FormEvent){e.preventDefault();if(!draft||!review||!valid)return;await run(async signal=>{const data=source==='manual'?{...draft,fullNumber:draft.issuingUg+draft.number}:originalFile?{fileBase64:await fileBase64(originalFile,signal),piCorrections:draft.sequences.flatMap((s,i)=>s.destination.flatMap((cell,row)=>!proof?.result.sequences[i]?.destination[row]?.pi&&cell.pi?[{sequence:s.sequence,row,pi:cell.pi}]:[]))}:null;if(!data)throw new Error('Selecione novamente o HTML original.');const saved=await api<{credit:Credit}>(user,'/notas-credito',signal,json('POST',{source,draft:data,allocations:allocation,deadline:draft.deadline,adminDeadline:adminDeadline||null,description:draft.description}));done(await archiveImported(user,'nc',saved.credit.id,source==='html'?originalFile:null,signal,drive));});}
  return <section className={panel+' space-y-4'}><h2 className="text-xl font-bold">Cadastrar nota de crédito</h2><div className="flex flex-wrap gap-2"><button className={source==='html'?button:secondary} disabled={busy} onClick={()=>switchMode('html')}>Importar HTML SAG</button><button className={source==='manual'?button:secondary} disabled={busy} onClick={()=>switchMode('manual')}>Cadastro manual</button></div>
  {source==='html'&&<Field label="Arquivo HTML original"><input className={input} type="file" accept=".html,.htm,text/html" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);e.target.value='';}}/></Field>}
  {draft&&<form className="space-y-4" onSubmit={save}><fieldset disabled={busy} className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">
  <Field label="Número da NC"><input className={input} required readOnly={source==='html'} value={draft.number} onChange={e=>setDraft({...draft,number:e.target.value.toUpperCase()})}/></Field>
  <Field label="UG emitente"><input className={input} required readOnly={source==='html'} value={draft.issuingUg} pattern="[0-9]{6}" onChange={e=>setDraft({...draft,issuingUg:e.target.value})}/></Field>
  <Field label="UG favorecida"><input className={input} readOnly value={member.ug}/></Field>
  <Field label="Emissão"><input className={input} required readOnly={source==='html'} type="date" value={isoDate(draft.issueDate)} onChange={e=>setDraft({...draft,issueDate:e.target.value})}/></Field>
  <Field label="Prazo de empenho (quando informado)"><input className={input} type="date" value={draft.deadline||''} onChange={e=>{setDraft({...draft,deadline:e.target.value||null});setReview(false);}}/></Field>
  <Field label="Prazo da Administração"><input className={input} type="date" value={adminDeadline} onChange={e=>{setAdminDeadline(e.target.value);setReview(false);}}/></Field>
  <Field label="Operação"><input className={input} required readOnly value={draft.operation} onChange={e=>setDraft({...draft,operation:e.target.value})}/></Field>
  <Field label="Descentralização"><input className={input} readOnly value={draft.decentralization} onChange={e=>setDraft({...draft,decentralization:e.target.value})}/></Field>
  </div><Field label="Finalidade / observações"><textarea className={input} required value={draft.description} onChange={e=>{setDraft({...draft,description:e.target.value});setReview(false);}}/></Field>
  {draft.warnings.map((w,i)=><Notice key={i}>{w}</Notice>)}<ReviewCells draft={draft} onChange={d=>{setDraft(d);setReview(false);}} manual={source==='manual'} original={proof?.result}/>
  <p className="font-bold">Total da UG: {money(draft.totalCents)}</p>
  <Rateio key={source} centers={centers} total={draft.totalCents} onChange={(a,b)=>{setAllocation(a);setValid(!!b);setReview(false);}}/>
  <label className="flex gap-2 items-start"><input type="checkbox" required checked={review} onChange={e=>setReview(e.target.checked)}/> Conferi os dados da NC, as células, o prazo e a distribuição.</label>
  <button className={button} disabled={busy||!valid||!review||draft.totalCents<=0}>Registrar crédito</button></fieldset></form>}</section>;
}
export function EditNc({user,run,busy,done,credit,balance,centers}:{credit:Credit;balance:Balance;centers:Center[]}&Common){
  const [allocations,setAllocations]=useState(credit.allocations);
  const [deadline,setDeadline]=useState(credit.deadline||'');
  const [adminDeadline,setAdminDeadline]=useState(credit.adminDeadline||'');
  const [description,setDescription]=useState(credit.description);
  const [preview,setPreview]=useState<Balance|null>(balance);
  const [ack,setAck]=useState(false);
  // Apenas os totais por centro retornados no detalhe autorizado; nunca inferir por página de NEs.
  const commitments=balance.centers.filter(c=>c.committedCents>0).map(c=>({id:'preview-'+c.centerId,centerId:c.centerId,netCents:c.committedCents} as Commitment));
  const deficit=!!preview?.overdrawnCenterIds.length||!!preview?.overdrawn;
  async function save(e:FormEvent){e.preventDefault();if(!preview||deficit&&!ack)return;await run(async signal=>{await api(user,'/notas-credito',signal,json('PATCH',{id:credit.id,expectedRevision:credit.revision,allocations,deadline:deadline||null,adminDeadline:adminDeadline||null,description,acknowledgeDeficit:ack}));done();});}
  return <form className={panel+' space-y-4'} onSubmit={save}><h2 className="font-bold text-xl">Editar {credit.number}</h2><fieldset disabled={busy} className="space-y-4"><Field label="Prazo da NC"><input className={input} type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></Field><Field label="Prazo da Administração"><input className={input} type="date" value={adminDeadline} onChange={e=>setAdminDeadline(e.target.value)}/></Field><Field label="Observações"><textarea className={input} value={description} onChange={e=>setDescription(e.target.value)}/></Field><Rateio centers={centers} total={credit.totalCents} initial={credit.allocations} commitments={commitments} onChange={(a,b)=>{setAllocations(a);setPreview(b);setAck(false);}}/>{deficit&&<label className="flex gap-2"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} required/>Confirmo a conciliação do déficit decorrente do rateio.</label>}<button className={button} disabled={busy||!preview||deficit&&!ack}>Salvar alterações</button></fieldset></form>;
}
export function NeForm({user,run,busy,done,credits,centers,initialCreditId,year}:{credits:(Credit & {balance:Balance})[];centers:Center[];initialCreditId?:string;year:string}&Common){
  const [preview,setPreview]=useState<NePreview|null>(null);const [originalFile,setOriginalFile]=useState<File|null>(null);
  const [draft,setDraft]=useState<ParsedEmpenhoPdfResult|null>(null);
  const [creditId,setCreditId]=useState(initialCreditId||'');
  const [chosen,setChosen]=useState<(Credit & {balance:Balance})|null>(credits.find(c=>c.id===initialCreditId)||null);
  const [catalogOpen,setCatalogOpen]=useState(false);
  const catalog=useCreditChoices(user,year,catalogOpen&&!initialCreditId);
  const choices=useMemo(()=>{const all=new Map(catalog.choices.map(c=>[c.id,c]));if(chosen)all.set(chosen.id,{id:chosen.id,number:chosen.number,description:chosen.description,deadline:chosen.deadline,availableCents:chosen.balance.availableCents});return [...all.values()].map(c=>({id:c.id,title:c.number,subtitle:'Saldo '+money(c.availableCents)+' · Prazo '+localDate(c.deadline),detail:c.description.slice(0,90),search:c.description}));},[catalog.choices,chosen]);
  const [manual,setManual]=useState(false);const [budgetAck,setBudgetAck]=useState(false);
  const [centerId,setCenterId]=useState('');
  const [cellId,setCellId]=useState('');

  const [review,setReview]=useState(false);
  const [ack,setAck]=useState(false);
  const matching=chosen?.id===creditId?chosen:null;const selected=matching?{credit:matching,balance:matching.balance}:null;
  const selectedCell=selected&&cells(selected.credit).find(c=>c.cellId===cellId);
  const centerBalance=selected?.balance.centers.find(c=>c.centerId===centerId);
  const amount=draft?Math.round(draft.valorTotal*100):0;
  const deficit=!!selected&&!!centerId&&(amount>selected.balance.availableCents||amount>(centerBalance?.availableCents??0)||(selectedCell?.availableCents!==undefined&&amount>selectedCell.availableCents));
  const fields=[['naturezaDespesa','nd','Natureza da despesa (ND)'],['planoInterno','pi','Plano interno (PI)'],['ptres','ptres','Programa de trabalho (PTRES)'],['fonteRecurso','fonte','Fonte de recursos'],['ugr','ugr','UG responsável (UGR)']] as const;
  const mismatches=draft&&selectedCell?fields.filter(([a,b])=>!draft[a]||draft[a]!==selectedCell[b]):[];
  async function load(file:File){setPreview(null);setDraft(null);setReview(false);setAck(false);setBudgetAck(false);await run(async signal=>{const p=await importDocument<ParsedEmpenhoPdfResult>(user,'ne',file,signal);setPreview(p);setOriginalFile(file);setDraft(p.result);const candidates=selected?cells(selected.credit).filter(c=>fields.every(([a,b])=>!p.result[a]||p.result[a]===c[b])):[];if(candidates.length===1)setCellId(candidates[0].cellId||'');else if(selected&&cells(selected.credit).length===1)setCellId(cells(selected.credit)[0].cellId||'');else setCellId('');const eligible=selected?.balance.centers.filter(c=>c.allocatedCents>0&&centers.some(x=>x.id===c.centerId&&x.active))??[];if(eligible.length===1)setCenterId(eligible[0].centerId);else setCenterId('');});}
  function selectCredit(id:string){if(id===creditId)return;setCreditId('');setChosen(null);setCellId('');setCenterId('');setDraft(null);setPreview(null);setOriginalFile(null);setManual(false);setReview(false);setAck(false);setBudgetAck(false);if(id)void run(async signal=>{const d=await api<{credit:Credit;balance:Balance;cells:import('../client').Cell[]}>(user,'/notas-credito?id='+encodeURIComponent(id),signal);setChosen({...d.credit,balance:d.balance,cells:d.cells});setCreditId(id);});}
  async function save(e:FormEvent){e.preventDefault();if(!draft||!originalFile||!selected||!selectedCell||!centerId||!review||deficit&&!ack||mismatches.length>0&&!budgetAck)return;await run(async signal=>{const saved=await api<{commitment:Commitment}>(user,'/notas-empenho',signal,json('POST',{draft:{fileBase64:await fileBase64(originalFile!,signal),budget:{nd:draft.naturezaDespesa,pi:draft.planoInterno,ptres:draft.ptres,fonte:draft.fonteRecurso,ugr:draft.ugr}},creditId,centerId,cellId,acknowledgeDeficit:ack,acknowledgeBudgetDifference:budgetAck,expectedCreditRevision:selected.credit.revision}));done('NE '+saved.commitment.number+' cadastrada. Saldo atualizado; arquivo original não armazenado.');});}
  return <section className={panel+' space-y-5'}><h2 className="font-montserrat text-xl font-bold">Cadastrar nota de empenho</h2><div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">{['1 · Selecionar NC','2 · Cadastrar NE','3 · Confirmar'].map((label,i)=><div key={label} className={'rounded-xl border p-3 '+((i===0&&!selected||i===1&&selected&&!draft||i===2&&draft)?'border-blue-300 bg-blue-50 text-blue-800':'border-slate-200 bg-slate-50 text-slate-600')}>{label}</div>)}</div>
  <CreditRecordPicker label="1. Nota de crédito" placeholder="Localizar e selecionar NC" options={choices} value={creditId} onChange={selectCredit} disabled={busy||!!initialCreditId} loading={catalog.loading} onOpen={()=>setCatalogOpen(true)}/>{catalog.error&&<div className="flex flex-wrap items-center gap-2"><Notice>{catalog.error}</Notice><button type="button" className={secondary} onClick={catalog.retry}>Tentar novamente</button></div>}
  {!selected&&<p className="text-sm text-slate-500">Também é possível cadastrar diretamente na aba Notas de Crédito, selecionando a NC desejada.</p>}
  {selected&&<><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">NC vinculada: <strong>{selected.credit.number}</strong> · Saldo {money(selected.balance.availableCents)}</div><div className="flex flex-wrap gap-2"><button type="button" className={!manual?button:secondary} disabled={busy} onClick={()=>{setManual(false);setDraft(null);setOriginalFile(null);setReview(false);setBudgetAck(false);}}>Importar HTML / PDF</button><button type="button" className={manual?button:secondary} disabled={busy} onClick={()=>{setManual(true);setDraft(null);setOriginalFile(null);setReview(false);setBudgetAck(false);}}>Cadastro manual</button></div>{manual?<ManualNeForm user={user} run={run} busy={busy} done={done} credit={selected.credit} balance={selected.balance} centers={centers}/>:<Field label="2. HTML SAG ou PDF da nota de empenho"><input className={input} type="file" accept=".html,.htm,text/html,.pdf,application/pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void load(file);e.target.value='';}}/></Field>}</>}
  {!manual&&draft&&selected&&<form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><div className="rounded-xl bg-slate-50 p-4"><p className="font-mono text-lg font-bold">{draft.id} · {money(amount)}</p><p className="text-sm text-slate-600">{draft.supplier} · {draft.supplierCnpj} · {localDate(draft.date)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{draft.description}</p><p className="mt-2 text-xs text-slate-500">NC indicada no documento: {draft.notaCredito||'Não identificada'}</p></div>{draft.warnings.map((w,i)=><Notice key={i}>{w}</Notice>)}
  <CreditRecordPicker label="Centro de custos" placeholder="Selecionar centro" value={centerId} options={centers.filter(c=>c.active&&selected.balance.centers.some(x=>x.centerId===c.id&&x.basisPoints>0)).map(c=>({id:c.id,title:c.name,subtitle:c.id}))} onChange={id=>{setCenterId(id);setReview(false);setAck(false);setBudgetAck(false);}} disabled={busy}/>
  <CreditRecordPicker label="Célula orçamentária" placeholder="Localizar célula" value={cellId} options={selected?cells(selected.credit).map(c=>({id:c.cellId||'',title:c.nd+' · '+(c.pi||'Sem PI'),subtitle:'PTRES '+c.ptres+' · '+money(c.cents),detail:c.fonte+' · '+c.ugr})).filter(c=>c.id):[]} onChange={id=>{setCellId(id);setReview(false);setAck(false);setBudgetAck(false);}} disabled={busy}/>
  <div className="grid gap-2 sm:grid-cols-3">{fields.map(([k,b,label])=><Field key={k} label={label+' da NE'}><input className={input} required value={draft[k]||''} readOnly={(k==='planoInterno'?/^[A-Z0-9]{1,20}$/:k==='fonteRecurso'?/^[0-9]{10}$/:/^[0-9]{6}$/).test(preview?.result[k]||'')} onChange={e=>{setDraft({...draft,[k]:e.target.value});setReview(false);setAck(false);setBudgetAck(false);}}/>{selectedCell&&<span className="text-xs text-slate-500">NC: {selectedCell[b]||'Não informado'}</span>}</Field>)}</div>
  {mismatches.length>0&&<div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Dados orçamentários diferentes — o registro pode continuar</strong><p>O empenho será abatido da NC e da célula selecionadas. Os dados originais não serão modificados.</p><ul className="space-y-1">{mismatches.map(([a,b,label])=><li key={a}><strong>{label}:</strong> NC {selectedCell?.[b]||'não informado'} · NE {draft[a]||'não informado'}</li>)}</ul><label className="flex gap-2"><input type="checkbox" checked={budgetAck} required onChange={e=>setBudgetAck(e.target.checked)}/> Estou ciente das diferenças e confirmo o vínculo desta NE.</label></div>}
  {selected&&<p>Saldo global: {money(selected.balance.availableCents)} · Saldo do centro: {money(centerBalance?.availableCents??0)}{selectedCell?.availableCents!==undefined?' · Saldo da célula: '+money(selectedCell.availableCents):''}</p>}
  {deficit&&<label className="flex gap-2"><input type="checkbox" checked={ack} required onChange={e=>setAck(e.target.checked)}/> A NE já foi emitida e exige registro com conciliação explícita do déficit; não é planejamento de novo gasto.</label>}
  <label className="flex gap-2"><input type="checkbox" checked={review} required onChange={e=>setReview(e.target.checked)}/> Conferi o documento, o centro, a NC e a célula.</label><button className={button} disabled={busy||!selectedCell||!review||deficit&&!ack||mismatches.length>0&&!budgetAck}>Confirmar cadastro da NE</button></fieldset></form>}</section>;
}
export function MovementForm({user,run,busy,done,entityType,entityId,revision,credit}:{entityType:'nc'|'ne';entityId:string;revision:number;credit?:Credit}&Common){
  const [cellId,setCellId]=useState('');const [kind,setKind]=useState('reforco');const [amount,setAmount]=useState('');const [reference,setReference]=useState('');const [reason,setReason]=useState('');const [ack,setAck]=useState(false);const [review,setReview]=useState(false);const [error,setError]=useState('');
  async function save(e:FormEvent){e.preventDefault();setError('');if(credit&&cells(credit).length>1&&!cellId){setError('Selecione a célula do movimento.');return;}try{const amountCents=cents(amount);await run(async signal=>{await api(user,'/movimentacoes',signal,json('POST',{entityType,entityId,kind,amountCents,reference,reason,expectedRevision:revision,acknowledgeDeficit:ack,...(cellId?{cellId}:{})}));done();});}catch(e){setError(errorText(e));}}
  return <form className={panel+' space-y-3'} onSubmit={save}><h3 className="font-bold">Registrar movimento financeiro</h3><fieldset disabled={busy} className="space-y-3"><Field label="Tipo"><select className={input} value={kind} onChange={e=>setKind(e.target.value)}><option value="reforco">Reforço</option><option value="anulacao">Anulação</option>{entityType==='nc'&&<option value="recolhimento">Recolhimento efetivo</option>}</select></Field>{credit&&cells(credit).length>1&&<CreditRecordPicker label="Célula do movimento" placeholder="Localizar célula" value={cellId} options={cells(credit).map(c=>({id:c.cellId||'',title:c.nd+' · '+(c.pi||'Sem PI'),subtitle:'PTRES '+c.ptres,detail:c.cellId})).filter(c=>c.id)} onChange={id=>{setCellId(id);setReview(false);setAck(false);}} disabled={busy}/>}<Field label="Valor (R$)"><input className={input} required value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)}/></Field><Field label="Referência do documento"><input className={input} required value={reference} onChange={e=>setReference(e.target.value)}/></Field><Field label="Motivo"><textarea className={input} required value={reason} onChange={e=>setReason(e.target.value)}/></Field><label className="flex gap-2"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> Reconheço eventual déficit de obrigação existente após conciliação.</label><label className="flex gap-2"><input type="checkbox" required checked={review} onChange={e=>setReview(e.target.checked)}/> Confirmo o movimento efetivamente ocorrido.</label>{error&&<Notice>{error}</Notice>}<button className={button} disabled={busy||!review}>Registrar movimento</button></fieldset></form>;
}

function ManualNeForm({user,run,busy,done,credit,balance,centers}:{credit:Credit;balance:Balance;centers:Center[]}&Common){
  const available=cells(credit);
  const [cellId,setCellId]=useState(available.length===1?available[0].cellId||'':'');
  const [centerId,setCenterId]=useState('');
  const [draft,setDraft]=useState({number:'',issueDate:'',supplier:'',supplierCnpj:'',description:'',amount:'',nd:'',ptres:'',fonte:'',ugr:'',pi:''});
  const [confirmed,setConfirmed]=useState(false),[ack,setAck]=useState(false),[budgetAck,setBudgetAck]=useState(false);
  const chosen=available.find(c=>c.cellId===cellId);
  const fields=[['nd','ND'],['ptres','PTRES'],['fonte','Fonte'],['ugr','UGR'],['pi','PI']] as const;
  const differences=chosen?fields.filter(([key])=>draft[key]!==chosen[key]):[];
  let amount=0;try{amount=cents(draft.amount);}catch{}
  const deficit=!!chosen&&!!centerId&&amount>0&&(amount>balance.availableCents||amount>(balance.centers.find(c=>c.centerId===centerId)?.availableCents??0)||amount>(chosen.availableCents??chosen.cents));
  function reset(){setConfirmed(false);setAck(false);setBudgetAck(false);}
  function change(key:keyof typeof draft,value:string){setDraft(d=>({...d,[key]:value}));reset();}
  async function save(e:FormEvent){e.preventDefault();if(!chosen||!centerId||!confirmed||!amount||deficit&&!ack||differences.length>0&&!budgetAck)return;
    await run(async signal=>{const {amount:_amount,...data}=draft;await api(user,'/notas-empenho',signal,json('POST',{source:'manual',draft:{...data,netCents:cents(draft.amount)},creditId:credit.id,centerId,cellId,expectedCreditRevision:credit.revision,acknowledgeDeficit:ack,acknowledgeBudgetDifference:budgetAck}));done('NE cadastrada. Saldo atualizado.');});
  }
  return <form onSubmit={save} className="space-y-4 rounded-xl border border-blue-100 bg-slate-50 p-4"><p className="text-sm text-blue-900">Informe os dados da NE já emitida. Nenhum arquivo original será armazenado.</p><fieldset disabled={busy} className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Número da NE"><input className={input} required pattern="20[0-9]{2}NE[0-9]{6}" placeholder="2026NE000001" value={draft.number} onChange={e=>change('number',e.target.value.toUpperCase())}/></Field><Field label="Emissão"><input className={input} type="date" required value={draft.issueDate} onChange={e=>change('issueDate',e.target.value)}/></Field><Field label="Fornecedor / favorecido"><input className={input} required value={draft.supplier} onChange={e=>change('supplier',e.target.value)}/></Field><Field label="CPF ou CNPJ"><input className={input} required value={draft.supplierCnpj} onChange={e=>change('supplierCnpj',e.target.value)}/></Field><Field label="Valor líquido (R$)"><input className={input} inputMode="decimal" required placeholder="0,00" value={draft.amount} onChange={e=>change('amount',e.target.value)}/></Field><CreditRecordPicker label="Centro de custos" placeholder="Selecionar centro" value={centerId} options={centers.filter(c=>c.active).map(c=>({id:c.id,title:c.name,subtitle:c.id}))} onChange={id=>{setCenterId(id);reset();}} disabled={busy}/></div>
    <Field label="Finalidade"><textarea className={input} required value={draft.description} onChange={e=>change('description',e.target.value)}/></Field>
    <CreditRecordPicker label="Célula de crédito" placeholder="Localizar célula" value={cellId} options={available.map(c=>({id:c.cellId||'',title:c.nd+' · '+(c.pi||'Sem PI'),subtitle:money(c.cents),detail:'PTRES '+c.ptres+' · '+c.fonte})).filter(c=>c.id)} onChange={id=>{setCellId(id);reset();}} disabled={busy}/>
    {chosen&&<button type="button" className={secondary} onClick={()=>{setDraft(d=>({...d,nd:chosen.nd,ptres:chosen.ptres,fonte:chosen.fonte||'',ugr:chosen.ugr,pi:chosen.pi||''}));reset();}}>Copiar dados da célula da NC para conferência</button>}
    <div className="grid gap-2 sm:grid-cols-3">{fields.map(([key,label])=><Field key={key} label={label+' da NE'}><input className={input} required value={draft[key]} onChange={e=>change(key,e.target.value.toUpperCase())}/>{chosen&&<span className="text-xs text-slate-500">NC: {chosen[key]||'Não informado'}</span>}</Field>)}</div>
    {differences.length>0&&<div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><p className="font-bold">Diferenças entre NC e NE</p>{differences.map(([key,label])=><p key={key}>{label}: NC {chosen?.[key]||'não informado'} · NE {draft[key]||'não informado'}</p>)}<label className="mt-2 flex gap-2"><input type="checkbox" checked={budgetAck} required onChange={e=>setBudgetAck(e.target.checked)}/> Estou ciente e confirmo o vínculo.</label></div>}
    {deficit&&<label className="flex gap-2"><input type="checkbox" required checked={ack} onChange={e=>setAck(e.target.checked)}/> Estou ciente de que o registro de uma NE já emitida gera déficit no saldo.</label>}
    <label className="flex gap-2"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Conferi os dados da NE emitida.</label>
    <button className={button} disabled={busy||!chosen||!confirmed||!amount||deficit&&!ack||differences.length>0&&!budgetAck}>Confirmar cadastro sem PDF</button>
  </fieldset></form>;
}
export function ReplaceNeForm({user,run,busy,done,commitment}:{commitment:Commitment}&Common){
  const drive=useCreditDrive();
  type UpdatedNePreview=ParsedEmpenhoPdfResult & {number:string;netCents:number;issueDate:string};
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<UpdatedNePreview|null>(null),[ack,setAck]=useState(false);
  async function load(f:File){setFile(null);setPreview(null);setAck(false);await run(async signal=>{const p=await importDocument<UpdatedNePreview>(user,'ne',f,signal,true);setPreview(p.result);setFile(f);});}
  const newValue=preview?.netCents??null;
  const returned=newValue===null?0:commitment.netCents-newValue;
  const valid=!!preview&&!!file&&preview.number===commitment.number&&preview.issueDate===commitment.issueDate&&preview.supplierCnpj.replace(/\D/g,'')===commitment.supplierCnpj.replace(/\D/g,'')&&newValue!==null&&returned>=0&&!preview.warnings.some(w=>/diverge|divergência/i.test(w));
  async function save(e:FormEvent){e.preventDefault();if(!file||!valid||!ack)return;await run(async signal=>{await api<{commitment:Commitment}>(user,'/notas-empenho',signal,{...json('PATCH',{id:commitment.id,expectedRevision:commitment.revision,confirmed:true,draft:{fileBase64:await fileBase64(file,signal)}}),headers:{'Content-Type':'application/json',...(drive.available()?drive.headers():{})}});const message='Arquivo não armazenado.';done('NE atualizada. '+money(returned)+' devolvidos ao saldo da NC. '+message);});}
  return <section className={panel+' space-y-4'}><h2 className="font-montserrat text-xl font-bold">Substituir PDF da NE {commitment.number}</h2><p className="text-sm text-slate-600">Importe a impressão consolidada da mesma NE após a anulação. A diferença do valor líquido retorna ao saldo da NC e o histórico é preservado. Para reforços, use Registrar ajuste.</p><form className="space-y-4" onSubmit={save}><fieldset disabled={busy} className="space-y-4"><Field label="PDF atualizado"><input className={input} type="file" accept=".pdf,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);e.target.value='';}}/></Field>{preview&&<><div className="grid gap-3 sm:grid-cols-3">{[['Valor anterior',commitment.netCents],['Novo valor',newValue??0],['Retorno à NC',returned]].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-lg">{money(Number(value))}</p></div>)}</div>{preview.warnings.map((w,i)=><Notice key={i}>{w}</Notice>)}{!valid&&<Notice>Confira se o PDF é da mesma NE e se representa o valor líquido consolidado, igual ou menor que o valor registrado.</Notice>}<label className="flex gap-2"><input type="checkbox" required checked={ack} onChange={e=>setAck(e.target.checked)}/> Confirmo a substituição e o novo valor registrado. O documento anterior permanecerá no histórico.</label><button className={button} disabled={!valid||!ack||busy}>Confirmar substituição</button></>}</fieldset></form></section>;
}
