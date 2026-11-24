'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {User} from 'firebase/auth';
import {Cloud,CloudOff,Loader2} from 'lucide-react';
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
  return <div className={compact?'flex items-center gap-2':'space-y-3'}>
    <button type="button" disabled={d.busy||!d.ready} onClick={()=>void d.connect()} title={d.error||'Conectar a conta Google do gestor'} className={compact?'emprovex-header-control':'inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50'}>
      {d.busy?<Loader2 className="h-4 w-4 animate-spin"/>:d.connected?<Cloud className="h-4 w-4 text-emerald-400"/>:<CloudOff className="h-4 w-4"/>}
      {d.busy?'Conectando':d.connected?'Drive conectado':d.error?'Reconectar Drive':'Conectar Drive'}
    </button>
    {!compact&&<><p className="text-sm text-slate-600">Use a conta Google do gestor. Os arquivos ficam em uma pasta privada da UG. A autorização é temporária e não altera o login.</p>{d.connected&&<button type="button" onClick={d.disconnect} className="text-sm font-semibold text-blue-700 underline">Desconectar</button>}{d.error&&<p role="alert" className="text-sm text-red-700">{d.error}</p>}</>}
  </div>;
}
