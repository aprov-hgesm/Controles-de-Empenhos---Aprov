'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {DeliveryCandidate} from '../../../lib/company/integration/deliveryRoutingContract';
import {externalNavigation} from '../../../lib/company/geo/core.mjs';
import {MapLibreView} from './MapLibreView';
import {useCompanySession,useCompanyEssentialMode} from '../../../components/company/CompanySessionContext';
type Vehicle={id:string;origin:{latitude:number;longitude:number;coordinateSource:string};
 capacity:{weightKg?:number;volumeM3?:number;units?:number};
 driverUid?:string;shift:{start:string;end:string};breaks:Array<{start:string;end:string}>;revision?:number};
type Assignment={candidateDeliveryId:string;vehicleId:string};
type Stop={candidateDeliveryId:string;vehicleId:string;sequence:number;estimatedArrival?:string};
type Proposal={stops:Stop[];unassigned:Array<{candidateDeliveryId:string;reason:string}>;
 source:string;warnings?:string[];requiresHumanApproval:true};
type Stored={id:string;revision:number;status:string;createdAt:string;proposal:Proposal;
 candidates:DeliveryCandidate[];vehicles:Vehicle[];stops:Stop[];
 unassigned:Proposal['unassigned'];createdByUid:string;approvedByHuman?:boolean};
