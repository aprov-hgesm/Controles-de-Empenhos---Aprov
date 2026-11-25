'use client';

import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import {FileText,FileCode2,Download,UploadCloud,FolderOpen,CheckCircle2,Clock3,AlertTriangle,Cloud,ChevronDown,Loader2,Eye,RefreshCw} from 'lucide-react';
import type { User } from 'firebase/auth';
import { creditAuth as auth } from '@/features/controle-credito/auth/creditFirebase';
import { useCreditDrive } from './CreditDriveProvider';

type Kind='nc'|'ne';
type Doc={id:string;filename:string;status:'pending'|'ready'|'failed';generated?:boolean;createdAt?:string;sizeBytes?:number;sharedUrl?:string;shareState?:'private'|'pending'|'shared';shareCount?:number};
type Props={entityType:Kind;entityId:string;user:User;canUpload:boolean;ug?:string};
const api='/api/controle-credito';
const action='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50';
function assertDocumentIdentity(user:User,signal?:AbortSignal|null){
  if(signal?.aborted)throw new DOMException('Operação cancelada','AbortError');
  if(auth.currentUser?.uid!==user.uid)throw new Error('Sessão alterada. Entre novamente.');
}
async function checkedFetch(user:User,path:string,init:RequestInit={}){
  assertDocumentIdentity(user,init.signal);
  const headers=new Headers(init.headers);
  const token=await user.getIdToken();
  assertDocumentIdentity(user,init.signal);
  headers.set('Authorization','Bearer '+token);
  const res=await fetch(api+path,{...init,headers,cache:'no-store'});
  assertDocumentIdentity(user,init.signal);
  if(!res.ok){
    const body=await res.json().catch(()=>null);
    throw new Error(typeof body?.error==='string'?body.error:'Não foi possível concluir a operação.');
  }
  return res;
}
async function download(res:Response,name:string,user:User,signal?:AbortSignal){
  const blob=await res.blob();
  assertDocumentIdentity(user,signal);
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener noreferrer';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export function CreditDocuments(props:Props){
  // Key the entire session state by authenticated UID and record.
  return <DocumentPanel key={props.user.uid+':'+props.entityType+':'+props.entityId+':'+props.canUpload} {...props}/>;
}
function DocumentPanel({entityType,entityId,user,canUpload}:Props){
  const drive=useCreditDrive();
  const [docs,setDocs]=useState<Doc[]>([]);
  const [loading,setLoading]=useState(true);
  const [uploadOpen,setUploadOpen]=useState(false);const [historyOpen,setHistoryOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [shareNotice,setShareNotice]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const controller=useRef(new AbortController());
  const query='?entityType='+encodeURIComponent(entityType)+'&entityId='+encodeURIComponent(entityId);
  async function refresh(signal:AbortSignal){
    const res=await checkedFetch(user,'/documentos'+query,{signal});
    const payload=await res.json();
    assertDocumentIdentity(user,signal);
    setDocs(payload.documents);
  }
  useEffect(()=>{
    const abort=new AbortController();controller.current=abort;
    refresh(abort.signal).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>{abort.abort();};
    // Keyed wrapper remounts on record and identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  async function save(){
    if(!file||busy)return;
    setBusy(true);setError('');
    const signal=controller.current.signal;
    try{
      const form=new FormData();form.set('entityType',entityType);form.set('entityId',entityId);form.set('file',file.type?file:new File([file],file.name,{type:entityType==='nc'?'text/html':'application/pdf'}));
      const res=await checkedFetch(user,'/documentos',{method:'POST',headers:drive.headers(),body:form,signal});
      const payload=await res.json();if(!signal.aborted)setShareNotice(payload.document?.shareWarning||(entityType==='ne'&&payload.document?.shareState==='shared'?'Original compartilhado com o centro autorizado.':''));
      if(!signal.aborted){setFile(null);setUploadOpen(false);await refresh(signal);}
    }catch(e){if(!signal.aborted){setError(e instanceof Error?e.message:'Falha ao anexar.');await refresh(signal).catch(()=>undefined);}}
    finally{if(!signal.aborted)setBusy(false);}
  }
  async function synchronize(doc:Doc){
    if(busy||!drive.available())return;setBusy(true);setError('');setShareNotice('');const signal=controller.current.signal;
    try{const res=await checkedFetch(user,'/documentos/'+encodeURIComponent(doc.id),{method:'POST',headers:drive.headers(),signal});const p=await res.json();if(!signal.aborted){setShareNotice(p.document?.shareState==='shared'?'Acesso ao PDF original confirmado.':'Nenhuma conta ativa do centro possui acesso.');await refresh(signal);}}
    catch(e){if(!signal.aborted){setError(e instanceof Error?e.message:'Não foi possível sincronizar o acesso.');await refresh(signal).catch(()=>undefined);}}finally{if(!signal.aborted)setBusy(false);}
  }
  async function openDoc(doc:Doc,pdf=false){
    setBusy(true);setError('');
    const signal=controller.current.signal;
    try{
      const res=await checkedFetch(user,'/documentos/'+encodeURIComponent(doc.id)+'?download=1'+(pdf?'&format=pdf':''),{headers:doc.generated?{}:drive.headers(),signal});
      if(!signal.aborted)await download(res,pdf?doc.filename.replace(/\.html?$/i,'.pdf'):doc.filename,user,signal);
    }catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Falha ao baixar.');}
    finally{if(!signal.aborted)setBusy(false);}
  }
  const change=(e:ChangeEvent<HTMLInputElement>)=>{setFile(e.target.files?.[0]||null);e.target.value='';};
  const title=entityType==='nc'?'Nota de crédito':'Nota de empenho';
  const ready=docs.filter(x=>x.status==='ready');
  const latest=ready[0];
  const remaining=docs.filter(x=>x.id!==latest?.id);
  const disabled=busy||loading;
  const primary='inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#16334d] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#214c70] disabled:cursor-not-allowed disabled:opacity-50';
  const outline='inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
  function documentRow(doc:Doc,featured=false){
    const original=canUpload&&!doc.generated,html=entityType==='nc'&&original;
    const sharedUrl=doc.sharedUrl&&/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]{5,200}\/view$/.test(doc.sharedUrl)?doc.sharedUrl:undefined;
    const locked=disabled||doc.status!=='ready'||original&&!drive.connected;
    const status=doc.status==='ready'?'Disponível':doc.status==='pending'?'Pendente':'Falha no envio';
    const Status=doc.status==='ready'?CheckCircle2:doc.status==='pending'?Clock3:AlertTriangle;
    const size=doc.sizeBytes?doc.sizeBytes>=1048576?(doc.sizeBytes/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB':Math.ceil(doc.sizeBytes/1024)+' KB':'';
    const date=doc.createdAt&&Number.isFinite(Date.parse(doc.createdAt))?new Date(doc.createdAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'';
    return <article key={doc.id} className={'rounded-2xl border p-4 '+(featured?'border-blue-100 bg-gradient-to-br from-white to-blue-50/60':'border-slate-200 bg-white')}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 flex-1 items-start gap-3"><span className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border '+(html?'border-blue-200 bg-blue-100 text-blue-800':'border-red-100 bg-red-50 text-red-700')}>{html?<FileCode2 className="h-6 w-6"/>:<FileText className="h-6 w-6"/>}</span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{doc.generated?'Consulta autorizada':featured?'Arquivo disponível mais recente':'Versão arquivada'}</p><p className="break-all text-sm font-bold text-slate-900" title={doc.filename}>{doc.filename}</p><p className="mt-1 text-xs text-slate-500">{[html?'HTML original do SAG':doc.generated?'PDF reconstruído':'PDF original SIAFI',size,date].filter(Boolean).join(' · ')}</p></div></div><span className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold '+(doc.status==='ready'?'bg-emerald-50 text-emerald-800':doc.status==='pending'?'bg-amber-50 text-amber-800':'bg-red-50 text-red-800')}><Status className="h-3.5 w-3.5"/>{status}</span></div>
      {doc.status==='ready'?<><div className="mt-4 flex flex-wrap gap-2">{sharedUrl?<a className={primary} href={sharedUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4"/> Visualizar NE original</a>:<button type="button" className={primary} disabled={locked} onClick={()=>void openDoc(doc,html)}><Download className="h-4 w-4"/> {doc.generated?'Baixar consulta':'Baixar PDF'}</button>}{original&&entityType==='ne'&&featured&&<button type="button" className={outline} disabled={locked} onClick={()=>void synchronize(doc)}><RefreshCw className="h-4 w-4"/> Sincronizar acesso</button>}{html&&<button type="button" className={outline} disabled={locked} onClick={()=>void openDoc(doc)}><FileCode2 className="h-4 w-4"/> HTML original</button>}</div>{sharedUrl&&<p className="mt-2 text-xs text-slate-600">Abra com a conta Google cadastrada neste centro. O Drive permite visualizar e baixar o PDF original.</p>}{original&&entityType==='ne'&&featured&&<p className="mt-2 text-xs text-slate-600">{doc.shareState==='shared'?'Compartilhamento confirmado: '+(doc.shareCount||0)+' conta(s).':doc.shareState==='pending'?'Compartilhamento pendente de confirmação.':'Original privado; sincronize para conceder acesso ao centro.'}</p>}{html&&<p className="mt-2 text-xs text-slate-500">PDF com texto selecionável, reconstruído a partir do HTML original.</p>}{original&&!drive.connected&&<p className="mt-2 text-xs text-slate-600">Para baixar o original, conecte o Drive na barra superior.</p>}</>:<p className="mt-3 text-xs text-slate-500">Reenvie o mesmo arquivo na opção Anexar documento.</p>}
    </article>;
  }
  const projected:Doc={id:'projection-'+entityType+'-'+entityId,filename:(entityType==='nc'?'NC':'NE')+' — consulta do registro.pdf',status:'ready',generated:true};
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.06)]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-[#f8fafc] to-[#eef4fb] px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-[#16334d] p-2.5 text-white"><FolderOpen className="h-5 w-5"/></span><div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Central documental</p><h3 className="font-montserrat text-lg font-extrabold text-slate-900">Documentos da {entityType.toUpperCase()}</h3><p className="text-xs text-slate-500">{title} · Arquivos e versões</p></div></div>
      {canUpload&&<button type="button" className={outline} disabled={disabled} aria-expanded={uploadOpen} onClick={()=>setUploadOpen(v=>!v)}><UploadCloud className="h-4 w-4"/> {uploadOpen?'Fechar envio':'Anexar documento'}</button>}
    </header>
    <div className="space-y-4 p-4 sm:p-6">
      {canUpload&&!drive.connected&&uploadOpen&&<p className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900"><Cloud className="h-4 w-4 shrink-0"/> Para anexar um original, conecte o Drive na barra superior.</p>}
      {loading?<p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/> Carregando documentos…</p>:latest?documentRow(latest,true):<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"><FolderOpen className="mx-auto mb-2 h-7 w-7 text-slate-400"/><p className="font-semibold text-slate-700">Nenhum original disponível</p><p className="mt-1 text-xs text-slate-500">O registro financeiro permanece disponível para consulta.</p></div>}
      {!loading&&canUpload&&!latest&&documentRow(projected,true)}{!loading&&!canUpload&&entityType==='ne'&&!docs.some(d=>d.sharedUrl)&&<p className="text-xs text-slate-600">O gestor ainda não disponibilizou o PDF original para sua conta Google. A consulta reconstruída continua disponível.</p>}{shareNotice&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{shareNotice}</p>}
      {canUpload&&uploadOpen&&<div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><div><h4 className="font-bold text-slate-900">Anexar {entityType==='nc'?'HTML da NC':'PDF da NE'}</h4><p className="mt-1 text-xs text-slate-600">{entityType==='ne'?'O PDF fica no Drive do gestor e é compartilhado somente com as contas autorizadas do centro. Para registrar uma anulação, utilize Substituir PDF da NE.':'O HTML original fica privado no Drive. O PDF será disponibilizado a partir do HTML original.'}</p></div><label className="block cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-white p-4 text-center hover:bg-blue-50"><UploadCloud className="mx-auto mb-2 h-6 w-6 text-blue-700"/><span className="block text-sm font-semibold text-blue-800">{file?file.name:'Selecionar arquivo'}</span><span className="text-xs text-slate-500">{entityType==='nc'?'HTML (.html, .htm)':'PDF (.pdf)'}</span><input aria-label="Arquivo original" className="sr-only" type="file" accept={entityType==='nc'?'.html,.htm,text/html':'.pdf,application/pdf'} onChange={change} disabled={busy}/></label><button type="button" className={primary} disabled={!file||busy||!drive.connected} onClick={()=>void save()}><UploadCloud className="h-4 w-4"/> Salvar documento</button></div>}
      {!loading&&remaining.length>0&&<div className="space-y-2"><button type="button" className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700" aria-expanded={historyOpen} onClick={()=>setHistoryOpen(v=>!v)}><span>Histórico e arquivos pendentes · {remaining.length}</span><ChevronDown className={'h-4 w-4 transition-transform '+(historyOpen?'rotate-180':'')}/></button>{historyOpen&&remaining.map(doc=>documentRow(doc))}</div>}
      {!loading&&canUpload&&latest&&!latest.generated&&<div className="border-t border-slate-100 pt-3"><button type="button" className={outline} disabled={disabled} onClick={()=>void openDoc(projected)}><FileText className="h-4 w-4"/> Baixar consulta do registro</button><p className="mt-1 text-xs text-slate-500">PDF gerado pelo EMPROVEX, sem necessidade do Drive. Não substitui o original.</p></div>}
      {busy&&<p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin"/> Processando documento…</p>}
      {error&&<p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  </section>;
}

export function CreditReportControls({user,year}:{user:User;year:number}){
  const [type,setType]=useState('saldo');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function exportPdf(){
    setBusy(true);setError('');
    try{await download(await checkedFetch(user,'/relatorios?type='+type+'&year='+year),'credito-'+type+'-'+year+'.pdf',user);}
    catch(e){setError(e instanceof Error?e.message:'Falha ao gerar relatório.');}
    finally{setBusy(false);}
  }
  return <div className="flex flex-wrap items-center gap-2">
    <label className="text-sm">Relatório <select className={action} value={type} onChange={e=>setType(e.target.value)} disabled={busy}>
      <option value="saldo">Saldo e movimentação</option><option value="nc">Notas de crédito</option><option value="ne">Notas de empenho</option>
    </select></label>
    <button type="button" className={action} disabled={busy} onClick={()=>void exportPdf()}>{busy?'Gerando…':'Baixar PDF'}</button>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
