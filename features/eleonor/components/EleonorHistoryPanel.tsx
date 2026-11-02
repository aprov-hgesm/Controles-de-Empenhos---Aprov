'use client';
import {useEffect,useState} from 'react';
import type {User} from 'firebase/auth';
import {Pencil,Plus,Trash2} from 'lucide-react';
type Summary={id:string;title:string;updatedAt:string;messageCount:number};
export type StoredChatMessage={id:string;role:'user'|'assistant';text:string;at:string;status?:string;route?:string};
export function EleonorHistoryPanel({user,activeId,refreshKey,onSelect,onNew}:{
 user:User|null;activeId?:string;refreshKey:number;
 onSelect:(id:string,messages:StoredChatMessage[])=>void;onNew:()=>void;
}){
 const [list,setList]=useState<Summary[]>([]);
 const [available,setAvailable]=useState(false);
 const [error,setError]=useState('');
 const [pending,setPending]=useState(false);
 const load=async()=>{
  if(!user){setList([]);setAvailable(false);return;}
  try{
   const token=await user.getIdToken();
   const response=await fetch('/api/emprovex-ai/history',{
    headers:{Authorization:'Bearer '+token},cache:'no-store'
   });
   if(!response.ok){setAvailable(false);setError('Histórico ainda indisponível neste ambiente.');return;}
   const data=await response.json() as {threads?:Summary[]};
   setList(Array.isArray(data.threads)?data.threads:[]);
   setAvailable(true);setError('');
  }catch{setError('Falha ao consultar histórico.');}
 };
 useEffect(()=>{void load();},[user?.uid,refreshKey]);
 const open=async(id:string)=>{
  if(!user||pending)return;setPending(true);
  try{
   const token=await user.getIdToken();
   const response=await fetch('/api/emprovex-ai/history/'+encodeURIComponent(id),{
    headers:{Authorization:'Bearer '+token},cache:'no-store'
   });
   if(!response.ok)throw Error('open');
   const data=await response.json() as {thread:{id:string;messages:StoredChatMessage[]}};
   if(data.thread?.id!==id||!Array.isArray(data.thread.messages))throw Error('format');
   onSelect(id,data.thread.messages);
   setError('');
  }catch{setError('Não foi possível abrir a conversa.');}
  finally{setPending(false);}
 };
 const rename=async(item:Summary)=>{
  if(!user||pending)return;
  const title=window.prompt('Renomear conversa',item.title)?.trim();
  if(!title||title.length>72)return;
  setPending(true);
  try{
   const token=await user.getIdToken();
   const r=await fetch('/api/emprovex-ai/history/'+encodeURIComponent(item.id),{
    method:'PATCH',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({title}),cache:'no-store'
   });
   if(!r.ok)throw Error('rename');
   await load();
  }catch{setError('Não foi possível renomear.');}
  finally{setPending(false);}
 };
 const remove=async(item:Summary)=>{
  if(!user||pending||!window.confirm('Excluir definitivamente esta conversa e suas mensagens?'))return;
  setPending(true);
  try{
   const token=await user.getIdToken();
   const r=await fetch('/api/emprovex-ai/history/'+encodeURIComponent(item.id),{
    method:'DELETE',headers:{Authorization:'Bearer '+token},cache:'no-store'
   });
   if(!r.ok)throw Error('delete');
   if(activeId===item.id)onNew();
   await load();
  }catch{setError('A exclusão não foi concluída.');}
  finally{setPending(false);}
 };
 return <nav aria-label="Histórico de conversas da Eleonor" className="flex h-full min-h-0 flex-col overflow-hidden">
  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 text-xs font-bold text-slate-700">
   <span>Conversas anteriores</span>
   <button type="button" onClick={onNew} title="Nova conversa" aria-label="Nova conversa"
    className="rounded-md p-1 hover:bg-slate-100"><Plus className="h-4 w-4"/></button>
  </div>
  <div className="min-h-0 flex-1 overflow-y-auto p-2">
   {!available&&<p className="p-2 text-xs text-amber-700">{error||'Verificando histórico...'}</p>}
   {available&&list.length===0&&<p className="p-2 text-xs text-slate-500">As próximas conversas salvas aparecerão aqui.</p>}
   {list.map(item=><div key={item.id} className={`group mb-1 flex items-center gap-1 rounded-lg ${activeId===item.id?'bg-blue-100':'hover:bg-slate-100'}`}>
    <button type="button" disabled={pending} onClick={()=>void open(item.id)} title={item.title}
     className="min-w-0 flex-1 truncate px-2 py-2 text-left text-xs text-slate-700">{item.title}</button>
    <button type="button" disabled={pending} onClick={()=>void rename(item)} title="Renomear conversa"
     aria-label={`Renomear ${item.title}`} className="rounded p-1 text-slate-500 hover:bg-white"><Pencil className="h-3.5 w-3.5"/></button>
    <button type="button" disabled={pending} onClick={()=>void remove(item)} title="Excluir conversa"
     aria-label={`Excluir ${item.title}`} className="rounded p-1 text-red-600 hover:bg-white"><Trash2 className="h-3.5 w-3.5"/></button>
   </div>)}
   {error&&available&&<p role="status" className="p-2 text-xs text-amber-700">{error}</p>}
  </div>
  {available&&<p className="border-t border-slate-200 px-3 py-2 text-[10px] text-slate-500">
   Histórico privado desta conta e setor. Você pode excluir conversas definitivamente.
  </p>}
 </nav>;
}
