'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {User} from 'firebase/auth';
import {Cloud,CloudOff,Loader2,ChevronDown,RefreshCw,Unplug} from 'lucide-react';
import {creditAuth} from '../auth/creditFirebase';
import {connectGoogleDriveForWorkspace,isWorkspaceGoogleDriveSessionExpired,GOOGLE_IDENTITY_SERVICES_URL,type WorkspaceGoogleDriveSession} from '@/lib/googleDriveWorkspace';

type Drive={connected:boolean;ready:boolean;busy:boolean;error:string;connect:()=>Promise<void>;disconnect:()=>void;headers:()=>Record<string,string>;available:()=>boolean};
const Context=createContext<Drive|null>(null);
export function useCreditDrive(){const ctx=useContext(Context);if(!ctx)throw new Error('Sessão documental indisponível.');return ctx;}
function gisReady(){return !!(window as Window & {google?:{accounts?:{oauth2?:unknown}}}).google?.accounts?.oauth2;}
export function CreditDriveProvider({user,ug,children}:{user:User;ug:string;children:ReactNode}){
  const [ready,setReady]=useState(false),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const session=useRef<WorkspaceGoogleDriveSession|null>(null),generation=useRef(0),pending=useRef(false);
  useEffect(()=>{
    let live=true;const check=()=>{if(live)setReady(gisReady());};check();
    let script=document.querySelector<HTMLScriptElement>('script[src="'+GOOGLE_IDENTITY_SERVICES_URL+'"]');
    if(!script){script=document.createElement('script');script.src=GOOGLE_IDENTITY_SERVICES_URL;script.async=true;document.head.appendChild(script);}
    script.addEventListener('load',check);
    const timer=window.setInterval(()=>{check();if(session.current&&isWorkspaceGoogleDriveSessionExpired(session.current)){session.current=null;setConnected(false);}},15000);
    return()=>{live=false;generation.current++;session.current=null;script?.removeEventListener('load',check);window.clearInterval(timer);};
  },[user.uid,ug]);
  const available=()=>!!session.current&&!isWorkspaceGoogleDriveSessionExpired(session.current)&&creditAuth.currentUser?.uid===user.uid;
  function headers(){if(!available()){session.current=null;setConnected(false);throw new Error('Conecte novamente o Google Drive do gestor.');}return {'x-credit-drive-token':session.current!.accessToken};}
  function disconnect(){generation.current++;session.current=null;setConnected(false);setError('');}
  async function connect(){
    if(pending.current)return;
    if(!gisReady()){setError('O serviço Google ainda não está disponível. Confira a conexão e permita pop-ups.');return;}
    pending.current=true;const epoch=++generation.current;setBusy(true);setError('');
    const current=()=>epoch===generation.current&&creditAuth.currentUser?.uid===user.uid;
    try{
      const email=user.email?.trim().toLowerCase();if(!email)throw new Error('Conta sem e-mail autorizado.');
      const s=await connectGoogleDriveForWorkspace(user,{status:'sector',email,accountType:'sector',workspaceId:'credit-'+ug,workspaceName:'Controle de Crédito',ug,institutionalProfile:{organizationName:'EMPROVEX',sectionName:'Controle de Crédito'},legacyDataMode:false,legacySettingsMode:false,canLoadOperationalData:true,resolutionSource:'platform-directory'});
      if(!current())return;
      const token=await user.getIdToken();if(!current())return;
      const res=await fetch('/api/controle-credito/drive',{method:'POST',headers:{authorization:'Bearer '+token,'x-credit-drive-token':s.accessToken},cache:'no-store'});
      const data=await res.json();if(!current())return;
      if(!res.ok)throw new Error(data.error||'Não foi possível configurar o armazenamento privado.');
      session.current=s;setConnected(true);
    }catch(e){if(current()){session.current=null;setConnected(false);setError(e instanceof Error?e.message:'Falha ao conectar Google Drive.');}}
    finally{pending.current=false;setBusy(false);}
  }
  return <Context.Provider value={{connected,ready,busy,error,connect,disconnect,headers,available}}>{children}</Context.Provider>;
}
export function CreditDriveControl({compact=false}:{compact?:boolean}){
  const d=useCreditDrive();
  const [menu,setMenu]=useState(false);const menuRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!compact||!menu)return;const outside=(e:PointerEvent)=>{if(!menuRef.current?.contains(e.target as Node))setMenu(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[compact,menu]);
  if(compact)return <div ref={menuRef} className="relative flex items-center"><button type="button" className="emprovex-header-control inline-flex items-center gap-1.5" aria-expanded={menu} aria-label={d.connected?'Gerenciar Google Drive':'Google Drive'} disabled={d.busy} onClick={()=>setMenu(v=>!v)} title="Gerenciar armazenamento privado">{d.busy?<Loader2 className="h-4 w-4 animate-spin"/>:d.connected?<Cloud className="h-4 w-4 text-emerald-400"/>:<CloudOff className="h-4 w-4"/>}<span className="hidden sm:inline">{d.busy?'Conectando':d.connected?'Drive conectado':'Conectar Drive'}</span><ChevronDown className="h-3 w-3"/></button>{menu&&<div className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl"><div><p className="text-sm font-extrabold">Google Drive</p><p className="mt-1 text-xs text-slate-600">{d.connected?'Conectado à pasta privada.':'Conecte a conta para enviar ou baixar documentos originais.'}</p></div>{d.error&&<p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">{d.error}</p>}<button type="button" disabled={d.busy||!d.ready} onClick={()=>void d.connect()} className="flex w-full items-center gap-2 rounded-lg bg-[#16334d] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><RefreshCw className="h-4 w-4"/>{d.busy?'Conectando…':d.connected?'Reconectar':'Conectar Drive'}</button>{d.connected&&<button type="button" onClick={()=>{d.disconnect();setMenu(false);}} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Unplug className="h-4 w-4"/> Desconectar</button>}</div>}</div>;
  return <div className={compact?'flex items-center gap-2':'space-y-3'}>
    <button type="button" disabled={d.busy||!d.ready} onClick={()=>void d.connect()} title={d.error||'Conectar a conta Google do gestor'} className={compact?'emprovex-header-control':'inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50'}>
      {d.busy?<Loader2 className="h-4 w-4 animate-spin"/>:d.connected?<Cloud className="h-4 w-4 text-emerald-400"/>:<CloudOff className="h-4 w-4"/>}
      {d.busy?'Conectando':d.connected?'Drive conectado':d.error?'Reconectar Drive':'Conectar Drive'}
    </button>
    {!compact&&<><p className="text-sm text-slate-600">Use a conta Google do gestor. Os arquivos ficam em uma pasta privada da UG. A autorização é temporária e não altera o login.</p>{d.connected&&<button type="button" onClick={d.disconnect} className="text-sm font-semibold text-blue-700 underline">Desconectar</button>}{d.error&&<p role="alert" className="text-sm text-red-700">{d.error}</p>}</>}
  </div>;
}
