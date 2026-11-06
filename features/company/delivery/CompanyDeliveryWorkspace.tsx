'use client';
import {useCallback,useEffect,useState} from 'react';
type Shipment={id:string;revision:number;customerOrderId:string;customerOrderLineId:string;deliveryState:string;
 quantity:{value:string;unit:string};deliveredQuantity:{value:string;unit:string};
 driverUid:string;destination:{address:string};manualSequence:number;source:string;routePlanId?:string|null};
type Page={items:Shipment[];nextCursor:string|null};
type Props={getIdToken:()=>Promise<string>};
const stamp=()=>crypto?.randomUUID?.()||'w9_'+Date.now();
export function CompanyDeliveryWorkspace({getIdToken}:Props){
 const [items,setItems]=useState<Shipment[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<Shipment|null>(null);
 const [routeIds,setRouteIds]=useState<Record<string,string>>({});
 const [draft,setDraft]=useState({customerOrderId:'',customerOrderLineId:'',catalogItemId:'',
  quantity:'',unit:'KG',driverUid:'',address:'',manualSequence:'1',source:'company_stock',
  purchaseOrderId:'',purchaseLineId:'',w7DispatchEventId:''});
 const [eventKind,setEventKind]=useState('collected'),[reason,setReason]=useState(''),
 [proof,setProof]=useState(''),[delivered,setDelivered]=useState(''),[returnEvent,setReturnEvent]=useState('');
 const request=useCallback(async<T,>(url:string,method='GET',payload?:unknown):Promise<T>=>{
  const token=await getIdToken();
  const result=await fetch(url,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,
   ...(payload===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':stamp()})},
   body:payload===undefined?undefined:JSON.stringify(payload)});
  const raw=await result.json() as {ok:boolean;result:T;code?:string};
  if(!result.ok||!raw.ok)throw new Error(raw.code||'Operação não concluída');
  return raw.result;
 },[getIdToken]);
 const reload=useCallback(async(next='')=>{
  setBusy(true);setNotice('');
  try{const page=await request<Page>('/api/company/deliveries?limit=20'+(next?'&cursor='+encodeURIComponent(next):''));
   setItems(page.items);setCursor(page.nextCursor);}
  catch(e){setNotice(e instanceof Error?e.message:'Falha de consulta');}
  finally{setBusy(false);}
 },[request]);
 useEffect(()=>{void reload();},[reload]);
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setNotice('');
  try{
   const body={customerOrderId:draft.customerOrderId,customerOrderLineId:draft.customerOrderLineId,
    catalogItemId:draft.catalogItemId,quantity:{value:draft.quantity,unit:draft.unit},
    source:draft.source,destination:{address:draft.address,confirmed:true},
    driverUid:draft.driverUid,manualSequence:Number(draft.manualSequence),
    ...(draft.source==='supplier_direct'?{purchaseOrderId:draft.purchaseOrderId,
     purchaseLineId:draft.purchaseLineId,w7DispatchEventId:draft.w7DispatchEventId}:{}),
   };
   await request('/api/company/deliveries','POST',body);await reload();
   setNotice('Ordem manual registrada; o PDF é apenas um romaneio, não comprova entrega.');
  }catch(e){setNotice(e instanceof Error?e.message:'Falha ao criar entrega');}
  finally{setBusy(false);}
 };
 const record=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selected)return;setBusy(true);setNotice('');
  try{
   const payload={kind:eventKind,expectedRevision:selected.revision,
    ...(reason?{reason}:{}),...(proof?{proofDocumentId:proof}:{}),
    ...(eventKind==='partial'?{deliveredQuantity:{value:delivered,unit:selected.quantity.unit}}:{}),
    ...(eventKind==='returned'&&returnEvent?{w7ReturnEventId:returnEvent}:{})};
   await request('/api/company/deliveries/'+encodeURIComponent(selected.id),'PATCH',payload);
   setSelected(null);setReason('');setProof('');setDelivered('');await reload();
   setNotice('Fato logístico registrado. Não foi realizado atesto ou lançamento financeiro.');
  }catch(e){setNotice(e instanceof Error?e.message:'Falha ao registrar evento');}
  finally{setBusy(false);}
 };
 const attachApprovedRoute=async(item:Shipment)=>{
  const routePlanId=(routeIds[item.id]||'').trim();
  if(!routePlanId){setNotice('Informe o ID de um plano W11 aprovado.');return;}
  setBusy(true);setNotice('');
  try{
   await request('/api/company/deliveries/'+encodeURIComponent(item.id),'PATCH',
     {kind:'attach_route',routePlanId,expectedRevision:item.revision});
   setRouteIds(prev=>({...prev,[item.id]:''}));await reload();
   setNotice('Rota aprovada associada à entrega. Despacho continua separado.');
  }catch(e){setNotice(e instanceof Error?e.message:'Não foi possível vincular a rota');}
  finally{setBusy(false);}
 };
 const pdf=async(item:Shipment)=>{
  try{
   const token=await getIdToken();
   const r=await fetch('/api/company/deliveries/'+encodeURIComponent(item.id)+'/packing-list',
    {headers:{Authorization:'Bearer '+token},cache:'no-store'});
   if(!r.ok)throw new Error('Não foi possível gerar o romaneio');
   const url=URL.createObjectURL(await r.blob());const link=document.createElement('a');
   link.href=url;link.download='romaneio-'+item.id+'.pdf';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setNotice(e instanceof Error?e.message:'Falha no PDF');}
 };
 return <section aria-label="Expedição e entregas empresariais" className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Expedição e provas</h2>
   <p className="text-sm text-slate-600">Somente quantidades previamente expedidas pelo W7. Sem despacho automático por mapas.</p>
  </div><button type="button" className="rounded-xl border px-4 py-2 text-sm" disabled={busy} onClick={()=>void reload()}>Atualizar</button></header>
  {notice&&<p role="status" className="rounded-xl border bg-slate-50 p-3 text-sm">{notice}</p>}
  <form onSubmit={e=>void create(e)} className="space-y-3 rounded-2xl border bg-white p-5">
   <h3 className="font-semibold">Criar ordem de entrega / romaneio manual</h3>
   <div className="grid gap-3 sm:grid-cols-2">{([
    ['customerOrderId','Pedido da OM'],['customerOrderLineId','Linha do pedido'],
    ['catalogItemId','Item do catálogo'],['quantity','Quantidade já expedida'],
    ['driverUid','UID do motorista responsável'],['address','Endereço confirmado'],
    ['manualSequence','Sequência manual de paradas'],
   ] as const).map(([key,label])=><label key={key} className="text-sm">{label}<input required className="mt-1 w-full rounded-lg border p-2"
    value={draft[key]} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/></label>)}
   <label className="text-sm">Unidade<select className="mt-1 w-full rounded-lg border p-2" value={draft.unit}
    onChange={e=>setDraft(d=>({...d,unit:e.target.value}))}>{['UN','KG','G','L','ML','CX','FD','M'].map(u=><option key={u}>{u}</option>)}</select></label>
   <label className="text-sm">Origem<select value={draft.source} onChange={e=>setDraft(d=>({...d,source:e.target.value}))}
    className="mt-1 w-full rounded-lg border p-2"><option value="company_stock">Estoque da empresa</option>
    <option value="supplier_direct">Fornecedor direto à OM</option></select></label></div>
   {draft.source==='supplier_direct'&&<div className="grid gap-3 sm:grid-cols-3">{([
    ['purchaseOrderId','Ordem de compra'],['purchaseLineId','Linha da compra'],
    ['w7DispatchEventId','Evento W7 direct_dispatch'],
   ] as const).map(([key,label])=><label key={key} className="text-sm">{label}<input required className="mt-1 w-full rounded-lg border p-2"
    value={draft[key]} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/></label>)}</div>}
   <button type="submit" disabled={busy} className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white">Registrar romaneio</button>
  </form>
  {!items.length&&!busy&&<p>Nenhuma ordem de entrega registrada.</p>}
  <ul className="space-y-3">{items.map(item=><li key={item.id} className="rounded-2xl border bg-white p-4">
   <h3 className="break-all font-semibold">Entrega {item.id}</h3>
   <p className="mt-1 text-sm">Pedido {item.customerOrderId} / {item.customerOrderLineId} · {item.quantity.value} {item.quantity.unit}</p>
   <p className="mt-1 text-sm">Estado: <strong>{item.deliveryState}</strong> · entregue {item.deliveredQuantity.value} · revisão {item.revision}</p>
   <p className="mt-1 text-sm">Motorista: {item.driverUid} · parada {item.manualSequence} · {item.destination.address}</p>
   <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>setSelected(item)}
     className="rounded-xl border px-3 py-2 text-sm">Registrar fato</button>
    <button type="button" disabled={busy} onClick={()=>void pdf(item)} className="rounded-xl border px-3 py-2 text-sm">Romaneio PDF</button></div>
   {item.deliveryState==='planned'&&<div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
    <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-700">Plano W11 aprovado
     <input aria-label={'ID da rota aprovada para '+item.id} value={routeIds[item.id]||''}
      onChange={e=>setRouteIds(prev=>({...prev,[item.id]:e.target.value}))}
      placeholder="route_..." className="mt-1 block w-full rounded-lg border bg-white p-2 text-sm"/>
    </label>
    <button type="button" disabled={busy||!(routeIds[item.id]||'').trim()}
     onClick={()=>void attachApprovedRoute(item)}
     className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800">
     Associar rota aprovada</button>
    <p className="w-full text-xs text-slate-600">A aprovação da rota não registra saída, entrega ou atesto.</p>
   </div>}
  </li>)}</ul>
  {cursor&&<button type="button" disabled={busy} className="rounded-lg border p-2" onClick={()=>void reload(cursor)}>Próxima página</button>}
  {selected&&<form onSubmit={e=>void record(e)} className="space-y-3 rounded-2xl border bg-slate-50 p-5">
   <h3 className="font-semibold">Registrar fato · {selected.id}</h3>
   <label className="block text-sm">Evento<select className="mt-1 w-full rounded-lg border p-2" value={eventKind} onChange={e=>setEventKind(e.target.value)}>
    {['collected','departed','delivered','partial','refused','damaged','returned'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   {['partial','refused','damaged','returned'].includes(eventKind)&&<label className="block text-sm">Motivo
    <input required minLength={8} className="mt-1 w-full rounded-lg border p-2" value={reason} onChange={e=>setReason(e.target.value)}/></label>}
   {['delivered','partial','refused','damaged','returned'].includes(eventKind)&&<label className="block text-sm">ID da prova anexada no W5
    <input required value={proof} onChange={e=>setProof(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label>}
   {eventKind==='partial'&&<label className="block text-sm">Quantidade entregue ({selected.quantity.unit})
    <input required value={delivered} onChange={e=>setDelivered(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label>}
   {eventKind==='returned'&&selected.source==='company_stock'&&<label className="block text-sm">Evento de devolução no W7
    <input required value={returnEvent} onChange={e=>setReturnEvent(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label>}
   <div className="flex gap-2"><button type="submit" disabled={busy} className="rounded-lg bg-blue-800 px-4 py-2 text-white">Gravar evento auditável</button>
    <button type="button" className="rounded-lg border px-4 py-2" onClick={()=>setSelected(null)}>Cancelar</button></div>
  </form>}
  <p className="text-xs text-slate-500">Registros logísticos privados. Uma entrega declarada não significa atesto, liquidação, pagamento ou recebimento governamental.</p>
 </section>;
}
