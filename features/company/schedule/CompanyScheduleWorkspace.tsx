'use client';
import {useCallback,useEffect,useState} from 'react';
type Timeline={customerOrderId:string;customerOrderLineId:string;quantity:{value:string;unit:string};
 dispatched:{value:string;unit:string};requestedDelivery?:{value:string}|null;
 approvedPromise?:{next:string;approvedByUid:string;approvalDocumentId:string}|null;
 schedulePlanRevision:number;risk:{risk:string;reasons:string[];eta:null};
 inboundSources:Array<{purchaseOrderId:string;workflowState:string;supplierPromisedAt?:{value:string}}>;partialCoverage:boolean};
type Page={items:Timeline[];nextCursor:string|null;purchasesTruncated:boolean};
type Props={getIdToken:()=>Promise<string>};
const stamp=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'w9_'+Date.now();
const fmt=(v?:string|null)=>v?new Date(v).toLocaleString('pt-BR'):'Não informado';
export function CompanyScheduleWorkspace({getIdToken}:Props){
 const [items,setItems]=useState<Timeline[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [incomplete,setIncomplete]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState<Timeline|null>(null);
 const [promise,setPromise]=useState(''),[reason,setReason]=useState(''),[proof,setProof]=useState('');
 const api=useCallback(async<T,>(url:string,method='GET',body?:unknown):Promise<T>=>{
  const token=await getIdToken();
  const response=await fetch(url,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,
   ...(body===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':stamp()})},
   body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await response.json() as {ok:boolean;result?:T;code?:string};
  if(!response.ok||!raw.ok||raw.result===undefined)throw new Error(raw.code||'Falha ao consultar serviço');
  return raw.result;
 },[getIdToken]);
 const reload=useCallback(async(next='')=>{
  setBusy(true);setError('');
  try{const p=await api<Page>('/api/company/schedule?limit=20'+(next?'&cursor='+encodeURIComponent(next):''));
   setItems(p.items);setCursor(p.nextCursor);setIncomplete(p.purchasesTruncated);}
  catch(e){setError(e instanceof Error?e.message:'Falha inesperada');}
  finally{setBusy(false);}
 },[api]);
 useEffect(()=>{void reload();},[reload]);
 const save=async()=>{
  if(!selected||!promise)return;
  setBusy(true);setError('');
  try{
   await api('/api/company/schedule','POST',{
    customerOrderId:selected.customerOrderId,customerOrderLineId:selected.customerOrderLineId,
    promisedAt:new Date(promise).toISOString(),reason,approvalDocumentId:proof,
    approved:true,expectedRevision:selected.schedulePlanRevision,
   });
   setSelected(null);setReason('');setProof('');setPromise('');await reload();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao registrar promessa');}
  finally{setBusy(false);}
 };
 return <section aria-label="Cronogramas de compras e entregas" className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div>
   <h2 className="text-lg font-bold text-slate-900">Cronograma integrado</h2>
   <p className="text-sm text-slate-600">Datas solicitadas, promessas de fornecedores e expedição W7. ETA não estimada sem fonte.</p>
  </div><button type="button" disabled={busy} onClick={()=>void reload()} className="rounded-xl border px-4 py-2 text-sm">Atualizar</button></header>
  {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  {incomplete&&<p role="status" className="rounded-xl border border-amber-200 p-3 text-sm">Consulta parcial: há mais de 50 compras; o risco pode estar incompleto.</p>}
  {!items.length&&!busy&&<p className="rounded-xl border p-5 text-sm">Nenhum pedido OM disponível para cruzamento de prazos.</p>}
  <ul className="space-y-3">{items.map(x=><li key={x.customerOrderId+':'+x.customerOrderLineId} className="rounded-2xl border bg-white p-4">
   <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">Pedido {x.customerOrderId} · Linha {x.customerOrderLineId}</h3>
    <span className={'rounded-full px-3 py-1 text-xs font-semibold '+(x.risk.risk==='at_risk'?'bg-amber-100 text-amber-900':'bg-slate-100 text-slate-700')}>{x.risk.risk==='at_risk'?'Atenção ao prazo':x.risk.risk==='ready_to_deliver'?'Expedição registrada':'Aguardando confirmação'}</span></div>
   <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
    <p>Quantidade pedida: <strong>{x.quantity.value} {x.quantity.unit}</strong></p>
    <p>Expedida pelo W7: <strong>{x.dispatched.value} {x.dispatched.unit}</strong></p>
    <p>Data solicitada: {fmt(x.requestedDelivery?.value)}</p>
    <p>Promessa aprovada: {fmt(x.approvedPromise?.next)}</p>
    <p>Última previsão de fornecedor: {fmt(x.inboundSources.map(p=>p.supplierPromisedAt?.value||'').filter(Boolean).sort().at(-1))}</p>
    <p>ETA de rota: não disponível (sem cálculo)</p>
   </div>
   {x.risk.reasons.length>0&&<p className="mt-3 text-sm font-medium text-amber-800">Riscos: {x.risk.reasons.join(' · ')}</p>}
   <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="button" disabled={busy}
    onClick={()=>{setSelected(x);setPromise('');setReason('');setProof('');}}>Registrar renegociação aprovada</button>
  </li>)}</ul>
  {cursor&&<button type="button" className="rounded-lg border p-2" disabled={busy} onClick={()=>void reload(cursor)}>Próxima página</button>}
  {selected&&<form className="space-y-3 rounded-2xl border bg-slate-50 p-5" onSubmit={e=>{e.preventDefault();void save();}}>
   <h3 className="font-semibold">Nova promessa · {selected.customerOrderId}/{selected.customerOrderLineId}</h3>
   <p className="text-sm">Somente após aprovação humana/documental da OM. A data pedida originalmente permanece preservada.</p>
   <label className="block text-sm">Data e hora prometida<input required type="datetime-local" value={promise} onChange={e=>setPromise(e.target.value)}
    className="mt-1 block w-full rounded-lg border p-2"/></label>
   <label className="block text-sm">Justificativa de aprovação<input required minLength={12} value={reason} onChange={e=>setReason(e.target.value)}
    className="mt-1 block w-full rounded-lg border p-2"/></label>
   <label className="block text-sm">ID do documento de autorização da OM (anexado pelo W5)<input required value={proof} onChange={e=>setProof(e.target.value)}
    className="mt-1 block w-full rounded-lg border p-2"/></label>
   <div className="flex gap-2"><button type="submit" disabled={busy} className="rounded-lg bg-blue-800 px-4 py-2 text-white">Registrar decisão</button>
    <button type="button" className="rounded-lg border px-4 py-2" onClick={()=>setSelected(null)}>Cancelar</button></div>
  </form>}
 </section>;
}
