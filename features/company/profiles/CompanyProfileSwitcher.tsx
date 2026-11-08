'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Profile = {
  companyId: string; workspaceId: string; name: string; legalName: string;
  cnpj: string; role: 'owner' | 'member';
};
type Payload = {
  ok: boolean; profiles?: Profile[]; activeCompanyId?: string;
  canSwitch?: boolean; selectionRequired?: boolean; integrationPending?: boolean; code?: string;
};
type Props = {
  getIdToken: () => Promise<string>;
  /** Must cancel pending queries and clear caches on tenant boundary in W10. */
  onBeforeProfileSwitch?: () => void;
};
/**
 * Self-contained W12 component. W10 is responsible for mounting it only after
 * changing the shared guard. Never visually switch before server confirmation.
 */
export function CompanyProfileSwitcher({getIdToken,onBeforeProfileSwitch}: Props) {
  const [data,setData]=useState<Payload | null>(null);
  const [target,setTarget]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const generation=useRef(0);
  const load=useCallback(async (signal: AbortSignal) => {
    const id=++generation.current;
    try {
      const token=await getIdToken();
      if (signal.aborted) return;
      const response=await fetch('/api/company/profiles',{method:'GET',
        headers:{Authorization:'Bearer '+token},cache:'no-store',signal});
      const payload=await response.json() as Payload;
      if (!response.ok || payload.ok!==true || !Array.isArray(payload.profiles)) throw new Error('Perfis indisponíveis.');
      if (signal.aborted || id!==generation.current) return;
      setData(payload);
      setTarget(payload.activeCompanyId || '');
      setError('');
    } catch {
      if (signal.aborted || id!==generation.current) return;
      setData(null);
      setError('Não foi possível consultar os perfis. Tente novamente.');
    }
  },[getIdToken]);
  useEffect(()=>{
    const controller=new AbortController();
    void load(controller.signal);
    return ()=>{controller.abort(); generation.current++;};
  },[load]);
  const change=async () => {
    if (busy || !data?.canSwitch || !target || target===data.activeCompanyId) return;
    if (!data.profiles?.some(p=>p.companyId===target)) return;
    const id=++generation.current;
    setBusy(true);
    setError('');
    try {
      const token=await getIdToken();
      const response=await fetch('/api/company/profiles/select',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Emprovex-Profile-Switch':'1'},
        cache:'no-store',body:JSON.stringify({companyId:target}),
      });
      const payload=await response.json() as {ok?:boolean;activeCompanyId?:string};
      if (!response.ok || payload.ok!==true || payload.activeCompanyId!==target) {
        throw new Error('Troca de empresa não autorizada.');
      }
      if (id!==generation.current) return;
      // A full reload also destroys component/query state from the previous CNPJ.
      onBeforeProfileSwitch?.();
      try { window.localStorage.setItem('emprovex.company.profile.changed', String(Date.now())); } catch { /* optional notification */ }
      window.location.replace('/empresa');
    } catch {
      if (id!==generation.current) return;
      setTarget(data.activeCompanyId || '');
      setError('Troca indisponível. O perfil atual foi preservado.');
    } finally {
      if (id===generation.current) setBusy(false);
    }
  };
  return (
    <section aria-label="Perfil empresarial" className="space-y-2">
      <label htmlFor="emprovex-company-profile" className="block text-sm font-medium">
        Empresa ativa
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select id="emprovex-company-profile" value={target}
          onChange={e=>setTarget(e.target.value)} disabled={busy || !data?.canSwitch}
          className="min-h-11 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          {!data && <option value="">Carregando perfis…</option>}
          {data?.selectionRequired && <option value="">Selecione uma empresa…</option>}
          {data?.profiles?.map(profile=><option key={profile.companyId} value={profile.companyId}>
            {profile.name} · CNPJ {profile.cnpj}
          </option>)}
        </select>
        {data?.canSwitch && <button type="button" onClick={()=>void change()}
          disabled={busy || target===data.activeCompanyId}
          className="min-h-11 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          {busy?'Validando…':'Trocar perfil'}
        </button>}
      </div>
      {data?.integrationPending && <p className="text-xs" role="status">
        Alternância entre CNPJs aguardando integração segura.
      </p>}
      {error && <p className="text-sm" role="alert">{error}</p>}
    </section>
  );
}
