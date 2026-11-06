'use client';
import {useCallback,useEffect,useState} from 'react';
import type {PurchaseOrder,PurchaseEvent} from '../../../lib/company/purchases/domain';
import {CompanyInboundTimeline} from '../inbound/CompanyInboundTimeline';
type ApiResult<T>={ok:true;result:T}|{ok:false;code:string;error:string};
type ListResult={items:PurchaseOrder[];nextCursor:string|null};
type Props={getIdToken:()=>Promise<string>};
const stamp=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():'manual_'+Date.now().toString(36);
export function CompanyPurchasesWorkspace({getIdToken}:Props){
  const [items,setItems]=useState<PurchaseOrder[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [selected,setSelected]=useState<PurchaseOrder|null>(null);
  const [events,setEvents]=useState<PurchaseEvent[]>([]);
  const [loading,setLoading]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [draft,setDraft]=useState('{\n  "sourceSupplierId": "",\n  "reference": "",\n  "desiredAt": "2026-12-01T12:00:00Z",\n  "lines": []\n}');
  const [change,setChange]=useState('{\n  "action": "sent",\n  "expectedRevision": 1,\n  "channel": "email",\n  "confirmationRef": "",\n  "confirmedByOperator": true\n}');
  const request=useCallback(async<T,>(url:string,method='GET',payload?:unknown):Promise<T>=>{
    const bearer=await getIdToken();
    const response=await fetch(url,{method,cache:'no-store',headers:{
      Authorization:'Bearer '+bearer,...(payload===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':stamp()})
    },body:payload===undefined?undefined:JSON.stringify(payload)});
    const result=await response.json() as ApiResult<T>;
    if(!response.ok||!result.ok)throw new Error(result.ok?'Resposta inesperada':result.code);
    return result.result;
  },[getIdToken]);
  const reload=useCallback(async(next='')=>{
    setLoading(true);setFeedback('');
    try{
      const page=await request<ListResult>('/api/company/purchases?limit=20'+(next?'&cursor='+encodeURIComponent(next):''));
      setItems(page.items);setCursor(page.nextCursor);
    }catch(e){setFeedback(e instanceof Error?e.message:'Falha ao consultar compras');}
    finally{setLoading(false);}
  },[request]);
  useEffect(()=>{void reload();},[reload]);
  const open=async(id:string)=>{
    setLoading(true);setFeedback('');
    try{
      const [purchase,page]=await Promise.all([
        request<PurchaseOrder>('/api/company/purchases/'+encodeURIComponent(id)),
        request<{items:PurchaseEvent[]}>('/api/company/purchases/'+encodeURIComponent(id)+'/events?limit=50')
      ]);
      setSelected(purchase);setEvents(page.items);
      setChange(JSON.stringify({action:'sent',expectedRevision:purchase.revision,channel:'email',confirmationRef:'',confirmedByOperator:true},null,2));
    }catch(e){setFeedback(e instanceof Error?e.message:'Falha ao abrir compra');}
    finally{setLoading(false);}
  };
  const submit=async(kind:'create'|'change')=>{
    setLoading(true);setFeedback('');
    try{
      const parsed=JSON.parse(kind==='create'?draft:change) as unknown;
      const path=kind==='create'?'/api/company/purchases':'/api/company/purchases/'+encodeURIComponent(selected?.id||'');
      const response=await request<{result:PurchaseOrder}>(path,kind==='create'?'POST':'PATCH',parsed);
      setFeedback(kind==='create'?'Rascunho registrado. Sem envio ou estoque automático.':'Operação registrada com auditoria.');
      await reload();
      if(kind==='change')await open(response.result.id);
    }catch(e){setFeedback(e instanceof Error?e.message:'Não foi possível registrar a operação');}
    finally{setLoading(false);}
  };
  return <section className="space-y-5" aria-label="Compras empresariais">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Compras de fornecedores de origem</h2>
      <button type="button" onClick={()=>void reload()} disabled={loading}>Atualizar</button></div>
    <p className="text-sm opacity-75">Planejamento de compra. Saldo líquido em estoque dependerá da reconciliação pelo W7; nenhuma entrada é lançada automaticamente.</p>
    {feedback&&<p role="status" className="rounded-lg border p-3">{feedback}</p>}
    <ul aria-label="Ordens de compra" className="space-y-2">{items.map(o=><li key={o.id}>
      <button type="button" className="w-full rounded-lg border p-3 text-left" onClick={()=>void open(o.id)}>
        <strong>{o.reference}</strong> · {o.workflowState} · {o.lines.length} itens · revisão {o.revision}
      </button></li>)}</ul>
    {!items.length&&!loading&&<p>Nenhuma ordem de compra cadastrada.</p>}
    {cursor&&<button type="button" onClick={()=>void reload(cursor)} disabled={loading}>Próxima página</button>}
    {selected&&<article className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Compra {selected.reference}</h3>
      <p>Estado: {selected.workflowState} · solicitado para {new Date(selected.desiredAt.value).toLocaleDateString('pt-BR')}</p>
      <p>Prazo confirmado pelo fornecedor: {selected.supplierPromisedAt?new Date(selected.supplierPromisedAt.value).toLocaleString('pt-BR'):'Não informado'}</p>
      <CompanyInboundTimeline events={events}/>
      <label className="block font-medium" htmlFor="company-purchase-change">Comando de revisão (JSON validado no servidor)</label>
      <textarea id="company-purchase-change" className="w-full rounded-lg border p-2 font-mono text-sm" rows={8} value={change} onChange={e=>setChange(e.target.value)}/>
      <button type="button" onClick={()=>void submit('change')} disabled={loading}>Registrar comando</button>
    </article>}
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer font-semibold">Criar rascunho de compra (formulário técnico QA)</summary>
      <p className="py-2 text-sm">Informe referências reais de W1/W2 e uma cotação explícita. O integrador W9 substituirá este editor técnico por seleção assistida.</p>
      <label className="block" htmlFor="company-purchase-draft">Estrutura da ordem (JSON)</label>
      <textarea id="company-purchase-draft" className="w-full rounded-lg border p-2 font-mono text-sm" rows={12} value={draft} onChange={e=>setDraft(e.target.value)}/>
      <button type="button" onClick={()=>void submit('create')} disabled={loading}>Salvar rascunho</button>
    </details>
  </section>;
}
