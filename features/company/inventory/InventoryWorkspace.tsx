'use client';
import {useCallback,useEffect,useState, type FormEvent} from 'react';

type Props={getIdToken:()=>Promise<string|null>};
type Projection={id:string;catalogItemId:string;canonicalUnit:string;onHand:string;reserved:string;revision:number};
type Page={items:Projection[];nextCursor:string|null};
const operations=[
 ['adjust_in','Registrar entrada/ajuste físico'],['adjust_out','Registrar saída/ajuste físico'],
 ['reserve','Reservar estoque para pedido OM'],['release','Liberar reserva'],
 ['dispatch','Expedir estoque reservado'],['return','Registrar devolução física'],
 ['plan_purchase','Vincular compra a pedido OM'],['receive_purchase','Confirmar recebimento físico de compra'],
 ['convert_purchase','Converter compra recebida em reserva'],
 ['dispatch_converted','Expedir reserva convertida'],['release_converted','Liberar reserva convertida'],
 ['return_converted','Devolver expedição convertida'],
 ['unplan_purchase','Liberar alocação de compra'],['direct_dispatch','Expedir direto da origem (sem entrada física)'],
] as const;
export function InventoryWorkspace({getIdToken}:Props){
 const [items,setItems]=useState<Projection[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [kind,setKind]=useState<string>('adjust_in'),[catalogItemId,setCatalogItemId]=useState('');
 const [quantity,setQuantity]=useState(''),[unit,setUnit]=useState('UN'),[reason,setReason]=useState('');
 const [orderId,setOrderId]=useState(''),[orderLineId,setOrderLineId]=useState('');
 const [purchaseOrderId,setPurchaseOrderId]=useState(''),[purchaseLineId,setPurchaseLineId]=useState('');
 const needsOrder=['reserve','release','dispatch','return','plan_purchase','unplan_purchase',
   'convert_purchase','direct_dispatch','dispatch_converted','release_converted','return_converted'].includes(kind);
 const needsPurchase=['plan_purchase','unplan_purchase','receive_purchase','convert_purchase',
   'direct_dispatch','dispatch_converted','release_converted','return_converted'].includes(kind);
 const load=useCallback(async(after?:string)=>{
  setBusy(true);setError('');
  try{
   const token=await getIdToken();if(!token)throw new Error('Sessão empresarial não disponível.');
   const url='/api/company/inventory?limit=30'+(after?'&cursor='+encodeURIComponent(after):'');
   const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   const data=await response.json();
   if(!response.ok||!data.ok)throw new Error(data.error||'Falha ao consultar estoque.');
   const page=data.result as Page;
   setItems(old=>after?[...old,...page.items]:page.items);setCursor(page.nextCursor);
  }catch(e){setError(e instanceof Error?e.message:'Consulta indisponível.');}
  finally{setBusy(false);}
 },[getIdToken]);
 useEffect(()=>{void load();},[load]);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const token=await getIdToken();if(!token)throw new Error('Sessão empresarial expirada.');
   const body={kind,catalogItemId,quantity:{value:quantity,unit},
    ...(kind.startsWith('adjust')?{reason}:{}),
    ...(needsOrder?{customerOrderId:orderId,customerOrderLineId:orderLineId}:{}),
    ...(needsPurchase?{purchaseOrderId,purchaseLineId}:{}),
   };
   const idem=globalThis.crypto.randomUUID();
   const response=await fetch('/api/company/inventory',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':idem},
    body:JSON.stringify(body),cache:'no-store'});
   const data=await response.json();
   if(!response.ok||!data.ok)throw new Error(data.code||'Operação não autorizada.');
   setNotice('Operação registrada e auditada: '+data.result.eventId);
   setQuantity('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao registrar operação.');}
  finally{setBusy(false);}
 };
 return <section className="space-y-5" aria-label="Estoque empresarial">
  <header><h2 className="text-xl font-semibold">Estoque e reservas da empresa</h2>
   <p className="text-sm opacity-75">O saldo físico não inclui compras planejadas nem remessas diretas. Expedição não é entrega atestada.</p></header>
  {error&&<p role="alert" className="rounded-lg border border-red-400/50 p-3">{error}</p>}
  {notice&&<p role="status" className="rounded-lg border p-3">{notice}</p>}
  <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm">
   <caption className="p-3 text-left font-semibold">Posição física por item canônico</caption>
   <thead><tr><th scope="col" className="p-3 text-left">SKU / item</th><th scope="col">Unidade</th>
    <th scope="col">Físico</th><th scope="col">Reservado</th><th scope="col">Livre</th></tr></thead>
   <tbody>{items.map(item=><tr key={item.id} className="border-t">
     <td className="p-3">{item.catalogItemId}</td><td className="text-center">{item.canonicalUnit}</td>
     <td className="text-center">{item.onHand}</td><td className="text-center">{item.reserved}</td>
     <td className="text-center">{Number(item.onHand)-Number(item.reserved)}</td>
    </tr>)}
    {!items.length&&<tr><td colSpan={5} className="p-4 text-center opacity-70">Sem lançamentos físicos registrados.</td></tr>}
   </tbody></table></div>
  {cursor&&<button type="button" disabled={busy} onClick={()=>void load(cursor)}
   className="rounded-lg border px-3 py-2">Carregar mais</button>}
  <form onSubmit={submit} className="rounded-xl border p-4 space-y-3">
   <h3 className="font-semibold">Registrar operação auditável</h3>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">Operação<select required value={kind} onChange={e=>setKind(e.target.value)} className="block w-full rounded border p-2 bg-transparent">
     {operations.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm">ID do item no catálogo<input required value={catalogItemId}
     onChange={e=>setCatalogItemId(e.target.value)} className="block w-full rounded border p-2 bg-transparent"/></label>
    <label className="text-sm">Quantidade<input required inputMode="decimal" pattern="(0|[1-9][0-9]*)(\\.[0-9]{1,3})?"
     value={quantity} onChange={e=>setQuantity(e.target.value)} className="block w-full rounded border p-2 bg-transparent"/></label>
    <label className="text-sm">Unidade<select value={unit} onChange={e=>setUnit(e.target.value)} className="block w-full rounded border p-2 bg-transparent">
     {['UN','KG','G','L','ML','CX','FD','M'].map(v=><option key={v}>{v}</option>)}</select></label>
    {kind.startsWith('adjust')&&<label className="text-sm sm:col-span-2">Justificativa auditável (mínimo 8 caracteres)
     <input required minLength={8} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}
      className="block w-full rounded border p-2 bg-transparent"/></label>}
    {needsOrder&&<><label className="text-sm">ID do pedido da OM<input required value={orderId} onChange={e=>setOrderId(e.target.value)} className="block w-full rounded border p-2 bg-transparent"/></label>
     <label className="text-sm">Linha do pedido<input required value={orderLineId} onChange={e=>setOrderLineId(e.target.value)} className="block w-full rounded border p-2 bg-transparent"/></label></>}
    {needsPurchase&&<><label className="text-sm">ID da compra confirmada<input required value={purchaseOrderId} onChange={e=>setPurchaseOrderId(e.target.value)} className="block w-full rounded border p-2 bg-transparent"/></label>
     <label className="text-sm">Linha da compra<input required value={purchaseLineId} onChange={e=>setPurchaseLineId(e.target.value)} className="block w-full rounded border p-2 bg-transparent"/></label></>}
   </div>
   <button disabled={busy} type="submit" className="rounded-lg border px-4 py-2 font-medium">
    {busy?'Processando…':'Confirmar operação'}</button>
   <p className="text-xs opacity-70">Os dados são validados no servidor; fornecedor e compras precisam ter contratos integrados. O envio de mensagens e o atesto da OM não são automáticos.</p>
  </form>
 </section>;
}
