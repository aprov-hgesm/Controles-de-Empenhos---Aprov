'use client';
import {useEffect,useRef,useState} from 'react';
type Stop={id:string;address:string;latitude?:number;longitude?:number;confirmed:boolean};
type MapInstance={remove:()=>void;fitBounds:(bounds:[[number,number],[number,number]],options?:object)=>void};
type MapLibre={Map:new(options:object)=>MapInstance;Marker:new(options?:object)=>{setLngLat:(coords:[number,number])=>{addTo:(map:MapInstance)=>void}}};
declare global{interface Window{maplibregl?:MapLibre}}
/** MapLibre is self-hosted/configured by integrator, loaded only on demand.
 * No default commercial tile service or OSM public tile-server abuse. */
export function MapLibreView({stops,essential=false}:{stops:readonly Stop[];essential?:boolean}){
 const container=useRef<HTMLDivElement>(null),[wanted,setWanted]=useState(false);
 const [state,setState]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
 const eligible=stops.filter(p=>p.confirmed&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
 useEffect(()=>{
  if(!wanted||essential||!container.current)return;
  const asset=process.env.NEXT_PUBLIC_COMPANY_MAPLIBRE_ASSET_URL||'';
  const style=process.env.NEXT_PUBLIC_COMPANY_MAP_STYLE_URL||'';
  // Restrict asset to a same-origin audited vendor bundle. No runtime arbitrary CDN JS.
  if(!asset.startsWith('/vendor/')||!style||!(style.startsWith('/')||style.startsWith('https://'))){
   setState('unavailable');return;
  }
  let disposed=false,map:MapInstance|undefined;
  const mount=()=>{
   if(disposed||!window.maplibregl||!container.current)return;
   try{
    const first=eligible[0];if(!first){setState('unavailable');return;}
    map=new window.maplibregl.Map({container:container.current,style,
      center:[first.longitude,first.latitude],zoom:10,attributionControl:true});
    for(const stop of eligible){
     new window.maplibregl.Marker().setLngLat([stop.longitude!,stop.latitude!]).addTo(map);
    }
    const bounds:[[number,number],[number,number]]=[
     [Math.min(...eligible.map(s=>s.longitude!)),Math.min(...eligible.map(s=>s.latitude!))],
     [Math.max(...eligible.map(s=>s.longitude!)),Math.max(...eligible.map(s=>s.latitude!))]];
    if(bounds[0][0]!==bounds[1][0]||bounds[0][1]!==bounds[1][1])
      map.fitBounds(bounds,{padding:45,maxZoom:13});
    setState('ready');
   }catch{setState('unavailable');}
  };
  setState('loading');
  if(window.maplibregl){mount();return()=>{disposed=true;map?.remove();};}
  const script=document.createElement('script');script.src=asset;script.async=true;
  script.onload=mount;script.onerror=()=>{if(!disposed)setState('unavailable');};
  document.head.appendChild(script);
  return()=>{disposed=true;map?.remove();script.onload=null;script.onerror=null;script.remove();};
 },[wanted,essential,stops.length,eligible.map(s=>s.id+':'+s.latitude+':'+s.longitude).join('|')]);
 return <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Mapa das entregas">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="font-semibold text-slate-900">Mapa de destinos confirmados</h3>
   <p className="text-xs text-slate-600">Apenas coordenadas confirmadas. Não rastreia motorista nem confirma entregas.</p></div>
   {!wanted&&!essential&&<button type="button" onClick={()=>setWanted(true)}
    className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Carregar mapa</button>}
  </div>
  {wanted&&!essential&&<div ref={container} role="img" aria-label="Visualização geográfica complementar; utilize a lista para navegar"
    className="mt-3 h-80 w-full rounded-xl bg-slate-100" />}
  {(essential||state==='unavailable'||eligible.length===0)&&<p role="status" className="mt-3 text-sm text-amber-800">
   {essential?'Modo Essencial: mapa não carregado.':eligible.length===0?'Nenhum destino georreferenciado confirmado.':
    'MapLibre ou tiles indisponíveis. A lista e o planejamento manual permanecem utilizáveis.'}</p>}
  {state==='loading'&&<p role="status" className="mt-2 text-sm text-slate-600">Carregando mapa opcional…</p>}
  <ol className="mt-3 space-y-1 text-sm text-slate-700">
   {stops.map(p=><li key={p.id} className="rounded-lg bg-slate-50 p-2">{p.address}
    {!p.confirmed||p.latitude===undefined?' · localização pendente de confirmação':''}</li>)}
  </ol>
  <p className="mt-2 text-xs text-slate-500">Atribuição e licença: exibir conforme o estilo e o provedor de tiles aprovado no integrador.</p>
 </section>;
}
