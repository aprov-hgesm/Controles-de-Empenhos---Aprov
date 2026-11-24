'use client';

import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import type { User } from 'firebase/auth';
import { creditAuth as auth } from '@/features/controle-credito/auth/creditFirebase';
import { useCreditDrive, CreditDriveControl } from './CreditDriveProvider';

type Kind='nc'|'ne';
type Doc={id:string;filename:string;status:'pending'|'ready'|'failed';generated?:boolean};
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
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
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
    refresh(abort.signal).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return()=>{abort.abort();};
    // Keyed wrapper remounts on record and identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  async function save(){
    if(!file||busy)return;
    setBusy(true);setError('');
    const signal=controller.current.signal;
    try{
      const form=new FormData();form.set('entityType',entityType);form.set('entityId',entityId);form.set('file',file);
      await checkedFetch(user,'/documentos',{method:'POST',headers:drive.headers(),body:form,signal});
      if(!signal.aborted){setFile(null);await refresh(signal);}
    }catch(e){if(!signal.aborted){setError(e instanceof Error?e.message:'Falha ao anexar.');await refresh(signal).catch(()=>undefined);}}
    finally{if(!signal.aborted)setBusy(false);}
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
  return <section className="rounded-xl border border-slate-200 p-4 space-y-3">
    <h3 className="font-semibold">Documentos</h3>
    {canUpload?<><p className="text-sm text-slate-600">Anexe o original após salvar o registro financeiro. O arquivo permanece privado na conta Google autorizada.</p>
      <CreditDriveControl/>
      <input aria-label="Arquivo original" type="file" accept={entityType==='nc'?'.html,.htm,text/html':'.pdf,application/pdf'} onChange={change} disabled={busy}/>
      {file&&<p className="text-sm break-all">{file.name}</p>}
      <button type="button" className={action} disabled={!file||busy||!drive.connected} onClick={()=>void save()}>Anexar / tentar novamente</button>
    </>:<p className="text-sm text-slate-600">Consulta reconstruída apenas com os dados autorizados do seu centro.</p>}
    {docs.length===0&&<p className="text-sm text-slate-500">Nenhum documento disponível.</p>}
    {docs.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
      <span className="text-sm break-all">{d.filename} — {d.status==='ready'?'Disponível':d.status==='pending'?'Pendente':'Falha; reenvie o mesmo arquivo'}</span>
      <div className="flex flex-wrap gap-2">{entityType==='nc'&&!d.generated&&<button type="button" className={action} disabled={busy||d.status!=='ready'} onClick={()=>void openDoc(d,true)}>Baixar PDF (texto selecionável)</button>}<button type="button" className={action} disabled={busy||d.status!=='ready'} onClick={()=>void openDoc(d)}>{entityType==='nc'&&!d.generated?'HTML original':'Baixar PDF'}</button></div>
    </div>)}
    {busy&&<p role="status" className="text-sm">Processando documento…</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
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
