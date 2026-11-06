'use client';
import {useEffect,useState} from 'react';
type Props={getIdToken:()=>Promise<string|null>;customerOrderId?:string};
type Projection={id:string;catalogItemId:string;customerOrderId:string;customerOrderLineId:string;
 sourceType:'stock'|'purchase';purchaseOrderId:string|null;reserved:string;planned:string;dispatched:string};
export function AllocationWorkspace({getIdToken,customerOrderId}:Props){
 const [items,setItems]=useState<Projection[]>([]),[error,setError]=useState('');
 const [busy,setBusy]=useState(true);
 useEffect(()=>{let active=true;(async()=>{
   try{const token=await getIdToken();if(!token)throw new Error('Sessão empresarial indisponível.');
     const url='/api/company/inventory/allocations?view=links&limit=50'+
       (customerOrderId?'&orderId='+encodeURIComponent(customerOrderId):'');
     const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
     const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.code||'Falha ao carregar alocações.');
     if(active)setItems(data.result.items);
   }catch(e){if(active)setError(e instanceof Error?e.message:'Serviço indisponível.');}
   finally{if(active)setBusy(false);}
 })();return()=>{active=false;};},[getIdToken,customerOrderId]);
 return <section aria-label="Alocações dos pedidos da OM" className="space-y-3">
  <h2 className="text-lg font-semibold">Alocações por pedido da OM</h2>
  <p className="text-sm opacity-75">Cada vínculo identifica a origem da mercadoria e a linha do pedido. Reserva física, compra planejada e expedição são fatos distintos. Sem atesto automático.</p>
  {busy&&<p role="status">Consultando vínculos…</p>}{error&&<p role="alert">{error}</p>}
  {!busy&&!error&&<div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm">
   <thead><tr><th className="p-2 text-left">Pedido · Linha</th><th>Produto</th><th>Fonte</th><th>Reserva</th><th>Compra planejada</th><th>Expedido</th></tr></thead>
   <tbody>{items.map(x=><tr key={x.id} className="border-t"><td className="p-2">{x.customerOrderId} · {x.customerOrderLineId}</td>
    <td>{x.catalogItemId}</td><td>{x.sourceType==='purchase'?'Compra '+x.purchaseOrderId:'Estoque físico'}</td><td>{x.reserved}</td><td>{x.planned}</td>
    <td>{x.dispatched}</td></tr>)}
    {!items.length&&<tr><td className="p-3 text-center" colSpan={6}>Sem alocações cadastradas.</td></tr>}
   </tbody></table></div>}
 </section>;
}