type ResponseData={ok:boolean;result?:unknown;code?:string};
async function response<T>(res:Response):Promise<T>{
 const parsed=await res.json() as ResponseData;
 if(!res.ok||!parsed.ok)throw new Error(parsed.code||'ROUTING_UNAVAILABLE');
 return parsed.result as T;
}
const iso=(value:string)=>new Date(value).toISOString();
const inputClass='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const actionClass='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-40';
const msg:Record<string,string>={
 COMPANY_PILOT_DISABLED:'Piloto empresarial desativado.',
 COMPANY_OPERATION_FORBIDDEN:'Seu papel não permite esta operação.',
 DESTINATION_NEEDS_HUMAN_CONFIRMATION:'Confirme as coordenadas do destino.',
 CAPACITY_EXCEEDED:'Capacidade insuficiente.',
 ROUTING_PROVIDER_DISABLED:'O otimizador não foi habilitado. Use a sequência manual.',
 ROUTING_PROVIDER_UNAVAILABLE:'O provedor não respondeu. Use a sequência manual.',
 REVISION_CONFLICT:'A rota foi alterada em outra sessão. Atualize antes de continuar.',
};
export function RoutingWorkspace({getIdToken,initialCandidates=[]}:{
 getIdToken:()=>Promise<string>;initialCandidates?:DeliveryCandidate[];
}){
 const session=useCompanySession();
 const essential=useCompanyEssentialMode();
 const [candidates,setCandidates]=useState<DeliveryCandidate[]>(initialCandidates);
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [routes,setRoutes]=useState<Stored[]>([]);
 const [selectedVehicle,setSelectedVehicle]=useState('');
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [proposal,setProposal]=useState<Proposal|null>(null);
 const [saved,setSaved]=useState<Stored|null>(null);
 const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);
 const [confirm,setConfirm]=useState(false);
 const [filters,setFilters]=useState({query:'',status:'',driver:'',period:'',minStops:''});
 const [form,setForm]=useState({orderId:'',lineId:'',deliveryId:'',address:'',lat:'',lon:'',
   weight:'',volume:'',units:'1',unload:'',start:'',end:''});
 const [fleetForm,setFleetForm]=useState({id:'',lat:'',lon:'',driver:'',weight:'',volume:'',
   units:'',start:'',end:'',breakStart:'',breakEnd:''});
 const call=useCallback(async<T,>(url:string,method='GET',payload?:unknown,write=false):Promise<T>=>{
  const t=await getIdToken(),r=await fetch(url,{method,cache:'no-store',
   headers:{authorization:'Bearer '+t,...(payload?{'content-type':'application/json'}:{}),
    ...(write?{'idempotency-key':crypto.randomUUID()}: {})},
   ...(payload?{body:JSON.stringify(payload)}:{})});
  return response<T>(r);
 },[getIdToken]);
 const reload=useCallback(async()=>{
  const [r,v,d]=await Promise.all([
   call<{items:Stored[]}>('/api/company/routing?limit=50'),
   call<{items:Vehicle[]}>('/api/company/routing/vehicles?limit=50'),
   call<{items:DeliveryCandidate[];nextCursor:string|null}>('/api/company/routing/candidates?limit=50')]);
  setRoutes(r.items);setVehicles(v.items);setCandidates(d.items);
  if(d.nextCursor)setStatus('Apenas a primeira página de 50 entregas foi carregada.');
 },[call]);
 useEffect(()=>{let active=true;reload().catch(e=>{if(active)setStatus('Consulta: '+(msg[e.message]||e.message));});
  return()=>{active=false;};},[reload]);
 useEffect(()=>{if(!selectedVehicle&&vehicles[0])setSelectedVehicle(vehicles[0].id);},
  [vehicles,selectedVehicle]);
 const displayAssignments=useMemo(()=>{
  const valid=new Set(candidates.map(c=>c.deliveryId));
  const ordered=assignments.filter(a=>valid.has(a.candidateDeliveryId));
  const seen=new Set(ordered.map(a=>a.candidateDeliveryId));
  return [...ordered,...candidates.filter(c=>!seen.has(c.deliveryId)).map(c=>({
   candidateDeliveryId:c.deliveryId,vehicleId:''}))];
 },[assignments,candidates]);
 const allAssignments=useMemo(()=>displayAssignments.filter(a=>a.vehicleId),[displayAssignments]);
 const filtered=useMemo(()=>routes.filter(r=>{
  const text=[r.id,...(r.candidates||[]).map(c=>c.destination.address)].join(' ').toLowerCase();
  return(!filters.query||text.includes(filters.query.toLowerCase()))
   &&(!filters.status||r.status===filters.status)
   &&(!filters.driver||(r.vehicles||[]).some(v=>v.driverUid===filters.driver))
   &&(!filters.period||r.createdAt.slice(0,10)===filters.period)
   &&(!filters.minStops||(r.stops||[]).length>=Number(filters.minStops));
 }),[routes,filters]);
 const act=async(fn:()=>Promise<void>)=>{
  setBusy(true);setStatus('');try{await fn();}catch(e){
   const code=e instanceof Error?e.message:'ROUTING_UNAVAILABLE';
   setStatus(msg[code]||('Operação não concluída: '+code));
  }finally{setBusy(false);}
 };
 function addCandidate(){
  if(!session)return;
  try{
   const coord=form.lat.trim()&&form.lon.trim()?{latitude:Number(form.lat),longitude:Number(form.lon),
    coordinateSource:'operador-confirmou'}:{};
   const candidate:DeliveryCandidate={companyId:session.workspaceId,workspaceId:session.workspaceId,
    deliveryId:form.deliveryId,customerOrderId:form.orderId,customerOrderLineId:form.lineId,
    destination:{address:form.address,confirmed:!!form.lat.trim()&&!!form.lon.trim(),...coord},
    quantity:{value:form.units,unit:'UN'},
    ...(form.weight?{weightKg:Number(form.weight)}:{}),
    ...(form.volume?{volumeM3:Number(form.volume)}:{}),
    ...(form.unload?{unloadMinutes:Number(form.unload)}:{}),
    ...(form.start&&form.end?{receptionWindow:{start:iso(form.start),end:iso(form.end)}}:{})};
   if(candidates.some(c=>c.deliveryId===candidate.deliveryId))throw new Error('DUPLICATE_ID');
   setCandidates(prev=>[...prev,candidate]);
   setAssignments(prev=>[...prev,{candidateDeliveryId:candidate.deliveryId,vehicleId:selectedVehicle||''}]);
   setProposal(null);setSaved(null);
   setStatus('Destino inserido no rascunho. Confirme os dados originais com o W9 antes de qualquer expedição.');
  }catch(e){setStatus('Dados de destino incompletos: '+String(e));}
 }
 async function addVehicle(){
  if(!fleetForm.start||!fleetForm.end)throw new Error('SHIFT_REQUIRED');
  if(Boolean(fleetForm.breakStart)!==Boolean(fleetForm.breakEnd))throw new Error('BREAK_WINDOW_REQUIRED');
  const v:Vehicle={id:fleetForm.id,origin:{latitude:Number(fleetForm.lat),longitude:Number(fleetForm.lon),
    coordinateSource:'operador-confirmou'},capacity:{
     ...(fleetForm.weight?{weightKg:Number(fleetForm.weight)}:{}),
     ...(fleetForm.volume?{volumeM3:Number(fleetForm.volume)}:{}),
     ...(fleetForm.units?{units:Number(fleetForm.units)}:{})},
   shift:{start:iso(fleetForm.start),end:iso(fleetForm.end)},
   breaks:fleetForm.breakStart&&fleetForm.breakEnd?[{start:iso(fleetForm.breakStart),end:iso(fleetForm.breakEnd)}]:[],
   ...(fleetForm.driver?{driverUid:fleetForm.driver}:{})};
  await call('/api/company/routing/vehicles','POST',v,true);
  await reload();setSelectedVehicle(v.id);setStatus('Veículo registrado apenas no ambiente empresarial.');
 }
 async function preview(mode:'manual'|'optimized'){
  if(!session)throw new Error('COMPANY_SESSION_UNAVAILABLE');
  const p=await call<Proposal>('/api/company/routing/preview','POST',
   {mode,candidates,vehicles,assignments:allAssignments});
  setProposal(p);setSaved(null);setConfirm(false);
  setStatus(p.unassigned.length+' parada(s) não alocada(s); '+p.stops.length+
   ' alocada(s). '+(mode==='manual'?'Trânsito/ETA não verificados.':'Sugestão sujeita a aprovação humana.'));
 }
 async function save(){
  if(!proposal||proposal.source!=='manual')throw new Error('MANUAL_REVIEW_REQUIRED');
  const out=await call<{result:Stored}>('/api/company/routing','POST',
   {mode:'manual',candidates,vehicles,assignments:allAssignments},true);
  setSaved(out.result);setStatus('Rascunho salvo com revisão '+out.result.revision+'. Nenhuma entrega foi despachada.');
  await reload();
 }
 async function approve(){
  if(!saved||!confirm)throw new Error('EXPLICIT_CONFIRMATION_REQUIRED');
  const out=await call<{result:Stored}>('/api/company/routing/'+encodeURIComponent(saved.id),'PATCH',
   {action:'approve',expectedRevision:saved.revision,
    confirmedUnassignedIds:saved.unassigned.map(u=>u.candidateDeliveryId),
    confirmedDestinationIds:saved.stops.map(s=>s.candidateDeliveryId)},true);
  setSaved(out.result);setConfirm(false);
  setStatus('Plano aprovado para planejamento. Despacho e prova de entrega pertencem ao W9.');
  await reload();
 }
 async function persistReorder(){
  if(!saved||saved.status!=='draft')throw new Error('ROUTE_NOT_EDITABLE');
  const wanted=displayAssignments.filter(a=>saved.stops.some(t=>t.candidateDeliveryId===a.candidateDeliveryId));
  if(wanted.length!==saved.stops.length||wanted.some(a=>!saved.stops.some(t=>
    t.candidateDeliveryId===a.candidateDeliveryId&&t.vehicleId===a.vehicleId)))
   throw new Error('VEHICLE_OR_STOP_CHANGED_CREATE_NEW_PLAN');
  const out=await call<{result:Stored}>('/api/company/routing/'+encodeURIComponent(saved.id),'PATCH',
   {action:'reorder',expectedRevision:saved.revision,
    orderedIds:wanted.map(a=>a.candidateDeliveryId)},true);
  setSaved(out.result);setProposal(out.result.proposal);
  setStatus('Sequência replanejada, revisão '+out.result.revision+'. Nenhum prazo externo foi modificado.');
  await reload();
 }
 function adoptOptimized(){
  if(!proposal||proposal.source!=='osrm-vroom')return;
  setAssignments([...proposal.stops.map(t=>({candidateDeliveryId:t.candidateDeliveryId,
   vehicleId:t.vehicleId})),...proposal.unassigned.map(t=>({
   candidateDeliveryId:t.candidateDeliveryId,vehicleId:''}))]);
  setProposal(null);setSaved(null);
  setStatus('Sugestão copiada como edição manual. Refaça a prévia para conferir todas as restrições.');
 }
 function move(index:number,direction:number){
  const next=[...displayAssignments];const to=index+direction;
  if(to<0||to>=next.length)return;
  [next[index],next[to]]=[next[to],next[index]];
  setAssignments(next);setProposal(null);
 }
 const activeStops=proposal?.stops||saved?.stops||[];
 const byId=new Map(candidates.map(c=>[c.deliveryId,c]));
 return <div className="space-y-5">
  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
   <strong>Roteirização empresarial · piloto restrito.</strong> Plano não é despacho, recebimento,
   atesto ou baixa de estoque. Coordenadas precisam de confirmação humana e mapas são opcionais.
  </div>
  <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2" aria-label="Filtros de rotas">
   <h2 className="sm:col-span-2 text-lg font-semibold">Consultar rotas</h2>
   <input aria-label="Buscar rota ou região/endereço" placeholder="Rota, região ou endereço"
    className={inputClass} value={filters.query} onChange={e=>setFilters(f=>({...f,query:e.target.value}))}/>
   <select aria-label="Situação" className={inputClass} value={filters.status}
    onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
    <option value="">Todas as situações</option><option value="draft">Rascunho</option>
    <option value="optimizedSuggestion">Sugestão</option><option value="approved">Aprovada</option>
   </select>
   <input aria-label="Data de criação" type="date" className={inputClass} value={filters.period}
    onChange={e=>setFilters(f=>({...f,period:e.target.value}))}/>
   <input aria-label="UID do motorista" placeholder="Motorista (UID)" className={inputClass} value={filters.driver}
    onChange={e=>setFilters(f=>({...f,driver:e.target.value}))}/>
   <input aria-label="Mínimo de destinos" type="number" min={0} placeholder="Mínimo de destinos"
    className={inputClass} value={filters.minStops}
    onChange={e=>setFilters(f=>({...f,minStops:e.target.value}))}/>
   <button type="button" className={actionClass} disabled={busy} onClick={()=>void act(reload)}>Atualizar</button>
   <ul className="sm:col-span-2 space-y-2 text-sm">
    {filtered.length===0&&<li>Não há rotas autorizadas nesta consulta.</li>}
    {filtered.map(r=><li key={r.id} className="rounded-lg bg-slate-50 p-3">
     <strong>{r.id}</strong> · {r.status} · {r.stops.length} parada(s) · {r.createdAt.slice(0,10)}
     <button className={actionClass+' ml-2'} onClick={()=>{setSaved(r);setCandidates(r.candidates);
      setVehicles(r.vehicles);setProposal(r.proposal);
      setAssignments([...r.stops.map(stop=>({candidateDeliveryId:stop.candidateDeliveryId,
       vehicleId:stop.vehicleId})),...r.unassigned.map(stop=>({candidateDeliveryId:stop.candidateDeliveryId,
       vehicleId:''}))]);setConfirm(false);}}>Abrir plano</button>
    </li>)}
   </ul>
  </section>
  <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Origem e veículos">
   <h2 className="text-lg font-semibold">Veículos e origem confirmada</h2>
   <p className="text-sm text-slate-600">Informe coordenadas verificadas, capacidade real, turno e motorista.
    Pausas e limites extras podem vir do W9 por contrato; não são presumidos.</p>
   <div className="grid gap-2 sm:grid-cols-3">
    {(['id','lat','lon','driver','weight','volume','units','start','end','breakStart','breakEnd'] as const).map(k=>
     <label className="text-sm" key={k}>{({id:'ID veículo',lat:'Latitude origem',lon:'Longitude origem',
      driver:'UID motorista (opcional)',weight:'Capacidade kg',volume:'Capacidade m³',
      units:'Capacidade unidades',start:'Turno início',end:'Turno fim',
      breakStart:'Pausa início (opcional)',breakEnd:'Pausa fim (opcional)'} as const)[k]}
      <input className={inputClass} type={['start','end','breakStart','breakEnd'].includes(k)?'datetime-local':'text'}
       value={fleetForm[k]} onChange={e=>setFleetForm(f=>({...f,[k]:e.target.value}))}/>
     </label>)}
   </div>
   <button className={actionClass} disabled={busy} onClick={()=>void act(addVehicle)}>Cadastrar veículo</button>
   <p className="text-sm text-slate-600">Veículos cadastrados: {vehicles.length}</p>
  </section>
  <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Destinos">
   <h2 className="text-lg font-semibold">Destinos da entrega</h2>
   <p className="text-sm text-slate-600">Entrada manual provisória enquanto o W9 não entrega os candidatos
    validados. Nunca confirma pedido ou entrega por si só.</p>
   <div className="grid gap-2 sm:grid-cols-3">
    {(['orderId','lineId','deliveryId','address','lat','lon','weight','volume','units','unload','start','end'] as const).map(k=>
     <label className="text-sm" key={k}>{({orderId:'Pedido OM ID',lineId:'Linha do pedido ID',
      deliveryId:'ID candidato entrega',address:'Endereço confirmado (texto)',
      lat:'Latitude destino',lon:'Longitude destino',weight:'Carga kg',volume:'Carga m³',
      units:'Quantidade UN',unload:'Descarga (minutos)',start:'Janela início',end:'Janela fim'} as const)[k]}
      <input type={k==='start'||k==='end'?'datetime-local':'text'} className={inputClass}
       value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>
     </label>)}
   </div>
   <button type="button" className={actionClass} onClick={addCandidate}>Adicionar destino ao rascunho</button>
   <div className="flex flex-wrap gap-2">
    <select aria-label="Veículo preferencial" value={selectedVehicle} className={inputClass+' max-w-xs'}
     onChange={e=>{setSelectedVehicle(e.target.value);setProposal(null);}}>
     <option value="">Escolha um veículo</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.id}</option>)}
    </select>
    <button className={actionClass} disabled={busy||!candidates.length}
     onClick={()=>void act(()=>preview('manual'))}>Prévia manual</button>
    <button className={actionClass} disabled={busy||!candidates.length}
     onClick={()=>void act(()=>preview('optimized'))}>Otimização opcional</button>
   </div>
   {saved?.status==='draft'&&<button className={actionClass} disabled={busy}
    onClick={()=>void act(persistReorder)}>Salvar nova ordem da rota existente</button>}
   <ol aria-label="Sequência manual acessível" className="space-y-2">
    {displayAssignments.map((a,i)=><li key={a.candidateDeliveryId} draggable
     onDragStart={e=>e.dataTransfer.setData('text/plain',String(i))}
     onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();
      const from=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(from)&&from>=0&&from<displayAssignments.length){
      const arr=[...displayAssignments];const [item]=arr.splice(from,1);arr.splice(i,0,item);
      setAssignments(arr);setProposal(null);}}}
     className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
     <span className="flex-1">{i+1}. {byId.get(a.candidateDeliveryId)?.destination.address||a.candidateDeliveryId}</span>
     <select aria-label={'Veículo para parada '+(i+1)} className={inputClass+' max-w-40'}
      value={a.vehicleId} onChange={e=>{
       const next=[...displayAssignments];next[i]={...a,vehicleId:e.target.value};
       setAssignments(next);setProposal(null);
      }}>
      <option value="">Não alocar</option>
      {vehicles.map(v=><option key={v.id} value={v.id}>{v.id}</option>)}
     </select>
     <button className={actionClass} aria-label={'Mover parada '+(i+1)+' para cima'} disabled={i===0}
      onClick={()=>move(i,-1)}>↑</button>
     <button className={actionClass} aria-label={'Mover parada '+(i+1)+' para baixo'} disabled={i===displayAssignments.length-1}
      onClick={()=>move(i,1)}>↓</button></li>)}
   </ol>
  </section>
  {proposal&&<section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
   aria-label="Prévia da rota">
   <h2 className="text-lg font-semibold">Prévia · {proposal.source}</h2>
   <p className="text-sm">Paradas propostas: {proposal.stops.length}. Sem alocação: {proposal.unassigned.length}.</p>
   <ul className="space-y-2 text-sm">
    {proposal.stops.map(s=><li key={s.candidateDeliveryId} className="rounded-lg bg-blue-50 p-3">
     {s.sequence}. {byId.get(s.candidateDeliveryId)?.destination.address||s.candidateDeliveryId}
     {s.estimatedArrival?' · ETA estimado: '+s.estimatedArrival:' · sem ETA verificado'}
     {(()=>{const dest=byId.get(s.candidateDeliveryId)?.destination;
      if(!dest?.confirmed||dest.latitude===undefined||dest.longitude===undefined)return null;
      return <span className="ml-3 inline-flex gap-3">
       <a rel="noopener noreferrer" target="_blank"
        href={externalNavigation(dest,'waze')}>Abrir Waze</a>
       <a rel="noopener noreferrer" target="_blank"
        href={externalNavigation(dest,'google')}>Abrir Google Maps</a>
      </span>;})()}</li>)}
   </ul>
   {!!proposal.unassigned.length&&<div className="rounded-lg bg-amber-50 p-3 text-sm">
    <strong>Paradas inviáveis ou pendentes (não ocultadas):</strong>
    <ul>{proposal.unassigned.map(x=><li key={x.candidateDeliveryId}>
      {byId.get(x.candidateDeliveryId)?.destination.address||x.candidateDeliveryId}: {msg[x.reason]||x.reason}
    </li>)}</ul></div>}
   {!!proposal.warnings?.length&&<p className="text-sm text-amber-900">{proposal.warnings.join(' · ')}</p>}
   {proposal.source==='osrm-vroom'&&<button type="button" className={actionClass}
    onClick={adoptOptimized}>Copiar sugestão para revisão manual</button>}
   <button className={actionClass} disabled={busy||proposal.source!=='manual'||saved!==null}
    onClick={()=>void act(save)}>Salvar rascunho manual</button>
   {saved&&saved.status==='draft'&&<div className="space-y-2 border-t pt-3">
    <label className="flex items-start gap-2 text-sm">
     <input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>
     Confirmo pessoalmente destinos, coordenadas, janelas, cargas e paradas não alocadas.
     Sei que aprovar um plano não despacha nem confirma uma entrega.
    </label>
    <button className={actionClass} disabled={busy||!confirm}
     onClick={()=>void act(approve)}>Aprovar plano de rota</button>
   </div>}
  </section>}
  <MapLibreView essential={essential} stops={candidates.map(c=>({id:c.deliveryId,
   address:c.destination.address,latitude:c.destination.latitude,longitude:c.destination.longitude,
   confirmed:c.destination.confirmed}))}/>
  <p role="status" aria-live="polite" className="text-sm text-slate-700">{status}</p>
 </div>;
}
