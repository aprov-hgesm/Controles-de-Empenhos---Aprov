'use client';
import {useCallback,useState} from 'react';

type ReportView='maps'|'production'|'timeliness'|'occurrences'|'nutrition'|'waste';
type FilterFields={from:string;to:string;unitId:string;cycleId:string;mealType:string;status:string;dietCode:string;late:string};
type ReportResult={
  view:string;filters:Record<string,unknown>;rows:Record<string,unknown>[];summary:Record<string,unknown>;
  page:number;pageSize:number;total:number;totalPages:number;partial:boolean;generatedAt:string;notice:string;
};
export type ReportingViewProps={
  organizationId:string;
  unitIds:readonly string[];
  getAccessToken:()=>Promise<string>;
  initialView?:ReportView;
};
const reports:{id:ReportView;label:string}[]=[
  {id:'maps',label:'Mapas diários'},
  {id:'production',label:'Produção'},
  {id:'timeliness',label:'Pontualidade'},
  {id:'occurrences',label:'Ocorrências'},
  {id:'nutrition',label:'Nutrição'},
  {id:'waste',label:'Desperdício'},
];
const localToday=()=>{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const v=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return v.year+'-'+v.month+'-'+v.day;
};
function paramsOf(view:ReportView,filter:FilterFields,page:number){
  const qs=new URLSearchParams({view,from:filter.from,to:filter.to,page:String(page),pageSize:'50'});
  for(const field of ['unitId','cycleId','mealType','status','dietCode','late'] as const){
    if(filter[field]!=='')qs.set(field,filter[field]);
  }
  return qs;
}
function display(value:unknown){
  if(value===null||value===undefined)return '—';
  if(typeof value==='boolean')return value?'Sim':'Não';
  if(typeof value==='object')return JSON.stringify(value);
  return String(value);
}
/** W9 composes this view inside an authenticated hospital shell. No secrets or QA fixtures in UI. */
export function ReportingView({organizationId,unitIds,getAccessToken,initialView='maps'}:ReportingViewProps){
  const [view,setView]=useState<ReportView>(initialView);
  const [filter,setFilter]=useState<FilterFields>(()=>({from:localToday(),to:localToday(),unitId:'',cycleId:'',mealType:'',status:'',dietCode:'',late:''}));
  const [result,setResult]=useState<ReportResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState('');
  const update=(name:keyof FilterFields,value:string)=>setFilter(old=>({...old,[name]:value}));
  const request=useCallback(async (page=1,format?:'csv'|'pdf')=>{
    const token=await getAccessToken();
    if(!token)throw new Error('Sessão hospitalar indisponível');
    const q=paramsOf(view,filter,page);
    if(format)q.set('format',format);
    const response=await fetch('/api/hospital/reporting?'+q.toString(),{
      method:'GET',
      headers:{Authorization:'Bearer '+token,'X-Hospital-Organization-Id':organizationId},
      cache:'no-store',
    });
    if(!response.ok){
      const body=await response.json().catch(()=>null);
      throw new Error(body?.error?.message||'Não foi possível consultar o relatório');
    }
    return response;
  },[view,filter,organizationId,getAccessToken]);
  const load=async(page=1)=>{
    setBusy(true);setError('');setResult(null);
    try {
      const response=await request(page);
      const body=await response.json();
      if(!body?.ok)throw new Error('Resposta de relatório inválida');
      setResult(body.data);
    }catch(err){
      setError(err instanceof Error?err.message:'Relatório indisponível');
    }finally{setBusy(false)}
  };
  const download=async(format:'csv'|'pdf')=>{
    setExporting(true);setError('');
    try {
      const response=await request(1,format);
      const blob=await response.blob();
      const disposition=response.headers.get('content-disposition')||'';
      const suggested=/filename="([^"]+)"/.exec(disposition)?.[1]||('relatorio-hospitalar.'+format);
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=suggested;document.body.appendChild(a);a.click();a.remove();
      URL.revokeObjectURL(url);
    }catch(err){setError(err instanceof Error?err.message:'Exportação indisponível')}
    finally{setExporting(false)}
  };
  const controls='rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900';
  return <section aria-label="Relatórios da Cozinha Dietética" className="hospital-panel space-y-5 p-5 text-slate-900 sm:p-6">
    <header className="border-b border-slate-100 pb-4"><h2 className="text-xl font-extrabold text-[#173b69]">Consultas e relatórios operacionais</h2><p className="mt-1 text-sm opacity-80">Dados registrados, sem inferência automática de culpa. Fuso local: America/Sao_Paulo; auditoria: UTC.</p></header>
    <div role="group" aria-label="Visão do relatório" className="flex flex-wrap gap-2">
      {reports.map(item=><button type="button" key={item.id} aria-pressed={view===item.id} onClick={()=>{setView(item.id);setResult(null);setError('')}} className={'rounded-md border px-3 py-2 text-sm '+(view===item.id?'bg-[#1454b9] text-white':'border-slate-200 bg-white text-[#35516f] hover:bg-blue-50')}>{item.label}</button>)}
    </div>
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-[#f9fbff] p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1 text-sm">Data inicial<input type="date" className={controls} value={filter.from} onChange={e=>update('from',e.target.value)}/></label>
      <label className="grid gap-1 text-sm">Data final<input type="date" className={controls} value={filter.to} onChange={e=>update('to',e.target.value)}/></label>
      <label className="grid gap-1 text-sm">Unidade<select className={controls} value={filter.unitId} onChange={e=>update('unitId',e.target.value)}><option value="">Minhas unidades</option>{unitIds.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Mapa<select className={controls} value={filter.cycleId} onChange={e=>update('cycleId',e.target.value)}><option value="">Todos</option><option value="06">06h</option><option value="10">10h</option><option value="16">16h</option></select></label>
      <label className="grid gap-1 text-sm">Refeição<select className={controls} value={filter.mealType} onChange={e=>update('mealType',e.target.value)}><option value="">Todas</option><option value="PRIMARY">Principal</option><option value="SECONDARY">Secundária</option></select></label>
      <label className="grid gap-1 text-sm">Pontualidade<select className={controls} value={filter.late} onChange={e=>update('late',e.target.value)}><option value="">Todas</option><option value="false">No prazo</option><option value="true">Fora do prazo</option></select></label>
      <label className="grid gap-1 text-sm">Dieta<input className={controls} value={filter.dietCode} onChange={e=>update('dietCode',e.target.value)} placeholder="Código da dieta" maxLength={128}/></label>
      <label className="grid gap-1 text-sm">Status<input className={controls} value={filter.status} onChange={e=>update('status',e.target.value)} placeholder="Status" maxLength={128}/></label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="button" disabled={busy} onClick={()=>void load(1)} className="hospital-primary-action disabled:opacity-60">Consultar</button>
        <button type="button" disabled={busy||exporting} onClick={()=>void download('csv')} className={controls}>Baixar planilha CSV</button>
        <button type="button" disabled={busy||exporting} onClick={()=>void download('pdf')} className={controls}>Baixar relatório PDF</button>
        {exporting&&<span role="status" className="text-sm">Gerando arquivo…</span>}
      </div>
    </div>
    {busy&&<p role="status">Consultando registros autorizados…</p>}
    {error&&<p role="alert" className="rounded-md border border-red-400 p-3">{error}</p>}
    {!busy&&result&&<div className="space-y-4">
      {result.partial&&<p role="alert" className="rounded-md border border-amber-400 p-3">Consulta parcial. Restrinja o período ou a unidade antes de exportar.</p>}
      <div className="flex flex-wrap gap-4 text-sm"><span>Total: <strong>{result.total}</strong></span><span>Página: {result.page} de {result.totalPages||1}</span><span>Gerado: {new Date(result.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</span></div>
      <p className="text-sm">{result.notice}</p>
      {Object.keys(result.summary).length>0&&<div aria-label="Totais e indicadores" className="flex flex-wrap gap-3">{Object.entries(result.summary).filter(([k])=>k!=='partial').map(([key,value])=><div key={key} className="rounded-lg border px-3 py-2 text-sm"><span className="block opacity-70">{key}</span><strong>{display(value)}</strong></div>)}</div>}
      {!result.rows.length?<p role="status">Nenhum registro encontrado para os filtros.</p>:<div className="overflow-x-auto rounded-xl border"><table className="min-w-full border-collapse text-left text-xs"><thead><tr>{Object.keys(result.rows[0]).map(key=><th scope="col" className="border-b p-3 font-semibold" key={key}>{key}</th>)}</tr></thead><tbody>{result.rows.map((row,i)=><tr key={i} className="border-t">{Object.keys(result.rows[0]).map(key=><td className="max-w-sm break-words p-3" key={key}>{display(row[key])}</td>)}</tr>)}</tbody></table></div>}
      <nav aria-label="Paginação do relatório" className="flex items-center gap-3">
        <button className={controls} type="button" disabled={busy||result.page<=1} onClick={()=>void load(result.page-1)}>Anterior</button>
        <button className={controls} type="button" disabled={busy||result.page>=result.totalPages} onClick={()=>void load(result.page+1)}>Próxima</button>
      </nav>
    </div>}
  </section>;
}
