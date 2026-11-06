'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Member = {id:string;email:string;status:string;roles:string[];revision:number};
type MemberPage = {owner:{email:string};members:Member[];nextPageToken:string};
const roles = ['admin','operations','stock','logistics','driver','finance'] as const;
export function CompanyTeamWorkspace({getIdToken}:{getIdToken:()=>Promise<string>}) {
  const [list,setList]=useState<MemberPage|null>(null);
  const [email,setEmail]=useState('');
  const [role,setRole]=useState<(typeof roles)[number]>('operations');
  const [secret,setSecret]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const request=useCallback(async(path:string,init?:RequestInit)=>{
    const token=await getIdToken();
    const response=await fetch('/api/company/members'+path,{
      ...init,cache:'no-store',headers:{Authorization:'Bearer '+token,
      ...(init?.body?{'Content-Type':'application/json'}:{}),...init?.headers},
    });
    const data=await response.json() as {ok:boolean;result?:unknown;code?:string};
    if(!response.ok||!data.ok)throw new Error(data.code||'Não foi possível consultar a equipe');
    return data.result;
  },[getIdToken]);
  const refresh=useCallback(async()=>{
    try {setList(await request('?limit=50') as MemberPage);}
    catch(e){setError(e instanceof Error?e.message:'Equipe indisponível');}
  },[request]);
  useEffect(()=>{void refresh();},[refresh]);
  const invite=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setSecret('');
    try{
      const result = (await request('', {method:'POST', body:JSON.stringify({email,roles:[role]})})) as { invitationToken:string };
      setSecret(result.invitationToken);setEmail('');await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Convite recusado');}
    finally{setBusy(false);}
  };
  const revoke=async(member:Member)=>{
    if(!window.confirm('Revogar o acesso deste integrante?'))return;
    setBusy(true);setError('');setSecret('');
    try{await request('/'+encodeURIComponent(member.id),{method:'DELETE'});await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Falha ao revogar');}
    finally{setBusy(false);}
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Equipe empresarial">
    <h2 className="text-lg font-bold text-slate-900">Equipe e convites</h2>
    <p className="text-sm text-slate-600">Permissões verificadas no servidor a cada operação. Convites devem ser compartilhados manualmente; nenhum e-mail é enviado automaticamente.</p>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <form onSubmit={invite} className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm sm:col-span-2">E-mail do integrante
        <input type="email" required autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"/></label>
      <label className="text-sm">Papel inicial
        <select value={role} onChange={e=>setRole(e.target.value as typeof role)} className="mt-1 w-full rounded-lg border p-2">
          {roles.map(x=><option key={x} value={x}>{x}</option>)}
        </select></label>
      <button type="submit" disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">Gerar convite</button>
    </form>
    {secret&&<div role="status" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-semibold">Token de convite — exibido somente agora</p>
      <p className="break-all font-mono text-xs">{secret}</p>
      <p>Envie o endereço /empresa-convite e o token por canal seguro, junto do ID do workspace autorizado.</p>
      <button type="button" onClick={()=>{void navigator.clipboard.writeText(secret);}}
        className="rounded-lg border px-3 py-2">Copiar token</button>
    </div>}
    {list&&<div className="overflow-x-auto">
      <p className="text-xs text-slate-500">Titular imutável: {list.owner.email}</p>
      <table className="mt-2 min-w-full text-left text-sm"><thead><tr className="border-b">
        <th className="p-2">Integrante</th><th className="p-2">Papel</th><th className="p-2">Estado</th><th className="p-2">Ação</th>
      </tr></thead><tbody>{list.members.map(member=><tr className="border-b" key={member.id}>
        <td className="p-2">{member.email}</td><td className="p-2">{member.roles.join(', ')}</td>
        <td className="p-2">{member.status}</td>
        <td className="p-2"><button type="button" disabled={busy||member.status==='revoked'}
          className="rounded-lg border px-3 py-2 text-red-700" onClick={()=>void revoke(member)}>Revogar</button></td>
      </tr>)}</tbody></table>
      {!list.members.length&&<p className="mt-3 text-sm text-slate-500">Nenhum integrante convidado.</p>}
      {list.nextPageToken&&<p className="text-xs text-amber-700">Lista parcial. Há mais integrantes a consultar.</p>}
    </div>}
  </section>;
}
